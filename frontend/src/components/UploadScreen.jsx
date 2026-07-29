import { useRef, useState } from "react";
import { FileText, Sparkles, UploadCloud } from "lucide-react";
import clsx from "clsx";

export default function UploadScreen({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(files) {
    const file = files?.[0];
    if (file) onUpload(file);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          DocuMind
        </h1>
        <p className="mt-3 max-w-md text-balance text-slate-500 dark:text-slate-400">
          Upload a PDF and ask questions about it in plain English. Answers are grounded in
          the document, with page-level citations.
        </p>
      </div>

      <label
        htmlFor="file-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={clsx(
          "group flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-8 py-14 text-center transition-colors",
          isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
            : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20"
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition-transform group-hover:scale-105 dark:bg-indigo-900/40 dark:text-indigo-300">
          <UploadCloud className="h-7 w-7" />
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            Drop your PDF here, or click to browse
          </p>
          <p className="mt-1 text-sm text-slate-400">PDF files only</p>
        </div>
        <input
          id="file-upload"
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
        <FileText className="h-3.5 w-3.5" />
        <span>Your document stays scoped to its own session — no cross-document answers.</span>
      </div>
    </div>
  );
}
