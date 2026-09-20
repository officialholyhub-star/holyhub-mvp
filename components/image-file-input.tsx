"use client";

// Keep multipart uploads below the host's 4.5 MB total request limit.
// The server independently checks size, file type and image contents.
export function ImageFileInput({ id = "image", name = "image" }: { id?:string; name?:string }) {
  return <input type="file" id={id} name={name} accept="image/jpeg,image/png,image/webp" required
    onChange={event => {
      const input=event.currentTarget, file=input.files?.[0];
      const invalid=file && (file.size===0 || file.size>4_000_000 || !["image/jpeg","image/png","image/webp"].includes(file.type));
      input.setCustomValidity(invalid ? "Choose a JPG, PNG or WebP image no larger than 4 MB." : "");
      if (invalid) input.reportValidity();
    }}
  />;
}
