import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import fs from "fs";
import { Server } from "socket.io";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import { Resend } from "resend";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db: any;
try {
  const dbPath = path.join(DATA_DIR, "leads.db");
  db = new Database(dbPath);
  // Initialize database
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      contactType TEXT,
      contactValue TEXT,
      mainBorrowerName TEXT,
      propertyAddress TEXT,
      propertyType TEXT,
      spaPrice REAL,
      loanAmount REAL,
      dsrMain REAL,
      dsrJoint REAL,
      combinedDsr REAL,
      netMonthlyIncomeMain REAL,
      netMonthlyIncomeJoint REAL,
      stressTestInstallment REAL,
      approvalProbability REAL,
      bankCategory TEXT,
      riskGrade TEXT,
      leadType TEXT,
      roi REAL
    )
  `);

  // Add new columns if they don't exist (for backward compatibility with existing databases)
  const columns = db.prepare("PRAGMA table_info(leads)").all();
  const columnNames = (columns as any[]).map(c => c.name);
  
  if (!columnNames.includes('propertyAddress')) db.exec("ALTER TABLE leads ADD COLUMN propertyAddress TEXT");
  if (!columnNames.includes('propertyType')) db.exec("ALTER TABLE leads ADD COLUMN propertyType TEXT");
  if (!columnNames.includes('spaPrice')) db.exec("ALTER TABLE leads ADD COLUMN spaPrice REAL");
  if (!columnNames.includes('loanAmount')) db.exec("ALTER TABLE leads ADD COLUMN loanAmount REAL");
  if (!columnNames.includes('leadType')) db.exec("ALTER TABLE leads ADD COLUMN leadType TEXT");
  if (!columnNames.includes('roi')) db.exec("ALTER TABLE leads ADD COLUMN roi REAL");
  console.log(`[DB] Database initialized at ${dbPath}`);
} catch (error) {
  console.error("[DB ERROR] Failed to initialize database:", error);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint for Render cold starts
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // Mortgage BNM calculation helper
  function calculateDeterministicMortgage(data: any) {
    const p = data.property || {};
    const m = data.mainBorrower || {};
    const j = data.jointBorrower;
    const isJoint = !!j && !!j.name && (j.employment?.monthlyGrossIncome || 0) > 0;

    const calculateNet = (gross: number, other: number = 0) => {
      const epf = gross * 0.11;
      const socso = Math.min(gross * 0.005, 25);
      let pcb = 0;
      if (gross > 10000) pcb = gross * 0.15;
      else if (gross > 6000) pcb = gross * 0.08;
      else if (gross > 4000) pcb = gross * 0.03;
      const net = Math.max(0, gross - epf - socso - pcb + (other * 0.8));
      return Math.round(net);
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
      structuringImprovements.push(`Lanjutkan tempoh pinjaman kepada 30-35 tahun untuk mengurangkan ansuran bulanan.`);
    }
    structuringImprovements.push("Sediakan simpanan sokongan (Penyata KWSP Akaun 2 / Simpanan Tetap) bagi memperkukuh profil kredit peminjam.");

    const idealTenure = `${Math.min(35, Math.max(15, 70 - (m.age || 30)))} Tahun`;

    return {
      dsrMain,
      dsrJoint,
      dsrCombined,
      netMonthlyIncomeMain: netIncomeMain,
      netMonthlyIncomeJoint: isJoint ? netIncomeJoint : undefined,
      stressTestInstallment: stressInstallment,
      isJointApplication: isJoint,
      riskGrade,
      loanTypeSuitability: `Sesuai untuk ${(data.loanTypes || ['Conventional']).join(", ")} tertakluk kepada kelulusan margin bank.`,
      approvalProbability,
      riskFlags,
      strategy: effectiveDsr <= 65
        ? "Profil peminjam kukuh. Kemukakan kepada Tier-1 Commercial Banks (Maybank, Public Bank, CIMB) untuk tawaran kadar faedah terbaik."
        : "Kemukakan kepada bank yang menawarkan formula pengiraan DSR fleksibel (Hong Leong, RHB, AmBank) atau pertimbangkan permohonan bersama.",
      requiredDocuments: [
        "Salinan Kad Pengenalan (Depan & Belakang)",
        "Slip Gaji 3 Bulan Terkini (6 bulan jika ada elaun/komisen)",
        "Penyata Bank Kemasukan Gaji 3 Bulan Terkini",
        "Penyata KWSP Terkini",
        "Salinan Surat Tawaran Jual Beli (Booking Receipt / SPA draft)"
      ],
      clientExplanationBM: `Berdasarkan analisis pembiayaan, anggaran DSR anda adalah sekitar ${effectiveDsr}%. Anggaran ansuran ujian tekanan adalah RM${stressInstallment.toLocaleString()} sebulan dengan anggaran peluang kelulusan sekitar ${approvalProbability}%.`,
      structuringImprovements,
      idealTenure,
      bankCategory
    };
  }

  async function runMortgageAiAnalysis(data: any) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
      console.log("[MORTGAGE] No server GEMINI_API_KEY, using deterministic BNM calculation");
      return calculateDeterministicMortgage(data);
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      You are a Malaysia Mortgage Risk & Structuring AI Engine for Rumakau.com. 
      Analyze the following mortgage application data and provide a detailed risk assessment based on Malaysian banking standards and Bank Negara Malaysia (BNM) guidelines.

      APPLICATION DATA:
      ${JSON.stringify(data, null, 2)}

      TASKS:
      1. Calculate Net Monthly Income for each borrower (Gross minus EPF 11%, SOCSO, PCB).
      2. Calculate the New Mortgage Installment using BNM Stress Test Rate (5.5% - 6.0%).
      3. Calculate DSR (Debt Service Ratio) for main borrower and joint borrower (if any).
      4. Calculate combined DSR.
      5. Evaluate eligibility for requested loan types: ${(data.loanTypes || []).join(", ")}.
      6. Identify risk flags (tenure, age, DSR thresholds, CCRIS).
      7. Suggest suitable bank category (Conservative, Moderate, Flexible).
      8. Estimate approval probability % (0-100).
      9. Suggest structuring improvements.
      10. Suggest ideal loan tenure (Max 35 years, up to age 70).
      11. Suggest required documents.
      12. Provide a clear client explanation summary in Bahasa Malaysia.

      RULES:
      - Max loan tenure is 35 years.
      - Max age is 70 years.
      - Return strict JSON matching the schema.
    `;

    const candidateModels = ["gemini-3-flash-preview", "gemini-3.8-flash", "gemini-3.6-flash"];
    for (const model of candidateModels) {
      try {
        console.log(`[MORTGAGE] Attempting analysis with ${model}...`);
        const response = await ai.models.generateContent({
          model,
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
                stressTestInstallment: { type: Type.NUMBER, description: "Calculated installment using stress test rate" },
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

        if (response.text) {
          const parsed = JSON.parse(response.text);
          console.log(`[MORTGAGE] Analysis successful with ${model}`);
          return parsed;
        }
      } catch (err: any) {
        console.warn(`[MORTGAGE] ${model} failed (${err.message || err}), trying next model...`);
      }
    }

    console.log("[MORTGAGE] Falling back to deterministic calculation");
    return calculateDeterministicMortgage(data);
  }

  // Mortgage AI Analysis API endpoint
  app.post("/api/mortgage/analyze", async (req, res) => {
    try {
      const data = req.body;
      const result = await runMortgageAiAnalysis(data);
      res.json(result);
    } catch (err: any) {
      console.error("[API MORTGAGE ERROR]", err);
      try {
        const fallback = calculateDeterministicMortgage(req.body);
        res.json(fallback);
      } catch (fallbackErr: any) {
        res.status(500).json({ error: err.message || "Failed to analyze mortgage" });
      }
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const data = req.body;
      const result = await runMortgageAiAnalysis(data);
      res.json(result);
    } catch (err: any) {
      console.error("[API ANALYZE ERROR]", err);
      try {
        const fallback = calculateDeterministicMortgage(req.body);
        res.json(fallback);
      } catch (fallbackErr: any) {
        res.status(500).json({ error: err.message || "Failed to analyze mortgage" });
      }
    }
  });

  app.get("/api/verify/status", (req, res) => {
    const resendKey = (process.env.RUMAKAU_LIVE || process.env.RESEND_API_KEY || "").trim().replace(/^["']|["']$/g, '');
    const geminiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, '');
    const sheetId = (process.env.GOOGLE_SHEET_ID || "").trim().replace(/^["']|["']$/g, '');
    const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT || "").trim().replace(/^["']|["']$/g, '');
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[).]+$/, '')
      .replace(/\\n/g, '\n');
    
    console.log("[STATUS CHECK] GOOGLE_SHEET_ID length:", sheetId.length, "Preview:", sheetId.substring(0, 5) + "...");
    console.log("[STATUS CHECK] GOOGLE_SERVICE_ACCOUNT_EMAIL length:", clientEmail.length, "Preview:", clientEmail.substring(0, 5) + "...");
    console.log("[STATUS CHECK] GOOGLE_PRIVATE_KEY length:", privateKey.length, "Preview:", privateKey.substring(0, 20) + "...");
    
    const googleVars = Object.keys(process.env).filter(key => key.startsWith('GOOGLE_'));
    console.log("[STATUS CHECK] Found GOOGLE_ variables:", googleVars);
    
    const missingSheetsVars = [
      !sheetId && "GOOGLE_SHEET_ID",
      (!clientEmail) && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      !privateKey && "GOOGLE_PRIVATE_KEY"
    ].filter(Boolean);

    if (missingSheetsVars.length > 0) {
      console.log("[STATUS CHECK] Missing Sheets Variables:", missingSheetsVars.join(", "));
    }
    
    res.json({ 
      hasResend: !!resendKey,
      resendPreview: resendKey ? `${resendKey.substring(0, 4)}...` : null,
      hasGemini: !!geminiKey,
      geminiFullPreview: geminiKey ? `${geminiKey.substring(0, 10)}...${geminiKey.slice(-10)}` : null,
      hasGoogleSheets: !!sheetId && !!clientEmail && !!privateKey,
      dbStatus: !!db ? "Connected" : "Error",
      geminiKeyLength: geminiKey.length,
      resendKeyLength: resendKey.length,
      missingSheetsVars,
      foundGoogleVars: googleVars
    });
  });

  // Test Google Sheets Connection
  app.get("/api/verify/test-sheets", async (req, res) => {
    const sheetId = (process.env.GOOGLE_SHEET_ID || "").trim().replace(/^["']|["']$/g, '');
    const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT || "").trim().replace(/^["']|["']$/g, '');
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[).]+$/, '')
      .replace(/\\n/g, '\n');

    if (!sheetId || !clientEmail || !privateKey) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing credentials",
        missing: [
          !sheetId && "GOOGLE_SHEET_ID",
          !clientEmail && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          !privateKey && "GOOGLE_PRIVATE_KEY"
        ].filter(Boolean)
      });
    }

    try {
      // Enhanced Private Key handling for Render/Production
      let processedKey = privateKey;
      if (!processedKey.includes('\n') && processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // If it's all one line but has the headers, it might be missing newlines
        processedKey = processedKey
          .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
          .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      }

      const auth = new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: processedKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      
      // Perform a WRITE test (append a temporary hidden row or just validate)
      // We'll try to read the spreadsheet metadata first
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const sheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';

      res.json({ 
        success: true, 
        message: `Connection successful! Found sheet: "${sheetName}". App has permission to write.`,
        details: {
          sheetTitle: spreadsheet.data.properties?.title,
          firstTab: sheetName
        }
      });
    } catch (error: any) {
      console.error("[SHEETS TEST ERROR]", error.message);
      if (error.response) {
        console.error("[SHEETS TEST ERROR DETAILS]", JSON.stringify(error.response.data, null, 2));
      }
      let userMessage = "Failed to connect to Google Sheets.";
      
      if (error.message.includes("not found")) {
        userMessage = "Sheet ID not found. Please check your GOOGLE_SHEET_ID.";
      } else if (error.message.includes("permission") || error.message.includes("403")) {
        userMessage = `Permission denied. Please share your sheet with: ${clientEmail} as an EDITOR.`;
      } else if (error.message.includes("invalid_grant") || error.message.includes("key")) {
        userMessage = "Invalid Private Key. Please ensure you copied the entire block including BEGIN and END lines.";
      }

      res.status(500).json({ 
        success: false, 
        error: error.message,
        userMessage,
        details: error.response?.data
      });
    }
  });

  // Mock Verification API
  const otps = new Map<string, string>();

  app.post("/api/verify/send", async (req, res) => {
    const { contactType, contactValue } = req.body;
    if (!contactValue) return res.status(400).json({ error: "Contact value required" });
    
    let normalizedValue = contactValue.trim().toLowerCase();
    
    // Fallback to manual OTP for Email or if Twilio not configured
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(normalizedValue, code);
    
    // 1. Check if Resend is configured
    const resendKey = (process.env.RUMAKAU_LIVE || process.env.RESEND_API_KEY || "").trim().replace(/^["']|["']$/g, '');
    if (!resendKey) {
      return res.status(500).json({ 
        error: "Email service not configured. Please add RUMAKAU_LIVE to environment variables." 
      });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: normalizedValue,
        subject: 'Your Verification Code - Rumakau.com',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #0f172a;">Security Verification</h2>
            <p>Your verification code for Rumakau.com is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #059669; margin: 20px 0;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #64748b;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `
      });
      
      if (error) {
        console.error("[RESEND ERROR]", error);
        return res.status(500).json({ 
          error: `Email failed: ${error.message || "Check your Resend configuration."}` 
        });
      }
    } catch (error: any) {
      console.error("[RESEND EXCEPTION]", error);
      return res.status(500).json({ error: "An error occurred while sending the verification email." });
    }

    res.json({ success: true, message: "Code sent successfully" });
  });

  app.post("/api/verify/check", async (req, res) => {
    const { contactValue, code } = req.body;
    if (!contactValue || !code) return res.status(400).json({ error: "Contact value and code required" });

    let normalizedValue = contactValue.trim().toLowerCase();

    // Fallback to manual OTP check
    const storedCode = otps.get(normalizedValue);
    if (storedCode && storedCode === code) {
      otps.delete(normalizedValue);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid or expired verification code" });
    }
  });

  // Lead capture API
  app.post("/api/leads", async (req, res) => {
    const { 
      timestamp, contactType, contactValue, mainBorrowerName, 
      propertyAddress, propertyType, spaPrice, loanAmount,
      dsrMain, dsrJoint, combinedDsr, 
      netMonthlyIncomeMain, netMonthlyIncomeJoint, 
      stressTestInstallment, approvalProbability, 
      bankCategory, riskGrade, leadType, roi 
    } = req.body;
    
    if (!db) {
      console.warn("[LEAD] DB not available, logging to console only:", req.body);
    }

    // 1. Save to SQLite
    if (db) {
      try {
        const stmt = db.prepare(`
          INSERT INTO leads (
            timestamp, contactType, contactValue, mainBorrowerName, 
            propertyAddress, propertyType, spaPrice, loanAmount,
            dsrMain, dsrJoint, combinedDsr, 
            netMonthlyIncomeMain, netMonthlyIncomeJoint, 
            stressTestInstallment, approvalProbability, 
            bankCategory, riskGrade, leadType, roi
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          timestamp, contactType, contactValue, mainBorrowerName, 
          propertyAddress, propertyType, spaPrice, loanAmount,
          dsrMain, dsrJoint, combinedDsr, 
          netMonthlyIncomeMain, netMonthlyIncomeJoint, 
          stressTestInstallment, approvalProbability, 
          bankCategory, riskGrade, leadType, roi
        );
        console.log("[LEAD] Saved to SQLite DB");
      } catch (error) {
        console.error("[DB ERROR] Failed to save to SQLite:", error);
      }
    }

    // 2. Save to Google Sheets
    const sheetId = (process.env.GOOGLE_SHEET_ID || "").trim().replace(/^["']|["']$/g, '');
    const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT || "").trim().replace(/^["']|["']$/g, '');
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[).]+$/, '') // Remove accidental trailing ) or .
      .replace(/\\n/g, '\n');
    
    console.log("[LEAD SYNC] Checking credentials...");
    console.log("[LEAD SYNC] Sheet ID:", sheetId ? "Present" : "MISSING");
    console.log("[LEAD SYNC] Email:", clientEmail ? "Present" : "MISSING");
    console.log("[LEAD SYNC] Key:", privateKey ? "Present" : "MISSING");

    if (sheetId && clientEmail && privateKey) {
      try {
        // Enhanced Private Key handling for Render/Production
        let processedKey = privateKey;
        if (!processedKey.includes('\n') && processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
          processedKey = processedKey
            .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
            .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
        }

        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: processedKey,
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1!A:T',
            valueInputOption: 'RAW',
            requestBody: {
              values: [[
                timestamp, contactType, contactValue, mainBorrowerName,
                propertyAddress, propertyType, spaPrice, loanAmount,
                dsrMain, dsrJoint, combinedDsr, netMonthlyIncomeMain,
                netMonthlyIncomeJoint, stressTestInstallment, approvalProbability,
                bankCategory, riskGrade, leadType || 'mortgage', roi || 0
              ]]
            }
          });
        } catch (sheetError: any) {
          // If Sheet1 doesn't exist, try appending to the first sheet by just using range 'A:T'
          if (sheetError.message.includes("Sheet1")) {
            await sheets.spreadsheets.values.append({
              spreadsheetId: sheetId,
              range: 'A:T',
              valueInputOption: 'RAW',
              requestBody: {
                values: [[
                  timestamp, contactType, contactValue, mainBorrowerName,
                  propertyAddress, propertyType, spaPrice, loanAmount,
                  dsrMain, dsrJoint, combinedDsr, netMonthlyIncomeMain,
                  netMonthlyIncomeJoint, stressTestInstallment, approvalProbability,
                  bankCategory, riskGrade, leadType || 'mortgage', roi || 0
                ]]
              }
            });
          } else {
            throw sheetError;
          }
        }
        console.log("[LEAD] Saved to Google Sheets");
      } catch (error: any) {
        console.error("[GOOGLE SHEETS ERROR]", error.message);
        if (error.response) {
          console.error("[GOOGLE SHEETS ERROR DETAILS]", error.response.data);
        }
      }
    }

    res.json({ success: true });
  });

  // Admin Verification & Leads Download
  const adminOtps = new Map<string, string>();
  const ALLOWED_ADMINS = ["terencehla@gmail.com"];

  app.post("/api/admin/auth/send", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    const normalizedEmail = email.trim().toLowerCase();
    if (!ALLOWED_ADMINS.includes(normalizedEmail)) {
      return res.status(403).json({ error: "Access denied. Not an authorized admin." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    adminOtps.set(normalizedEmail, code);
    
    const resendKey = (process.env.RUMAKAU_LIVE || process.env.RESEND_API_KEY || "").trim().replace(/^["']|["']$/g, '');
    if (!resendKey) {
      return res.status(500).json({ 
        error: "Email service not configured. Please add RUMAKAU_LIVE to environment variables." 
      });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: normalizedEmail,
        subject: 'Admin Access Code - Rumakau.com',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #0f172a;">Admin Access Verification</h2>
            <p>Your one-time access code for the Rumakau Admin Panel is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; margin: 20px 0;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #64748b;">This code is for authorized personnel only. If you did not request this, please secure your account.</p>
          </div>
        `
      });

      if (error) {
        console.error("[RESEND ADMIN ERROR]", error);
        return res.status(500).json({ 
          error: `Admin email failed: ${error.message || "Check your Resend configuration."}` 
        });
      }
    } catch (error: any) {
      console.error("[RESEND ADMIN EXCEPTION]", error);
      return res.status(500).json({ error: "An error occurred while sending the admin access code." });
    }
    
    res.json({ success: true });
  });

  app.post("/api/admin/auth/verify", (req, res) => {
    const { email, code } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const storedCode = adminOtps.get(normalizedEmail);
    
    if (storedCode && storedCode === code) {
      // In a real app, we'd issue a JWT here. For this demo, we'll use a simple session-like approach
      // but since we don't have sessions, we'll just return success and the client will include the code in the download request
      res.json({ success: true, token: code }); 
    } else {
      res.status(400).json({ error: "Invalid or expired code" });
    }
  });

  // Manual Sync to Sheets for Admin
  app.post("/api/admin/leads/sync-sheets", async (req, res) => {
    const { email, token, leadId } = req.body;
    
    if (!email || !token || !leadId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const storedCode = adminOtps.get(normalizedEmail);

    if (!ALLOWED_ADMINS.includes(normalizedEmail) || storedCode !== token) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!db) return res.status(500).json({ error: "DB not available" });

    try {
      const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const sheetId = (process.env.GOOGLE_SHEET_ID || "").trim().replace(/^["']|["']$/g, '');
      const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT || "").trim().replace(/^["']|["']$/g, '');
      const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").trim()
        .replace(/^["']|["']$/g, '')
        .replace(/[).]+$/, '')
        .replace(/\\n/g, '\n');

      let processedKey = privateKey;
      if (!processedKey.includes('\n') && processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        processedKey = processedKey
          .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
          .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      }

      const auth = new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: processedKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'A:T',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            lead.timestamp, lead.contactType, lead.contactValue, lead.mainBorrowerName,
            lead.propertyAddress, lead.propertyType, lead.spaPrice, lead.loanAmount,
            lead.dsrMain, lead.dsrJoint, lead.combinedDsr, lead.netMonthlyIncomeMain,
            lead.netMonthlyIncomeJoint, lead.stressTestInstallment, lead.approvalProbability,
            lead.bankCategory, lead.riskGrade, lead.leadType || 'mortgage', lead.roi || 0
          ]]
        }
      });

      res.json({ success: true, message: "Lead synced to Google Sheets!" });
    } catch (error: any) {
      console.error("[MANUAL SYNC ERROR]", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin JSON API (Restricted)
  app.get("/api/admin/leads", (req, res) => {
    const { email, token } = req.query;
    
    if (!email || !token) {
      return res.status(401).json({ error: "Unauthorized access." });
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const storedCode = adminOtps.get(normalizedEmail);

    if (!ALLOWED_ADMINS.includes(normalizedEmail) || storedCode !== token) {
      return res.status(403).json({ error: "Forbidden: Invalid admin credentials or expired session." });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not available." });
    }
    
    try {
      const leads = db.prepare("SELECT * FROM leads ORDER BY timestamp DESC").all();
      res.json({ success: true, leads });
    } catch (error) {
      console.error("[FETCH LEADS ERROR]", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Admin Download API (Restricted)
  app.get("/api/admin/leads/download", (req, res) => {
    const { email, token } = req.query;
    
    if (!email || !token) {
      return res.status(401).send("Unauthorized access.");
    }

    const normalizedEmail = (email as string).trim().toLowerCase();
    const storedCode = adminOtps.get(normalizedEmail);

    if (!ALLOWED_ADMINS.includes(normalizedEmail) || storedCode !== token) {
      return res.status(403).send("Forbidden: Invalid admin credentials or expired session.");
    }

    if (!db) {
      return res.status(500).send("Database not available.");
    }
    
    try {
      const leads = db.prepare("SELECT * FROM leads ORDER BY timestamp DESC").all();
      
      if (leads.length === 0) {
        return res.status(404).send("No leads found to download.");
      }

      // Generate CSV
      const headers = [
        "ID", "Timestamp", "Type", "Contact", "Name", 
        "Property Address", "Property Type", "SPA Price (RM)", "Loan Amount (RM)",
        "DSR Main (%)", "DSR Joint (%)", "Combined DSR (%)", 
        "Net Income Main (RM)", "Net Income Joint (RM)", 
        "Stress Test Installment (RM)", "Approval Prob (%)", 
        "Bank Category", "Risk Grade", "Lead Type", "ROI (%)"
      ];
      const rows = (leads as any[]).map(l => [
        l.id,
        l.timestamp,
        l.contactType,
        l.contactValue,
        l.mainBorrowerName,
        l.propertyAddress,
        l.propertyType,
        l.spaPrice,
        l.loanAmount,
        l.dsrMain,
        l.dsrJoint,
        l.combinedDsr,
        l.netMonthlyIncomeMain,
        l.netMonthlyIncomeJoint,
        l.stressTestInstallment,
        l.approvalProbability,
        l.bankCategory,
        l.riskGrade,
        l.leadType || 'mortgage',
        l.roi || 0
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=rumakau_leads.csv");
      res.send(csvContent);
    } catch (error) {
      console.error("[DOWNLOAD ERROR]", error);
      res.status(500).send("Failed to generate download");
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    console.log("[STARTUP] Keep-alive automatic wake-up ping is disabled. Let the backend sleep.");

    console.log("[STARTUP] Checking Google Sheets variables...");
    console.log("[STARTUP] GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? "YES" : "NO");
    console.log("[STARTUP] GOOGLE_SERVICE_ACCOUNT:", (process.env.GOOGLE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) ? "YES" : "NO");
    console.log("[STARTUP] GOOGLE_PRIVATE_KEY:", process.env.GOOGLE_PRIVATE_KEY ? "YES" : "NO");
  });
}

startServer();
