import Image from "next/image";
import Link from "@/components/site-link";
import { money, type Product } from "@/lib/data";
import { HolyHubIcon } from "./holyhub-icon";
export function ProductCard({product}:{product:Product}) {
 return <article className="product-card"><Link className="product-image-link" href={`/products/${product.id}`} aria-label={product.name}>{product.photo_id?<Image src={`/api/photos/${product.photo_id}`} width={600} height={600} unoptimized alt={product.name} className="product-image"/>:<span className="product-placeholder"><HolyHubIcon name="marketplace"/></span>}</Link><div className="product-card-content"><p className="category-chip">{product.category}</p><h2><Link href={`/products/${product.id}`}>{product.name}</Link></h2><p className="product-brand">{product.business_name}</p><div className="product-card-meta"><strong>{money(product.price_pence)}</strong><span>{product.stock>0?"Contact brand to buy":"Out of stock"}</span></div></div></article>;
}
