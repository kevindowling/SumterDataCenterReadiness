// The public meeting calendar — the data, and nothing else.
//
// The point of this site is that decisions about the data center get made in
// rooms residents are allowed to sit in. This file is the list of those rooms
// and when they are open. It is the one file you edit to refresh the calendar.
// Everything that formats, sorts or date-maths this list lives next door in
// meetings.js, which is where a bug lives and where this file is validated on
// load. Keeping them apart is the point: adding a meeting should not mean
// reading two hundred lines of timezone arithmetic first.
//
// Every date here was read off the body's own posted calendar and checked in
// by hand, with the source recorded beside it. Nothing is computed from a rule
// like "third Tuesday". The rules are real — the county publishes one — but
// they are not reliable: the city's September 2026 meetings fall on the third
// and fourth Thursday, while February's and March's fell on the second and
// third. Publishing a computed date as though it were confirmed would send
// somebody to a locked building, which is the exact failure this site exists
// to prevent.
//
// Refreshing this list is a manual chore, by design. STALE_AFTER below is the
// date past which the calendar admits it may be out of date rather than
// quietly showing an empty month.
//
// TO ADD A MEETING: append an official(...) line to MEETING_ROWS at the bottom
// in date order, then move CONFIRMED_ON to the day you checked. The arguments
// are date, body, what the body calls the meeting, and whether that body has
// published its public-comment rules ('published' or 'unknown' — say 'unknown'
// unless you have read the rules yourself). A meeting at other than 6:00 p.m.
// takes a fifth argument in 24-hour time. Trailing commas are fine. If you get
// something wrong, the build fails and tells you which line — it will not
// quietly publish a half-formed meeting.

// The bodies that decide, and how a resident actually reaches them.
export const BODIES = {
  commission: {
    name: 'Sumter County Board of Commissioners',
    short: 'County commission',
    venue: '500 West Lamar Street',
    address: 'Americus, GA 31709',
    phone: '(229) 928-4500',
    rhythm: 'Work session the second Tuesday of the month; regular meeting the third Tuesday. Both at 6:00 p.m.',
    calendar: 'https://www.sumtercountyga.us/calendar.aspx',
    agendas: 'https://www.sumtercountyga.us/agendacenter',
    remote: 'The county offers Zoom attendance.',
  },
  council: {
    name: 'Americus Mayor and City Council',
    short: 'City council',
    venue: 'Council Chambers, Russell Thomas Jr. Public Safety Building',
    address: '119 South Lee Street, Americus, GA 31709',
    phone: '(229) 924-4411',
    rhythm: 'An agenda-setting meeting and a council meeting each month, both at 6:00 p.m. The weeks move — check the date.',
    calendar: 'https://americuscityga.iqm2.com/Citizens/Calendar.aspx',
    agendas: 'https://americuscityga.iqm2.com/Citizens/Calendar.aspx',
    remote: 'The city offers a teleconference option.',
  },
  // The authority that would actually do a data-center deal — bonds, a PILOT,
  // an abatement — and the only body here with no standing schedule. It posts
  // one date at a time, so an empty stretch on this calendar means nothing has
  // been posted, not that nothing is happening. Watch its calendar directly.
  //
  // It posts the room per date rather than as a standing venue, so the default
  // here says so and an individual meeting overrides it once the room appears
  // on the posting. The office address is where to phone or write, not a
  // promise that the meeting is held there.
  authority: {
    name: 'Sumter County Development Authority',
    short: 'Development Authority',
    venue: 'Location not posted',
    venuePosted: false,
    address: 'Office: Rees Park Economic Development Center, 409 Elm Avenue, Americus, GA 31709',
    phone: '(229) 924-7007',
    rhythm: 'No standing schedule is published. Individual dates appear on the authority\'s calendar, sometimes only days ahead.',
    calendar: 'https://www.selectsumter.com/resources-incentives/calendar',
    agendas: 'https://www.selectsumter.com/resources-incentives/calendar',
  },
  citizens: {
    name: 'Sumter County Citizens for Transparency',
    short: 'Community meeting',
    venue: 'Lake Blackshear Regional Library',
    address: '307 East Lamar St., Americus, GA 31709',
  },
};

// How public comment works, per body. `published` means the body has posted
// its rules and they are quoted here. `unknown` means it has not, which is a
// finding rather than a blank: it is a question worth asking before you go,
// and the phone number to ask it with is right there.
export const COMMENT = {
  published: {
    label: 'You can speak here',
    limit: 'Five speakers per meeting, five minutes each.',
    signup: 'The sign-up sheet opens 30 minutes before the meeting starts.',
    how: 'Call City Clerk Sierra Harvey at (229) 924-4411 ext. 244 on the day of the meeting, or sign up in person at the Council Chambers beforehand.',
    caution: 'Time may not be yielded to another speaker, and the five minutes may not be exceeded. With only five slots, arriving at 6:00 is arriving too late.',
  },
  unknown: {
    label: 'Public comment not confirmed',
    body: 'This body has not published how public comment works at this meeting. The meeting is open to the public either way — Georgia law requires that — but whether you may address it, and how to get on the list, is unconfirmed.',
  },
};

// Confirmed against each body's posted calendar on this date. Shown to the
// reader so the claim "confirmed" carries its own expiry.
export const CONFIRMED_ON = '2026-08-05';

// After this the calendar stops presenting itself as current. Set to the last
// month actually checked; a reader in January should be told to look at the
// county and city calendars rather than trust a page nobody has refreshed.
export const STALE_AFTER = '2026-12-31';

// The page a date was read off, derived from the date itself. Written out per
// row it silently carried a hardcoded year, so the first 2027 meeting added
// would have linked to the 2026 calendar and quietly undercut the one claim
// this list makes — that somebody checked.
const SOURCE = {
  commission: (date) =>
    `https://www.sumtercountyga.us/calendar.aspx?view=list&year=${date.slice(0, 4)}&month=${Number(date.slice(5, 7))}`,
  council: () => 'https://americuscityga.iqm2.com/Citizens/Calendar.aspx',
  authority: () => 'https://www.selectsumter.com/resources-incentives/calendar',
};

// date, body, kind, whether public comment is published. Time defaults to the
// 6:00 p.m. both governments keep; the authority meets at 4:00, in working
// hours, which is worth seeing on the page rather than smoothing over.
// `extra` carries anything the posting gives for that one date and the body
// does not publish as a standing fact — in practice the authority's room.
const official = (date, body, kind, speak, time = '18:00', extra = {}) => {
  // Without this a mistyped body name dies on "SOURCE[body] is not a function"
  // several frames from the line that is actually wrong.
  if (!SOURCE[body]) {
    throw new Error(`${date}: no calendar known for body '${body}' — expected one of ${Object.keys(SOURCE).join(', ')}`);
  }
  return {date, body, kind, speak, time, status: 'confirmed', source: SOURCE[body](date), ...extra};
};

export const MEETING_ROWS = [
  {
    date: '2026-08-04',
    slug: 'data-centers-are-coming',
    body: 'citizens',
    kind: 'Community meeting',
    title: 'Data centers are coming.',
    time: '18:00',
    status: 'confirmed',
    speak: 'open',
    summary: 'A company is proposing to build a large-scale data center in Americus. Before decisions get made, our community deserves to understand what that means for us — our water, our power bills, our land, and our future.',
    topics: [
      'Water usage & local supply impacts',
      'Electricity demand & utility rates',
      'Noise, land use & property values',
      'What residents can do next',
    ],
    program: [
      {name: 'Katie Minich', role: 'Welcome'},
      {name: 'Kevin Dowling', role: 'Life inside a data center'},
      {name: 'James Malphrus', role: 'Sowega Aquifer Alliance'},
      {name: 'Kirk Lyman-Barner', role: 'Better government'},
      {name: 'Q&A', role: 'Open to the community'},
    ],
    signups: 'Sign up at the door: moratorium petition, volunteers, T-shirts.',
    flyer: {
      src: '/assets/images/event_flyer.jpg',
      alt: 'Flyer: Community Meeting About Data Centers, Tuesday August 4 2026 at 6:00 p.m., Lake Blackshear Regional Library. Everyone welcome — bring your questions.',
    },
    recap: {
      video: {id: 'qYPjHDAbO9k', length: '1 hr 14 min'},
      deck: {
        href: '/research/better-government-2026-08-04.pdf',
        title: 'Better government',
        speaker: 'Kirk Lyman-Barner',
        meta: 'PDF · 3.8 MB',
      },
      // A summary is not a transcript. Every number below is what a speaker
      // said in the room, not something this desk has checked. Read it as "he
      // said 500,000 gallons a day", not as a verified figure. The recording
      // is the record. This is here for people who cannot sit through 74
      // minutes of it.
      notes: {
        source: 'Written from the captions on the recording above. Figures are as speakers gave them in the room. Nothing here has been independently verified.',
        parts: [
          {
            who: 'Katie Minich',
            role: 'Welcome',
            said: 'Opened for Sumter County Citizens for Transparency. The room was full and the meeting was streamed. She said the turnout was the point: people want information and they want transparency, and she hoped elected officials were paying attention.',
          },
          {
            who: 'Kevin Dowling',
            role: 'Life inside a data center',
            said: 'Spent ten years inside data centers. He described how much planning goes into one. Every server has a place, a power draw, and a cooling plan before it is racked. What is being built now is built for speed instead of reliability. Ten years ago one building drew what a neighborhood draws. Today the unit of measure is a city, and he said the building proposed here would draw about what Sumter County draws. He would welcome a data center in Americus if it were for Americus and if Americus were ready for it. He does not think we are ready. His open questions are water, air from generators, and noise. A Georgia Power representative answered from the floor that the utility had met with the developer and does have the ability to serve the load.',
          },
          {
            who: 'James Malphrus',
            role: 'Sowega Aquifer Alliance',
            said: 'His group is based in Albany and came together six to eight weeks ago. It is a think tank and advocacy hub, not a hard no on data centers, and it publishes its research at bigbaddatacenters.com. On jobs: construction brings in specialty crews from outside the county for about eighteen months. They leave. The inflation stays. Permanent staffing is usually thirty to fifty jobs. Property tax gets written down by abatements, so what a local government really sells is utilities. On water: he cited a Newton County campus using 500,000 gallons a day, followed by sediment in neighboring wells and residents having to redrill. He cited a QTS facility that has used more than 109 million gallons since construction started in February 2024, which he put at eleven Georgia Aquariums. On air: a Virginia Commonwealth University study mapped 138 data centers in Northern Virginia between 2015 and 2023. Its lead researcher said you would rather live next to a natural gas plant than next to a cluster of data centers. On noise: he said the 55 and 65 dB limits that show up in ordinances trace back to OSHA, which addresses eight-hour exposure at 85 dB and says nothing about a sound that never stops. He wants a moratorium, time to study, and ordinances in place before permits issue. The group is working in six or seven counties and is running a survey to set citizen priorities and shape a fill-in-the-blank ordinance.',
          },
          {
            who: 'Kirk Lyman-Barner',
            role: 'Better government',
            said: 'Laid out the steps to building a data center: land, zoning, power, water, environmental permits, transportation, tax agreements. We do not know where this project stands on most of them. Asked whether Sumter County is ready, he said no. The group has lengthened its ask from six months to longer, because six months is not enough time to write an ordinance. The moratorium is temporary, it is only on permitting, and it has to cover both the city and the county. If it is only the city, the developer moves to another parcel and we start over with no protections. Under the current industrial zoning this plant can be built with no ordinance, and zoning will not stop it. A promise of closed-loop cooling can change once construction is under way. He said the group documented fifty to a hundred data centers that changed their design mid-project. On transparency, he put himself in the good old boy network and said it gets lazy about notices, open meetings, and public input. Georgia rules against gratuities require a documented study before land goes for a nominal price. An NDA can protect proprietary business information. It cannot hide tax incentives, agendas, or public notices. Real estate can be discussed in executive session, but the deal cannot be closed there. He also named the conflict in a city that signs an NDA, counts on the revenue, and writes the ordinance, with the city manager sitting on the zoning board. Economic benefits cannot be speculative. He wants the promised jobs and payments documented up front and backed by a bond. He cited a Carl Vinson Institute figure of about a 4% tax increase on average, offset by the abatements. The group has filed open records requests, including on a dinner where the parties met.',
          },
          {
            who: 'Q&A',
            role: 'From the floor',
            said: 'A retired bank executive who was a fiduciary for forty years said the city and county violated that duty and sold without an independent appraisal. The land was county owned and was transferred to the Development Authority. Liberty Georgia USA was incorporated in Georgia in June, just before the transfer. Its website names no people. The trail runs to an investment group. One attendee offered $5,000 toward a lawyer. Asked about the meeting where somebody said to wait and find out who was paying the tab before asking hard questions, council member Kris Bowden said it was a meeting with some of the data center people, that he was invited to it, and that there was no quorum. He named the attendees as himself, the mayor, possibly one other council member, and the city manager. Others asked about sound and wildlife. There is research on cattle and on bees. Deer and pollinators are open questions. The wetlands on the site hold the Muckalee crayfish, listed Threatened by the state of Georgia, which breeds there. It is ranked S2, it has no federal protection, and its range is essentially Muckalee Creek and its tributaries in the Flint system. One resident laid out what she had watched in person: the Development Authority said a month and a half ago that no data center was planned, the council said two weeks ago that it had been approached, and last week said it had entered an agreement.',
            // The one claim from the floor with a state record behind it, so it
            // gets the record rather than a paraphrase.
            link: {
              href: 'https://georgiabiodiversity.org/portal/profile?group=all&es_id=22437',
              label: 'Muckalee crayfish, Georgia Biodiversity Portal',
            },
          },
          {
            who: 'Georgia Power',
            role: 'Pete Nichols, area manager',
            said: 'Generation is not the constraint. The grid east of the Mississippi is interconnected, and he said there is enough generation to serve this. Transmission is the part being built. Georgia Power is building 400 miles of it across the state, including 101 miles of 500 kV line, an upgrade running from Kinchafoonee down to Plains, and a new substation at Plains. None of it has required condemnation so far. In the one case raised from the floor, the utility offered about double a $120,000 appraisal and the owner did not want to sell. Loads over 99 MW have to sign fifteen-year contracts and pay 100% of the capital and the operations and maintenance, so other customers do not carry it. Rates are frozen through 2028. The Public Service Commission requires public meetings when more than twelve landowners are affected. The Patriot Act limits what the utility can publish about where its infrastructure runs.',
          },
          {
            who: 'The city',
            role: 'Mayor Travis Rush and the city manager',
            said: 'Mayor Travis Rush said the council is working with lawyers and with other counties, that there is a contract agreement with the developer, and that concerns raised by residents have been sent to the company to accept or refuse. He welcomed anyone who wants to help write the ordinance. Kirk Lyman-Barner answered that the developer helping write the ordinance is itself the red flag. City manager Raphael Maddox, three months into the job, said the clergy meeting was a standing quarterly town hall and that he invited Liberty to it once the data center came up. The next quarterly meeting is for local businesses. He said his instruction to staff was to be careful, because Georgia only requires one party to know a conversation is being recorded. He said he never told anyone to stay silent.',
          },
          {
            who: 'Liberty',
            role: 'Tony and Paul, from Toronto',
            said: 'They were in the back of the room and were called forward. They said they were brought in about eighteen months to two years ago to put capital and technical help into a bitcoin data center already operating in Americus that was going to shut down, and that they have made ten to fifteen trips here since. Conversations with local economic development turned into this proposal. They frame it as an innovation center with the data center as an extension of it, including curriculum work with the schools. They put the build at about $5 billion, plus perhaps $10 billion of customer equipment inside it. They said it is small by industry standards, not a 400 MW Meta or Google campus, and that they are not using water. They said the commitment is backed: if they do not spend what they said and create the jobs they said, they give the land back and pay a substantial premium over what they paid. Asked whether they have a customer, they said yes. The room got heated and the organizers closed the meeting, saying the city and the company should hold one of their own.',
          },
        ],
      },
    },
  },
  // The authority posted a room for this one: 409 Elm Avenue, second floor,
  // which is its own office building. 4:00 to 6:00 p.m.
  official('2026-08-10', 'authority', 'Board meeting', 'unknown', '16:00', {
    venue: 'Rees Park Economic Development Center, second floor',
    address: '409 Elm Avenue, Americus, GA 31709',
    venuePosted: true,
  }),
  official('2026-08-11', 'commission', 'Work session', 'unknown'),
  official('2026-08-13', 'council', 'Agenda-setting meeting', 'unknown'),
  official('2026-08-18', 'commission', 'Regular meeting', 'unknown'),
  official('2026-08-20', 'council', 'Regular meeting', 'published'),
  official('2026-09-08', 'commission', 'Work session', 'unknown'),
  official('2026-09-15', 'commission', 'Regular meeting', 'unknown'),
  official('2026-09-17', 'council', 'Agenda-setting meeting', 'unknown'),
  official('2026-09-24', 'council', 'Regular meeting', 'published'),
  official('2026-10-13', 'commission', 'Work session', 'unknown'),
  official('2026-10-15', 'council', 'Agenda-setting meeting', 'unknown'),
  official('2026-10-20', 'commission', 'Regular meeting', 'unknown'),
  official('2026-10-22', 'council', 'Regular meeting', 'published'),
  official('2026-11-10', 'commission', 'Work session', 'unknown'),
  official('2026-11-12', 'council', 'Agenda-setting meeting', 'unknown'),
  official('2026-11-17', 'commission', 'Regular meeting', 'unknown'),
  official('2026-11-19', 'council', 'Regular meeting', 'published'),
  official('2026-12-08', 'commission', 'Work session', 'unknown'),
  official('2026-12-10', 'council', 'Agenda-setting meeting', 'unknown'),
  official('2026-12-15', 'commission', 'Regular meeting', 'unknown'),
  official('2026-12-17', 'council', 'Regular meeting', 'published'),
];
