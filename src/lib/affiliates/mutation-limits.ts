// Per-request limits, not product limits. Larger user selections are split by
// the client so "unlimited discovery" remains true without one huge request.
// Saved batches are smaller because each row may re-host two images: 10 rows at
// four active 8-second downloads leaves the 60-second route time to finish DB
// work. Discovered writes have no image work; deletes use one SQL statement.
export const SAVED_AFFILIATE_BATCH_MAX_ITEMS = 10;
export const DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS = 100;
export const AFFILIATE_DELETE_BATCH_MAX_ITEMS = 250;
export const AFFILIATE_BATCH_BODY_MAX_BYTES = 1_024 * 1_024;

export interface AffiliateMutationChunk<T> {
  items: T[];
  body: string;
}

export function chunkAffiliateMutationItems<T>(
  items: readonly T[],
  maxItems: number,
  maxBytes: number,
  serializeBody: (items: readonly T[]) => string,
): AffiliateMutationChunk<T>[] {
  if (!Number.isSafeInteger(maxItems) || maxItems <= 0) {
    throw new TypeError('Affiliate batch size must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('Affiliate batch byte limit must be a positive integer.');
  }
  const chunks: AffiliateMutationChunk<T>[] = [];
  const encoder = new TextEncoder();
  let currentItems: T[] = [];
  let currentBody = '';

  for (const item of items) {
    if (currentItems.length === maxItems) {
      chunks.push({ items: currentItems, body: currentBody });
      currentItems = [];
      currentBody = '';
    }

    let candidateItems = [...currentItems, item];
    let candidateBody = serializeBody(candidateItems);
    if (encoder.encode(candidateBody).byteLength > maxBytes) {
      if (currentItems.length === 0) {
        throw new RangeError('One affiliate item exceeds the request byte limit.');
      }
      chunks.push({ items: currentItems, body: currentBody });
      candidateItems = [item];
      candidateBody = serializeBody(candidateItems);
      if (encoder.encode(candidateBody).byteLength > maxBytes) {
        throw new RangeError('One affiliate item exceeds the request byte limit.');
      }
    }
    currentItems = candidateItems;
    currentBody = candidateBody;
  }

  if (currentItems.length > 0) chunks.push({ items: currentItems, body: currentBody });
  return chunks;
}
