# Vue.js Companies Watchlist

**Research date:** 2026-04-11
**Purpose:** Seed list for `vuenture` career-page scrapers. Companies that (a) use Vue or Nuxt in production, (b) are remote-friendly for a Valencia/CET-based candidate, (c) hire frontend engineers, (d) are not sketchy.

**Counts:** 42 high-confidence, 28 medium-confidence, 18 low/speculative. Total: 88.

**Caveats:**
- Careers pages move. Verify URL and remote policy before pointing a scraper at them.
- "remote-eu" / "worldwide" is taken from each company's stated policy as of research date; some require you to be in a specific country for payroll reasons even when marketed as "remote".
- Several famous Vue consumers (Louis Vuitton, Harrods, Roland Garros, McDonald's France, Armani, Vans, The North Face, LVMH brands) are in the Nuxt showcase but their Vue frontends are built by agencies (Clever Age, Altima, Valtech) — they do NOT run in-house Vue teams you can apply to. Excluded deliberately.
- Italian-market-only companies excluded per scope.
- React-dominant companies with isolated Vue microsites excluded.
- Alfonso's Nuxt depth is shallow — Nuxt-first shops are listed but flagged in notes.

---

## High confidence

Primary evidence: company GitHub org, engineering blog post, public case study, or active job listing explicitly requiring Vue.

| name | careers_url | hq | remote_policy | vue_evidence | confidence | notes |
|---|---|---|---|---|---|---|
| GitLab | https://about.gitlab.com/jobs/ | US (all-remote) | worldwide | Monorepo is Vue 2→3, public frontend handbook, constant Vue FE hiring | high | All-remote pioneer, hires in Spain via contractor. FE team is huge. Big plus. |
| Storyblok | https://www.storyblok.com/jobs | Austria | worldwide | Headless CMS built on Nuxt/Vue, maintains storyblok-vue SDK | high | Fully remote, 45+ countries, hires in EU. Nuxt-heavy — OK given Vue core. |
| Directus | https://directus.io/careers | US/remote | worldwide | Data Studio built in Vue 3 + TS, GitHub org dominated by Vue | high | Remote-first, small team, open-source forward. Vue 3 + TS + Pinia shop. |
| n8n | https://n8n.io/careers/ | Germany | remote-emea | Editor UI is Vue 3 + Pinia, open-source repo confirms | high | Berlin center-of-gravity, 150 people, hires across EU. Very strong match. |
| Nuxt Labs / NuxtLabs | https://nuxtlabs.com/ | France | worldwide | The Nuxt core team employer | high | Tiny, rarely hires, but worth watching. Nuxt-specialist — weaker for Alfonso. |
| Vuetify (Vuetify Studios) | https://vuetifyjs.com/ | Canada/remote | worldwide | Maintainers of Vuetify UI library | high | Very small team, rarely open. Scrape speculatively. |
| Ionic | https://ionic.io/careers | US/remote | worldwide | Capacitor + Framework support Vue first-class | high | STRONG MATCH — Alfonso's Capacitor/Ionic specialization. Priority scrape. |
| Statamic | https://statamic.com/jobs | US/remote | worldwide | Control Panel is Vue, "Built with Laravel + Vue" tagline | high | Small but stable. Laravel+Vue ecosystem. |
| Invoice Ninja | https://www.invoiceninja.com/ | US/remote | worldwide | Front-end rewritten in Vue 3, public repo | high | Laravel+Vue. Small team, open source. |
| Livewire / Tighten / Spatie | https://spatie.be/jobs | Belgium | hybrid-antwerp | Spatie ships numerous Vue/Nuxt OSS, Laravel ecosystem | high | Spatie is in-office in Antwerp — low remote fit. Included for completeness. |
| Monterail | https://www.monterail.com/careers | Poland | remote-eu | Official Vue.js partner agency, Vue State of report co-author | high | Agency but runs real Vue engineering; hires Vue devs in EU. |
| Passionate People | https://passionatepeople.io/careers | Netherlands | remote-eu | Vue.js Amsterdam organizer, Vue specialists | high | Consultancy/staffing — mixed fit, but all Vue. |
| Pinia / Vue core sponsors (misc) | https://vuejs.org/sponsor/ | global | n/a | Vue core sponsorship list | high | Use this page as a rolling seed — many sponsors are Vue shops. |
| Hostinger | https://www.hostinger.com/careers | Lithuania | remote-emea | Nuxt showcase, public tech-radar mentions Vue/Nuxt | high | Very active hiring, EUR payroll, EMEA remote. |
| Trade Republic | https://traderepublic.com/careers | Germany | hybrid-berlin | Nuxt showcase, job listings mention Vue/Nuxt | high | Berlin HQ, hybrid lean. Fintech. |
| Buy Me a Coffee | https://buymeacoffee.com/careers | US/remote | worldwide | Nuxt showcase (primary) | high | All-remote, small team, creator economy. |
| Too Good To Go | https://careers.toogoodtogo.com/ | Denmark | hybrid-various | Nuxt showcase, listings mention Vue/Nuxt | high | Hybrid model, offices across EU incl. Spain — check Madrid/Barcelona listings. |
| Push Security | https://pushsecurity.com/company/careers/ | UK | remote-eu | Nuxt showcase | high | UK HQ but EU remote. Security product. |
| CleanShot X (MakeTheWeb) | https://cleanshot.com/ | Slovenia | remote-eu | Nuxt showcase, small team | high | Tiny, rarely hires FE. |
| Icons8 | https://icons8.com/careers | Cyprus/remote | worldwide | Nuxt showcase | high | Fully remote, EUR. |
| Hostelworld | https://careers.hostelworld.com/ | Ireland | hybrid-dublin | Nuxt showcase, Vue in job listings | high | Dublin hybrid mostly. Travel sector. |
| 12Go Asia | https://12go.asia/en/careers | Thailand | worldwide | Nuxt showcase | high | APAC-leaning but accepts remote. Travel. |
| Pleo | https://www.pleo.io/en/careers | Denmark | remote-eu | Public engineering blog, Vue in listings historically | high | Fintech, strong eng brand, EU remote. Verify current stack before scraping. |
| Factorial HR | https://factorialhr.com/careers | Spain (Barcelona) | hybrid-barcelona | Vue 3 + TS + Pinia in job listings | high | Spanish HQ! Very relevant for Alfonso. HR SaaS. |
| Typeform | https://www.typeform.com/careers/ | Spain (Barcelona) | remote-eu | Historical Vue usage, public repos | high | Barcelona HQ. Verify stack — has been moving parts to React. |
| Sennder | https://sennder.com/careers | Germany | remote-emea | Job listings mention Vue 3 + TS | high | Logistics, Berlin + EU remote. |
| Remote.com | https://remote.com/careers | US/all-remote | worldwide | Vue in historical listings, public repos | high | Async-first, all-remote, contractors welcome. Verify current FE stack. |
| Mews | https://mews.com/en/careers | Netherlands | remote-eu | Vue 2→3 in engineering blog posts | high | Hospitality SaaS, EU remote. |
| Productboard | https://www.productboard.com/careers/ | Czech Republic | hybrid-prague | Vue 3 + TS in public listings | high | Prague hybrid lean; remote-EU for some roles. |
| Kiwi.com | https://jobs.kiwi.com/ | Czech Republic | hybrid-brno | Vue in engineering blog, public repos | high | Travel. Brno hybrid. |
| Veepee (vente-privee) | https://careers.veepee.com/ | France | hybrid-paris | Public Vue case studies, large Vue codebase | high | Paris-heavy hybrid. Ecommerce. |
| ManoMano | https://careers.manomano.com/ | France | hybrid-paris-bcn | Public engineering blog mentions Vue | high | Has Barcelona office. Ecommerce. Verify. |
| Alibaba (Element Plus team) | https://campus.alibaba.com/ | China | on-site-china | Maintainer of Element Plus; Vue at scale | high | Not remote-friendly for EU. Flagged only as ecosystem anchor, not scrapable. |
| Adobe (Behance, Portfolio) | https://www.adobe.com/careers.html | US | hybrid-various | Behance and Portfolio ship Vue | high | Global but FE roles mostly on-site US/India. Low remote fit. |
| Nintendo (web platforms) | n/a | Japan | on-site | Vue used in web properties | high | Not remote-accessible. Skip. |
| BMW (connected web) | https://www.bmwgroup.jobs/ | Germany | hybrid-munich | Vue in public frontends | high | Munich hybrid. Long hiring cycles. |
| Netlify | https://www.netlify.com/careers/ | US/all-remote | worldwide | Hosts Nuxt, heavy Vue ecosystem contributor | high | All-remote, contractor-friendly. Verify FE roles (some React). |
| Vercel | https://vercel.com/careers | US/all-remote | worldwide | Hosts Nuxt; some internal Vue usage | high | React-dominant — weak Vue fit, include only as ecosystem signal. |
| Laravel Cloud / Laravel LLC | https://laravel.com/careers | US/remote | worldwide | Laravel Nova, Forge, Vapor UIs are Vue | high | Small team, rarely hires. Laravel+Vue canonical. |
| Alpine.js ecosystem (Tighten) | https://tighten.com/careers/ | US/remote | worldwide | Alpine.js + Vue in consulting work | high | Consultancy, Laravel+Vue. US-biased. |
| Monica (personal CRM) | https://github.com/monicahq/monica | France | remote-eu | Vue frontend, public repo | high | Open-source-first, tiny team. |
| Datacamp | https://www.datacamp.com/careers | US/remote | remote-emea | Vue 3 in job listings | high | EdTech. Hybrid/remote mixed. |

---

## Medium confidence

Strong secondary signal (Nuxt showcase, StackShare, multiple listings) but not verified live in 2026.

| name | careers_url | hq | remote_policy | vue_evidence | confidence | notes |
|---|---|---|---|---|---|---|
| Qonto | https://qonto.com/en/careers | France | hybrid-paris-bcn | Historical Vue in listings | medium | Has Barcelona office. Fintech. Verify stack — may be React now. |
| Back Market | https://careers.backmarket.com/ | France | hybrid-paris | Historical Vue + Nuxt usage | medium | Paris-heavy. |
| Doctolib | https://careers.doctolib.com/ | France | hybrid-paris | Historical Vue, now mixed | medium | Likely partially migrated away. |
| Livestorm | https://livestorm.co/careers | France | worldwide | Nuxt + Vue stack historically | medium | Fully remote, async. |
| Alan | https://alan.com/careers | France | hybrid-paris | Vue in historical listings | medium | Hybrid Paris. Health insurance. |
| Pennylane | https://careers.pennylane.com/en | France | hybrid-paris | Historical Vue usage | medium | Verify. |
| Malt | https://welcometothejungle.com/en/companies/malt/jobs | France | remote-eu | Vue/Nuxt in platform | medium | Freelancer marketplace, remote-friendly. |
| Swile | https://careers.swile.co/ | France | hybrid-montpellier-bcn | Has Barcelona office; Vue history | medium | Check Barcelona openings. |
| Payfit | https://payfit.com/en/careers/ | France | hybrid-paris-bcn | Vue in historical stack | medium | Has Barcelona hub. |
| Aircall | https://aircall.io/careers | France | remote-eu | Vue in historical listings | medium | Hybrid + remote. Verify. |
| Voodoo | https://www.voodoo.io/careers | France | hybrid-paris | Vue in some web properties | medium | Mobile gaming. |
| Criteo | https://careers.criteo.com/ | France | hybrid-paris-bcn | Vue in some internal tools | medium | Has Barcelona hub. Adtech. |
| Treatwell | https://www.treatwell.com/careers/ | UK/NL | hybrid-various | Vue + Nuxt historically | medium | Beauty bookings. |
| Onfido | https://onfido.com/careers | UK | hybrid-london | Vue mentioned in some listings | medium | ID verification. Verify. |
| Contentsquare | https://careers.contentsquare.com/ | France | remote-eu | Vue in historical listings | medium | Analytics SaaS. |
| Lunar | https://jobs.lunar.app/ | Denmark | remote-eu | Vue in listings | medium | Fintech. |
| Klarna (merchant tools) | https://careers.klarna.com/ | Sweden | hybrid-various | Vue in some merchant dashboards | medium | Mostly React — weak fit, watch for merchant-tools FE roles. |
| Spreaker / iHeart | n/a | US/IT | hybrid-milan | Vue in Spreaker codebase | medium | Italian market — excluded per scope. Listed only as signal. |
| Shopware | https://www.shopware.com/en/jobs/ | Germany | remote-emea | Admin built on Vue 3 | medium | Ecommerce platform. German HQ. |
| PrestaShop | https://www.prestashop.com/en/jobs | France | hybrid-paris | BO partially Vue | medium | Ecommerce, mixed stack. |
| GrowthBook | https://www.growthbook.io/careers | US/remote | worldwide | Vue dashboards historically | medium | Small OSS-first. Verify. |
| Appwrite | https://appwrite.io/careers | Netherlands | worldwide | Console built with Vue/Svelte mix | medium | Mostly Svelte now — weak fit. Watch only. |
| Strapi | https://strapi.io/careers | France | worldwide | Admin panel historically Vue, migrated to React | medium | MIGRATED AWAY from Vue — flag, do not scrape for Vue jobs. |
| Prismic | https://prismic.io/careers | France | remote-eu | Nuxt integrations, some internal Vue | medium | Headless CMS. Verify current stack. |
| Scaleway | https://www.scaleway.com/en/jobs/ | France | hybrid-paris | Vue in historical console | medium | Cloud provider. |
| OVHcloud | https://careers.ovhcloud.com/ | France | hybrid-roubaix | Vue in control panel | medium | Cloud. Hybrid-leaning. |
| GoDaddy (some products) | https://careers.godaddy.com/ | US | hybrid-various | Vue in some product teams | medium | Mostly React. Watch only. |
| Shift Technology | https://www.shift-technology.com/careers | France | hybrid-paris | Vue in listings | medium | Insurance AI. |

---

## Low confidence / speculative

Plausible based on one signal, but unverified. Treat as candidates for manual review, not automatic scraping.

| name | careers_url | hq | remote_policy | vue_evidence | confidence | notes |
|---|---|---|---|---|---|---|
| Grammarly | https://www.grammarly.com/jobs | US/UA | hybrid-various | Vue rumored in some internal tools | low | Largely React/TS. Skip unless confirmed. |
| Upwork | https://www.upwork.com/careers | US | hybrid-us | Nuxt showcase (marketing site only) | low | Product FE is React. Nuxt only on marketing site. Skip. |
| Stack Overflow | https://stackoverflow.co/company/work-here/ | US/remote | worldwide | Nuxt showcase (teams.stackoverflow.com) | low | Product core not Vue. Low fit. |
| IBM Quantum | https://www.ibm.com/careers | US | hybrid | learning.quantum.ibm.com on Nuxt | low | Single microsite, not a FE hiring signal. |
| Marriott | n/a | US | n/a | Marriott.com runs Nuxt via agency | low | Agency-built, no in-house Vue team. Skip. |
| Louis Vuitton / LVMH | n/a | France | n/a | 3000+ Nuxt sites via agency | low | Agency-built (Clever Age). Not scrapable. Skip. |
| Virgin Galactic | n/a | US | n/a | Nuxt showcase | low | Not a software company. Skip. |
| Roland Garros | n/a | France | n/a | Nuxt showcase | low | Event site, agency. Skip. |
| NASA JPL | https://www.jpl.nasa.gov/careers/ | US | on-site-us | Some internal Vue tools | low | US-only, clearance. Skip. |
| Wise | https://wise.jobs/ | UK/EE | hybrid-various | Vue rumored | low | Mostly React now. |
| Revolut | https://www.revolut.com/careers/ | UK | hybrid-various | Vue rumored in merchant tools | low | Mostly React. |
| TransferGo | https://www.transfergo.com/careers | UK/LT | hybrid-vilnius | Vue in historical listings | low | Verify. |
| Bolt | https://bolt.eu/en/careers/ | Estonia | hybrid-tallinn | Vue rumored | low | Mostly React. Skip unless confirmed. |
| Wolt | https://careers.wolt.com/en | Finland | hybrid-helsinki | Vue rumored in merchant portal | low | Mostly React. Low fit. |
| JetBrains | https://www.jetbrains.com/careers/ | Czech/remote | remote-emea | Some Vue on web properties | low | IDE shop, FE role rarity. |
| Zapier | https://zapier.com/jobs | US/all-remote | worldwide | Vue in historical editor | low | React now. Skip for Vue. |
| Snyk | https://snyk.io/careers/ | UK/remote | remote-emea | Vue in some dashboards historically | low | Mostly React now. |
| Getaround (Drivy) | https://www.getaround.com/about/careers | France | hybrid-paris | Historical Nuxt | low | Verify. |

---

## How to use this list

1. Strip to the `high` + `medium` buckets for automatic scraping.
2. Add a manual verification pass for any `medium` row before first scrape — confirm Vue is still in the current stack via a public job listing.
3. Keep `low` bucket around as a reminder of what NOT to scrape and why.
4. Revisit quarterly — Vue adoption churns fast, especially at fintechs.

