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
