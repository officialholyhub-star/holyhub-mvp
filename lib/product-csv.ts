import { isProductCategory } from "./product-categories";
import { APPAREL_SIZES, hasValidApparelStock } from "./product-variants";
import { parsePrice, parseStockQuantity, isValidHttpUrl } from "./product-validation";

export const CSV_COLUMNS = ["Product name", "Description", "Price", "Stock quantity", "SKU", "Category", "Image URL", ...APPAREL_SIZES.map(size => `${size} Stock`)] as const;
export const MAX_CSV_BYTES = 256 * 1024;
export const MAX_CSV_ROWS = 100;
export type CsvProduct = { name: string; description: string; price: number; stock_quantity: number; sku: string | null; category_type: string; sizes: string[]; stockQuantities: number[] };
export type CsvRow = { row: number; product: CsvProduct | null; errors: string[]; warnings: string[] };

// Quoted commas, escaped quotes, newlines and spreadsheet UTF-8 BOMs.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ""; closed = false;
      if (char !== ',') { rows.push(row); row = []; if (char === '\r' && text[i + 1] === '\n') i++; }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error("CSV has misplaced quotation marks. Save it as a CSV file and try again."); cell += char; }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field. Save it as a CSV file and try again.");
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
export function validateProductCsv(text: string): CsvRow[] {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) throw new Error("Choose a CSV smaller than 256 KB.");
  const [headers, ...records] = parseCsv(text);
  if (!headers || headers.length !== CSV_COLUMNS.length || headers.some((header, i) => header.trim() !== CSV_COLUMNS[i])) throw new Error("Use the columns in the downloaded template, in their original order.");
  const nonempty = records.map((cells, i) => ({ cells, row: i + 2 })).filter(({ cells }) => cells.some(cell => cell.trim()));
  if (!nonempty.length || nonempty.length > MAX_CSV_ROWS) throw new Error("Upload between 1 and 100 product rows.");
  const counts = new Map<string, number>();
  for (const { cells } of nonempty) { const sku = cells[4]?.trim().toUpperCase(); if (sku) counts.set(sku, (counts.get(sku) ?? 0) + 1); }
  return nonempty.map(({ cells, row }) => {
    const [name = "", description = "", priceText = "", stockText = "", skuText = "", category = "", image = "", ...sizeStocks] = cells.map(cell => cell.trim());
    const errors: string[] = []; const warnings: string[] = [];
    const price = parsePrice(priceText); const stock = parseStockQuantity(stockText); const sku = skuText.toUpperCase();
    if (cells.length !== CSV_COLUMNS.length) errors.push("Wrong number of columns.");
    if (!name || name.length > 150) errors.push("Product name is required (maximum 150 characters).");
    if (!description || description.length > 1000) errors.push("Description is required (maximum 1000 characters).");
    if (price === null) errors.push("Price is invalid. Use pounds with up to two decimal places, without £.");
    if (!isProductCategory(category)) errors.push(`Invalid category "${category}".`);
    if (sku.length > 100 || /[\x00-\x1F\x7F]/.test(sku)) errors.push("SKU must be at most 100 characters with no control characters.");
    if (sku && (counts.get(sku) ?? 0) > 1) errors.push("Duplicate SKU in this CSV.");
    if (image.length > 500 || !isValidHttpUrl(image)) errors.push("Image URL must be a valid HTTP(S) URL, at most 500 characters.");
    if (image) warnings.push("Image URL will not be saved or downloaded. Upload a product image manually after import.");
    const apparel = category === "Apparel";
    const quantities = sizeStocks.map(value => parseStockQuantity(value));
    if (apparel && (!hasValidApparelStock(quantities as number[]) || quantities.some(value => value === null) || quantities.reduce<number>((sum, value) => sum + (value ?? 0), 0) > 2147483647)) errors.push("Apparel requires valid whole-number stock for all six sizes (use 0 for unavailable sizes).");
    if (apparel && stockText && stock === null) errors.push("Stock quantity is invalid; for Apparel leave it blank or use a whole number of 0 or more.");
    if (!apparel && stock === null) errors.push("Stock quantity must be a whole number of 0 or more.");
    if (!apparel && sizeStocks.some(Boolean)) errors.push("Size stock is only available for Apparel; leave size columns blank.");
    return { row, errors, warnings, product: errors.length ? null : { name, description, price: price!, category_type: category, sku: sku || null, stock_quantity: apparel ? 0 : stock!, sizes: apparel ? [...APPAREL_SIZES] : [], stockQuantities: apparel ? quantities as number[] : [] } };
  });
}
