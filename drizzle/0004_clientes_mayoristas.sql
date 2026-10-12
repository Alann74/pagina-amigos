CREATE TABLE "wholesale_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business" text,
	"tax_id" text,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"city" text NOT NULL,
	"instagram" text,
	"sales_channel" text,
	"comment" text,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"code_hash" text,
	"approved_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "wholesale_customer_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "wholesale_customers_email_uidx" ON "wholesale_customers" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "wholesale_customers_status_idx" ON "wholesale_customers" USING btree ("status");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_wholesale_customer_id_wholesale_customers_id_fk" FOREIGN KEY ("wholesale_customer_id") REFERENCES "public"."wholesale_customers"("id") ON DELETE set null ON UPDATE no action;