-- HF-76 Manage Appointment Preferences.
-- A customer's preferred date and time already live in
-- repair_requests.appointment_date / appointment_time. This adds optional
-- scheduling notes and records when the customer last changed their
-- preferences. Preferences are requests only; they never confirm a booking.

ALTER TABLE repair_requests
  ADD COLUMN IF NOT EXISTS scheduling_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE repair_requests
  ADD COLUMN IF NOT EXISTS preferences_updated_at TIMESTAMPTZ;

ALTER TABLE repair_requests
  ADD CONSTRAINT repair_requests_scheduling_notes_length
  CHECK (char_length(scheduling_notes) <= 500);
