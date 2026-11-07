import { formatDate, numberFormatter } from "@/lib/formatting";
import type { Split } from "@/models/Security";
import { DetailCard } from "./DetailCard";

export function DetailList({
  title,
  items,
  valueClassName,
}: {
  title: string;
  items: { id: number; label: string; value: string }[] | undefined;
  valueClassName: string;
}) {
  if (!items?.length) return null;
  return (
    <DetailCard title={title}>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-slate-400">{item.label}</span>
            <span className={`font-medium ${valueClassName}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </DetailCard>
  );
}

export function SplitsCard({ splits }: { splits: Split[] | undefined }) {
  return (
    <DetailList
      title="Splits"
      items={splits?.map((split) => ({
        id: split.id,
        label: formatDate(split.date),
        value: `${numberFormatter.format(split.splitRatio)}:1`,
      }))}
      valueClassName="text-slate-100"
    />
  );
}
