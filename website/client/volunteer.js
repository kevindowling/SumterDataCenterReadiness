// The volunteer sign-up: the rules shared by the browser (app.js) and the API
// (server.mjs). Like petition.js it must stay free of DOM and Node globals so
// both can import it, and so the tests can exercise it directly.
//
// Nothing a volunteer types is published. It is stored for the organizers,
// listed on the organizer-only /volunteers/ page, and emailed to the group's
// address so a sign-up is seen the day it arrives.

// What a volunteer can offer. Keys are stored; labels can be reworded freely.
export const INTERESTS = {
  meetings: 'Attend city and county meetings',
  speak: 'Speak during public comment',
  research: 'Read documents and research',
  records: 'File open-records requests',
  outreach: 'Petition tables, flyers and door-knocking',
  events: 'Help run our meetings and events',
  online: 'Writing, social media or the website',
};

export const LIMITS = {name: 80, email: 160, phone: 30, message: 1000};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1);

// Returns {value} or {error}.
export function validateVolunteer(input) {
  const value = {
    name: clean(input.name, LIMITS.name),
    email: clean(input.email, LIMITS.email).toLowerCase(),
    phone: clean(input.phone, LIMITS.phone) || null,
    interests: [...new Set([].concat(input.interests ?? []).map(String))],
    // Newlines are worth keeping in a message; other control characters are not.
    message: String(input.message ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, LIMITS.message + 1) || null,
  };
  if (value.name.length < 2) return {error: 'Please tell us your name.'};
  if (value.name.length > LIMITS.name) return {error: `Name must be at most ${LIMITS.name} characters.`};
  if (!EMAIL_PATTERN.test(value.email) || value.email.length > LIMITS.email) return {error: 'Please enter an email address we can reach you at.'};
  if (value.phone && (value.phone.length > LIMITS.phone || !/^[0-9()+.\- ext]+$/i.test(value.phone))) return {error: 'That phone number does not look right. Leave it blank if you prefer email.'};
  if (value.interests.some((key) => !Object.hasOwn(INTERESTS, key))) return {error: 'Unknown volunteer option.'};
  if (value.message && value.message.length > LIMITS.message) return {error: `Message must be at most ${LIMITS.message} characters.`};
  if (!value.interests.length && !value.message) return {error: 'Tick at least one way you would like to help, or tell us in the message box.'};
  return {value};
}
