import { loadListerActivation } from "@/lib/lister-activation";
import { ListerActivationSummary } from "@/components/lister-activation";
import { ClearDraft } from "@/components/draft-form";
import { ListerWelcome } from "@/components/lister-welcome";
import Link from "next/link";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/require-user";
import { onboardingCookie, onboardingStep } from "@/lib/lister-onboarding";
import { advanceOnboarding } from "./actions";
import { saveStorefront } from "@/app/lister/storefront/actions";
import { StorefrontForm } from "@/components/storefront-form";
import styles from "@/components/lister-onboarding.module.css";
export default async function OnboardingPage() {
  const { user, supabase } = await requireRole("lister");
  const { data: shop, error } = await supabase.from("lister_storefronts").select("business_name, description, category_type, website_url, instagram_url, logo_url, delivery_option, delivery_charge, dispatch_window, dispatch_custom_timeframe").eq("user_id", user.id).maybeSingle();
  if (error) return <section className={styles.shell}><h1>Your shop</h1><p role="alert">We couldn’t load your shop. Please refresh to try again.</p><Link href="/lister">Go to dashboard</Link></section>;
  const savedStep = onboardingStep((await cookies()).get(onboardingCookie(user.id))?.value);
  const activation = await loadListerActivation(supabase, user.id);
  const step = !shop && savedStep > 2 ? 2 : shop && savedStep === 1 ? 3 : savedStep;
  return <section className={styles.shell}>
    {step === 1 && !shop && !(await cookies()).get(onboardingCookie(user.id)) && <ListerWelcome />}
    <p className="eyebrow">Your shop starts here · Step {step} of 5</p>
    <progress className={styles.progress} value={step - 1} max={5} aria-label={`${step - 1} of 5 steps complete`} />
    <p>Setup progress is separate from activation. You can prepare products while requirements are pending.</p>
    <ListerActivationSummary activation={activation} onboarding />
    <div className={styles.panel} key={step}>
    {step === 1 && <><h1>Welcome to HolyHub 💙</h1><p className="lead">Let’s get your shop ready.</p><p>You can be ready to start listing in just a few minutes.</p></>}
    {step === 2 && <><h1>Your shop</h1><p>A few details to help customers get to know you.</p><StorefrontForm action={saveStorefront} userId={user.id} storefront={shop} onboarding /></>}
    {step === 3 && <><ClearDraft draftKey={`hh-shop-draft-${user.id}`} /><p role="status">Shop saved</p><h1>Seller details</h1><p>Submit your seller details for HolyHub verification. You can continue preparing while review is pending.</p><Link className="button button-primary" href="/lister/legal-details?onboarding=1">Review seller details →</Link></>}
    {step === 4 && <><h1>Lister Terms status</h1><p>{activation.terms.state === "waiting" ? "Final Lister Terms are under legal review. This step is waiting on HolyHub; you can continue preparing your shop and products." : activation.terms.state === "complete" ? "You have accepted the current version." : activation.terms.state === "error" ? "Terms status could not be loaded. Refresh before checking again." : "A current version is available for you to read and accept."}</p><Link className="button button-quiet" href="/lister/terms?onboarding=1">Check Lister Terms status →</Link></>}
    {step === 5 && <><h1>Get ready to list</h1><p>Have these handy. We’ll guide you through the rest.</p><p><Link href="/lister/products/bulk">Adding lots of products? Bulk upload with CSV →</Link></p><ul className={styles.list}>{['Product photos','Product name + description','Price','Sizes/variants if applicable','Stock quantity','Delivery information'].map((item,i)=><li key={item} style={{animationDelay:`${i*60}ms`}}><span className={styles.check} aria-hidden="true">{i+1}</span>{item}</li>)}</ul></>}
    <div className={styles.actions}>
    {step > 2 && <form action={advanceOnboarding}><button className="button button-quiet" name="step" value={step-1}>Back</button></form>}
    {step !== 2 && <form action={advanceOnboarding}><input type="hidden" name="step" value={Math.min(step+1,5)} /><button className="button button-primary">Continue →</button></form>}
    {step !== 2 && <form action={advanceOnboarding}><input type="hidden" name="step" value={step}/><input type="hidden" name="later" value="1"/><button className="button button-quiet">Finish later</button></form>}
    </div></div>
  </section>;
}
