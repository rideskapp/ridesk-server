import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "../database/supabase";
import { AppError } from "../types";

export const normalizeAuthEmail = (email: string): string =>
  email.trim().toLowerCase();

/**
 * Find a Supabase Auth user by email. The admin API has no email filter;
 * we paginate listUsers() until a match is found (same pattern as instructors).
 */
export const findAuthUserByEmail = async (
  email: string,
): Promise<User | null> => {
  const normalized = normalizeAuthEmail(email);
  let page = 1;
  const perPage = 1000;
  const maxPages = 100;

  while (page <= maxPages) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Failed to list auth users:", error);
      throw new AppError(`Failed to look up user: ${error.message}`, 500);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }
    page++;
  }

  console.warn(
    `Reached maximum page limit (${maxPages}) while searching for auth user: ${normalized}`,
  );
  return null;
};
