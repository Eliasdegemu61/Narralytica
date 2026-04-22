import { formatPercent } from "@/lib/format";

interface SpotlightEntry {
  name: string;
  change_pct_24h: number;
}

interface SpotlightListProps {
  spotlight: SpotlightEntry[];
}

export function SpotlightList({ spotlight }: SpotlightListProps) {
  const sorted = [...spotlight].sort((a, b) => b.change_pct_24h - a.change_pct_24h);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 pb-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold" style={{ color: "var(--foreground-dim)" }}>Theme</span>
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] font-bold text-right" style={{ color: "var(--foreground-dim)" }}>24h</span>
      </div>
      {sorted.map((item) => {
        const up = item.change_pct_24h > 0;
        const dn = item.change_pct_24h < 0;
        const color = up ? "var(--bull)" : dn ? "var(--bear)" : "var(--neutral-fg)";
        const marker = up ? "↑" : dn ? "↓" : "—";
        return (
          <div
            key={item.name}
            className="grid grid-cols-2 gap-4 py-2.5 border-b transition-colors"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span className="text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>
              {item.name.trim()}
            </span>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] font-mono" style={{ color }}>{marker}</span>
              <span className="text-[11px] font-mono tabular-nums" style={{ color }}>
                {formatPercent(item.change_pct_24h)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
