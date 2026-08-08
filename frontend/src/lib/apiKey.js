const STORAGE_KEY = "documind_api_key_config";

/** Groq is listed first — it's the free option, and the one most people land on. */
export const PROVIDERS = [
  {
    id: "groq",
    label: "Groq",
    hint: "Free. Create a key at console.groq.com/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Paid. Create a key at platform.openai.com/api-keys",
  },
];

/** Reads the user's saved provider + key from localStorage. Never talks to the backend —
 *  this app has no server-side key, so a missing/invalid value here just means "not
 *  connected yet," not an error. */
export function getApiKeyConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveApiKeyConfig({ provider, apiKey, model }) {
  const config = { provider, apiKey, model: model || null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function clearApiKeyConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
