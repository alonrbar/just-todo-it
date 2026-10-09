/**
 * Performs a fuzzy match between a string and a pattern.
 * Characters in the pattern must appear in the same order in the string,
 * but don't need to be consecutive.
 * 
 * @param str - The string to search in (e.g., file path + TODO text)
 * @param pattern - The pattern to match
 * @returns true if the pattern fuzzy-matches the string
 */
export function fuzzyMatch(str: string, pattern: string): boolean {
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();

  let strIndex = 0;
  let patternIndex = 0;

  while (strIndex < str.length && patternIndex < pattern.length) {
    if (str[strIndex] === pattern[patternIndex]) {
      patternIndex++;
    }
    strIndex++;
  }

  return patternIndex === pattern.length;
}

/**
 * Creates the searchable string for a TODO item.
 * Combines the relative path with the full TODO text for fuzzy matching.
 * 
 * @param relativePath - The workspace-relative file path
 * @param label - The TODO label
 * @param text - The TODO text content
 * @returns Combined string for fuzzy matching
 */
export function createSearchableString(relativePath: string, label: string, text: string): string {
  return `${relativePath} TODO(${label}): ${text}`;
}

/**
 * Maps items through an async function, running at most `concurrency` calls at a time.
 *
 * @param items - The items to map
 * @param concurrency - Maximum number of calls in flight at once
 * @param fn - The async function to apply to each item
 * @returns The results, in the same order as the input items
 */
export async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );

  return results;
}
