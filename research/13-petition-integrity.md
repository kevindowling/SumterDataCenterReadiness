# How the petition is verified

A petition is only worth delivering if the people receiving it believe the names on it. The petition is [on this site](/petition/), and what it asks for is the [joint moratorium resolution](/research/moratorium-resolution.pdf) as drafted: an 18-month pause on data-center zoning, permitting and construction in both the city and the county, and time to write the ordinance neither government has. This note describes exactly what the Sumter Field Desk does to every signature, what it publishes, what it keeps private, and what it cannot promise. It is written so that anyone, whether a resident, a council member, or someone who disagrees with the petition, can check the claims rather than take them on trust.

## The one-line version

**No signature is counted until the person opens a link sent to their own email address.** Everything else on this page supports that rule or reports what it could not catch.

## What happens to a signature

1. **The form is submitted.** Name, email, city, state, ZIP, and an optional comment. Nothing is counted at this point and no number on the site moves.
2. **An automated-abuse check runs.** The form uses Cloudflare Turnstile, and the result is validated on the server. A token that only looks valid in the browser does not pass. A submission is refused outright unless Cloudflare confirms the check succeeded, and the refusal says so on screen rather than failing silently. Because the check must succeed, a Cloudflare outage will temporarily stop online signing; the paper copy is unaffected.
3. **A confirmation email goes out** containing a single-use link that expires in 24 hours. The link is stored only as a hash, so nobody with access to the database can use it to confirm a signature that isn't theirs.
4. **The signature is counted only when that link is opened.** The link works once. Opening it a second time does nothing.
5. **The published totals are recalculated** from confirmed signatures only.

A signature can be withdrawn at any time from a second link in that same email. A withdrawn signature disappears from every published total immediately.

## One person, one signature

Duplicate prevention is enforced by the database, not by application code: a unique constraint on the mailbox means two submissions of the same address cannot both succeed, even if they arrive at the same instant. Addresses are compared after normalisation, so `ann.lee+petition@gmail.com` and `annlee@gmail.com` reach one inbox and count once.

The mailbox is stored for comparison as a keyed hash (HMAC-SHA256 under a secret held only on the server), not as plain text, so a copy of the signature table on its own does not reveal who signed.

Name-and-ZIP combinations that repeat are **flagged for a human to look at, never auto-rejected**. Two real people in one household genuinely can share a surname and a postal code.

## Rate limits, and who they are not aimed at

Submissions are limited per network and per mailbox. The limits are deliberately loose, because a library, a school, a workplace, a church hall and a mobile carrier all put many real people behind one address, and the residents nearest the proposed site are the likeliest to be sharing a connection. Hitting a limit produces a message asking the signer to wait a few minutes or sign the paper copy. It is never a silent rejection.

## What is recorded but not acted on

Each signature carries a short list of review flags: a throwaway-mail domain, a repeated household name, an entry that tripped a hidden field no human can see. These are **recorded for review, not used to reject anyone automatically**. Dropping a real resident's signature is a worse failure than counting a doubtful one and removing it later.

Signatures caught by the hidden-field check are recorded as rejected and never counted. Submissions that fail the Cloudflare check are refused before anything is stored at all.

## Signing on paper

Paper signatures collected in person are counted the same as online ones and are reported on their own line. They are keyed in by a named organizer and marked as paper, because "an organizer watched this person sign" and "this person opened a link in their own mailbox" are different kinds of evidence, and a total that merges them is quietly overstating one of them.

The sheets themselves are published, so that line can be checked rather than trusted: [the signed paper sheets](/research/petition-signatures-redacted.pdf) (PDF, 18 pages). Street addresses are painted out; names, signatures, town, ZIP, and the circulator who certified each page are as signed.

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

Being straight about the limits is part of the point:

- **This is not identity verification.** It proves control of an email address, not that the person is who they say they are, and not that they live where they say they live. A determined person with several mailboxes can sign more than once. The tiering by ZIP is self-reported.
- **It is not a legal instrument.** Signing here is a public expression of support. If Georgia law or the Americus zoning code provides for a formal protest petition, which typically requires wet signatures from property owners of record within a set distance, that is a separate process with separate requirements, and an online form does not satisfy it. Whether either government has such a procedure is an open question this desk has not settled; the [records note](11-open-government.md) explains how to ask for the answer in writing.
- **Turnstile is not a bot guarantee.** It raises the cost of automation; it does not end it. That is why it is one control among several and not the one the count rests on.
- **The desk can be wrong.** If you believe a signature is fraudulent, including one in your own name that you did not put there, write to the organizers at contact@scc4t.com, or through the [contact page](/contact/), and it will be removed and the totals corrected in public.

## Corrections

If any statement on this page stops being true of what the site actually does, the page is wrong and should be fixed. It is versioned in the same repository as the code it describes, so the two can be compared.
