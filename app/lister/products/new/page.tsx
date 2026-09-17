import Link from "next/link";
import { createProduct } from "@/app/lister/actions";
import { ProductForm } from "@/components/product-form";
import { requireRole } from "@/lib/auth/require-user";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireRole("lister");
  const { data: storefront } = await supabase.from("lister_storefronts").select("user_id").eq("user_id", user.id).maybeSingle();
  return (
    <section className="auth-wrap">
      {storefront ? (
        <ProductForm action={createProduct} error={params.error}>
          <Link className="button button-quiet form-back" href="/lister/products">Back to products</Link>
        </ProductForm>
      ) : (
        <div className="card">
          <h2>Set up your storefront first</h2>
          <p>Your products are linked to your storefront. Add those details before creating a listing.</p>
          <Link className="button button-primary" href="/lister/storefront">Set up storefront</Link>
          <Link className="button button-quiet form-back" href="/account">Back to account</Link>
        </div>
      )}
    </section>
  );
}