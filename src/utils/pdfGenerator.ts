import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const downloadBNMGuidelines = () => {
  const doc = new jsPDF();
  const primaryColor = [15, 23, 42]; // slate-900
  const accentColor = [5, 150, 105]; // emerald-600

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

  (doc as any).autoTable({
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
  const finalY = (doc as any).lastAutoTable.finalY || 130;
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
  doc.text('Disclaimer: This document is a summary for educational purposes and does not constitute official legal or financial advice.', 14, 285);
  doc.text('Refer to Bank Negara Malaysia (BNM) official policy documents for full regulatory details.', 14, 290);

  doc.save('BNM_Lending_Guidelines_Rumakau.pdf');
};
