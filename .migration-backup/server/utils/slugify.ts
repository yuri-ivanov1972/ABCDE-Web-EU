const LV_MAP: Record<string, string> = {
  'ā': 'a', 'Ā': 'a',
  'č': 'c', 'Č': 'c',
  'ē': 'e', 'Ē': 'e',
  'ģ': 'g', 'Ģ': 'g',
  'ī': 'i', 'Ī': 'i',
  'ķ': 'k', 'Ķ': 'k',
  'ļ': 'l', 'Ļ': 'l',
  'ņ': 'n', 'Ņ': 'n',
  'š': 's', 'Š': 's',
  'ū': 'u', 'Ū': 'u',
  'ž': 'z', 'Ž': 'z',
  'ō': 'o', 'Ō': 'o',
};

export function slugify(text: string): string {
  return text
    .split('')
    .map(c => LV_MAP[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Category slug: slugified Latvian name + numeric ID for guaranteed uniqueness. */
export function categorySlug(nameLv: string, categoryId: number): string {
  return `${slugify(nameLv)}-${categoryId}`;
}

/** Product slug: slugified product name + numeric ID for guaranteed uniqueness. */
export function productSlug(name: string, productId: number): string {
  return `${slugify(name)}-${productId}`;
}

/**
 * Extract the numeric ID from a slug string.
 * Works for both pure IDs ("182") and slug+ID form ("maize-un-konditoreja-10").
 */
export function extractIdFromSlug(slugOrId: string): number | null {
  if (/^\d+$/.test(slugOrId)) return parseInt(slugOrId, 10);
  const match = slugOrId.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
