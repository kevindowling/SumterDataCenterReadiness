// Unit tests for the editorial rules in client/editorials.js: what a writer
// may save, how a slug is made, and that the body renderer never lets markup
// through. No server needed.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {editorialBody, editorialSummary, slugify, validateEditorial} from '../client/editorials.js';

const today = '2026-11-02';
const good = {title: 'No Rezoning Without a Development Plan', kind: 'letter', byline: 'Kirk Lyman-Barner, Co-Chair', body: 'One.\nTwo.', status: 'published'};

test('a published piece without a date is dated today', () => {
  const {value, error} = validateEditorial(good, today);
  assert.equal(error, undefined);
  assert.equal(value.publishedOn, today);
});

test('a draft keeps no date until it is given one', () => {
  assert.equal(validateEditorial({...good, status: 'draft'}, today).value.publishedOn, null);
});

test('refuses what a piece cannot be', () => {
  for (const [input, pattern] of [
    [{...good, title: ' '}, /headline/],
    [{...good, kind: 'ad'}, /kind/],
    [{...good, byline: ''}, /byline/i],
    [{...good, body: '  \n '}, /no text/],
    [{...good, status: 'live'}, /draft or published/],
    [{...good, publishedOn: '2026-13-40'}, /must be a date/],
    [{...good, publishedOn: '2026-11-03'}, /future/],
    [{...good, body: 'x'.repeat(20001)}, /at most/],
  ]) assert.match(validateEditorial(input, today).error, pattern, JSON.stringify(input).slice(0, 80));
});

test('Windows line endings from a Word paste become plain ones', () => {
  assert.equal(validateEditorial({...good, body: 'One.\r\nTwo.\r\n'}, today).value.body, 'One.\nTwo.');
});

test('slugs are readable, ASCII, and start with a letter', () => {
  assert.equal(slugify('No Rezoning Without a Development Plan'), 'no-rezoning-without-a-development-plan');
  assert.equal(slugify('Citizens’ Voices Matter!'), 'citizens-voices-matter');
  assert.equal(slugify('2026: The Year'), 'editorial-2026-the-year');
  assert.equal(slugify('???'), 'editorial-untitled');
  assert.ok(slugify('a'.repeat(200)).length <= 80);
});

test('the body renderer escapes markup and keeps only its own marks', () => {
  const html = editorialBody('<script>alert(1)</script>\n## Why\n> Pull quote\n**bold** and *italic* [source](https://example.com/x) [bad](javascript:alert(1))');
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<h2>Why<\/h2>/);
  assert.match(html, /<blockquote>Pull quote<\/blockquote>/);
  assert.match(html, /<strong>bold<\/strong> and <em>italic<\/em>/);
  assert.match(html, /<a href="https:\/\/example.com\/x" target="_blank" rel="noopener">source<\/a>/);
  assert.doesNotMatch(html, /href="javascript/);
});

test('each pasted line is its own paragraph', () => {
  assert.equal(editorialBody('One.\n\n\nTwo.'), '<p>One.</p><p>Two.</p>');
});

test('the summary falls back to the opening paragraph, cut at a word', () => {
  assert.equal(editorialSummary({summary: 'Given.', body: 'Ignored.'}), 'Given.');
  assert.equal(editorialSummary({body: '## Head\nFirst words here.\nSecond.'}), 'First words here.');
  assert.equal(editorialSummary({body: 'one two three four'}, 10), 'one two…');
});
