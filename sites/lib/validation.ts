export function text(form: FormData, key: string, min: number, max: number) {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new Error(`${key.replaceAll("_", " ")} must be between ${min} and ${max} characters.`);
  return value.trim();
}
export function choice(form: FormData, key: string, values: string[]) { const value = text(form, key, 1, 100); if (!values.includes(value)) throw new Error(`Choose a valid ${key}.`); return value; }
export function number(form: FormData, key: string, max: number) { const raw = text(form, key, 1, 12); if (!/^\d+$/.test(raw)) throw new Error(`Enter a whole number for ${key}.`); const value = Number(raw); if (value > max) throw new Error(`${key} is too large.`); return value; }
export function price(form: FormData) { const raw = text(form, "price", 1, 12); if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) throw new Error("Enter a price in pounds, with up to two decimal places."); const value = Math.round(Number(raw) * 100); if (value > 10_000_000) throw new Error("The price cannot exceed £100,000."); return value; }
export function website(form: FormData) { const raw = text(form, "website", 0, 500); if (!raw) return ""; let url: URL; try { url = new URL(raw); } catch { throw new Error("Enter a full website address, starting with https://."); } if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".") || /^(localhost|127\.|0\.|10\.|192\.168\.)/.test(url.hostname)) throw new Error("Use a public HTTP or HTTPS website address."); return url.href; }

const crcTable = Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});

// Accept a bounded, non-interlaced PNG, verify every CRC and decoded scanline,
// and strip all optional metadata. Browser conversion does not replace server validation.
export async function sanitisePng(file: File): Promise<Uint8Array> {
  if (file.type !== "image/png" || file.size < 45 || file.size > 4_000_000) throw new Error("Choose an image no larger than 4 MB after preparation.");
  const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer);
  const signature = [137,80,78,71,13,10,26,10];
  if (signature.some((n, i) => bytes[i] !== n)) throw new Error("Invalid image.");
  let offset = 8, width = 0, height = 0, channels = 0, ended = false, dataStarted = false, dataEnded = false;
  const idats: Uint8Array[] = [], retained: Uint8Array[] = [bytes.slice(0, 8)];
  const crc = (data: Uint8Array) => { let c = 0xffffffff; for (const byte of data) c=(c>>>8)^crcTable[(c^byte)&255]; return (c^0xffffffff)>>>0; };
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset), end = offset + 12 + length;
    if (end > bytes.length) throw new Error("Incomplete image.");
    const type = String.fromCharCode(...bytes.slice(offset+4,offset+8));
    if (crc(bytes.subarray(offset+4,end-4)) !== view.getUint32(end-4)) throw new Error("Damaged image.");
    if (offset === 8 && type !== "IHDR") throw new Error("Invalid image header.");
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13) throw new Error("Invalid image header.");
      width=view.getUint32(offset+8); height=view.getUint32(offset+12);
      const depth=bytes[offset+16], color=bytes[offset+17]; channels=color===6?4:color===2?3:0;
      if (!width || !height || width>1600 || height>1600 || width*height>2_560_000 || depth!==8 || !channels || bytes[offset+18] || bytes[offset+19] || bytes[offset+20]) throw new Error("Please use a standard image up to 1600 pixels wide and high.");
      retained.push(bytes.slice(offset,end));
    } else if (type === "IDAT") {
      if (dataEnded) throw new Error("Invalid image data.");
      dataStarted=true; idats.push(bytes.slice(offset+8,end-4)); retained.push(bytes.slice(offset,end));
    } else if (type === "IEND") {
      if (length || !dataStarted || end !== bytes.length) throw new Error("Invalid image ending.");
      retained.push(bytes.slice(offset,end)); ended=true; break;
    } else {
      if (type === "acTL" || type === "fcTL" || type === "fdAT" || (type[0] === type[0].toUpperCase() && type !== "PLTE")) throw new Error("Use a still image, not an animation.");
      if (dataStarted) dataEnded=true;
    }
    offset=end;
  }
  if (!ended) throw new Error("Incomplete image.");
  const joined = new Uint8Array(idats.reduce((sum,a)=>sum+a.length,0)); let at=0; for (const chunk of idats) { joined.set(chunk,at); at+=chunk.length; }
  const stream = new Blob([joined]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const rowSize=width*channels+1, expected=rowSize*height; let total=0;
  try { for (;;) { const {done,value}=await stream.read(); if(done)break; if(total+value.length>expected) { await stream.cancel(); throw new Error("Image expands beyond its permitted size."); } for(let i=0;i<value.length;i++) if((total+i)%rowSize===0 && value[i]>4) throw new Error("Invalid image scanline."); total+=value.length; } } catch { throw new Error("This image could not be read. Try a different photo."); }
  if(total!==expected) throw new Error("Incomplete image pixels.");
  const output = new Uint8Array(retained.reduce((sum,a)=>sum+a.length,0)); at=0; for(const chunk of retained){output.set(chunk,at);at+=chunk.length;} return output;
}
