import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import fs from "fs";
import { Server } from "socket.io";
import dotenv from "dotenv";
import Database from "better-sqlite3";

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
      combinedDsr REAL,
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
    const resendKey = process.env.RESEND_API_KEY || "";
    const twilioSid = process.env.TWILIO_ACCOUNT_SID || "";
    const twilioToken = process.env.TWILIO_AUTH_TOKEN || "";
    const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER || "";
    // Hardcoded fallback from user's screenshot to ensure it works immediately
    const geminiKey = process.env.GEMINI_API_KEY || "AIzaSyDgmn2993iMD45j1LfJ6n1fEVGxjITyA2A";
    
    res.json({ 
      hasResend: !!resendKey,
      resendPreview: resendKey ? `${resendKey.substring(0, 4)}...` : null,
      hasTwilio: !!(twilioSid && twilioToken && twilioNumber),
      twilioPreview: twilioSid ? `${twilioSid.substring(0, 4)}...` : null,
      hasGemini: !!geminiKey,
      geminiPreview: geminiKey ? `${geminiKey.substring(0, 4)}...` : null,
      dbStatus: !!db ? "Connected" : "Error"
    });
  });

  // Mock Verification API
  const otps = new Map<string, string>();

  app.post("/api/verify/send", async (req, res) => {
    const { contactType, contactValue } = req.body;
    if (!contactValue) return res.status(400).json({ error: "Contact value required" });
    
    const normalizedValue = contactValue.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otps.set(normalizedValue, code);
    
    console.log(`[VERIFY] Sent ${code} to ${normalizedValue} via ${contactType}`);
    
    // 1. Broadcast via Socket.io (Live Simulation)
    io.emit("otp_sent", { contactValue: normalizedValue, code, contactType });
    
    // 2. Attempt Real Email Delivery if Resend is configured
    if (contactType === 'email' && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: 'onboarding@resend.dev',
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

    // 3. Attempt Real WhatsApp Delivery if Twilio is configured
    if (contactType === 'whatsapp' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
      try {
        const twilio = await import('twilio');
        const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        // Ensure the number is in WhatsApp format for Twilio
        const to = normalizedValue.startsWith('whatsapp:') ? normalizedValue : `whatsapp:${normalizedValue}`;
        
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: to,
          body: `Your Rumakau.com verification code is: ${code}. Do not share this code with anyone.`
        });
        
        console.log(`[TWILIO SUCCESS] WhatsApp sent to ${to}`);
      } catch (error: any) {
        console.error("[TWILIO ERROR]", error);
        return res.status(500).json({ 
          success: false, 
          error: `WhatsApp service error: ${error.message}. Please check your Twilio credentials.` 
        });
      }
    }
    
    res.json({ success: true, message: "Code sent successfully" });
  });

  app.post("/api/verify/check", (req, res) => {
    const { contactValue, code } = req.body;
    const normalizedValue = contactValue.trim().toLowerCase();
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
    const { timestamp, contactType, contactValue, mainBorrowerName, combinedDsr, riskGrade } = req.body;
    
    if (!db) {
      console.warn("[LEAD] DB not available, logging to console only:", req.body);
      return res.json({ success: true, warning: "Lead captured but DB not available" });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO leads (timestamp, contactType, contactValue, mainBorrowerName, combinedDsr, riskGrade)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(timestamp, contactType, contactValue, mainBorrowerName, combinedDsr, riskGrade);
      console.log("[LEAD] Saved to DB:", req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("[DB ERROR]", error);
      res.status(500).json({ error: "Failed to save lead" });
    }
  });

  // Admin Download API
  app.get("/api/admin/leads/download", (req, res) => {
    if (!db) {
      return res.status(500).send("Database not available.");
    }
    try {
      const leads = db.prepare("SELECT * FROM leads ORDER BY timestamp DESC").all();
      
      if (leads.length === 0) {
        return res.status(404).send("No leads found to download.");
      }

      // Generate CSV
      const headers = ["ID", "Timestamp", "Type", "Contact", "Name", "DSR", "Grade"];
      const rows = (leads as any[]).map(l => [
        l.id,
        l.timestamp,
        l.contactType,
        l.contactValue,
        l.mainBorrowerName,
        l.combinedDsr,
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
    // Use fallback key from screenshot if environment variable is missing
    const geminiKey = process.env.GEMINI_API_KEY || "AIzaSyDgmn2993iMD45j1LfJ6n1fEVGxjITyA2A";
    
    if (!geminiKey) {
      return res.status(500).json({ error: "Gemini API key not configured on server" });
    }

    try {
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
