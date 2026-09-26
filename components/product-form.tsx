"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { ProductImageUploader } from "@/components/product-image-uploader";
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

    if (!modalStockInput?.reportValidity() || !stockInput || !publishCheckbox) return;

    stockInput.value = modalStockInput.value;
    publishCheckbox.checked = true;
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
            <input id="category_type" name="category_type" type="text" defaultValue={product?.category_type ?? ""} maxLength={100} required />
          </div>
          <div className="field">
            <label htmlFor="price">Price (GBP)</label>
            <input id="price" name="price" type="number" min="0" step="0.01" defaultValue={product?.price ?? ""} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="stock_quantity">Stock quantity</label>
          <input ref={stockInputRef} id="stock_quantity" name="stock_quantity" type="number" min="0" step="1" defaultValue={product?.stock_quantity ?? 0} required />
          {product && <p className="muted-small form-help">Update this quantity whenever your available stock changes.</p>}
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
                openPublishConfirmation();
              }
            }}
          />
          <span>Publish this product in the marketplace</span>
        </label>
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
          <p id="publish-dialog-description">How many do you have in stock?</p>
          <p className={styles.dialogHelp}>Enter how many units are available to sell right now. HolyHub will automatically reduce this when orders are placed.</p>
          <div className={styles.dialogField}>
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
          </div>
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