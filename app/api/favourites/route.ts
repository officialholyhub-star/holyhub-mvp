import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function readProductId(request: Request) {
  try {
    const body = await request.json() as { productId?: unknown };
    return typeof body.productId === "string" && productIdPattern.test(body.productId) ? body.productId : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const productId = await readProductId(request);
  if (!productId) return NextResponse.json({ error: "Invalid product" }, { status: 400 });

  const { data: product } = await supabase.from("products").select("id").eq("id", productId).eq("is_published", true).maybeSingle();
  if (!product) return NextResponse.json({ error: "Product unavailable" }, { status: 404 });

  const { error } = await supabase.from("favourites").insert({ user_id: user.id, product_id: productId });
  if (error && error.code !== "23505") return NextResponse.json({ error: "Could not save favourite" }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const productId = await readProductId(request);
  if (!productId) return NextResponse.json({ error: "Invalid product" }, { status: 400 });

  const { error } = await supabase.from("favourites").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return NextResponse.json({ error: "Could not remove favourite" }, { status: 500 });
  return NextResponse.json({ saved: false });
}
