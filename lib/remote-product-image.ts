import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import sharp from "sharp";

export const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
};
export class RemoteImageError extends Error {}

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(address, prefix, "ipv4");
// Only public IPv6 global unicast is eligible. Exclude special-use, transition
// and documentation networks (including all IPv4-mapped/NAT64 addresses).
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
blocked.addSubnet("3fff::", 20, "ipv6");

export function isPublicImageAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export function validateRemoteImageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new RemoteImageError("URL must be a valid HTTP(S) image link."); }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new RemoteImageError("URL must use HTTP(S), a standard port and no username or password.");
  }
  if (isIP(host) ? !isPublicImageAddress(host) : !host.includes(".") ||
    /(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion|arpa)$/.test(host) ||
    host === "metadata.google.internal" || host === "metadata.goog") {
    throw new RemoteImageError("URL must point to a public image site; private or internal addresses are blocked.");
  }
  return url;
}

type Address = { address: string; family: number };
type Response = { status: number; location?: string; contentType?: string; contentLength?: string; contentEncoding?: string; body: AsyncIterable<Uint8Array>; close: () => void };
type Dependencies = {
  resolve: (hostname: string) => Promise<Address[]>;
  request: (url: URL, address: Address, signal: AbortSignal) => Promise<Response>;
};

// Connect to the already-vetted IP via a custom lookup. Keep the original host
// for HTTP Host and TLS verification, and never resolve it again on connect.
function requestImage(url: URL, address: Address, signal: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      agent: false, signal, maxHeaderSize: 16 * 1024,
      headers: { Accept: Object.keys(IMAGE_TYPES).join(", "), "Accept-Encoding": "identity" },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
    };
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, options, (response: IncomingMessage) => {
      resolve({
        status: response.statusCode ?? 0, location: response.headers.location,
        contentType: response.headers["content-type"], contentLength: response.headers["content-length"],
        contentEncoding: response.headers["content-encoding"], body: response,
        close: () => response.destroy(),
      });
    });
    request.on("error", reject);
    request.end();
  });
}

// Also bound DNS time; a slow resolver must not bypass the overall deadline.
async function beforeDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function validateRemoteImageBytes(bytes: Buffer, contentType: string) {
  if (bytes.length > MAX_REMOTE_IMAGE_BYTES) throw new RemoteImageError("is larger than 5 MB.");
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES[mime]) throw new RemoteImageError("must be JPEG, PNG, WebP or AVIF.");
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    const actualMime = metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png"
      : metadata.format === "webp" ? "image/webp" : metadata.format === "heif" && metadata.compression === "av1" ? "image/avif" : null;
    if (actualMime !== mime || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error("Unsupported content");
    // Decode the pixels too: metadata/signatures alone accept truncated files.
    await image.timeout({ seconds: 5 }).stats();
  } catch { throw new RemoteImageError("does not contain a valid JPEG, PNG, WebP or AVIF image (maximum 40 megapixels; use a still image)."); }
  return { bytes, contentType: mime, extension: IMAGE_TYPES[mime] };
}

export async function downloadProductImage(value: string, dependencies: Dependencies = {
  resolve: hostname => lookup(hostname, { all: true }), request: requestImage,
}) {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let url = validateRemoteImageUrl(value);
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const host = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(host) ? [{ address: host, family: isIP(host) }]
        : await beforeDeadline(dependencies.resolve(host), signal);
      if (!addresses.length || addresses.some(item => !isPublicImageAddress(item.address))) {
        throw new RemoteImageError("URL resolves to a private or internal address and is blocked.");
      }
      const response = await beforeDeadline(dependencies.request(url, addresses[0], signal), signal);
      try {
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects === MAX_REDIRECTS || !response.location) throw new RemoteImageError("could not be downloaded (too many or invalid redirects).");
          url = validateRemoteImageUrl(new URL(response.location, url).href);
          continue;
        }
        if (response.status !== 200) throw new RemoteImageError("could not be downloaded. Check the image link is publicly accessible.");
        if (response.contentEncoding && response.contentEncoding !== "identity") throw new RemoteImageError("could not be downloaded. Use a direct, uncompressed image link.");
        if (Number(response.contentLength) > MAX_REMOTE_IMAGE_BYTES) throw new RemoteImageError("is larger than 5 MB.");
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of response.body) {
          signal.throwIfAborted();
          size += chunk.byteLength;
          if (size > MAX_REMOTE_IMAGE_BYTES) throw new RemoteImageError("is larger than 5 MB.");
          chunks.push(Buffer.from(chunk));
        }
        return await validateRemoteImageBytes(Buffer.concat(chunks), response.contentType ?? "");
      } finally { response.close(); }
    }
    throw new RemoteImageError("could not be downloaded.");
  } catch (error) {
    if (error instanceof RemoteImageError) throw error;
    throw new RemoteImageError("could not be downloaded. Check the link or try again (15-second timeout).");
  }
}
