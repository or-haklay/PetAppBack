// controllers/chatController.js
const {
  chat,
  generateOnce,
  lightClean,
  stripThink,
} = require("../utils/ollamaChat");
const {
  he2en,
  en2he,
  hasHebrew,
  looksEnglish,
} = require("../utils/translator");

const DEBUG = (process.env.DEBUG || "").toLowerCase() === "true";

// היסטוריה באנגלית (המודל עובד באנגלית פנימית תמיד)
let conversationHistory = [
  {
    role: "system",
    content:
      "You are a PET-CARE expert. ONLY answer pet-related questions. " +
      "Be concise. English only for internal reasoning. Do not include chain-of-thought.",
  },
];

function resetHistory() {
  conversationHistory = [
    {
      role: "system",
      content:
        "You are a PET-CARE expert. ONLY answer pet-related questions. " +
        "Be concise. English only for internal reasoning. Do not include chain-of-thought.",
    },
  ];
}

function shorten(text, max = 500) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

exports.sendMessage = async (req, res) => {
  try {
    const userRaw = String(req.body.prompt || "").trim();
    if (!userRaw) return res.status(400).json({ error: "Prompt is required" });

    const isHeb = hasHebrew(userRaw);
    const isEng = looksEnglish(userRaw);

    // --- מסלול עברית: he→en→LLM→en→he
    if (isHeb) {
      const userHe = shorten(userRaw, 500);
      const userEn = await he2en(userHe);
      if (DEBUG) {
        console.log("[CTRL] user HE:", userHe);
        console.log("[CTRL] user EN:", userEn);
      }

      conversationHistory.push({ role: "user", content: userEn });

      let rawEn = await chat(conversationHistory, {
        temperature: 0.2,
        num_predict: 256,
        keepLastN: 6,
        stop: ["\n\n"],
      });
      if (!rawEn)
        rawEn = await generateOnce(userEn, {
          temperature: 0.2,
          num_predict: 220,
        });
      if (!rawEn)
        return res.json({
          reply: "לא הצלחתי לענות כרגע. נסה לשאול שוב בקצרה.",
        });

      let heOut = await en2he(rawEn);
      let finalHe = lightClean(stripThink(heOut));

      conversationHistory.push({ role: "assistant", content: rawEn });
      return res.json({ reply: finalHe || "לא הצלחתי לענות כרגע." });
    }

    // --- מסלול אנגלית: EN→LLM→EN (ללא תרגום)
    // אם זה לא עברית אבל נראה אנגלית – נטפל ככה
    if (isEng || !isHeb) {
      const userEn = shorten(userRaw, 600);
      if (DEBUG) console.log("[CTRL] user EN (direct):", userEn);

      conversationHistory.push({ role: "user", content: userEn });

      let rawEn = await chat(conversationHistory, {
        temperature: 0.2,
        num_predict: 256,
        keepLastN: 6,
        stop: ["\n\n"],
      });
      if (!rawEn)
        rawEn = await generateOnce(userEn, {
          temperature: 0.2,
          num_predict: 220,
        });
      if (!rawEn)
        return res.json({ reply: "No response right now, please try again." });

      const finalEn = lightClean(stripThink(rawEn));
      conversationHistory.push({ role: "assistant", content: rawEn });
      return res.json({
        reply: finalEn || "No response right now, please try again.",
      });
    }
  } catch (err) {
    console.error(
      "sendMessage error:",
      err?.response?.data || err?.message || err
    );
    return res.status(500).json({ error: "Server error" });
  }
};

exports.resetConversation = (req, res) => {
  resetHistory();
  res.json({ message: "Conversation reset" });
};
