import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CsvRow } from "./product-csv";
import { downloadProductImage, RemoteImageError } from "./remote-product-image";
import { ownedProductImagePath } from "./product-images";

const BUCKET = "product-images";
type Result = { status: "imported" | "already imported" | "failed"; message?: string };

export async function importBulkProductRow(supabase: SupabaseClient, userId: string, id: string, row: CsvRow): Promise<Result> {
  if (!row.product) return { status: "failed", message: row.errors.join(" ") };
  const { data: existing, error: lookupError } = await supabase.from("products")
    .select("id").eq("id", id).eq("lister_user_id", userId).maybeSingle();
  if (lookupError) return { status: "failed", message: "Could not check this row's previous import. Retry the same spreadsheet safely." };
  // Also protects later edits and avoids downloads/uploads on completed retries.
  if (existing) return { status: "already imported" };

  const storage = supabase.storage.from(BUCKET);
  const newPaths: string[] = []; const images: string[] = [];
  async function cleanup() {
    // These paths were generated only by this attempt, never read from a saved
    // product. Use non-overwriting uploads; another attempt gets different IDs.
    if (!newPaths.length) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { if (!(await storage.remove(newPaths)).error) return; } catch { /* Retry bounded cleanup. */ }
    }
    console.warn("Bulk image cleanup could not be confirmed.");
  }

  let imageNumber = 1;
  try {
    for (const url of row.imageUrls) {
      const image = await downloadProductImage(url);
      const path = `${userId}/${randomUUID()}.${image.extension}`;
      const publicUrl = storage.getPublicUrl(path).data.publicUrl;
      if (publicUrl.length > 500 || ownedProductImagePath(publicUrl, userId) !== path) throw new Error("Invalid storage path");
      newPaths.push(path);
      const { error } = await storage.upload(path, image.bytes, {
        contentType: image.contentType, cacheControl: "31536000", upsert: false,
      });
      if (error) throw new Error("Upload failed");
      images.push(publicUrl);
      imageNumber++;
    }
  } catch (error) {
    await cleanup();
    return { status: "failed", message: error instanceof RemoteImageError ? `Image ${imageNumber} ${error.message}`
      : `Image ${imageNumber} could not be saved. Please try this row again.` };
  }

  const args = { p_id: id, p_product: row.product, p_sizes: row.product.sizes,
    p_stock_quantities: row.product.stockQuantities, p_images: images };
  let uncertain = false;
  // If the response is lost, repeat the SAME atomic call to resolve it. The
  // product's stable ID serializes concurrent imports in migration 020.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.rpc("import_product_csv_row", args);
      if (!error && (data === "imported" || data === "already imported")) {
        if (data === "already imported" && !uncertain) await cleanup();
        // After a lost response, files may already have been saved, or moved to
        // a review snapshot by a later edit. Never delete those files.
        return { status: data };
      }
      const rolledBack = error?.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith("08");
      if (rolledBack && !uncertain) {
        await cleanup();
        return { status: "failed", message: error.code === "23505"
          ? "Duplicate SKU: another product now uses this SKU."
          : "Could not save this row. You can retry the same spreadsheet safely." };
      }
    } catch { /* A transport error cannot prove whether the transaction committed. */ }
    uncertain = true;
  }
  // Retain files when the database outcome is unknown: deleting them here could
  // break a committed gallery. The next exact retry checks the completed ID.
  return { status: "failed", message: "The result could not be confirmed. Retry the same spreadsheet to check or complete this row." };
}
