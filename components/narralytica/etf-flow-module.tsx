import { formatCurrencyCompact } from "@/lib/format";

interface EtfEntry {
  ticker: string;
  institute: string;
  dailyNetInflow: { value: string };
  netAssets: { value: string };
}

interface EtfData {
  list: EtfEntry[];
  dailyNetInflow: { value: string };
  totalNetAssets: { value: string };
  dailyTotalValueTraded: { value: string };
  totalNetAssetsPercentage: { value: string };
}

interface EtfFlowModuleProps {
  asset: "BTC" | "ETH";
  data: EtfData;
}

export function EtfFlowModule({ asset, data }: EtfFlowModuleProps) {
  const dailyInflow  = parseFloat(data.dailyNetInflow.value);
  const totalAssets  = parseFloat(data.totalNetAssets.value);
  const traded       = parseFloat(data.dailyTotalValueTraded.value);
  const domPct       = (parseFloat(data.totalNetAssetsPercentage.value) * 100).toFixed(2);

  const sorted = [...data.list].sort(
    (a, b) => parseFloat(b.dailyNetInflow.value) - parseFloat(a.dailyNetInflow.value)
  );
  const topEtf   = sorted[0];
  const inflowCss = dailyInflow >= 0 ? "var(--bull)" : "var(--bear)";

  return (
    <div className="flex flex-col gap-4">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold"
        style={{ color: "var(--foreground-dim)" }}
      >
        {asset} ETF · Institutional Flow
      </p>

      <div>
        <p
          className="text-[11px] font-mono uppercase tracking-[0.14em] mb-2 font-bold"
          style={{ color: "var(--foreground-dim)" }}
        >
          Daily Net Inflow
        </p>
        <p
          className="text-[36px] font-mono leading-none tabular-nums"
          style={{ color: inflowCss }}
        >
          {formatCurrencyCompact(dailyInflow)}
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-3 pt-3 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.14em] mb-1 font-bold"
            style={{ color: "var(--foreground-dim)" }}
          >
            Net Assets
          </p>
          <p className="text-[13px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground)" }}>
            {formatCurrencyCompact(totalAssets)}
          </p>
          <p className="text-[11px] font-mono mt-0.5 tabular-nums" style={{ color: "var(--foreground-dim)" }}>
            {domPct}% supply
          </p>
        </div>
        <div>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.14em] mb-1 font-bold"
            style={{ color: "var(--foreground-dim)" }}
          >
            Daily Volume
          </p>
          <p className="text-[13px] font-mono tabular-nums font-semibold" style={{ color: "var(--foreground)" }}>
            {formatCurrencyCompact(traded)}
          </p>
        </div>
      </div>

      {topEtf && parseFloat(topEtf.dailyNetInflow.value) > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.14em] mb-1.5 font-bold"
            style={{ color: "var(--foreground-dim)" }}
          >
            Top Contributor
          </p>
          <p className="text-[12px] font-mono" style={{ color: "var(--foreground-muted)" }}>
            {topEtf.ticker}
            <span className="mx-1.5" style={{ color: "var(--foreground-faint)" }}>
              ·
            </span>
            <span style={{ color: "var(--bull)" }}>
              {formatCurrencyCompact(parseFloat(topEtf.dailyNetInflow.value))}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
