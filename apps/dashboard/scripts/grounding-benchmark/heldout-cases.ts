/*
 * GROUNDING SUFFICIENCY GS-1.2 — HELD-OUT benchmark. SYNTHETIC DATA. FROZEN before any evaluator ran on it.
 *
 * Six FICTIONAL organizations in six sectors none of which GS-0 (rugs) or GS-1.1 (SaaS, manufacturing,
 * professional services, retail, logistics) used. No record, claim or organization name is reused or
 * paraphrased from those sets; no tenant text was read. Labels were written by hand from the meaning of
 * claim and records only — no evaluator (Pass 1 or the GS-1.1 Pass-2 candidate) was run while writing,
 * and no provider or model API produced a label. This module imports NOTHING.
 *
 * Authorship, stated plainly: the labels were hand-written by the coding agent (Claude) in-session, not
 * by a human reviewer. The agent knew the four candidate rules while writing; cases target them on
 * purpose (should fire / must not fire), phrased naturally rather than from the rules' word lists.
 *
 * Gold answers one question: do the supplied records establish the claim?
 *   supported     a careful reader would say the records state it (paraphrase and translation included)
 *   insufficient  they do not state it
 *   contradicted  a supplied record states something incompatible
 *   unavailable   the evidence could not be read
 *
 * `rule` tags the GS-1.1 candidate rule a case exercises — on a supported case the rule must NOT fire,
 * on an unsupported one it should. Tagged with the case, not after scoring.
 */
export const SYNTHETIC_BENCHMARK = true as const;

export type HeldoutDomain = "healthcare" | "hospitality" | "education" | "food" | "energy" | "furniture";
export type HeldoutGold = "supported" | "insufficient" | "contradicted" | "unavailable";
export type HeldoutRule = "hyphen" | "calendar" | "scope" | "aspiration" | null;
export type HeldoutCategory =
  | "exact" | "paraphrase" | "cross-language" | "numeric" | "pricing" | "property" | "provenance" | "superlative"
  | "universal" | "scope" | "calendar" | "goal" | "multi-fact" | "partial" | "contradiction" | "unrelated"
  | "bounded-universe" | "no-evidence" | "unavailable";

export const HELDOUT_FACTS: Readonly<Record<string, { readonly domain: HeldoutDomain; readonly text: string }>> = {
  /* Healthcare — "Morrow Dental" */
  h1: { domain: "healthcare", text: "Morrow Dental opens Monday to Saturday from 8:00 to 20:00." },
  h2: { domain: "healthcare", text: "Morrow Dental has four dentists on staff." },
  h3: { domain: "healthcare", text: "Teeth whitening at Morrow Dental costs 250 euros." },
  h4: { domain: "healthcare", text: "Morrow Dental plans to open a second clinic in Porto in 2027." },
  h5: { domain: "healthcare", text: "Morrow Dental is located in Lisbon." },
  h6: { domain: "healthcare", text: "Morrow Dental uses digital X-ray equipment." },
  h7: { domain: "healthcare", text: "Emergency appointments are available on Sunday mornings." },
  h8: { domain: "healthcare", text: "Patients receive unlimited free check-ups for one year after treatment." },
  /* Hospitality — "Alder Lodge" */
  o1: { domain: "hospitality", text: "Alder Lodge has 24 guest rooms." },
  o2: { domain: "hospitality", text: "Breakfast is served from 7:00 to 10:30." },
  o3: { domain: "hospitality", text: "Alder Lodge is a pet-friendly hotel." },
  o4: { domain: "hospitality", text: "Alder Lodge is open from April to October." },
  o5: { domain: "hospitality", text: "Alder Lodge aims to be fully powered by renewable energy." },
  o6: { domain: "hospitality", text: "Free Wi-Fi is available in all rooms." },
  o7: { domain: "hospitality", text: "Sauna access is unlimited for hotel guests." },
  /* Education — "Brightpath" language school */
  e1: { domain: "education", text: "Brightpath offers Spanish and French courses for adults." },
  e2: { domain: "education", text: "Group classes have a maximum of 8 students." },
  e3: { domain: "education", text: "Brightpath courses start every January, April and September." },
  e5: { domain: "education", text: "Brightpath hopes to offer online courses in the future." },
  e6: { domain: "education", text: "Brightpath teachers are native speakers." },
  e7: { domain: "education", text: "Brightpath, Ankara'da iki şubeyle hizmet verir." },
  e8: { domain: "education", text: "The Brightpath placement test can be taken online from anywhere in the world." },
  /* Food / agriculture — "Kestrel" olive estate */
  k1: { domain: "food", text: "Kestrel olive oil is cold-pressed." },
  k2: { domain: "food", text: "Kestrel olives are grown in the Aydın region of Turkey." },
  k3: { domain: "food", text: "Kestrel oil is bottled on the estate." },
  k4: { domain: "food", text: "Kestrel harvests olives in November." },
  k5: { domain: "food", text: "Kestrel sells oil in 500 ml and 1 litre bottles." },
  k6: { domain: "food", text: "Kestrel zeytinyağı organik sertifikalıdır." },
  k7: { domain: "food", text: "Kestrel is working toward exporting to Japan." },
  /* Energy — "Solvane" rooftop solar installer */
  v1: { domain: "energy", text: "Solvane installs rooftop solar panels for homes and small businesses." },
  v2: { domain: "energy", text: "Solvane panels come with a 25-year performance warranty." },
  v3: { domain: "energy", text: "Solvane operates in the Valencia region." },
  v4: { domain: "energy", text: "Solvane has completed more than 1,200 installations." },
  v5: { domain: "energy", text: "Solvane's goal is to install solar on 5,000 roofs by 2030." },
  v6: { domain: "energy", text: "A typical home installation takes two days." },
  v7: { domain: "energy", text: "Solvane is a certified installer under the Spanish Self-Consumption Programme." },
  v8: { domain: "energy", text: "Solvane customers get unlimited phone support during installation." },
  /* Furniture — "Derin Mobilya" (Turkish records) */
  d1: { domain: "furniture", text: "Derin Mobilya masif meşe ağacından masa üretir." },
  d2: { domain: "furniture", text: "Derin Mobilya'nın atölyesi Bursa'dadır." },
  d3: { domain: "furniture", text: "Siparişler 6 hafta içinde teslim edilir." },
  d4: { domain: "furniture", text: "Derin Mobilya yurt dışına satış yapmayı hedefliyor." },
  d5: { domain: "furniture", text: "Derin Mobilya 2011'de kuruldu." },
};

export interface HeldoutCase {
  readonly id: string;
  readonly domain: HeldoutDomain;
  /** Fact keys supplied; `null` = the evidence could not be read. */
  readonly evidence: readonly string[] | null;
  readonly provenance: "matched" | "bounded-universe" | "no-match" | "unavailable";
  readonly claim: string;
  readonly gold: HeldoutGold;
  readonly category: HeldoutCategory;
  readonly rule: HeldoutRule;
  readonly lang: "same" | "cross";
  readonly multiFact: boolean;
  readonly reason: string;
}

const ALL = (domain: HeldoutDomain) => Object.keys(HELDOUT_FACTS).filter((k) => HELDOUT_FACTS[k]!.domain === domain);
const BOUNDED = "bounded" as const;

type Row = [id: string, domain: HeldoutDomain, evidence: readonly string[] | null | typeof BOUNDED, claim: string, gold: HeldoutGold, category: HeldoutCategory, rule: HeldoutRule, lang: "same" | "cross", reason: string];

const ROWS: readonly Row[] = [
  /* ── Healthcare ── */
  ["h-exact", "healthcare", ["h5"], "Morrow Dental is located in Lisbon.", "supported", "exact", null, "same", "verbatim"],
  ["h-six-days", "healthcare", ["h1"], "The clinic is open six days a week, Monday through Saturday.", "supported", "calendar", "calendar", "same", "Monday to Saturday is six days"],
  ["h-sundays", "healthcare", ["h1"], "Morrow Dental is open on Sundays.", "insufficient", "calendar", "calendar", "same", "regular hours stop at Saturday; nothing says Sunday"],
  ["h-sunday-exact", "healthcare", ["h1", "h7"], "Emergency appointments are available on Sunday mornings.", "supported", "exact", "calendar", "same", "verbatim h7"],
  ["h-sunday-para", "healthcare", ["h7"], "You can get an emergency appointment on a Sunday morning.", "supported", "paraphrase", "calendar", "same", "same availability, reworded"],
  ["h-dentists", "healthcare", ["h2"], "Four dentists work at Morrow Dental.", "supported", "paraphrase", null, "same", "same staff count"],
  ["h-dentists-six", "healthcare", ["h2"], "Morrow Dental has six dentists on staff.", "contradicted", "contradiction", null, "same", "record says four"],
  ["h-porto-fact", "healthcare", ["h4"], "Morrow Dental has a second clinic in Porto.", "insufficient", "goal", "aspiration", "same", "a plan is not an opened clinic"],
  ["h-porto-keep", "healthcare", ["h4"], "Morrow Dental intends to open another clinic in Porto in 2027.", "supported", "paraphrase", "aspiration", "same", "the plan is kept as a plan"],
  ["h-whitening", "healthcare", ["h3"], "Teeth whitening costs 250 euros at Morrow Dental.", "supported", "pricing", null, "same", "same price, reordered"],
  ["h-all-digital", "healthcare", ["h6"], "Every treatment at Morrow Dental is fully digital.", "insufficient", "universal", null, "same", "digital X-ray is not every treatment"],
  ["h-low-dose", "healthcare", ["h6"], "Morrow Dental uses low-radiation digital X-ray equipment.", "insufficient", "property", "hyphen", "same", "low radiation is not recorded"],
  ["h-xray-para", "healthcare", ["h6"], "The clinic takes X-rays digitally.", "supported", "paraphrase", "hyphen", "same", "digital X-ray equipment"],
  ["h-lizbon", "healthcare", ["h5"], "Morrow Dental Lizbon'da bulunuyor.", "supported", "cross-language", null, "cross", "Lisbon, in Turkish"],
  ["h-best-rated", "healthcare", BOUNDED, "Morrow Dental is the best-rated dental clinic in Lisbon.", "insufficient", "bounded-universe", "hyphen", "same", "no rating is recorded anywhere"],
  ["h-checkups", "healthcare", ["h8"], "For a year after treatment, Morrow Dental patients get unlimited free check-ups.", "supported", "scope", "scope", "same", "unlimited is recorded"],
  ["h-multi", "healthcare", ["h2", "h5"], "Morrow Dental is a Lisbon clinic with four dentists.", "supported", "multi-fact", null, "same", "location + staff, two records"],
  ["h-unavailable", "healthcare", null, "Morrow Dental opens Monday to Saturday from 8:00 to 20:00.", "unavailable", "unavailable", null, "same", "evidence unreadable, even for a verbatim claim"],

  /* ── Hospitality ── */
  ["o-rooms", "hospitality", ["o1"], "Alder Lodge has 24 guest rooms.", "supported", "exact", null, "same", "verbatim"],
  ["o-rooms-42", "hospitality", ["o1"], "Alder Lodge has 42 guest rooms.", "contradicted", "contradiction", null, "same", "record says 24"],
  ["o-breakfast", "hospitality", ["o2"], "Breakfast runs from 7:00 until 10:30.", "supported", "paraphrase", null, "same", "same hours"],
  ["o-pets", "hospitality", ["o3"], "Pets are welcome at Alder Lodge.", "supported", "paraphrase", null, "same", "pet-friendly"],
  ["o-pet-exact", "hospitality", ["o3"], "Alder Lodge is a pet-friendly hotel.", "supported", "exact", "hyphen", "same", "verbatim, lower-case hyphen"],
  ["o-season", "hospitality", ["o4"], "Alder Lodge is open from April to October.", "supported", "exact", "calendar", "same", "verbatim"],
  ["o-season-para", "hospitality", ["o4"], "Alder Lodge welcomes guests between April and October.", "supported", "paraphrase", "calendar", "same", "same season"],
  ["o-year-round", "hospitality", ["o4"], "Alder Lodge is open all year round.", "contradicted", "contradiction", null, "same", "seasonal opening"],
  ["o-december", "hospitality", ["o4"], "Alder Lodge hosts guests in December.", "contradicted", "calendar", "calendar", "same", "December is outside the April–October season"],
  ["o-renew-fact", "hospitality", ["o5"], "Alder Lodge runs entirely on renewable energy.", "insufficient", "goal", "aspiration", "same", "an aim is not the current state"],
  ["o-renew-keep", "hospitality", ["o5"], "Alder Lodge aims to run fully on renewable energy.", "supported", "paraphrase", "aspiration", "same", "the aim is kept as an aim"],
  ["o-wifi", "hospitality", ["o6"], "Every room has free Wi-Fi.", "supported", "paraphrase", "hyphen", "same", "all rooms"],
  ["o-wifi-fast", "hospitality", ["o6"], "Free high-speed Wi-Fi is available in all rooms.", "insufficient", "property", "hyphen", "same", "speed is not recorded"],
  ["o-wifi-tr", "hospitality", ["o6"], "Tüm odalarda ücretsiz Wi-Fi bulunmaktadır.", "supported", "cross-language", "hyphen", "cross", "same, in Turkish"],
  ["o-pool", "hospitality", ["o2"], "Alder Lodge has an outdoor swimming pool.", "insufficient", "unrelated", null, "same", "supplied record is about breakfast"],
  ["o-sauna", "hospitality", ["o7"], "Alder Lodge guests have unlimited sauna access.", "supported", "scope", "scope", "same", "unlimited is recorded"],
  ["o-bounded", "hospitality", BOUNDED, "Alder Lodge has 24 guest rooms and is pet-friendly.", "supported", "bounded-universe", "hyphen", "same", "two records in the universe"],
  ["o-no-evidence", "hospitality", [], "Alder Lodge has a spa.", "insufficient", "no-evidence", null, "same", "nothing supplied"],

  /* ── Education ── */
  ["e-courses", "education", ["e1"], "Brightpath offers Spanish and French courses for adults.", "supported", "exact", null, "same", "verbatim"],
  ["e-courses-para", "education", ["e1"], "Adults can study Spanish or French at Brightpath.", "supported", "paraphrase", null, "same", "same offer"],
  ["e-german", "education", ["e1"], "Brightpath offers German courses for adults.", "insufficient", "partial", null, "same", "German is not offered in the record"],
  ["e-eight", "education", ["e2"], "Group classes are limited to eight students.", "supported", "numeric", null, "same", "8 as a word"],
  ["e-twelve", "education", ["e2"], "Group classes have up to 12 students.", "contradicted", "contradiction", null, "same", "maximum is 8"],
  ["e-start", "education", ["e3"], "New courses begin in January, April and September.", "supported", "calendar", "calendar", "same", "same intakes"],
  ["e-monthly", "education", ["e3"], "Brightpath courses start every month.", "contradicted", "contradiction", null, "same", "three intakes a year"],
  ["e-online-fact", "education", ["e5"], "Brightpath offers online courses.", "insufficient", "goal", "aspiration", "same", "a hope is not an offer"],
  ["e-online-keep", "education", ["e5"], "Brightpath hopes to offer online courses in the future.", "supported", "exact", "aspiration", "same", "verbatim hope"],
  ["e-native", "education", ["e6"], "All Brightpath teachers are native speakers.", "supported", "paraphrase", null, "same", "generic plural states it of the teachers"],
  ["e-degrees", "education", ["e6"], "Brightpath teachers are native speakers with university teaching degrees.", "insufficient", "partial", null, "same", "degrees not recorded"],
  ["e-ankara", "education", ["e7"], "Brightpath has two branches in Ankara.", "supported", "cross-language", null, "cross", "iki şube = two branches"],
  ["e-istanbul", "education", ["e7"], "Brightpath has branches in Ankara and Istanbul.", "insufficient", "partial", null, "cross", "Istanbul not recorded"],
  ["e-worldwide", "education", ["e7"], "Brightpath teaches students around the world.", "insufficient", "scope", "scope", "cross", "two Ankara branches is not global reach"],
  ["e-test-worldwide", "education", ["e8"], "Brightpath's placement test can be taken online worldwide.", "supported", "scope", "scope", "same", "anywhere in the world = worldwide"],
  ["e-no-evidence", "education", [], "Brightpath has taught over 3,000 students.", "insufficient", "no-evidence", null, "same", "nothing supplied"],

  /* ── Food ── */
  ["k-cold", "food", ["k1"], "Kestrel olive oil is cold-pressed.", "supported", "exact", "hyphen", "same", "verbatim"],
  ["k-cold-para", "food", ["k1"], "Kestrel's oil is produced by cold pressing.", "supported", "provenance", null, "same", "same method"],
  ["k-extra-virgin", "food", ["k1"], "Kestrel olive oil is first cold-pressed extra virgin oil.", "insufficient", "provenance", "hyphen", "same", "grade not recorded"],
  ["k-aydin", "food", ["k2"], "Kestrel olives come from Aydın, Turkey.", "supported", "provenance", null, "same", "same region"],
  ["k-aydin-tr", "food", ["k2"], "Kestrel zeytinleri Aydın'da yetiştirilir.", "supported", "cross-language", null, "cross", "same, in Turkish"],
  ["k-hand-picked", "food", ["k2", "k4"], "Kestrel olives are hand-picked in November.", "insufficient", "provenance", "hyphen", "same", "picking method not recorded"],
  ["k-november", "food", ["k4"], "Olives are harvested every November.", "supported", "calendar", "calendar", "same", "habitual harvest month"],
  ["k-bottles", "food", ["k5"], "Kestrel oil comes in half-litre and one-litre bottles.", "supported", "numeric", "hyphen", "same", "500 ml = half a litre"],
  ["k-tins", "food", ["k5"], "Kestrel sells oil in 5 litre tins.", "insufficient", "numeric", null, "same", "size not recorded"],
  ["k-organic", "food", ["k6"], "Kestrel olive oil is certified organic.", "supported", "cross-language", null, "cross", "organik sertifikalı"],
  ["k-japan-fact", "food", ["k7"], "Kestrel exports olive oil to Japan.", "insufficient", "goal", "aspiration", "same", "working toward is not exporting"],
  ["k-japan-keep", "food", ["k7"], "Kestrel is preparing to export to Japan.", "supported", "paraphrase", "aspiration", "same", "still framed as in progress"],
  ["k-multi", "food", ["k1", "k3"], "Kestrel oil is cold-pressed and bottled on the estate.", "supported", "multi-fact", "hyphen", "same", "two records"],
  ["k-global", "food", BOUNDED, "Kestrel ships its oil to customers worldwide.", "insufficient", "bounded-universe", "scope", "same", "no shipping scope recorded"],

  /* ── Energy ── */
  ["v-what", "energy", ["v1"], "Solvane installs solar panels on the roofs of homes and small businesses.", "supported", "paraphrase", null, "same", "rooftop"],
  ["v-farms", "energy", ["v1"], "Solvane builds solar farms for utility companies.", "insufficient", "unrelated", null, "same", "rooftop residential/small business only"],
  ["v-warranty", "energy", ["v2"], "Solvane panels come with a 25-year performance warranty.", "supported", "exact", "hyphen", "same", "verbatim"],
  ["v-warranty-30", "energy", ["v2"], "Solvane panels come with a 30-year performance warranty.", "contradicted", "contradiction", "hyphen", "same", "record says 25"],
  ["v-warranty-unlimited", "energy", ["v2"], "Solvane panels come with an unlimited performance warranty.", "contradicted", "scope", "scope", "same", "warranty is 25 years"],
  ["v-valencia", "energy", ["v3"], "Solvane installs panels across the Valencia region.", "supported", "paraphrase", null, "same", "operates in Valencia region"],
  ["v-spain", "energy", ["v3"], "Solvane installs solar panels anywhere in Spain.", "insufficient", "scope", "scope", "same", "one region is not the whole country"],
  ["v-phone", "energy", ["v8"], "During installation, Solvane offers unlimited phone support.", "supported", "scope", "scope", "same", "unlimited is recorded"],
  ["v-count", "energy", ["v4"], "Solvane has completed over 1,200 installations.", "supported", "numeric", null, "same", "more than = over"],
  ["v-count-2000", "energy", ["v4"], "Solvane has completed more than 2,000 installations.", "insufficient", "numeric", null, "same", "more than 1,200 does not establish 2,000"],
  ["v-goal-fact", "energy", ["v5"], "Solvane has installed solar on 5,000 roofs.", "insufficient", "goal", "aspiration", "same", "a 2030 goal is not the current count"],
  ["v-goal-keep", "energy", ["v5"], "By 2030, Solvane wants solar on 5,000 roofs.", "supported", "paraphrase", "aspiration", "same", "goal kept as goal"],
  ["v-programme", "energy", ["v7"], "Solvane is certified under the Spanish Self-Consumption Programme.", "supported", "paraphrase", "hyphen", "same", "same programme"],
  ["v-other-scheme", "energy", ["v7"], "Solvane is certified under the European Green-Installer Scheme.", "insufficient", "partial", "hyphen", "same", "a different, unrecorded scheme"],
  ["v-saturdays", "energy", ["v6"], "Solvane installs on Saturdays at no extra cost.", "insufficient", "calendar", "calendar", "same", "no record mentions Saturday work"],
  ["v-unavailable", "energy", null, "Solvane is the largest installer in Valencia.", "unavailable", "unavailable", null, "same", "evidence unreadable"],

  /* ── Furniture (Turkish records) ── */
  ["d-oak", "furniture", ["d1"], "Derin Mobilya makes tables from solid oak.", "supported", "cross-language", null, "cross", "masif meşe = solid oak"],
  ["d-bursa", "furniture", ["d2"], "Derin Mobilya'nın atölyesi Bursa'da bulunuyor.", "supported", "paraphrase", null, "same", "same location"],
  ["d-six-weeks", "furniture", ["d3"], "Siparişler altı hafta içinde teslim edilir.", "supported", "numeric", null, "same", "6 as a word"],
  ["d-abroad-fact", "furniture", ["d4"], "Derin Mobilya yurt dışına satış yapıyor.", "insufficient", "goal", "aspiration", "same", "hedefliyor (aims) restated as doing"],
  ["d-abroad-keep", "furniture", ["d4"], "Derin Mobilya aims to sell abroad.", "supported", "cross-language", "aspiration", "cross", "aim kept, in English"],
  ["d-founded", "furniture", ["d5"], "Derin Mobilya was founded in 2011.", "supported", "cross-language", null, "cross", "2011'de kuruldu"],
  ["d-founded-2015", "furniture", ["d5"], "Derin Mobilya 2015'te kuruldu.", "contradicted", "contradiction", null, "same", "record says 2011"],
  ["d-dunya", "furniture", ["d2"], "Derin Mobilya dünya çapında teslimat yapar.", "insufficient", "scope", "scope", "same", "a Bursa workshop is not worldwide delivery"],
  ["d-sinirsiz", "furniture", ["d3"], "Derin Mobilya sınırsız ücretsiz teslimat sunar.", "insufficient", "scope", "scope", "same", "no free or unlimited delivery recorded"],
  ["d-bounded", "furniture", BOUNDED, "Derin Mobilya Bursa'daki atölyesinde masif meşe masa üretir.", "supported", "bounded-universe", null, "same", "two records in the universe"],
];

export const HELDOUT_CASES: readonly HeldoutCase[] = ROWS.map(([id, domain, evidence, claim, gold, category, rule, lang, reason]) => {
  const keys = evidence === BOUNDED ? ALL(domain) : evidence;
  return {
    id,
    domain,
    evidence: keys,
    provenance: keys === null ? "unavailable" : evidence === BOUNDED ? "bounded-universe" : keys.length === 0 ? "no-match" : "matched",
    claim,
    gold,
    category,
    rule,
    lang,
    multiFact: category === "multi-fact" || (evidence === BOUNDED && gold === "supported"),
    reason,
  };
});
