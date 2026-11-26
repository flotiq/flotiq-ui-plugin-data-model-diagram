import { SHOWN_SYSTEM_TYPES, extractContentTypes } from './model';

const PAGE_LIMIT = 100;
const COUNT_CONCURRENCY = 4;

/**
 * The user's CTDs plus media and tags, like elsewhere in the editor. Filtered by the API:
 * `internal: false` (paginated) and `names` for the two system types. De-duplicated by name.
 */
export async function loadContentTypes(client) {
  const byName = new Map();
  for (let page = 1; page < 50; page++) {
    const { data, totalPages } = extractContentTypes(
      await client.getContentTypes({
        limit: PAGE_LIMIT,
        page,
        internal: 'false',
      }),
    );
    data.forEach((ctd) => byName.set(ctd.name, ctd));
    if (totalPages === null || page >= totalPages || data.length < PAGE_LIMIT)
      break;
  }
  const { data: systemTypes } = extractContentTypes(
    await client.getContentTypes({
      limit: SHOWN_SYSTEM_TYPES.length,
      page: 1,
      names: SHOWN_SYSTEM_TYPES,
    }),
  );
  systemTypes.forEach((ctd) => byName.set(ctd.name, ctd));
  return [...byName.values()];
}

const extractTotal = (response) => {
  const body = response?.body ?? response;
  return typeof body?.total_count === 'number' ? body.total_count : null;
};

/**
 * Object counts per CTD, reported progressively via onCount(name, count|null).
 * Uses list({ limit: 1 }) and reads total_count; null when not readable (permissions etc.).
 */
export async function loadCounts(client, names, onCount, signal) {
  const queue = [...names];
  const worker = async () => {
    while (queue.length && !signal?.aborted) {
      const name = queue.shift();
      let count = null;
      try {
        count = extractTotal(await client[name].list({ limit: 1, page: 1 }));
      } catch {
        count = null;
      }
      if (!signal?.aborted) onCount(name, count);
    }
  };
  await Promise.all(Array.from({ length: COUNT_CONCURRENCY }, worker));
}
