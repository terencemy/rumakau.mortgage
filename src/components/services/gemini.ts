import { GoogleGenAI, Type } from "@google/genai";
import { MortgageAnalysisRequest, MortgageAnalysisResult } from "../../types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function analyzeMortgage(data: MortgageAnalysisRequest): Promise<MortgageAnalysisResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const prompt = `
    You are a Malaysia Mortgage Risk & Structuring AI Engine. 
    Analyze the following mortgage application data and provide a detailed risk assessment based on Malaysian banking standards and Bank Negara Malaysia (BNM) guidelines.

    DATA:
    ${JSON.stringify(data, null, 2)}

    TASKS:
    1. Calculate Net Monthly Income for each borrower (Gross minus estimated EPF, SOCSO, PCB based on standard Malaysian rates if not provided).
    2. Calculate the New Mortgage Installment using a Stress Test Interest Rate (Standard BNM practice: use 5.5% - 6.0% or current rate + 1.5%).
    3. Calculate DSR (Debt Service Ratio) for the main borrower and joint borrower (if any) using: (Total Commitments + Stress Test Installment) / Net Income.
    4. Calculate the combined DSR if it's a joint application.
    5. Identify property risk factors (commercial title, high-rise risk, overvaluation).
    6. Evaluate eligibility for requested loan types: ${data.loanTypes.join(", ")}.
    7. Identify risk flags (e.g., Tenure > 35 years, Age + Tenure > 70, DSR > 70% for low income, CCRIS issues).
    8. Suggest suitable bank category (Conservative, Moderate, Flexible).
    9. Estimate approval probability %.
    10. Suggest structuring improvements.
    11. Suggest ideal loan tenure adjustment (Max 35 years).
    12. Suggest required supporting documents for both borrowers.
    13. Provide a short client explanation summary in Bahasa Malaysia.

    IMPORTANT:
    - Mask NRIC (only show last 4 digits).
    - Do not store personal data.
    - Align strictly with BNM Policy Document on Responsible Lending.
    - Maximum loan tenure for residential properties is 35 years.
    - Maximum age for loan repayment is 70 years.
    - Use a stress test rate of at least 5.5% for DSR calculations.
    - If the main borrower's DSR is too high, explain how the joint borrower helps or if further improvements are needed.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dsrMain: { type: Type.NUMBER, description: "Estimated DSR percentage for main borrower" },
          dsrJoint: { type: Type.NUMBER, description: "Estimated DSR percentage for joint borrower (if any)" },
          dsrCombined: { type: Type.NUMBER, description: "Combined DSR percentage" },
          netMonthlyIncomeMain: { type: Type.NUMBER, description: "Estimated Net Monthly Income for main borrower" },
          netMonthlyIncomeJoint: { type: Type.NUMBER, description: "Estimated Net Monthly Income for joint borrower" },
          stressTestInstallment: { type: Type.NUMBER, description: "Calculated installment using stress test rate (5.5%+)" },
          isJointApplication: { type: Type.BOOLEAN, description: "Whether it is a joint application" },
          riskGrade: { type: Type.STRING, description: "Risk Grade (A, B, or C)" },
          loanTypeSuitability: { type: Type.STRING, description: "Suitability analysis for loan types" },
          approvalProbability: { type: Type.NUMBER, description: "Approval probability percentage (0-100)" },
          riskFlags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of identified risk flags" },
          strategy: { type: Type.STRING, description: "Risk mitigation and structuring strategy" },
          requiredDocuments: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of required supporting documents" },
          clientExplanationBM: { type: Type.STRING, description: "Short client explanation in Bahasa Malaysia" },
          structuringImprovements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific structuring improvements" },
          idealTenure: { type: Type.STRING, description: "Suggested ideal loan tenure" },
          bankCategory: { type: Type.STRING, description: "Suitable bank category (Conservative, Moderate, Flexible)" }
        },
        required: [
          "dsrMain", "dsrCombined", "netMonthlyIncomeMain", "stressTestInstallment", "isJointApplication", "riskGrade", "loanTypeSuitability", "approvalProbability", 
          "riskFlags", "strategy", "requiredDocuments", "clientExplanationBM",
          "structuringImprovements", "idealTenure", "bankCategory"
        ]
      }
    }
  });

  return JSON.parse(response.text || "{}") as MortgageAnalysisResult;
}
