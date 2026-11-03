-- 008: editorials on /editorials/. Idempotent by convention (see
-- ignore/setup.md §4).
--
-- Written and published from the site by the accounts in EDITORIAL_AUTHORS.
-- Published rows are public; drafts are seen only by those writers.
CREATE TABLE IF NOT EXISTS editorials (
  id            bigserial PRIMARY KEY,
  slug          text NOT NULL UNIQUE,          -- set once from the first headline; links must not break on a retitle
  kind          text NOT NULL,                 -- key of KINDS in client/editorials.js
  title         text NOT NULL,
  byline        text NOT NULL,                 -- as printed, e.g. "Name, Co-Chair, SCC4T"; not the account name
  summary       text,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_on  date,
  created_by    text,                          -- Auth0 `sub`; NULL for a piece loaded by migration
  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT editorials_published_dated CHECK (status = 'draft' OR published_on IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS editorials_published_idx ON editorials (published_on DESC) WHERE status = 'published';

-- The first piece, from Kirk's October 27 draft. ON CONFLICT leaves it alone on
-- every later deploy, so edits made on the site are never overwritten.
INSERT INTO editorials (slug, kind, title, byline, body, status, published_on)
VALUES (
  'no-rezoning-without-a-development-plan',
  'letter',
  'No Rezoning Without a Development Plan',
  'Kirk Lyman-Barner, Co-Chair, Sumter County Citizens for Transparency',
  $body$The recent request by a landowner to rezone his Bumphead Road property on the north side of town, moving it from its current Agricultural use, jumping over the planned residential use all the way to light industrial was an exercise in zoning procedures that should be improved. The request for Light Industrial zoning would have allowed a data center to be located there near many of our schools.
Proponents of the rezoning argued that there were other safeguards in place such as Georgia State Development of Regional Impact (DRI) review. Americus City Attorney Coleman, who sits on the DRI board, told us, “Don’t count on those safeguards to stop data centers.” Indeed, the triggers for requiring the DRI study are likely larger than the proposed Liberty project: more than 500,000 gross square feet, or more than 200 acres. But we have never been shown a site plan.
Fortunately, two of the Bumphead parcels were denied the rezoning request and four were tabled for 90 days. Citizens’ presence and comments had clearly influenced the County Zoning Board.
The seller said he didn’t have a buyer, but a likely prospect had indicated that they were interested in putting an Amazon distribution center on the property. Driving past the schools, this property would put that warehouse 37 miles away from I-75. But maybe they were planning on using flying cars.
The meeting taught us an important lesson: Sumter County residents deserve to know what is being proposed before their elected officials change how land can be used. A rezoning decision can affect nearby homes, farms, roads, water supplies, and public services long after the vote is taken. Residents did a wonderful job explaining the risks to the Sumter County schoolchildren. At that meeting, we saw that citizens’ voices do matter.
That is why Sumter County should adopt a straightforward rule: when a developer requests rezoning for a proposed project, the application must include a meaningful development plan before the County considers approval.
Good planning begins with good information. The public deserves transparency.$body$,
  'published',
  '2026-10-27'
)
ON CONFLICT (slug) DO NOTHING;
