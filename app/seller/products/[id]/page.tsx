import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireSeller } from "@/lib/seller";
import { isUuid } from "@/lib/businesses";
import type { Product } from "@/lib/marketplace";
import { ProductForm } from "@/components/product-form";
import { MarketNav } from "@/components/market-nav";
import { Notices } from "@/components/notices";
import { SubmitButton } from "@/components/submit-button";
import { changeProductStatus } from "../actions";
import { uploadProductImage } from "@/app/uploads/actions";
export default async function EditProduct({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;message?:string}>}){
 const {id}=await params;if(!isUuid(id))notFound();const {supabase,business}=await requireSeller();
 const {data,error}=await supabase.from("products").select("*").eq("id",id).eq("business_id",business.id).maybeSingle();if(error)throw new Error("Product unavailable");if(!data)notFound();
 const {data:photos,error:photoError}=await supabase.from("product_images").select("id").eq("product_id",id);if(photoError)throw new Error("Photos unavailable");
 return <section className="content-narrow"><MarketNav area="seller"/><div className="section-heading"><p className="eyebrow">{data.status} product</p><h1 className="page-title">{data.name}</h1></div><Notices {...await searchParams}/><div className="card"><ProductForm product={data as Product}/></div><section className="card top-space"><h2>Product photos</h2><p>Up to 5 JPG, PNG or WebP images, 5 MB each. Photos are checked and resized before being stored.</p><div className="photo-grid">{photos?.map(photo=><Image key={photo.id} src={`/api/product-image/${id}?image=${photo.id}`} alt={`Photo of ${data.name}`} width={200} height={200} unoptimized/>)}</div>{(photos?.length??0)<5&&<form action={uploadProductImage} className="form"><input type="hidden" name="id" value={id}/><div className="field"><label htmlFor="image">Add a photo</label><input type="file" name="image" id="image" accept="image/jpeg,image/png,image/webp" required/></div><SubmitButton pendingText="Uploading…">Upload photo</SubmitButton></form>}</section><section className="card top-space"><h2>Publishing</h2><p>Only approved listers can publish. Paid additional listings remain drafts until their fee is settled; fee collection is not enabled yet.</p><div className="button-row">{["published","draft","archived"].filter(s=>s!==data.status).map(s=><form action={changeProductStatus} key={s}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value={s}/><SubmitButton className={`button ${s==="published"?"button-primary":"button-quiet"}`}>{s==="published"?"Publish product":s==="archived"?"Archive product":"Move to draft"}</SubmitButton></form>)}{data.status==="published"&&<Link className="button button-quiet" href={`/products/${id}`}>View product →</Link>}</div></section></section>;
}
