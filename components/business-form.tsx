"use client";

import { useActionState } from "react";
import { categories, type Business, type BusinessFormState } from "@/lib/businesses";
import { saveBusiness } from "@/app/account/business/actions";
import { SubmitButton } from "@/components/submit-button";

export function BusinessForm({ business }: { business: Business | null }) {
  const initial: BusinessFormState = { values: business ?? {} };
  const [state, action] = useActionState(saveBusiness, initial);
  const values = state.values ?? initial.values;
  return (
    <form action={action} className="form">
      {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {business && <input type="hidden" name="id" value={business.id} />}
      <div className="field"><label htmlFor="name">Business or brand name</label><input id="name" name="name" defaultValue={values?.name} minLength={2} maxLength={100} autoComplete="organization" required /></div>
      <div className="form-columns">
        <div className="field"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={values?.category ?? ""} required><option value="" disabled>Choose a category</option>{categories.map(category => <option key={category}>{category}</option>)}</select></div>
        <div className="field"><label htmlFor="location">Location</label><input id="location" name="location" placeholder="e.g. London or Online" defaultValue={values?.location} minLength={2} maxLength={100} required /></div>
      </div>
      <div className="field"><label htmlFor="summary">Short introduction</label><textarea id="summary" name="summary" rows={2} defaultValue={values?.summary} minLength={10} maxLength={180} aria-describedby="summary-help" required /><span id="summary-help" className="muted-small">A sentence about what you offer. Up to 180 characters.</span></div>
      <div className="field"><label htmlFor="description">Your story & what you offer</label><textarea id="description" name="description" rows={6} defaultValue={values?.description} minLength={30} maxLength={3000} required /></div>
      <div className="field"><label htmlFor="website_url">Website or social profile</label><input id="website_url" name="website_url" type="url" placeholder="https://" defaultValue={values?.website_url} maxLength={500} required /><span className="muted-small">This link and your listing details will be public after approval. Please don’t include private contact details.</span></div>
      <label className="check-field"><input type="checkbox" name="faith_confirmed" value="yes" required /> <span>I confirm this is a Christian-owned or faith-led business and I am authorised to represent it.</span></label>
      <p className="muted-small">HolyHub reviews every submission. Editing an approved listing sends it back for review and temporarily removes it from discovery.</p>
      <SubmitButton pendingText="Submitting…">{business ? "Save & submit for review" : "Submit for review"} <span aria-hidden="true">→</span></SubmitButton>
    </form>
  );
}
