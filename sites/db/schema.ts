import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("hh_members", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(),
  suspended: integer("suspended").notNull().default(0), createdAt: text("created_at").notNull(),
});
export const businesses = sqliteTable("hh_businesses", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => members.id),
  name: text("name").notNull(), category: text("category").notNull(), location: text("location").notNull(),
  summary: text("summary").notNull(), description: text("description").notNull(), website: text("website").notNull(),
  status: text("status").notNull().default("pending"), reviewNote: text("review_note").notNull().default(""),
  version: integer("version").notNull().default(1), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("hh_business_owner").on(t.ownerId), index("hh_business_discovery").on(t.status, t.name)]);
export const products = sqliteTable("hh_products", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id),
  name: text("name").notNull(), description: text("description").notNull(), category: text("category").notNull(),
  pricePence: integer("price_pence").notNull(), stock: integer("stock").notNull(), deliveryInfo: text("delivery_info").notNull(),
  status: text("status").notNull().default("draft"), moderationStatus: text("moderation_status").notNull().default("visible"),
  version: integer("version").notNull().default(1), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("hh_product_business").on(t.businessId), index("hh_product_discovery").on(t.status, t.moderationStatus, t.createdAt)]);
export const photos = sqliteTable("hh_photos", {
  id: text("id").primaryKey(), productId: text("product_id").notNull().references(() => products.id),
  objectKey: text("object_key").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("hh_photo_product").on(t.productId, t.createdAt)]);
export const events = sqliteTable("hh_events", {
  id: text("id").primaryKey(), name: text("name").notNull(), organiser: text("organiser").notNull(),
  location: text("location").notNull(), schedule: text("schedule").notNull(), description: text("description").notNull(),
  website: text("website").notNull(), status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("hh_event_discovery").on(t.status, t.name)]);
export const notifications = sqliteTable("hh_notifications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => members.id),
  message: text("message").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("hh_notification_user").on(t.userId, t.createdAt)]);
export const audit = sqliteTable("hh_audit", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), action: text("action").notNull(),
  targetId: text("target_id").notNull(), createdAt: text("created_at").notNull(),
});
export const limits = sqliteTable("hh_limits", { key: text("key").primaryKey(), count: integer("count").notNull().default(1) });
