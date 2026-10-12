import { ErrorRecovery } from "@/components/error-recovery";
import Link from "next/link";
import styles from "@/components/lister-onboarding.module.css";
import { advanceOnboarding } from "@/app/lister/onboarding/actions";
import { createProduct } from "@/app/lister/actions";
import { ProductForm } from "@/components/product-form";
import { requireRole } from "@/lib/auth/require-user";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string; onboarding?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data: storefront, error: storefrontError } = await supabase.from("lister_storefronts").select("user_id, delivery_charge").eq("user_id", user.id).maybeSingle();
  if (storefrontError) return <ErrorRecovery title="We couldn’t load these details" message="Please refresh before editing or continuing. Your saved details could not be checked." href="/lister" label="Return to dashboard" />;
  const { count: submittedCount, error: submittedError } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("lister_user_id", user.id).in("review_status", ["pending", "approved", "rejected"]);
  const guided = params.onboarding === "1" || (!submittedError && submittedCount === 0);
  return (
    <section className={guided ? styles.productShell : "auth-wrap"}>
      {storefront ? (
        <ProductForm action={createProduct} userId={user.id} error={params.error} guided={guided} deliveryCharge={storefront.delivery_charge}>
          {guided ? <><form action={advanceOnboarding}><button className="button button-quiet" name="step" value="4">Back to shop setup</button></form><form action={advanceOnboarding}><input type="hidden" name="step" value="5"/><input type="hidden" name="later" value="1"/><p className="muted-small">You can return to setup from your dashboard.</p><button className="button button-quiet form-back">Finish later</button></form></> : <Link className="button button-quiet form-back" href="/lister/products">Back to products</Link>}
        </ProductForm>
      ) : (
        <div className="card">
          <h2>Set up your shop first</h2>
          <p>Add your shop details before creating your first listing.</p>
          <Link className="button button-primary" href="/lister/onboarding">Set up shop</Link>
          <Link className="button button-quiet form-back" href="/account">Back to account</Link>
        </div>
      )}
    </section>
  );
}