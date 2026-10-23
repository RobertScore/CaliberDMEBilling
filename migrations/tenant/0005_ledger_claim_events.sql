CREATE TABLE "claim_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"encounter_id" integer NOT NULL,
	"status" text NOT NULL,
	"previous_status" text,
	"method" text,
	"sent_to" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "allowed_cents" integer;--> statement-breakpoint
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_events" ADD CONSTRAINT "claim_events_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Claim history can never be edited or deleted, like the ledger and notes.
CREATE TRIGGER claim_events_append_only BEFORE UPDATE OR DELETE ON claim_events
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
