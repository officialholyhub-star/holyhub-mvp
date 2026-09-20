declare module "cloudflare:workers" {
  export const env: { DB: D1Database; BUCKET: R2Bucket; HOLYHUB_ADMIN_EMAILS?: string };
}
