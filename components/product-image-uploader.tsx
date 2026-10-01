"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_PRODUCT_IMAGES, moveProductImage, orderedProductImages, ownedProductImagePath, type ProductImage } from "@/lib/product-images";
import styles from "./product-image-uploader.module.css";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

type Props = { userId: string; initialImageUrl: string | null; initialImages?: ProductImage[]; onUploadingChange: (uploading: boolean) => void };

export function ProductImageUploader({ userId, initialImageUrl, initialImages, onUploadingChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replacement = useRef<number | null>(null);
  const busy = useRef(false);
  const temporary = useRef(new Set<string>());
  const [images, setImages] = useState(() => orderedProductImages(initialImages, initialImageUrl));
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  async function discardTemporary(url: string) {
    // Never delete persisted images or files outside this lister's folder.
    if (!temporary.current.has(url)) return;
    const path = ownedProductImagePath(url, userId);
    if (!path) return;
    try {
      const { error } = await createClient().storage.from(BUCKET).remove([path]);
      if (!error) temporary.current.delete(url);
    } catch { /* Keep the upload if cleanup could not be confirmed. */ }
  }

  async function uploadFiles(files: File[]) {
    if (!files.length || busy.current) return;
    const replaceAt = replacement.current; replacement.current = null;
    const capacity = replaceAt === null ? MAX_PRODUCT_IMAGES - images.length : 1;
    if (files.length > capacity) { setError(`Choose at most ${capacity} more image${capacity === 1 ? "" : "s"}. Maximum 5 images per product.`); return; }
    for (const file of files) {
      if (!IMAGE_TYPES[file.type]) { setError("Choose JPG, PNG, WebP or AVIF images."); return; }
      if (file.size > MAX_FILE_SIZE) { setError("Each image must be smaller than 5 MB."); return; }
    }
    busy.current = true; setIsUploading(true); onUploadingChange(true); setError("");
    const next = [...images];
    try {
      for (const file of files) {
        const client = createClient(); const path = `${userId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
        const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        temporary.current.add(url);
        if (replaceAt !== null) { const previous = next[replaceAt]; next[replaceAt] = url; await discardTemporary(previous); }
        else next.push(url);
        setImages([...next]);
      }
    } catch { setError("We couldn't upload all images. Successfully uploaded images are shown below; try the remaining files again."); }
    finally { busy.current = false; setIsUploading(false); onUploadingChange(false); }
  }

  function choose(index: number | null = null) { replacement.current = index; inputRef.current?.click(); }
  async function remove(index: number) {
    const url = images[index]; setImages(images.filter((_, i) => i !== index)); await discardTemporary(url);
  }

  return <div className={styles.field}>
    <label className={styles.label} htmlFor="product-image">Product images <span>(up to 5)</span></label>
    <p className={styles.help}>Recommended: 1200 × 1500 px (4:5). First image will be used as your cover image.</p>
    <input ref={inputRef} className="sr-only" id="product-image" type="file" multiple accept={Object.keys(IMAGE_TYPES).join(",")} disabled={isUploading} onChange={event => { void uploadFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
    <div className={`${styles.dropZone} ${isDragging ? styles.dragging : ""}`} onDragEnter={event => { event.preventDefault(); setIsDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={event => { event.preventDefault(); setIsDragging(false); replacement.current = null; void uploadFiles(Array.from(event.dataTransfer.files)); }}>
      <div className={styles.imageList}>{images.map((url, index) => <div className={styles.preview} key={url}>
        <Image className={styles.previewImage} src={url} alt={`Product image ${index + 1}${index === 0 ? ", cover" : ""}`} width={144} height={180} unoptimized />
        <div className={styles.previewDetails}><strong>{index === 0 ? "Cover image" : `Image ${index + 1}`}</strong>
          <button className="button button-quiet" type="button" disabled={isUploading || index === 0} aria-label={`Move image ${index + 1} earlier`} onClick={() => setImages(moveProductImage(images, index, index - 1))}>Move earlier</button>
          <button className="button button-quiet" type="button" disabled={isUploading || index === images.length - 1} aria-label={`Move image ${index + 1} later`} onClick={() => setImages(moveProductImage(images, index, index + 1))}>Move later</button>
          <button className="button button-quiet" type="button" disabled={isUploading} onClick={() => choose(index)}>Replace</button>
          <button className={styles.removeButton} type="button" disabled={isUploading} onClick={() => void remove(index)}>Remove</button>
        </div>
      </div>)}</div>
      {images.length < MAX_PRODUCT_IMAGES ? <div className={styles.emptyState}><p>Drop images here, or choose them from your device.</p><button className="button button-quiet" type="button" disabled={isUploading} onClick={() => choose()}>Choose images</button></div> : <p role="status">5-image limit reached. Remove or replace an image to change your gallery.</p>}
    </div>
    <p className={styles.help}>JPG, PNG, WebP or AVIF. Maximum 5 MB per image. Changes are saved when you save the product.</p>
    {isUploading && <p role="status">Uploading images…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    <input type="hidden" name="gallery_present" value="1" /><input type="hidden" name="image_url" value={images[0] ?? ""} />
    {images.map(url => <input type="hidden" name="image_urls" value={url} key={url} />)}
  </div>;
}
