import clsx from "clsx";

/** Typographic mark — the name set in the serif, with a clay full stop. No logo badge. */
export default function Wordmark({ className }) {
  return (
    <span className={clsx("font-serif font-semibold tracking-[-0.015em] text-ink", className)}>
      DocuMind<span className="text-clay">.</span>
    </span>
  );
}
