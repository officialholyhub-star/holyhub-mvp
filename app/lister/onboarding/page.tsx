import { ClearDraft } from "@/components/draft-form";
import { ListerWelcome } from "@/components/lister-welcome";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/require-user";
import { onboardingCookie, onboardingStep } from "@/lib/lister-onboarding";
import { advanceOnboarding } from "./actions";
import { saveStorefront } from "@/app/lister/actions";
import { StorefrontForm } from "@/components/storefront-form";
import styles from "@/components/lister-onboarding.module.css";
export default async function OnboardingPage() {
  const { user, supabase } = await requireRole("lister");
  const { data: shop, error } = await supabase.from("lister_storefronts").select("business_name, description, category_type, website_url, instagram_url, logo_url, delivery_option, delivery_charge").eq("user_id", user.id).maybeSingle();
  if (error) return <section className={styles.shell}><h1>Your shop</h1><p role="alert">We couldn’t load your shop. Please refresh to try again.</p><Link href="/lister">Go to dashboard</Link></section>;
  const savedStep = onboardingStep((await cookies()).get(onboardingCookie(user.id))?.value);
  if (shop) {
    const products = await supabase.from("products").select("id").eq("lister_user_id", user.id).limit(1);
    if (products.error || products.data == null) return <section className={styles.shell}><h1>Your shop</h1><p role="alert">We couldn’t check your product progress. Refresh to try again.</p><Link href="/lister">Go to dashboard</Link></section>;
    if (products.data.length || savedStep <= 2 || savedStep === 5) redirect("/lister");
  }
  const step = !shop && savedStep > 2 ? 2 : savedStep;
  return <section className={styles.shell}>
    {step === 1 && !shop && !(await cookies()).get(onboardingCookie(user.id)) && <ListerWelcome />}
    <p className="eyebrow">Your shop starts here · Step {step} of 5</p>
    <progress className={styles.progress} value={step - 1} max={5} aria-label={`${step - 1} of 5 steps complete`} />
    <div className={styles.panel} key={step}>
    {step === 1 && <><h1>Welcome to HolyHub 💙</h1><p className="lead">Let’s get your shop ready.</p><p>You can be ready to start listing in just a few minutes.</p></>}
    {step === 2 && <><h1>Your shop</h1><p>A few details to help customers get to know you.</p><StorefrontForm action={saveStorefront} userId={user.id} storefront={shop} onboarding /></>}
    {step === 3 && <><ClearDraft draftKey={`hh-shop-draft-${user.id}`} /><p role="status"><span className={styles.check}>✓</span>Shop saved</p><h1>How HolyHub works</h1><div className={styles.grid}>{[['LIST','Add your products and submit them for approval.'],['SELL','Customers buy through HolyHub.'],['FULFIL','You package and send the order directly to the customer.']].map(([title,copy],i)=><article className={title === "FULFIL" ? styles.info : styles.tile} key={title}><span className={styles.check}>{i+1}</span><h2>{title}</h2><p>{copy}</p></article>)}</div><aside className={styles.tile}><strong>Your first 10 listings are free</strong><p>£0.20 per listing after that</p><p>5% commission when you make a sale</p></aside></>}
    {step >= 4 && <><h1>Get ready to list</h1><p>Have these handy. We’ll guide you through the rest.</p><p><Link href="/lister/products/bulk">Adding lots of products? Bulk upload with CSV →</Link></p><ul className={styles.list}>{['Product photos','Product name + description','Price','Sizes/variants if applicable','Stock quantity','Delivery information'].map((item,i)=><li key={item} style={{animationDelay:`${i*60}ms`}}><span className={styles.check} aria-hidden="true">{i+1}</span>{item}</li>)}</ul></>}
    <div className={styles.actions}>
    {step > 2 && <form action={advanceOnboarding}><button className="button button-quiet" name="step" value={step-1}>Back</button></form>}
    {step !== 2 && <form action={advanceOnboarding}><input type="hidden" name="step" value={Math.min(step+1,5)} /><button className="button button-primary">Continue →</button></form>}
    {step !== 2 && <form action={advanceOnboarding}><input type="hidden" name="step" value={step}/><input type="hidden" name="later" value="1"/><button className="button button-quiet">Finish later</button></form>}
    </div></div>
  </section>;
}
