import clsx from "clsx";
import { shortenFilename } from "../lib/format";
import { IconClose } from "./icons";

const STATUS = {
  processing: { tone: "bg-ochre", label: "indexing" },
  ready: { tone: "bg-moss", label: null },
  failed: { tone: "bg-oxblood", label: "unreadable" },
};

/** A filename with a small pigment dot for state — no pill, no border, no badge. */
export default function DocumentChip({ filename, status, pageCount, onRemove }) {
  const { tone, label } = STATUS[status] ?? STATUS.processing;

  return (
    <span
      title={
        status === "ready" && pageCount != null ? `${filename} — ${pageCount} pages` : filename
      }
      className="group/chip flex min-w-0 shrink-0 items-center gap-2 text-[0.8125rem]"
    >
      <span className={clsx("size-1.5 shrink-0 rounded-full", tone)} />
      <span
        className={clsx(
          status === "failed" ? "text-oxblood line-through decoration-1" : "text-muted"
        )}
      >
        {shortenFilename(filename, 32)}
      </span>
      {label && <span className="label shrink-0 text-faint">{label}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={`Remove ${filename} from this conversation`}
          aria-label={`Remove ${filename} from this conversation`}
          className={clsx(
            "shrink-0 text-faint transition-all hover:text-oxblood focus-visible:opacity-100",
            // A failed document is always removable at a glance — there's nothing else to do
            // with it — while healthy ones stay quiet until hovered.
            status === "failed" ? "opacity-100" : "opacity-0 group-hover/chip:opacity-100"
          )}
        >
          <IconClose size={13} />
        </button>
      )}
    </span>
  );
}
