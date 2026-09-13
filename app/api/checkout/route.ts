// TEST-mode checkout only. Browser-provided prices and return URLs never create a charge or mark an order paid.
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isUuid } from "@/lib/businesses";
import { getSiteUrl } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

type CheckoutItem = { product_name: string; quantity: number; unit_price_pence: number };
type CheckoutData = {
	order_id: string;
	existing?: boolean;
	checkout_session_id?: string;
	expires_at?: string;
	items?: CheckoutItem[];
	currency?: string;
};

function errorResponse(request: Request, orderId: string, message: string) {
	return NextResponse.redirect(new URL(`/checkout/${orderId}?error=${encodeURIComponent(message)}`, request.url), 303);
}

export async function POST(request: Request) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", error: "Sign in to continue to checkout." }, { status: 401 });

	const body = await request.formData();
	const orderId = String(body.get("order_id") ?? "");
	if (!isUuid(orderId)) return NextResponse.json({ code: "INVALID_ORDER", error: "This order is unavailable." }, { status: 400 });

	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) return errorResponse(request, orderId, "Stripe TEST MODE is not configured yet.");

	let siteUrl: string;
	try {
		siteUrl = await getSiteUrl();
	} catch {
		return errorResponse(request, orderId, "The checkout return URL is not configured.");
	}

	const { data: rawCheckout, error: beginError } = await supabase.rpc("begin_checkout", { order_id: orderId });
	if (beginError) {
		const message = /stock|available/i.test(beginError.message)
			? "A product in your order is no longer available. Return to your basket to review it."
			: /paid/i.test(beginError.message)
				? "This order has already been paid."
				: "This checkout could not be started. Please return to your basket and try again.";
		return errorResponse(request, orderId, message);
	}

	const checkout = rawCheckout as CheckoutData;
	const stripe = new Stripe(secretKey);
	if (checkout.existing && checkout.checkout_session_id) {
		try {
			const session = await stripe.checkout.sessions.retrieve(checkout.checkout_session_id);
			if (session.status === "open" && session.url) return NextResponse.redirect(session.url, 303);
			if (session.status === "complete") return NextResponse.redirect(new URL(`/checkout/${orderId}/success?session_id=${encodeURIComponent(session.id)}`, request.url), 303);
			await supabase.rpc("release_checkout", { order_id: orderId, release_state: "expired" });
			const retry = await supabase.rpc("begin_checkout", { order_id: orderId });
			if (retry.error) return errorResponse(request, orderId, "This checkout has expired. Return to your basket to try again.");
			Object.assign(checkout, retry.data as CheckoutData);
		} catch {
			return errorResponse(request, orderId, "The existing checkout could not be resumed. Return to your basket to try again.");
		}
	}

	if (!checkout.items?.length || checkout.currency !== "gbp" || !checkout.expires_at) {
		await supabase.rpc("release_checkout", { order_id: orderId, release_state: "failed" });
		return errorResponse(request, orderId, "This order could not be prepared for secure payment.");
	}

	try {
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			line_items: checkout.items.map(item => ({
				quantity: item.quantity,
				price_data: {
					currency: checkout.currency!,
					unit_amount: item.unit_price_pence,
					product_data: { name: item.product_name },
				},
			})),
			client_reference_id: orderId,
			metadata: { holyhub_order_id: orderId },
			success_url: `${siteUrl}/checkout/${orderId}/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${siteUrl}/api/checkout/cancel?order=${encodeURIComponent(orderId)}`,
			expires_at: Math.floor(new Date(checkout.expires_at).getTime() / 1000),
		}, { idempotencyKey: `holyhub-checkout-${orderId}-${checkout.expires_at}` });

		const { error: attachError } = await supabase.rpc("attach_checkout_session", { order_id: orderId, session_id: session.id });
		if (attachError || !session.url) {
			if (session.status === "open") await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
			await supabase.rpc("release_checkout", { order_id: orderId, release_state: "failed" });
			return errorResponse(request, orderId, "The secure checkout could not be opened. Please try again.");
		}
		return NextResponse.redirect(session.url, 303);
	} catch {
		await supabase.rpc("release_checkout", { order_id: orderId, release_state: "failed" });
		return errorResponse(request, orderId, "Stripe TEST MODE could not start this checkout. Please try again.");
	}
}
