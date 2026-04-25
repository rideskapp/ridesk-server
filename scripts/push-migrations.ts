import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

type MigrationFile = {
  version: number;
  name: string;
  filePath: string;
  sql: string;
};

const MIGRATION_TABLE = "public._ridesk_migrations";
const LOCK_ID = 732145901;

function getDatabaseUrl(): string {
  const directUrl = process.env["SUPABASE_DB_URL"];
  if (directUrl) {
    return directUrl;
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const dbPassword = process.env["SUPABASE_DB_PASSWORD"];

  if (!supabaseUrl || !dbPassword) {
    throw new Error(
      "Missing DB credentials. Set SUPABASE_DB_URL, or both SUPABASE_URL and SUPABASE_DB_PASSWORD in .env",
    );
  }

  let projectRef = "";

  try {
    const parsed = new URL(supabaseUrl);
    projectRef = parsed.hostname.split(".")[0] || "";
  } catch {
    throw new Error(
      "SUPABASE_URL is invalid. Expected format like https://<project-ref>.supabase.co",
    );
  }

  if (!projectRef) {
    throw new Error("Could not parse project ref from SUPABASE_URL");
  }

  return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
}

async function loadMigrationFiles(
  migrationsDir: string,
): Promise<MigrationFile[]> {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);

  const migrations: MigrationFile[] = [];

  for (const name of sqlFiles) {
    const match = name.match(/^(\d+)_.*\.sql$/);
    if (!match?.[1]) {
      continue;
    }

    const version = Number.parseInt(match[1], 10);
    const filePath = path.join(migrationsDir, name);
    const sql = await fs.readFile(filePath, "utf8");

    migrations.push({ version, name, filePath, sql });
  }

  return migrations.sort((a, b) => a.version - b.version);
}

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedVersions(client: Client): Promise<Set<number>> {
  const result = await client.query<{ version: number }>(
    `SELECT version FROM ${MIGRATION_TABLE};`,
  );
  return new Set(result.rows.map((row) => row.version));
}

async function run(): Promise<void> {
  const dbUrl = getDatabaseUrl();
  const migrationsDir = path.resolve(process.cwd(), "supabase", "migrations");
  const migrations = await loadMigrationFiles(migrationsDir);

  if (migrations.length === 0) {
    console.log("No migration files found in supabase/migrations");
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1);", [LOCK_ID]);
    await ensureMigrationTable(client);

    const appliedVersions = await getAppliedVersions(client);
    const pending = migrations.filter(
      (migration) => !appliedVersions.has(migration.version),
    );

    if (pending.length === 0) {
      console.log("All migrations are already applied.");
      return;
    }

    console.log(`Applying ${pending.length} migration(s)...`);

    for (const migration of pending) {
      console.log(`\n-> ${migration.name}`);
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (version, name) VALUES ($1, $2);`,
        [migration.version, migration.name],
      );
      console.log(`   Applied: ${migration.name}`);
    }

    console.log("\nMigration push completed successfully.");
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1);", [LOCK_ID])
      .catch(() => {
        return;
      });
    await client.end();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration push failed: ${message}`);
  process.exit(1);
});
