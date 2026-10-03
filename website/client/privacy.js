// What the desk collects, who sees it, and what a reader can do about it.
// Shared by the browser (app.js) and the build (prerender.mjs), so like
// contacts.js it must stay free of DOM and Node globals.
//
// Every row here describes something the code actually does. When a feature
// changes what it stores or who it sends data to, this file changes in the same
// commit, and `effective` moves with it: a policy that describes last year's
// site is worse than none, because the reader believes it.

import {escapeHtml} from './content.js';
import {organizers} from './contacts.js';

export const effective = {iso: '2026-10-03', label: 'October 3, 2026'};

// One row per thing a person can do that leaves data behind.
export const collected = [
  {
    activity: 'Reading the site',
    what: 'Nothing. There are no accounts to read, no analytics, no advertising, and no tracking cookies.',
    who: 'GitHub, which hosts the pages, receives your IP address as any web host does. Your browser also contacts the map and video services listed below.',
  },
  {
    activity: 'Signing the petition online',
    what: 'Name, email, city, state, ZIP, and an optional comment. For abuse review: a keyed hash of your network prefix (never the full IP address), a hash of your browser\'s user-agent string, and the result of the Cloudflare anti-bot check.',
    who: 'Organizers. Your name, city and comment appear publicly only if you tick the box to show them; the count includes you either way. Your email and ZIP are never published. The full list, contact details included, is delivered to the City Council or City Clerk and the Board of Commissioners or County Clerk when the petition is presented.',
  },
  {
    activity: 'Signing a paper petition sheet',
    what: 'What you write on the sheet: name, signature, address, town, ZIP.',
    who: 'The signed sheets are published with street addresses removed, so name, signature, town and ZIP remain visible. That is what makes the paper count checkable. The unredacted sheets go to the same officials as the online list.',
  },
  {
    activity: 'Creating an account',
    what: 'Sign-in is run by Auth0. We keep the display name you sign in with and an account ID. Your email address is shown to you on screen but is not written to our database.',
    who: 'Auth0 holds your login and email under its own privacy policy. The display name appears beside anything you post.',
  },
  {
    activity: 'Posting on the message board',
    what: 'Your posts, with your display name and the time.',
    who: 'Other signed-in members. A post removed by you or a moderator is hidden from the board but kept in the database; ask us and we will erase it.',
  },
  {
    activity: 'Answering the stance survey',
    what: 'The one answer you choose, tied to your account.',
    who: 'Organizers. Individual answers are never published; we may publish totals.',
  },
  {
    activity: `Emailing ${organizers.email}`,
    what: 'Your message and address.',
    who: 'Forwarded by Cloudflare to the two organizers. We ask before publishing your name or anything you wrote.',
  },
  {
    activity: 'Logging an open-records request',
    what: 'Your name, the agency and custodian, what you asked for, the dates it was sent and answered, any denial citation, and any documents you upload.',
    who: 'Your name and the request are public, so neighbors can find you instead of filing the same request twice. Uploaded documents are stored privately in a Google Drive account run by the desk. The document is then redacted, and only the redacted copy is published. The original upload is deleted once the redacted copy is up, or if an organizer decides it cannot be published.',
  },
];

// Services that receive data, and why. The VPS and database hosts are left
// generic: naming the provider tells a reader nothing they can act on, and
// both only ever hold what the rows above already describe.
export const services = [
  {name: 'GitHub Pages', role: 'Hosts the public pages.'},
  {name: 'A rented server and a managed database', role: 'Run the sign-in features, petition, message board, survey and open-records log, and store what they collect.'},
  {name: 'Auth0', role: 'Handles sign-in. Its script is loaded from jsDelivr.'},
  {name: 'Cloudflare', role: 'Routes mail sent to the desk\'s address, and runs the anti-bot check on the petition page.'},
  {name: 'Resend', role: 'Sends petition confirmation emails.'},
  {name: 'OpenStreetMap, Esri, USGS, and the county\'s GIS service', role: 'Supply map tiles and layers. Your browser fetches tiles from them directly, and fetches layers directly if the desk\'s stored copy is unavailable. A place you type into the map search is sent to OpenStreetMap\'s Nominatim service.'},
  {name: 'YouTube', role: 'Plays meeting recordings, only when you press play, through its reduced-tracking youtube-nocookie.com player.'},
  {name: 'Google Drive', role: 'Holds open-records uploads privately until they are redacted.'},
];

// What sits in your own browser. None of it is sent anywhere by the desk.
export const onDevice = [
  'A copy of the site\'s pages and map layers, so the desk opens offline and during county outages.',
  'Whether you dismissed the "install this app" prompt.',
  'Your sign-in session, kept by Auth0\'s script while you are signed in.',
];

export const rights = [
  {title: 'Withdraw a petition signature', detail: 'Use the withdrawal link in your confirmation email. The signature leaves every published total immediately.'},
  {title: 'See, correct or delete what we hold', detail: `Write to ${organizers.email}. We will tell you what we have and correct or delete it. A petition signature already delivered to officials is part of their record, and we cannot recall that copy.`},
  {title: 'Close your account', detail: `Write to ${organizers.email}. We remove your profile, survey answer and posts, and delete your Auth0 login.`},
];

const mailto = (email) => `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;

const collectedTable = () => `<table class="roster privacy-table">
    <caption class="visually-hidden">What the desk collects, and who sees it</caption>
    <thead><tr><th scope="col">When you</th><th scope="col">We keep</th><th scope="col">Who sees it</th></tr></thead>
    <tbody>${collected.map((row) => `<tr><th scope="row">${escapeHtml(row.activity)}</th><td data-label="We keep">${escapeHtml(row.what)}</td><td data-label="Who sees it">${escapeHtml(row.who)}</td></tr>`).join('')}</tbody>
  </table>`;

export function privacySections() {
  return `<header class="contact-head">
      <p class="eyebrow"><span></span> PRIVACY</p>
      <h1>What this desk knows, <em>and who sees it.</em></h1>
      <p class="lede">${escapeHtml(organizers.group)} is two neighbors, not a company. We do not sell data, run advertising or use analytics, and nothing here is shared with the developer. This page lists everything the site collects.</p>
      <p class="contact-source">Effective ${escapeHtml(effective.label)}</p>
    </header>

    <section>
      <p class="eyebrow"><span></span> WHAT WE COLLECT</p>
      <h2>Only what you hand us.</h2>
      ${collectedTable()}
    </section>

    <section>
      <p class="eyebrow"><span></span> WHO ELSE TOUCHES IT</p>
      <h2>The services behind the desk.</h2>
      <table class="roster privacy-table">
        <caption class="visually-hidden">Services that receive data</caption>
        <tbody>${services.map((service) => `<tr><th scope="row">${escapeHtml(service.name)}</th><td>${escapeHtml(service.role)}</td></tr>`).join('')}</tbody>
      </table>
      <p class="contact-fineprint">Each follows its own privacy policy. We share data with officials only by delivering the petition as described above, and with anyone else only if the law compels it.</p>
    </section>

    <section>
      <p class="eyebrow"><span></span> ON YOUR DEVICE</p>
      <h2>What stays in your browser.</h2>
      <ul class="privacy-list">${onDevice.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <p class="contact-fineprint">Clearing this site's data in your browser removes all of it.</p>
    </section>

    <section>
      <p class="eyebrow"><span></span> YOUR CHOICES</p>
      <h2>Ask, and it is done.</h2>
      <dl class="privacy-rights">${rights.map((right) => `<dt>${escapeHtml(right.title)}</dt><dd>${escapeHtml(right.detail)}</dd>`).join('')}</dl>
    </section>

    <section>
      <p class="eyebrow"><span></span> THE REST</p>
      <h2>Children, changes, questions.</h2>
      <p>The site is not meant for children under 13, and we do not knowingly collect anything from them.</p>
      <p>When what the site collects changes, this page changes with it, and the date at the top moves.</p>
      <p>Questions go to ${mailto(organizers.email)}.</p>
    </section>`;
}
