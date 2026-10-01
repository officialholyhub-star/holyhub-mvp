import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { BulkProductUpload } from "@/components/bulk-product-upload";

export default async function BulkProductsPage() {
  await requireRole("lister");
  return <section className="auth-wrap"><div className="card">
    <p className="eyebrow">Lister space</p><h1>Bulk Upload Products</h1>
    <p>Add up to 100 products at a time. Review your rows before confirming. Products are saved as private drafts.</p>
    <a className="button button-quiet" href="/lister/products/bulk/template">Download CSV template</a>
    <p>Keep the template headings in order. Enter prices in pounds, such as 12.50, without £. Stock must be a whole number of 0 or more. SKU is optional and must be unique within your shop; capitalisation is ignored.</p>
    <p>Categories: {PRODUCT_CATEGORIES.join(", ")}.</p>
    <p>For Apparel, fill in XS Stock, S Stock, M Stock, L Stock, XL Stock and XXL Stock. Use 0 for unavailable sizes and leave Stock quantity blank. For other categories, fill in Stock quantity and leave size columns blank.</p>
    <p>Image URL is optional and must start with http:// or https://. Images from these URLs are not saved or downloaded. Upload an image on each product’s edit page before submitting it for review. Apparel also needs available size stock before submission.</p>
    <BulkProductUpload />
    <Link className="text-link" href="/lister/products">Back to products</Link>
  </div></section>;
}
