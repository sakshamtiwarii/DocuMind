import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import clsx from "clsx";

export default function SourceCitation({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
      >
        <FileText className="h-3.5 w-3.5" />
        {sources.length} source{sources.length > 1 ? "s" : ""}
        <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {sources.map((source, i) => (
            <li
              key={i}
              className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
            >
              <span className="mb-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                Page {source.page_number}
              </span>
              <p className="line-clamp-3">{source.chunk_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
