import { monthFormatter } from "@/lib/formatting";

export interface HoverAnchor {
  x: number;
  y: number;
  axisX: number;
  axisY: number;
}

const HOVER_CARD_MIN_LEFT_PX = 54;
const HOVER_CARD_RIGHT_INSET_PX = 48;

export function ChartCrosshair({
  anchor,
  showMarker = false,
}: {
  anchor: HoverAnchor;
  showMarker?: boolean;
}) {
  return (
    <>
      {showMarker && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100 bg-sky-300 shadow-[0_0_10px_3px_rgba(56,189,248,0.75)]"
          style={{ left: anchor.x, top: anchor.y }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/35"
        style={{ left: anchor.x, top: anchor.axisY }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/35"
        style={{ left: anchor.axisX, top: anchor.y }}
      />
    </>
  );
}

export function ChartHoverLabels({
  anchor,
  date,
  valueLabel,
  showTimeHoverCard,
  chartWidth,
  cardDistance,
}: {
  anchor: HoverAnchor;
  date: Date;
  valueLabel: string;
  showTimeHoverCard: boolean;
  chartWidth: number;
  cardDistance: number;
}) {
  const cardLeft = Math.min(
    chartWidth - HOVER_CARD_RIGHT_INSET_PX,
    Math.max(HOVER_CARD_MIN_LEFT_PX, anchor.x),
  );
  return (
    <>
      {showTimeHoverCard && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-sky-200/20 bg-[#08243d]/80 px-2 py-1 text-xs font-semibold text-white shadow-lg"
          style={{ left: cardLeft, top: "88%" }}
        >
          {monthFormatter.format(date)} {date.getUTCDate()}
        </div>
      )}
      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-sky-200/20 bg-[#08243d]/80 px-2 py-1 text-xs font-semibold text-white shadow-lg"
        style={{ left: cardLeft, top: Math.max(18, anchor.y - cardDistance) }}
      >
        {valueLabel}
      </div>
    </>
  );
}
