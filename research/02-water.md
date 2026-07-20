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

## Scale scenario, not a project forecast

The [Department of Energy publishes](https://www.energy.gov/cmei/femp/estimating-methods-determining-end-use-water-consumption) full-load cooling-tower water estimates. Applying that method directly to IT heat gives this planning range:

| Constant IT heat load | Evaporative makeup water | Annual amount |
|---:|---:|---:|
| 25 MW | 0.31–0.39 MGD | 114–142 million gal. |
| 50 MW | 0.62–0.78 MGD | 227–284 million gal. |
| 100 MW | 1.25–1.56 MGD | 455–569 million gal. |
| 200 MW | 2.49–3.12 MGD | 0.91–1.14 billion gal. |

These figures assume full load around the clock. Weather, utilization, economizers, auxiliary heat, cycles of concentration, and hybrid operation change the result.

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

## Important historical context

An [older USGS study](https://pubs.usgs.gov/of/1996/ofr96-483/pdf/ofr96-483.pdf) identified a small Providence-aquifer cone of depression around Americus. The same study also concluded that groundwater resources in its broader study area were not significantly impaired by 1990 use. That decades-old evidence supports obtaining a current study; it does not prove present harm or present safety.
