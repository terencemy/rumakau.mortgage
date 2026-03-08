import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvestmentAnalysisResult, InvestmentCalculatorInput, MortgageAnalysisResult, MortgageAnalysisRequest } from '../types';

export const downloadMortgageReport = (result: MortgageAnalysisResult, request: MortgageAnalysisRequest) => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
  const accentColor: [number, number, number] = [5, 150, 105]; // emerald-600

  // Header
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Mortgage Risk Assessment', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Generated for: ${request.mainBorrower.name}`, 14, 28);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 33);

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 38, 196, 38);

  // Section 1: Financial Summary
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('1. Financial Summary', 14, 48);

  autoTable(doc, {
    startY: 53,
    head: [['Metric', 'Value']],
    body: [
      ['Combined DSR', `${Math.round(result.dsrCombined)}%`],
      ['Risk Grade', result.riskGrade],
      ['Approval Probability', `${Math.round(result.approvalProbability)}%`],
      ['Bank Category', result.bankCategory],
      ['Net Monthly Income (Main)', `RM ${result.netMonthlyIncomeMain.toLocaleString()}`],
      ['Stress Test Installment', `RM ${result.stressTestInstallment.toLocaleString()}`]
    ],
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Section 2: Risk Flags
  const section2Y = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('2. Risk Flags & Analysis', 14, section2Y + 15);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  result.riskFlags.forEach((flag, i) => {
    doc.text(`• ${flag}`, 14, section2Y + 23 + (i * 6));
  });

  // Section 3: Strategy & Improvements
  const section3Y = section2Y + 23 + (result.riskFlags.length * 6) + 10;
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('3. Structuring Strategy', 14, section3Y);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const strategyLines = doc.splitTextToSize(result.strategy, 180);
  doc.text(strategyLines, 14, section3Y + 8);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('© 2026 Rumakau.com. All rights reserved. This report is for informational purposes only.', 14, 285);
  doc.text('Mortgage approval is subject to bank final credit assessment.', 14, 290);

  doc.save(`Mortgage_Report_${new Date().getTime()}.pdf`);
};

export const downloadInvestmentReport = (result: InvestmentAnalysisResult, input: InvestmentCalculatorInput) => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
  const accentColor: [number, number, number] = [5, 150, 105]; // emerald-600

  // Header
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ROI Performance Report', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Property Investment Analysis Summary', 14, 28);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 33);

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 38, 196, 38);

  // Section 1: Property Details
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('1. Property & Investment Details', 14, 48);

  autoTable(doc, {
    startY: 53,
    head: [['Parameter', 'Value']],
    body: [
      ['Property Price', `RM ${input.propertyPrice.toLocaleString()}`],
      ['Loan Amount', `RM ${input.loanAmount.toLocaleString()}`],
      ['Interest Rate', `${input.interestRate}%`],
      ['Loan Tenure', `${input.tenure} Years`],
      ['Monthly Rental', `RM ${input.monthlyRental.toLocaleString()}`],
      ['Total Cash Invested', `RM ${result.totalCashInvested.toLocaleString()}`]
    ],
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Section 2: Performance Metrics
  const section2Y = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('2. ROI & Cash Flow Performance', 14, section2Y + 15);

  autoTable(doc, {
    startY: section2Y + 20,
    head: [['Metric', 'Value']],
    body: [
      ['ROI Score', `${result.smartScore} / 100`],
      ['Annual ROI', `${result.roi}%`],
      ['Net Rental Yield', `${result.netRentalYield}%`],
      ['Gross Rental Yield', `${result.rentalYield}%`],
      ['Net Monthly Cash Flow', `RM ${result.netMonthlyCashFlow.toLocaleString()}`],
      ['Risk Level', result.riskLevel],
      ['Verdict', result.verdict]
    ],
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Section 3: Stress Test Scenarios
  const section3Y = (doc as any).lastAutoTable?.finalY || 180;
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('3. Stress Test & Market Scenarios', 14, section3Y + 15);

  autoTable(doc, {
    startY: section3Y + 20,
    head: [['Scenario', 'Monthly Cash Flow Impact']],
    body: [
      ['Interest Rate +1%', `RM ${result.scenarios.interestPlus1.toLocaleString()}`],
      ['Interest Rate +2%', `RM ${result.scenarios.interestPlus2.toLocaleString()}`],
      ['Vacancy Rate 10%', `RM ${result.scenarios.vacancy10.toLocaleString()}`],
      ['Vacancy Rate 20%', `RM ${result.scenarios.vacancy20.toLocaleString()}`],
      ['Rental Drop 10%', `RM ${result.scenarios.rentalDrop10.toLocaleString()}`]
    ],
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('© 2026 Rumakau.com. All rights reserved. This report is for informational purposes only.', 14, 285);
  doc.text('Investment involves risk. Past performance is not indicative of future results.', 14, 290);

  doc.save(`ROI_Report_${new Date().getTime()}.pdf`);
};

export const downloadBNMGuidelines = () => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [15, 23, 42]; // slate-900
  const accentColor: [number, number, number] = [5, 150, 105]; // emerald-600

  // Header
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('BNM Responsible Lending Guidelines', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Summary for Mortgage Professionals & Borrowers', 14, 28);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 33);

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 38, 196, 38);

  // Section 1: Core Principles
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('1. Core Principles of Responsible Lending', 14, 48);
  
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // slate-700
  const principles = [
    '• Affordability: Lending must be based on a borrower\'s ability to repay without undue hardship.',
    '• Transparency: All terms, costs, and risks must be clearly disclosed to the borrower.',
    '• Fairness: Financial institutions must treat borrowers fairly and equitably.',
    '• Suitability: Products recommended must be suitable for the borrower\'s financial situation.'
  ];
  principles.forEach((p, i) => doc.text(p, 14, 56 + (i * 6)));

  // Section 2: Key Regulatory Limits
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('2. Key Regulatory Limits (Mortgage)', 14, 85);

  autoTable(doc, {
    startY: 90,
    head: [['Regulation', 'Limit / Requirement']],
    body: [
      ['Maximum Loan Tenure', '35 Years (Residential Properties)'],
      ['Maximum Age for Repayment', '70 Years Old'],
      ['Stress Test Rate', 'Minimum 5.5% or Current Rate + 1.5%'],
      ['Income for DSR', 'Net Monthly Income (After EPF, SOCSO, PCB)'],
      ['DSR Threshold', 'Typically 60-70% (Varies by Income Bracket)'],
      ['LTV (Loan-to-Value)', 'Max 90% for first 2 properties, 70% for 3rd+']
    ],
    headStyles: { fillColor: primaryColor },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Section 3: Required Documentation
  const finalY = (doc as any).lastAutoTable?.finalY || 130;
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('3. Standard Documentation Requirements', 14, finalY + 15);

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const docs = [
    '• Proof of Identity: NRIC (Front & Back)',
    '• Proof of Income: 3-6 months Payslips, EPF Statement, EA Form',
    '• Proof of Employment: Employment Letter / Confirmation',
    '• Proof of Commitments: CCRIS Report, Latest Loan Statements',
    '• Property Documents: Booking Form, SPA, Title Copy'
  ];
  docs.forEach((d, i) => doc.text(d, 14, finalY + 23 + (i * 6)));

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('© 2026 Rumakau.com. All rights reserved. This platform is intended for professional use.', 14, 285);
  doc.text('For further assistance with mortgage applications, please contact our support team.', 14, 290);

  doc.save('BNM_Lending_Guidelines_Rumakau.pdf');
};
