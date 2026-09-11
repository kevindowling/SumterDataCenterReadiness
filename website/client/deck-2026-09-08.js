// The slide deck Kirk Lyman-Barner presented on September 8, 2026.
//
// Seventy slides, published as a page rather than only as a PDF. The reason is
// the reason this site types out a flyer instead of posting a photograph of
// it: a PDF of pictures is invisible to search, to a screen reader, and to
// anyone on a phone with a slow connection, and three of these slides are
// video that a PDF flattens into a dead still.
//
// So each slide here carries three things: the rendered image, the words that
// were on it, and, on slides 2, 45 and 63, the clip itself. `lines` is the
// text as it was typed on the slide, extracted from the PowerPoint file, with
// the line breaks the author typed. `transcribed: true` marks a slide whose
// words were pasted in as a picture and have been typed out here by hand -
// flagged because a transcription is this desk's work, not the author's file.
// `alt` describes what the slide shows for a reader who cannot see it.
//
// The deck is the speaker's argument, not this desk's. Nothing in it has been
// checked here, and the page says so above the first slide.

export const DECK = {
  meeting: '2026-09-08-what-we-know-about-the-data-center',
  title: 'Real Data over Developer Dogma',
  subtitle: 'Environmental concerns related to the data center ordinance draft, and the argument for a moratorium',
  speaker: 'Kirk Lyman-Barner',
  date: '2026-09-08',
  // Where the images and clips live. One place, so a re-export changes a
  // directory name rather than seventy paths.
  assets: '/assets/decks/2026-09-08/',
  pdf: {href: '/research/real-data-over-developer-dogma-2026-09-08.pdf', meta: 'PDF, 70 slides, 14 MB'},
  source: 'Rendered from the speaker\'s own PowerPoint file, as presented on September 8, 2026. The three clips are the ones embedded in that file, re-encoded to play in a browser.',
  slides: [
    {
      alt: 'Title slide, with the round Sumter County Citizens for Transparency seal.',
      lines: [
        'Real Data',
        'over',
        'Developer Dogma',
        'Environmental Concerns related to the Data Center Ordinance draft and the argument for a moratorium',
        'Kirk Lyman-Barner',
        'September 8, 2026',
      ],
    },
    {
      alt: 'Beside the text, a still from the clip below: a red card reading "Let\'s be factual. #Transparency".',
      lines: [
        'At our last meeting, the Mayor and City Manager told me personally they were there to “just observe and listen.”',
        'That was a deception. They had a plot.',
        'They brought the developers to hijack our meeting.',
        'That will not happen tonight. Tonight is our meeting. Our concerns.',
      ],
      clip: {file: 'clip-02', length: '1 min 18 sec', caption: 'The city manager of Americus at a public meeting, under cards asking why he is listening to Liberty Data rather than to the residents whose taxes pay his salary.'},
    },
    {
      alt: 'A dark panel of text beside a scanned letter on Sumter County letterhead.',
      lines: [
        'Last Friday, one official from the County even tried to shame us for asking for records after the County facilitated the $1 gift of a half million-dollar taxpayer owned property that the County previously owned.',
        'Maybe they were trying to distract the Attorney General from remembering they were out of compliance with the O.R.A.',
      ],
    },
    {
      alt: 'A screenshot of an e-mail from Rusty Warner to Tony and Paul Di Benedetto and Susan Warner.',
      lines: [
        'June 10, 2026: “I will tell you the city of Americus is very concerned, but at this time still on board […..]there is a group in the community that’s coming out, protesting, and trying to get a moratorium in place.”',
        'Note: The City Council Meeting at',
        'which our group spoke was July 23, 2026.',
      ],
    },
    {
      alt: 'A clipping from the Americus Times-Recorder, "Americus Mayor discusses possible impact of data center proposal", with a photograph of the mayor.',
      lines: [
        'Rush says he first learned about Liberty’s agreement with the Payroll Development Authority sometime in July.',
      ],
    },
    {
      alt: 'A screenshot of an e-mail dated June 16, 2026.',
      lines: [
        'June 16, 2026 – “Rusty is preemptively conducting a breakfast, lunch and dinner with a couple each of the Americus council to pave the way for a Liberty visit with Americus and Sumter County officials.”',
      ],
    },
    {
      alt: 'A screenshot of an e-mail thread headed "Re: Thank you", from Tony Di Benedetto of Launch Capital.',
      lines: [
        'June 23, 2026: “It was great meeting everyone.”',
      ],
    },
    {
      alt: 'A screenshot of an e-mail from Rusty Warner headed "Thank you".',
      lines: [
        'June 23, 2026: “I truly appreciate everything you guys did for me last night. I feel we gave total buy in and smooth sailing ahead.”',
      ],
    },
    {
      alt: 'Two screenshots of e-mails, one offering to cover hotel rooms, one about how notice of a called special meeting would be posted.',
      lines: [
        '“Because of the inconvenience, we will pick up the hotel room(s).”',
        'Called special meeting: Notice to the ATR “They don’t have to publish it in the newspaper but hold the notice at their office should someone ask.”',
        'Jimmy [Skipper] is afraid we will have a possibly large attendance through word of mouth.”',
      ],
    },
    {
      alt: 'A graphic on the Citizens for Transparency seal reading "The City of Americus and the Sumter County Board of Commissioners HAVE NOT COMPLIED WITH GEORGIA\'S OPEN RECORD LAWS!"',
      lines: [
        'We obtained the Environmental 1 study through Open Records Request.',
        'The PDA complied; the City and County did not.',
      ],
    },
    {
      alt: 'Two document thumbnails, labelled Environmental Survey and Ordinance Draft, above a banner reading "Bring facts. Ask for answers."',
      lines: [
        'Open Records: Environmental 1 Study',
      ],
    },
    {
      alt: 'A quotation from the Americus Times-Recorder set as text.',
      lines: [
        'Americus Times Recorder: August 5, 2026',
        'Rusty Warner, executive director of the Sumter County Development Authority, also spoke about the site. “We already did a phase one environmental study, and it did not warrant a phase two. And then we also did a wetland study.” Warner stated the study gave them outlines on how they can use the property.',
      ],
    },
    {
      alt: 'A satellite map of the site with a colour-coded legend, from scc4t.com.',
      lines: [
        'SCC4T.COM',
      ],
    },
    {
      alt: 'A street map of the area around the site: Magnolia Manor, Furlow Charter School, the Methodist Home for Children, Jennifer Lake, the Mill Creek waste water treatment plant and Tommy Hooks Road.',
      lines: [],
    },
    {
      alt: 'Terracon\'s Wetland Delineation Map, Exhibit 1: the outline of the tract stippled to show wetland. The legend gives an approximate project boundary of about 103.91 acres, wetland area about 61.47 acres (59.16%), perennial stream about 1,862 linear feet and ephemeral stream about 69 linear feet.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view along Swett Avenue: a parking lot and industrial buildings on the left, dense woodland to the right.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view of woodland, labelled Mill Creek.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view of Mill Creek winding through woodland.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view of the creek, with sandbars and shallow water.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view of Murphys Mill Pond, with a dock at the near shore.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view of Murphys Mill Pond, with houses along Brookwood Lane and a marker for Sumter Solutions.',
      lines: [],
    },
    {
      alt: 'A photograph taken from the water: the pond, a wooded shoreline and a blue sky of cumulus cloud.',
      lines: [],
    },
    {
      alt: 'An oblique aerial view taking in Murphys Mill Pond, Lake Jennifer, Murphy Mill Road, Lake Jennifer Drive, Fellowship Baptist Church and Tommy Hooks Road.',
      lines: [],
    },
    {
      alt: 'A photograph of the lake with a wooded island in the middle distance.',
      lines: [],
    },
    {
      alt: 'A photograph of a yard sign nailed to a tree in the woods: the words DATA CENTER inside a red prohibition sign, above scc4t.com.',
      lines: [],
    },
    {
      alt: 'A photograph of the creek under a rainbow, captioned with Wendell Berry\'s line: "Do unto those downstream as you would have those upstream do unto you."',
      lines: [],
    },
    {
      alt: 'The text of the sound provision, photographed from the ordinance draft.',
      lines: [
        'Current ordinance passed by Zoning Board',
      ],
    },
    {
      alt: 'The questions set in red over a photograph of the ordinance text they refer to.',
      lines: [
        'What type of sound study?',
        'Who developed the industry standards?',
        'Do they include constant 24/7/365 infrasound measurements?',
        'Who is going to monitor the post-development sound?',
        'What are the penalties and remedies for violations?',
      ],
    },
    {
      alt: 'A four-point graphic summarising the penalty section, beside a panel reading UP TO $1,000 PER OFFENSE.',
      lines: [
        'Americus Noise Violations: Existing Enforcement Remedies',
        'City of Americus Code § 1-8 — General Penalty',
        'UP TO',
        '$1,000',
        'PER OFFENSE',
        'For a continuous Code violation,',
        'each day is a separate offense.',
        '1',
        'Citation / Conviction',
        'Fine up to $1,000; other penalties are also authorized.',
        '2',
        'Each Day = Separate Offense',
        'A continuous violation can generate a new offense every day it continues.',
        '3',
        'Administrative Remedies Preserved',
        'The penalty does not prevent suspension/revocation of a license, permit or franchise where separately authorized.',
        '4',
        'Continuous Violation = Public Nuisance',
        'The City may pursue injunctive or other equitable relief to abate the violation.',
        'TAKEAWAY: A continuing noise violation can be penalized daily, treated as a public nuisance, and pursued through equitable relief.',
        'Source: City of Americus Code of Ordinances § 1-8(c)–(e), General Penalty (Code 1986, § 1-8).',
      ],
    },
    {
      alt: 'An infographic, "Water is not a sound barrier: sound can travel across lakes and wetlands", with an aerial of the site, a diagram of sound reflecting off a water surface between a data center and its neighbours, and the note that for a lake or wetland corridor sound propagation should be modelled and measured, not assumed to be blocked by water. Source: Miksis-Olds, J. L., et al. (2024), Journal of the Acoustical Society of America, 156(2), 740-753.',
      lines: [],
    },
    {
      alt: 'An infographic laying the definition, behaviour and sources of infrasound out in four panels.',
      lines: [
        'INFRASOUND: WHY A dBA-ONLY NOISE LIMIT MAY MISS PART OF THE PICTURE',
        'DEFINITION',
        'Infrasound is sound below 20 Hz — below the conventional lower limit of human hearing.',
        'HOW IT BEHAVES',
        'Very low frequencies have long wavelengths. The article explains that infrasound can bend around obstacles, pass through walls, and lose less energy over distance than higher-frequency sound.',
        'WHY DATA CENTERS MATTER',
        'The article identifies industrial ventilation systems, fans, compressors, pumping stations, air-conditioning systems, diesel equipment and gas turbines as man-made sources of low-frequency vibration.',
        'WHY THE ORDINANCE MATTERS',
        'A property-line limit stated only in dBA does not describe the frequency content of the noise. For a large mechanical campus, regulators should consider whether low-frequency and tonal noise need separate measurement criteria.',
        'KEY ORDINANCE QUESTION: Does a 55 dBA property-line limit adequately address persistent low-frequency or tonal noise?',
        'Source: ScienceInsights, “What Is Infrasound? Frequency, Sources, and Health Effects,” March 9, 2026. scienceinsights.org/what-is-infrasound-frequency-sources-and-health-effects/',
      ],
    },
    {
      alt: 'An infographic, "Infrasound can have biological effects: evidence exists, more research is needed", with four panels. Humans: can affect the brain. Birds, bees and amphibians: effects not yet known. Source: Frontiers in Physiology, 14, 1803881.',
      lines: [],
    },
    {
      alt: 'A photograph of a longhorn steer in a pasture.',
      lines: [
        'And farmers are worried about potential impact on the famous Georgia Longhorns',
      ],
    },
    {
      alt: 'Two photographs of longhorn cattle in a pasture, one beside a "no data center" sign.',
      lines: [
        'Occasionally spotted on Tommy Hooks Road',
      ],
    },
    {
      alt: 'A screenshot of a journal article listing in Applied Sciences: "Infrasound and Human Health: Mechanisms, Effects, and Applications".',
      lines: [
        'Peer-reviewed scientific journals',
      ],
    },
    {
      alt: 'A screenshot of a scientific paper\'s abstract on infrasound.',
      lines: [
        'Further studies need to be done',
      ],
    },
    {
      alt: 'A dark graphic with three cards: 85 degrees Fahrenheit in the server halls, earplugs provided to workers, fan noise described as a jet engine at idle.',
      lines: [
        'INSIDE META’S NEW $1.2 BILLION DATA CENTER',
        'KUNA, IDAHO • SEPTEMBER 2026',
        '85°F',
        'SERVER HALLS',
        'EARPLUGS',
        'PROVIDED TO WORKERS',
        '“JET ENGINE',
        'AT IDLE”',
        'FAN NOISE DESCRIPTION',
        'A NEW HYPERSCALE DATA CENTER: HOT ENOUGH FOR 85°F SERVER HALLS — LOUD ENOUGH THAT WORKERS ARE GIVEN EARPLUGS.',
        'Important: the story reports no measured dBA level and does not establish exterior/community noise levels.',
        'SOURCE: Mark Dee, Idaho Statesman / Hagadone News Network, Sept. 4, 2026.',
      ],
    },
    {
      alt: 'A graphic of a radiator captioned "They say it is just like a radiator."',
      lines: [
        'Let’s talk about a heat island next to the wetlands',
      ],
    },
    {
      alt: 'An infographic, "In a closed-loop cooling system, heat still has to go somewhere", tracing heat in four steps from the server racks through a heat exchanger to cooling towers and out into the air, and listing the local effects: higher ambient temperatures near the facility, warm moist air plumes, and a localised heat island effect. It ends: same energy in, same heat out; the only question is where it affects our community.',
      lines: [],
    },
    {
      alt: 'A screenshot of a journal listing for "Data Center Waste Heat as an Emerging Urban Thermal Hazard: First Field Measurements of Neighborhood-Scale Air Temperature Impacts", by David J. Sailor, Soroush Samareh Abolhassani and Eli P. Martin, published May 1, 2026 in the Journal of Engineering for Sustainable Buildings and Cities.',
      lines: [],
    },
    {
      alt: 'Text on a plain slide.',
      lines: [
        'Further studies need to be done.',
        'Are you catching on to the theme here?',
      ],
    },
    {
      alt: 'The cover page of the 2022 Terracon Phase I Environmental Site Assessment: 125.1 acres off Swett Avenue, Americus, Sumter County, Georgia, tax parcel 64-17, dated June 30, 2022, prepared for the River Valley Regional Commission under an EPA Brownfield assessment grant.',
      lines: [],
    },
    {
      alt: 'A slide carrying the EPA seal and the agency\'s definition of a brownfield site.',
      transcribed: true,
      lines: [
        'EPA Definition: Brownfield Site',
        '"real property, the expansion, redevelopment, or reuse of which may be complicated by the presence or potential presence of a hazardous substance, pollutant or contaminant"',
        'Source: U.S. EPA, Environmental Contamination at Brownfield Sites; CERCLA §101(39).',
      ],
    },
    {
      alt: 'A caption over the open-records material that follows.',
      lines: [
        'From the PDA Open Records',
      ],
    },
    {
      alt: 'Beside the text, a still from the clip below: the title card of a video of the group speaking with the Mayor of Americus.',
      lines: [
        'There was so much confidence',
        'in the Liberty Data Center developers,',
        'even the people tasked to build',
        'a data center ordinance had not',
        'read the Terracon Brownfield Study.',
        'They also didn’t consult with the citizens who elected them.',
      ],
      clip: {file: 'clip-45', length: '1 min 13 sec', caption: 'Sumter County Citizens for Transparency speaking with the Mayor of Americus, captioned, over footage of the creek and the site maps.'},
    },
    {
      alt: 'A photograph of the Americus Walmart storefront and its car park, used for scale.',
      lines: [
        'The proposed 400 MW Liberty Hyperscale Data Center is four 100,000 sq ft buildings.',
        'This proposed campus would be bigger than 2 times the size of the Americus Walmart,',
        'plus approximately 40,000 more square ft.',
        'Size and scale',
        'matter on a tight',
        'footprint.',
      ],
    },
    {
      alt: 'Exhibit C from the development agreement: a preliminary draft rendering of the Americus Tech Campus, four long buildings labelled Phase 1 to Phase 4 in cleared woodland.',
      lines: [],
    },
    {
      alt: 'The same rendering annotated with dimensions: 1,150 feet east to west, 1,190 feet north to south, a total of 1,368,500 square feet or 31.4 acres, of which the four data center buildings are 400,000 square feet, about 29 per cent.',
      lines: [],
    },
    {
      alt: 'The Langford and Associates retracement survey of the tract, with a red rectangle overlaid showing a 31.4-acre campus footprint of 1,190 by 1,150 feet.',
      lines: [],
    },
    {
      alt: 'Terracon\'s Wetland Delineation Map again, showing how much of the tract is wetland.',
      lines: [],
    },
    {
      alt: 'The same survey with the footprint reshaped to 1,800 by 760.3 feet to stay inside the property boundaries, noted as an approximate planning overlay rather than a surveyed site plan.',
      lines: [],
    },
    {
      alt: 'The survey with the wetland areas and the borrow pit marked, and the annotations highlighted in yellow.',
      lines: [
        'Heavy construction,',
        'clearing, grading,',
        'utility installation',
        'on the north side',
        'would require additional',
        'study.',
        'No soil investigations done.',
        'Any disturbance',
        'of wetlands',
        'Would require U.S.',
        'Army Corps of',
        'Engineers',
        'permitting.',
      ],
    },
    {
      alt: 'A slide summarising the central point of the 2022 Phase I.',
      transcribed: true,
      lines: [
        'RECOGNIZED ENVIRONMENTAL CONDITIONS',
        'What the 2022 Terracon Phase I says about the Swett Avenue tract',
        'THE CENTRAL POINT',
        'Terracon identified TWO off-site Recognized Environmental Conditions (RECs): EcoFlo Southeast and Triwood.',
        'A REC is a due-diligence finding that warrants environmental attention. It is not proof that contamination has reached the Swett Avenue property.',
        'Source: Terracon Phase I Environmental Site Assessment, Swett Avenue tract, June 30, 2022, Executive Summary / Conclusions.',
      ],
    },
    {
      alt: 'A two-panel slide: what a recognized environmental condition is, and what it does not prove.',
      transcribed: true,
      lines: [
        'What does "REC" mean?',
        'The Phase I term is about environmental due diligence, not a declaration that a site is contaminated.',
        'RECOGNIZED ENVIRONMENTAL CONDITION',
        'A REC flags the presence or likely presence of hazardous substances or petroleum under circumstances indicating a release, past release, or material threat of release.',
        'In practical terms: the condition is important enough to affect environmental due diligence and decisions about whether more investigation is needed.',
        'WHAT A REC DOES NOT PROVE',
        'It does NOT, by itself, establish that contaminants migrated onto the subject property.',
        'It does NOT establish the concentration, extent, exposure pathway, or health effect.',
        'Those questions generally require records review and, where warranted, intrusive sampling such as soil or groundwater testing.',
        'Source basis: Terracon Phase I ESA (2022), terminology and conclusions. This slide explains the study\'s REC finding without asserting contamination.',
      ],
    },
    {
      alt: 'A two-panel slide describing the Triwood and EcoFlo Southeast conditions.',
      transcribed: true,
      lines: [
        'The two RECs identified by Terracon',
        'Both are off-site, north/northwest of the Swett Avenue tract.',
        '1 | TRIWOOD',
        'Location: immediately north / adjacent to the subject property.',
        'Phase I history: former generator of multiple solvent wastes associated with manufactured-home-industry products.',
        'Why it matters: proximity plus the waste history caused Terracon to classify Triwood as a REC.',
        '2 | ECOFLO SOUTHEAST',
        'Location: approximately 450 feet north of the site; described as up-gradient.',
        'Phase I history: accumulation and consolidation of chemical and hazardous waste before shipment for disposal.',
        'Why it matters: Terracon classified EcoFlo Southeast as a REC to the subject property.',
        'Source: Terracon Phase I ESA (2022), Executive Summary / Conclusions, report pp. 2-3.',
      ],
    },
    {
      alt: 'A slide quoting Terracon\'s trigger sentence, with two panels on why it was said and why it matters now.',
      transcribed: true,
      lines: [
        'Terracon\'s explicit trigger for more investigation',
        'This is the most important sentence in the Phase I for a changing development footprint.',
        '"Should conditions change, such that the western and/or northern portion of the site is considered for development, additional investigation would be necessary."',
        'WHY TERRACON SAID THIS',
        'Its no-additional-work recommendation assumed the north/west REC-sensitive areas would remain largely undeveloped.',
        'WHY IT MATTERS NOW',
        'A Swett Avenue access route or northern construction footprint could change the assumption underlying that 2022 recommendation.',
        'Source: Terracon Phase I ESA (2022), Recommendations, report p. 3.',
      ],
    },
    {
      alt: 'A three-panel slide: 61.47 acres, 1,862 feet, and the connection between them.',
      transcribed: true,
      lines: [
        'The wetlands study makes the REC question more consequential',
        'The later field delineation shows how much of the tract\'s north/west is environmentally constrained.',
        '61.47 ACRES',
        'Terracon delineated approximately 61.47 acres of wetlands on the ~103.91-acre project area. That is about 59% of the investigated tract.',
        '1,862 FEET',
        'Terracon delineated approximately 1,862 linear feet of perennial stream. It also mapped 69 linear feet of ephemeral stream.',
        'THE CONNECTION',
        'The Phase I REC-sensitive north/west area overlaps the part of the property later shown to contain extensive wetlands and streams. That makes final road, utility, grading and building locations critical.',
        'Source: Terracon Wetlands and Waters of the United States Field Determination, Feb. 10, 2023: 61.47 wetland acres, 1,862 LF perennial stream, 69 LF ephemeral stream.',
      ],
    },
    {
      alt: 'A slide listing five questions as bullet points.',
      transcribed: true,
      lines: [
        'What should be answered before northern or western disturbance?',
        'The Phase I itself makes development location the key decision point.',
        'Does the current engineered site plan place roads, grading, utilities, stormwater facilities, staging, or buildings in the northern or western portion?',
        'Will Swett Avenue be used as a construction entrance or utility corridor through the REC-sensitive north side?',
        'Has a Phase II ESA, or any soil, groundwater, sediment, or surface-water sampling, been completed since the 2022 Phase I?',
        'Where do final construction limits fall relative to Triwood, EcoFlo, the 61.47 acres of wetlands, and the perennial stream?',
        'If the development footprint has changed, how was Terracon\'s explicit "additional investigation" trigger addressed?',
        'Questions derived from Terracon Phase I ESA (2022) and Wetlands Determination (2023). They are investigation questions, not findings that contamination exists.',
      ],
    },
    {
      alt: 'A three-panel slide: documented, conditional, trigger.',
      transcribed: true,
      lines: [
        'Bottom line',
        'The Phase I did not say "nothing to worry about." It made a conditional recommendation tied to where development would occur.',
        'DOCUMENTED',
        'Terracon identified EcoFlo Southeast and Triwood as RECs.',
        'CONDITIONAL',
        'Terracon did not recommend additional REC investigation based on the anticipated development area and the north/west remaining largely undeveloped.',
        'TRIGGER',
        'If the western and/or northern portion is considered for development, Terracon said additional investigation would be necessary.',
        'Primary sources: Terracon Phase I Environmental Site Assessment (June 30, 2022) and Terracon Wetlands and Waters Field Determination (Feb. 10, 2023).',
      ],
    },
    {
      alt: 'An aerial view of the south side of the property, with houses along the boundary.',
      lines: [
        'Let’s look at the south side of the proposed property…',
      ],
    },
    {
      alt: 'A slide quoting the Georgia definition of a borrow pit, with three panels beneath it.',
      transcribed: true,
      lines: [
        'What is a Borrow Pit?',
        'Georgia law provides a useful, site-relevant definition.',
        'Georgia: "an excavated area where naturally occurring earthen materials are to be removed for use as ordinary fill at another location."',
        'IN PLAIN LANGUAGE',
        'Soil, sand, clay or similar earth is dug from one place and hauled away for use as fill somewhere else.',
        'The excavation can leave a large, historically disturbed area.',
        'WHY IT MATTERS',
        'A borrow pit means the ground has been excavated and altered, not simply left as undisturbed woodland.',
        'Later redevelopment may encounter fill, altered grades, buried material or changed drainage.',
        'IMPORTANT LIMIT',
        'A former borrow pit is not proof of contamination.',
        'Environmental significance depends on what was later placed, burned, spread or buried there and whether those materials were characterized.',
        'Definition: O.C.G.A. § 12-4-72(1.1). Site-specific historical statements on following slides: Terracon Phase I ESA, June 30, 2022.',
      ],
    },
    {
      alt: 'A photograph of homes on the southeast side of the property, beside the text.',
      lines: [
        'The most vulnerable homes to air and noise pollution and potential carcinogens that may be stirred up during construction, which is anticipated to continue to 2033.',
        'During operation, these families will also be most vulnerable to generator noise and pollution.',
        'On the southeast side of the proposed',
        'property…..',
      ],
    },
    {
      alt: 'Beside the list, a still from the clip below: two people seated, from the video that closed the meeting.',
      lines: [
        '#don’tRUSHthedatacenter',
        'Topics we don’t have time to cover',
        'Generators',
        'Waste water treatment',
        'Water use missing from the ordinance approved by zoning',
        'Lack of bonds to secure decommissioning',
        'Real estate values',
        'Environmental risks during proposed construction until 2033',
        'Water use to produce electricity offsite',
      ],
      clip: {file: 'clip-63', length: '2 min 33 sec', caption: 'The closing video: two residents talking to camera, with footage of downtown Americus and of a hyperscale data center campus.'},
    },
    {
      alt: 'Text on a plain slide.',
      lines: [
        'The Environmental 1 study is not enough.',
        'Further studies need to be done.',
      ],
    },
    {
      alt: 'A photograph of a white laboratory rat held in a gloved hand.',
      lines: [
        'With all these environmental concerns, does it feel like',
        'the PDA, the Mayor and City Council members are using',
        'our citizens as lab rats?',
      ],
    },
    {
      alt: 'The text beside a photograph of the public hearing notice as printed in the Americus Times-Recorder for September 2 and 9, 2026.',
      lines: [
        'What can you do?',
        'Here’s an opportunity to make your voice heard.',
        'Citizens Input and Comments are to be heard at',
        'The City Council Chambers.',
        'September 24, 2026',
        '6:00 PM',
        'The City is required to share their most recent draft 15 days in advance.',
        'Please remind them that the PDA Agreement with Liberty Data GA USA, LLC is only a civil contract and not a City Law.',
      ],
    },
    {
      alt: 'A graphic advertising the group\'s $15 t-shirts, with donations going to a legal fees escrow account.',
      lines: [
        'But, if you’re against rushing the data center….',
        'and you go to the City Council meeting without a t-shirt,',
        'You are living in sin!',
        'But fear not…',
        'Redemption is cheap and we have t-shirts here with us tonight.',
      ],
    },
    {
      alt: 'A screenshot of the moratorium petition page at scc4t.com/petition.',
      lines: [
        'Sign the 18 Month Moratorium at https://scc4t.com/petition/',
      ],
    },
    {
      alt: 'A screenshot of the Sumter County Citizens for Transparency page on Facebook.',
      lines: [
        'Follow us on Facebook',
      ],
    },
    {
      alt: 'The round Sumter County Citizens for Transparency seal, on a plain slide.',
      lines: [],
    },
  ],
};
