import { formatDomPercent, formatPercent } from "@/lib/format";

interface SectorEntry {
  name: string;
  marketcap_dom: number;
  change_pct_24h: number;
}

interface SectorTableProps {
  sectors: SectorEntry[];
}

const PRIORITY_ORDER = ["BTC", "ETH", "StableCoin", "Layer1", "CeFi", "PayFi", "DeFi", "Meme", "Layer2", "AI", "RWA", "GameFi"];

export function SectorTable({ sectors }: SectorTableProps) {
  const sorted = [...sectors].sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.name);
    const bi = PRIORITY_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return b.marketcap_dom - a.marketcap_dom;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 pb-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold" style={{ color: "var(--foreground-dim)" }}>Sector</span>
        <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold text-right" style={{ color: "var(--foreground-dim)" }}>Dom</span>
        <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-bold text-right" style={{ color: "var(--foreground-dim)" }}>24h</span>
      </div>
      {sorted.map((sector) => {
        const up = sector.change_pct_24h > 0;
        const dn = sector.change_pct_24h < 0;
        const changeColor = up ? "var(--bull)" : dn ? "var(--bear)" : "var(--neutral-fg)";
        return (
          <div
            key={sector.name}
            className="grid grid-cols-3 gap-4 py-2.5 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span className="text-[11px] font-mono" style={{ color: "var(--foreground-muted)" }}>{sector.name}</span>
            <span className="text-[11px] font-mono text-right tabular-nums" style={{ color: "var(--foreground-dim)" }}>
              {formatDomPercent(sector.marketcap_dom)}
            </span>
            <span className="text-[11px] font-mono text-right tabular-nums font-medium" style={{ color: changeColor }}>
              {formatPercent(sector.change_pct_24h)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
