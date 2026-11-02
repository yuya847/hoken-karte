import { CLINIC, age, today, ymd } from '../data'
import { birthLabel } from '../PatientIcon'
import type { DocFields, Patient } from '../types'

// 文書の入力欄と印刷面で共通に使う部品。見た目をそろえるため、様式のファイルはなるべくこれを使う

export const str = (f: DocFields, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : '')
export const bool = (f: DocFields, k: string) => f[k] === true
export const list = (f: DocFields, k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : [])

// 入力欄の見出しのまとまり
export function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-baseline gap-2 border-b border-line pb-1 text-[13px] font-semibold">
        {title}
        {note && <span className="text-[11px] font-normal text-mist">{note}</span>}
      </h3>
      {children}
    </section>
  )
}

// 1行・複数行の入力。from を渡すと「カルテから」の印（自動で埋めた値）を出す
export function Text({ label, value, onChange, rows, placeholder, from, unit, className = '' }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; from?: boolean; unit?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center gap-1.5 text-xs text-mist">
        {label}
        {from && <span className="rounded bg-[#e3ecfb] px-1 text-[10px] text-clinical">カルテから</span>}
      </span>
      <span className="flex items-center gap-1.5">
        {rows ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="field w-full resize-y px-3 py-2 text-[13px] leading-relaxed" />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field h-8 w-full px-2.5 text-[13px]" />
        )}
        {unit && <span className="shrink-0 text-xs text-mist">{unit}</span>}
      </span>
    </label>
  )
}

// どれか1つを選ぶ（丸いチップを横に並べる）
export function Choice({ label, value, options, onChange }: { label?: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <span className="mb-1 block text-xs text-mist">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)} className={`chip h-7 text-xs ${value === o ? 'chip-on' : ''}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

// 複数選ぶ
export function Checks({ label, value, options, onChange }: { label?: string; value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      {label && <span className="mb-1 block text-xs text-mist">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className={`chip h-7 text-xs ${on ? 'chip-on' : ''}`}>
              {on ? '✓ ' : ''}
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- 印刷面（紙）用。黒の細い罫線の表 ----

// 紙の表の1行：左に見出し、右に中身
export function Row({ th, children, h, thW = '28mm' }: { th: React.ReactNode; children?: React.ReactNode; h?: string; thW?: string }) {
  return (
    <div className="flex border-b border-black last:border-b-0" style={h ? { minHeight: h } : undefined}>
      <div className="flex shrink-0 items-center border-r border-black bg-[#f2f2f2] px-[2mm] py-[1mm] text-[9pt]" style={{ width: thW }}>
        {th}
      </div>
      <div className="min-w-0 flex-1 px-[2mm] py-[1mm] whitespace-pre-wrap">{children}</div>
    </div>
  )
}

export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`border border-black ${className}`}>{children}</div>
}

// □ / ■ のチェック（紙用）
export const box = (on: boolean) => (on ? '■' : '□')
export function Boxes({ options, value }: { options: string[]; value: string | string[] }) {
  const on = (o: string) => (Array.isArray(value) ? value.includes(o) : value === o)
  return (
    <span className="inline-flex flex-wrap gap-x-[3mm]">
      {options.map((o) => (
        <span key={o}>
          {box(on(o))}
          {o}
        </span>
      ))}
    </span>
  )
}

// 和暦の日付。平成・昭和の発病日もあるので元号を見分ける（2019-05-10 → 令和元年5月10日）
export const wareki = (d: string) => {
  if (!d) return '令和　　年　　月　　日'
  const [y, m, day] = d.split('-').map(Number)
  const [era, base] = d >= '2019-05-01' ? ['令和', 2018] : d >= '1989-01-08' ? ['平成', 1988] : ['昭和', 1925]
  const n = y - base
  return `${era}${n === 1 ? '元' : n}年${m}月${day}日`
}

export const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00`)
  t.setDate(t.getDate() + n)
  return ymd(t)
}

// 両端を含む日数（11/1〜11/7 → 7）
export const daysBetween = (from: string, to: string) =>
  from && to ? Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1 : 0

export const firstVisit = (p: Patient) => p.encounters.map((e) => e.date).sort()[0] ?? today()

// 日付の入力（カレンダーから選べる）
export function DateField({ label, value, onChange, from }: { label: string; value: string; onChange: (v: string) => void; from?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs text-mist">
        {label}
        {from && <span className="rounded bg-[#e3ecfb] px-1 text-[10px] text-clinical">カルテから</span>}
      </span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="field h-8 w-full px-2.5 text-[13px]" />
    </label>
  )
}

// 文章のひな形の札。押すと本文の末尾に1文足す
export function Templates({ items, onInsert }: { items: { label: string; text: string }[]; onInsert: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <button key={t.label} type="button" onClick={() => onInsert(t.text)} title={t.text} className="chip h-7 text-xs">
          ＋ {t.label}
        </button>
      ))}
    </div>
  )
}

export const appendLine = (cur: string, line: string) => (cur.trim() ? `${cur.replace(/\s+$/, '')}\n${line}` : line)

// 紙の患者欄（氏名・生年月日・性別・年齢・住所）
export function PatientLine({ patient }: { patient: Patient }) {
  return (
    <Table>
      <Row th="氏名">
        <span className="text-[12pt]">{patient.name}</span>
        <span className="ml-[3mm] text-[8pt]">（{patient.kana}）</span>
        <span className="ml-[4mm]">{patient.sex}</span>
      </Row>
      <Row th="生年月日">
        {birthLabel(patient.birth)}（{age(patient.birth)}歳）
      </Row>
      <Row th="住所">
        {patient.zip && `〒${patient.zip} `}
        {patient.address ?? ''}
        {patient.phone && <span className="ml-[4mm]">電話 {patient.phone}</span>}
      </Row>
    </Table>
  )
}

// 紙の差出人（医療機関・医師）。右寄せ
export function ClinicSign({ date }: { date?: string }) {
  return (
    <div className="ml-auto w-[95mm] space-y-[0.5mm] text-[9.5pt]">
      {date !== undefined && <div>{wareki(date)}</div>}
      <div>〒{CLINIC.zip}</div>
      <div>{CLINIC.address}</div>
      <div className="text-[11pt]">{CLINIC.name}</div>
      <div>
        電話 {CLINIC.phone}　FAX {CLINIC.fax}
      </div>
      <div className="flex items-end justify-between pt-[2mm]">
        <span>
          医師　<span className="text-[12pt]">{CLINIC.doctor}</span>
        </span>
        <span className="inline-flex h-[9mm] w-[9mm] items-center justify-center rounded-full border border-[#c33] text-[7pt] text-[#c33]">印</span>
      </div>
    </div>
  )
}
