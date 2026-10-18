// The /join/ page: Sumter County Citizens for Transparency's own meetings, its
// published minutes, and its governing documents. Shared by the browser
// (app.js) and the build (prerender.mjs), so like contacts.js it must stay free
// of DOM and Node globals.
//
// This is the group's calendar, not the government's. City and county meetings
// live in meetings-data.js; the page links there rather than repeating them.
//
// TO ANNOUNCE A MEETING: add a row to ORG_MEETINGS. date is YYYY-MM-DD, time is
// 24-hour HH:MM in Americus time. A row stays under "Next meetings" through its
// own day and moves off the page the day after.
//
// TO POST MINUTES: put the approved PDF in research/ as
// scc4t-minutes-YYYY-MM-DD.pdf (top level: the Pages build copies
// research/*.pdf and nothing deeper) and add a row to MINUTES. Under the bylaws
// (§ 5.6) board minutes are internal records, so only post what the board has
// approved for release.

import {escapeHtml} from './content.js';
import {americusToday, clockTime, longDate} from './meetings.js';
import {organizers} from './contacts.js';

export const ORG = {
  name: 'Sumter County Citizens for Transparency, Inc.',
  short: 'SCC4T',
  // Certificate of incorporation, Georgia Secretary of State control no. 26218262.
  incorporated: {iso: '2026-10-09', label: 'October 9, 2026'},
  mailing: '132 W. Lamar Street, Americus, GA 31709',
};

export const ORG_MEETINGS = [
  // {date: '2026-10-27', time: '18:00', title: 'General meeting', place: 'Room name', address: 'Street, Americus, GA 31709', note: 'Optional one line.'},
];

export const MINUTES = [
  // {date: '2026-10-13', title: 'Board organizational meeting', href: '/research/scc4t-minutes-2026-10-13.pdf'},
];

export const DOCUMENTS = [
  {
    title: 'Bylaws and Operating Agreement',
    detail: 'Adopted October 13, 2026 · signed and notarized · 6 pages · PDF, 4.4 MB',
    href: '/research/scc4t-bylaws-2026-10-13.pdf',
  },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

// A malformed row fails the build and names itself, as meetings-data.js does,
// rather than publishing "Invalid Date" on the page people use to find us.
for (const [index, row] of ORG_MEETINGS.entries()) {
  if (!ISO_DATE.test(row.date || '') || !CLOCK.test(row.time || '') || !row.title || !row.place) {
    throw new Error(`org.js ORG_MEETINGS row ${index + 1} needs date (YYYY-MM-DD), time (HH:MM), title and place`);
  }
}
for (const [index, row] of MINUTES.entries()) {
  if (!ISO_DATE.test(row.date || '') || !row.title || !row.href) {
    throw new Error(`org.js MINUTES row ${index + 1} needs date (YYYY-MM-DD), title and href`);
  }
}

export const nextOrgMeetings = (today = americusToday()) =>
  ORG_MEETINGS.filter((meeting) => meeting.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

const year = (iso) => iso.slice(0, 4);

const meetingCard = (meeting) => `<li class="join-meeting">
    <p class="join-when">${escapeHtml(longDate(meeting.date))}, ${year(meeting.date)} · ${escapeHtml(clockTime(meeting.time))}</p>
    <h3>${escapeHtml(meeting.title)}</h3>
    <p>${escapeHtml(meeting.place)}${meeting.address ? `<br />${escapeHtml(meeting.address)}` : ''}</p>
    ${meeting.note ? `<p class="contact-fineprint">${escapeHtml(meeting.note)}</p>` : ''}
  </li>`;

// Everything on the page except the volunteer form, which only the app can
// render (it posts to the API). The build passes a stand-in for it.
export function joinSections({form = '', today = americusToday()} = {}) {
  const upcoming = nextOrgMeetings(today);
  const minutes = MINUTES.slice().sort((a, b) => b.date.localeCompare(a.date));
  return `<header class="contact-head">
      <p class="eyebrow"><span></span> JOIN US</p>
      <h1>Come to a meeting. <em>Lend a hand.</em></h1>
      <p class="lede">We are neighbors who read the documents, sit in the meetings and tell everyone else what we found. Our meetings are open to anyone who wants to come, and there is work for every kind of volunteer, whatever time you have.</p>
      <p class="contact-source">${escapeHtml(ORG.name)} · Georgia nonprofit corporation since ${escapeHtml(ORG.incorporated.label)}</p>
    </header>

    <section id="meetings">
      <p class="eyebrow"><span></span> OUR NEXT MEETINGS</p>
      <h2>${upcoming.length ? 'Pull up a chair.' : 'Next meeting to be announced.'}</h2>
      ${upcoming.length
        ? `<ul class="join-meetings">${upcoming.map(meetingCard).join('')}</ul>`
        : '<p class="contact-blurb">Sign up below and we will email you when the next one is set.</p>'}
      <p class="contact-fineprint">Looking for city council or county commission meetings? They are on the <a href="/meetings/">public meeting calendar</a>.</p>
    </section>

    <section id="volunteer">
      <p class="eyebrow"><span></span> VOLUNTEER</p>
      <h2>Tell us how you can help.</h2>
      ${form}
    </section>

    <section id="minutes">
      <p class="eyebrow"><span></span> MINUTES</p>
      <h2>What we decided.</h2>
      ${minutes.length
        ? `<ul class="join-docs">${minutes.map((row) => `<li><a href="${escapeHtml(row.href)}" target="_blank" rel="noopener">${escapeHtml(row.title)}</a><span>${escapeHtml(longDate(row.date))}, ${year(row.date)} · PDF</span></li>`).join('')}</ul>`
        : '<p class="contact-blurb">Approved minutes will be posted here.</p>'}
    </section>

    <section id="documents">
      <p class="eyebrow"><span></span> DOCUMENTS</p>
      <h2>How we are governed.</h2>
      <ul class="join-docs">${DOCUMENTS.map((doc) => `<li><a href="${escapeHtml(doc.href)}" download>${escapeHtml(doc.title)} ↓</a><span>${escapeHtml(doc.detail)}</span></li>`).join('')}</ul>
      <p class="contact-fineprint">Questions? Write to <a href="mailto:${escapeHtml(organizers.email)}">${escapeHtml(organizers.email)}</a>. Mail: ${escapeHtml(ORG.mailing)}.</p>
    </section>`;
}
