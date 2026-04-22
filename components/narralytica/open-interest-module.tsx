import { formatCurrencyCompact, formatPrice } from "@/lib/format";

interface OiEntry {
  all: number;
  cme: number;
  binance: number;
  btc_price: number;
  timestamp: string;
}

interface OpenInterestData {
  latest: OiEntry & {
    okex: number;
    bybit: number;
    bitget: number;
    deribit: number;
  };
  series: OiEntry[];
}

interface OpenInterestModuleProps {
  data: OpenInterestData;
}

export function OpenInterestModule({ data }: OpenInterestModuleProps) {
  const latest = data.latest;
  const prev = data.series[1];

  const oiDelta = latest.all - prev.all;
  const oiDeltaColor = oiDelta >= 0 ? "var(--bull)" : "var(--bear)";
  const oiDeltaSign = oiDelta >= 0 ? "+" : "";

  // Sparkline
  const sparkValues = [...data.series].reverse().map((s) => s.all);
  const sparkMin = Math.min(...sparkValues);
  const sparkMax = Math.max(...sparkValues);
  const sparkRange = sparkMax - sparkMin || 1;
  const sparkH = 28;
  const sparkW = 80;
  const points = sparkValues.map((v, i) => {
    const x = (i / (sparkValues.length - 1)) * sparkW;
    const y = sparkH - ((v - sparkMin) / sparkRange) * sparkH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="flex flex-col gap-4">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em] font-bold"
        style={{ color: "var(--foreground-dim)" }}
      >
        Futures · Open Interest
      </p>

      <div className="flex items-end gap-4">
        <div>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.14em] mb-2 font-bold"
            style={{ color: "var(--foreground-dim)" }}
          >
            Total OI
          </p>
          <p
            className="text-[36px] font-mono leading-none tabular-nums"
            style={{ color: "var(--foreground)" }}
          >
            {formatCurrencyCompact(latest.all)}
          </p>
          <p
            className="text-[10px] font-mono mt-1.5 tabular-nums"
            style={{ color: oiDeltaColor }}
          >
            {oiDeltaSign}
            {formatCurrencyCompact(oiDelta)} vs prev
          </p>
        </div>
        <div className="ml-auto mb-1">
          <svg
            width={sparkW}
            height={sparkH}
            viewBox={`0 0 ${sparkW} ${sparkH}`}
            className="overflow-visible"
          >
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="var(--foreground-dim)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-3 pt-3 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {[
          { label: "CME", val: latest.cme },
          { label: "Binance", val: latest.binance },
          { label: "Deribit", val: latest.deribit },
          { label: "BTC Ref", val: latest.btc_price, isPrice: true },
        ].map(({ label, val, isPrice }) => (
          <div key={label}>
            <p
              className="text-[11px] font-mono uppercase tracking-[0.14em] mb-1 font-bold"
              style={{ color: "var(--foreground-dim)" }}
            >
              {label}
            </p>
            <p
              className="text-[12px] font-mono tabular-nums"
              style={{ color: "var(--foreground)" }}
            >
              {isPrice ? formatPrice(val) : formatCurrencyCompact(val)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
