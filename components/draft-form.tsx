"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { editableDraft, readDraft, writeDraft } from "@/lib/form-drafts";
export function DraftForm({ draftKey, children, ...props }: ComponentProps<"form"> & { draftKey: string }) {
  const ref = useRef<HTMLFormElement>(null);
  function restore() {
    const values = readDraft(draftKey);
    if (!values || !ref.current) return;
    for (const control of ref.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input[name],textarea[name],select[name]")) {
      if (control instanceof HTMLInputElement && ["hidden", "password", "file"].includes(control.type)) continue;
      const saved = values[control.name];
      if (!saved) continue;
      if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) control.checked = saved.includes(control.value);
      else control.value = saved[0] ?? "";
    }
  }
  function keep() { if (ref.current) writeDraft(draftKey, editableDraft(new FormData(ref.current))); }
  return <form {...props} ref={ref} onChange={event => { keep(); props.onChange?.(event); }} onSubmit={event => { keep(); props.onSubmit?.(event); }}><FormRecovery onSettled={restore} />{children}</form>;
}
export function ClearDraft({ draftKey, prefix }: { draftKey?: string; prefix?: string }) {
  useEffect(() => {
    try { if (draftKey) { sessionStorage.removeItem(draftKey); if (draftKey.startsWith("hh-product-draft-") && draftKey.endsWith("-new")) sessionStorage.removeItem(draftKey.slice(0, -4)); } if (prefix) for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key); } catch { /* Optional browser storage. */ }
  }, [draftKey, prefix]);
  return null;
}

// React may reset uncontrolled fields after an action settles, including redirects
// to a recoverable error. Restore the captured draft after that reset.
export function FormRecovery({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const callback = useRef(onSettled);
  useEffect(() => { callback.current = onSettled; });
  useEffect(() => {
    if (pending) return;
    const timer = window.setTimeout(() => callback.current(), 0);
    return () => window.clearTimeout(timer);
  }, [pending]);
  return null;
}
