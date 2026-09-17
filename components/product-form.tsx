import type { ReactNode } from "react";

type ProductFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  product?: {
    id: string;
    name: string;
    description: string;
    category_type: string;
    price: number | string;
    image_url: string | null;
    is_published: boolean;
  };
  error?: string;
  children?: ReactNode;
};

export function ProductForm({ action, product, error, children }: ProductFormProps) {
  return (
    <div className="card">
      {error && <p className="notice notice-error">{error}</p>}
      <form className="form" action={action}>
        {product && <input type="hidden" name="product_id" value={product.id} />}
        <div className="field">
          <label htmlFor="name">Product name</label>
          <input id="name" name="name" type="text" defaultValue={product?.name ?? ""} maxLength={150} required />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={product?.description ?? ""} maxLength={1000} rows={5} required />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="category_type">Category</label>
            <input id="category_type" name="category_type" type="text" defaultValue={product?.category_type ?? ""} maxLength={100} required />
          </div>
          <div className="field">
            <label htmlFor="price">Price (GBP)</label>
            <input id="price" name="price" type="number" min="0" step="0.01" defaultValue={product?.price ?? ""} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="image_url">Product image URL <span className="muted-small">(optional)</span></label>
          <input id="image_url" name="image_url" type="url" defaultValue={product?.image_url ?? ""} maxLength={500} placeholder="https://" />
        </div>
        <label className="checkbox-field">
          <input name="is_published" type="checkbox" defaultChecked={product?.is_published ?? false} />
          <span>Publish this product in the marketplace</span>
        </label>
        <button className="button button-primary" type="submit">{product ? "Save product" : "Create product"}</button>
      </form>
      {children}
    </div>
  );
}