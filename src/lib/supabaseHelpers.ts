import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches ALL rows from a Supabase query, bypassing the default 1000-row limit.
 * Uses pagination with chunks of 1000 rows.
 */
export async function fetchAllRows<T = any>(
  buildQuery: (from: typeof supabase) => any
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await buildQuery(supabase).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
}
