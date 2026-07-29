import { Bot, User } from "lucide-react";
import clsx from "clsx";
import SourceCitation from "./SourceCitation";

export default function MessageBubble({ role, content, sources }) {
  const isUser = role === "user";

  return (
    <div className={clsx("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "rounded-tr-sm bg-indigo-600 text-white"
            : "rounded-tl-sm border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {!isUser && <SourceCitation sources={sources} />}
      </div>
    </div>
  );
}
