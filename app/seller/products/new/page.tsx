import { requireSeller } from "@/lib/seller";
import { ProductForm } from "@/components/product-form";
import { MarketNav } from "@/components/market-nav";
export default async function NewProduct(){await requireSeller();return <section className="content-narrow"><MarketNav area="seller"/><div className="section-heading"><p className="eyebrow">Made to be discovered</p><h1 className="page-title">Add your product.</h1></div><div className="card"><ProductForm/></div></section>;}
