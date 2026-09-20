"use client";
import { useActionState } from "react";
import { saveProduct } from "@/app/seller/products/actions";
import { productCategories, type Product, type ProductState } from "@/lib/marketplace";
import { SubmitButton } from "@/components/submit-button";
export function ProductForm({ product }: { product?: Product }) {
 const initial: ProductState = { values: product ? { ...product, price: (product.price_pence/100).toFixed(2), stock: String(product.stock) } : {} };
 const [state,action] = useActionState(saveProduct,initial);
 const v=state.values ?? initial.values;
 return <form action={action} className="form">{product && <input type="hidden" name="id" value={product.id} />}{state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
 <div className="field"><label htmlFor="name">Product name</label><input id="name" name="name" defaultValue={v?.name} minLength={2} maxLength={120} required /></div>
 <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={v?.description} rows={6} minLength={20} maxLength={5000} required /></div>
 <div className="field"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={v?.category ?? ""} required><option value="" disabled>Select a category</option>{productCategories.map(c=><option key={c}>{c}</option>)}</select></div>
 <div className="form-columns"><div className="field"><label htmlFor="price">Price (£)</label><input id="price" name="price" inputMode="decimal" placeholder="19.99" defaultValue={v?.price} maxLength={10} required /></div><div className="field"><label htmlFor="stock">Stock available</label><input id="stock" name="stock" type="number" min={0} max={1000000} step={1} defaultValue={v?.stock ?? "0"} required /></div></div>
 <div className="field"><label htmlFor="delivery_info">Delivery or fulfilment information</label><textarea id="delivery_info" name="delivery_info" rows={3} defaultValue={v?.delivery_info} minLength={10} maxLength={1500} placeholder="Where you deliver, expected times and any restrictions." required /></div>
 <p className="muted-small">Prices and stock are checked on the server. Save first, then add photos and publish. Checkout is not accepting payments yet.</p><SubmitButton pendingText="Saving…">{product ? "Save product" : "Save draft & add photos"}</SubmitButton></form>;
}
