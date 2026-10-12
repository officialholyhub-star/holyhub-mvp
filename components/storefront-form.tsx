"use client";

import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { OTHER_APPLICATION_CATEGORY, SUGGESTED_CATEGORY_PREFIX, MAX_SUGGESTED_CATEGORY_LENGTH } from "@/lib/application-categories";
import { advanceOnboarding } from "@/app/lister/onboarding/actions";
import { useActionState, useState, useEffect, useRef } from "react";
import type { StorefrontFormState } from "@/app/lister/actions";
import { BrandLogoUploader } from "@/components/brand-logo-uploader";
import styles from "./storefront-form.module.css";
import setupStyles from "./lister-onboarding.module.css";

type StorefrontFormProps = {
  action: (state: StorefrontFormState, formData: FormData) => Promise<StorefrontFormState>;
  userId: string;
  onboarding?: boolean;
  storefront: {
    business_name: string;
    description: string;
    category_type: string;
    website_url: string | null;
    instagram_url: string | null;
    logo_url: string | null;
    delivery_option: string;
    delivery_charge: number | string;
  } | null;
};

const initialState: StorefrontFormState = { error: "" };

export function StorefrontForm({ action, userId, storefront, onboarding = false }: StorefrontFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [businessName, setBusinessName] = useState(storefront?.business_name ?? "");
  const [description, setDescription] = useState(storefront?.description ?? "");
  const [categoryType, setCategoryType] = useState(storefront?.category_type ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(storefront?.website_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(storefront?.instagram_url ?? "");
  const [deliveryMode, setDeliveryMode] = useState(Number(storefront?.delivery_charge ?? 0) > 0 ? "flat" : "free");
  const [deliveryCharge, setDeliveryCharge] = useState(String(storefront?.delivery_charge ?? 0));

  const formRef = useRef<HTMLFormElement>(null);
  const [suggestion, setSuggestion] = useState(storefront?.category_type.startsWith(SUGGESTED_CATEGORY_PREFIX) ? storefront.category_type.slice(SUGGESTED_CATEGORY_PREFIX.length) : "");
  const [logo, setLogo] = useState(storefront?.logo_url ?? null);
  const [restored, setRestored] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {

    const restore = window.setTimeout(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(`hh-shop-draft-${userId}`) || "null");
      if (draft) {
        setBusinessName(draft.business_name ?? ""); setDescription(draft.description ?? "");
        setCategoryType(draft.category_type ?? ""); setSuggestion(draft.suggested_category ?? "");
        setWebsiteUrl(draft.website_url ?? ""); setInstagramUrl(draft.instagram_url ?? "");
        setDeliveryCharge(draft.delivery_charge ?? "0"); setDeliveryMode(Number(draft.delivery_charge ?? 0) > 0 ? "flat" : "free"); setLogo(draft.logo_url || null);
      }
    } catch { /* Browser storage may be unavailable. */ }
    setRestored(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [onboarding, userId]);
  function keepDraft() {
    if (!formRef.current) return;
    try { sessionStorage.setItem(`hh-shop-draft-${userId}`, JSON.stringify(Object.fromEntries(new FormData(formRef.current)))); } catch { /* Keep the form usable without storage. */ }
  }
  return (
    <form ref={formRef} className="form" action={formAction} onChange={keepDraft} onSubmit={event => { keepDraft(); if (uploading) event.preventDefault(); }}>
      {onboarding && <><input type="hidden" name="onboarding" value="1" /><aside className={setupStyles.preview} aria-label="Live shop preview"><p className="eyebrow">Your shop preview</p><h2>{businessName || "Your shop name"}</h2><p>{description || "A little about your shop"}</p><small>{categoryType === OTHER_APPLICATION_CATEGORY || categoryType.startsWith(SUGGESTED_CATEGORY_PREFIX) ? `Suggested category: ${suggestion || "Your suggestion"}` : categoryType || "Your category"} · Dispatch from: United Kingdom</small></aside></>}
      {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {restored && <BrandLogoUploader userId={userId} initialLogoUrl={logo} onUploadingChange={setUploading} />}
      <div className="field">
        <label htmlFor="business_name">Shop name</label>
        <input id="business_name" name="business_name" value={businessName} onChange={(event) => setBusinessName(event.currentTarget.value)} maxLength={150} required />
      </div>
      <div className="field">
        <label htmlFor="description">Short description</label>
        <textarea id="description" name="description" value={description} onChange={(event) => setDescription(event.currentTarget.value)} maxLength={500} rows={4} required />
      </div>
      <div className="field">
        <label htmlFor="category_type">Category</label>
        <select id="category_type" name="category_type" value={categoryType.startsWith(SUGGESTED_CATEGORY_PREFIX) ? OTHER_APPLICATION_CATEGORY : categoryType} onChange={(event) => setCategoryType(event.currentTarget.value)} required>
          <option value="" disabled>Choose a category</option>
          {PRODUCT_CATEGORIES.map(category => <option key={category}>{category}</option>)}
          <option value={OTHER_APPLICATION_CATEGORY}>Suggest a category</option>
        </select>
        {(categoryType === OTHER_APPLICATION_CATEGORY || categoryType.startsWith(SUGGESTED_CATEGORY_PREFIX)) && <><label htmlFor="suggested_category">Suggested category</label><input id="suggested_category" name="suggested_category" value={suggestion} onChange={event => setSuggestion(event.currentTarget.value)} maxLength={MAX_SUGGESTED_CATEGORY_LENGTH} required /><p className={setupStyles.info}>HolyHub will review your suggestion. It does not create a marketplace category. Choose an existing approved category when listing products.</p></>}
      </div>
      <div className="field">
        <label htmlFor="website_url">Website <span className="muted-small">(optional)</span></label>
        <input id="website_url" name="website_url" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.currentTarget.value)} maxLength={500} placeholder="https://example.com" />
      </div>
      <div className="field">
        <label htmlFor="instagram_url">Instagram or social link <span className="muted-small">(optional)</span></label>
        <input id="instagram_url" name="instagram_url" type="url" value={instagramUrl} onChange={(event) => setInstagramUrl(event.currentTarget.value)} maxLength={500} placeholder="https://instagram.com/yourbrand" />
      </div>
      <h2>Dispatch & delivery</h2><p>Dispatch from: United Kingdom</p><div className="field">
        <label htmlFor="delivery_mode">Delivery charge</label><select id="delivery_mode" value={deliveryMode} onChange={event => { setDeliveryMode(event.currentTarget.value); if (event.currentTarget.value === "free") setDeliveryCharge("0"); }}><option value="free">Free delivery</option><option value="flat">Set my own price</option></select>
        <label htmlFor="delivery_charge">Your price per order (£)</label>
        <input id="delivery_charge" name="delivery_charge" type="number" min={deliveryMode === "flat" ? "0.01" : "0"} readOnly={deliveryMode === "free"} step="0.01" value={deliveryMode === "free" ? "0" : deliveryCharge} onChange={(event) => setDeliveryCharge(event.currentTarget.value)} required />
        <p className={styles.help}>This amount will be charged once per order.</p>
      </div>
      <aside className={setupStyles.info}>Not sure what to charge? Consider packaging, parcel size, weight and your chosen delivery service. You can update this later. Faster or tracked services may cost more.</aside>
      <button className="button button-primary" type="submit" disabled={isPending || uploading}>{uploading ? "Uploading logo…" : isPending ? "Saving shop..." : onboarding ? "Save & continue" : "Save shop"}</button>
      {onboarding && <div className={setupStyles.actions}><button className="button button-quiet" formAction={advanceOnboarding} name="step" value="1" formNoValidate onClick={keepDraft}>Back</button><button className="button button-quiet" formAction={advanceOnboarding} name="later" value="1" formNoValidate onClick={keepDraft}>Finish later</button><input type="hidden" name="resume_step" value="2" /></div>}
      {!onboarding && <Link className="button button-quiet form-back" href="/account">Back to account</Link>}
    </form>
  );
}
