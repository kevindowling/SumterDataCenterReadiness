// Who to contact, how to reach them, and what a resident is entitled to ask
// for. Shared by the browser (app.js) and the build (prerender.mjs), so like
// content.js and petition.js it must stay free of DOM and Node globals.
//
// The page markup is built here too, and both the app and the build call it.
// The petition page keeps two copies of its markup and they have to be edited
// in lockstep; this one is long enough that the second copy would be wrong
// within a month.
//
// Every roster entry carries its own `source` and `current` so the page can say
// where a name came from and how old it is. An out-of-date e-mail address sent
// to a council member is worse than no address at all: the resident believes
// they were heard and never was.

// The group behind the field desk. Deliberately one shared mailbox rather than
// personal addresses — either organizer can answer it, it survives someone
// stepping back, and it does not put a private inbox on a public page that
// scrapers read.
//
// Inbound is a Cloudflare Email Routing worker (deploy/email-worker/worker.js)
// that forwards to both organizers, so neither personal address appears here.
export const organizers = {
  group: 'Sumter County Citizens for Transparency',
  email: 'contact@scc4t.com',
  blurb: 'Two neighbors keep this desk. Write to us about anything on the site — a correction, a document you think we should have, a question about the petition, or an offer to help.',
  people: [
    // TODO: confirm both entries before launch — full names as each person
    // wants them printed, and the role line each is comfortable with.
    {name: 'Kirk', role: 'Organizer'},
    {name: 'Kevin Dowling', role: 'Organizer'},
  ],
  // What the group will and will not do with a message. Stated plainly because
  // the people most worth hearing from are the ones with the most to lose.
  privacy: 'Messages come to the organizers, not to any government office. We do not publish a message, or your name, without asking you first.',
};

// --- The two governing bodies ------------------------------------------------
// Each body is the unit a reader acts on: the roster, the one address and phone
// that always work, when it meets, and how to get on the agenda.

export const bodies = [
  {
    id: 'county',
    name: 'Sumter County Board of Commissioners',
    short: 'Sumter County',
    // Why a resident would write to this body rather than the other one.
    jurisdiction: 'Unincorporated Sumter County — everything outside the Americus city limits. The county votes on the moratorium for that ground, and on county zoning and permitting.',
    address: '500 West Lamar Street, Suite 100, Americus, GA 31709',
    mailing: 'P.O. Box 295, Americus, GA 31709',
    phone: '(229) 928-4500',
    fax: '(229) 928-4503',
    website: 'https://www.sumtercountyga.us/',
    websiteLabel: 'sumtercountyga.us',
    hours: 'Monday–Friday, 8:00 a.m.–5:00 p.m.',
    meetings: [
      'Work session: second Tuesday of the month, 6:00 p.m.',
      'Regular board meeting: third Tuesday of the month, 6:00 p.m.',
    ],
    meetingPlace: 'Both at 500 West Lamar Street. The county states all meetings are open to the public and offers Zoom attendance.',
    agendas: {href: 'https://www.sumtercountyga.us/agendacenter', label: 'County Agenda Center'},
    roster: [
      {seat: 'District 1', name: 'Clay Jones', email: 'cjones@sumtercountyga.us'},
      {seat: 'District 2', name: 'Mark Waddell', email: 'mwaddell@sumtercountyga.us'},
      {seat: 'District 3', name: 'Jim Reid', email: 'jreid@sumtercountyga.us'},
      {seat: 'District 4', name: 'David Baldwin', note: 'Chairman', email: 'dbaldwin@sumtercountyga.us'},
      {seat: 'District 5', name: 'Jessie Smith', email: 'jsmith@sumtercountyga.us'},
    ],
    source: 'Sumter County elected officials and contact information sheet',
    current: 'Current as of May 2025',
  },
  {
    id: 'city',
    name: 'Mayor and City Council of the City of Americus',
    short: 'City of Americus',
    jurisdiction: 'Inside the Americus city limits. The council votes on the moratorium for the city, and on the city zoning ordinance the draft would pause.',
    address: 'City Hall, 101 West Lamar Street, Americus, GA 31709',
    phone: '(229) 924-4411',
    altPhone: 'City Hall: (229) 924-3650',
    website: 'https://www.americusga.gov/',
    websiteLabel: 'americusga.gov',
    hours: 'Monday–Friday, 8:00 a.m.–5:00 p.m.',
    meetings: ['Regular monthly meeting of the Mayor and City Council. Check the city for the current date and time before you go.'],
    meetingPlace: 'Council meetings have been held at the Russell Thomas Jr. Public Safety Building, Lee Street.',
    roster: [
      {seat: 'Mayor', name: 'Travis Rush', email: 'trush@americusga.gov'},
      {seat: 'District 1', name: 'Dr. Terence J. Clemons', email: 'tclemons@americusga.gov'},
      {seat: 'District 2', name: 'Nelson Brown', email: 'nbrown@americusga.gov'},
      {seat: 'District 3', name: 'Kristopher “Kris” Bowden', email: 'kbowden@americusga.gov'},
      {seat: 'District 4', name: 'Frank Ceresoli', email: 'FCeresoli@americusga.gov'},
      {seat: 'District 5', name: 'Kelvin Pless', email: 'kpless@americusga.gov'},
      {seat: 'District 6', name: 'Daryl Dowdell', email: 'ddowdell@americusga.gov'},
    ],
    source: 'City of Americus elected officials and contact information sheet',
    current: 'Current as of May 2025',
  },
];

// --- Speaking at a meeting ---------------------------------------------------
// The city publishes these rules; they are reproduced rather than paraphrased,
// because a resident who plans for five minutes and gets three has lost the
// point they came to make.
export const publicComment = {
  body: 'City of Americus',
  title: 'Speaking at a regular monthly City Council meeting',
  rules: [
    'You may address the mayor and council on a matter of public concern for no more than five minutes.',
    'The total number of speakers at a meeting is limited to five.',
    'Call the City Clerk, Sierra Harvey, at 229-924-4411 ext. 244 on the day of the meeting, or sign up in person at the Council Chambers before it starts.',
    'A sign-up sheet is available 30 minutes before the meeting.',
    'You cannot yield your time to someone else, and you cannot speak beyond five minutes.',
  ],
  note: 'The county runs its own meetings; ask the county clerk at (229) 928-4500 how public comment is handled at a work session or regular meeting before you plan on speaking.',
  source: {label: 'City of Americus public comment notice', href: 'https://www.americusga.gov/'},
};

// --- How to approach an official --------------------------------------------
// Ordered by how much of a reader's evening each step costs, cheapest first.
export const approach = [
  {
    key: 'write',
    title: 'Write to them',
    time: '15 minutes',
    summary: 'One e-mail, to your own district member first, in your own words.',
    steps: [
      'Write to the member who represents where you live, and copy the chairman or the mayor. A district member counts letters from their own district differently from a mass e-mail to everyone.',
      'Put the ask in the first sentence — "please vote to adopt the 18-month data center moratorium" — then say who you are and where you live. Many officials read no further than the first line.',
      'Give one concrete reason of your own: your well, your road, your power bill, your view. A reason nobody else can write for you is the one that gets quoted in a meeting.',
      'Ask a direct question you want answered. A question obliges a reply in a way a statement does not.',
      'Be civil and be brief. The people you are writing to are neighbors, and a letter that insults them gets forwarded as proof the opposition is unreasonable.',
    ],
    fineprint: 'Correspondence about county or city business held in an official\'s account is itself a public record under O.C.G.A. § 50-18-70(b)(2) — including yours.',
  },
  {
    key: 'speak',
    title: 'Speak at a meeting',
    time: 'An evening',
    summary: 'Five minutes at the podium, five speakers a night — sign up the same day.',
    steps: [
      'Decide which body you are addressing. The city and the county meet separately, on different nights, and each votes only for the ground it governs.',
      'Get on the list early: only five people speak at a city meeting, and the sign-up sheet opens 30 minutes before.',
      'Write out what you will say and read it aloud once against a clock. Five minutes is about 600 words.',
      'Bring a printed copy for the clerk. What is handed up becomes part of the record; what is only spoken can be summarized in the minutes.',
      'Say your name and district at the start. The minutes have to identify who made and seconded each motion and how each member voted — your name in the record is the same kind of fact.',
    ],
  },
  {
    key: 'ask',
    title: 'Ask for the records',
    time: 'Three business days',
    summary: 'Any resident can demand the documents behind a decision, in writing, and get an answer on a clock.',
    steps: [
      'Send a written request to the agency\'s records custodian. Writing is not legally required, but only a written request carries the Act\'s enforcement provisions (§ 50-18-71(b)(3)).',
      'You do not have to say why you want it. Purpose is irrelevant to the right of access, and the right extends to requesters outside Georgia (§ 50-18-71(a)).',
      'The agency has three business days to produce the records for inspection — or, in the same three days, to describe what exists and give a timetable (§ 50-18-71(b)(1)(A)).',
      'Ask for electronic records in the format the agency keeps them in, including message headers and attachments (§ 50-18-71(f)).',
      'If any part is denied, the agency must cite the specific code section, subsection and paragraph in writing, and must still produce the parts that are not exempt (§§ 50-18-71(d), 50-18-72(b)).',
    ],
    fineprint: 'The first quarter hour of staff time is free, copies are generally capped at 10¢ a page, and there is no fee to simply inspect records routinely open to the public, such as deeds, ordinances and zoning maps.',
  },
];

// --- What the law entitles a citizen to -------------------------------------
// The high-level version. The full note carries the statute tables, the case
// law, and the verification status of every line.
export const rights = [
  {
    title: 'Every meeting is open',
    detail: 'O.C.G.A. § 50-14-1(b)(1): "all meetings shall be open to the public." That covers the county commission, the city council, and their boards and authorities — including planning and zoning.',
  },
  {
    title: 'Records are open by default',
    detail: 'O.C.G.A. § 50-18-70(a): public records "should be made available without delay." The Act is construed broadly and its exceptions narrowly, so the burden sits on the agency to justify withholding, not on you to justify asking.',
  },
  {
    title: 'Three business days, in writing',
    detail: 'An agency must produce records for inspection within three business days, or within those same three days describe what exists and say when you can see it (§ 50-18-71(b)(1)(A)).',
  },
  {
    title: 'A private company\'s records can still be public',
    detail: 'Records a private entity prepares or holds for or on behalf of an agency — or in cooperation with public officials, or contemplating the use of public funds — are public records (§ 50-18-70(b)(2); Cent. Atlanta Progress, Inc. v. Baker, 278 Ga. App. 733 (2006)).',
  },
  {
    title: 'An agenda on request',
    detail: 'A meeting agenda must be made available on request under § 50-14-1(e)(1). That takes an e-mail, not a formal records request.',
  },
  {
    title: 'Somewhere to complain',
    detail: 'The Attorney General runs an Open Government Mediation Program for records denials and closed meetings: (404) 656-7298. A filed complaint is itself an open record and may be shared with the agency it names.',
  },
];

// Documents a resident can read for themselves rather than take on trust.
export const documents = [
  {
    href: '/research/georgia-sunshine-laws-6th-edition.pdf',
    label: 'Georgia\'s Sunshine Laws: A Citizen\'s Guide to Open Government',
    detail: 'Sixth edition. The Attorney General\'s own handbook on the Open Records and Open Meetings Acts — what you may ask for, what may be withheld, and what to do when an agency says no.',
  },
  {
    href: '/research/moratorium-resolution.pdf',
    label: 'The joint moratorium resolution (PDF, 4 pages)',
    detail: 'The 18-month resolution both bodies are being asked to adopt, as drafted.',
  },
  {
    href: '/doc/records/',
    label: 'How to obtain the records and reach the officials',
    detail: 'The long version of this page: the statutes section by section, the fee caps, the exemptions that come up in development matters, a request letter you can copy, and what has and has not been verified.',
    internal: true,
  },
];

// --- Markup ------------------------------------------------------------------
// Progressive disclosure is done with <details>, not with script: the page is
// prerendered, so the summaries are readable and every drill-down still opens
// for a reader whose JavaScript never loads, and for the search crawler.

import {escapeHtml} from './content.js';

const mailto = (email) => `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;

function organizerBlock() {
  const {group, email, blurb, people, privacy} = organizers;
  const names = people.map((person) => `${escapeHtml(person.name)} <small>${escapeHtml(person.role)}</small>`).join('');
  return `<section class="contact-organizers">
    <p class="eyebrow"><span></span> WHO KEEPS THIS DESK</p>
    <h2>${escapeHtml(group)}</h2>
    <p class="contact-blurb">${escapeHtml(blurb)}</p>
    <div class="organizer-names">${names}</div>
    ${email
      ? `<p class="organizer-mail"><b>${mailto(email)}</b></p>`
      : `<p class="organizer-mail pending"><b>A group address is being set up.</b><span>Until it is published here, the fastest route is to catch either of us at a public meeting.</span></p>`}
    <p class="contact-fineprint">${escapeHtml(privacy)}</p>
  </section>`;
}

function bodyCard(body) {
  const rows = body.roster.map((member) => `<tr>
      <th scope="row">${escapeHtml(member.seat)}</th>
      <td>${escapeHtml(member.name)}${member.note ? ` <em>${escapeHtml(member.note)}</em>` : ''}</td>
      <td>${member.email ? mailto(member.email) : '<span class="unlisted">not published</span>'}</td>
    </tr>`).join('');
  return `<article class="contact-body">
    <header>
      <p class="eyebrow"><span></span> ${escapeHtml(body.short.toUpperCase())}</p>
      <h3>${escapeHtml(body.name)}</h3>
      <p class="body-jurisdiction">${escapeHtml(body.jurisdiction)}</p>
    </header>
    <table class="roster">
      <caption class="visually-hidden">${escapeHtml(body.name)} — members and e-mail addresses</caption>
      <thead><tr><th scope="col">Seat</th><th scope="col">Member</th><th scope="col">E-mail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <details class="drill">
      <summary>Office, meetings and agendas</summary>
      <dl>
        <dt>Office</dt><dd>${escapeHtml(body.address)}${body.mailing ? `<br />Mail: ${escapeHtml(body.mailing)}` : ''}</dd>
        <dt>Phone</dt><dd>${escapeHtml(body.phone)}${body.altPhone ? ` · ${escapeHtml(body.altPhone)}` : ''}${body.fax ? ` · fax ${escapeHtml(body.fax)}` : ''}</dd>
        <dt>Hours</dt><dd>${escapeHtml(body.hours)}</dd>
        <dt>Meets</dt><dd>${body.meetings.map((line) => escapeHtml(line)).join('<br />')}<br /><span class="muted">${escapeHtml(body.meetingPlace)}</span></dd>
        <dt>Online</dt><dd><a href="${escapeHtml(body.website)}" target="_blank" rel="noreferrer">${escapeHtml(body.websiteLabel)} ↗</a>${body.agendas ? ` · <a href="${escapeHtml(body.agendas.href)}" target="_blank" rel="noreferrer">${escapeHtml(body.agendas.label)} ↗</a>` : ''}</dd>
      </dl>
    </details>
    <p class="contact-source">${escapeHtml(body.source)} · ${escapeHtml(body.current)}</p>
  </article>`;
}

function approachBlock() {
  const cards = approach.map((step) => `<details class="approach-card drill">
      <summary>
        <span class="approach-time">${escapeHtml(step.time)}</span>
        <b>${escapeHtml(step.title)}</b>
        <span class="approach-summary">${escapeHtml(step.summary)}</span>
      </summary>
      <ol>${step.steps.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol>
      ${step.fineprint ? `<p class="contact-fineprint">${escapeHtml(step.fineprint)}</p>` : ''}
    </details>`).join('');
  return `<section class="contact-approach">
    <p class="eyebrow"><span></span> HOW TO APPROACH THEM</p>
    <h2>Three ways in, cheapest first.</h2>
    <div class="approach-grid">${cards}</div>
  </section>`;
}

function publicCommentBlock() {
  return `<section class="contact-comment">
    <p class="eyebrow"><span></span> ${escapeHtml(publicComment.body.toUpperCase())}</p>
    <h2>${escapeHtml(publicComment.title)}</h2>
    <ul>${publicComment.rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>
    <p class="contact-fineprint">${escapeHtml(publicComment.note)}</p>
  </section>`;
}

function rightsBlock() {
  return `<section class="contact-rights">
    <p class="eyebrow"><span></span> WHAT THE LAW GIVES YOU</p>
    <h2>You are entitled to the paperwork.</h2>
    <p class="lede">Georgia's Sunshine Laws are not a courtesy the county and the city extend. They are a standing obligation, with deadlines and penalties, and they apply to this project.</p>
    <div class="rights-grid">${rights.map((right) => `<details class="drill">
        <summary><b>${escapeHtml(right.title)}</b></summary>
        <p>${escapeHtml(right.detail)}</p>
      </details>`).join('')}</div>
  </section>`;
}

function documentsBlock() {
  return `<section class="contact-documents">
    <p class="eyebrow"><span></span> READ IT YOURSELF</p>
    <ul>${documents.map((doc) => `<li>
        <a href="${escapeHtml(doc.href)}"${doc.internal ? '' : ' target="_blank" rel="noreferrer"'}>${escapeHtml(doc.label)}${doc.internal ? ' →' : ' ↗'}</a>
        <span>${escapeHtml(doc.detail)}</span>
      </li>`).join('')}</ul>
  </section>`;
}

// The whole page below the masthead. app.js wraps it in the topbar and search
// panel; the build drops it straight into the prerendered shell.
export function contactSections() {
  return `<header class="contact-head">
      <p class="eyebrow"><span></span> CONTACT</p>
      <h1>Who to reach, <em>and how.</em></h1>
      <p class="lede">Every vote on this project is cast by someone with a name, a district and a published e-mail address. This page is the shortest route from a concern to the person who can act on it.</p>
    </header>
    ${organizerBlock()}
    <section class="contact-bodies">
      <p class="eyebrow"><span></span> YOUR ELECTED OFFICIALS</p>
      <h2>Two bodies decide this.</h2>
      <p class="lede">Write to the one that governs where you live — and to both if you want the moratorium adopted on both sides of the city line.</p>
      <div class="bodies-grid">${bodies.map((body) => bodyCard(body)).join('')}</div>
    </section>
    ${approachBlock()}
    ${publicCommentBlock()}
    ${rightsBlock()}
    ${documentsBlock()}`;
}
