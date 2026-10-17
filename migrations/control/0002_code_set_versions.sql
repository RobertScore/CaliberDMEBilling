CREATE TABLE "code_set_loads" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_set" text NOT NULL,
	"version" text NOT NULL,
	"effective_from" date NOT NULL,
	"source_url" text NOT NULL,
	"file_name" text NOT NULL,
	"sha256" text NOT NULL,
	"added" integer NOT NULL,
	"changed" integer NOT NULL,
	"retired" integer NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"loaded_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "icd10_codes" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "icd10_codes" ADD COLUMN "billable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modifiers" ADD COLUMN "effective_from" date;--> statement-breakpoint
ALTER TABLE "modifiers" ADD COLUMN "effective_to" date;