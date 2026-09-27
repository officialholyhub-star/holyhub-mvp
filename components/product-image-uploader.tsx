"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./product-image-uploader.module.css";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

async function discardUpload(path: string) {
  try {
    const { error } = await createClient().storage.from(BUCKET).remove([path]);
    if (error) console.error("Temporary product image cleanup failed", error);
  } catch (error) {
    console.error("Temporary product image cleanup failed", error);
  }
}

type ProductImageUploaderProps = {
  userId: string;
  initialImageUrl: string | null;
  onUploadingChange: (uploading: boolean) => void;
};

export function ProductImageUploader({ userId, initialImageUrl, onUploadingChange }: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingUploadPath = useRef<string | null>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(initialImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(file?: File) {
    if (!file || isUploading) return;
    setError("");

    const extension = IMAGE_TYPES[file.type];
    if (!extension) {
      setError("Choose a JPG, PNG, WebP or AVIF image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }

    const temporaryPreview = URL.createObjectURL(file);
    setPreviewUrl(temporaryPreview);
    setIsUploading(true);
    onUploadingChange(true);

    try {
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      URL.revokeObjectURL(temporaryPreview);
      setImageUrl(publicUrl);
      setPreviewUrl(publicUrl);

      const previousUpload = pendingUploadPath.current;
      pendingUploadPath.current = path;
      if (previousUpload) await discardUpload(previousUpload);
    } catch {
      URL.revokeObjectURL(temporaryPreview);
      setPreviewUrl(imageUrl || null);
      setError("We couldn't upload that image. Please try again.");
    } finally {
      setIsUploading(false);
      onUploadingChange(false);
    }
  }

  async function removeImage() {
    setError("");
    setImageUrl("");
    setPreviewUrl(null);

    const path = pendingUploadPath.current;
    pendingUploadPath.current = null;
    if (path) await discardUpload(path);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void uploadFile(event.dataTransfer.files[0]);
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="product-image">Product image <span>(optional)</span></label>
      <input
        ref={inputRef}
        className="sr-only"
        id="product-image"
        type="file"
        accept={Object.keys(IMAGE_TYPES).join(",")}
        onChange={(event) => {
          void uploadFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {previewUrl ? (
          <div className={styles.preview}>
            <Image className={styles.previewImage} src={previewUrl} alt="Product image preview" width={144} height={144} unoptimized />
            <div className={styles.previewDetails}>
              <strong>Image ready</strong>
              <button className="button button-quiet" type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>Replace image</button>
              <button className={styles.removeButton} type="button" onClick={() => void removeImage()} disabled={isUploading}>Remove image</button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>Drop an image here, or choose one from your device.</p>
            <button className="button button-quiet" type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>Choose image</button>
          </div>
        )}
      </div>
      <p className={styles.help}>Recommended: 1200 × 1500 px (4:5). Use a clear, well-lit product image. JPG, PNG, WebP or AVIF. Maximum file size: 5 MB.</p>
      {isUploading && <p className={styles.status} role="status">Uploading image...</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <input type="hidden" name="image_url" value={imageUrl} />
    </div>
  );
}