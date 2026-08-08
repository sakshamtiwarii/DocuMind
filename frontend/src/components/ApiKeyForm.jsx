import { useState } from "react";
import clsx from "clsx";
import { PROVIDERS } from "../lib/apiKey";

/** The provider + key fields shared by the first-run gate and the "change key" modal.
 *  Nothing here ever leaves the browser except inside a direct request to /ask — there's
 *  no server-side key, so this key is the only thing that makes the app work. */
export default function ApiKeyForm({
  initialProvider = "groq",
  initialApiKey = "",
  onSave,
  onCancel,
  onRemove,
}) {
  const [provider, setProvider] = useState(initialProvider);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [isRevealed, setIsRevealed] = useState(false);

  const active = PROVIDERS.find((p) => p.id === provider);
  const canSave = apiKey.trim().length > 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;
    onSave({ provider, apiKey: apiKey.trim() });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="label mb-2 text-faint">Provider</p>
      <div className="flex gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            aria-pressed={provider === p.id}
            className={clsx(
              "flex-1 rounded-[3px] border px-3 py-2 text-[0.8125rem] transition-colors",
              provider === p.id
                ? "border-clay text-clay"
                : "border-rule-strong text-muted hover:border-clay hover:text-clay"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-4 label text-faint">API key</p>
      <div className="mt-2 flex items-center rounded-[3px] border border-rule-strong bg-raised focus-within:border-clay">
        <input
          type={isRevealed ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={active.id === "groq" ? "gsk_…" : "sk-…"}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[0.8125rem] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={() => setIsRevealed((v) => !v)}
          className="shrink-0 px-3 text-[0.6875rem] text-faint transition-colors hover:text-ink"
        >
          {isRevealed ? "Hide" : "Show"}
        </button>
      </div>
      <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
        {active.hint}. Kept only in this browser and sent straight to {active.label} with each
        question — this app's own server never sees or stores it.
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[0.8125rem] text-faint transition-colors hover:text-oxblood"
            >
              Remove key
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[0.8125rem] text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave}
            className={clsx(
              "label rounded-[3px] border px-4 py-2 transition-colors",
              canSave
                ? "border-clay text-clay hover:bg-clay hover:text-paper"
                : "cursor-not-allowed border-rule text-faint"
            )}
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
