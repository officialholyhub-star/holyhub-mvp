"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./brand-logo-uploader.module.css";

const BUCKET = "lister-logos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

async function removeTemporaryLogo(path: string) {
  try {
    const { error } = await createClient().storage.from(BUCKET).remove([path]);
    if (error) console.error("Temporary storefront logo cleanup failed", error);
  } catch (error) {
    console.error("Temporary storefront logo cleanup failed", error);
  }
}

export function BrandLogoUploader({ userId, initialLogoUrl }: { userId: string; initialLogoUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingPath = useRef<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(initialLogoUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
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

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsUploading(true);

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
      URL.revokeObjectURL(localPreview);
      setLogoUrl(publicUrl);
      setPreviewUrl(publicUrl);
      const previousPath = pendingPath.current;
      pendingPath.current = path;
      if (previousPath) await removeTemporaryLogo(previousPath);
    } catch {
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(logoUrl || null);
      setError("We couldn't upload that logo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function removeLogo() {
    setError("");
    setLogoUrl("");
    setPreviewUrl(null);
    const path = pendingPath.current;
    pendingPath.current = null;
    if (path) await removeTemporaryLogo(path);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void upload(event.dataTransfer.files[0]);
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="brand-logo">Brand logo <span>(optional, recommended)</span></label>
      <input
        ref={inputRef}
        className="sr-only"
        id="brand-logo"
        type="file"
        accept={Object.keys(IMAGE_TYPES).join(",")}
        onChange={(event) => {
          void upload(event.currentTarget.files?.[0]);
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
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <div className={styles.preview}>
            <Image className={styles.logo} src={previewUrl} alt="Brand logo preview" width={100} height={100} unoptimized />
            <div className={styles.actions}>
              <strong>Logo ready</strong>
              <button className="button button-quiet" type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>Replace logo</button>
              <button className={styles.removeButton} type="button" onClick={() => void removeLogo()} disabled={isUploading}>Remove</button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>Add a logo so customers can recognise your brand.</p>
            <button className="button button-quiet" type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>Choose logo</button>
          </div>
        )}
      </div>
      <p className={styles.help}>A square logo works best. JPG, PNG, WebP or AVIF, up to 5 MB.</p>
      {isUploading && <p className={styles.status} role="status">Uploading logo...</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <input type="hidden" name="logo_url" value={logoUrl} />
    </div>
  );
}