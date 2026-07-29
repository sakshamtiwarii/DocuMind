import SourceCitation from "./SourceCitation";

/**
 * A turn reads like an interview transcript rather than a pair of chat bubbles:
 * the question is set larger with a clay rule in the margin, the answer is plain
 * prose beneath it. No avatars, no speech balloons.
 */
export default function Message({ role, content, sources }) {
  if (role === "user") {
    return (
      <div className="border-l-2 border-clay pl-5">
        <p className="max-w-[58ch] font-serif text-[1.1875rem] leading-[1.5] font-medium text-ink">
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className="pl-5">
      <div className="max-w-[64ch] font-serif text-[1.0625rem] leading-[1.75] whitespace-pre-wrap text-ink">
        {content}
      </div>
      <SourceCitation sources={sources} />
    </div>
  );
}
