/*
 * GROUNDING SUFFICIENCY GS-1.1 — realistic business-content benchmark. SYNTHETIC DATA.
 *
 * Five FICTIONAL organizations in five sectors. No statement is a real company's Knowledge, no tenant
 * text was read or copied, and no production revision is a case here. Every claim and every gold
 * label was written by hand. This module imports NO evaluator code, so a label cannot be derived
 * from what the evaluator says.
 *
 * Gold answers one question: do the supplied records establish the claim?
 *   supported     a careful reader would say the records state it (paraphrase and translation included)
 *   insufficient  they do not state it — including goals read as achievements, positioning read as
 *                 market fact, a category read as a production method, a partial match
 *   contradicted  a supplied record states something incompatible
 *   unavailable   the evidence could not be read
 *
 * `need` names the capability a correct verdict requires, authored with the case, not after scoring:
 *   none  exact sentence identity       A paraphrase / semantic equivalence   B cross-language
 *   C multi-fact                         D contradiction                       E temporal reasoning
 *   F goal / positioning vs current fact G morphology / normalization         H unsupported escalation or new fact
 * Ambiguous cases were left out rather than labelled.
 */
export const SYNTHETIC_BENCHMARK = true as const;

export type Domain = "saas" | "manufacturing" | "professional-services" | "retail" | "logistics";
export type RealisticGold = "supported" | "insufficient" | "contradicted" | "unavailable";
export type Need = "none" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export type Category =
  | "exact" | "paraphrase" | "cross-language" | "numeric" | "percentage" | "date" | "quantity" | "pricing"
  | "property" | "provenance" | "certification" | "geographic" | "superlative" | "universal" | "causal"
  | "current-state" | "goal" | "positioning" | "multi-fact" | "partial" | "contradiction"
  | "relevant-insufficient" | "unrelated" | "bounded-universe" | "no-evidence" | "unavailable";

/* ── fictional organizations' records ─────────────────────────────────────── */

export const FACTS: Readonly<Record<string, { readonly domain: Domain; readonly text: string }>> = {
  /* SaaS — "Cobalt CRM" */
  s1: { domain: "saas", text: "The Enterprise plan supports up to 100 users." },
  s2: { domain: "saas", text: "Cobalt CRM is hosted in data centres in Frankfurt, Germany." },
  s3: { domain: "saas", text: "Cobalt CRM is certified to ISO 27001." },
  s4: { domain: "saas", text: "The Starter plan costs 29 euros per user per month." },
  s5: { domain: "saas", text: "Cobalt CRM was launched in 2019." },
  s6: { domain: "saas", text: "Cobalt aims to become the most trusted CRM for small European businesses." },
  s7: { domain: "saas", text: "Customer support is available on weekdays from 9:00 to 18:00 CET." },
  s8: { domain: "saas", text: "Cobalt CRM integrates with Gmail and Outlook." },
  /* Manufacturing — "Ferro Valves" */
  m1: { domain: "manufacturing", text: "Ferro valves are designed in Germany." },
  m2: { domain: "manufacturing", text: "Ferro valves are assembled in our plant in Brno, Czech Republic." },
  m3: { domain: "manufacturing", text: "Standard valves carry a two-year warranty." },
  m4: { domain: "manufacturing", text: "Ferro valves are rated for pressures up to 40 bar." },
  m5: { domain: "manufacturing", text: "The Brno plant is certified to ISO 9001." },
  m6: { domain: "manufacturing", text: "Ferro plans to reduce plant energy use by 20% by 2028." },
  m7: { domain: "manufacturing", text: "Ferro was founded in 1987." },
  /* Professional services — "Halden Advisory" */
  p1: { domain: "professional-services", text: "Halden Advisory provides tax and accounting services to small businesses." },
  p2: { domain: "professional-services", text: "Halden Advisory has offices in Leeds and Manchester." },
  p3: { domain: "professional-services", text: "Initial consultations are free of charge." },
  p4: { domain: "professional-services", text: "Halden Advisory employs 35 people." },
  p5: { domain: "professional-services", text: "Halden Advisory wants to be known as the most approachable accounting firm in the North of England." },
  /* Retail / e-commerce — "Lumen Rugs" (mixed-language records, as many small exporters keep them) */
  r1: { domain: "retail", text: "Lumen Rugs el dokuması kilimler ve yün halılar satar." },
  r2: { domain: "retail", text: "Orders over 200 euros ship free within the EU." },
  r3: { domain: "retail", text: "Returns are accepted within 30 days of delivery." },
  r4: { domain: "retail", text: "Lumen Rugs aims to become the leading affordable handmade-rug brand." },
  r5: { domain: "retail", text: "Rugs are made from undyed sheep wool." },
  r6: { domain: "retail", text: "Lumen Rugs ağırlıklı olarak Almanya ve Hollanda'ya satış yapar." },
  /* B2B logistics — "Orbis Freight" */
  l1: { domain: "logistics", text: "Orbis Freight operates 40 trucks." },
  l2: { domain: "logistics", text: "Orbis Freight delivers within Spain and Portugal." },
  l3: { domain: "logistics", text: "Same-day delivery is available in Madrid." },
  l4: { domain: "logistics", text: "Orbis Freight vehicles are tracked by GPS." },
  l5: { domain: "logistics", text: "Orbis Freight became carbon-neutral certified in 2023." },
};

const ALL = (domain: Domain) => Object.keys(FACTS).filter((k) => FACTS[k]!.domain === domain);

export interface RealisticCase {
  readonly id: string;
  readonly domain: Domain;
  /** Fact keys supplied; `null` = the evidence could not be read. */
  readonly evidence: readonly string[] | null;
  readonly provenance: "matched" | "bounded-universe" | "no-match" | "unavailable";
  readonly claim: string;
  readonly gold: RealisticGold;
  readonly category: Category;
  readonly need: Need;
  /** Claim language vs evidence language. */
  readonly lang: "same" | "cross";
  readonly multiFact: boolean;
  readonly reason: string;
}

type Row = [id: string, domain: Domain, evidence: readonly string[] | null, claim: string, gold: RealisticGold, category: Category, need: Need, lang: "same" | "cross", reason: string];

const ROWS: readonly Row[] = [
  /* ── SaaS ── */
  ["saas-exact", "saas", ["s1"], "The Enterprise plan supports up to 100 users.", "supported", "exact", "none", "same", "verbatim"],
  ["saas-users-para", "saas", ["s1"], "Enterprise customers can have up to 100 users.", "supported", "paraphrase", "A", "same", "same limit, reworded"],
  ["saas-unlimited", "saas", ["s1"], "The Enterprise plan supports unlimited users.", "insufficient", "numeric", "H", "same", "a cap of 100 does not establish unlimited"],
  ["saas-200", "saas", ["s1"], "The Enterprise plan supports up to 200 users.", "contradicted", "contradiction", "D", "same", "record caps at 100"],
  ["saas-germany", "saas", ["s2"], "Your data is hosted in Germany.", "supported", "paraphrase", "A", "same", "Frankfurt, Germany"],
  ["saas-eu-always", "saas", ["s2"], "Customer data never leaves the EU.", "insufficient", "universal", "H", "same", "hosting location is not a transfer guarantee"],
  ["saas-iso", "saas", ["s3"], "Cobalt CRM is certified to ISO 27001.", "supported", "exact", "none", "same", "verbatim"],
  ["saas-soc2", "saas", ["s3"], "Cobalt CRM is SOC 2 certified.", "insufficient", "certification", "H", "same", "a different certification"],
  ["saas-price-para", "saas", ["s4"], "Starter costs 29 euros per user each month.", "supported", "pricing", "A", "same", "same price, reworded"],
  ["saas-price-wrong", "saas", ["s4"], "The Starter plan costs 19 euros per user per month.", "contradicted", "pricing", "D", "same", "record says 29"],
  ["saas-trial", "saas", ["s4"], "Starter includes a free 14-day trial.", "insufficient", "pricing", "H", "same", "no trial is recorded"],
  ["saas-since", "saas", ["s5"], "Cobalt CRM has been on the market since 2019.", "supported", "date", "A", "same", "launched in 2019"],
  ["saas-launch-wrong", "saas", ["s5"], "Cobalt CRM was launched in 2015.", "contradicted", "date", "D", "same", "record says 2019"],
  ["saas-goal", "saas", ["s6"], "Cobalt is the most trusted CRM for small European businesses.", "insufficient", "goal", "F", "same", "an aim is not an achieved state"],
  ["saas-goal-exact", "saas", ["s6"], "Cobalt aims to become the most trusted CRM for small European businesses.", "supported", "positioning", "none", "same", "verbatim aim"],
  ["saas-247", "saas", ["s7"], "Customer support is available 24/7.", "contradicted", "contradiction", "D", "same", "weekdays 9–18 only"],
  ["saas-hours-para", "saas", ["s7"], "Support is open Monday to Friday, 9:00 to 18:00 CET.", "supported", "paraphrase", "A", "same", "weekdays = Monday to Friday"],
  ["saas-multi", "saas", ["s8", "s3"], "Cobalt CRM integrates with Gmail and Outlook and is certified to ISO 27001.", "supported", "multi-fact", "C", "same", "two records jointly"],
  ["saas-partial", "saas", ["s8"], "Cobalt CRM integrates with Gmail, Outlook and Slack.", "insufficient", "partial", "H", "same", "Slack is not recorded"],
  ["saas-causal", "saas", ["s3"], "Because Cobalt is ISO 27001 certified, your data can never be breached.", "insufficient", "causal", "H", "same", "certification does not guarantee no breach"],
  ["saas-fastest", "saas", ["s5"], "Cobalt CRM is currently the fastest-growing CRM in Europe.", "insufficient", "current-state", "H", "same", "no growth data"],
  ["saas-bounded-none", "saas", ALL("saas"), "Cobalt CRM offers a mobile app for iOS and Android.", "insufficient", "bounded-universe", "H", "same", "eight records supplied, none mentions a mobile app"],
  ["saas-bounded-one", "saas", ALL("saas"), "The Enterprise plan supports up to 100 users.", "supported", "bounded-universe", "none", "same", "one of eight records states it"],
  ["saas-xlang", "saas", ["s1"], "Enterprise planı 100 kullanıcıya kadar destekler.", "supported", "cross-language", "B", "cross", "Turkish rendering of the record"],
  ["saas-xlang-bad", "saas", ["s1"], "Enterprise planı sınırsız kullanıcı destekler.", "insufficient", "cross-language", "H", "cross", "'unlimited' in Turkish"],
  ["saas-cheapest", "saas", ["s4"], "Cobalt CRM is the cheapest CRM on the market.", "insufficient", "superlative", "H", "same", "a price is not a market comparison"],
  ["saas-customers", "saas", ["s7"], "Cobalt CRM has 10,000 customers.", "insufficient", "quantity", "H", "same", "no customer count recorded"],
  ["saas-no-evidence", "saas", [], "The Enterprise plan supports up to 100 users.", "insufficient", "no-evidence", "none", "same", "nothing supplied"],
  ["saas-unavailable", "saas", null, "The Enterprise plan supports up to 100 users.", "unavailable", "unavailable", "none", "same", "evidence unreadable"],

  /* ── Manufacturing ── */
  ["mfg-exact", "manufacturing", ["m1"], "Ferro valves are designed in Germany.", "supported", "exact", "none", "same", "verbatim"],
  ["mfg-design-para", "manufacturing", ["m1"], "Our valves are designed in Germany.", "supported", "paraphrase", "A", "same", "same statement, first person"],
  ["mfg-made-de", "manufacturing", ["m1"], "Our valves are manufactured entirely in Germany.", "insufficient", "provenance", "H", "same", "designed is not manufactured"],
  ["mfg-made-de-contra", "manufacturing", ["m1", "m2"], "Our valves are manufactured entirely in Germany.", "contradicted", "provenance", "D", "same", "assembled in the Czech Republic"],
  ["mfg-brno-para", "manufacturing", ["m2"], "Ferro valves are assembled in Brno.", "supported", "paraphrase", "A", "same", "narrower restatement"],
  ["mfg-warranty", "manufacturing", ["m3"], "Standard valves carry a two-year warranty.", "supported", "exact", "none", "same", "verbatim"],
  ["mfg-warranty-5", "manufacturing", ["m3"], "All Ferro valves carry a five-year warranty.", "contradicted", "numeric", "D", "same", "two years for standard valves"],
  ["mfg-lifetime", "manufacturing", ["m3"], "Ferro valves come with a lifetime warranty.", "contradicted", "property", "D", "same", "two years"],
  ["mfg-bar-para", "manufacturing", ["m4"], "Ferro valves handle pressures of up to 40 bar.", "supported", "property", "A", "same", "rated = handle, same limit"],
  ["mfg-bar-60", "manufacturing", ["m4"], "Ferro valves are rated for 60 bar.", "contradicted", "numeric", "D", "same", "rated up to 40"],
  ["mfg-iso-plant", "manufacturing", ["m5"], "Our Brno plant is ISO 9001 certified.", "supported", "certification", "A", "same", "same certification, reworded"],
  ["mfg-iso-product", "manufacturing", ["m5"], "Every Ferro valve is ISO 9001 certified.", "insufficient", "certification", "H", "same", "a plant certification is not a product certification"],
  ["mfg-goal-done", "manufacturing", ["m6"], "Ferro has reduced plant energy use by 20%.", "insufficient", "goal", "F", "same", "a plan is not a result"],
  ["mfg-goal-exact", "manufacturing", ["m6"], "Ferro plans to reduce plant energy use by 20% by 2028.", "supported", "goal", "none", "same", "verbatim plan"],
  ["mfg-founded-para", "manufacturing", ["m7"], "Ferro was established in 1987.", "supported", "date", "A", "same", "founded = established"],
  ["mfg-experience", "manufacturing", ["m7"], "Ferro has more than 35 years of history.", "supported", "date", "E", "same", "1987 to 2026 is 39 years"],
  ["mfg-multi", "manufacturing", ["m1", "m2"], "Ferro valves are designed in Germany and assembled in the Czech Republic.", "supported", "multi-fact", "C", "same", "two records jointly"],
  ["mfg-bounded-none", "manufacturing", ALL("manufacturing"), "Ferro valves are used by NASA.", "insufficient", "bounded-universe", "H", "same", "seven records, no customer named"],
  ["mfg-durable", "manufacturing", ["m3", "m4"], "Ferro makes the most durable valves in Europe.", "insufficient", "superlative", "H", "same", "no comparison recorded"],
  ["mfg-xlang", "manufacturing", ["m1"], "Ferro-Ventile werden in Deutschland entwickelt.", "supported", "cross-language", "B", "cross", "German rendering"],
  ["mfg-xlang-bad", "manufacturing", ["m1"], "Ferro-Ventile werden vollständig in Deutschland hergestellt.", "insufficient", "cross-language", "H", "cross", "'manufactured entirely' in German"],
  ["mfg-causal", "manufacturing", ["m5"], "Thanks to our ISO 9001 certification, our valves never fail.", "insufficient", "causal", "H", "same", "certification does not establish zero failures"],
  ["mfg-expanding", "manufacturing", ["m2"], "We are now expanding our Brno plant.", "insufficient", "current-state", "H", "same", "no expansion recorded"],
  ["mfg-partial", "manufacturing", ["m3", "m4"], "Standard valves carry a two-year warranty and are rated for up to 40 bar and 120°C.", "insufficient", "partial", "H", "same", "temperature rating not recorded"],

  /* ── Professional services ── */
  ["ps-exact", "professional-services", ["p1"], "Halden Advisory provides tax and accounting services to small businesses.", "supported", "exact", "none", "same", "verbatim"],
  ["ps-para", "professional-services", ["p1"], "We help small businesses with tax and accounting.", "supported", "paraphrase", "A", "same", "same service, reworded"],
  ["ps-audit", "professional-services", ["p1"], "Halden Advisory provides audit services to listed companies.", "insufficient", "relevant-insufficient", "H", "same", "different service, different clients"],
  ["ps-offices", "professional-services", ["p2"], "We have offices in Leeds and Manchester.", "supported", "geographic", "A", "same", "first person"],
  ["ps-london", "professional-services", ["p2"], "We have offices in Leeds, Manchester and London.", "insufficient", "partial", "H", "same", "London not recorded"],
  ["ps-free", "professional-services", ["p3"], "Your first consultation is free.", "supported", "pricing", "A", "same", "initial = first"],
  ["ps-free-all", "professional-services", ["p3"], "All consultations are free of charge.", "insufficient", "universal", "H", "same", "only the initial one"],
  ["ps-team", "professional-services", ["p4"], "Our team of 35 people is ready to help.", "supported", "quantity", "A", "same", "35 employees"],
  ["ps-team-50", "professional-services", ["p4"], "Halden Advisory employs over 50 people.", "contradicted", "quantity", "D", "same", "35"],
  ["ps-goal", "professional-services", ["p5"], "Halden Advisory is the most approachable accounting firm in the North of England.", "insufficient", "positioning", "F", "same", "wanting to be known as is not being"],
  ["ps-goal-exact", "professional-services", ["p5"], "Halden Advisory wants to be known as the most approachable accounting firm in the North of England.", "supported", "positioning", "none", "same", "verbatim"],
  ["ps-multi", "professional-services", ["p2", "p4"], "Our 35 people work from offices in Leeds and Manchester.", "supported", "multi-fact", "C", "same", "two records jointly"],
  ["ps-chartered", "professional-services", ["p1"], "All our accountants are chartered.", "insufficient", "certification", "H", "same", "no qualification recorded"],
  ["ps-bounded-none", "professional-services", ALL("professional-services"), "Halden Advisory has won the Yorkshire Business Award.", "insufficient", "bounded-universe", "H", "same", "no award recorded"],
  ["ps-bounded-one", "professional-services", ALL("professional-services"), "Initial consultations are free of charge.", "supported", "bounded-universe", "none", "same", "one of five records"],
  ["ps-causal", "professional-services", ["p4", "p1"], "Because we are a small team, every client gets a personal advisor.", "insufficient", "causal", "H", "same", "no such policy recorded"],
  ["ps-xlang", "professional-services", ["p3"], "İlk danışmanlık görüşmesi ücretsizdir.", "supported", "cross-language", "B", "cross", "Turkish rendering"],
  ["ps-opening", "professional-services", ["p2"], "We are currently opening a new office in Liverpool.", "insufficient", "current-state", "H", "same", "not recorded"],

  /* ── Retail / e-commerce ── */
  ["ret-xlang", "retail", ["r1"], "Lumen Rugs sells handwoven kilims and wool rugs.", "supported", "cross-language", "B", "cross", "'el dokuması' = handwoven"],
  ["ret-knotted", "retail", ["r1"], "Every Lumen rug is hand-knotted by master artisans.", "insufficient", "provenance", "H", "cross", "handwoven category is not a knotting method or artisan claim"],
  ["ret-ship-exact", "retail", ["r2"], "Orders over 200 euros ship free within the EU.", "supported", "exact", "none", "same", "verbatim"],
  ["ret-ship-all", "retail", ["r2"], "Shipping is free on all orders.", "insufficient", "universal", "H", "same", "free only over 200 euros"],
  ["ret-ship-world", "retail", ["r2"], "Orders over 200 euros ship free worldwide.", "insufficient", "geographic", "H", "same", "EU only"],
  ["ret-returns-para", "retail", ["r3"], "You can return your rug within 30 days of delivery.", "supported", "paraphrase", "A", "same", "same window"],
  ["ret-returns-60", "retail", ["r3"], "Returns are accepted within 60 days of delivery.", "contradicted", "numeric", "D", "same", "30 days"],
  ["ret-goal", "retail", ["r4"], "Lumen Rugs is the leading affordable handmade-rug brand.", "insufficient", "goal", "F", "same", "aim, not achieved"],
  ["ret-goal-exact", "retail", ["r4"], "Lumen Rugs aims to become the leading affordable handmade-rug brand.", "supported", "goal", "none", "same", "verbatim aim"],
  ["ret-undyed", "retail", ["r5"], "Our rugs are made from undyed sheep wool.", "supported", "property", "A", "same", "first person"],
  ["ret-dyed", "retail", ["r5"], "Our rugs are coloured with natural dyes.", "contradicted", "property", "D", "same", "undyed"],
  ["ret-organic", "retail", ["r5"], "Our rugs are made from organic wool.", "insufficient", "certification", "H", "same", "organic not recorded"],
  ["ret-markets", "retail", ["r6"], "We mainly sell to Germany and the Netherlands.", "supported", "cross-language", "B", "cross", "Almanya = Germany, Hollanda = the Netherlands"],
  ["ret-markets-us", "retail", ["r6"], "We mainly sell to the United States.", "contradicted", "geographic", "D", "cross", "mainly Germany and the Netherlands"],
  ["ret-multi", "retail", ["r2", "r3"], "Orders over 200 euros ship free within the EU, and returns are accepted within 30 days of delivery.", "supported", "multi-fact", "C", "same", "two records jointly"],
  ["ret-bounded-none", "retail", ALL("retail"), "Each rug comes with a certificate of authenticity.", "insufficient", "bounded-universe", "H", "same", "not recorded"],
  ["ret-percent", "retail", ["r6"], "70% of our sales go to Germany.", "insufficient", "percentage", "H", "cross", "no share recorded"],
  ["ret-new", "retail", ["r1"], "Our new spring collection is now available.", "insufficient", "current-state", "H", "cross", "not recorded"],

  /* ── B2B logistics ── */
  ["log-exact", "logistics", ["l1"], "Orbis Freight operates 40 trucks.", "supported", "exact", "none", "same", "verbatim"],
  ["log-fleet-para", "logistics", ["l1"], "Our fleet has 40 trucks.", "supported", "quantity", "A", "same", "same count"],
  ["log-fleet-100", "logistics", ["l1"], "Orbis Freight operates more than 100 trucks.", "contradicted", "quantity", "D", "same", "40"],
  ["log-coverage-para", "logistics", ["l2"], "We deliver across Spain and Portugal.", "supported", "geographic", "A", "same", "same coverage"],
  ["log-france", "logistics", ["l2"], "We deliver across Spain, Portugal and France.", "insufficient", "partial", "H", "same", "France not recorded"],
  ["log-sameday-spain", "logistics", ["l3"], "Same-day delivery is available across Spain.", "insufficient", "geographic", "H", "same", "Madrid only"],
  ["log-sameday", "logistics", ["l3"], "Same-day delivery is available in Madrid.", "supported", "exact", "none", "same", "verbatim"],
  ["log-gps-para", "logistics", ["l4"], "Our vehicles are GPS-tracked.", "supported", "paraphrase", "A", "same", "same property"],
  ["log-app", "logistics", ["l4"], "Customers can follow their parcel in real time in our app.", "insufficient", "relevant-insufficient", "H", "same", "vehicle tracking is not a customer app"],
  ["log-carbon", "logistics", ["l5"], "Orbis Freight became carbon-neutral certified in 2023.", "supported", "certification", "none", "same", "verbatim"],
  ["log-carbon-always", "logistics", ["l5"], "Orbis Freight has always been carbon-neutral.", "insufficient", "universal", "E", "same", "only since 2023"],
  ["log-multi", "logistics", ["l1", "l2"], "With 40 trucks, we deliver across Spain and Portugal.", "supported", "multi-fact", "C", "same", "two records jointly"],
  ["log-xlang", "logistics", ["l3"], "Madrid'de aynı gün teslimat mevcuttur.", "supported", "cross-language", "B", "cross", "Turkish rendering"],
  ["log-bounded-one", "logistics", ALL("logistics"), "Orbis Freight vehicles are tracked by GPS.", "supported", "bounded-universe", "none", "same", "one of five records"],
  ["log-causal", "logistics", ["l4"], "Because our trucks are GPS-tracked, deliveries are never late.", "insufficient", "causal", "H", "same", "tracking does not establish punctuality"],
  ["log-no-evidence", "logistics", [], "Orbis Freight operates 40 trucks.", "insufficient", "no-evidence", "none", "same", "nothing supplied"],
  ["log-unavailable", "logistics", null, "Orbis Freight operates 40 trucks.", "unavailable", "unavailable", "none", "same", "evidence unreadable"],
];

export const CASES: readonly RealisticCase[] = ROWS.map(([id, domain, evidence, claim, gold, category, need, lang, reason]) => ({
  id, domain, evidence, claim, gold, category, need, lang, reason,
  multiFact: (evidence?.length ?? 0) > 1 && category === "multi-fact",
  provenance: evidence === null ? "unavailable" : evidence.length === 0 ? "no-match" : evidence.length > 2 ? "bounded-universe" : "matched",
}));
