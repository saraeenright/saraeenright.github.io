import { useMemo, useState } from "react";
import React from "react";

const genomicFields = [
  {
    id: "ageAtSequencingDays",
    label: "Age at Sequencing (Days)",
    placeholder: "e.g., 25550",
    hint: "Approximate: Age in years x 365",
  },
  {
    id: "mutationCount",
    label: "Mutation Count",
    placeholder: "e.g., 245",
    hint: "Total number of somatic mutations",
  },
  {
    id: "tmb",
    label: "TMB (nonsynonymous) - mutations/Mb",
    placeholder: "e.g., 12.5",
    hint: "Nonsynonymous mutation per megabase",
  },
  {
    id: "tumorPurity",
    label: "Tumor Purity (0-1)",
    placeholder: "e.g., 0.75",
    hint: "Proportion of tumor cells in sample",
  },
];

const selectFields = [
  {
    id: "cancerType",
    label: "Cancer Type",
    placeholder: "Select cancer type",
    options: ["Melanoma", "NSCLC", "Renal Cell Carcinoma", "Bladder Cancer"],
  },
  {
    id: "drugType",
    label: "Drug Type",
    placeholder: "Select drug type",
    options: ["PD-1 Inhibitor", "PD-L1 Inhibitor", "CTLA-4 Inhibitor", "Combo"],
  },
  {
    id: "sex",
    label: "Sex",
    placeholder: "Select sex",
    options: ["Female", "Male", "Unknown"],
  },
  {
    id: "sampleType",
    label: "Sample Type",
    placeholder: "Select sample type",
    options: ["Primary", "Metastatic", "Recurrent", "Unknown"],
  },
];


const initialFormState = {
  ageAtSequencingDays: "",
  mutationCount: "",
  tmb: "",
  tumorPurity: "",
  cancerType: "",
  drugType: "",
  sex: "",
  sampleType: "",
};


function parseNumericInput(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return null;
  return numericValue;
}

function App() {
  const [formData, setFormData] = useState(initialFormState);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const isPredictDisabled = useMemo(() => {
    return Object.values(formData).some((value) => value === "");
  }, [formData]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    console.log("Current form data:", formData);
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setPrediction(null);
    setHasPredicted(false);
  };

  const handlePredict = () => {
    /** Manual Input Prediction */
    if (activeTab === 0) {
      const ageDays = parseNumericInput(formData.ageAtSequencingDays);
      const mutationCount = parseNumericInput(formData.mutationCount);
      const tmb = parseNumericInput(formData.tmb);
      const purity = parseNumericInput(formData.tumorPurity);

      if (
        ageDays === null ||
        mutationCount === null ||
        tmb === null ||
        purity === null
      ) {
        return;
      }

      const ageYears = ageDays / 365;
      const score =
        20 +
        Math.max(0, 18 - ageYears / 4) +
        Math.min(12, tmb) +
        Math.min(8, mutationCount / 40) +
        purity * 12;

      const predictedMonths = Math.max(3, Math.min(48, score)).toFixed(1);
      const confidence = Math.max(70, Math.min(96, 70 + tmb)).toFixed(1);

      setPrediction({
        overallSurvivalMonths: predictedMonths,
        confidence,
        riskGroup:
          Number(predictedMonths) >= 24
            ? "Lower Risk"
            : Number(predictedMonths) >= 14
            ? "Intermediate Risk"
            : "Higher Risk",
      });
      setHasPredicted(true);
    }

     /** File Upload Prediction - Placeholder */
    if (activeTab === 1) {
      if (!patientResource.files[0] ||
          !observationResources.files[0] ||
          !conditionResource.files[0]) {
        return;
      }
      /** Placeholder prediction -- replace with ML model */
      setPrediction({
        overallSurvivalMonths: "24.5",
        confidence: "85.3",
        riskGroup: "Intermediate Risk",
      });
      setHasPredicted(true);
    }
  };

  const tabs = [
  {label: "Manual Input", content: 
    <div>
      <div className="section-label">
              <span className="section-icon">🧬</span>
              <span>Genomic Features</span>
      </div>

      <div className="form-stack">

        {genomicFields.map((field) => (
              <label className="field-group" key={field.id}>
                <span className="field-label">{field.label}</span>
                <input
                  type="text"
                  name={field.id}
                  value={formData[field.id]}
                  onChange={handleInputChange}
                  placeholder={field.placeholder}
                />
                <span className="field-hint">{field.hint}</span>
              </label>
            ))} 
        </div>

        <div className="section-label">
            <span className="section-icon">📈</span>
            <span>Clinical Features</span>
          </div>

        <div className="form-stack clinical-stack">
            {selectFields.map((field) => (
              <label className="field-group" key={field.id}>
                <span className="field-label">{field.label}</span>
                <select
                  name={field.id}
                  value={formData[field.id]}
                  onChange={handleInputChange}
                >
                  <option value="" disabled>
                    {field.placeholder}
                  </option>
                  {field.options.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>

    </div>

  },
  {label:"File Upload", content: 
    <div className="file-upload-form">
        <p className="file-upload-instructions">Please upload the following FHIR JSON resources, and we will parse the necessary data for you:</p>
        <p className="file-upload-label">Patient Resource</p>
          <input id="patient-resource" className="file-upload-input" type="file" accept=".json" />
        <p className="file-upload-details">This provides information regarding the patient's age, which is used in the prediction model.</p>


        <p className="file-upload-label">Observation Resource</p>
            <input id="observation-resources" className="file-upload-input" type="file" accept=".json" />
        <p className="file-upload-details">This provides information regarding the patient's genomic features (including mutation count, TMB, and tumor purity), which are used in the prediction model.</p>

        <p className="file-upload-label">Condition Resource</p>
            <input id="condition-resource" className="file-upload-input" type="file" accept=".json" />
        <p className="file-upload-details">This provides information regarding the patient's clinical features, such as cancer type, drug type, and sample type.</p>
    </div>

  }
]

const patientResource = document.getElementById("patient-resource");
const observationResources = document.getElementById("observation-resources");
const conditionResource = document.getElementById("condition-resource");

console.log(patientResource, observationResources, conditionResource);  
  return (
    <div className="app-shell">
      <header className="title-row">
        <div className="logo-badge">🧠</div>
        <div>
          <h1>Immunotherapy Survival Prediction</h1>
          <p>AI-Powered Clinical Decision Support System for Oncology</p>
        </div>
      </header>


      <main className="dashboard-grid">

        <section className="card input-card">
          <h2>Patient Data Input</h2>
          <div className="tab-container">
            {tabs.map((tab, index) => (
              <button
                key={index}
                className={`tab-button ${activeTab === index ? "active" : ""}`}
                onClick={() => setActiveTab(index)}
              >
              {tab.label}
              </button>
            ))}
          </div>
        <div className="tab-content">{tabs[activeTab].content}</div>






          <div className="button-row">
            <button
              className="predict-button"
              onClick={handlePredict}
              disabled={isPredictDisabled}
            >
              Predict Survival
            </button>
            <button className="reset-button" onClick={handleReset}>
              Reset
            </button>
          </div>
        </section>

        <section className="card result-card">
          <h2>AI Prediction Results</h2>

          {!hasPredicted || !prediction ? (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <p className="empty-title">
                Enter patient data to generate predictions
              </p>
              <p className="empty-subtitle">AI model ready for analysis</p>
            </div>
          ) : (
            <div className="prediction-results">
              <div className="result-item">
                <span>Overall survival (months)</span>
                <strong>{prediction.overallSurvivalMonths}</strong>
              </div>
              <div className="result-item">
                <span>Risk group</span>
                <strong>{prediction.riskGroup}</strong>
              </div>
              <div className="result-item">
                <span>Model confidence</span>
                <strong>{prediction.confidence}%</strong>
              </div>
            </div>
          )}
        </section>
      </main>

      <section className="card model-card">
        <h2>Model Information</h2>
        <div className="model-grid">
          <div>
            <h3>Input Features</h3>
            <ul>
              <li>Age at sequencing (days)</li>
              <li>Mutation count</li>
              <li>TMB (nonsynonymous)</li>
              <li>Tumor purity</li>
              <li>Cancer type, drug type, sex, sample type</li>
            </ul>
          </div>
          <div>
            <h3>Output Predictions</h3>
            <ul>
              <li>Overall survival (months)</li>
              <li>Risk stratification category</li>
              <li>Prediction confidence score</li>
              <li>Rule-based demonstration output</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
