CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer NOT NULL,
	"user_initials" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"patient_id" integer,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"service_date_from" date NOT NULL,
	"service_date_to" date NOT NULL,
	"rendering_provider" text,
	"billing_provider" text,
	"facility" text,
	"ordering_doctor" text,
	"prior_auth_number" text,
	"prior_auth_expires" date,
	"diagnosis_codes" jsonb NOT NULL,
	"insurance_rank" integer DEFAULT 1 NOT NULL,
	"claim_status" text DEFAULT 'not_billed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"kind" text NOT NULL,
	"post_date" date NOT NULL,
	"service_date_from" date,
	"service_date_to" date,
	"deposit_date" date,
	"service_line_id" integer,
	"encounter_id" integer,
	"code" text,
	"description" text NOT NULL,
	"quantity" integer,
	"insurance_delta_cents" integer NOT NULL,
	"patient_delta_cents" integer NOT NULL,
	"payer_name" text,
	"payment_type" text,
	"check_number" text,
	"claim_control_number" text,
	"reason_code" text,
	"batch_number" text,
	"reverses_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_insurances" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"payer_id" integer NOT NULL,
	"payer_name" text NOT NULL,
	"payer_type" text NOT NULL,
	"claim_number" text,
	"copay_cents" integer,
	"deductible_cents" integer,
	"eligible_from" date,
	"eligible_to" date,
	"relationship_to_insured" text NOT NULL,
	"subscriber_last_name" text,
	"subscriber_first_name" text,
	"subscriber_dob" date,
	"subscriber_sex" text,
	"member_id_encrypted" text,
	"member_id_last4" text,
	"group_number" text,
	"group_name" text,
	"date_of_injury" date,
	"employer_name" text,
	"adjuster_name" text,
	"adjuster_phone" text,
	"referral_number" text,
	"authorization_number" text
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_number" text NOT NULL,
	"legacy_id" text,
	"rep_initials" text,
	"ssn_encrypted" text,
	"ssn_last4" text,
	"alias" text,
	"last_name" text NOT NULL,
	"first_name" text NOT NULL,
	"middle_initial" text,
	"title" text,
	"dob" date NOT NULL,
	"sex" text NOT NULL,
	"marital_status" text,
	"address1" text,
	"address2" text,
	"zip" text,
	"city" text,
	"state" text,
	"country" text DEFAULT 'USA',
	"phone" text,
	"cell_phone" text,
	"email" text,
	"employer" text,
	"occupation" text,
	"language" text,
	"deceased" boolean DEFAULT false NOT NULL,
	"resp_relationship" text,
	"resp_last_name" text,
	"resp_first_name" text,
	"resp_phone" text,
	"relative_name" text,
	"relative_relationship" text,
	"relative_phone" text,
	"referring_physician" text,
	"coverage_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone,
	"updated_by" text,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	CONSTRAINT "patients_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "period_closes" (
	"id" serial PRIMARY KEY NOT NULL,
	"closed_through" date NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"encounter_id" integer NOT NULL,
	"line_number" integer NOT NULL,
	"hcpcs_code" text NOT NULL,
	"modifiers" jsonb NOT NULL,
	"description" text NOT NULL,
	"diagnosis_pointers" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"charge_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_service_line_id_service_lines_id_fk" FOREIGN KEY ("service_line_id") REFERENCES "public"."service_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_insurances" ADD CONSTRAINT "patient_insurances_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_lines" ADD CONSTRAINT "service_lines_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;