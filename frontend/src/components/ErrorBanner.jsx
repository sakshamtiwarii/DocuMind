import { IconClose } from "./icons";

/** A marginal note in oxblood, not a filled alert box. */
export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-4 border-l-2 border-oxblood bg-raised py-3 pl-4 pr-3">
      <div className="flex-1">
        <p className="label text-oxblood">Something went wrong</p>
        <p className="mt-1 font-serif text-[0.9375rem] leading-snug text-ink">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-0.5 text-faint transition-colors hover:text-ink"
          aria-label="Dismiss"
        >
          <IconClose size={15} />
        </button>
      )}
    </div>
  );
}
