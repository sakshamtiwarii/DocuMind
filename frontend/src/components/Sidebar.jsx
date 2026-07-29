import clsx from "clsx";
import Wordmark from "./Wordmark";
import { IconClose, IconPlus, IconTrash } from "./icons";

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

/** Keeps the start and the extension legible instead of lopping off ".pdf". */
function shortenFilename(name, max = 26) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot < 1) return `${name.slice(0, max - 1)}…`;
  const ext = name.slice(dot);
  return `${name.slice(0, max - ext.length - 1)}…${ext}`;
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
  onClose,
}) {
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
            className="flex w-full items-center gap-2 rounded-[3px] border border-rule-strong px-3 py-2 text-[0.8125rem] text-ink transition-colors hover:border-clay hover:text-clay"
          >
            <IconPlus size={14} />
            New conversation
          </button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto overscroll-contain pb-6">
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
                          onClick={() => onSelect(c.id)}
                          className={clsx(
                            "group relative flex cursor-pointer items-start gap-2 border-l-2 py-2 pl-[1.125rem] pr-4 transition-colors",
                            isActive
                              ? "border-clay bg-paper"
                              : "border-transparent hover:bg-paper/60"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={clsx(
                                "truncate text-[0.8125rem] leading-snug",
                                isActive ? "text-ink" : "text-muted group-hover:text-ink"
                              )}
                            >
                              {c.title}
                            </p>
                            <p className="mt-0.5 truncate text-[0.6875rem] text-faint">
                              {subtitleOf(c.documents)} · {formatTime(c.updated_at)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${c.title}"? This can't be undone.`)) {
                                onDelete(c.id);
                              }
                            }}
                            className="mt-0.5 shrink-0 p-0.5 text-faint opacity-0 transition-opacity hover:text-oxblood focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Delete ${c.title}`}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      </aside>
    </>
  );
}
