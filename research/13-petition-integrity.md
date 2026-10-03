# How the petition is verified

The [petition on this site](/petition/) asks the city and county to adopt the drafted [joint moratorium resolution](/research/moratorium-resolution.pdf): an 18-month pause on data-center zoning, permitting and construction while both governments write an ordinance. This note documents how the Sumter Field Desk processes each signature, what it publishes, what it keeps private and the limits of its verification.

## Counting rule

**No online signature is counted until the signer opens a link sent to the email address provided.**

## What happens to a signature

1. **The form is submitted.** Name, email, city, state, ZIP, and an optional comment. Nothing is counted at this point and no number on the site moves.
2. **An automated-abuse check runs.** The form uses Cloudflare Turnstile, and the result is validated on the server. A token rejected by Cloudflare is refused. If the check cannot run because no token reaches the server, the submission may be stored with an `unverified` flag for organizer review and is still subject to email confirmation. The site can be configured to refuse those submissions as well.
3. **A confirmation email goes out** containing a single-use link that expires in 24 hours. The link is stored only as a hash, so nobody with access to the database can use it to confirm a signature that isn't theirs.
4. **The signature is counted only when that link is opened.** The link works once. Opening it a second time does nothing.
5. **The published totals are recalculated** from confirmed signatures only.

A signature can be withdrawn at any time from a second link in that same email. A withdrawn signature disappears from every published total immediately.

## One person, one signature

Duplicate prevention is enforced by the database, not by application code: a unique constraint on the mailbox means two submissions of the same address cannot both succeed, even if they arrive at the same instant. Addresses are compared after normalisation, so `ann.lee+petition@gmail.com` and `annlee@gmail.com` reach one inbox and count once.

The mailbox is stored for comparison as a keyed hash (HMAC-SHA256 under a secret held only on the server), not as plain text, so a copy of the signature table on its own does not reveal who signed.

Name-and-ZIP combinations that repeat are **flagged for a human to look at, never auto-rejected**. Two real people in one household genuinely can share a surname and a postal code.

## Rate limits

Submissions are limited per network and per mailbox. The limits allow for shared connections at libraries, schools, workplaces, churches and mobile carriers. A signer who reaches a limit is asked to wait or use the paper copy.

## What is recorded but not acted on

Each signature may carry review flags for a disposable email domain, repeated household name or completed hidden field. The first two are **recorded for review and do not automatically reject a signature**.

Signatures caught by the hidden-field check are recorded as rejected and never counted. Submissions that fail the Cloudflare check are refused before anything is stored at all.

## Signing on paper

Paper signatures are entered by a named organizer, marked as paper and reported separately from email-confirmed signatures because the two methods provide different evidence.

[the signed paper sheets](/research/petition-signatures-redacted.pdf) (PDF, 31 pages). 

## What is published and what is not

Published:

- Confirmed signatures broken out as **Sumter County residents**, **elsewhere in Georgia**, and **outside Georgia**, never merged into a single headline number.
- Signatures collected on paper, on their own line.
- The number of submissions still waiting on an unopened confirmation email.
- Name, town and comment **only for signers who ticked the box asking to be listed**. Signing without being listed counts exactly the same.

Never published, and never released:

- Email addresses.
- ZIP codes tied to individuals.
- IP addresses. Only a hashed network prefix (a /24 or /48, not the address) is stored at all.
- Internal review flags for any individual signature.

The full list with contact details is not posted publicly. It can be produced for an authorized recipient (the City Council or the City Clerk, the Board of Commissioners or the County Clerk) under controlled conditions, on request from the organizers. The same list goes to both: this is one petition presented to two governing bodies, not two collections of signatures.

## Making the totals checkable later

Periodically the desk records an **audit snapshot**: the totals at that moment, the number of rows behind them, and a SHA-256 hash of a canonical export of the confirmed signatures. Each snapshot also records the hash of the one before it, forming a chain. Anyone holding an earlier published snapshot can therefore detect a later silent edit to the signature list. The snapshot log is public at [`/api/petition/moratorium/snapshots`](/api/petition/moratorium/snapshots).

## What this does not prove

The system has these limits:

- **Email confirmation is not identity verification.** It proves control of an email address. It does not prove the signer's name or residence. A person with several mailboxes can sign more than once, and locality is based on the ZIP the signer provides.
- **It is not a legal instrument.** Signing here is a public expression of support. If Georgia law or the Americus zoning code provides for a formal protest petition, which typically requires wet signatures from property owners of record within a set distance, that is a separate process with separate requirements, and an online form does not satisfy it. Whether either government has such a procedure is an open question this desk has not settled; the [records note](11-open-government.md) explains how to ask for the answer in writing.
- **Turnstile cannot stop every bot.** It raises the cost of automation and works alongside email confirmation, rate limits, duplicate checks and organizer review.
- **The desk can be wrong.** If you believe a signature is fraudulent, including one in your own name that you did not put there, write to the organizers at contact@scc4t.com, or through the [contact page](/contact/), and it will be removed and the totals corrected in public.

## Corrections

This page and the code it describes are versioned in the same repository. The page should be corrected whenever it no longer matches the system's behavior.
