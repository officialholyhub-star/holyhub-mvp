"use client";
import { useState, type ReactNode, type FormEvent } from "react";

async function preparePhoto(file: File) {
  if (!file.size || file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image up to 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height), canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext("2d"); if(!context)throw new Error("Your browser could not prepare this photo.");
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Please try another image.")),"image/png"));
    if(blob.size>4_000_000)throw new Error("Please choose a smaller photo; this image is too detailed.");
    return new File([blob],"photo.png",{type:"image/png"});
  } finally { bitmap.close(); }
}

export function ActionForm({ action, children, className = "form" }: { action: string; children: ReactNode; className?: string }) {
  const [pending,setPending]=useState(false), [error,setError]=useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(pending)return;
    const data=new FormData(event.currentTarget); data.set("action",action); setPending(true);setError("");
    try {
      const photo=data.get("photo"); if(photo instanceof File && photo.size) data.set("photo",await preparePhoto(photo));
      const response=await fetch("/api/actions",{method:"POST",body:data,headers:{Accept:"application/json"}});
      const result=await response.json() as {error?:string;redirect?:string};
      if(!response.ok)throw new Error(result.error || "Unable to save. Please try again.");
      if(typeof result.redirect!=="string" || !result.redirect.startsWith("/") || result.redirect.startsWith("//"))throw new Error("Unexpected response. Please refresh.");
      window.location.assign(result.redirect);
    } catch(error) {setError(error instanceof Error?error.message:"Unable to save. Please try again.");setPending(false);}
  }
  return <form action="/api/actions" method="post" encType="multipart/form-data" onSubmit={submit} className={className}>
    <input type="hidden" name="action" value={action} />
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <fieldset disabled={pending} className="form-fieldset">{children}</fieldset>
    {pending && <p className="muted-small" role="status">Saving securely…</p>}
  </form>;
}
