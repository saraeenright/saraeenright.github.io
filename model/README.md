# Cox Proportional Hazards Model — Frontend Integration Guide

This document explains how to implement the ML model coefficients in a frontend UI. The model is a **Cox Proportional Hazards survival model** that predicts relative patient risk based on clinical and genomic features.

---

## Files in This Folder

```
/
├── README.md              ← You are here
├── summary_df.csv         ← Model coefficients table
├── Data_clean_writeup.md  ← Writeup explanations
└── Data_clean 1.ipynb     ← Model training
```

---

## Model Overview

The Cox model outputs a **hazard ratio (HR)** — a measure of relative risk compared to a baseline patient. It does **not** output a raw probability. The key column in `summary_df.csv` is `exp(coef)`, which is the hazard ratio for each feature.

- **HR > 1** → higher risk than baseline
- **HR < 1** → lower risk than baseline  
- **HR = 1** → no difference from baseline

---

## Risk Score Equation

For a given patient, compute the **log risk score** as a linear combination of coefficients:

$$\text{log risk} = \sum_{i=1}^{n} \beta_i \cdot x_i$$

Or equivalently, the **risk score** (hazard ratio relative to baseline):

$$\text{risk score} = \exp\left(\sum_{i=1}^{n} \beta_i \cdot x_i\right) = \prod_{i=1}^{n} e^{\beta_i \cdot x_i}$$

Where:
- `β_i` = the `coef` value for feature `i` from `summary_df.csv`
- `x_i` = the patient's value for feature `i` (see encoding rules below)

---

## Feature Encoding

### Continuous Features (numeric input)
Use the raw numeric value directly as `x_i`.

| Feature | CSV Column | Expected Range |
|---|---|---|
| Age at sequencing | `Age at Which Sequencing was Reported (Days)` | e.g. 0–36500 (days) |
| Mutation Count | `Mutation Count` | Integer ≥ 0 |
| TMB (nonsynonymous) | `TMB (nonsynonymous)` | Float ≥ 0 |
| Tumor Purity | `Tumor Purity` | Float between 0 and 1 |

### Categorical Features (binary 0/1 encoding)
Each category is a separate row in the CSV. Set `x_i = 1` if the patient matches that category, otherwise `x_i = 0`. Only **one** option per group should be 1 at a time.

#### Cancer Type
| UI Option | CSV Column |
|---|---|
| Breast Cancer | `Cancer Type_Breast Cancer` |
| Cancer of Unknown Primary | `Cancer Type_Cancer of Unknown Primary` |
| Colorectal Cancer | `Cancer Type_Colorectal Cancer` |
| Esophagogastric Cancer | `Cancer Type_Esophagogastric Cancer` |
| Glioma | `Cancer Type_Glioma` |
| Head and Neck Cancer | `Cancer Type_Head and Neck Cancer` |
| Melanoma | `Cancer Type_Melanoma` |
| Non-Small Cell Lung Cancer | `Cancer Type_Non-Small Cell Lung Cancer` |
| Renal Cell Carcinoma | `Cancer Type_Renal Cell Carcinoma` |
| *(Other / Baseline)* | *(all above = 0)* |

#### Drug Type
| UI Option | CSV Column |
|---|---|
| Combo | `Drug Type_Combo` |
| PD-1/PDL-1 | `Drug Type_PD-1/PDL-1` |
| *(Baseline)* | *(all above = 0)* |

#### Sex
| UI Option | CSV Column |
|---|---|
| Male | `Sex_Male` |
| Female | *(baseline, all = 0)* |

#### Sample Type
| UI Option | CSV Column |
|---|---|
| Primary | `Sample Type_Primary` |
| *(Other / Baseline)* | *(= 0)* |

---

## JavaScript Implementation Example

```javascript
// Load coefficients from summary_df.csv (parse CSV first)
const coefficients = {
  "Age at Which Sequencing was Reported (Days)": -0.005020,
  "Mutation Count": -0.015148,
  "TMB (nonsynonymous)": -0.007470,
  "Tumor Purity": 0.002771,
  "Cancer Type_Breast Cancer": 0.624507,
  "Cancer Type_Cancer of Unknown Primary": 0.374036,
  "Cancer Type_Colorectal Cancer": -0.133054,
  "Cancer Type_Esophagogastric Cancer": 0.326666,
  "Cancer Type_Glioma": 0.084051,
  "Cancer Type_Head and Neck Cancer": 0.214851,
  "Cancer Type_Melanoma": -0.468279,
  "Cancer Type_Non-Small Cell Lung Cancer": 0.282724,
  "Cancer Type_Renal Cell Carcinoma": -0.913910,
  "Drug Type_Combo": 0.010534,
  "Drug Type_PD-1/PDL-1": 0.545095,
  "Sex_Male": 0.008499,
  "Sample Type_Primary": -0.006837,
};

function computeRiskScore(patientFeatures) {
  // patientFeatures is an object: { featureName: value, ... }
  let logRisk = 0;
  for (const [feature, coef] of Object.entries(coefficients)) {
    const value = patientFeatures[feature] ?? 0;
    logRisk += coef * value;
  }
  return {
    logRisk: logRisk,
    riskScore: Math.exp(logRisk), // hazard ratio vs. baseline
  };
}

// Example patient
const patient = {
  "Age at Which Sequencing was Reported (Days)": 18250, // ~50 years
  "Mutation Count": 5,
  "TMB (nonsynonymous)": 3.2,
  "Tumor Purity": 0.6,
  "Cancer Type_Melanoma": 1,       // selected
  "Drug Type_PD-1/PDL-1": 1,       // selected
  "Sex_Male": 1,
  "Sample Type_Primary": 1,
};

const result = computeRiskScore(patient);
console.log("Risk Score (HR):", result.riskScore);
// >1 = higher risk, <1 = lower risk vs. baseline
```

---

## Displaying Results in the UI

### Recommended Output Fields

| Field | How to Compute | Source Column |
|---|---|---|
| Hazard Ratio | `exp(coef * x)` per feature, or total `riskScore` | `exp(coef)` |
| 95% Confidence Interval | Use `exp(coef) lower 95%` and `exp(coef) upper 95%` | pre-computed in CSV |
| p-value | Display per feature for significance | `p` |
| Significance flag | Highlight if `p < 0.05` | `p` |

### Interpreting the Risk Score for Users

```
Risk Score = 1.0  → Same risk as baseline patient
Risk Score = 1.5  → 50% higher risk than baseline
Risk Score = 0.6  → 40% lower risk than baseline
```

### Statistically Significant Features (p < 0.05)
These are the most reliable signals — consider highlighting them in the UI:

| Feature | Hazard Ratio | p-value | Interpretation |
|---|---|---|---|
| Renal Cell Carcinoma | 0.40 | < 0.001 | Strongly protective |
| Melanoma | 0.63 | 0.006 | Protective |
| PD-1/PDL-1 Drug | 1.72 | 0.008 | Increased risk |
| Breast Cancer | 1.87 | 0.018 | Increased risk |
| Non-Small Cell Lung Cancer | 1.33 | 0.042 | Increased risk |

---

## Suggested UI Layout

```
┌─────────────────────────────────────────┐
│  Patient Risk Calculator                │
├─────────────────────────────────────────┤
│  Age (days):        [        18250     ]│
│  Mutation Count:    [            5     ]│
│  TMB:               [          3.2     ]│
│  Tumor Purity:      [          0.6     ]│
│                                         │
│  Cancer Type:       [ Melanoma       ▼ ]│
│  Drug Type:         [ PD-1/PDL-1     ▼ ]│
│  Sex:               [ Male           ▼ ]│
│  Sample Type:       [ Primary        ▼ ]│
├─────────────────────────────────────────┤
│  RESULT                                 │
│  Risk Score (HR):  0.84                 │
│  Interpretation:   16% lower risk       │
│                    than baseline        │
└─────────────────────────────────────────┘
```

Optionally, display a **forest plot** (horizontal bar chart) showing each feature's hazard ratio and 95% CI — this is the standard visualization for Cox models.

---

## Notes

- All coefficients come from `summary_df.csv`. If the model is retrained, just replace the CSV and update the coefficient object in your code.
- Features not entered by the user should default to `0` (baseline).
- The risk score is **relative**, not an absolute probability. Do not display it as a percentage chance of an event.
- For clinical use, always pair the risk score with confidence intervals from the CSV.
