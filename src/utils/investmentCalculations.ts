import { InvestmentCalculatorInput, InvestmentAnalysisResult } from '../types';

export function calculateInvestment(input: InvestmentCalculatorInput): InvestmentAnalysisResult {
  const {
    propertyPrice,
    downPayment,
    loanAmount,
    interestRate,
    tenure,
    monthlyRental,
    maintenanceFees,
    propertyTax,
    insurance,
    vacancyRate,
    renovationCost,
    legalFees
  } = input;

  // 1. Monthly Loan Repayment (Amortization)
  const monthlyRate = (interestRate / 100) / 12;
  const numberOfPayments = tenure * 12;
  const monthlyRepayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

  // 2. Net Monthly Cash Flow
  const vacancyLoss = (monthlyRental * vacancyRate) / 100;
  const netMonthlyCashFlow = monthlyRental - vacancyLoss - monthlyRepayment - maintenanceFees - (propertyTax / 12) - (insurance / 12);

  // 3. Rental Yield
  const annualRental = monthlyRental * 12;
  const rentalYield = Math.round((annualRental / propertyPrice) * 100);

  // 4. Net Rental Yield
  const annualNetIncome = (monthlyRental - vacancyLoss - maintenanceFees - (propertyTax / 12) - (insurance / 12)) * 12;
  const netRentalYield = Math.round((annualNetIncome / propertyPrice) * 100);

  // 5. Total Cash Invested
  const totalCashInvested = downPayment + legalFees + renovationCost;

  // 6. ROI
  const annualNetProfit = netMonthlyCashFlow * 12;
  const roi = Math.round((annualNetProfit / totalCashInvested) * 100);

  // 7. Risk Level
  let riskLevel: 'Low' | 'Moderate' | 'High' | 'Negative' = 'Low';
  if (netMonthlyCashFlow < 0) {
    riskLevel = 'Negative';
  } else if (roi < 3 || (loanAmount / propertyPrice) > 0.85) {
    riskLevel = 'High';
  } else if (roi < 6) {
    riskLevel = 'Moderate';
  }

  // 8. Smart Score (0-100)
  let smartScore = 0;
  smartScore += Math.min(30, (roi / 10) * 30); // ROI contributes up to 30
  smartScore += Math.min(30, (netRentalYield / 6) * 30); // Yield contributes up to 30
  smartScore += netMonthlyCashFlow > 0 ? 20 : 0; // Positive cash flow contributes 20
  smartScore += (loanAmount / propertyPrice) < 0.7 ? 20 : 10; // LTV contributes up to 20
  smartScore = Math.round(smartScore);

  let recommendation = "Good investment";
  let verdict = "Strong rental investment";
  
  if (smartScore < 40) {
    recommendation = "High risk";
    verdict = "Risky investment - re-evaluate";
  } else if (smartScore < 70) {
    recommendation = "Average";
    verdict = "Moderate potential - negotiate better";
  } else if (netMonthlyCashFlow < 0) {
    verdict = "Negative cash flow - capital gain play only";
  }

  // 9. Scenarios
  const calculateScenarioCashFlow = (ir: number, vr: number, rentalAdj: number = 1) => {
    const mRate = (ir / 100) / 12;
    const mRepayment = loanAmount * (mRate * Math.pow(1 + mRate, numberOfPayments)) / (Math.pow(1 + mRate, numberOfPayments) - 1);
    const mRental = monthlyRental * rentalAdj;
    const vLoss = (mRental * vr) / 100;
    return mRental - vLoss - mRepayment - maintenanceFees - (propertyTax / 12) - (insurance / 12);
  };

  return {
    monthlyRepayment,
    netMonthlyCashFlow,
    rentalYield,
    netRentalYield,
    roi,
    totalCashInvested,
    riskLevel,
    smartScore,
    recommendation,
    verdict,
    scenarios: {
      interestPlus1: calculateScenarioCashFlow(interestRate + 1, vacancyRate),
      interestPlus2: calculateScenarioCashFlow(interestRate + 2, vacancyRate),
      vacancy10: calculateScenarioCashFlow(interestRate, 10),
      vacancy20: calculateScenarioCashFlow(interestRate, 20),
      rentalDrop10: calculateScenarioCashFlow(interestRate, vacancyRate, 0.9),
      appreciationConservative: propertyPrice * 0.02,
      appreciationModerate: propertyPrice * 0.04,
      appreciationOptimistic: propertyPrice * 0.06
    }
  };
}
