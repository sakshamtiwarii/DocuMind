import { FileWarning } from "lucide-react";
import Spinner from "./Spinner";

export default function ProcessingScreen({ document, onRetry }) {
  const failed = document?.status === "failed";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-12 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {failed ? (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300">
              <FileWarning className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
              Couldn't process this document
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This usually means the PDF has no extractable text (e.g. a scanned image).
              Try a different file.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
            >
              Upload another PDF
            </button>
          </>
        ) : (
          <>
            <Spinner className="h-8 w-8 text-indigo-600" />
            <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">
              Reading your document…
            </h2>
            <p className="mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              {document?.filename ? (
                <>
                  Extracting text and building the index for{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {document.filename}
                  </span>
                  .
                </>
              ) : (
                "Extracting text and building the search index."
              )}{" "}
              This usually takes a few seconds.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
