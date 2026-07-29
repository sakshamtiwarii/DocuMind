/**
 * A small hand-drawn glyph set, drawn to match the type rather than pulled from
 * an icon library. All strokes are hairline (1.25) and inherit currentColor, so
 * they sit at the same visual weight as the text beside them.
 */

function Glyph({ children, size = 16, className }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <Glyph {...props}>
      <path d="M10 4.5v11M4.5 10h11" />
    </Glyph>
  );
}

export function IconClose(props) {
  return (
    <Glyph {...props}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </Glyph>
  );
}

export function IconChevron(props) {
  return (
    <Glyph {...props}>
      <path d="M5.5 8l4.5 4.5L14.5 8" />
    </Glyph>
  );
}

export function IconTrash(props) {
  return (
    <Glyph {...props}>
      <path d="M4.5 6.5h11M8 6.5V5h4v1.5M6 6.5l.6 9h6.8l.6-9" />
    </Glyph>
  );
}

/** A panel glyph rather than a hamburger — it says "show the list", not "menu". */
export function IconPanel(props) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M8 4v12" />
    </Glyph>
  );
}

/** A page with a turned corner — used for attached documents and citations. */
export function IconPage(props) {
  return (
    <Glyph {...props}>
      <path d="M5 3.5h6l4 4v9H5z" />
      <path d="M11 3.5v4h4" />
    </Glyph>
  );
}

/** A nib, for renaming — drawn rather than a generic pencil. */
export function IconPen(props) {
  return (
    <Glyph {...props}>
      <path d="M13.2 3.9l2.9 2.9L7.4 15.5 4 16l.5-3.4z" />
      <path d="M11.5 5.6l2.9 2.9" />
    </Glyph>
  );
}

export function IconArrowUp(props) {
  return (
    <Glyph {...props}>
      <path d="M10 15.5V5M5.5 9.5L10 5l4.5 4.5" />
    </Glyph>
  );
}
