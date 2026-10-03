// Unit tests for the open-records rules in client/records.js: the file
// sniffer that decides what an upload really is, and the date arithmetic
// behind "overdue". No server needed.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  PUBLISHED_PATH, addBusinessDays, cleanFilename, createSniffer, dueDate, isOverdue, kindOf,
  validateRequest, validateUpdate,
} from '../client/records.js';

const ascii = (text) => Uint8Array.from(text, (char) => char.charCodeAt(0));
const utf16 = (text) => Uint8Array.from([...text].flatMap((char) => [char.charCodeAt(0), 0]));
const join = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
};

// Feeds a file through the sniffer in chunks of `size` bytes, the way the
// server sees it arrive, and returns the first error or ''.
function sniff(kind, data, size = 7) {
  const sniffer = createSniffer(kind);
  for (let at = 0; at < data.length; at += size) {
    const error = sniffer.push(data.subarray(at, at + size));
    if (error) return error;
  }
  return sniffer.finish();
}

const pdf = join(ascii('%PDF-1.7\n'), new Uint8Array(200).fill(0x41), ascii('%%EOF'));
const png = join(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), new Uint8Array(64));
const jpeg = join(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0), new Uint8Array(64));
const xlsx = join(ascii('PK\u0003\u0004'), new Uint8Array(30), ascii('[Content_Types].xml'), new Uint8Array(50), ascii('xl/workbook.xml'), new Uint8Array(30));
const xls = join(Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), new Uint8Array(100), utf16('Workbook'), new Uint8Array(40));
const windowsProgram = join(ascii('MZ'), new Uint8Array(200));

test('real files of each kind pass, at any chunk size', () => {
  for (const size of [1, 3, 7, 64, 100_000]) {
    assert.equal(sniff('pdf', pdf, size), '');
    assert.equal(sniff('png', png, size), '');
    assert.equal(sniff('jpeg', jpeg, size), '');
    assert.equal(sniff('xlsx', xlsx, size), '');
    assert.equal(sniff('xls', xls, size), '');
    assert.equal(sniff('csv', ascii('agency,date\r\nCity of Americus,2026-09-01\r\n'), size), '');
  }
});

test('a program renamed to .pdf is refused', () => {
  assert.match(sniff('pdf', windowsProgram), /not one/);
});

test('every kind refuses a file that is really another kind', () => {
  assert.match(sniff('pdf', png), /not one/);
  assert.match(sniff('png', pdf), /not one/);
  assert.match(sniff('jpeg', pdf), /not one/);
  assert.match(sniff('xlsx', pdf), /not one/);
  assert.match(sniff('xls', xlsx), /not one/);
  assert.match(sniff('csv', pdf), /not one|binary/);
  assert.match(sniff('csv', windowsProgram), /not one|binary/);
});

// A Word document is a ZIP too; only the workbook entries make it a spreadsheet.
test('a ZIP that is not a workbook is refused as .xlsx', () => {
  const docx = join(ascii('PK\u0003\u0004'), new Uint8Array(30), ascii('[Content_Types].xml'), ascii('word/document.xml'));
  assert.match(sniff('xlsx', docx), /not one/);
});

test('a macro module is refused, even split across chunks', () => {
  const xlsm = join(xlsx, ascii('xl/vbaProject.bin'), new Uint8Array(20));
  for (const size of [1, 5, 13, 4096]) assert.match(sniff('xlsx', xlsm, size), /macros/);
  const xlsWithVba = join(xls, utf16('_VBA_PROJECT'), new Uint8Array(20));
  for (const size of [1, 9, 4096]) assert.match(sniff('xls', xlsWithVba, size), /macros/);
});

test('a CSV with binary bytes in it is refused', () => {
  assert.match(sniff('csv', join(ascii('a,b\n'), Uint8Array.of(0x00, 0x01), ascii('c,d\n'))), /binary/);
});

test('empty and truncated files are refused', () => {
  assert.match(sniff('pdf', new Uint8Array(0)), /empty/);
  assert.match(sniff('png', Uint8Array.of(0x89, 0x50)), /too short/);
});

test('kind comes from the extension, case-insensitively', () => {
  assert.equal(kindOf('Minutes.PDF').kind, 'pdf');
  assert.equal(kindOf('scan.jpg').kind, 'jpeg');
  assert.equal(kindOf('budget.xlsx').kind, 'xlsx');
  assert.equal(kindOf('budget.xlsm'), null);
  assert.equal(kindOf('setup.exe'), null);
  assert.equal(kindOf('no-extension'), null);
});

test('filenames lose paths and control characters', () => {
  assert.equal(cleanFilename('C:\\Users\\me\\minutes.pdf'), 'minutes.pdf');
  assert.equal(cleanFilename('../../etc/passwd'), 'passwd');
  assert.equal(cleanFilename('a\u0000b\nc.pdf'), 'abc.pdf');
});

test('published paths are confined to research/records/', () => {
  assert.ok(PUBLISHED_PATH.test('research/records/2026-10-03-city-council-minutes.pdf'));
  assert.ok(PUBLISHED_PATH.test('research/records/2026-10-03-budget.csv'));
  for (const bad of ['research/records/../server.env', 'research/02-water.md', 'research/records/Minutes.pdf', 'research/records/x.xlsx', '/research/records/x.pdf']) {
    assert.ok(!PUBLISHED_PATH.test(bad), bad);
  }
});

test('three business days skip the weekend', () => {
  assert.equal(addBusinessDays('2026-09-28', 3), '2026-10-01'); // Monday → Thursday
  assert.equal(addBusinessDays('2026-10-01', 3), '2026-10-06'); // Thursday → Tuesday
  assert.equal(addBusinessDays('2026-10-03', 3), '2026-10-07'); // Saturday → Wednesday
  assert.equal(dueDate('2026-10-02'), '2026-10-07');             // Friday → Wednesday
});

test('a pending request is overdue only after its third business day', () => {
  const request = {status: 'pending', sentOn: '2026-09-28'};
  assert.equal(isOverdue(request, '2026-10-01'), false);
  assert.equal(isOverdue(request, '2026-10-02'), true);
  assert.equal(isOverdue({...request, status: 'fulfilled'}, '2026-12-01'), false);
});

const good = {requesterName: 'Katie Smith', agency: 'City of Americus', custodian: '', description: 'Minutes and audio of the August 20 council meeting.', sentOn: '2026-09-01'};

test('a complete request validates', () => {
  const {value, error} = validateRequest(good, '2026-10-03');
  assert.equal(error, undefined);
  assert.equal(value.custodian, null);
});

// The requests residents filed before the log existed.
test('a past request can be logged with its answer already known', () => {
  const {value} = validateRequest({...good, sentOn: '2026-07-10', status: 'fulfilled', fulfilledOn: '2026-07-15'}, '2026-10-03');
  assert.equal(value.status, 'fulfilled');
  assert.equal(value.fulfilledOn, '2026-07-15');
  assert.equal(validateRequest(good, '2026-10-03').value.status, 'pending');
  assert.match(validateRequest({...good, status: 'fulfilled'}, '2026-10-03').error, /date answered/);
  assert.match(validateRequest({...good, sentOn: '2026-07-10', status: 'denied', fulfilledOn: '2026-07-01'}, '2026-10-03').error, /predate/);
});

test('a request needs a real name, not an email address', () => {
  assert.match(validateRequest({...good, requesterName: ''}, '2026-10-03').error, /name/);
  assert.match(validateRequest({...good, requesterName: 'katie@example.com'}, '2026-10-03').error, /email/);
});

test('request dates must be real and not in the future', () => {
  assert.match(validateRequest({...good, sentOn: '2026-10-04'}, '2026-10-03').error, /future/);
  assert.match(validateRequest({...good, sentOn: '2026-02-30'}, '2026-10-03').error, /date/);
  assert.match(validateRequest({...good, sentOn: 'yesterday'}, '2026-10-03').error, /date/);
});

test('an answer needs a date no earlier than the request', () => {
  const request = {sentOn: '2026-09-01'};
  assert.match(validateUpdate({status: 'fulfilled'}, request, '2026-10-03').error, /date/);
  assert.match(validateUpdate({status: 'fulfilled', fulfilledOn: '2026-08-31'}, request, '2026-10-03').error, /predate/);
  assert.equal(validateUpdate({status: 'fulfilled', fulfilledOn: '2026-09-04'}, request, '2026-10-03').value.denialCitation, null);
  assert.equal(validateUpdate({status: 'denied', fulfilledOn: '2026-09-04', denialCitation: '§ 50-18-72(a)(34)'}, request, '2026-10-03').value.denialCitation, '§ 50-18-72(a)(34)');
  assert.equal(validateUpdate({status: 'withdrawn'}, request, '2026-10-03').value.fulfilledOn, null);
  assert.match(validateUpdate({status: 'lost'}, request, '2026-10-03').error, /Status/);
});
