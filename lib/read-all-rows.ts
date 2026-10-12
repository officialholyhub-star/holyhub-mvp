// PostgREST caps each response. Admin catalogues must not silently omit rows.
export async function readAllRows<T>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const data: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await fetchPage(offset);
    if (result.error || result.data == null) return { data: null, error: result.error ?? new Error("Data unavailable") };
    data.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) return { data, error: null };
  }
}
