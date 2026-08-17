// Cloudflare Email Worker: fans contact@scc4t.com out to both organizers.
//
// Email Routing maps one custom address to one destination address, and the
// group address has to reach two people. Forwarding more than once from a
// Worker is the supported way to do that.
//
// The addresses are NOT in this file. They live in the FORWARD_TO Worker
// variable, because this repository is public and the whole point of a group
// address is that no organizer's personal mailbox ends up on a page, or in a
// source file, that a scraper reads.
//
// Every address in FORWARD_TO must first be a verified *destination address*
// in Email Routing (Email → Email Routing → Destination addresses). Forwarding
// to an unverified address throws.
//
// Deploy: wrangler deploy, or paste this into the dashboard's Worker editor.

export default {
  async email(message, env) {
    const targets = String(env.FORWARD_TO || '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);

    // Misconfiguration is not the sender's fault, but silently accepting mail
    // nobody will ever read is worse than bouncing it: a bounce tells them to
    // find another way in, and a neighbor with something to report is exactly
    // the message that must not vanish.
    if (!targets.length) {
      console.error('FORWARD_TO is empty: no organizer addresses configured');
      message.setReject('This address is not accepting mail right now');
      return;
    }

    // Settled independently: one organizer's mailbox bouncing, or being
    // unverified, must not swallow the message for the other.
    const results = await Promise.allSettled(targets.map((to) => message.forward(to)));

    // Logged on the way through, not just on failure: a worker that only
    // speaks up when something breaks is indistinguishable from one that was
    // never invoked, and "no output" is the first thing anyone checks.
    const failed = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') failed.push(`${targets[index]} (${result.reason})`);
    });
    console.log(`mail from ${message.from} to ${message.to}: ${results.length - failed.length}/${results.length} forwarded`);
    if (failed.length) console.error(`failed: ${failed.join('; ')}`);

    // Only reject when nobody got it. A partial delivery is a problem for the
    // logs to report, not a reason to bounce mail that did reach someone.
    if (results.every((result) => result.status === 'rejected')) {
      message.setReject('Unable to deliver to any organizer mailbox');
    }
  },
};
