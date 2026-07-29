import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import DocumentChip from "./DocumentChip";
import Dropzone from "./Dropzone";
import Message from "./Message";
import Spinner from "./Spinner";
import { IconPanel, IconPlus } from "./icons";

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
  onOpenSidebar,
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasReadyDocument = documents.some((d) => d.status === "ready");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isAsking || !hasReadyDocument) return;
    onSend(input);
    setInput("");
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

          <h1 className="min-w-0 flex-1 truncate font-serif text-[1.0625rem] font-medium text-ink">
            {title}
          </h1>

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
            className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-clay disabled:opacity-50"
          >
            {isUploading ? <Spinner className="size-3.5" /> : <IconPlus size={14} />}
            Add PDF
          </button>
        </div>

        {documents.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {documents.map((d) => (
              <DocumentChip
                key={d.id}
                filename={d.filename}
                status={d.status}
                pageCount={d.page_count}
              />
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain py-10">
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

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-rule py-4">
        <div className="flex items-end gap-4">
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
                ? "Ask a question…"
                : "Add a PDF and let it finish indexing to start asking"
            }
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent font-serif text-[1.0625rem] leading-relaxed text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAsking || !hasReadyDocument}
            className={clsx(
              "label shrink-0 pb-1 transition-colors",
              !input.trim() || isAsking || !hasReadyDocument
                ? "cursor-not-allowed text-faint"
                : "text-clay hover:text-ink"
            )}
          >
            Ask
          </button>
        </div>
        {hasReadyDocument && (
          <p className="mt-2 text-[0.6875rem] text-faint">
            Enter to send · Shift + Enter for a new line
          </p>
        )}
      </form>
    </div>
  );
}
