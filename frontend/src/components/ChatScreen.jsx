import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import DocumentChip from "./DocumentChip";
import Dropzone from "./Dropzone";
import Message from "./Message";
import Spinner from "./Spinner";
import { IconPanel, IconPen, IconPlus } from "./icons";

const SUGGESTIONS = [
  "What is this document about?",
  "Summarise the main points.",
  "What does it recommend, and why?",
];

export default function ChatScreen({
  title,
  documents,
  messages,
  isLoadingActive,
  isAsking,
  isUploading,
  onSend,
  onAddDocument,
  onRemoveDocument,
  onRename,
  onOpenSidebar,
}) {
  const [input, setInput] = useState("");
  const [draftTitle, setDraftTitle] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasReadyDocument = documents.some((d) => d.status === "ready");
  const isIndexing = documents.some((d) => d.status === "processing");
  const canSend = Boolean(input.trim()) && !isAsking && hasReadyDocument;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSend) return;
    onSend(input);
    setInput("");
  }

  function commitRename() {
    const next = (draftTitle ?? "").trim();
    if (next && next !== title) onRename(next);
    setDraftTitle(null);
  }

  if (isLoadingActive) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5 text-clay" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col overflow-hidden px-6 sm:px-10">
      <header className="shrink-0 border-b border-rule py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="-ml-1 p-1 text-muted transition-colors hover:text-ink md:hidden"
            aria-label="Show conversations"
          >
            <IconPanel size={18} />
          </button>

          {draftTitle === null ? (
            <h1 className="group/title flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftTitle(title)}
                title="Rename this conversation"
                className="min-w-0 truncate font-serif text-[1.0625rem] font-medium text-ink transition-colors hover:text-clay"
              >
                {title}
              </button>
              <IconPen
                size={13}
                className="shrink-0 text-faint opacity-0 transition-opacity group-hover/title:opacity-100"
              />
            </h1>
          ) : (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setDraftTitle(null);
                }
              }}
              maxLength={120}
              aria-label="Conversation title"
              className="min-w-0 flex-1 rounded-[3px] border border-clay bg-raised px-2 py-1 font-serif text-[1.0625rem] font-medium text-ink outline-none"
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAddDocument(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex shrink-0 items-center gap-1.5 rounded-[3px] border border-rule-strong px-2.5 py-1.5 text-[0.8125rem] text-ink transition-colors hover:border-clay hover:text-clay disabled:cursor-not-allowed disabled:border-rule disabled:text-faint"
          >
            {isUploading ? <Spinner className="size-3.5" /> : <IconPlus size={14} />}
            {isUploading ? "Uploading…" : "Add PDF"}
          </button>
        </div>

        {documents.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {documents.map((d) => (
              <DocumentChip
                key={d.id}
                filename={d.filename}
                status={d.status}
                pageCount={d.page_count}
                onRemove={() => onRemoveDocument(d.id)}
              />
            ))}
            {isIndexing && (
              <span className="label text-faint">answers may be incomplete until indexing ends</span>
            )}
          </div>
        )}
      </header>

      <div className="scroll-quiet flex-1 overflow-y-auto overscroll-contain py-10">
        {documents.length === 0 && (
          <div className="pl-5">
            <p className="max-w-[40ch] font-serif text-[1.375rem] leading-snug text-ink">
              Add a PDF to begin this conversation.
            </p>
            <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-muted">
              Everything you ask will be answered from inside the document, with the page it
              came from.
            </p>
            <div className="mt-8">
              <Dropzone
                onFile={onAddDocument}
                subtext={isUploading ? "Uploading…" : "or click to choose a file"}
                disabled={isUploading}
              />
            </div>
          </div>
        )}

        {documents.length > 0 && messages.length === 0 && (
          <div className="pl-5">
            <p className="max-w-[40ch] font-serif text-[1.375rem] leading-snug text-ink">
              Ask anything about {documents.length > 1 ? "these documents" : "this document"}.
            </p>
            <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-muted">
              Answers are drawn only from what's inside, and each one cites the page it came
              from. Attach more PDFs whenever you like to widen what it can draw on.
            </p>

            {hasReadyDocument && (
              <div className="mt-9">
                <p className="label text-faint">Try asking</p>
                <ul className="mt-3 space-y-2.5">
                  {SUGGESTIONS.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => onSend(q)}
                        className="text-left font-serif text-[1.0625rem] text-clay underline decoration-rule-strong decoration-1 underline-offset-4 transition-colors hover:decoration-clay"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? (i === 0 ? "" : "mt-12") : "mt-5"}>
            <Message role={m.role} content={m.content} sources={m.sources} />
          </div>
        ))}

        {isAsking && (
          <div className="mt-5 flex items-center gap-2 pl-5">
            <span className="label text-faint">Reading</span>
            <span className="flex items-center gap-1">
              <span className="thinking-dot size-1 rounded-full bg-faint" />
              <span className="thinking-dot size-1 rounded-full bg-faint" />
              <span className="thinking-dot size-1 rounded-full bg-faint" />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 pb-6 pt-2">
        <div
          className={clsx(
            "rounded-[4px] border bg-raised transition-colors",
            hasReadyDocument
              ? "border-rule-strong focus-within:border-clay"
              : "border-rule"
          )}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={!hasReadyDocument}
            placeholder={
              hasReadyDocument
                ? "Ask a question about these documents…"
                : isIndexing
                  ? "Indexing — one moment…"
                  : "Add a PDF to start asking"
            }
            rows={1}
            className="block max-h-44 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 font-serif text-[1.0625rem] leading-relaxed text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed [field-sizing:content]"
          />
          <div className="flex items-center justify-between gap-4 px-4 pt-1 pb-3">
            <p className="truncate text-[0.6875rem] text-faint">
              {hasReadyDocument
                ? "Enter to send · Shift + Enter for a new line"
                : isIndexing
                  ? "This usually takes a few seconds"
                  : "Answers come only from the documents you attach"}
            </p>
            <button
              type="submit"
              disabled={!canSend}
              className={clsx(
                "label shrink-0 rounded-[3px] border px-3 py-1.5 transition-colors",
                canSend
                  ? "border-clay text-clay hover:bg-clay hover:text-paper"
                  : "cursor-not-allowed border-rule text-faint"
              )}
            >
              Ask
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
