# Predicting Immune Checkpoint Inhibitor (ICI) Benefit from Tumor Mutational Burden and Clinical Features

## Overview

This analysis uses the MSKCC 2018 TMB clinical dataset (`tmb_mskcc_2018_clinical_data.tsv`) to build and interpret machine learning models that predict how patients treated with immune checkpoint inhibitors (ICIs) are likely to respond, using tumor mutational burden (TMB) and a small set of routinely available clinical variables.

The work is organized into two complementary modeling tracks — a binary classification task (did the patient benefit from ICI?) and a time-to-event survival analysis — followed by model interpretability, clinical decision-support framing, and calibration.

---

## Dataset

- **Source:** MSKCC 2018 TMB cohort, 1,661 patients × 24 columns.

**Features used:**
- *Numeric:* age at sequencing (days), mutation count, TMB (nonsynonymous), tumor purity.
- *Categorical:* cancer type, drug type, sex, sample type.

**Outcomes:**
- Overall Survival (Months) — follow-up time.
- Overall Survival Status — binarized into an Event flag (1 = deceased).

**Cancer mix:** dominated by Non-Small Cell Lung Cancer (350), Melanoma (320), Bladder (215), Renal Cell (151), Head & Neck (139), with smaller counts across 6 other types.

**Overall survival:** mean 14.1 months (median 11); among living patients, median 16 months with follow-up up to 80 months.

---

## Track 1 — Classification: Predicting ICI Benefit

**Label definition.** A patient is labeled `ICI_Benefit = 1` if Overall Survival ≥ 12 months, else 0. After dropping rows with missing values on the modeling columns, the classification set has 1,547 patients (817 no-benefit / 730 benefit) — reasonably balanced.

**Preprocessing.** Standard scaling on numeric features, one-hot encoding on categoricals, all bundled into a `ColumnTransformer`. An 80/20 stratified train/test split is used (`random_state = 42`). The feature space expands to 22 columns after one-hot encoding.

**Models trained.** Four classifiers are compared on the same test set:

| Model | Accuracy | ROC-AUC |
|---|---|---|
| Logistic Regression (L2, class-weighted) | 0.652 | 0.696 |
| Gradient Boosting | 0.684 | 0.700 |
| XGBoost (scale_pos_weight balanced) | 0.687 | 0.703 |
| Random Forest (depth=5, class-weighted) | 0.645 | 0.683 |

XGBoost is the top performer and is carried forward. All four models show a consistent pattern: better recall on the "no benefit" class than the "benefit" class — i.e. the models are somewhat more conservative about predicting benefit.

**Hyperparameter tuning.** A 5-fold `GridSearchCV` over `max_depth`, `learning_rate`, and `n_estimators` for XGBoost selects `learning_rate=0.01, max_depth=3, n_estimators=200`, improving the cross-validated ROC-AUC to **0.726**.

---

## Track 2 — Survival Analysis

A parallel survival pipeline is built on the same features (1,547 → 1,237 train / 310 test after splitting). Numeric features are left on their original scale (median-imputed) so hazard ratios and partial-effects plots remain interpretable in clinical units.

**Cox Proportional Hazards model** (`lifelines.CoxPHFitter`, penalizer = 0.01):
- Training C-index: **0.664**
- Testing C-index: **0.646**

A C-index in the mid-0.6s indicates modest but non-trivial discriminative ability — in line with what's typical for clinical survival models built on a handful of routine variables.

**Kaplan-Meier stratification by TMB.** Patients in the test set are split at the 80th TMB percentile into high- and low-TMB groups. The log-rank test yields **p = 0.0751**, suggestive of a survival difference favoring the high-TMB group but not reaching the conventional 0.05 threshold in this sample.

**Partial effect of TMB.** The Cox model's partial-effects plot (holding other covariates constant) is used to visualize how simulated TMB values of 2, 5, and 10 shift the predicted survival curve, providing an interpretable, per-unit view of the TMB effect.

---

## Interpretability

Three complementary approaches are applied to the tuned XGBoost classifier:

1. **SHAP summary plot** — global feature importance and direction of effect.
2. **Permutation importance** (scoring = ROC-AUC, 10 repeats) — which features, if shuffled, most degrade performance on the held-out set.
3. **Partial Dependence Plots** on the original feature scale for TMB, mutation count, and age — showing how the predicted probability of ICI benefit shifts across the observed range of each variable.

---

## Clinical Decision Support Framework

A `generate_clinical_insight()` function converts a patient's predicted median survival (from the Cox model) into a risk tier with a suggested clinical action:

| Predicted Median Survival | Risk Tier | Suggested Action |
|---|---|---|
| 0–3 months | Extremely High Risk | Urgent tumor board review; consider trials/palliative pathways |
| 3–6 months | High Risk | Intensified monitoring |
| 6–12 months | Moderate Risk | Proceed with ICI; schedule regular restaging |
| 1–3 years | Low Risk | Standard pathway |
| >3 years / median not reached | Favorable | Long-term favorable prognosis |

The function also flags high TMB (≥ 10) as a positive modifier.

**Illustrative example:** For Patient 0 (NSCLC, PD-1/PD-L1, metastatic sample), the model predicts a median survival of **8.0 months**, landing in the **Moderate Risk** bucket.

---

## Calibration

Probability reliability is checked with a calibration curve and Brier score. An isotonic calibration via `CalibratedClassifierCV` (5-fold) improves the Brier score marginally:

- Original XGBoost: **0.2181**
- Calibrated: **0.2158**

This confirms the original XGBoost probabilities are already close to well-calibrated, but the calibrated version is preferable for downstream clinical use where the probability magnitude matters.

---

## Summary of Findings

- TMB, mutation count, and age carry most of the predictive signal for ICI benefit, consistent with existing oncology literature.
- Out-of-the-box tree ensembles (XGBoost, Gradient Boosting) outperform logistic regression and random forest on this task, with tuned XGBoost reaching CV ROC-AUC ≈ 0.73.
- Survival analysis corroborates the classification view: a Cox model reaches C-index ≈ 0.65, and high-TMB patients trend toward better survival (log-rank p ≈ 0.08).
- The analysis pipeline produces not only predictions but also interpretable outputs (SHAP, PDPs, hazard ratios, personalized survival curves) and a risk-tiered decision-support rubric that could be surfaced to clinicians.

---

## Caveats

- **Single-cohort data** (MSKCC only) — external validation on an independent cohort would be needed before any clinical use.
- The **12-month threshold** for "ICI benefit" is a pragmatic but somewhat arbitrary choice; sensitivity to this cutoff is not explored.
- Some **cancer types have small sample sizes** (e.g., Breast = 44, Non-Melanoma Skin = 1), so type-specific conclusions are limited.
- The **TMB high/low log-rank comparison** is done on the test set only (n = 310); broader analysis on the full cohort could strengthen the signal.
