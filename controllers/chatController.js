// controllers/chatController.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const HF_API_URL =
  "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium";
const HF_API_TOKEN = process.env.HF_API_TOKEN;

const petKnowledge = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/pet_knowledge.json"), "utf-8")
);

function findRelevantKnowledge(message) {
  for (const [key, value] of Object.entries(petKnowledge)) {
    if (message.includes(key)) return value;
  }
  return "";
}

async function chatWithBot(req, res) {
  try {
    const { message } = req.body;
    const knowledge = findRelevantKnowledge(message);
    const prompt = `אתה יועץ לחיות מחמד. ${knowledge}\n\nשאלה: ${message}`;

    const response = await axios.post(
      HF_API_URL,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botReply = response.data?.generated_text || "מצטער, לא הבנתי.";
    res.json({ reply: botReply });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ err });
  }
}

module.exports = { chatWithBot };
