/**
 * Utility for normalizing Latvian characters to their basic Latin equivalents
 * This helps improve search functionality by matching regardless of diacritics
 */

/**
 * Normalize Latvian text by replacing characters with diacritics with their basic Latin equivalents
 * @param text - The text string to normalize
 * @returns A normalized string with Latvian characters replaced with basic Latin equivalents
 */
export function normalizeLvText(text: string): string {
  if (!text) return '';
  
  // Define character mappings (Latvian specific)
  const charMap: Record<string, string> = {
    'ā': 'a', 'Ā': 'A',
    'č': 'c', 'Č': 'C',
    'ē': 'e', 'Ē': 'E',
    'ģ': 'g', 'Ģ': 'G',
    'ī': 'i', 'Ī': 'I',
    'ķ': 'k', 'Ķ': 'K',
    'ļ': 'l', 'Ļ': 'L',
    'ņ': 'n', 'Ņ': 'N',
    'š': 's', 'Š': 'S',
    'ū': 'u', 'Ū': 'U',
    'ž': 'z', 'Ž': 'Z',
    'ō': 'o', 'Ō': 'O'
  };
  
  // Replace characters using the mapping
  let normalizedText = text;
  for (const [latvian, latin] of Object.entries(charMap)) {
    normalizedText = normalizedText.replace(new RegExp(latvian, 'g'), latin);
  }
  
  return normalizedText.toLowerCase();
}

/**
 * Creates a PostgreSQL ILIKE pattern with normalized text for case-insensitive search
 * @param searchTerm - The original search term (with or without diacritics)
 * @returns A normalized search pattern surrounded by % wildcards for ILIKE queries
 */
export function createSearchPattern(searchTerm: string): string {
  const normalized = normalizeLvText(searchTerm.trim());
  return normalized ? `%${normalized}%` : '';
}