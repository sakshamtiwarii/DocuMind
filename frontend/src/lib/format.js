/** Keeps the start and the extension legible instead of lopping off ".pdf". */
export function shortenFilename(name, max = 26) {
  if (!name || name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot < 1) return `${name.slice(0, max - 1)}…`;
  const ext = name.slice(dot);
  return `${name.slice(0, Math.max(1, max - ext.length - 1))}…${ext}`;
}
