CREATE TABLE `hh_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hh_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`location` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`website` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `hh_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hh_business_owner` ON `hh_businesses` (`owner_id`);--> statement-breakpoint
CREATE INDEX `hh_business_discovery` ON `hh_businesses` (`status`,`name`);--> statement-breakpoint
CREATE TABLE `hh_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`organiser` text NOT NULL,
	`location` text NOT NULL,
	`schedule` text NOT NULL,
	`description` text NOT NULL,
	`website` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hh_event_discovery` ON `hh_events` (`status`,`name`);--> statement-breakpoint
CREATE TABLE `hh_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hh_members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hh_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `hh_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hh_notification_user` ON `hh_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `hh_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `hh_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hh_photo_product` ON `hh_photos` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `hh_products` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`price_pence` integer NOT NULL,
	`stock` integer NOT NULL,
	`delivery_info` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`moderation_status` text DEFAULT 'visible' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `hh_businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hh_product_business` ON `hh_products` (`business_id`);--> statement-breakpoint
CREATE INDEX `hh_product_discovery` ON `hh_products` (`status`,`moderation_status`,`created_at`);
