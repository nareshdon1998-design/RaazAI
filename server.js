import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash"
];

const RAAZ_SYSTEM_PROMPT = `
You are RAAZ AI, a personal AI assistant developed by RAAZ DEVELOPMENT.
Personality: Inspired by JARVIS — calm, intelligent, polite, and confident.
Understand Hindi, English, and Hinglish naturally and reply in the user's matched language.
Keep answers helpful, clear, and concise.
`.trim();

app.get("/", (_req, res) => res.json({ status: "ok", service: "RAAZ AI Backend" }));
app.get("/health", (_req, res) => res.json({ status: "ok", service: "RAAZ AI Backend" }));

app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing on server." });
    }
    const { message, languageMode = "auto", history = [], deviceInfo = {} } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message required." });
    }

    const contents = [];
    for (const item of history.slice(-10)) {
      if (item?.role && item?.text) {
        contents.push({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.text }]
        });
      }
    }
    const prefix = `[Lang: ${languageMode} | Battery: ${deviceInfo.battery ?? "?"}%]\n`;
    contents.push({ role: "user", parts: [{ text: prefix + message }] });

    let lastErr = "AI request failed";
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const apiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: RAAZ_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
        })
      });
      const data = await apiRes.json();
      if (apiRes.ok) {
        const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim();
        if (reply) return res.json({ reply, model });
      }
      lastErr = data?.error?.message || `HTTP ${apiRes.status}`;
      if (apiRes.status !== 404) break;
    }

    res.status(500).json({ error: lastErr });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RAAZ AI running on ${PORT}`));
