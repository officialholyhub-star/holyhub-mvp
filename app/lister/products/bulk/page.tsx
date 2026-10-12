import Link from "next/link";
import styles from "@/components/lister-onboarding.module.css";
import { requireRole } from "@/lib/auth/require-user";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { BulkProductUpload } from "@/components/bulk-product-upload";

export default async function BulkProductsPage() {
  await requireRole("lister");
  return <section className={styles.productShell}><div className="card">
    <p className="eyebrow">Lister space</p><h1>Bulk upload products</h1>
    <p>Add up to 100 products at once. Check them before importing; every product starts as a private draft.</p>
    <ol className={styles.grid}>
      <li className={styles.tile}><h2>1. Download template</h2><p>Open it in Excel or Google Sheets.</p><a className="button button-primary" href="/lister/products/bulk/template">Download CSV template</a></li>
      <li className={styles.tile}><h2>2. Add your products</h2><p>One product per row. Keep the headings and save as CSV.</p></li>
      <li className={styles.tile}><h2>3. Upload spreadsheet</h2><p>Choose your completed CSV below.</p></li>
      <li className={styles.tile}><h2>4. Check products</h2><p>Check the preview and fix errors, then confirm the valid rows.</p></li>
      <li className={styles.tile}><h2>5. Review drafts</h2><p>Check photos and details in Products, then submit each listing for HolyHub review.</p></li>
    </ol>
    <aside className={styles.info}><strong>Which columns do I need?</strong><p>Required: Product name, Description, Price, Category and Stock quantity. For Apparel, use all six size stock columns instead of Stock quantity.</p><p>Optional: SKU and Image 1–5 URL. <strong>SKU is strongly recommended</strong>: use a unique product code and keep it when retrying to prevent duplicates.</p></aside>
    <details><summary>Spreadsheet examples & image guidance</summary>
      <p>Example: Product name: Floral bookmark · Description: Handmade floral bookmark · Price: 12.50 · Stock quantity: 5 · SKU: BOOKMARK-001 · Category: Bookmarks. Replace these example values with your own products.</p>
      <p>Categories: {PRODUCT_CATEGORIES.join(", ")}.</p>
      <p>Prices are in pounds without £. Stock is a whole number of 0 or more. SKU capitalisation is ignored.</p>
      <p>For Apparel, fill XS, S, M, L, XL and XXL Stock; enter 0 for unavailable sizes and leave Stock quantity blank. For other categories, leave size stock blank.</p>
      <p>Optional images: paste public, direct HTTP or HTTPS links to JPEG, PNG, WebP or AVIF files up to 5 MB each. Fill Image 1–5 in order; Image 1 is the cover. Older Image URL templates still work.</p>
      <p>Image links are checked when you confirm. Rows with failed images are not saved. Add or check photos in each draft before submitting.</p>
    </details>
    <details><summary>Errors & retrying an import</summary><p>Only valid rows are imported. Fix invalid rows and upload again, keeping your SKUs. Retry the exact same file for products without SKUs; a changed file is treated as a new import. Completed rows in the same file will not be created again.</p></details>
    <BulkProductUpload />
    <Link className="text-link" href="/lister/products">Back to products</Link>
  </div></section>;
}
