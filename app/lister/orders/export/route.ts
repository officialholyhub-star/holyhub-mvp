import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCsv } from "@/lib/fulfilment";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  const { supabase, user } = await requireRole("lister");
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "unfulfilled";
  const selectedIds = (url.searchParams.get("ids") ?? "").split(",").filter((id) => UUID_PATTERN.test(id));
  if (scope === "selected" && selectedIds.length === 0) {
    return NextResponse.json({ error: "Select at least one seller order to export." }, { status: 400 });
  }

  let query = supabase
    .from("seller_orders")
    .select("id, order_id, carrier, carrier_other, created_at, orders(user_id, created_at)")
    .eq("seller_user_id", user.id);
  if (scope === "selected") query = query.in("id", selectedIds);
  else query = query.in("fulfilment_status", ["pending", "packed", "dispatched"]);
  const { data: sellerOrders, error: sellerOrderError } = await query.order("created_at", { ascending: false });
  if (sellerOrderError) return NextResponse.json({ error: "Orders could not be exported." }, { status: 500 });

  const orderIds = (sellerOrders ?? []).map((order) => order.order_id);
  const admin = createAdminClient();
  const { data: items, error: itemError } = orderIds.length
    ? await admin.from("order_items").select("order_id, product_id, product_name, quantity, variant_size").eq("seller_user_id", user.id).in("order_id", orderIds)
    : { data: [], error: null };
  if (itemError) return NextResponse.json({ error: "Order items could not be exported." }, { status: 500 });

  const customerIds = [...new Set((sellerOrders ?? []).map((order) => {
    const orderRecord = Array.isArray(order.orders) ? order.orders[0] : order.orders;
    return orderRecord?.user_id;
  }).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = customerIds.length ? await admin.from("profiles").select("id, full_name").in("id", customerIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? "Customer"]));
  const emails = new Map<string, string>();
  await Promise.all(customerIds.map(async (customerId) => {
    const result = await admin.auth.admin.getUserById(customerId);
    if (result.data.user?.email) emails.set(customerId, result.data.user.email);
  }));
  const orderById = new Map((sellerOrders ?? []).map((order) => [order.order_id, order]));
  const rows = (items ?? []).map((item) => {
    const sellerOrder = orderById.get(item.order_id);
    const orderRecord = sellerOrder && (Array.isArray(sellerOrder.orders) ? sellerOrder.orders[0] : sellerOrder.orders);
    const customerId = orderRecord?.user_id ?? "";
    const carrier = sellerOrder?.carrier === "Other" ? sellerOrder.carrier_other : sellerOrder?.carrier;
    return [
      item.order_id,
      names.get(customerId) ?? "Customer",
      "",
      emails.get(customerId) ?? "",
      item.product_name,
      "",
      item.variant_size ?? "",
      item.quantity,
      "",
      carrier ?? "",
      orderRecord?.created_at ?? sellerOrder?.created_at ?? "",
    ];
  });

  const csv = buildCsv([
    "Order ID",
    "Customer name",
    "Delivery address",
    "Customer email",
    "Product name",
    "SKU",
    "Variant/size",
    "Quantity",
    "Weight",
    "Shipping/delivery method",
    "Order date",
  ], rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="holyhub-orders-${scope}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
