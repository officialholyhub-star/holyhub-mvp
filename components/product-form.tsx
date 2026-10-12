"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ProductImageUploader } from "@/components/product-image-uploader";
import { APPAREL_SIZES } from "@/lib/product-variants";
import { isProductCategory, PRODUCT_CATEGORIES } from "@/lib/product-categories";
import styles from "./product-form.module.css";
import setupStyles from "./lister-onboarding.module.css";
import { useFormStatus } from "react-dom";
import { FormRecovery } from "@/components/draft-form";
import { editableDraft, readDraft, writeDraft } from "@/lib/form-drafts";

type ProductFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  userId: string;
  guided?: boolean;
  deliveryCharge?: number | string;
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
    product_images?: { image_url: string; sort_order: number }[];
    variants?: { size: (typeof APPAREL_SIZES)[number]; stock_quantity: number | string }[];
  };
  error?: string;
  children?: ReactNode;
};

export function ProductForm({ action, userId, product, error, children, guided = false, deliveryCharge = 0 }: ProductFormProps) {
  const [step, setStep] = useState(0);
  const [review, setReview] = useState({ name: "", description: "", price: "", category: "", images: [] as string[] });
  const labels = ["Photos", "Details", "Price & stock", "Delivery", "Review"];
  const guidedMode = guided && !product;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (guidedMode && step > 0) headingRef.current?.focus(); }, [guidedMode, step]);
  function nextStep() {
    const categoryInput = formRef.current?.elements.namedItem("category_type") as HTMLSelectElement | null;
    if (step === 1 && !categoryInput?.reportValidity()) return;
    const controls = formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("fieldset[data-step]:not([hidden]) input, fieldset[data-step]:not([hidden]) select, fieldset[data-step]:not([hidden]) textarea");
    if (controls && [...controls].some(control => !control.reportValidity())) return;
    if (step === 3 && formRef.current) {
      const data = new FormData(formRef.current);
      setReview({ name: String(data.get("name") ?? ""), description: String(data.get("description") ?? ""), price: String(data.get("price") ?? ""), category: String(data.get("category_type") ?? ""), images: data.getAll("image_urls").map(String) });
    }
    setStep(Math.min(step + 1, 4));
  }
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(product?.category_type ?? "");
  const saving = useRef(false);
  const draftKey = `hh-product-draft-${userId}-${product?.id ?? "new"}`;
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  function restoreDraft() {
    if (!formRef.current) return;
    try {
      const saved = readDraft(draftKey);
      const draft = saved ? Object.fromEntries(Object.entries(saved).map(([key, values]) => [key, key === "images" ? values : values[0]])) : null;
      if (draft) {
        setDraftValues(Object.fromEntries(Object.entries(draft).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
        setSelectedCategory(String(draft.category_type || ""));
        setDraftImages(Array.isArray(draft.images) ? draft.images : []);
        for (const control of formRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[name], textarea[name]")) {
          if (control.type !== "hidden" && draft[control.name] !== undefined) control.value = String(draft[control.name]);
        }
      }
    } catch { /* Storage may be disabled. */ }
    saving.current = false;
    setDraftLoaded(true);
  }
  // Also capture hidden upload fields, which can change without a DOM input event.
  useEffect(() => {
    if (!draftLoaded) return;
    const save = () => {
      if (!formRef.current || saving.current) return;
      const data = new FormData(formRef.current);
      writeDraft(draftKey, { ...editableDraft(data), images: data.getAll("image_urls").map(String) });
    };
    const timer = setInterval(save, 750);
    window.addEventListener("pagehide", save);
    return () => { save(); clearInterval(timer); window.removeEventListener("pagehide", save); };
  }, [draftLoaded, draftKey]);
  const hasSupportedCategory = isProductCategory(selectedCategory);
  const isApparel = selectedCategory === "Apparel";
  const variantStock = new Map((product?.variants ?? []).map((variant) => [variant.size, String(variant.stock_quantity)]));

  return (
    <div className="card">
      {error && <p className="notice notice-error">{error}</p>}
      {guidedMode && <><p className="eyebrow">Step 5 of 5 · Your first product</p><h1>Let’s create your first listing</h1><p><Link href="/lister/products/bulk">Adding lots of products? Bulk upload with CSV →</Link></p><ol className={setupStyles.steps} aria-label="Product steps">{labels.map((label,index)=><li key={label}><button type="button" aria-current={step===index?"step":undefined} disabled={index>step} onClick={()=>setStep(index)}>{index+1}. {label}</button></li>)}</ol><h2 tabIndex={-1} ref={headingRef}>{labels[step]}</h2></>}
      <form ref={formRef} className="form" action={action} onInvalidCapture={event => { const section = (event.target as HTMLElement).closest<HTMLElement>("[data-step]"); if (section) setStep(Number(section.dataset.step)); }} onSubmit={event => { if (guidedMode && step < 4) { event.preventDefault(); nextStep(); } else if (formRef.current) { saving.current = true; const data = new FormData(formRef.current); writeDraft(draftKey, { ...editableDraft(data), images: data.getAll("image_urls").map(String) }); } }}>
        <FormRecovery onSettled={restoreDraft} />
        {guidedMode && <input type="hidden" name="onboarding" value="1" />}
        {product && <input type="hidden" name="product_id" value={product.id} />}
        <div className="field">
          <label htmlFor="category_type">Category</label>
          <select id="category_type" name="category_type" aria-describedby="product-category-help" value={selectedCategory} onChange={(event) => setSelectedCategory(event.currentTarget.value)} required>
            <option value="" disabled>Choose a category</option>
            {product && !isProductCategory(product.category_type) && <option value={product.category_type}>{product.category_type} (current category)</option>}
            {PRODUCT_CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
          </select>
          <p id="product-category-help" className="muted-small form-help">Choose the category that best fits this product.</p>
          {product && !hasSupportedCategory && <p className="muted-small form-help">Your saved category is “{product.category_type}”. You can keep it or choose one of the updated categories.</p>}
        </div>
        <fieldset className={styles.section} hidden={guidedMode && step !== 0} data-step="0"><legend>Product photos</legend>
        {draftLoaded && <ProductImageUploader
          userId={userId}
          initialImageUrl={Object.hasOwn(draftValues, "gallery_present") ? null : product?.image_url ?? null}
          initialImages={draftImages.length || Object.hasOwn(draftValues, "gallery_present") ? draftImages.map((image_url, sort_order) => ({ image_url, sort_order })) : product?.product_images}
          onUploadingChange={setIsUploading}
        />}
        </fieldset>
        <fieldset className={styles.section} hidden={guidedMode && step !== 1} data-step="1"><legend>Product details</legend>
        <div className="field">
          <label htmlFor="name">Product name</label>
          <input id="name" name="name" type="text" defaultValue={product?.name ?? ""} maxLength={150} required />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={product?.description ?? ""} maxLength={1000} rows={5} required />
        </div>
        </fieldset>
        <fieldset className={styles.section} hidden={guidedMode && step !== 2} data-step="2"><legend>Price & stock</legend>
          <div className="field">
          <label htmlFor="price">Price (£)</label>
            <input id="price" name="price" type="number" min="0" step="0.01" defaultValue={product?.price ?? ""} required />
          </div>

        {isApparel ? (
          <fieldset className="variant-inventory">
            <legend>Stock by size</legend>
            <p className="muted-small form-help">Set stock for each size before submitting this apparel listing.</p>
            <div className="variant-grid">
              {APPAREL_SIZES.map((size) => (
                <label className="field" key={size}>
                  <span>{size}</span>
                  <input name={`variant_${size}`} type="number" min="0" step="1" defaultValue={draftValues[`variant_${size}`] ?? variantStock.get(size) ?? "0"} required />
                </label>
              ))}
            </div>
            <input id="stock_quantity" name="stock_quantity" type="hidden" defaultValue="0" />
          </fieldset>
        ) : (
          <div className="field">
            <label htmlFor="stock_quantity">Stock quantity</label>
            <input id="stock_quantity" name="stock_quantity" type="number" min="0" step="1" defaultValue={product?.stock_quantity ?? 0} required />
            {product && <p className="muted-small form-help">Update this quantity whenever your available stock changes.</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor="size_guide_url">Link to size guide image <span>(optional for apparel)</span></label>
          <input id="size_guide_url" name="size_guide_url" type="url" defaultValue={product?.size_guide_url ?? ""} placeholder="https://..." />
        </div>
        </fieldset>
        {guidedMode && <fieldset className={styles.section} hidden={step !== 3}><legend>Delivery</legend><p className={setupStyles.info}>You’ll package and send orders directly to your customers.</p><p>Dispatch from: United Kingdom · Delivery charge: {Number(deliveryCharge) === 0 ? "Free delivery" : `£${Number(deliveryCharge).toFixed(2)} delivery per order`}</p><a href="/lister/storefront" target="_blank" rel="noreferrer">Change dispatch & delivery charge settings (opens a new tab)</a></fieldset>}
        <fieldset className={styles.section} hidden={guidedMode && step !== 4}><legend>Review & submit</legend>
        {guidedMode && <><article className={setupStyles.preview}><div className={setupStyles.reviewImages}>{review.images.map((url, index) => <Image key={url} src={url} alt={`${review.name || "Product"} — photo ${index + 1}`} width={240} height={240} unoptimized />)}</div><h3>{review.name}</h3><p>{review.description}</p><strong>£{Number(review.price).toFixed(2)} · {review.category}</strong></article><p>Check your photos, details and stock using the steps above. HolyHub will review your product before it appears in the marketplace.</p></>}
        <p className={setupStyles.info}>Publish submits your listing for HolyHub review before it can appear in the marketplace. Archive hides an existing listing without deleting it; it remains available here as a draft.</p>
        <ProductSaveButton uploading={isUploading} editing={!!product} />
        </fieldset>
        {guidedMode && <div className={setupStyles.actions}>{step > 0 && <button type="button" className="button button-quiet" onClick={()=>setStep(step-1)}>Back</button>}{step < 4 && <button type="button" className="button button-primary" disabled={isUploading} onClick={nextStep}>Continue →</button>}</div>}
      </form>
      {guidedMode && <p className="muted-small">Unsubmitted details are kept in this browser tab when you finish later. Save a draft at Review to keep them in your shop.</p>}
      {children}
    </div>
  );
}

function ProductSaveButton({ uploading, editing }: { uploading: boolean; editing: boolean }) {
  const { pending } = useFormStatus();
  return <div className="row-actions">
    <button className="button button-quiet" type="submit" name="publication_action" value="draft" disabled={uploading || pending}>Save as draft</button>
    <button className="button button-primary" type="submit" name="publication_action" value="publish" disabled={uploading || pending}>{pending ? "Saving product…" : uploading ? "Uploading image…" : "Publish"}</button>
    {editing && <button className="button button-secondary" type="submit" name="publication_action" value="archive" formNoValidate disabled={uploading || pending}>Archive</button>}
  </div>;
}
