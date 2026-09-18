import { MortgageAnalysisRequest, MortgageAnalysisResult } from "../../types";

// Client-side fallback calculator compliant with Malaysian Bank Negara guidelines
function clientFallbackMortgage(data: MortgageAnalysisRequest): MortgageAnalysisResult {
  const p = data.property || ({} as any);
  const m = data.mainBorrower || ({} as any);
  const j = data.jointBorrower;
  const isJoint = !!j && !!j.name && (j.employment?.monthlyGrossIncome || 0) > 0;

  const calculateNet = (gross: number, other: number = 0) => {
    const epf = gross * 0.11;
    const socso = Math.min(gross * 0.005, 25);
    let pcb = 0;
    if (gross > 10000) pcb = gross * 0.15;
    else if (gross > 6000) pcb = gross * 0.08;
    else if (gross > 4000) pcb = gross * 0.03;
    return Math.round(Math.max(0, gross - epf - socso - pcb + (other * 0.8)));
  };

  const grossMain = m.employment?.monthlyGrossIncome || ((m.employment?.fixedIncome || 0) + (m.employment?.variableIncome || 0)) || 5000;
  const netIncomeMain = calculateNet(grossMain, m.employment?.otherIncome || 0);

  const grossJoint = isJoint && j ? (j.employment?.monthlyGrossIncome || ((j.employment?.fixedIncome || 0) + (j.employment?.variableIncome || 0)) || 0) : 0;
  const netIncomeJoint = isJoint && j ? calculateNet(grossJoint, j.employment?.otherIncome || 0) : 0;

  const spa = p.spaPrice || 500000;
  const loanAmount = p.loanAmount || (spa * ((p.marginRequested || 90) / 100));
  const tenureYears = Math.min(p.loanTenure || 30, 35, Math.max(10, 70 - (m.age || 30)));
  const nMonths = Math.max(12, tenureYears * 12);
  const annualRate = 0.055; // 5.5% BNM stress test rate
  const monthlyRate = annualRate / 12;
  const stressInstallment = Math.round(
    loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nMonths)) / (Math.pow(1 + monthlyRate, nMonths) - 1)
  );

  const getCommitment = (c: any) => {
    if (!c) return 0;
    const cc = (c.creditCardOutstanding || 0) * 0.05;
    return (c.carLoan || 0) + (c.personalLoan || 0) + cc + (c.otherLoans || 0);
  };

  const commMain = getCommitment(m.commitments);
  const commJoint = isJoint && j ? getCommitment(j.commitments) : 0;

  const dsrMain = Math.min(150, Math.round(((commMain + stressInstallment) / Math.max(1, netIncomeMain)) * 100));
  let dsrJoint = undefined;
  let dsrCombined = dsrMain;

  if (isJoint) {
    dsrJoint = Math.min(150, Math.round((commJoint / Math.max(1, netIncomeJoint)) * 100));
    const totalNet = netIncomeMain + netIncomeJoint;
    const totalComm = commMain + commJoint + stressInstallment;
    dsrCombined = Math.min(150, Math.round((totalComm / Math.max(1, totalNet)) * 100));
  }

  const effectiveDsr = isJoint ? dsrCombined : dsrMain;
  let riskGrade: 'A' | 'B' | 'C' = 'A';
  let bankCategory: 'Conservative' | 'Moderate' | 'Flexible' = 'Conservative';
  let approvalProbability = 85;

  if (effectiveDsr <= 60) {
    riskGrade = 'A';
    bankCategory = 'Conservative';
    approvalProbability = 88;
  } else if (effectiveDsr <= 75) {
    riskGrade = 'B';
    bankCategory = 'Moderate';
    approvalProbability = 72;
  } else {
    riskGrade = 'C';
    bankCategory = 'Flexible';
    approvalProbability = 48;
  }

  if (m.commitments?.ccrisStatus === 'Late Payment') {
    approvalProbability = Math.max(20, approvalProbability - 25);
    riskGrade = 'C';
  } else if (m.commitments?.ccrisStatus === 'Restructured') {
    approvalProbability = Math.max(15, approvalProbability - 35);
    riskGrade = 'C';
  }

  const riskFlags: string[] = [];
  if (effectiveDsr > 70) riskFlags.push(`DSR (${effectiveDsr}%) melebihi had tanda aras standard bank komersial 70%`);
  if ((m.age || 30) + tenureYears > 70) riskFlags.push(`Umur (${m.age}) + Tempoh Pinjaman (${tenureYears} thn) melebihi had maksimum 70 tahun`);
  if (m.commitments?.ccrisStatus && m.commitments.ccrisStatus !== 'Clean') riskFlags.push(`Rekod CCRIS menunjukkan status "${m.commitments?.ccrisStatus}"`);

  const structuringImprovements: string[] = [];
  if (effectiveDsr > 65) {
    structuringImprovements.push("Selesaikan baki kad kredit atau pinjaman peribadi untuk menurunkan nisbah komitmen bulanan.");
    if (!isJoint) {
      structuringImprovements.push("Pertimbangkan permohonan bersama (Joint Applicant) bersama pasangan atau ahli keluarga terdekat.");
    }
  }
  if (tenureYears < 30 && (m.age || 30) < 40) {
    structuringImprovements.push("Lanjutkan tempoh pinjaman kepada 30-35 tahun untuk mengurangkan ansuran bulanan.");
  }
  structuringImprovements.push("Sediakan simpanan sokongan (Penyata KWSP Akaun 2 / Simpanan Tetap) bagi memperkukuh profil kredit.");

  return {
    dsrMain,
    dsrJoint,
    dsrCombined,
    netMonthlyIncomeMain: netIncomeMain,
    netMonthlyIncomeJoint: isJoint ? netIncomeJoint : undefined,
    stressTestInstallment: stressInstallment,
    isJointApplication: isJoint,
    riskGrade,
    loanTypeSuitability: `Sesuai untuk ${(data.loanTypes || ['Conventional']).join(", ")} tertakluk kepada pengesahan margin bank.`,
    approvalProbability,
    riskFlags,
    strategy: effectiveDsr <= 65
      ? "Profil peminjam kukuh. Kemukakan kepada Tier-1 Commercial Banks (Maybank, Public Bank, CIMB) untuk tawaran kadar faedah terbaik."
      : "Kemukakan kepada bank yang menawarkan formula pengiraan DSR fleksibel (Hong Leong, RHB, AmBank) atau pertimbangkan peminjam bersama.",
    requiredDocuments: [
      "Salinan Kad Pengenalan (Depan & Belakang)",
      "Slip Gaji 3 Bulan Terkini (6 bulan jika ada elaun/komisen)",
      "Penyata Bank Kemasukan Gaji 3 Bulan Terkini",
      "Penyata KWSP Terkini",
      "Salinan Surat Tawaran Jual Beli (Booking Receipt / SPA draft)"
    ],
    clientExplanationBM: `Berdasarkan analisis pembiayaan, anggaran DSR anda adalah sekitar ${effectiveDsr}%. Anggaran ansuran ujian tekanan adalah RM${stressInstallment.toLocaleString()} sebulan dengan anggaran peluang kelulusan sekitar ${approvalProbability}%.`,
    structuringImprovements,
    idealTenure: `${Math.min(35, Math.max(15, 70 - (m.age || 30)))} Tahun`,
    bankCategory
  };
}

export async function analyzeMortgage(data: MortgageAnalysisRequest): Promise<MortgageAnalysisResult> {
  try {
    const response = await fetch("/api/mortgage/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      if (result && typeof result.dsrMain === 'number') {
        return result as MortgageAnalysisResult;
      }
    }
    console.warn("[MORTGAGE] Server response not ok or invalid format, using client calculation fallback.");
    return clientFallbackMortgage(data);
  } catch (error: any) {
    console.warn("[MORTGAGE] API call exception, using client calculation fallback:", error?.message || error);
    return clientFallbackMortgage(data);
  }
}
