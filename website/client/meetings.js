// The public meeting calendar — how the list behaves.
//
// The list itself is in meetings-data.js, which is the file to edit to refresh
// the calendar. This one turns those rows into what the pages render: it joins
// each meeting to the body holding it, validates the result, sorts and groups,
// and does the date and timezone arithmetic. It re-exports the data so every
// consumer still imports the calendar from one place.
//
// Deliberately free of DOM and Node globals: app.js imports it in the browser
// and prerender.mjs imports it at build time, so the HTML a crawler is served
// and the HTML a reader is served come from one source.

import {
  BODIES, COMMENT, CONFIRMED_ON, STALE_AFTER, MEETING_ROWS,
} from './meetings-data.js';

export {BODIES, COMMENT, CONFIRMED_ON, STALE_AFTER};

// A meeting nobody can attend is the failure this site exists to prevent, so a
// malformed row stops the build rather than rendering as a blank. This used to
// be silent in the worst way: `...BODIES[meeting.body]` spreads undefined
// without complaint, so one typo in a body name published a meeting with no
// venue, no address and no phone number, and the page looked merely empty.
// Now that the data sits in its own file for non-programmers to edit, the
// check is what makes that safe to offer.
const REQUIRED = ['date', 'body', 'kind', 'time', 'status'];

function validate(meeting, index) {
  const where = `meetings-data.js row ${index + 1} (${meeting.date || 'no date'})`;
  for (const field of REQUIRED) {
    if (!meeting[field]) throw new Error(`${where}: missing ${field}`);
  }
  if (!BODIES[meeting.body]) {
    throw new Error(`${where}: unknown body '${meeting.body}' — expected one of ${Object.keys(BODIES).join(', ')}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meeting.date)) {
    throw new Error(`${where}: date must be YYYY-MM-DD, got '${meeting.date}'`);
  }
  if (!/^\d{2}:\d{2}$/.test(meeting.time)) {
    throw new Error(`${where}: time must be 24-hour HH:MM, got '${meeting.time}'`);
  }
  // A date that does not exist — 2026-09-31, or February 30th — survives the
  // pattern above and then renders as a real-looking day in the wrong month.
  const [year, month, day] = meeting.date.split('-').map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) {
    throw new Error(`${where}: no such date on the calendar`);
  }
  if (meeting.speak && !COMMENT[meeting.speak] && meeting.speak !== 'open') {
    throw new Error(`${where}: speak must be 'published', 'unknown' or 'open', got '${meeting.speak}'`);
  }
  return meeting;
}

export const MEETINGS = MEETING_ROWS.map(validate).map((meeting) => ({
  // Body first, meeting second: a meeting inherits how to reach the body, and
  // anything the posting states for that one date — its room, its own headline
  // — wins over the body's standing default.
  ...BODIES[meeting.body],
  ...meeting,
  id: `${meeting.date}-${meeting.slug || meeting.body}`,
}));

// The id is the page URL. Two meetings of one body on one day — a work session
// and a called meeting, which happens — would otherwise collide, and the
// second would silently overwrite the first's page while both still showed on
// the calendar. Give one of them a `slug` to separate them.
const seen = new Set();
for (const meeting of MEETINGS) {
  if (seen.has(meeting.id)) {
    throw new Error(`meetings-data.js: two meetings share the id '${meeting.id}' — add a slug to one`);
  }
  seen.add(meeting.id);
}

export const meetingPath = (id) => `/meetings/${id}/`;
export const findMeeting = (id) => MEETINGS.find((meeting) => meeting.id === id);

// "Today" in Americus, not in the reader's timezone. Someone opening this from
// the west coast at 9 p.m. on the 10th must not be told the 11th is upcoming
// while Americus is already on the 11th, and vice versa.
export const americusToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const byDate = (a, b) => a.date.localeCompare(b.date);

export const upcomingMeetings = (today = americusToday()) =>
  MEETINGS.filter((meeting) => meeting.date >= today).sort(byDate);

export const pastMeetings = (today = americusToday()) =>
  MEETINGS.filter((meeting) => meeting.date < today).sort(byDate).reverse();

export const recapMeetings = (today = americusToday()) =>
  pastMeetings(today).filter((meeting) => meeting.recap);

// The next meeting a resident is actually invited to address. This is the one
// piece of the calendar worth putting on the home page: knowing a meeting
// exists is useless three hours after the sign-up sheet closed.
export const nextSpeakable = (today = americusToday()) =>
  upcomingMeetings(today).find((meeting) => meeting.speak === 'published');

export const calendarIsStale = (today = americusToday()) => today > STALE_AFTER;

// --- Dates and times -------------------------------------------------------

// Wall-clock time in Americus, as a UTC instant. Computed rather than written
// out by hand: these meetings straddle the November DST change, and a stamp an
// hour off puts a calendar reminder at the wrong time on somebody's phone.
const easternOffsetMs = (instant) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const at = (type) => Number(parts.find((part) => part.type === type).value);
  // formatToParts renders midnight as hour 24 in some engines.
  const asUtc = Date.UTC(at('year'), at('month') - 1, at('day'), at('hour') % 24, at('minute'), at('second'));
  return asUtc - instant.getTime();
};

export function easternInstant(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // The offset depends on the instant, and the instant on the offset. Two
  // passes settle it everywhere except inside the one hour a year that does
  // not exist, and no meeting is held at 2:30 a.m. on a spring Sunday.
  let instant = wall - easternOffsetMs(new Date(wall));
  instant = wall - easternOffsetMs(new Date(instant));
  return new Date(instant);
}

const stamp = (instant) => `${instant.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

export const startStamp = (meeting) => stamp(easternInstant(meeting.date, meeting.time));
export const endStamp = (meeting) =>
  stamp(new Date(easternInstant(meeting.date, meeting.time).getTime() + 2 * 60 * 60 * 1000));

// Rendered from the date string, never from a Date built in the reader's zone:
// new Date('2026-08-11') is midnight UTC, which is August 10th in Americus.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const monthKey = (date) => date.slice(0, 7);
export const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
};
export const weekday = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};
export const dayOfMonth = (date) => Number(date.slice(8, 10));
export const longDate = (date) => `${weekday(date)}, ${MONTHS[Number(date.slice(5, 7)) - 1]} ${dayOfMonth(date)}`;

export const clockTime = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${twelve}:${String(minute).padStart(2, '0')} ${suffix}` : `${twelve}:00 ${suffix}`;
};

// --- Naming ----------------------------------------------------------------

// An organiser's event carries its own headline; an official meeting is named
// by the body holding it, which is what a reader scanning a calendar needs.
// Shared with the build so a prerendered <title> and the in-app one match.
export const meetingLabel = (meeting) => meeting.title || `${meeting.short} — ${meeting.kind.toLowerCase()}`;
export const meetingWhen = (meeting) => `${longDate(meeting.date)} · ${clockTime(meeting.time)}`;
export const meetingSeoTitle = (meeting) =>
  `${meetingLabel(meeting)} — ${longDate(meeting.date)}, ${meeting.date.slice(0, 4)} — Sumter Field Desk`;

export function meetingDescription(meeting) {
  if (meeting.summary) return meeting.summary;
  const where = meeting.venuePosted === false
    ? `${meetingWhen(meeting)}. The location was not posted with the date — confirm before you go.`
    : `${meetingWhen(meeting)} at ${meeting.venue}, ${meeting.address}.`;
  return meeting.speak === 'published'
    ? `${meeting.name}. ${where} Five speakers, five minutes each; the sign-up sheet opens 30 minutes before.`
    : `${meeting.name}. ${where} Open to the public.`;
}

// Group a list into [monthKey, meetings] pairs, in the order given.
export function byMonth(meetings) {
  const groups = new Map();
  for (const meeting of meetings) {
    const key = monthKey(meeting.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meeting);
  }
  return [...groups];
}
