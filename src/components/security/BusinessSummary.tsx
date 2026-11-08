import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const COLLAPSED_HEIGHT_PX = 72;
const COLLAPSED_MASK =
  "linear-gradient(to bottom, #000 0px, #000 24px, rgb(0 0 0 / 0.55) 48px, rgb(0 0 0 / 0.2) 72px)";

export function BusinessSummary({ summary }: { summary: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  return (
    <div className="mt-3 w-full max-w-4xl">
      <p
        id="business-summary"
        ref={summaryRef}
        style={{
          maxHeight: isExpanded
            ? `${summaryRef.current?.scrollHeight ?? COLLAPSED_HEIGHT_PX}px`
            : `${COLLAPSED_HEIGHT_PX}px`,
          maskImage: isExpanded ? "none" : COLLAPSED_MASK,
          WebkitMaskImage: isExpanded ? "none" : COLLAPSED_MASK,
        }}
        className="overflow-hidden text-sm leading-6 text-slate-300 transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none"
      >
        {summary}
      </p>
      <button
        type="button"
        aria-label={isExpanded ? "Collapse business summary" : "Expand business summary"}
        aria-controls="business-summary"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="mt-1 flex h-7 w-full items-center justify-center rounded-lg border border-sky-300/20 bg-slate-900/70 text-sky-300 transition-colors hover:bg-sky-400/15 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
      >
        <ChevronDown
          size={16}
          className={`transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}
