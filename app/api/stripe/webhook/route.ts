import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyStripeEvent } from "@/lib/payments/verify";
import { isUuid } from "@/lib/businesses";
import type Stripe from "stripe";
export const runtime="nodejs";
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(process.env.HOLYHUB_STRIPE_WEBHOOKS_ENABLED!=="true"||!secret||!serviceKey||!url)return NextResponse.json({error:"Stripe webhook processing is not configured."},{status:503});
 if(Number(request.headers.get("content-length")??0)>1048576)return new NextResponse(null,{status:413});
 const raw=await request.text();if(Buffer.byteLength(raw)>1048576)return new NextResponse(null,{status:413});
 let event:Stripe.Event;try{event=verifyStripeEvent(raw,request.headers.get("stripe-signature")??"",secret);}catch{return NextResponse.json({error:"Invalid signature."},{status:400});}
 // This build has no live checkout/transfer path. Live events are deliberately rejected.
 if(event.livemode)return NextResponse.json({error:"Live payment processing is not enabled in this build."},{status:503});
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type))return NextResponse.json({received:true,ignored:true});
 const session=event.data.object as Stripe.Checkout.Session;
 if(session.payment_status!=="paid")return NextResponse.json({received:true,pending:true});
 const orderId=session.metadata?.holyhub_order_id;
 if(!isUuid(orderId)||!Number.isSafeInteger(session.amount_total)||session.currency!=="gbp")return NextResponse.json({error:"Invalid HolyHub checkout metadata."},{status:400});
 const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await supabase.rpc("record_verified_checkout",{stripe_event_id:event.id,stripe_event_type:event.type,checkout_session_id:session.id,holyhub_order_id:orderId,paid_amount:session.amount_total,paid_currency:session.currency});
 if(error)return NextResponse.json({error:"Payment reconciliation failed. The event has not been acknowledged as processed."},{status:500});
 return NextResponse.json({received:true,processed:data===true});
}
