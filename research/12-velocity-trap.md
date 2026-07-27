# The velocity trap

> **Guest contribution.** This note was written by Jeff Ranew and is published here as submitted, lightly formatted for the web. It is national analysis rather than Sumter County research: its figures describe the industry, not the Americus proposal, and the field desk has not independently verified them. Sources for the desk's own local numbers stay on the [evidence desk](08-source-desk.md).

## Why the speed of hyperscale AI buildouts threatens local communities

Electromagnetic induction is governed not merely by the existence or magnitude of a magnetic field, but by its rate of change over time. A static, steady magnetic field - no matter how powerful - induces zero electrical current in a surrounding conductor. However, when that magnetic field surges rapidly, the sudden rate of change generates powerful, destabilizing currents capable of overloading electrical systems.

A strikingly similar dynamic is destabilizing municipal power grids, regional water basins, and local planning frameworks across the United States. Digital infrastructure itself - the steady presence of enterprise data servers - is not an inherent threat to local ecology or public utilities. Rather, the crisis unfolding across rural and suburban America stems from a single, volatile variable: the rapid rate of change.

The current rush to deploy artificial intelligence (AI) infrastructure has compressed years of capital allocation and engineering planning into an industrial sprint. The threat to communities is not "the internet" or data centers operating at equilibrium. The core hazard lies in the sudden spike in operational intensity created by an aggressive corporate arms race and the hyper-dense thermodynamics of hyperscale AI facilities. Driven by the fear of falling behind in market alignment, developers are forcing gigawatt-scale power demands onto electrical grids and water systems engineered for a far slower, less volatile era. **When deployment velocity outpaces supply chains, environmental stewardship and grid stability are always the primary casualties.**

## General-purpose vs. hyperscale AI: distant relatives

To understand why contemporary buildouts are provoking intense municipal pushback, one must distinguish between traditional general-purpose data centers and modern hyperscale AI clusters.

For decades, enterprise data centers - housing web applications, cloud storage, corporate software, and media streaming - expanded in cadence with regional utility planning. Their workloads follow predictable, diurnal cycles. A conventional enterprise rack draws approximately 5 to 15 kilowatts (kW) of power. While an aggregate cluster of these facilities represents a substantial energy footprint, their power density is easily managed using conventional air-cooling systems and standard substation infrastructure.

By contrast, hyperscale AI campuses designed for deep-learning model training and real-time inference represent a radical thermodynamic departure:

- **Thermal and electrical density.** Contemporary AI accelerators (e.g., high-end GPUs and neural processors) draw between 700 and 1,200+ watts per chip - up to six times the power of enterprise CPUs. Clustered into high-density architectures, rack densities have surged from 15 kW to between 50 kW and 120+ kW per rack.
- **Uncompromising load profile.** Unlike cloud computing, which experiences natural diurnal peaks and troughs, AI model training demands a continuous, 100% flatline power draw. This unbroken load stresses power transformers, distribution lines, and cooling loops without operational pause.
- **Campus footprint.** Where a traditional facility operates at 10 to 50 megawatts (MW), a modern hyperscale AI campus demands between 200 MW and 1+ gigawatts (GW) - a power consumption footprint rivaling that of a mid-sized American city (150,000 to 750,000+ households).

The table below outlines the core structural and operational distinctions between enterprise and hyperscale facilities:

| Metric / dimension | General-purpose data centers | Hyperscale AI facilities | Infrastructure impact |
|---|---|---|---|
| Primary workload | Web hosting, enterprise SaaS, cloud storage | LLM pre-training, deep learning, inference clusters | Shift to relentless, non-stop 100% continuous draw |
| Per-rack power density | 5 kW - 15 kW | 50 kW - 120+ kW | Requires direct-to-chip liquid cooling and custom substations |
| Processor thermal draw | 150 W - 350 W per CPU | 700 W - 1,200 W+ per GPU/accelerator | Exceeds physical heat-transfer capacity of forced air |
| Campus scale | 10 MW - 50 MW | 200 MW - 1,000+ MW (1+ GW) | Equals the power load of 150,000-750,000+ homes |
| Workload profile | Cyclical / diurnal peaks and valleys | Continuous 100% flatline load | Eliminates utility load-balancing buffers |

## The bottleneck effect: how compressed timelines force technological regression

When technology deployment advances faster than manufacturing capacity, severe industrial supply chain bottlenecks emerge. Today, key electrical and mechanical equipment necessary for sustainable data center design faces unprecedented lead-time backlogs:

- **Large power transformers (LPTs).** Procurement lead times have expanded from historical averages of 12 months to 3 to 5 years (up to 60 months).
- **Specialized liquid cooling and industrial chillers.** Closed-loop chilling systems and direct-to-chip heat exchangers carry backordered delivery times ranging from 48 to 60+ weeks.

Herein lies the central irony of the AI infrastructure race: because developers refuse to delay commissioning schedules to wait for clean, closed-loop technologies, they fall back on older, resource-intensive, and ecologically harmful stopgap solutions.

### Water depletion via legacy evaporative cooling

State-of-the-art closed-loop glycol and direct-to-chip liquid systems continuously recirculate coolant, achieving near-zero ongoing water consumption (Water-Use Effectiveness, or WUE, below 0.05 L/kWh). However, when closed-loop chillers are delayed by supply chain backlogs, developers facing strict deployment deadlines revert to traditional open-loop evaporative cooling towers.

Evaporative cooling relies on the phase change of water to reject heat, guzzling 3 to 5 million gallons of potable water per day for a standard 200 MW facility - most of which is evaporated straight into the atmosphere. In drought-stressed regions across the American West, Southeast, and Midwest, this artificial urgency pits hyperscale facilities directly against local residential aquifers and municipal water utilities.

### Grid bottlenecks and behind-the-meter fossil generation

Electrical transmission grids cannot expand at hyper-compressed speeds. Securing a utility interconnection agreement now requires 5 to 7 years in major regional grids like PJM Interconnection and MISO. To bypass these transmission queues, racing developers turn to behind-the-meter fossil generation - installing on-site aeroderivative gas turbines, deploying heavy diesel backup banks, or lobbying state commissions to delay the scheduled retirement of aging coal and gas units.

The resulting localized harms - smog, groundwater table depletion, low-frequency noise pollution, and rising residential electricity rates - are not an inevitable tax of digital progress. They are the direct consequence of cutting engineering corners to meet corporate deadlines.

| Infrastructure component | Standard lead time | Current backlog timeline | Stopgap solution adopted | Localized community and environmental impact |
|---|---|---|---|---|
| Large power transformers | 12 months | 36 - 60 months (3-5 years) | On-site gas turbines / coal plant extensions | Increased NOx and CO2 emissions, elevated ratepayer tariffs |
| Closed-loop chillers | 12-16 weeks | 48 - 60+ weeks | Open-loop evaporative cooling towers | Depletion of 3M-5M gal/day of potable drinking water |
| Grid interconnections | 12-24 months | 60 - 84 months (5-7 years) | Unregulated behind-the-meter generation | Noise pollution, air quality degradation, bypassed oversight |

## Defusing the "existential race" narrative

Proponents of unregulated deployment frequently invoke national security, arguing that the United States must build out compute capacity at any cost to prevent foreign adversaries - particularly China - from seizing a technological advantage.

However, global digital infrastructure data demonstrates that the U.S. operates from a position of overwhelming structural advantage rather than vulnerability:

- **Total facility count.** The United States hosts approximately 5,427 data centers - representing over 45% of total global facilities and roughly 12 times more than its closest national peer.
- **Hyperscale dominance.** The U.S. accounts for 54% of all operational hyperscale data centers worldwide (642 facilities) and 44% of global IT power capacity (53.7 GW).
- **China's operational footprint.** By contrast, China operates roughly 449 total data centers (190 hyperscale facilities representing 16% of global hyperscale count and 19.6 GW of IT power capacity).

| Metric / dimension | United States | China | Global context / share |
|---|---|---|---|
| Total data center count | 5,427 facilities | 449 facilities | U.S. holds 45% of world total (~12,000 facilities) |
| Dedicated hyperscale facilities | 642 facilities (54%) | 190 facilities (16%) | U.S. has more than 3.3x the hyperscale count of China |
| Installed IT power capacity | 53.7 GW (44%) | 19.6 GW (16%) | Global total: 122.2 GW |
| Infrastructure integration strategy | Rapid suburban expansion onto constrained grids | Paired with western green energy hubs and algorithmic efficiency | China prioritizes grid alignment and efficient compute placement |

Furthermore, China's industrial AI strategy prioritizes algorithmic efficiency, model architecture optimization, and placing compute centers directly adjacent to dedicated renewable energy projects in its western provinces (e.g., the national "East-to-West Computing" framework), rather than expanding unconstrained hyperscale campuses against fragile suburban municipal grids.

The narrative that American communities must sacrifice air quality, water security, and grid affordability in a blind rush to out-build foreign competitors is a false choice. The U.S. already possesses the world's most dominant compute foundation. The imperative is not speed at all costs, but resilient, sustainable execution.

## A path toward responsible infrastructure

Computing power and community stewardship are not mutually exclusive; they become antagonistic only when artificial urgency dictates public policy. A responsible model for hyperscale AI deployment requires shifting from blind expansion to paced, integrated planning:

1. **Mandated closed-loop cooling.** Municipalities and state regulators should prohibit open-loop evaporative cooling for high-density facilities (above 20 kW/rack). Developers must be required to utilize closed-loop, water-free chilling systems - even if doing so requires waiting for supply chains to catch up.
2. **Grid-synchronized growth.** Rather than permitting behind-the-meter fossil generation to bypass utility standards, hyperscale commissioning should be strictly phased in tandem with new regional renewable energy generation, energy storage deployment, and transmission line capacity.
3. **Co-location with excess energy.** Instead of clustering gigawatt campuses near densely populated suburban centers with constrained grids, development incentives should direct facilities near stranded renewable energy sources or industrial waste-heat recycling networks.
4. **Transparent impact standards.** Require mandatory public disclosures of Water-Use Effectiveness (WUE), Carbon Usage Effectiveness (CUE), and localized electrical grid stress assessments prior to zoning approval.

## Conclusion

General-purpose data centers integrated cleanly into civic infrastructure over decades because their growth aligned with the physical expansion of utility grids. The sudden, unbridled velocity of hyperscale AI deployment has broken that alignment.

When corporate panic leads companies to bypass supply chains, force dirty stopgap technologies onto local communities, and consume millions of gallons of daily municipal water, speed itself becomes the primary pollutant. It is entirely possible to build the computational foundation of the future responsibly - but doing so requires the wisdom to stop racing blindly into it.

## Where this connects locally

The conditions this note argues for are the same ones the desk's [pre-vote checklist](06-decision-checklist.md) asks officials to put in writing: a cooling design certified on the record ([water](02-water.md)), generator hours bounded by permit ([air](04-air-and-generators.md)), and load and upgrade costs settled before approval ([grid](05-electricity-and-resilience.md)).
