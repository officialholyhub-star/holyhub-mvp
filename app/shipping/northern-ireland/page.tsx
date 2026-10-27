import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { NI_DELIVERY_MESSAGE } from "@/lib/delivery-territory";
import { NorthernIrelandInterest } from "@/components/ni-shipping-interest";

export default async function NorthernIrelandShippingPage({ searchParams }: { searchParams: Promise<{ area?: string; error?: string; requested?: string }> }) {
  const { user } = await requireUser();
  const params = await searchParams;
  const area = typeof params.area === "string" && /^BT(?:[1-9]|[1-8][0-9]|9[0-4])$/i.test(params.area) ? params.area.toUpperCase() : "";
  return <section className="section-wrap"><div className="card">
    <h1>{NI_DELIVERY_MESSAGE}</h1>
    <p>HolyHub is launching delivery to England, Scotland and Wales first. You can still browse and tell us which products you would like shipped to Northern Ireland.</p>
    <p>This records demand only. It does not enable delivery or place an order.</p>
    {params.error && <p role="alert" className="notice notice-error">{params.error}</p>}
    {params.requested === "yes" && <p role="status">Your Northern Ireland shipping request has been recorded. Delivery is not enabled yet.</p>}
    <NorthernIrelandInterest area={area} accountEmail={user.email ?? ""} />
    <p><Link href="/basket">Return to basket</Link> · <Link href="/marketplace">Continue browsing</Link></p>
  </div></section>;
}
