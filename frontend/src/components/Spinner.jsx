import clsx from "clsx";

/** A hairline arc, drawn at the same stroke weight as the glyph set. */
export default function Spinner({ className }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      aria-hidden="true"
      className={clsx("animate-spin", className)}
    >
      <circle cx="10" cy="10" r="7" opacity="0.25" />
      <path d="M17 10a7 7 0 0 0-7-7" />
    </svg>
  );
}
