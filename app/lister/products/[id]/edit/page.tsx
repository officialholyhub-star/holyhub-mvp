import { ErrorRecovery } from "@/components/error-recovery";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProduct } from "@/app/lister/actions";
import { ProductForm } from "@/components/product-form";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireRole("lister");
  const { data: product, error } = await supabase.from("products").select("id, name, description, category_type, price, image_url, size_guide_url, stock_quantity, is_published, product_images(image_url, sort_order), product_variants(size, stock_quantity)").eq("id", id).eq("lister_user_id", user.id).maybeSingle();
  if (error) return <ErrorRecovery title="We couldn’t load these details" message="Please refresh before editing or continuing. Your saved details could not be checked." href="/lister" label="Return to dashboard" />;
  if (!product) notFound();

  return (
    <section className="auth-wrap">
      <ProductForm action={updateProduct} userId={user.id} product={{ ...product, variants: product.product_variants ?? [] }} error={query.error}>
        <Link className="button button-quiet form-back" href="/lister/products">Back to products</Link>
        <Link className="button button-quiet form-back" href="/lister/storefront">Back to storefront</Link>
      </ProductForm>
    </section>
  );
}