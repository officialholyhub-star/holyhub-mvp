"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-user";
import { validateProductCsv, type CsvRow } from "@/lib/product-csv";

export type ImportResult = { row: number; name: string; status: "imported" | "already imported" | "failed"; message?: string };
export type BulkState = { error?: string; rows?: CsvRow[]; results?: ImportResult[] };

// Stable IDs for the same lister, CSV and row make lost responses/retries safe.
function importId(userId: string, csv: string, row: number) {
  const hash = createHash("sha256").update(JSON.stringify([userId, csv, row])).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function processProductCsv(_previous: BulkState, formData: FormData): Promise<BulkState> {
  const { supabase, user } = await requireRole("lister");
  const csv = formData.get("csv");
  if (typeof csv !== "string") return { error: "Choose a CSV file first." };
  let rows: CsvRow[];
  try { rows = validateProductCsv(csv); } catch (error) { return { error: error instanceof Error ? error.message : "CSV could not be read." }; }
  const { data: storefront, error: storefrontError } = await supabase.from("lister_storefronts").select("user_id").eq("user_id", user.id).maybeSingle();
  if (storefrontError || !storefront) return { error: "Set up your storefront before importing products." };
  const existing = new Map<string, string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("products").select("id, sku").eq("lister_user_id", user.id).not("sku", "is", null).order("id").range(offset, offset + 999);
    if (error) return { error: "We couldn't check your existing product SKUs. Please try again." };
    for (const product of data ?? []) existing.set(String(product.sku).trim().toUpperCase(), product.id);
    if (!data || data.length < 1000) break;
  }
  for (const row of rows) {
    const sku = row.product?.sku;
    if (sku && existing.has(sku) && existing.get(sku) !== importId(user.id, csv, row.row)) {
      row.errors.push("Duplicate SKU: one of your existing products already uses this SKU.");
      row.product = null;
    }
  }
  if (formData.get("confirm") !== "yes") return { rows };
  const results: ImportResult[] = [];
  for (const row of rows) {
    if (!row.product) { results.push({ row: row.row, name: "", status: "failed", message: row.errors.join(" ") }); continue; }
    try {
      const { data, error } = await supabase.rpc("import_product_csv_row", {
        p_id: importId(user.id, csv, row.row), p_product: row.product,
        p_sizes: row.product.sizes, p_stock_quantities: row.product.stockQuantities,
      });
      if (error || (data !== "imported" && data !== "already imported")) {
        results.push({ row: row.row, name: row.product.name, status: "failed", message: error?.code === "23505" ? "Duplicate SKU: another product now uses this SKU." : "Could not save this row. You can retry the same CSV safely." });
      } else results.push({ row: row.row, name: row.product.name, status: data });
    } catch {
      results.push({ row: row.row, name: row.product.name, status: "failed", message: "The result could not be confirmed. Retry the same CSV to check or complete this row." });
    }
  }
  revalidatePath("/lister/products");
  revalidatePath("/lister");
  return { rows, results };
}
