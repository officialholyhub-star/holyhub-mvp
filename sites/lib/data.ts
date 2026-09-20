import { env } from "cloudflare:workers";
import { getChatGPTUser, requireChatGPTUser } from "@/app/chatgpt-auth";

export type Member = { id: string; email: string; name: string; suspended: number };
export type Business = { id: string; owner_id: string; name: string; category: string; location: string; summary: string; description: string; website: string; status: string; review_note: string; version: number };
export type Product = { id: string; business_id: string; business_name: string; name: string; description: string; category: string; price_pence: number; stock: number; delivery_info: string; status: string; moderation_status: string; version: number; photo_id: string | null };
export type Event = { id: string; name: string; organiser: string; location: string; schedule: string; description: string; website: string; status: string; version: number };
export const productCategories = ["Clothing & Accessories", "Beauty & Wellbeing", "Books & Stationery", "Home & Gifts", "Food & Drink", "Art & Prints", "Digital Products", "Other"];
export const businessCategories = ["Fashion", "Beauty", "Food & Drink", "Events", "Music", "Services", "Art & Creators", "Christian Brands", "Other"];
type Bindings = { DB: D1Database; BUCKET: R2Bucket; HOLYHUB_ADMIN_EMAILS?: string };
export const bindings = () => env as unknown as Bindings;
export const db = () => { const value = bindings().DB; if (!value) throw new Error("HolyHub storage is unavailable."); return value; };
export const stmt = (sql: string, ...args: unknown[]) => db().prepare(sql).bind(...args);
export async function all<T>(sql: string, ...args: unknown[]) { const result = await stmt(sql, ...args).all<T>(); if (!result.success) throw new Error("Unable to load records."); return result.results; }
export async function one<T>(sql: string, ...args: unknown[]) { return stmt(sql, ...args).first<T>(); }
export function isAdmin(email: string) { return (bindings().HOLYHUB_ADMIN_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase()); }
export async function member(returnTo = "/account") {
  const user = await requireChatGPTUser(returnTo);
  await stmt("INSERT INTO hh_members(id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email", user.userId, user.email, user.fullName || "HolyHub member", new Date().toISOString()).run();
  const profile = await one<Member>("SELECT * FROM hh_members WHERE id=?", user.userId);
  if (!profile || profile.suspended) throw new Error("This account is unavailable. Contact Official.holyhub@gmail.com.");
  return profile;
}
export async function optionalMember() { const user = await getChatGPTUser(); return user ? one<Member>("SELECT * FROM hh_members WHERE id=? AND suspended=0", user.userId) : null; }
export const visibleProducts = "p.status='published' AND p.moderation_status='visible' AND b.status='approved' AND m.suspended=0";
export const productSelect = "SELECT p.*,b.name AS business_name,(SELECT id FROM hh_photos WHERE product_id=p.id ORDER BY created_at,id LIMIT 1) AS photo_id FROM hh_products p JOIN hh_businesses b ON b.id=p.business_id JOIN hh_members m ON m.id=b.owner_id";
export const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
export const search = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 80) : "";
export const like = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
export function pageNumber(value: unknown) { const n = Number(value); return Number.isInteger(n) && n > 0 && n < 10000 ? n : 1; }
