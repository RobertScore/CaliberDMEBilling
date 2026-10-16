CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hcpcs_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"short_description" text NOT NULL,
	"long_description" text,
	"effective_from" date,
	"effective_to" date,
	"source" text NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icd10_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"source" text NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"user_id" integer,
	"event" text NOT NULL,
	"client_id" integer,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "modifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "modifiers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payer_type" text NOT NULL,
	"state" text,
	"address1" text,
	"city" text,
	"zip" text,
	"phone" text,
	"electronic_payer_id" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_client_assignments" (
	"user_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	CONSTRAINT "user_client_assignments_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"user_type" text DEFAULT 'staff' NOT NULL,
	"role" text NOT NULL,
	"portal_client_id" integer,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"inactivity_timeout_minutes" integer DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_client_assignments" ADD CONSTRAINT "user_client_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_client_assignments" ADD CONSTRAINT "user_client_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_portal_client_id_clients_id_fk" FOREIGN KEY ("portal_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hcpcs_code_from_idx" ON "hcpcs_codes" USING btree ("code","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "icd10_code_from_idx" ON "icd10_codes" USING btree ("code","effective_from");