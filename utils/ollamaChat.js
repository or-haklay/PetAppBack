// utils/ollamaChat.js
const axios = require("axios");

const OLLAMA_CHAT = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
const OLLAMA_GEN =
  process.env.OLLAMA_GENERATE || "http://localhost:11434/api/generate";
const MODEL = (process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct").toLowerCase();
const DEBUG = (process.env.DEBUG || "").toLowerCase() === "true";

const stripThink = (s = "") =>
  s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
const lightClean = (s = "") =>
  stripThink(s)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();

function trimMessages(messages, limit = 6) {
  const sys = messages.filter((m) => m.role === "system").slice(-1);
  const rest = messages.filter((m) => m.role !== "system");
  return [...sys, ...rest.slice(-limit)];
}
function dedupeConsecutiveUsers(messages) {
  const out = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (
      last &&
      last.role === "user" &&
      m.role === "user" &&
      last.content === m.content
    )
      continue;
    out.push(m);
  }
  return out;
}
function extractChatContent(data) {
  if (typeof data?.message?.content === "string") return data.message.content;
  if (Array.isArray(data?.message?.content))
    return data.message.content.map((p) => p?.text ?? p ?? "").join(" ");
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.content === "string") return data.content;
  if (Array.isArray(data?.content))
    return data.content.map((p) => p?.text || p || "").join(" ");
  return "";
}

async function chatOnce(messages, options = {}) {
  const payload = {
    model: (options.model || MODEL).toLowerCase(),
    messages: dedupeConsecutiveUsers(
      trimMessages(messages, options.keepLastN ?? 6)
    ),
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1,
      num_predict: options.num_predict ?? 256,
      stop: options.stop ?? ["\n\n"],
      ...(options.ollama || {}),
    },
  };
  if (DEBUG) console.log("[CHAT] >>>", JSON.stringify(payload, null, 2));
  const { data } = await axios.post(OLLAMA_CHAT, payload, {
    headers: { "Content-Type": "application/json" },
    timeout:
      options.timeoutMs ?? parseInt(process.env.OLLAMA_TIMEOUT || "30000"),
  });
  const cleaned = lightClean(extractChatContent(data));
  if (DEBUG) console.log("[CHAT] <<<", cleaned);
  return cleaned;
}

async function generateOnce(prompt, options = {}) {
  const payload = {
    model: (options.model || MODEL).toLowerCase(),
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1,
      num_predict: options.num_predict ?? 256,
      stop: options.stop ?? ["\n\n"],
      ...(options.ollama || {}),
    },
  };
  if (DEBUG) console.log("[GEN] >>>", JSON.stringify(payload, null, 2));
  const { data } = await axios.post(OLLAMA_GEN, payload, {
    headers: { "Content-Type": "application/json" },
    timeout:
      options.timeoutMs ?? parseInt(process.env.OLLAMA_TIMEOUT || "30000"),
  });
  const cleaned = lightClean(
    typeof data?.response === "string" ? data.response : ""
  );
  if (DEBUG) console.log("[GEN] <<<", cleaned);
  return cleaned;
}

async function chat(messages, options = {}) {
  let out = await chatOnce(messages, options);
  if (out) return out;
  out = await chatOnce(messages, {
    ...options,
    temperature: 0.15,
    num_predict: 220,
    keepLastN: 4,
  });
  if (out) return out;
  const lastUser =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";
  return await generateOnce(lastUser, { temperature: 0.2, num_predict: 220 });
}

module.exports = { chat, generateOnce, stripThink, lightClean };
