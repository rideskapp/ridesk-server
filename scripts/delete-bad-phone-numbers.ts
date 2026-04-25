/**
 * Delete Bad Phone Numbers Script
 *
 * Deletes invalid phone numbers from whatsapp_number column that don't start with "+" (E.164 format).
 * These invalid numbers cause the PhoneInput component to show empty fields.
 * Run: npx tsx scripts/delete-bad-phone-numbers.ts [--dry-run]
 *  or: npm run clean-phone-numbers [-- --dry-run]
 */

import { supabaseAdmin } from "../src/database/supabase";

const DRY_RUN = process.argv.includes("--dry-run");
const PAGE = 1000;
const UPDATE_BATCH = 100;

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  whatsapp_number: string | null;
  role: string;
};

async function getBadPhoneNumbers(): Promise<UserRow[]> {
  const bad: UserRow[] = [];
  let from = 0;

  while (true) {
    // Fetch all users with whatsapp_number not null
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, whatsapp_number, role")
      .not("whatsapp_number", "is", null)
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    // Filter in JavaScript to find numbers that don't start with "+"
    const invalid = (data as UserRow[]).filter(
      (u) => u.whatsapp_number && !u.whatsapp_number.startsWith("+"),
    );

    bad.push(...invalid);

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return bad;
}

function formatUser(u: UserRow): string {
  return [
    `id=${u.id}`,
    `name=${u.first_name || ""} ${u.last_name || ""}`.trim() || "N/A",
    `role=${u.role}`,
    `whatsapp_number=${u.whatsapp_number}`,
  ].join(" ");
}

async function main() {
  console.log("Delete bad phone numbers (numbers not starting with '+')\n");
  if (DRY_RUN) {
    console.log("Mode: DRY RUN — no changes will be made.\n");
  }

  const bad = await getBadPhoneNumbers();

  if (bad.length === 0) {
    console.log("No bad phone numbers found.");
    return;
  }

  console.log(`Found ${bad.length} user(s) with invalid phone numbers:\n`);
  bad.forEach((u, i) => {
    console.log(`  [${i + 1}] ${formatUser(u)}`);
  });

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would delete ${bad.length} phone number(s).`);
    return;
  }

  // Update in batches
  for (let i = 0; i < bad.length; i += UPDATE_BATCH) {
    const batch = bad.slice(i, i + UPDATE_BATCH);
    const ids = batch.map((u) => u.id);

    const { error } = await supabaseAdmin
      .from("users")
      .update({ whatsapp_number: null })
      .in("id", ids);

    if (error) throw error;

    console.log(
      `Updated batch ${Math.floor(i / UPDATE_BATCH) + 1} (${batch.length} records)...`,
    );
  }

  console.log(`\n✅ Deleted ${bad.length} invalid phone number(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
