import { MortgageAnalysisRequest, MortgageAnalysisResult } from "../../types";

export async function analyzeMortgage(data: MortgageAnalysisRequest): Promise<MortgageAnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to analyze mortgage");
  }

  return await response.json() as MortgageAnalysisResult;
}
