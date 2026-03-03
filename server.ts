import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    
    res.json({ 
      hasResend: !!resendKey,
      resendPreview: resendKey ? `${resendKey.substring(0, 4)}...` : null,
      hasTwilio: !!(twilioSid && twilioToken && twilioNumber),
      twilioPreview: twilioSid ? `${twilioSid.substring(0, 4)}...` : null
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
    console.log("[LEAD] Captured:", req.body);
    res.json({ success: true });
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
