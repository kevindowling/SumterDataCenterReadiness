# Could it strain the water system?

## Short answer

Possibly, but the outcome depends almost entirely on the cooling design and full-buildout load. A dry-cooled campus and an evaporatively cooled campus can have radically different water demands.

## The local baseline

| Verified or advertised measure | Amount | What it does, and does not, mean |
|---|---:|---|
| City annual-average groundwater permit limit | 3.75 MGD | [Legal withdrawal limit](https://epd.georgia.gov/watershed-protection-branch-lists); not a promise of available customer capacity |
| City monthly-average permit limit | 4.2 MGD | Allows a higher monthly average than the annual limit |
| Advertised average city consumption | ~2.5 MGD | [Development Authority figure](https://www.selectsumter.com/sites-buildings); measurement date is unstated |
| City withdrawal in 2020 | 2.22 MGD | [Historical USGS figure](https://www.usgs.gov/data/estimate-georgia-water-use-data-county-2020), not current 2026 demand |
| Advertised water-plant capacity | 7 MGD | Treatment rating; not the same as permitted or sustainable withdrawal |

Using the advertised 2.5 MGD demand, the simple difference below the annual permit limit is about **1.25 MGD**. That is only arithmetic. It does not prove that 1.25 MGD is available after peak demand, leakage, fire flow, drought, existing commitments, or well limitations.

## Cooling designs in plain language

### Dry cooling

A sealed loop carries heat to [radiator-like dry coolers](https://www.ashrae.org/technical-resources/ai-data-center-framework/integrated-design-principles) and rejects it to outdoor air. Ordinary cooling-water consumption can be near zero, although the site still needs water for initial fill, maintenance, humidification, cleaning, employees, landscaping, and fire protection.

### Evaporative cooling

A cooling tower rejects heat by evaporating water. It continuously needs makeup water and also discharges concentrated blowdown. An internal server-water loop may be “closed” while the final outdoor heat-rejection system still consumes substantial water.

### What the agreement already settles, and what it does not

The [signed development agreement](09-development-agreement.md) prohibits open-loop and once-through cooling and requires closed-loop cooling or other technology “designed to minimize water consumption” (§11). It also bars private water wells and private sanitary sewer, requiring Liberty to apply to the City of Americus for service (§5(C)). That rules out the most water-hungry design and puts the demand on the city system rather than on private wells.

It does not cap consumption. “Closed-loop” describes the circuit, not the water use, and a closed circuit can still reject its heat by evaporation — exactly the case described above. The number that would settle this is the water balance, which the agreement does not contain.

## Scale scenario, not a project forecast

The [Department of Energy publishes](https://www.energy.gov/cmei/femp/estimating-methods-determining-end-use-water-consumption) a full-load table of cooling-tower water use in gallons per day, indexed by chiller tonnage and by **cycles of concentration** — how many times water goes around the loop before it is discharged as blowdown. Fewer cycles means more blowdown and more makeup water. The table runs from 3 cycles to 8.

That table is indexed by tons, and a data center is described in megawatts, so getting from one to the other takes three steps. Each can be checked with a calculator:

1. **Megawatts to tons.** One megawatt of IT heat is 3.412 million Btu per hour; one ton of cooling is 12,000 Btu per hour. So 1 MW ≈ 284 tons, and a 25 MW load is about 7,100 tons.
2. **Tons to gallons.** The DOE table, at 24-hour operation, works out to about **54.8 gallons per ton per day at 3 cycles** (its 100-ton entry is 5,480 gal/day) and about **43.8 at 6 cycles** — consistent with its 5-cycle and 8-cycle entries, which come to 45.9 and 41.9 gallons per ton per day.
3. **Cycles set the width of the band.** The range below is that table read from 6 cycles at the efficient end down to 3 at the water-hungry end.

| Constant IT heat load | Evaporative makeup water | Annual amount |
|---:|---:|---:|
| 25 MW | 0.31–0.39 MGD | 114–142 million gal. |
| 50 MW | 0.62–0.78 MGD | 227–284 million gal. |
| 100 MW | 1.25–1.56 MGD | 455–569 million gal. |
| 200 MW | 2.49–3.12 MGD | 0.91–1.14 billion gal. |

Worked example, so the whole row can be checked: 25 MW × 284 tons/MW = 7,108 tons; at 43.8 gal/ton/day that is 311,000 gallons a day, and at 54.8 it is 389,000. The annual column is simply the daily figure times 365.

These figures assume full load around the clock and assume every watt of IT heat is rejected through the tower. Weather, utilization, economizers, auxiliary heat, and hybrid or partly dry designs all change the result — a design that rejects part of its heat to air uses correspondingly less water.

## Other water risks

- Drawdown affecting municipal or private wells
- Diesel, transformer-fluid, or chemical spills
- Firefighting runoff
- Cooling-water chemicals and blowdown
- Construction erosion and concrete washout
- Abandoned or improperly constructed wells creating contamination pathways

## Questions that resolve the issue

1. What is the final outdoor heat-rejection method?
2. What are average-day, maximum-day, maximum-month, and annual demands at full buildout?
3. Will the project use city water, a private well, reclaimed water, or a combination?
4. Has the city certified capacity after peak demand, leakage, drought, fire flow, and existing commitments?
5. Where will blowdown go, and what chemicals will it contain?
6. What does independent pumping and drawdown analysis predict for nearby wells?

The cooling schematic, water balance, and city capacity certification are records held by the city and the Development Authority. See [how to obtain the records and reach the officials](11-open-government.md), and the [contact page](/contact/) for the same roster with each official's published e-mail address.

## Important historical context

An [older USGS study](https://pubs.usgs.gov/of/1996/ofr96-483/pdf/ofr96-483.pdf) identified a small Providence-aquifer cone of depression around Americus. The same study also concluded that groundwater resources in its broader study area were not significantly impaired by 1990 use. That decades-old evidence supports obtaining a current study; it does not prove present harm or present safety.
