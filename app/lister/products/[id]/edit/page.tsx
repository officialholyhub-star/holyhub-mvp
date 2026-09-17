import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProduct } from "@/app/lister/actions";
import { ProductForm } from "@/components/product-form";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireRole("lister");
  const { data: product } = await supabase.from("products").select("id, name, description, category_type, price, image_url, is_published").eq("id", id).eq("lister_user_id", user.id).maybeSingle();
  if (!product) notFound();

  return (
    <section className="auth-wrap">
      <ProductForm action={updateProduct} product={product} error={query.error}>
        <Link className="button button-quiet form-back" href="/lister/products">Back to products</Link>
        <Link className="button button-quiet form-back" href="/lister/storefront">Back to storefront</Link>
      </ProductForm>
    </section>
  );
}