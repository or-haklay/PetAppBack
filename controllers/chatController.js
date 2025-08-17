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
    console.log("🔍 Chat request received:", {
      body: req.body,
      headers: req.headers,
    });

    const userRaw = String(req.body.prompt || "").trim();
    if (!userRaw) {
      console.error("❌ No prompt provided in request body");
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log("📝 User message:", userRaw);

    const isHeb = hasHebrew(userRaw);
    const isEng = looksEnglish(userRaw);

    console.log("🌍 Language detection:", { isHeb, isEng });

    // --- מסלול עברית: he→en→LLM→en→he
    if (isHeb) {
      console.log("🇮🇱 Processing Hebrew message...");
      const userHe = shorten(userRaw, 500);

      let userEn;
      try {
        userEn = await he2en(userHe);
        console.log(
          "✅ Translation successful:",
          userEn.substring(0, 50) + "..."
        );
      } catch (translationError) {
        console.warn(
          "⚠️ Translation failed, using Hebrew text directly:",
          translationError.message
        );
        userEn = userHe; // fallback to original Hebrew
      }

      if (DEBUG) {
        console.log("[CTRL] user HE:", userHe);
        console.log("[CTRL] user EN:", userEn);
      }

      conversationHistory.push({ role: "user", content: userEn });

      console.log("🤖 Calling Ollama chat...");
      let rawEn = await chat(conversationHistory, {
        temperature: 0.2,
        num_predict: 256,
        keepLastN: 6,
        stop: ["\n\n"],
      });

      if (!rawEn) {
        console.log("🔄 Chat failed, trying generate...");
        rawEn = await generateOnce(userEn, {
          temperature: 0.2,
          num_predict: 220,
        });
      }

      if (!rawEn) {
        console.error("❌ Both chat and generate failed");
        // Fallback response when Ollama is not available
        const fallbackResponse = isHeb
          ? "אני מצטער, כרגע אני לא יכול לענות על השאלה שלך. אנא נסה שוב מאוחר יותר או פנה לווטרינר."
          : "I'm sorry, I cannot answer your question right now. Please try again later or contact a veterinarian.";

        return res.json({
          reply: fallbackResponse,
        });
      }

      console.log("✅ Ollama response received:", rawEn);

      let heOut;
      try {
        heOut = await en2he(rawEn);
        heOut = lightClean(stripThink(heOut));
      } catch (translationError) {
        console.warn(
          "⚠️ Hebrew translation failed, using English response:",
          translationError.message
        );
        heOut = rawEn; // fallback to English
      }

      conversationHistory.push({ role: "assistant", content: rawEn });
      console.log("🎯 Final response:", heOut);
      return res.json({ reply: heOut || "לא הצלחתי לענות כרגע." });
    }

    // --- מסלול אנגלית: EN→LLM→EN (ללא תרגום)
    // אם זה לא עברית אבל נראה אנגלית – נטפל ככה
    if (isEng || !isHeb) {
      console.log("🇺🇸 Processing English message...");
      const userEn = shorten(userRaw, 600);
      if (DEBUG) console.log("[CTRL] user EN (direct):", userEn);

      conversationHistory.push({ role: "user", content: userEn });

      console.log("🤖 Calling Ollama chat...");
      let rawEn = await chat(conversationHistory, {
        temperature: 0.2,
        num_predict: 256,
        keepLastN: 6,
        stop: ["\n\n"],
      });

      if (!rawEn) {
        console.log("🔄 Chat failed, trying generate...");
        rawEn = await generateOnce(userEn, {
          temperature: 0.2,
          num_predict: 220,
        });
      }

      if (!rawEn) {
        console.error("❌ Both chat and generate failed");
        return res.json({ reply: "No response right now, please try again." });
      }

      console.log("✅ Ollama response received:", rawEn);

      const finalEn = lightClean(stripThink(rawEn));
      conversationHistory.push({ role: "assistant", content: rawEn });
      console.log("🎯 Final English response:", finalEn);
      return res.json({
        reply: finalEn || "No response right now, please try again.",
      });
    }
  } catch (err) {
    console.error("💥 sendMessage error:", err);
    console.error(
      "💥 Error details:",
      err?.response?.data || err?.message || err
    );
    return res.status(500).json({ error: "Server error" });
  }
};

exports.resetConversation = (req, res) => {
  resetHistory();
  res.json({ message: "Conversation reset" });
};
