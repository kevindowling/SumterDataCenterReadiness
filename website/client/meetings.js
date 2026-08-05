// The public meeting calendar.
//
// The point of this site is that decisions about the data center get made in
// rooms residents are allowed to sit in. This module is the list of those
// rooms and when they are open.
//
// Every date here was read off the body's own posted calendar and checked in
// by hand, with the source recorded beside it. Nothing is computed from a rule
// like "third Tuesday". The rules are real — the county publishes one — but
// they are not reliable: the city's September 2026 meetings fall on the third
// and fourth Thursday, while February's and March's fell on the second and
// third. Publishing a computed date as though it were confirmed would send
// somebody to a locked building, which is the exact failure this site exists
// to prevent.
//
// Refreshing this list is a manual chore, by design. `staleAfter` below is the
// date past which the calendar admits it may be out of date rather than
// quietly showing an empty month.

// The bodies that decide, and how a resident actually reaches them.
export const BODIES = {
  commission: {
    name: 'Sumter County Board of Commissioners',
    short: 'County commission',
    venue: '500 West Lamar Street',
    address: 'Americus, GA 31709',
    phone: '(229) 928-4500',
    rhythm: 'Work session the second Tuesday of the month; regular meeting the third Tuesday. Both at 6:00 p.m.',
    calendar: 'https://www.sumtercountyga.us/calendar.aspx',
    agendas: 'https://www.sumtercountyga.us/agendacenter',
    remote: 'The county offers Zoom attendance.',
  },
  council: {
    name: 'Americus Mayor and City Council',
    short: 'City council',
    venue: 'Council Chambers, Russell Thomas Jr. Public Safety Building',
    address: '119 South Lee Street, Americus, GA 31709',
    phone: '(229) 924-4411',
    rhythm: 'An agenda-setting meeting and a council meeting each month, both at 6:00 p.m. The weeks move — check the date.',
    calendar: 'https://americuscityga.iqm2.com/Citizens/Calendar.aspx',
    agendas: 'https://americuscityga.iqm2.com/Citizens/Calendar.aspx',
    remote: 'The city offers a teleconference option.',
  },
  citizens: {
    name: 'Sumter County Citizens for Transparency',
    short: 'Community meeting',
    venue: 'Lake Blackshear Regional Library',
    address: '307 East Lamar St., Americus, GA 31709',
  },
};

// How public comment works, per body. `published` means the body has posted
// its rules and they are quoted here. `unknown` means it has not, which is a
// finding rather than a blank: it is a question worth asking before you go,
// and the phone number to ask it with is right there.
export const COMMENT = {
  published: {
    label: 'You can speak here',
    limit: 'Five speakers per meeting, five minutes each.',
    signup: 'The sign-up sheet opens 30 minutes before the meeting starts.',
    how: 'Call City Clerk Sierra Harvey at (229) 924-4411 ext. 244 on the day of the meeting, or sign up in person at the Council Chambers beforehand.',
    caution: 'Time may not be yielded to another speaker, and the five minutes may not be exceeded. With only five slots, arriving at 6:00 is arriving too late.',
  },
  unknown: {
    label: 'Public comment not confirmed',
    body: 'This body has not published how public comment works at this meeting. The meeting is open to the public either way — Georgia law requires that — but whether you may address it, and how to get on the list, is unconfirmed.',
  },
};

// Confirmed against each body's posted calendar on this date. Shown to the
// reader so the claim "confirmed" carries its own expiry.
export const CONFIRMED_ON = '2026-08-05';

// After this the calendar stops presenting itself as current. Set to the last
// month actually checked; a reader in January should be told to look at the
// county and city calendars rather than trust a page nobody has refreshed.
export const STALE_AFTER = '2026-12-31';

const COUNTY_SOURCE = (month) => `https://www.sumtercountyga.us/calendar.aspx?view=list&year=2026&month=${month}`;
const CITY_SOURCE = 'https://americuscityga.iqm2.com/Citizens/Calendar.aspx';

// date, body, kind, whether public comment is published, source.
const official = (date, body, kind, speak, source) =>
  ({date, body, kind, speak, time: '18:00', status: 'confirmed', source});

export const MEETINGS = [
  {
    date: '2026-08-04',
    slug: 'data-centers-are-coming',
    body: 'citizens',
    kind: 'Community meeting',
    title: 'Data centers are coming.',
    time: '18:00',
    status: 'confirmed',
    speak: 'open',
    summary: 'A company is proposing to build a large-scale data center in Americus. Before decisions get made, our community deserves to understand what that means for us — our water, our power bills, our land, and our future.',
    topics: [
      'Water usage & local supply impacts',
      'Electricity demand & utility rates',
      'Noise, land use & property values',
      'What residents can do next',
    ],
    program: [
      {name: 'Katie Minich', role: 'Welcome'},
      {name: 'Kevin Dowling', role: 'Life inside a data center'},
      {name: 'James Malphrus', role: 'Sowega Aquifer Alliance'},
      {name: 'Kirk Lyman-Barner', role: 'Better government'},
      {name: 'Q&A', role: 'Open to the community'},
    ],
    signups: 'Sign up at the door: moratorium petition, volunteers, T-shirts.',
    flyer: {
      src: '/assets/images/event_flyer.jpg',
      alt: 'Flyer: Community Meeting About Data Centers, Tuesday August 4 2026 at 6:00 p.m., Lake Blackshear Regional Library. Everyone welcome — bring your questions.',
    },
    recap: {
      video: {id: 'qYPjHDAbO9k', length: '1 hr 14 min'},
      deck: {
        href: '/research/better-government-2026-08-04.pdf',
        title: 'Better government',
        speaker: 'Kirk Lyman-Barner',
        meta: 'PDF · 3.8 MB',
      },
    },
  },
  official('2026-08-11', 'commission', 'Work session', 'unknown', COUNTY_SOURCE(8)),
  official('2026-08-13', 'council', 'Agenda-setting meeting', 'unknown', CITY_SOURCE),
  official('2026-08-18', 'commission', 'Regular meeting', 'unknown', COUNTY_SOURCE(8)),
  official('2026-08-20', 'council', 'Regular meeting', 'published', CITY_SOURCE),
  official('2026-09-08', 'commission', 'Work session', 'unknown', COUNTY_SOURCE(9)),
  official('2026-09-15', 'commission', 'Regular meeting', 'unknown', COUNTY_SOURCE(9)),
  official('2026-09-17', 'council', 'Agenda-setting meeting', 'unknown', CITY_SOURCE),
  official('2026-09-24', 'council', 'Regular meeting', 'published', CITY_SOURCE),
  official('2026-10-13', 'commission', 'Work session', 'unknown', COUNTY_SOURCE(10)),
  official('2026-10-15', 'council', 'Agenda-setting meeting', 'unknown', CITY_SOURCE),
  official('2026-10-20', 'commission', 'Regular meeting', 'unknown', COUNTY_SOURCE(10)),
  official('2026-10-22', 'council', 'Regular meeting', 'published', CITY_SOURCE),
  official('2026-11-10', 'commission', 'Work session', 'unknown', COUNTY_SOURCE(11)),
  official('2026-11-12', 'council', 'Agenda-setting meeting', 'unknown', CITY_SOURCE),
  official('2026-11-17', 'commission', 'Regular meeting', 'unknown', COUNTY_SOURCE(11)),
  official('2026-11-19', 'council', 'Regular meeting', 'published', CITY_SOURCE),
  official('2026-12-08', 'commission', 'Work session', 'unknown', COUNTY_SOURCE(12)),
  official('2026-12-10', 'council', 'Agenda-setting meeting', 'unknown', CITY_SOURCE),
  official('2026-12-15', 'commission', 'Regular meeting', 'unknown', COUNTY_SOURCE(12)),
  official('2026-12-17', 'council', 'Regular meeting', 'published', CITY_SOURCE),
].map((meeting) => ({
  ...meeting,
  id: `${meeting.date}-${meeting.slug || meeting.body}`,
  ...BODIES[meeting.body],
  // A meeting's own title wins over the body name it inherits above.
  ...(meeting.title ? {title: meeting.title} : {}),
}));

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
  const where = `${meetingWhen(meeting)} at ${meeting.venue}, ${meeting.address}.`;
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
