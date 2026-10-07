CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"phone_key" text NOT NULL,
	"code" text NOT NULL,
	"discount_percent" integer NOT NULL,
	"landing_path" text,
	"utm_source" text,
	"utm_campaign" text,
	"used_at" timestamp with time zone,
	"order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "subscribers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "channel" text DEFAULT 'minorista' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promo_code" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "wholesale_price" integer;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscribers_phone_idx" ON "subscribers" USING btree ("phone_key");--> statement-breakpoint
CREATE INDEX "subscribers_created_idx" ON "subscribers" USING btree ("created_at");