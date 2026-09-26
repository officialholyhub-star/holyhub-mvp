"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ProductImageUploader } from "@/components/product-image-uploader";

type ProductFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  userId: string;
  product?: {
    id: string;
    name: string;
    description: string;
    category_type: string;
    price: number | string;
    image_url: string | null;
    stock_quantity: number | string;
    is_published: boolean;
  };
  error?: string;
  children?: ReactNode;
};

export function ProductForm({ action, userId, product, error, children }: ProductFormProps) {
  const [isUploading, setIsUploading] = useState(false);

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
          <label htmlFor="stock_quantity">Stock quantity</label>
          <input id="stock_quantity" name="stock_quantity" type="number" min="0" step="1" defaultValue={product?.stock_quantity ?? 0} required />
        </div>
        <ProductImageUploader
          userId={userId}
          initialImageUrl={product?.image_url ?? null}
          onUploadingChange={setIsUploading}
        />
        <label className="checkbox-field">
          <input name="is_published" type="checkbox" defaultChecked={product?.is_published ?? false} />
          <span>Publish this product in the marketplace</span>
        </label>
        <p className="muted-small form-help">Published listings are sent to HolyHub for a quick review before they appear in the marketplace.</p>
        <button className="button button-primary" type="submit" disabled={isUploading}>{isUploading ? "Uploading image..." : product ? "Save product" : "Create product"}</button>
      </form>
      {children}
    </div>
  );
}