import { useEffect, useRef, useState } from "react";
import { Bot, FileText, Plus, Send } from "lucide-react";
import MessageBubble from "./MessageBubble";
import Spinner from "./Spinner";

export default function ChatScreen({ document, messages, isAsking, onSend, onNewDocument }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isAsking) return;
    onSend(input);
    setInput("");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {document?.filename}
            </p>
            {document?.page_count != null && (
              <p className="text-xs text-slate-400">{document.page_count} pages</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onNewDocument}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
          New document
        </button>
      </header>

      <div className="flex-1 space-y-5 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400">
            <Bot className="h-8 w-8" />
            <p className="max-w-xs text-sm">
              Ask anything about this document — answers are grounded in its content, with
              page citations.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} sources={m.sources} />
        ))}

        {isAsking && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Spinner className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 flex items-end gap-2 border-t border-slate-200 bg-slate-50/80 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80"
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
          placeholder="Ask a question about this document…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-950"
        />
        <button
          type="submit"
          disabled={!input.trim() || isAsking}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
