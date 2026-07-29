import { useState } from "react";
import clsx from "clsx";

export default function Dropzone({ onFile, heading, subtext, disabled }) {
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return (
    <label
      htmlFor="pdf-upload"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={clsx(
        "block w-full max-w-md rounded-[3px] border border-dashed px-8 py-12 text-center transition-colors",
        disabled && "cursor-not-allowed border-rule",
        !disabled && "cursor-pointer",
        !disabled && isDragging
          ? "border-clay bg-clay-tint"
          : !disabled && "border-rule-strong hover:border-clay hover:bg-raised"
      )}
    >
      <p className="font-serif text-[1.0625rem] text-ink">
        {heading ?? "Drop a PDF here"}
      </p>
      <p className="mt-1.5 text-[0.8125rem] text-faint">{subtext ?? "or click to choose a file"}</p>
      <input
        id="pdf-upload"
        type="file"
        accept="application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
