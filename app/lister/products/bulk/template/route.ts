import { requireRole } from "@/lib/auth/require-user";
import { buildCsv } from "@/lib/fulfilment";
import { CSV_COLUMNS } from "@/lib/product-csv";

export async function GET() {
  await requireRole("lister");
  return new Response(buildCsv(CSV_COLUMNS, []), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="holyhub-products-template.csv"',
    "Cache-Control": "no-store",
  } });
}
