import Link from "@/components/site-link";
import { member, one, type Business } from "@/lib/data";
import { AccountNav } from "@/components/page-ui";
import { ProductForm } from "@/components/forms";
export const dynamic="force-dynamic";
export default async function NewProduct(){const user=await member("/seller/products/new"),business=await one<Business>("SELECT * FROM hh_businesses WHERE owner_id=? AND status!='suspended'",user.id);return <><AccountNav/><div className="content-narrow"><h1 className="page-title">Something worth discovering.</h1><p>Add a product draft, then upload its photos.</p>{business?<div className="card"><ProductForm product={null}/></div>:<Link className="button button-primary" href="/account/business">Create or review your business profile →</Link>}</div></>;}
