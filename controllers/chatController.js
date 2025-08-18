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

// פונקציה ליצירת system prompt מותאם עם מידע על חיית המחמד
function createSystemPrompt(petInfo) {
  let basePrompt = "You are a PET-CARE expert. ONLY answer pet-related questions. " +
    "Be concise. English only for internal reasoning. Do not include chain-of-thought.";
  
  if (petInfo && petInfo.name) {
    const species = petInfo.species === 'dog' ? 'dog' : petInfo.species === 'cat' ? 'cat' : 'pet';
    const sex = petInfo.sex === 'male' ? 'male' : petInfo.sex === 'female' ? 'female' : 'unknown';
    
    basePrompt += `\n\nIMPORTANT CONTEXT: The user has a ${species} named "${petInfo.name}". `;
    
    if (petInfo.breed) basePrompt += `Breed: ${petInfo.breed}. `;
    if (petInfo.sex !== 'unknown') basePrompt += `Sex: ${sex}. `;
    if (petInfo.weightKg) basePrompt += `Weight: ${petInfo.weightKg}kg. `;
    if (petInfo.color) basePrompt += `Color: ${petInfo.color}. `;
    if (petInfo.birthDate) {
      const age = calculateAge(petInfo.birthDate);
      basePrompt += `Age: approximately ${age}. `;
    }
    if (petInfo.notes) basePrompt += `Notes: ${petInfo.notes}. `;
    
    basePrompt += `\n\nWhen answering questions, consider this specific pet's details and provide personalized advice when relevant. `;
    basePrompt += `Always refer to the pet by name when appropriate.`;
  }
  
  return basePrompt;
}

// פונקציה לחישוב גיל
function calculateAge(birthDate) {
  if (!birthDate) return 'unknown';
  
  const birth = new Date(birthDate);
  const now = new Date();
  const diffTime = Math.abs(now - birth);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) return `${diffDays} days`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  return `${Math.floor(diffDays / 365)} years`;
}

function shorten(text, max = 500) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

exports.sendMessage = async (req, res) => {
  try {
    const userRaw = String(req.body.prompt || "").trim();
    if (!userRaw) {
      console.error("❌ No prompt provided in request body");
      return res.status(400).json({ error: "Prompt is required" });
    }

    // קבלת מידע על חיית המחמד
    const petInfo = req.body.petInfo || null;

    // יצירת system prompt מותאם
    const systemPrompt = createSystemPrompt(petInfo);

    // איפוס ההיסטוריה עם ה-system prompt החדש
    conversationHistory = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    const isHeb = hasHebrew(userRaw);
    const isEng = looksEnglish(userRaw);

    // --- מסלול עברית: he→en→LLM→en→he
    if (isHeb) {
      const userHe = shorten(userRaw, 500);

      let userEn;
      try {
        userEn = await he2en(userHe);
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
      return res.json({ reply: heOut || "לא הצלחתי לענות כרגע." });
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

      const finalEn = lightClean(stripThink(rawEn));
      conversationHistory.push({ role: "assistant", content: rawEn });
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
