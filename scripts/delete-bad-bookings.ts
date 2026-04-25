/**
 * Delete Bad Bookings Script
 *
 * Deletes bookings that have no booking_participants and logs each deleted booking.
 * Run: npx tsx scripts/delete-bad-bookings.ts [--dry-run]
 *  or: npm run delete-bad-bookings [-- --dry-run]
 */

import { supabaseAdmin } from "../src/database/supabase";

const DRY_RUN = process.argv.includes("--dry-run");
const PAGE = 1000;
const DELETE_BATCH = 100;

type BookingRow = {
  id: string;
  school_id: string;
  product_id: string;
  total_minutes: number;
  remaining_minutes: number;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

async function getBookingIdsWithParticipants(): Promise<Set<string>> {
  const set = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("booking_participants")
      .select("booking_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach((r: { booking_id: string }) => set.add(r.booking_id));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return set;
}

async function getBadBookings(
  idsWithParticipants: Set<string>,
): Promise<BookingRow[]> {
  const bad: BookingRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, school_id, product_id, total_minutes, remaining_minutes, start_date, end_date, status, notes, created_at, created_by",
      )
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const b of data as BookingRow[]) {
      if (!idsWithParticipants.has(b.id)) bad.push(b);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return bad;
}

function formatBooking(b: BookingRow): string {
  return [
    `id=${b.id}`,
    `school_id=${b.school_id}`,
    `product_id=${b.product_id}`,
    `start_date=${b.start_date}`,
    `end_date=${b.end_date}`,
    `status=${b.status}`,
    `total_minutes=${b.total_minutes}`,
    `remaining_minutes=${b.remaining_minutes}`,
    `created_at=${b.created_at}`,
    `created_by=${b.created_by ?? "(null)"}`,
    b.notes ? `notes=${b.notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function main() {
  console.log("Delete bad bookings (bookings with no participants)\n");
  if (DRY_RUN) {
    console.log("Mode: DRY RUN — no changes will be made.\n");
  }

  const idsWithParticipants = await getBookingIdsWithParticipants();
  const bad = await getBadBookings(idsWithParticipants);

  if (bad.length === 0) {
    console.log("No bad bookings found.");
    return;
  }

  console.log(`Found ${bad.length} booking(s) with no participants:\n`);
  bad.forEach((b, i) => {
    console.log(`  [${i + 1}] ${formatBooking(b)}`);
  });

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would delete ${bad.length} booking(s).`);
    return;
  }

  for (let i = 0; i < bad.length; i += DELETE_BATCH) {
    const batch = bad.slice(i, i + DELETE_BATCH);
    const ids = batch.map((b) => b.id);
    const { error } = await supabaseAdmin
      .from("bookings")
      .delete()
      .in("id", ids);
    if (error) throw error;
  }

  console.log(`\nDeleted ${bad.length} booking(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
