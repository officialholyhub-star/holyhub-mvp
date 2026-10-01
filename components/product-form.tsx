"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { ProductImageUploader } from "@/components/product-image-uploader";
import { APPAREL_SIZES } from "@/lib/product-variants";
import { isProductCategory, PRODUCT_CATEGORIES } from "@/lib/product-categories";
import styles from "./product-form.module.css";

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
    size_guide_url?: string | null;
    variants?: { size: (typeof APPAREL_SIZES)[number]; stock_quantity: number | string }[];
  };
  error?: string;
  children?: ReactNode;
};

export function ProductForm({ action, userId, product, error, children }: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);
  const publishCheckboxRef = useRef<HTMLInputElement>(null);
  const publishDialogRef = useRef<HTMLDialogElement>(null);
  const publishStockInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishStock, setPublishStock] = useState(String(product?.stock_quantity ?? 0));
  const [publishError, setPublishError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(product?.category_type ?? "");
  const hasSupportedCategory = isProductCategory(selectedCategory);
  const isApparel = selectedCategory === "Apparel";
  const variantStock = new Map((product?.variants ?? []).map((variant) => [variant.size, String(variant.stock_quantity)]));

  function openPublishConfirmation() {
    setPublishStock(stockInputRef.current?.value ?? "0");
    publishDialogRef.current?.showModal();
  }

  function cancelPublish() {
    if (publishCheckboxRef.current) publishCheckboxRef.current.checked = false;
    publishDialogRef.current?.close();
  }

  function confirmPublish() {
    const modalStockInput = publishStockInputRef.current;
    const stockInput = stockInputRef.current;
    const publishCheckbox = publishCheckboxRef.current;
    const imageInput = formRef.current?.elements.namedItem("image_url") as HTMLInputElement | null;

    if ((!isApparel && !modalStockInput?.reportValidity()) || !stockInput || !publishCheckbox) return;
    if (!imageInput?.value.trim()) {
      setPublishError("Add at least one product image before submitting this product for review.");
      publishCheckbox.checked = false;
      publishDialogRef.current?.close();
      return;
    }

    if (modalStockInput) stockInput.value = modalStockInput.value;
    publishCheckbox.checked = true;
    setPublishError("");
    publishDialogRef.current?.close();
    formRef.current?.requestSubmit();
  }

  return (
    <div className="card">
      {error && <p className="notice notice-error">{error}</p>}
      <form ref={formRef} className="form" action={action}>
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
            <select id="category_type" name="category_type" value={hasSupportedCategory ? selectedCategory : ""} onChange={(event) => setSelectedCategory(event.currentTarget.value)} required>
              <option value="" disabled>Choose a category</option>
              {PRODUCT_CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
            </select>
            {product && !hasSupportedCategory && <p className="muted-small form-help">Current saved category: {product.category_type}. Choose a category from the list to continue.</p>}
          </div>
          <div className="field">
            <label htmlFor="price">Price (GBP)</label>
            <input id="price" name="price" type="number" min="0" step="0.01" defaultValue={product?.price ?? ""} required />
          </div>
        </div>
        {isApparel ? (
          <fieldset className="variant-inventory">
            <legend>Size inventory</legend>
            <p className="muted-small form-help">Set stock for each size before submitting this apparel listing.</p>
            <div className="variant-grid">
              {APPAREL_SIZES.map((size) => (
                <label className="field" key={size}>
                  <span>{size}</span>
                  <input name={`variant_${size}`} type="number" min="0" step="1" defaultValue={variantStock.get(size) ?? "0"} required />
                </label>
              ))}
            </div>
            <input ref={stockInputRef} id="stock_quantity" name="stock_quantity" type="hidden" defaultValue="0" />
          </fieldset>
        ) : (
          <div className="field">
            <label htmlFor="stock_quantity">Stock quantity</label>
            <input ref={stockInputRef} id="stock_quantity" name="stock_quantity" type="number" min="0" step="1" defaultValue={product?.stock_quantity ?? 0} required />
            {product && <p className="muted-small form-help">Update this quantity whenever your available stock changes.</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor="size_guide_url">Size guide image URL <span>(optional for apparel)</span></label>
          <input id="size_guide_url" name="size_guide_url" type="url" defaultValue={product?.size_guide_url ?? ""} placeholder="https://..." />
        </div>
        <ProductImageUploader
          userId={userId}
          initialImageUrl={product?.image_url ?? null}
          onUploadingChange={setIsUploading}
        />
        <label className="checkbox-field">
          <input
            ref={publishCheckboxRef}
            name="is_published"
            type="checkbox"
            defaultChecked={product?.is_published ?? false}
            onChange={(event) => {
              if (event.currentTarget.checked) {
                event.currentTarget.checked = false;
                const imageInput = formRef.current?.elements.namedItem("image_url") as HTMLInputElement | null;
                if (!imageInput?.value.trim()) {
                  setPublishError("Add at least one product image before submitting this product for review.");
                  return;
                }
                setPublishError("");
                openPublishConfirmation();
              }
            }}
          />
          <span>{product ? "Save and submit for review" : "Create & submit for review"}</span>
        </label>
        {publishError && <p className="notice notice-error" role="alert">{publishError}</p>}
        <p className="muted-small form-help">Published listings are sent to HolyHub for a quick review before they appear in the marketplace.</p>
        <button className="button button-primary" type="submit" disabled={isUploading}>{isUploading ? "Uploading image..." : product ? "Save product" : "Create product"}</button>
      </form>
      <dialog
        ref={publishDialogRef}
        className={styles.publishDialog}
        aria-labelledby="publish-dialog-title"
        aria-describedby="publish-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          cancelPublish();
        }}
      >
        <div className={styles.dialogContent}>
          <p className="eyebrow">Marketplace listing</p>
          <h2 id="publish-dialog-title">Ready to publish?</h2>
          <p id="publish-dialog-description">{isApparel ? "Check the size inventory before submitting." : "How many do you have in stock?"}</p>
          <p className={styles.dialogHelp}>Enter how many units are available to sell right now. HolyHub will automatically reduce this when orders are placed.</p>
          {!isApparel && <div className={styles.dialogField}>
            <label htmlFor="publish-stock-quantity">Stock quantity</label>
            <input
              ref={publishStockInputRef}
              id="publish-stock-quantity"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={publishStock}
              onChange={(event) => setPublishStock(event.currentTarget.value)}
              required
            />
          </div>}
          <div className={styles.dialogActions}>
            <button className="button button-quiet" type="button" onClick={cancelPublish}>Cancel</button>
            <button className="button button-primary" type="button" onClick={confirmPublish} disabled={isUploading}>Confirm &amp; publish</button>
          </div>
        </div>
      </dialog>
      {children}
    </div>
  );
}