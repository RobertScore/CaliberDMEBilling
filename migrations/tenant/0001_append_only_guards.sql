-- The ledger, account notes and audit log can never be edited or deleted.
-- Mistakes are corrected with new entries. This is enforced inside the database,
-- so even a bug in the application code can't change history.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Rows in % can never be edited or deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER notes_append_only BEFORE UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
-- Closed periods: no ledger entry may be posted on or before the latest close date.
CREATE OR REPLACE FUNCTION forbid_closed_period() RETURNS trigger AS $$
DECLARE
  closed date;
BEGIN
  SELECT max(closed_through) INTO closed FROM period_closes;
  IF closed IS NOT NULL AND NEW.post_date <= closed THEN
    RAISE EXCEPTION 'Books are closed through %; post this in an open period', closed;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_open_period BEFORE INSERT ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_closed_period();
