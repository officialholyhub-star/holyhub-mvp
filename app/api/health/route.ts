export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = () => Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (process.env.HOLYHUB_LOCAL_DEMO === "true") return unavailable();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return unavailable();
  try {
    const response = await fetch(new URL("/rest/v1/rpc/launch_readiness", url), {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return unavailable();
    const status = await response.json();
    if (status.schema_version !== 8 || !status.schema_ready || !status.storage_ready || !status.admin_ready) return unavailable();
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
