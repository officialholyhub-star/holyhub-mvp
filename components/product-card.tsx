import Image from "next/image";
import Link from "next/link";
import { money, type Product } from "@/lib/marketplace";
export function ProductCard({ product }: { product: Product }) {
 return <article className="product-card"><Link href={`/products/${product.id}`} className="product-image-link" tabIndex={-1} aria-hidden="true"><Image src={`/api/product-image/${product.id}`} alt="" width={500} height={500} unoptimized className="product-image" /></Link><div className="product-card-content"><p className="category-chip">{product.category}</p><h2><Link href={`/products/${product.id}`}>{product.name}</Link></h2><div className="product-card-meta"><strong>{money(product.price_pence)}</strong><span>{product.stock ? "Discover →" : "Sold out"}</span></div></div></article>;
}
