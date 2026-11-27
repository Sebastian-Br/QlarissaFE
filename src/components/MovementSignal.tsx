import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

export interface MovementSignalData {
  symbol: string;
  change: number;
}

export default function MovementSignal({
  mover,
  compact = false,
}: {
  mover: MovementSignalData;
  compact?: boolean;
}) {
  const positive = mover.change > 0;
  const magnitude = Math.abs(mover.change);
  const isHighMovement = magnitude >= 7;
  const angle = Math.min((magnitude / 7) * 90, 90);
  const FlyingArrow = positive ? ArrowUp : ArrowDown;
  const StaticArrow = compact || isHighMovement ? FlyingArrow : ArrowRight;
  const flyingArrowCount = Math.min(2 + Math.floor(Math.max(0, magnitude - 7) / 4), 4);
  const flyingArrowDuration = Math.max(0.9, 2.1 - Math.max(0, magnitude - 7) * 0.08);

  return (
    <span className={`flex items-center justify-center gap-0.5 font-semibold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
      <span className={`relative grid place-items-center ${compact ? "h-9 w-9" : "h-5 w-5"}`}>
        <StaticArrow
          size={compact ? 24 : 15}
          strokeWidth={compact ? 2.5 : 2}
          style={!compact && !isHighMovement ? { transform: `rotate(${positive ? -angle : angle}deg)` } : undefined}
        />
        {(compact || isHighMovement) &&
          Array.from({ length: flyingArrowCount }, (_, index) => (
            <FlyingArrow
              key={index}
              size={compact ? 19 : 14}
              strokeWidth={2.5}
              className={`pointer-events-none absolute ${positive ? "movement-arrow-fly-up" : "movement-arrow-fly-down"}`}
              style={{
                left: `${(index - (flyingArrowCount - 1) / 2) * (compact ? 6 : 5)}px`,
                animationDelay: `${index * (flyingArrowDuration / flyingArrowCount)}s`,
                animationDuration: `${flyingArrowDuration}s`,
              }}
            />
          ))}
      </span>
      {!compact && `${magnitude.toFixed(2)}%`}
    </span>
  );
}
