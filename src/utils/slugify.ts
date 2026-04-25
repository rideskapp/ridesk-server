// Generate a URL-friendly slug from a name
 
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const generateRandomSuffix = (length: number = 4): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateUniqueSlug = async (
  name: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxAttempts: number = 10,
): Promise<string> => {
  const baseSlug = generateSlug(name);

  const exists = await checkExists(baseSlug);
  if (!exists) {
    return baseSlug;
  }

  for (let i = 0; i < maxAttempts; i++) {
    const suffix = generateRandomSuffix(4);
    const uniqueSlug = `${baseSlug}-${suffix}`;

    const slugExists = await checkExists(uniqueSlug);
    if (!slugExists) {
      return uniqueSlug;
    }
  }

  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
};

