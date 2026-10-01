"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./product-gallery.module.css";

type Props = { images: string[]; name: string };

export function ProductGallery({ images, name }: Props) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const swiped = useRef(false);
  if (!images.length) return <div className="product-detail-placeholder">HolyHub</div>;
  const multiple = images.length > 1;
  const current = Math.min(index, images.length - 1);
  function navigate(delta: number) { setIndex((current + delta + images.length) % images.length); }
  return <div className={styles.gallery}>
    <button type="button" className={styles.main} aria-label={`Enlarge ${name} image ${current + 1}`} onClick={() => { if (!swiped.current) dialog.current?.showModal(); swiped.current = false; }}
      onKeyDown={event => { if (multiple && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); navigate(event.key === "ArrowLeft" ? -1 : 1); } }}
      onTouchStart={event => { touchStart.current = event.touches[0].clientX; swiped.current = false; }}
      onTouchEnd={event => { if (multiple && touchStart.current !== null) { const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) { swiped.current = true; navigate(delta > 0 ? -1 : 1); } } touchStart.current = null; }}>
      <Image src={images[current]} alt={`${name} — image ${current + 1}`} width={1200} height={1500} unoptimized />
      <span className={styles.zoomHint}>Tap to enlarge</span>
    </button>
    {multiple && <>
      <div className={styles.navigation}><button type="button" onClick={() => navigate(-1)} aria-label="Previous product image">←</button><span aria-live="polite">{current + 1} / {images.length}</span><button type="button" onClick={() => navigate(1)} aria-label="Next product image">→</button></div>
      <div className={styles.thumbnails} aria-label="Product images">{images.map((url, i) => <button type="button" key={url} onClick={() => setIndex(i)} aria-label={`Show product image ${i + 1}`} aria-pressed={i === current}><Image src={url} alt="" width={96} height={120} unoptimized /></button>)}</div>
    </>}
    <dialog ref={dialog} className={styles.dialog} aria-label={`${name} enlarged image`} onCancel={event => { event.preventDefault(); dialog.current?.close(); }}>
      <button className="button button-quiet" type="button" onClick={() => dialog.current?.close()} autoFocus>Close</button>
      <Image src={images[current]} alt={`${name} — image ${current + 1}`} width={1600} height={2000} unoptimized />
      {multiple && <div className={styles.navigation}><button type="button" onClick={() => navigate(-1)} aria-label="Previous enlarged image">←</button><span>{current + 1} / {images.length}</span><button type="button" onClick={() => navigate(1)} aria-label="Next enlarged image">→</button></div>}
    </dialog>
  </div>;
}
