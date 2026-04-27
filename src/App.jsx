import { useMemo, useState } from "react";
import React from "react";
import { extractFeaturesFromFhir } from "./fhir/parseFhir";

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
    options: ["Breast Cancer", "Cancer of Unknown Primary", "Colorectal Cancer", "Esophagogastric Cancer", 
              "Glioma", "Head and Neck Cancer", "Melanoma", "Non-Small Cell Lung Cancer", "Renal Cell Carcinoma", "Other"],
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
  const [files, setFiles] = useState({patient: null, observation: null, condition: null});
  const [fhirWarnings, setFhirWarnings] = useState([]);

  const isPredictDisabled = useMemo(() => {
    if (activeTab === 0) {
      return Object.values(formData).some((value) => value === "");
    }

    if (activeTab === 1) {    
      return !Object.values(files).every(Boolean);
    }

    return true;
  }, [activeTab, formData, files]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleReset = () => {
    if (activeTab === 0) {
      setFormData(initialFormState);
      setPrediction(null);
      setHasPredicted(false);
    } 

    if (activeTab === 1) {
      setFiles({patient: null, observation: null, condition: null});
      setPrediction(null);
      setHasPredicted(false);
      setFhirWarnings([]);
    }
  };

  const handlePredict = () => {
    /** Manual Input Prediction */
    if (activeTab === 0) {
      
      const updatedInput = changeDataFormat(formData);
      const riskScore = predictModel(updatedInput);
      console.log(riskScore);
      let medSurv = "";
      let riskGroup = ""; 
      [medSurv, riskGroup] = categorizeRisk(riskScore);
      
      setPrediction({
        riskScore: riskScore.toFixed(2),
        approximateMedianSurvival: medSurv,
        riskGroup: riskGroup,
      });
      setHasPredicted(true);
    }

     /** File Upload Prediction - FHIR */
    if (activeTab === 1) {
      if (Object.values(files).every(Boolean)) {
        /** Placeholder prediction -- replace with ML model */
      const { features, missing } = extractFeaturesFromFhir(files);

      setFhirWarnings(missing);

      const updatedInput = changeDataFormat(features);
      const riskScore = predictModel(updatedInput);

      console.log(riskScore);
      let medSurv = "";
      let riskGroup = ""; 
      [medSurv, riskGroup] = categorizeRisk(riskScore);
      
      setPrediction({
        riskScore: riskScore.toFixed(2),
        approximateMedianSurvival: medSurv,
        riskGroup: riskGroup,
      });
      setHasPredicted(true);
      }
    }
  };

  const changeDataFormat = (formData) => {
    const baseInputData = {
      ageDays: 0, 
      mutationCount: 0,
      tmb: 0,
      tumorPurity: 0,
      breastCancerType: 0, 
      unknownCancerType: 0, 
      colorectalCancerType: 0, 
      esophagogastricCancerType: 0,
      gliomaCancerType: 0, 
      headNeckCancerType: 0,
      melanomaCancerType: 0,
      nsclcType: 0, 
      renalCellCarcinomaType: 0, 
      drugCombo: 0,
      drugpdpdl: 0,
      sexMale: 0,
      primarySample: 0, 
    };

    let inputData =  baseInputData;
    inputData.ageDays = parseNumericInput(formData.ageAtSequencingDays) / 365.25;
    inputData.mutationCount = parseNumericInput(formData.mutationCount);
    inputData.tmb = parseNumericInput(formData.tmb);
    inputData.tumorPurity = parseNumericInput(formData.tumorPurity);
    
    switch (formData.cancerType) {
      case "Breast Cancer":
        inputData.breastCancerType = 1;
        break;
      case "Cancer of Unknown Primary":
        inputData.unknownCancerType = 1;
        break;
      case "Colorectal Cancer":
        inputData.colorectalCancerType = 1;
        break;
      case "Esophagogastric Cancer":
        inputData.esophagogastricCancerType = 1;
        break;
      case "Glioma":
        inputData.gliomaCancerType = 1;
        break;
      case "Head and Neck Cancer":
        inputData.headNeckCancerType = 1;
        break;
      case "Melanoma":
        inputData.melanomaCancerType = 1;
        break;
      case "Non-Small Cell Lung Cancer":
        inputData.nsclcType = 1;
        break;
      case "Renal Cell Carcinoma":
        inputData.renalCellCarcinomaType = 1;
        break;
      default:
        break;
    }

    if (formData.drugType === "PD-1 Inhibitor" || formData.drugType === "PD-L1 Inhibitor") {
      inputData.drugpdpdl = 1;
    }
    
    if (formData.drugType === "Combo") {
      inputData.drugCombo = 1;
    }
    if (formData.sex === "Male") {
      inputData.sexMale = 1;
    }

    if (formData.sampleType === "Primary") {
      inputData.primarySample = 1;
    }

    return inputData;
  };

  const predictModel = (inputData) => {
    const coefficients = {
      "ageDays": -0.005020196166512083, 
      "mutationCount": -0.015148086917501222,
      "tmb": 	-0.007470441228858219,
      "tumorPurity": 0.0027708524987794863,
      "breastCancerType": 0.6245073405845271, 
      "unknownCancerType": 0.37403619963012136, 
      "colorectalCancerType": -0.13305391988338053, 
      "esophagogastricCancerType": 0.3266658146006979,
      "gliomaCancerType": 0.08405126931975918, 
      "headNeckCancerType": 0.21485125768376317,
      "melanomaCancerType": -0.4682788540874561,
      "nsclcType": 0.2827239499536432, 
      "renalCellCarcinomaType": -0.9139104995245932, 
      "drugCombo": 0.010533644067337991,
      "drugpdpdl": 0.5450946890477282,
      "sexMale": 0.008499409694287825,
      "primarySample": -0.006837051937955503,
    };

    let logRisk = 0;
    for (const [feature, coef] of Object.entries(coefficients)) {
      const value = inputData[feature] ?? 0;
      logRisk += coef * value;
    }

    const riskScore = Math.exp(logRisk);

    return riskScore;
    
    
  }

  const categorizeRisk = (riskScore) => {
    let medSurv = "";
    let riskGroup = "";
    if (riskScore > 1.5) {
      medSurv = "0-3 months";
      riskGroup = "Extremely High Risk";
    } else if (riskScore > 1.2) {
      medSurv = "3-6 months";
      riskGroup = "High Risk";
    } else if (riskScore > 0.8) {
      medSurv = "6-12 months";
      riskGroup = "Moderate Risk";
    } else if (riskScore > 0.5) {
      medSurv = "1-3 years";
      riskGroup = "Low Risk";
    } else {
      medSurv = ">3 years";
      riskGroup = "Extremely Low Risk";
    }
    return [medSurv, riskGroup];
  }
  const handleFileChange = (event, key) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        setFiles((prev) => ({
          ...prev,
          [key]: jsonData,
        }));
      } catch (error) {
        console.error("Error parsing JSON file:", error);
      }
    };
    reader.readAsText(file);
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
          <input className="file-upload-input" type="file" accept=".json" onChange={(e) => handleFileChange(e, 'patient')} />
        <p className="file-upload-details">This provides information regarding the patient's age, which is used in the prediction model.</p>


        <p className="file-upload-label">Observation Resource</p>
            <input className="file-upload-input" type="file" accept=".json" onChange={(e) => handleFileChange(e, 'observation')} />
        <p className="file-upload-details">This provides information regarding the patient's genomic features (including mutation count, TMB, and tumor purity), which are used in the prediction model.</p>

        <p className="file-upload-label">Condition Resource</p>
            <input className="file-upload-input" type="file" accept=".json" onChange={(e) => handleFileChange(e, 'condition')} />
        <p className="file-upload-details">This provides information regarding the patient's clinical features, such as cancer type, drug type, and sample type.</p>

    </div>

  }
]




 
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
                className={`tab-button${activeTab === index ? "-active" : ""}`}
                onClick={() => setActiveTab(index)}
              >
              {tab.label}
              </button>
            ))}
          </div>
        <div className="tab-content">{tabs[activeTab].content}</div>






          <div className="button-row">
            <button
              className={`predict-button${hasPredicted? "" : "-done"}`}
              onClick={handlePredict}
              disabled={isPredictDisabled}
            >
              Predict Survival
            </button>
            <button className={`reset-button${hasPredicted? "" : "-done"}`} onClick={handleReset}>
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
                <span>Risk Score</span>
                <strong>{prediction.riskScore}</strong>
              </div>
              <div className="result-item">
                <span>Approximate Median Survival</span>
                <strong>{prediction.approximateMedianSurvival}</strong>
              </div>
              <div className="result-item">
                <span>Risk Group</span>
                <strong>{prediction.riskGroup}</strong>
              </div>
              {hasPredicted && fhirWarnings.length > 0 && (
                <div className="fhir-warning">
                <strong>Missing from FHIR resources (using baseline 0):</strong>
                <ul>
                  {fhirWarnings.map((f) => (
                   <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
         )}
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
              <li>Rule-based demonstration output</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
