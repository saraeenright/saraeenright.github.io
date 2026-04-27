# Sample FHIR Resources for Testing

These fixtures are designed to be uploaded into the **File Upload** tab of the
Immunotherapy Survival UI. Each folder contains a single `Patient`,
`Observation`, and `Condition` resource — exactly matching the three upload
slots in the UI.

| Folder | Cancer | Drug | Sex | Sample type | Purpose |
|---|---|---|---|---|---|
| `melanoma-pd1/` | Melanoma | PD-1 Inhibitor (pembrolizumab) | Male | Primary | Happy path; all fields present, drug in `Condition.note` |
| `nsclc-pdl1/` | NSCLC | PD-L1 Inhibitor (atezolizumab) | Female | Metastatic | Drug in `Condition.extension`; one LOINC coding omits `system` |
| `rcc-combo/` | Renal Cell Carcinoma | Combo (ipilimumab + nivolumab) | Female | Primary | TMB on top-level `Observation.code`, others in `component[]` |
| `bladder-missing-purity/` | Bladder Cancer | _(none)_ | Male | _(none)_ | Tumor purity, sample type and drug type are missing — exercises the warning UI |

## How to use

1. `npm run dev` and open the app.
2. Click the **File Upload** tab.
3. From a sample folder, upload `patient.json`, `observation.json`, and
   `condition.json` into the matching slots.
4. Click **Predict Survival**. The console will log the full feature object;
   any field the parser couldn't extract is shown in the orange warning box.

## Coverage notes

The fixtures collectively exercise:

- All three LOINC code paths (`94076-7` TMB, `82120-4` mutation count,
  `33723-0` tumor purity).
- Both `valueQuantity`, `valueInteger`, and `valueDecimal` value forms.
- Top-level `Observation.code` AND `Observation.component[]` lookups.
- Missing/lenient `system` field on a LOINC coding.
- Cancer type extraction via SNOMED `display` and via `code.text`.
- Drug type extraction via `Condition.note`, `Condition.extension`, and
  multi-drug combination keywords.
- Sample type inference from `Specimen.display` (Primary / Metastatic) plus
  the missing-specimen case.
- Missing-field warnings for tumor purity, sample type, and drug type.
