import { ClearDraft } from "@/components/draft-form";
import { ErrorRecovery } from "@/components/error-recovery";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import styles from "@/components/lister-onboarding.module.css";
export default async function FirstProductSuccess({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data, error } = await supabase.from("products").select("review_status").eq("lister_user_id", user.id).eq("review_status", "pending").limit(1);
  if (error || data == null) return <ErrorRecovery title="We couldn’t verify your submission" message="Check Products or refresh before submitting again." href="/lister/products" label="Check Products" />;
  if (!data?.some(product => product.review_status === "pending")) redirect(params?.saved === "new" ? "/lister/products?saved=new" : "/lister/products");
  return <section className={styles.shell}><div className={styles.panel}><span className={styles.check} aria-hidden="true">✓</span><p className="eyebrow">Product review</p>{params?.saved === "new" && <ClearDraft draftKey={`hh-product-draft-${user.id}-new`} />}<h1>Your products are awaiting HolyHub review.</h1><p>Products awaiting review do not need to be submitted again. Check Products for the status of each listing.</p><div className={styles.actions}><Link className="button button-primary" href="/lister/products/new">Add another product</Link><Link className="button button-quiet" href="/lister">Go to my dashboard</Link></div></div></section>;
}
