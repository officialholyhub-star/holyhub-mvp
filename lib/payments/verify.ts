import Stripe from "stripe";
export function verifyStripeEvent(body:string,signature:string,secret:string){
 // The placeholder is never sent to Stripe. Signature verification is local and uses the signing secret.
 const stripe=new Stripe("sk_test_signature_verification_only");
 return stripe.webhooks.constructEvent(body,signature,secret,300);
}
