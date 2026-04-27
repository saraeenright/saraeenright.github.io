/**
 * FHIR parser for the immunotherapy survival UI.
 *
 * Scope:
 *   1. Accepts three single FHIR resources (not Bundles): Patient, Observation, Condition.
 *   2. Observation values are looked up by hard-coded LOINC codes, either on the
 *      Observation itself or inside its `component[]` array.
 *   3. Cancer type is inferred from `Condition.code.text` via string-contains match.
 *   4. Drug type is also read from the Condition (text / extension / note) — this
 *      is a temporary shortcut until a proper MedicationStatement slot is added.
 *
 * Anything we can't find is returned as `null` and surfaced in `missing` so the
 * caller can warn the user or fall back to the baseline encoding (0) expected
 * by the Cox model.
 */

const LOINC = {
  TMB: "94076-7",
  MUTATION_COUNT: "82120-4",
  TUMOR_PURITY: "33723-0",
};

function isLoincSystem(system) {
  if (!system) return true; // be lenient: many mock fixtures omit `system`
  return system.toLowerCase().includes("loinc");
}

function readNumericValue(node) {
  if (!node) return null;
  if (node.valueQuantity && typeof node.valueQuantity.value === "number") {
    return node.valueQuantity.value;
  }
  if (typeof node.valueInteger === "number") return node.valueInteger;
  if (typeof node.valueDecimal === "number") return node.valueDecimal;
  return null;
}

function codingMatches(codeableConcept, loincCode) {
  const codings = codeableConcept?.coding ?? [];
  return codings.some(
    (c) => c.code === loincCode && isLoincSystem(c.system)
  );
}

/**
 * Look up a numeric value in an Observation by LOINC code.
 * Checks the top-level code first, then scans `component[]`.
 */
function findObservationValue(observation, loincCode) {
  if (!observation) return null;

  if (codingMatches(observation.code, loincCode)) {
    const v = readNumericValue(observation);
    if (v !== null) return v;
  }

  if (Array.isArray(observation.component)) {
    for (const comp of observation.component) {
      if (codingMatches(comp.code, loincCode)) {
        const v = readNumericValue(comp);
        if (v !== null) return v;
      }
    }
  }

  return null;
}

function inferSampleType(observation) {
  const specimenDisplay = observation?.specimen?.display?.toLowerCase() ?? "";
  const specimenType = observation?.specimen?.type?.text?.toLowerCase() ?? "";
  const haystack = `${specimenDisplay} ${specimenType}`.trim();

  if (!haystack) return null;
  if (haystack.includes("primary")) return "Primary";
  if (haystack.includes("metasta")) return "Metastatic";
  if (haystack.includes("recurren")) return "Recurrent";
  return "Unknown";
}

export function extractFromPatient(patient) {
  if (!patient || patient.resourceType !== "Patient") {
    return { birthDate: null, sex: null };
  }
  return {
    birthDate: patient.birthDate ?? null,
    sex: patient.gender ?? null, // "male" | "female" | "other" | "unknown"
  };
}

export function extractFromObservation(observation) {
  if (!observation || observation.resourceType !== "Observation") {
    return {
      tmb: null,
      mutationCount: null,
      tumorPurity: null,
      effectiveDateTime: null,
      sampleType: null,
    };
  }
  return {
    tmb: findObservationValue(observation, LOINC.TMB),
    mutationCount: findObservationValue(observation, LOINC.MUTATION_COUNT),
    tumorPurity: findObservationValue(observation, LOINC.TUMOR_PURITY),
    effectiveDateTime:
      observation.effectiveDateTime ?? observation.issued ?? null,
    sampleType: inferSampleType(observation),
  };
}

const CANCER_KEYWORDS = [
  ["melanoma", "Melanoma"],
  ["non-small cell", "NSCLC"],
  ["nsclc", "NSCLC"],
  ["lung", "NSCLC"],
  ["renal cell", "Renal Cell Carcinoma"],
  ["renal", "Renal Cell Carcinoma"],
  ["kidney", "Renal Cell Carcinoma"],
  ["bladder", "Bladder Cancer"],
  ["urothelial", "Bladder Cancer"],
];

const DRUG_KEYWORDS = [
  ["combo", "Combo"],
  ["combination", "Combo"],
  ["pembrolizumab", "PD-1 Inhibitor"],
  ["nivolumab", "PD-1 Inhibitor"],
  ["pd-1", "PD-1 Inhibitor"],
  ["pd1", "PD-1 Inhibitor"],
  ["atezolizumab", "PD-L1 Inhibitor"],
  ["durvalumab", "PD-L1 Inhibitor"],
  ["pd-l1", "PD-L1 Inhibitor"],
  ["pdl1", "PD-L1 Inhibitor"],
  ["ipilimumab", "CTLA-4 Inhibitor"],
  ["ctla-4", "CTLA-4 Inhibitor"],
  ["ctla4", "CTLA-4 Inhibitor"],
];

function firstKeywordMatch(text, table) {
  const lower = (text ?? "").toLowerCase();
  if (!lower) return null;
  for (const [needle, label] of table) {
    if (lower.includes(needle)) return label;
  }
  return null;
}

function collectConditionText(condition) {
  const parts = [];
  parts.push(condition.code?.text ?? "");
  for (const c of condition.code?.coding ?? []) {
    parts.push(c.display ?? "");
  }
  for (const ext of condition.extension ?? []) {
    parts.push(ext.valueString ?? "");
    parts.push(ext.valueCodeableConcept?.text ?? "");
    for (const c of ext.valueCodeableConcept?.coding ?? []) {
      parts.push(c.display ?? "");
    }
  }
  for (const note of condition.note ?? []) {
    parts.push(note.text ?? "");
  }
  return parts.filter(Boolean).join(" ");
}

export function extractFromCondition(condition) {
  if (!condition || condition.resourceType !== "Condition") {
    return { cancerType: null, drugType: null };
  }
  const cancerText = condition.code?.text
    ?? condition.code?.coding?.[0]?.display
    ?? "";
  const fullText = collectConditionText(condition);

  return {
    cancerType: firstKeywordMatch(cancerText, CANCER_KEYWORDS)
      ?? firstKeywordMatch(fullText, CANCER_KEYWORDS),
    drugType: firstKeywordMatch(fullText, DRUG_KEYWORDS),
  };
}

/**
 * Main entry: convert three parsed FHIR resources into the feature object
 * used by the prediction code (same keys as the manual-input form).
 *
 * Returns `{ features, missing }` where `missing` lists any fields that
 * could not be extracted so the UI can warn the user.
 */
export function extractFeaturesFromFhir({ patient, observation, condition }) {
  const p = extractFromPatient(patient);
  const o = extractFromObservation(observation);
  const c = extractFromCondition(condition);

  let ageAtSequencingDays = null;
  if (p.birthDate && o.effectiveDateTime) {
    const birth = new Date(p.birthDate);
    const seq = new Date(o.effectiveDateTime);
    if (!Number.isNaN(birth.getTime()) && !Number.isNaN(seq.getTime())) {
      ageAtSequencingDays = Math.floor((seq - birth) / 86_400_000);
    }
  }

  const sexMap = { male: "Male", female: "Female" };
  const sex = p.sex ? sexMap[p.sex.toLowerCase()] ?? "Unknown" : null;

  const features = {
    ageAtSequencingDays,
    mutationCount: o.mutationCount,
    tmb: o.tmb,
    tumorPurity: o.tumorPurity,
    cancerType: c.cancerType,
    drugType: c.drugType,
    sex,
    sampleType: o.sampleType,
  };

  const missing = Object.entries(features)
    .filter(([, v]) => v === null || v === undefined || v === "")
    .map(([k]) => k);

  return { features, missing };
}