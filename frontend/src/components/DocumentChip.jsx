import clsx from "clsx";

const STATUS = {
  processing: { tone: "bg-ochre", label: "indexing" },
  ready: { tone: "bg-moss", label: null },
  failed: { tone: "bg-oxblood", label: "unreadable" },
};

/** A filename with a small pigment dot for state — no pill, no border, no badge. */
export default function DocumentChip({ filename, status, pageCount }) {
  const { tone, label } = STATUS[status] ?? STATUS.processing;

  return (
    <span
      title={
        status === "ready" && pageCount != null ? `${filename} — ${pageCount} pages` : filename
      }
      className="flex min-w-0 shrink-0 items-baseline gap-2 text-[0.8125rem]"
    >
      <span className={clsx("mb-px size-1.5 shrink-0 self-center rounded-full", tone)} />
      <span
        className={clsx(
          "max-w-[13rem] truncate",
          status === "failed" ? "text-oxblood line-through decoration-1" : "text-muted"
        )}
      >
        {filename}
      </span>
      {label && <span className="label shrink-0 text-faint">{label}</span>}
    </span>
  );
}
