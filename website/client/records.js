// The open-records request log: the rules shared by the browser (app.js) and
// the API (server.mjs). Like petition.js it must stay free of DOM and Node
// globals so both can import it, and so the tests can exercise it directly.
//
// Why the log exists: a resident who wants the minutes of a council meeting
// should be able to see that a neighbor already asked for them, and when, and
// whether the city answered, instead of filing the same request a second time.

// What a request can be. `pending` is the only open state; the rest are what
// the agency did, or that the requester gave up.
export const STATUSES = {
  pending: 'Pending',
  fulfilled: 'Fulfilled',
  partial: 'Partly denied',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

// Uploads only make sense once the agency has handed something over.
export const UPLOADABLE = new Set(['fulfilled', 'partial']);

// Suggestions for the agency field, as research/11-open-government.md names
// the bodies that matter here. Free text is still accepted.
export const AGENCIES = [
  'City of Americus',
  'Americus City Council',
  'Americus Planning & Zoning',
  'Americus water and utility departments',
  'Sumter County',
  'Sumter County Board of Commissioners',
  'Sumter County Development Authority',
];

export const LIMITS = {name: 80, agency: 120, custodian: 120, description: 2000, citation: 200, note: 500};

// § 50-18-71(b)(1)(A): records, or a timetable for them, within three business
// days of receipt. Weekends are skipped; state holidays are not, so a request
// sent before a holiday shows overdue a day early. That errs toward asking.
export const RESPONSE_BUSINESS_DAYS = 3;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Today in Americus, as YYYY-MM-DD. A UTC date flips to tomorrow at 8 p.m.
// Eastern, which would mark requests overdue an evening early.
export const todayInAmericus = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'}).format(now);

const parseIso = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const formatIso = (date) => date.toISOString().slice(0, 10);

export function addBusinessDays(iso, days) {
  const date = parseIso(iso);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return formatIso(date);
}

export const dueDate = (sentOn) => addBusinessDays(sentOn, RESPONSE_BUSINESS_DAYS);

// Overdue the day after the due date: the agency has all of the third day.
export const isOverdue = (request, today = todayInAmericus()) =>
  request.status === 'pending' && today > dueDate(request.sentOn);

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max + 1);

function validDate(value, {today, label}) {
  if (!ISO_DATE.test(value) || formatIso(parseIso(value)) !== value) return `${label} must be a date.`;
  if (value > today) return `${label} cannot be in the future.`;
  if (value < '2000-01-01') return `${label} looks wrong.`;
  return '';
}

// A new request. Returns {value} or {error}. A request filed months ago can be
// logged with its outcome already known, so the log can carry the requests
// residents made before it existed: status, answer date and citation are
// optional here and validated by the same rules as a later update.
export function validateRequest(input, today = todayInAmericus()) {
  const value = {
    requesterName: clean(input.requesterName, LIMITS.name),
    agency: clean(input.agency, LIMITS.agency),
    custodian: clean(input.custodian, LIMITS.custodian) || null,
    // Newlines are worth keeping in a description; other control characters are not.
    description: String(input.description ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, LIMITS.description + 1),
    sentOn: String(input.sentOn ?? '').trim(),
  };
  if (!value.requesterName) return {error: 'Your name is required: it is how neighbors find you.'};
  if (value.requesterName.length > LIMITS.name) return {error: `Name must be at most ${LIMITS.name} characters.`};
  // The name is published. An address typed into it would be too.
  if (/@/.test(value.requesterName)) return {error: 'Use your name, not an email address. It is shown publicly.'};
  if (!value.agency) return {error: 'Which agency did you send it to?'};
  if (value.agency.length > LIMITS.agency) return {error: `Agency must be at most ${LIMITS.agency} characters.`};
  if (value.custodian && value.custodian.length > LIMITS.custodian) return {error: `Custodian must be at most ${LIMITS.custodian} characters.`};
  if (value.description.length < 10) return {error: 'Describe what you asked for, in a sentence or two.'};
  if (value.description.length > LIMITS.description) return {error: `Description must be at most ${LIMITS.description} characters.`};
  const dateError = validDate(value.sentOn, {today, label: 'The date sent'});
  if (dateError) return {error: dateError};
  const outcome = validateUpdate({status: input.status || 'pending', fulfilledOn: input.fulfilledOn, denialCitation: input.denialCitation}, value, today);
  if (outcome.error) return {error: outcome.error};
  return {value: {...value, ...outcome.value}};
}

// A status change on an existing request. Returns {value} or {error}.
export function validateUpdate(input, request, today = todayInAmericus()) {
  const status = String(input.status ?? '');
  if (!Object.hasOwn(STATUSES, status)) return {error: `Status must be one of: ${Object.keys(STATUSES).join(', ')}.`};
  const answered = status === 'fulfilled' || status === 'partial' || status === 'denied';
  const value = {
    status,
    fulfilledOn: answered ? String(input.fulfilledOn ?? '').trim() : null,
    denialCitation: status === 'partial' || status === 'denied' ? clean(input.denialCitation, LIMITS.citation) || null : null,
  };
  if (answered) {
    const dateError = validDate(value.fulfilledOn, {today, label: 'The date answered'});
    if (dateError) return {error: dateError};
    if (value.fulfilledOn < request.sentOn) return {error: 'The answer cannot predate the request.'};
  }
  if (value.denialCitation && value.denialCitation.length > LIMITS.citation) return {error: `Citation must be at most ${LIMITS.citation} characters.`};
  return {value};
}

// --- Uploads -----------------------------------------------------------------

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const USER_QUOTA_BYTES = 500 * 1024 * 1024;

// Extension → kind. The extension only says what the file claims to be; the
// sniffer below decides whether it is.
export const FILE_KINDS = {
  pdf: {kind: 'pdf', mime: 'application/pdf'},
  png: {kind: 'png', mime: 'image/png'},
  jpg: {kind: 'jpeg', mime: 'image/jpeg'},
  jpeg: {kind: 'jpeg', mime: 'image/jpeg'},
  xlsx: {kind: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
  xls: {kind: 'xls', mime: 'application/vnd.ms-excel'},
  csv: {kind: 'csv', mime: 'text/csv'},
};
export const ACCEPT = Object.keys(FILE_KINDS).map((ext) => `.${ext}`).join(',');

export const kindOf = (filename) => FILE_KINDS[String(filename).toLowerCase().split('.').pop()] || null;

// The name as the reviewer will see it: no path, no control characters.
export const cleanFilename = (name) => String(name ?? '').split(/[\\/]/).pop()
  .replace(/[\u0000-\u001f\u007f]+/g, '').trim().slice(0, 200);

// Where a published, redacted copy may live. Lowercase, dated, under the
// records folder, and one of the formats the redaction step produces.
export const PUBLISHED_PATH = /^research\/records\/[a-z0-9][a-z0-9-]{0,120}\.(pdf|csv|png|jpg)$/;

const bytes = (text) => Uint8Array.from(text, (char) => char.charCodeAt(0));
const utf16 = (text) => Uint8Array.from([...text].flatMap((char) => [char.charCodeAt(0), 0]));

const MAGIC = {
  pdf: bytes('%PDF-'),
  png: Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  jpeg: Uint8Array.of(0xff, 0xd8, 0xff),
  xlsx: bytes('PK\u0003\u0004'),
  xls: Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
};

// Byte strings looked for anywhere in the file. ZIP entry names are never
// compressed, so an .xlsx carrying a macro module names xl/vbaProject.bin in
// plain bytes; an .xls stores its stream names in UTF-16.
const MARKERS = {
  xlsx: {required: [bytes('[Content_Types].xml'), bytes('xl/workbook')], forbidden: [bytes('vbaProject')]},
  // Excel 4.0 macro sheets in an .xls have no stream of their own to find, so
  // they get through this check. The reviewer never opens an .xls in Excel:
  // it is parsed by script, which runs nothing.
  xls: {required: [utf16('Workbook')], forbidden: [utf16('_VBA_PROJECT')]},
};

const startsWith = (data, prefix) => data.length >= prefix.length && prefix.every((byte, index) => data[index] === byte);

// Native search for the first byte, then a short compare: fast enough to scan
// a 50 MB upload on a small server without pulling in Node's Buffer.
function indexOf(haystack, needle) {
  const last = haystack.length - needle.length;
  for (let index = haystack.indexOf(needle[0]); index !== -1 && index <= last; index = haystack.indexOf(needle[0], index + 1)) {
    let offset = 1;
    while (offset < needle.length && haystack[index + offset] === needle[offset]) offset += 1;
    if (offset === needle.length) return index;
  }
  return -1;
}

// Checks a file as it streams past, chunk by chunk, so the server never has to
// hold a whole upload in memory. push() returns an error message the moment the
// file is known to be bad; finish() returns one if the file ended without
// proving it is what it claims to be. Both return '' when all is well.
export function createSniffer(kind) {
  let head = new Uint8Array(0);
  let headChecked = false;
  let size = 0;
  const markers = MARKERS[kind] || {required: [], forbidden: []};
  const found = new Set();
  const overlap = Math.max(0, ...[...markers.required, ...markers.forbidden].map((needle) => needle.length)) - 1;
  let tail = new Uint8Array(0);

  const claimed = {pdf: 'a PDF', png: 'a PNG image', jpeg: 'a JPEG image', xlsx: 'an Excel workbook', xls: 'an Excel workbook', csv: 'a CSV file'}[kind];

  function push(chunk) {
    const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    size += data.length;

    if (!headChecked) {
      const merged = new Uint8Array(head.length + data.length);
      merged.set(head); merged.set(data, head.length);
      head = merged.subarray(0, 16);
      const magic = MAGIC[kind];
      if (magic && head.length >= magic.length) {
        if (!startsWith(head, magic)) return `This file is named as ${claimed} but is not one.`;
        headChecked = true;
      }
      if (!magic && head.length >= 4) {
        // A CSV is text: anything opening with a known binary signature is not one.
        if (Object.values(MAGIC).some((signature) => startsWith(head, signature.subarray(0, 4))) || startsWith(head, bytes('MZ'))) {
          return 'This file is named as a CSV file but is not one.';
        }
        headChecked = true;
      }
    }

    if (kind === 'csv') {
      // Text only: tab, newline, form feed, carriage return, DOS end-of-file,
      // and printable bytes. Any other control byte means binary.
      for (const byte of data) {
        if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d && byte !== 0x1a) {
          return 'This file is named as a CSV file but contains binary data.';
        }
      }
    }

    if (overlap >= 0 && (markers.required.length || markers.forbidden.length)) {
      const window = new Uint8Array(tail.length + data.length);
      window.set(tail); window.set(data, tail.length);
      for (const needle of markers.forbidden) {
        if (indexOf(window, needle) !== -1) return 'This spreadsheet contains macros, which the desk does not accept. Save it as .xlsx without macros, or as .csv.';
      }
      markers.required.forEach((needle, index) => { if (!found.has(index) && indexOf(window, needle) !== -1) found.add(index); });
      tail = window.slice(Math.max(0, window.length - overlap));
    }
    return '';
  }

  function finish() {
    if (!size) return 'The file is empty.';
    if (!headChecked) return `This file is too short to be ${claimed}.`;
    if (found.size !== markers.required.length) return `This file is named as ${claimed} but is not one.`;
    return '';
  }

  return {push, finish};
}
