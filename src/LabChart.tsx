import { useEffect, useRef, useState } from 'react'

// 検査値・バイタルの推移の小さな折れ線（ライブラリは使わない）。
// 横軸は日付（間隔は実際の日数どおり）、薄い緑の帯が基準値の範囲。基準より高い点は赤、低い点は青
export type ChartPoint = { date: string; value: number }
export type ChartSeries = { label: string; color: string; points: ChartPoint[] }

const PAD = { l: 36, r: 30, t: 18, b: 22 }
const INSET = 14 // 点を軸から離す（値の字が目盛りと重ならないように）
const HIGH = '#c62828'
const LOW = '#1565c0'

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
const t = (d: string) => new Date(`${d}T00:00:00`).getTime()

// 目盛りをきりのよい間隔に（1・2・5 × 10^n）
const niceStep = (span: number, n: number) => {
  const raw = span / n
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw
}
const fmt = (v: number) => String(Math.round(v * 100) / 100)

export function LabChart({
  series,
  band,
  refs = [],
  unit,
  height = 150,
}: {
  series: ChartSeries[]
  band?: { low?: number; high?: number }
  refs?: { value: number; label: string }[] // 目標値などの点線
  unit?: string
  height?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(480)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setW(Math.max(240, el.clientWidth))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pts = series.flatMap((s) => s.points)
  if (pts.length === 0) return <div ref={box} className="flex items-center justify-center text-xs text-mist" style={{ height }}>記録がありません</div>

  // 縦軸の範囲：値と基準値・目標値が入るように少し広げる
  const vals = [...pts.map((p) => p.value), ...refs.map((r) => r.value)]
  if (band?.low !== undefined) vals.push(band.low)
  if (band?.high !== undefined) vals.push(band.high)
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.1 || 1
    hi += Math.abs(hi) * 0.1 || 1
  }
  const step = niceStep(hi - lo, 3)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  if (pts.every((p) => p.value >= 0) && lo < 0) lo = 0

  const dates = [...new Set(pts.map((p) => p.date))].sort()
  const t0 = t(dates[0])
  const t1 = t(dates[dates.length - 1])
  // 目標値の線があるときは右の余白を広げ、そこに名前を書く
  const padR = refs.length ? 52 : PAD.r
  const iw = w - PAD.l - padR
  const ih = height - PAD.t - PAD.b
  const x = (d: string) => PAD.l + INSET + (t1 === t0 ? (iw - INSET * 2) / 2 : ((t(d) - t0) / (t1 - t0)) * (iw - INSET * 2))
  const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v)
  // 日付の目盛りは多すぎたら間引く（最初と最後は必ず出す）
  const every = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor(iw / 48))))
  const showDate = (i: number) => i === 0 || i === dates.length - 1 || i % every === 0
  const out = (v: number) => (band?.high !== undefined && v > band.high ? HIGH : band?.low !== undefined && v < band.low ? LOW : undefined)
  const bandTop = band ? y(band.high ?? hi) : 0
  const bandBottom = band ? y(band.low ?? lo) : 0

  return (
    <div ref={box} className="w-full">
      <svg width={w} height={height} role="img" aria-label={`${series.map((s) => s.label).join('・')}の推移`} className="block font-num">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={y(v)} y2={y(v)} stroke="#efe9df" />
            <text x={PAD.l - 5} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="#6e665e">
              {fmt(v)}
            </text>
          </g>
        ))}
        {band && (band.low !== undefined || band.high !== undefined) && (
          <g>
            <rect x={PAD.l} width={iw} y={bandTop} height={Math.max(0, bandBottom - bandTop)} fill="#2e7d4f" opacity={0.09} />
            <text x={PAD.l + iw + 4} y={(bandTop + bandBottom) / 2 + 3} fontSize={9} fill="#2e7d4f">
              基準
            </text>
          </g>
        )}
        {refs.map((r) => (
          <g key={r.label}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={y(r.value)} y2={y(r.value)} stroke="#9c8255" strokeDasharray="4 3" />
            <text x={PAD.l + iw + 4} y={y(r.value) + 3} fontSize={9} fill="#9c8255">
              {r.label}
            </text>
          </g>
        ))}
        {dates.map((d, i) =>
          showDate(i) ? (
            <text key={d} x={x(d)} y={height - 6} textAnchor="middle" fontSize={10} fill="#6e665e">
              {md(d)}
            </text>
          ) : null,
        )}
        {unit && (
          <text x={PAD.l} y={10} fontSize={9} fill="#6e665e">
            {unit}
          </text>
        )}
        {series.map((s) => {
          const ps = [...s.points].sort((a, b) => a.date.localeCompare(b.date))
          return (
            <g key={s.label}>
              {ps.length > 1 && <polyline points={ps.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" />}
              {ps.map((p, i) => {
                const c = out(p.value) ?? s.color
                const last = i === ps.length - 1
                return (
                  <g key={p.date}>
                    <circle cx={x(p.date)} cy={y(p.value)} r={last ? 4 : 3} fill={last ? c : '#fff'} stroke={c} strokeWidth={1.8} />
                    <text x={x(p.date)} y={y(p.value) - 7} textAnchor="middle" fontSize={10} fontWeight={last ? 600 : 400} fill={out(p.value) ?? '#2b2724'}>
                      {fmt(p.value)}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-0.5 flex gap-3 pl-9 text-[11px] text-mist">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
