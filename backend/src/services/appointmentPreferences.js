// Rules for a customer's preferred repair appointment (HF-76).
//
// A preference is a request, not a booking: saving one never confirms an
// appointment or changes the repair request's status. The shop decides.
//
// Project rules:
// - Date: a real calendar date in YYYY-MM-DD form, from today up to
//   MAX_DAYS_AHEAD days ahead. "Today" is measured in Cambodia time.
// - Time: one of the named ranges below, a time such as "14:30", or a range
//   such as "09:00-11:00", within service hours (08:00 to 20:00). On today's
//   date, the time (or the end of the range) must not have passed already.
// - Regular requests need a date and a time. Emergency requests may leave both
//   empty ("as soon as possible"), but a date and time must be given together.
// - Scheduling notes are optional, up to MAX_NOTES_LENGTH characters.

export const TIME_ZONE = "Asia/Phnom_Penh";
export const MAX_DAYS_AHEAD = 90;
export const MAX_NOTES_LENGTH = 500;
export const SERVICE_HOURS = { start: 8 * 60, end: 20 * 60 };

// The ranges offered by the request form. Values are minutes after midnight.
export const TIME_RANGES = [
  { label: "Morning (8:00 – 12:00)", key: "morning", start: 8 * 60, end: 12 * 60 },
  { label: "Afternoon (12:00 – 17:00)", key: "afternoon", start: 12 * 60, end: 17 * 60 },
  { label: "Evening (17:00 – 20:00)", key: "evening", start: 17 * 60, end: 20 * 60 },
];

export const PREFERENCE_NOTICE = "Your preferred appointment has been sent to the shop. "
  + "It is a request, not a confirmed booking: the shop will confirm the actual time.";

const TIME_HELP = "Choose Morning, Afternoon or Evening, or enter a time like 14:30 "
  + "or a range like 09:00-11:00, between 08:00 and 20:00.";

// The current date (YYYY-MM-DD) and minutes after midnight in Cambodia.
export function localNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseClock(value) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function formatClock(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Returns { label, start, end } with a normalized label, or null if invalid.
export function parseTimePreference(value) {
  const text = value.trim();
  const named = TIME_RANGES.find((range) => range.label === text || range.key === text.toLowerCase());
  if (named) return { label: named.label, start: named.start, end: named.end };

  const [startText, endText, extra] = text.split(/\s*[-–]\s*/);
  if (extra !== undefined) return null;
  const start = parseClock(startText);
  const end = endText === undefined ? start : parseClock(endText);
  if (start === null || end === null || end < start) return null;
  if (endText !== undefined && end === start) return null;
  if (start < SERVICE_HOURS.start || start >= SERVICE_HOURS.end || end > SERVICE_HOURS.end) return null;
  return {
    label: endText === undefined ? formatClock(start) : `${formatClock(start)}-${formatClock(end)}`,
    start,
    end,
  };
}

function readText(value, name, errors) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    errors[name] = "Must be text.";
    return "";
  }
  return value.trim();
}

// Validates a preference. Returns { errors, values }; errors is empty when valid.
// values.appointmentTime is normalized (for example "morning" becomes
// "Morning (8:00 – 12:00)" and "9:00 - 11:00" becomes "09:00-11:00").
export function validateAppointmentPreferences(input, { emergency = false, now = new Date() } = {}) {
  const errors = {};
  const date = readText(input.appointmentDate, "appointmentDate", errors);
  const time = readText(input.appointmentTime, "appointmentTime", errors);
  const notes = readText(input.schedulingNotes, "schedulingNotes", errors);
  const today = localNow(now);
  let normalizedTime = time;

  if (!errors.appointmentDate) {
    if (!date) {
      if (!emergency) errors.appointmentDate = "Choose a preferred date.";
      else if (time) errors.appointmentDate = "Choose a date for your preferred time.";
    } else if (!isRealDate(date)) {
      errors.appointmentDate = "Enter a real date in the format YYYY-MM-DD.";
    } else if (date < today.date) {
      errors.appointmentDate = "Your preferred date cannot be in the past.";
    } else if (date > addDays(today.date, MAX_DAYS_AHEAD)) {
      errors.appointmentDate = `Choose a date within the next ${MAX_DAYS_AHEAD} days.`;
    }
  }

  if (!errors.appointmentTime) {
    if (!time) {
      if (!emergency) errors.appointmentTime = "Choose a preferred time or time range.";
      else if (date) errors.appointmentTime = "Choose a time for your preferred date.";
    } else {
      const parsed = parseTimePreference(time);
      if (!parsed) {
        errors.appointmentTime = TIME_HELP;
      } else {
        normalizedTime = parsed.label;
        const lastMinute = parsed.end > parsed.start ? parsed.end : parsed.start;
        if (!errors.appointmentDate && date === today.date && lastMinute <= today.minutes) {
          errors.appointmentTime = "That time has already passed today. Choose a later time or another day.";
        }
      }
    }
  }

  if (!errors.schedulingNotes && notes.length > MAX_NOTES_LENGTH) {
    errors.schedulingNotes = `Scheduling notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  }

  return { errors, values: { appointmentDate: date, appointmentTime: normalizedTime, schedulingNotes: notes } };
}

export function formatAppointmentPreference(row) {
  return {
    date: row.appointment_date || null,
    time: row.appointment_time || null,
    notes: row.scheduling_notes || "",
    updatedAt: row.preferences_updated_at || null,
  };
}
