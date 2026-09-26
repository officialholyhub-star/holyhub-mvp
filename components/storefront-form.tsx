"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { StorefrontFormState } from "@/app/lister/actions";
import { BrandLogoUploader } from "@/components/brand-logo-uploader";
import styles from "./storefront-form.module.css";

type StorefrontFormProps = {
  action: (state: StorefrontFormState, formData: FormData) => Promise<StorefrontFormState>;
  userId: string;
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

export function StorefrontForm({ action, userId, storefront }: StorefrontFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [businessName, setBusinessName] = useState(storefront?.business_name ?? "");
  const [description, setDescription] = useState(storefront?.description ?? "");
  const [categoryType, setCategoryType] = useState(storefront?.category_type ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(storefront?.website_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(storefront?.instagram_url ?? "");
  const [deliveryCharge, setDeliveryCharge] = useState(String(storefront?.delivery_charge ?? 0));

  return (
    <form className="form" action={formAction}>
      {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      <BrandLogoUploader userId={userId} initialLogoUrl={storefront?.logo_url ?? null} />
      <div className="field">
        <label htmlFor="business_name">Business / brand name</label>
        <input id="business_name" name="business_name" value={businessName} onChange={(event) => setBusinessName(event.currentTarget.value)} maxLength={150} required />
      </div>
      <div className="field">
        <label htmlFor="description">About the brand</label>
        <textarea id="description" name="description" value={description} onChange={(event) => setDescription(event.currentTarget.value)} maxLength={500} rows={4} required />
      </div>
      <div className="field">
        <label htmlFor="category_type">Category</label>
        <input id="category_type" name="category_type" value={categoryType} onChange={(event) => setCategoryType(event.currentTarget.value)} maxLength={100} required />
      </div>
      <div className="field">
        <label htmlFor="website_url">Website <span className="muted-small">(optional)</span></label>
        <input id="website_url" name="website_url" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.currentTarget.value)} maxLength={500} placeholder="https://example.com" />
      </div>
      <div className="field">
        <label htmlFor="instagram_url">Instagram or social link <span className="muted-small">(optional)</span></label>
        <input id="instagram_url" name="instagram_url" type="url" value={instagramUrl} onChange={(event) => setInstagramUrl(event.currentTarget.value)} maxLength={500} placeholder="https://instagram.com/yourbrand" />
      </div>
      <div className="field">
        <label htmlFor="delivery_charge">Delivery price (GBP)</label>
        <input id="delivery_charge" name="delivery_charge" type="number" min="0" step="0.01" value={deliveryCharge} onChange={(event) => setDeliveryCharge(event.currentTarget.value)} required />
        <p className={styles.help}>Enter £0 for free delivery. This amount will be charged once per order.</p>
      </div>
      <button className="button button-primary" type="submit" disabled={isPending}>{isPending ? "Saving storefront..." : "Save storefront"}</button>
      <Link className="button button-quiet form-back" href="/account">Back to account</Link>
    </form>
  );
}