import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { BulkProductUpload } from "@/components/bulk-product-upload";

export default async function BulkProductsPage() {
  await requireRole("lister");
  return <section className="auth-wrap"><div className="card">
    <p className="eyebrow">Lister space</p><h1>Bulk upload spreadsheet</h1>
    <p>Upload several products at once using our template. Add up to 100 products, then review your rows before confirming. Products are saved as private drafts.</p>
    <a className="button button-quiet" href="/lister/products/bulk/template">Download spreadsheet template</a>
    <p>Open the template in Excel, Google Sheets or another spreadsheet app. Fill it in, then save or download it as a CSV file to upload here.</p>
    <p>Keep the template headings in order. Enter prices in pounds, such as 12.50, without £. Stock must be a whole number of 0 or more. SKU is optional and must be unique within your shop; capitalisation is ignored.</p>
    <p>Categories: {PRODUCT_CATEGORIES.join(", ")}.</p>
    <p>For Apparel, fill in XS Stock, S Stock, M Stock, L Stock, XL Stock and XXL Stock. Use 0 for unavailable sizes and leave Stock quantity blank. For other categories, fill in Stock quantity and leave size columns blank.</p>
    <p>Paste product image links into Image 1–5. HolyHub will import and save them. Fill image columns in order; Image 1 becomes the cover. Use public, direct http:// or https:// links to JPEG, PNG, WebP or AVIF images, up to 5 MB each. Image links are optional; older templates with Image URL still work as Image 1.</p>
    <p>Image links are checked when you confirm. If an image fails, that row will not be saved; other valid rows can still import. Review each draft before submitting it. Submission requires an image, and Apparel also needs available size stock.</p>
    <BulkProductUpload />
    <Link className="text-link" href="/lister/products">Back to products</Link>
  </div></section>;
}
