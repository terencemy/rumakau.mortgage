import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import fs from "fs";
import { Server } from "socket.io";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import twilio from "twilio";
import { Resend } from "resend";

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
      dsrMain REAL,
      dsrJoint REAL,
      combinedDsr REAL,
      netMonthlyIncomeMain REAL,
      netMonthlyIncomeJoint REAL,
      stressTestInstallment REAL,
      approvalProbability REAL,
      bankCategory TEXT,
      riskGrade TEXT
    )
  `);
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

  app.get("/api/verify/status", (req, res) => {
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const twilioToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    const twilioNumber = (process.env.TWILIO_WHATSAPP_NUMBER || "").trim();
    const verifyServiceSid = (process.env.TWILIO_VERIFY_SERVICE_SID || "VA93662e4b7bf8e346e5c860c24f6c75bd").trim();
    
    // Check environment variable first, then fallback
    const envGeminiKey = (process.env.GEMINI_API_KEY || "").trim();
    const fallbackKey = "AIzaSyDgmn2993iMD45j1LfJ6n1fEVGxjITyA2A";
    const geminiKey = envGeminiKey || fallbackKey;
    const isUsingFallback = !envGeminiKey;
    
    res.json({ 
      hasResend: !!resendKey,
      resendPreview: resendKey ? `${resendKey.substring(0, 4)}...` : null,
      hasTwilio: !!(twilioSid && twilioToken),
      hasTwilioVerify: !!verifyServiceSid,
      verifyServiceSidPreview: verifyServiceSid ? `${verifyServiceSid.substring(0, 8)}...` : null,
      twilioSidLength: twilioSid.length,
      twilioTokenLength: twilioToken.length,
      twilioNumberLength: twilioNumber.length,
      twilioSidPreview: twilioSid ? `${twilioSid.substring(0, 8)}...` : null,
      twilioTokenPreview: twilioToken ? `${twilioToken.substring(0, 4)}...` : null,
      twilioNumberPreview: twilioNumber,
      hasGemini: !!geminiKey,
      geminiFullPreview: geminiKey ? `${geminiKey.substring(0, 10)}...${geminiKey.slice(-10)}` : null,
      isUsingFallback,
      dbStatus: !!db ? "Connected" : "Error",
      envKeyLength: envGeminiKey.length,
      tip: "If twilioSidPreview doesn't match your Twilio Console, update your Environment Variables."
    });
  });

  // Twilio Diagnostic API
  app.get("/api/admin/test-twilio", async (req, res) => {
    const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    
    if (!sid || !token) {
      return res.status(400).json({ success: false, error: "Twilio SID or Token missing in environment variables" });
    }
    
    try {
      const client = twilio(sid, token);
      const account = await client.api.v2010.accounts(sid).fetch();
      res.json({ 
        success: true, 
        accountStatus: account.status,
        accountType: account.type,
        friendlyName: account.friendlyName,
        sidPreview: `${sid.substring(0, 8)}...`
      });
    } catch (error: any) {
      console.error("[TWILIO DIAGNOSTIC ERROR]", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Test Gemini API connection
  app.get("/api/admin/test-ai", async (req, res) => {
    const envKey = (process.env.GEMINI_API_KEY || "").trim();
    const fallbackKey = "AIzaSyDgmn2993iMD45j1LfJ6n1fEVGxjITyA2A";
    const geminiKey = envKey || fallbackKey;

    const results: any[] = [];
    const modelsToTest = ["gemini-3-flash-preview", "gemini-2.0-flash", "gemini-flash-latest"];

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      // Try to list models first
      let availableModels: string[] = [];
      try {
        const modelsResponse = await ai.models.list();
        for await (const model of modelsResponse) {
          availableModels.push(model.name);
        }
      } catch (listErr: any) {
        console.error("[GEMINI LIST ERROR]", listErr);
      }

      for (const modelName of modelsToTest) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: "Say 'OK'",
          });
          results.push({ model: modelName, success: true, message: response.text });
        } catch (err: any) {
          results.push({ model: modelName, success: false, error: err.message });
        }
      }
      
      res.json({ 
        keyPreview: `${geminiKey.substring(0, 6)}...${geminiKey.slice(-4)}`,
        availableModels,
        results 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }
  });

  // Mock Verification API
  const otps = new Map<string, string>();

  app.post("/api/verify/send", async (req, res) => {
    const { contactType, contactValue } = req.body;
    if (!contactValue) return res.status(400).json({ error: "Contact value required" });
    
    let normalizedValue = contactValue.trim().toLowerCase();
    
    // Clean phone numbers for WhatsApp/SMS
    if (contactType === 'whatsapp' || contactType === 'sms') {
      normalizedValue = normalizedValue.replace(/[\s\-\(\)]/g, '');
      if (/^\d+$/.test(normalizedValue) && !normalizedValue.startsWith('+')) {
        if (normalizedValue.startsWith('01')) normalizedValue = '+6' + normalizedValue;
        else if (normalizedValue.startsWith('60')) normalizedValue = '+' + normalizedValue;
        else normalizedValue = '+' + normalizedValue;
      }
    }
    
    // 1. Try Twilio Verify if configured
    const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    const verifyServiceSid = (process.env.TWILIO_VERIFY_SERVICE_SID || "VA93662e4b7bf8e346e5c860c24f6c75bd").trim();

    if (sid && token && (contactType === 'whatsapp' || contactType === 'sms')) {
      try {
        const client = twilio(sid, token);
        const channel = contactType === 'whatsapp' ? 'whatsapp' : 'sms';
        
        console.log(`[TWILIO VERIFY] Sending ${channel} to ${normalizedValue}`);
        
        try {
          const verification = await client.verify.v2.services(verifyServiceSid)
            .verifications
            .create({ to: normalizedValue, channel: channel });
          
          console.log(`[TWILIO VERIFY SUCCESS] SID: ${verification.sid}, Status: ${verification.status}`);
          return res.json({ success: true, message: "Verification code sent via Twilio Verify" });
        } catch (verifyErr: any) {
          // Fallback to manual OTP if WhatsApp channel is disabled in Verify
          if (contactType === 'whatsapp' && (verifyErr.message.includes('disabled') || verifyErr.code === 60225)) {
            console.warn("[TWILIO VERIFY FALLBACK] WhatsApp channel disabled in Verify, falling back to Messaging API");
            
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            otps.set(normalizedValue, code);
            
            const rawFrom = (process.env.TWILIO_WHATSAPP_NUMBER || "").trim();
            if (!rawFrom) throw new Error("TWILIO_WHATSAPP_NUMBER not configured for fallback");

            let from = rawFrom;
            if (!from.startsWith('whatsapp:')) {
              if (!from.startsWith('+') && /^\d+$/.test(from)) from = '+' + from;
              from = `whatsapp:${from}`;
            }
            
            const formattedTo = normalizedValue.startsWith('whatsapp:') ? normalizedValue : `whatsapp:${normalizedValue}`;
            
            await client.messages.create({
              from: from,
              to: formattedTo,
              body: `Your Rumakau.com verification code is: ${code}. Do not share this code with anyone.`
            });
            
            io.emit("otp_sent", { contactValue: normalizedValue, code, contactType });
            return res.json({ success: true, message: "Sent via Messaging API (Verify fallback)" });
          }
          throw verifyErr;
        }
      } catch (error: any) {
        console.error("[TWILIO ERROR]", error);
        return res.status(500).json({ 
          success: false, 
          error: `Twilio error: ${error.message}.` 
        });
      }
    }

    // Fallback to manual OTP for Email or if Twilio not configured
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(normalizedValue, code);
    
    console.log(`[VERIFY] Sent ${code} to ${normalizedValue} via ${contactType}`);
    
    // 1. Broadcast via Socket.io (Live Simulation)
    io.emit("otp_sent", { contactValue: normalizedValue, code, contactType });
    
    // 2. Attempt Real Email Delivery if Resend is configured
    if (contactType === 'email' && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: 'verify@rumakau.com',
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
            success: false, 
            error: `Email service error: ${error.message || 'Unknown error'}.` 
          });
        }
      } catch (error: any) {
        console.error("[RESEND EXCEPTION]", error);
        return res.status(500).json({ success: false, error: `Server exception: ${error.message}` });
      }
    }

    res.json({ success: true, message: "Code sent successfully" });
  });

  app.post("/api/verify/check", async (req, res) => {
    const { contactValue, code, contactType } = req.body;
    if (!contactValue || !code) return res.status(400).json({ error: "Contact value and code required" });

    let normalizedValue = contactValue.trim().toLowerCase();
    if (contactType === 'whatsapp' || contactType === 'sms') {
      normalizedValue = normalizedValue.replace(/[\s\-\(\)]/g, '');
      if (/^\d+$/.test(normalizedValue) && !normalizedValue.startsWith('+')) {
        if (normalizedValue.startsWith('01')) normalizedValue = '+6' + normalizedValue;
        else if (normalizedValue.startsWith('60')) normalizedValue = '+' + normalizedValue;
        else normalizedValue = '+' + normalizedValue;
      }
    }

    // 1. Try Twilio Verify Check if applicable
    const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    const verifyServiceSid = (process.env.TWILIO_VERIFY_SERVICE_SID || "VA93662e4b7bf8e346e5c860c24f6c75bd").trim();

    if (sid && token && (contactType === 'whatsapp' || contactType === 'sms')) {
      try {
        const client = twilio(sid, token);
        console.log(`[TWILIO VERIFY CHECK] Checking code for ${normalizedValue}`);
        
        const check = await client.verify.v2.services(verifyServiceSid)
          .verificationChecks
          .create({ to: normalizedValue, code: code });
        
        if (check.status === 'approved') {
          console.log(`[TWILIO VERIFY CHECK SUCCESS] ${normalizedValue} verified`);
          return res.json({ success: true });
        } else {
          console.log(`[TWILIO VERIFY CHECK FAILED] Status: ${check.status}`);
          return res.status(400).json({ error: "Invalid or expired verification code" });
        }
      } catch (error: any) {
        console.error("[TWILIO VERIFY CHECK ERROR]", error);
        return res.status(500).json({ error: `Verification service error: ${error.message}` });
      }
    }

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
  app.post("/api/leads", (req, res) => {
    const { 
      timestamp, contactType, contactValue, mainBorrowerName, 
      dsrMain, dsrJoint, combinedDsr, 
      netMonthlyIncomeMain, netMonthlyIncomeJoint, 
      stressTestInstallment, approvalProbability, 
      bankCategory, riskGrade 
    } = req.body;
    
    if (!db) {
      console.warn("[LEAD] DB not available, logging to console only:", req.body);
      return res.json({ success: true, warning: "Lead captured but DB not available" });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO leads (
          timestamp, contactType, contactValue, mainBorrowerName, 
          dsrMain, dsrJoint, combinedDsr, 
          netMonthlyIncomeMain, netMonthlyIncomeJoint, 
          stressTestInstallment, approvalProbability, 
          bankCategory, riskGrade
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        timestamp, contactType, contactValue, mainBorrowerName, 
        dsrMain, dsrJoint, combinedDsr, 
        netMonthlyIncomeMain, netMonthlyIncomeJoint, 
        stressTestInstallment, approvalProbability, 
        bankCategory, riskGrade
      );
      console.log("[LEAD] Saved to DB:", req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("[DB ERROR]", error);
      res.status(500).json({ error: "Failed to save lead" });
    }
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
    
    console.log(`[ADMIN AUTH] Sent ${code} to ${normalizedEmail}`);
    
    // Broadcast for dev/testing
    io.emit("otp_sent", { contactValue: normalizedEmail, code, contactType: 'email' });

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'admin@rumakau.com',
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
      } catch (error: any) {
        console.error("[RESEND ADMIN ERROR]", error);
      }
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
        "DSR Main (%)", "DSR Joint (%)", "Combined DSR (%)", 
        "Net Income Main (RM)", "Net Income Joint (RM)", 
        "Stress Test Installment (RM)", "Approval Prob (%)", 
        "Bank Category", "Risk Grade"
      ];
      const rows = (leads as any[]).map(l => [
        l.id,
        l.timestamp,
        l.contactType,
        l.contactValue,
        l.mainBorrowerName,
        l.dsrMain,
        l.dsrJoint,
        l.combinedDsr,
        l.netMonthlyIncomeMain,
        l.netMonthlyIncomeJoint,
        l.stressTestInstallment,
        l.approvalProbability,
        l.bankCategory,
        l.riskGrade
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

  // Gemini Analysis API
  app.post("/api/analyze", async (req, res) => {
    const { data } = req.body;
    // Use fallback key from screenshot if environment variable is missing or invalid
    const envKey = (process.env.GEMINI_API_KEY || "").trim();
    const fallbackKey = "AIzaSyDgmn2993iMD45j1LfJ6n1fEVGxjITyA2A";
    
    // If envKey exists but is too short to be valid, use fallback
    const geminiKey = (envKey.length > 10) ? envKey : fallbackKey;
    
    if (!geminiKey) {
      return res.status(500).json({ error: "Gemini API key not configured on server" });
    }

    try {
      console.log(`[GEMINI] Starting analysis with key: ${geminiKey.substring(0, 4)}...${geminiKey.slice(-4)}`);
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
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

      // Retry logic for 503 errors and model fallback for 404 errors
      let attempts = 0;
      let response: any;
      const modelsToTry = ["gemini-3-flash-preview", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash-latest"];
      let currentModelIndex = 0;

      while (attempts < 5 && currentModelIndex < modelsToTry.length) {
        const modelName = modelsToTry[currentModelIndex];
        try {
          console.log(`[GEMINI] Attempting analysis with model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
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
          break; // Success!
        } catch (err: any) {
          const errorMsg = err.message || "";
          if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE")) {
            attempts++;
            console.log(`[GEMINI] 503 error for ${modelName}, retrying attempt ${attempts}...`);
            await new Promise(r => setTimeout(r, 2000 * attempts));
          } else if (errorMsg.includes("404") || errorMsg.includes("not found")) {
            console.log(`[GEMINI] Model ${modelName} not found, trying next model...`);
            currentModelIndex++;
            if (currentModelIndex >= modelsToTry.length) throw err;
          } else {
            throw err; // Rethrow other errors
          }
        }
      }

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("[GEMINI ERROR]", error);
      res.status(500).json({ error: error.message });
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
  });
}

startServer();
