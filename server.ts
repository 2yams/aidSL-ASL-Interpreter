import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { generateSignSubtext, chatWithMentor, analyzeFrameGesture } from "./src/server/geminiService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// API Endpoints
app.post("/api/subtext", async (req, res) => {
  try {
    const { letter, wordContext, apiKey } = req.body || {};
    if (!letter) {
      return res.status(400).json({ error: "Letter is required" });
    }
    const subtext = await generateSignSubtext(letter, wordContext, apiKey);
    res.json({ subtext });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate subtext" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, apiKey } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array required" });
    }
    const reply = await chatWithMentor(messages, apiKey);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: "Failed to process mentor chat" });
  }
});

app.post("/api/analyze-frame", async (req, res) => {
  try {
    const { base64Image, targetLetter, apiKey } = req.body || {};
    if (!base64Image || !targetLetter) {
      return res.status(400).json({ error: "Missing image or target letter" });
    }
    const result = await analyzeFrameGesture(base64Image, targetLetter, apiKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to analyze frame" });
  }
});

// Serve static frontend files from dist
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`aidSL Server listening on port ${PORT}`);
});
