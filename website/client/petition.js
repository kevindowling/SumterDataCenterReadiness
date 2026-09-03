// The petition definition, shared by the browser (app.js), the build
// (prerender.mjs) and the API (server.mjs). Like content.js it must stay free
// of DOM and Node globals so all three can import it.
//
// One petition is live at a time; `petitions` is a list so a second one can be
// added later without reworking the routes, which are all keyed by id.

export const petitions = [
  {
    id: 'moratorium',
    // Shown on the page and in the tab title.
    title: 'Adopt the 18-month data center moratorium',
    eyebrow: 'PETITION TO SUMTER COUNTY AND THE CITY OF AMERICUS',
    // Both governing bodies the signed petition is presented to. The draft is a
    // single joint resolution, but each body has to adopt it for its own
    // jurisdiction, so the page names both before it asks for a signature.
    addressedTo: [
      'The Sumter County Board of Commissioners',
      'The Mayor and City Council of the City of Americus',
    ],
    // Why two recipients still means one signature. Stated wherever the two
    // bodies are listed: a reader who thinks a second signature is owed
    // somewhere else is a reader who leaves the page unsure they finished.
    signingNote:
      'One signature, presented to both. Sign once here, or once on the paper copy; your name goes to the county and to the city. There is no second petition to sign.',
    // One sentence, used in link previews and the meta description.
    summary:
      'A petition asking the Sumter County Board of Commissioners and the Mayor and City Council of Americus each to adopt the joint 18-month moratorium on the zoning, rezoning, permitting and construction of data centers, so both governments can write an ordinance before either has to answer an application.',
    // The ask, in the signer\'s voice. Rendered as the body of the petition:
    // this is the text a signature is attached to, so it is versioned in the
    // repo and any change to it is visible in the file history.
    body: [
      'We, the undersigned residents of Americus and Sumter County, ask the Sumter County Board of Commissioners and the Mayor and City Council of the City of Americus each to adopt the joint resolution now in draft before them: an 18-month temporary moratorium on the zoning, rezoning, development, permitting and construction of data centers within their respective jurisdictions.',
      'This is one petition to two governments. The draft is a single joint resolution, but each body adopts it for the ground it governs: the county for unincorporated Sumter County, the city for Americus. A data center refused on one side of that line and permitted on the other would draw on the same water, the same roads and the same power, so we are asking both, together. One signature is presented to both; nobody is asked to sign twice.',
      'Neither the State of Georgia, Sumter County, nor the City of Americus has any ordinance governing where data centers may be sited or how they must operate. Neither code of ordinances defines the term at all. Until they do, any application that arrives has to be judged under a zoning code written for something else.',
      'The draft resolution asks for time, not a refusal. It would pause zoning, permitting and construction of data centers for 18 months from the day it is adopted, and directs the Planning and Zoning staff of both governments, the City Council, the Board of Commissioners, and outside experts to study the effects and draft the ordinance amendments the county and the city currently lack.',
      'We are asking our elected officials to use that time before a decision has to be made, rather than after.',
    ],
    // Local shorthand for the "what am I signing?" line above the form.
    ask: 'Pause data center zoning and permitting in the county and the city for 18 months, until both have an ordinance.',
    // The draft resolution itself, served from /research/.
    document: {
      href: '/research/moratorium-resolution.pdf',
      label: 'Read the full joint resolution (PDF, 4 pages)',
    },
    // The scanned sheets behind the "signed on paper" line in the tally. A count
    // nobody can check is just a claim, and these are what make it checkable:
    // the printed names, the signatures, and the circulator on each page who
    // certified they watched it signed.
    //
    // The street address column is painted out before publishing. Signers gave
    // an address to prove they live here, not to have it posted, and the paper
    // sheet has no box to ask them with, unlike the form on this page, where
    // being listed at all is opt-in. The unredacted scans stay off the server.
    paperSheets: {
      href: '/research/petition-signatures-redacted.pdf',
      label: 'See the signed paper sheets',
      note: 'PDF, 21 pages. Street addresses removed; names, signatures, town and ZIP are as signed.',
    },
    // Where the paper copy can be signed in person. Signing on paper counts the
    // same as signing online; it is reported separately so the totals stay
    // honest about how each signature was collected.
    //
    // While `address` is empty the page says the in-person location is being
    // arranged instead of naming one. `place` and `hours` are still blank: the
    // page drops those cells rather than printing a heading with nothing under
    // it, so both can be filled in as they are settled.
    inPerson: {
      place: '',
      address: '132 W Lamar St, Americus, GA 31709',
      hours: [],
      note: 'Bring photo ID or a piece of mail if you would like your signature recorded as a verified Sumter County resident.',
      contact: '',
    },
  },
];

export const findPetition = (id) => petitions.find((item) => item.id === id) || null;
export const livePetition = () => petitions[0];

export const petitionPath = (id) => (id === livePetition().id ? '/petition/' : `/petition/${id}/`);

// --- Locality ---------------------------------------------------------------
// Sumter County, Georgia postal codes. A signature is only reported as local if
// it lands in this list, so the "verified Sumter County residents" line means
// something specific. Verify against the USPS ZIP lookup before launch; a wrong
// entry here inflates the one number the council will actually weigh.
export const SUMTER_ZIPS = new Set([
  '31709', // Americus -
  '31719', // Americus (PO boxes)-
  '31711', // Andersonville -
  '31735', // Cobb -
  '31743', // De Soto -
  '31764', // Leslie -
  '31780', // Plains -
  '31787', // Smithville
]);

export const TIERS = [
  {key: 'sumter', label: 'Verified Sumter County residents', short: 'Sumter County'},
  {key: 'georgia', label: 'Verified signatures elsewhere in Georgia', short: 'Elsewhere in Georgia'},
  {key: 'elsewhere', label: 'Verified signatures outside Georgia', short: 'Outside Georgia'},
];

export function tierFor({postalCode = '', state = ''}) {
  if (SUMTER_ZIPS.has(String(postalCode).trim().slice(0, 5))) return 'sumter';
  return String(state).trim().toUpperCase() === 'GA' ? 'georgia' : 'elsewhere';
}

// --- Field limits -----------------------------------------------------------
// Shared so the browser and the server enforce the same thing and the form can
// show the right maxlength without duplicating the numbers.
export const LIMITS = {name: 80, email: 160, city: 60, comment: 600};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// Returns {ok: true, value} or {ok: false, error}. Used by server.mjs on every
// submission; app.js relies on the server\'s answer rather than duplicating the
// rules, so there is exactly one place where a signature is judged valid.
export function validateSignature(input = {}) {
  const text = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit + 1);

  const name = text(input.name, LIMITS.name);
  if (name.length < 2 || name.length > LIMITS.name) return {ok: false, error: `Please enter your full name (up to ${LIMITS.name} characters).`};
  if (!/\p{L}/u.test(name)) return {ok: false, error: 'Please enter your full name.'};

  const email = text(input.email, LIMITS.email).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > LIMITS.email) return {ok: false, error: 'Please enter an email address we can send the confirmation to.'};

  const city = text(input.city, LIMITS.city);
  if (city.length < 2 || city.length > LIMITS.city) return {ok: false, error: 'Please enter your city or town.'};

  const state = text(input.state, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return {ok: false, error: 'Please enter a two-letter state, e.g. GA.'};

  const postalCode = text(input.postalCode, 10).replace(/\s/g, '');
  if (!/^\d{5}$/.test(postalCode)) return {ok: false, error: 'Please enter a five-digit ZIP code.'};

  const comment = text(input.comment, LIMITS.comment);
  if (comment.length > LIMITS.comment) return {ok: false, error: `Please keep the comment under ${LIMITS.comment} characters.`};

  if (input.consent !== true) return {ok: false, error: 'Please confirm you are a real person signing once.'};

  return {
    ok: true,
    value: {
      name, email, city, state, postalCode, comment,
      publicDisplay: input.publicDisplay === true,
      tier: tierFor({postalCode, state}),
    },
  };
}

// Deduplication key material. Plus-addressing and (on Google) dots route to the
// same inbox, so `ann.lee+petition@gmail.com` and `annlee@gmail.com` are one
// person for counting purposes. The address is still mailed exactly as typed.
export function normalizeEmail(email) {
  const [local, domain] = String(email).toLowerCase().trim().split('@');
  if (!domain) return String(email).toLowerCase().trim();
  let user = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') user = user.replace(/\./g, '');
  return `${user}@${domain}`;
}

export const normalizeIdentity = (name, postalCode) =>
  `${String(name).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')}|${String(postalCode).trim().slice(0, 5)}`;

// Mailbox providers that hand out throwaway addresses. Not a rejection: a
// signature from one is still counted once confirmed, but it is recorded as a
// flag so a reviewer can see it if the totals are ever challenged.
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com',
  'yopmail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com', 'sharklasers.com',
  'throwawaymail.com', 'getnada.com', 'dispostable.com', 'fakeinbox.com', 'maildrop.cc',
  'mohmal.com', 'moakt.com', 'emailondeck.com', 'mintemail.com', 'spamgourmet.com',
]);
