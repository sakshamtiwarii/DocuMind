import { useState } from "react";
import clsx from "clsx";
import Wordmark from "./Wordmark";
import { shortenFilename } from "../lib/format";
import { IconClose, IconKey, IconPen, IconPlus, IconTrash } from "./icons";

const PROVIDER_LABEL = { groq: "Groq", openai: "OpenAI" };

const DAY_MS = 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Buckets conversations the way a person would think about them, not by raw date. */
function bucketOf(isoString) {
  const today = startOfToday();
  const t = new Date(isoString).getTime();
  if (t >= today) return "Today";
  if (t >= today - DAY_MS) return "Yesterday";
  if (t >= today - 7 * DAY_MS) return "Earlier this week";
  if (t >= today - 30 * DAY_MS) return "Earlier this month";
  return "Older";
}

const BUCKET_ORDER = ["Today", "Yesterday", "Earlier this week", "Earlier this month", "Older"];

function formatTime(isoString) {
  const d = new Date(isoString);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (d.getTime() >= startOfToday()) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function subtitleOf(documents) {
  if (!documents.length) return "no document yet";
  if (documents.length === 1) return shortenFilename(documents[0].filename);
  return `${documents.length} documents`;
}

export default function Sidebar({
  conversations,
  activeId,
  isLoading,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onClose,
  onOpenSettings,
  apiKeyProvider,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState("");

  function startRename(conversation) {
    setRenamingId(conversation.id);
    setDraft(conversation.title ?? "");
  }

  function commitRename() {
    const next = draft.trim();
    if (next) onRename(renamingId, next);
    setRenamingId(null);
  }

  const grouped = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: conversations.filter((c) => bucketOf(c.updated_at) === bucket),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 flex w-[17.5rem] shrink-0 flex-col border-r border-rule bg-raised transition-transform md:static md:z-auto md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Wordmark className="text-[1.0625rem]" />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-faint transition-colors hover:text-ink md:hidden"
            aria-label="Close conversations"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="px-4">
          <button
            type="button"
            onClick={onNew}
            aria-label="Start a new conversation"
            className="flex w-full items-center gap-2 rounded-[3px] border border-rule-strong px-3 py-2 text-[0.8125rem] text-ink transition-colors hover:border-clay hover:text-clay"
          >
            <IconPlus size={14} />
            New conversation
          </button>
        </div>

        <div className="scroll-quiet mt-6 flex-1 overflow-y-auto overscroll-contain pb-6">
          {isLoading && (
            <div className="space-y-3 px-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-2/3 rounded-[2px] bg-rule" />
                  <div className="h-2.5 w-2/5 rounded-[2px] bg-rule/60" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <p className="px-5 font-serif text-[0.9375rem] leading-relaxed text-faint">
              Nothing here yet. Start a conversation and add a PDF to it.
            </p>
          )}

          {!isLoading &&
            grouped.map(({ bucket, items }) => (
              <section key={bucket} className="mb-6 last:mb-0">
                <h2 className="label px-5 pb-2 text-faint">{bucket}</h2>
                <ul>
                  {items.map((c) => {
                    const isActive = c.id === activeId;
                    return (
                      <li key={c.id}>
                        <div
                          onDoubleClick={() => startRename(c)}
                          className={clsx(
                            "group relative flex items-start gap-1.5 border-l-2 py-2 pl-[1.125rem] pr-3 transition-colors",
                            isActive
                              ? "border-clay bg-paper"
                              : "border-transparent hover:bg-paper/60 focus-within:bg-paper/60"
                          )}
                        >
                          {renamingId === c.id ? (
                            <div className="min-w-0 flex-1">
                              <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitRename();
                                  } else if (e.key === "Escape") {
                                    setRenamingId(null);
                                  }
                                }}
                                maxLength={120}
                                aria-label="Conversation title"
                                className="w-full rounded-[2px] border border-clay bg-raised px-1.5 py-0.5 text-[0.8125rem] text-ink outline-none"
                              />
                              <p className="mt-0.5 truncate text-[0.6875rem] text-faint">
                                {subtitleOf(c.documents)} · {formatTime(c.updated_at)}
                              </p>
                            </div>
                          ) : (
                            /* A real button, so conversations are reachable and openable by
                               keyboard — not just their rename/delete controls. */
                            <button
                              type="button"
                              onClick={() => onSelect(c.id)}
                              aria-current={isActive ? "true" : undefined}
                              className="min-w-0 flex-1 cursor-pointer text-left"
                            >
                              <span
                                className={clsx(
                                  "block truncate text-[0.8125rem] leading-snug",
                                  isActive ? "text-ink" : "text-muted group-hover:text-ink"
                                )}
                              >
                                {c.title || "New conversation"}
                              </span>
                              <span className="mt-0.5 block truncate text-[0.6875rem] text-faint">
                                {subtitleOf(c.documents)} · {formatTime(c.updated_at)}
                              </span>
                            </button>
                          )}

                          {renamingId !== c.id && (
                            <div className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startRename(c);
                                }}
                                className="p-0.5 text-faint transition-colors hover:text-clay"
                                aria-label={`Rename ${c.title || "conversation"}`}
                              >
                                <IconPen size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const label = c.title || "this conversation";
                                  if (window.confirm(`Delete "${label}"? This can't be undone.`)) {
                                    onDelete(c.id);
                                  }
                                }}
                                className="p-0.5 text-faint transition-colors hover:text-oxblood"
                                aria-label={`Delete ${c.title || "conversation"}`}
                              >
                                <IconTrash size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>

        <div className="shrink-0 border-t border-rule px-4 py-4">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 text-[0.8125rem] text-muted transition-colors hover:text-clay"
          >
            <IconKey size={14} />
            {PROVIDER_LABEL[apiKeyProvider] ?? "API key"}
          </button>
        </div>
      </aside>
    </>
  );
}
