CREATE TABLE "client_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer,
	"intake_id" integer,
	"doc_type" text DEFAULT 'other' NOT NULL,
	"title" text,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"source" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address1" text,
	"city" text,
	"state" text,
	"zip" text,
	"npi" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"sender" text,
	"subject" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"reader" text,
	"extraction" jsonb,
	"reader_error" text,
	"suggested_patient_id" integer,
	"decision" text,
	"patient_id" integer,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"npi" text,
	"taxonomy" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer,
	"note_id" integer,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"assigned_user_id" integer,
	"assigned_initials" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" text
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "follow_up_date" date;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_intake_id_intake_items_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."intake_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;