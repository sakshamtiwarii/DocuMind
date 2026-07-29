import { useState } from "react";
import clsx from "clsx";
import { IconChevron } from "./icons";

/** Citations as footnotes: a short rule, a quiet toggle, then numbered references. */
export default function SourceCitation({ sources }) {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  // Only name the file when the citations actually span more than one document —
  // otherwise it's noise on a single-PDF conversation.
  const distinctFilenames = new Set(sources.map((s) => s.filename).filter(Boolean));
  const showFilename = distinctFilenames.size > 1;

  return (
    <div className="mt-5 max-w-[64ch]">
      <div className="mb-3 h-px w-10 bg-rule-strong" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="label flex items-center gap-1.5 text-muted transition-colors hover:text-clay"
      >
        {sources.length} source{sources.length > 1 ? "s" : ""}
        <IconChevron size={13} className={clsx("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ol className="mt-4 flex flex-col gap-4">
          {sources.map((source, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-px w-4 shrink-0 font-serif text-xs text-clay">{i + 1}</span>
              <div className="min-w-0">
                <p className="label text-faint">
                  {showFilename && source.filename ? `${source.filename} · ` : ""}
                  page {source.page_number}
                </p>
                <p className="mt-1.5 line-clamp-4 border-l border-rule pl-3 font-serif text-[0.9375rem] italic leading-relaxed text-muted">
                  {source.chunk_text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
