// utils/translator.js
const axios = require("axios");
const {
  translate: googleTranslate,
} = require("@vitalets/google-translate-api");
let deepl = null;
try {
  deepl = require("deepl-node");
} catch (_) {}

const PROVIDER = (process.env.TRANSLATOR_PROVIDER || "google").toLowerCase();
const DEBUG = (process.env.DEBUG || "").toLowerCase() === "true";

const OLLAMA_GEN =
  process.env.OLLAMA_GENERATE || "http://localhost:11434/api/generate";
const MODEL = (process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct").toLowerCase();

function hasHebrew(s = "") {
  return /[\u0590-\u05FF]/.test(s);
}
function looksEnglish(s = "") {
  const letters = s.replace(/[^A-Za-z]/g, "").length;
  const total = s.replace(/\s/g, "").length || 1;
  return letters / total > 0.6;
}

function isGenericBadEn(s = "") {
  const t = s.toLowerCase().trim();
  return (
    !t ||
    /^how can i help( you)?( with that)?\??$/.test(t) ||
    /^i'm sorry, but/i.test(t)
  );
}

async function withRetry(fn, times = 2, delayMs = 250) {
  let err;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (DEBUG) console.log("[TR] retry", i + 1, e?.message);
    }
    await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  throw err;
}

async function gTranslate(text, from, to) {
  const { text: out } = await googleTranslate(text, { from, to });
  return String(out || "").trim();
}

async function deeplTranslate(text, toCode /* "EN"/"HE" */) {
  if (!deepl) throw new Error("deepl-node not installed");
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY missing");
  const tr = new deepl.Translator(key);
  const res = await tr.translateText(text, null, toCode);
  return String(res?.text || "").trim();
}

async function llmTranslate(text, target /* "English"|"Hebrew" */) {
  const { data } = await axios.post(
    OLLAMA_GEN,
    {
      model: MODEL,
      prompt: `Translate into ${target} only. Return the translation only, no explanations:\n\n${text}`,
      stream: false,
      options: { temperature: 0.05, num_predict: 250 },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || "30000"),
    }
  );
  return String(data?.response || "").trim();
}

// --- he → en ---
async function he2en(heText) {
  try {
    const en = await withRetry(() => gTranslate(heText, "he", "en"), 2);
    if (!isGenericBadEn(en)) return en;
    if (DEBUG) console.log("[TR] he→en generic:", en);
  } catch (e) {
    if (DEBUG) console.log("[TR] he→en google failed:", e?.message);
  }

  try {
    if (PROVIDER === "deepl" && deepl) {
      const en = await withRetry(() => deeplTranslate(heText, "EN"), 2);
      if (!isGenericBadEn(en)) return en;
      if (DEBUG) console.log("[TR] he→en deepl generic:", en);
    }
  } catch (e) {
    if (DEBUG) console.log("[TR] he→en deepl failed:", e?.message);
  }

  // פאלבק: תרגום במודל
  try {
    const en = await llmTranslate(heText, "English");
    return en;
  } catch (e) {
    if (DEBUG) console.log("[TR] he→en LLM failed:", e?.message);
  }

  return heText; // לא נתקע
}

// --- en → he ---
async function en2he(enText) {
  try {
    let he = await withRetry(() => gTranslate(enText, "en", "he"), 2);
    if (hasHebrew(he)) return he;
    if (DEBUG) console.log("[TR] en→he non-Hebrew, retrying Google");
    he = await withRetry(() => gTranslate(enText, "en", "he"), 1);
    if (hasHebrew(he)) return he;
  } catch (e) {
    if (DEBUG) console.log("[TR] en→he google failed:", e?.message);
  }

  try {
    if (PROVIDER === "deepl" && deepl) {
      const he = await withRetry(() => deeplTranslate(enText, "HE"), 2);
      if (hasHebrew(he)) return he;
    }
  } catch (e) {
    if (DEBUG) console.log("[TR] en→he deepl failed:", e?.message);
  }

  // פאלבק: תרגום במודל
  try {
    const he = await llmTranslate(enText, "Hebrew");
    return he;
  } catch (e) {
    if (DEBUG) console.log("[TR] en→he LLM failed:", e?.message);
  }

  return enText;
}

module.exports = { he2en, en2he, hasHebrew, looksEnglish };
