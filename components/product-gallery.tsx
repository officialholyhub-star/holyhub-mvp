"use client";
import Image from "next/image";
import { useState } from "react";

export function ProductGallery({ productId, name, images }: {
  productId:string;
  name:string;
  images:{id:string}[];
}) {
  const [selected,setSelected] = useState(0);
  const current = images[selected] ?? images[0];
  const source = (id?:string) => `/api/product-image/${productId}${id ? `?image=${id}` : ""}`;
  return <div className="product-gallery">
    <Image
      className="detail-product-image"
      src={source(current?.id)}
      alt={name}
      width={800}
      height={800}
      loading="eager"
      unoptimized
    />
    {images.length > 1 && <>
      <div className="gallery-thumbnails" role="group" aria-label="Product photos">
        {images.map((photo,index)=><button
          key={photo.id}
          className="gallery-thumbnail"
          type="button"
          aria-label={`View photo ${index+1} of ${images.length}`}
          aria-pressed={current?.id===photo.id}
          onClick={()=>setSelected(index)}
        >
          <Image src={source(photo.id)} alt="" width={76} height={76} unoptimized />
        </button>)}
      </div>
      <p className="gallery-caption" aria-live="polite">Photo {Math.min(selected+1,images.length)} of {images.length}</p>
    </>}
  </div>;
}
