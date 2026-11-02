import { useEffect, useMemo, useRef, useState } from 'react'
import { BLOOD_GROUPS, today } from './data'
import { Icon } from './Icon'
import { LabChart, type ChartSeries } from './LabChart'
import { LAB_ITEMS, incomingLabs, labItem, rangeText, type IncomingLab } from './labData'
import { PatientIcon, ageSex, birthLabel } from './PatientIcon'
import type { Action } from './store'
import type { LabReport, LabValue, Patient } from './types'

// 主要な項目（「主要」の絞り込み・記載への引用・グラフの札）
const MAIN = ['HBA1C', 'GLU', 'LDL', 'HDL', 'TG', 'EGFR', 'CRE', 'UA', 'AST', 'ALT', 'GGT', 'Hb', 'K', 'UACR', 'UPRO', 'TSH', 'CRP']

// 記載に引用するときの短い名前
const SHORT: Record<string, string> = {
  HBA1C: 'HbA1c',
  GLU: '血糖',
  TC: 'TC',
  TG: 'TG',
  HDL: 'HDL',
  LDL: 'LDL',
  EGFR: 'eGFR',
  CRE: 'Cr',
  UA: 'UA',
  BUN: 'BUN',
  UPRO: '尿蛋白',
  UGLU: '尿糖',
  UOB: '尿潜血',
  UACR: 'UACR',
  WBC: 'WBC',
  RBC: 'RBC',
  Hb: 'Hb',
  Ht: 'Ht',
  GGT: 'γ-GT',
  PTINR: 'PT-INR',
  DDIMER: 'Dダイマー',
  HBSAG: 'HBs抗原',
  HCVAB: 'HCV抗体',
  FLU: 'インフル',
  COVID: 'コロナ',
  PLT: 'PLT',
  TP: 'TP',
  ALB: 'Alb',
  TBIL: 'T-Bil',
}
const shortName = (code: string) => SHORT[code] ?? labItem(code)?.name ?? code

const ymdShort = (d: string) => `${d.slice(0, 4)}/${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
const ymdSlash = (d: string) => d.replace(/-/g, '/')

const FLAG_TEXT = { H: 'text-error font-semibold', L: 'text-[#1565c0] font-semibold' } as const
const arrow = (f?: 'H' | 'L') => (f === 'H' ? '↑' : f === 'L' ? '↓' : '')
// 定性（尿蛋白「+」など文字の値）は矢印を付けず色だけ
const mark = (v: LabValue) => (typeof v.value === 'number' ? arrow(v.flag) : '')

// 値の表示（H は赤↑、L は青↓）
function Val({ v }: { v?: LabValue }) {
  if (!v) return <span className="text-line">—</span>
  return (
    <span className={`font-num whitespace-nowrap ${v.flag ? FLAG_TEXT[v.flag] : ''}`}>
      {v.value}
      {mark(v)}
    </span>
  )
}

const valueText = (v: LabValue) => `${v.value}${mark(v)}`

// 項目を LAB_ITEMS の並び（見出しごと）に並べる
const groupRows = (codes: Set<string>) =>
  BLOOD_GROUPS.map((g) => ({ group: g, items: LAB_ITEMS.filter((it) => it.group === g && codes.has(it.code)) })).filter((x) => x.items.length > 0)

const byDateDesc = (a: LabReport, b: LabReport) => b.date.localeCompare(a.date)

// 記載に貼る短い要約：最新の結果のうち主要な項目（MAIN の順）と、それ以外の異常値（例 検査（10/2）：HbA1c 6.9%↑ LDL 118 eGFR 59↓）
export const labSummary = (r: LabReport) => {
  const order = (c: string) => (MAIN.includes(c) ? MAIN.indexOf(c) : MAIN.length + LAB_ITEMS.findIndex((it) => it.code === c))
  const pick = r.values.filter((v) => MAIN.includes(v.code) || v.flag).sort((a, b) => order(a.code) - order(b.code))
  return `検査（${md(r.date)}）：${pick.map((v) => `${shortName(v.code)} ${v.value}${v.code === 'HBA1C' ? '%' : ''}${mark(v)}`).join(' ')}`
}

type Filter = 'all' | 'abn' | 'main'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '全項目' },
  { id: 'abn', label: '異常のみ' },
  { id: 'main', label: '主要' },
]

// バイタル（血圧・体重）はカルテの記録から
const vitalSeries = (p: Patient, key: 'bp' | 'bw'): ChartSeries[] => {
  const encs = [...p.encounters].sort((a, b) => a.date.localeCompare(b.date))
  if (key === 'bw') return [{ label: '体重', color: '#3f6f8f', points: encs.filter((e) => e.vitals.bw).map((e) => ({ date: e.date, value: e.vitals.bw! })) }]
  return [
    { label: '収縮期', color: '#3f6f8f', points: encs.filter((e) => e.vitals.sbp).map((e) => ({ date: e.date, value: e.vitals.sbp! })) },
    { label: '拡張期', color: '#8a9a8e', points: encs.filter((e) => e.vitals.dbp).map((e) => ({ date: e.date, value: e.vitals.dbp! })) },
  ]
}

// 右の枠：この患者の検査結果。上にグラフ、下に表（行＝項目、列＝採取日・新しい日が左）。
// 行を押すとその項目のグラフ。未確認の列は金の地で「確認」ボタン
export function LabsPanel({ patient, dispatch }: { patient: Patient; dispatch: (a: Action) => void }) {
  const reports = useMemo(() => [...(patient.labs ?? [])].sort(byDateDesc), [patient.labs])
  const codes = useMemo(() => new Set(reports.flatMap((r) => r.values.map((v) => v.code))), [reports])
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState<string>(() => (codes.has('HBA1C') ? 'HBA1C' : ([...codes][0] ?? 'BP')))
  const [quoted, setQuoted] = useState(false)
  const unreviewed = reports.filter((r) => !r.reviewed)

  const cell = (r: LabReport, code: string) => r.values.find((v) => v.code === code)
  const rowVisible = (code: string) => (filter === 'all' ? true : filter === 'main' ? MAIN.includes(code) : reports.some((r) => cell(r, code)?.flag))
  const groups = groupRows(new Set([...codes].filter(rowVisible)))

  // グラフ：血圧・体重はカルテの記録、検査は結果から
  const vitalsHas = (k: 'bp' | 'bw') => vitalSeries(patient, k).some((s) => s.points.length > 0)
  const chips = [
    ...(vitalsHas('bp') ? [{ id: 'BP', label: '血圧' }] : []),
    ...(vitalsHas('bw') ? [{ id: 'BW', label: '体重' }] : []),
    ...MAIN.filter((c) => codes.has(c) && !labItem(c)?.qualitative).map((c) => ({ id: c, label: shortName(c) })),
  ]
  const item = labItem(sel)
  const series: ChartSeries[] =
    sel === 'BP' || sel === 'BW'
      ? vitalSeries(patient, sel === 'BP' ? 'bp' : 'bw')
      : [
          {
            label: item?.name ?? sel,
            color: '#7a4fa8',
            points: [...reports].reverse().flatMap((r) => r.values.filter((v) => v.code === sel && typeof v.value === 'number').map((v) => ({ date: r.date, value: v.value as number }))),
          },
        ]
  const qualitativeRows = item?.qualitative ? reports.map((r) => ({ date: r.date, v: cell(r, sel) })).filter((x) => x.v) : []

  const quote = () => {
    if (!reports[0]) return
    dispatch({ type: 'insertText', text: labSummary(reports[0]) })
    setQuoted(true)
  }
  useEffect(() => {
    if (!quoted) return
    const t = setTimeout(() => setQuoted(false), 4000)
    return () => clearTimeout(t)
  }, [quoted])

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <Icon name="lab_profile" size={20} className="text-lab" />
        <h2 className="text-base font-semibold">検査結果</h2>
        <span className="text-xs text-mist">
          {reports.length}回分
          {unreviewed.length > 0 && <span className="ml-1.5 rounded bg-gold-soft px-1.5 py-0.5 font-medium text-gold-dark">未確認 {unreviewed.length}</span>}
        </span>
        <span className="flex-1" />
        {quoted ? (
          <span className="flex items-center gap-1.5 text-xs text-rx">
            <Icon name="check" size={16} />
            記載に追加しました
            <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="text-clinical hover:underline">
              記載に戻る
            </button>
          </span>
        ) : (
          reports.length > 0 && (
            <button onClick={quote} title={labSummary(reports[0])} className="btn btn-sm btn-tonal">
              <Icon name="format_quote" size={18} />
              記載に引用
            </button>
          )
        )}
      </div>

      {reports.length === 0 && chips.length === 0 ? (
        <div className="mx-4 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-mist">
          検査結果はまだありません。
          <br />
          外注検査の結果は、左のメニュー「検査結果」から取り込みます。
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {/* グラフ */}
          <div className="rounded-lg border border-line bg-ivory px-3 pt-2 pb-2">
            <div className="mb-1 flex flex-wrap gap-1">
              {chips.map((c) => (
                <button key={c.id} onClick={() => setSel(c.id)} className={`chip h-6 px-2 text-[0.6875rem] ${sel === c.id ? 'chip-on' : ''}`}>
                  {c.label}
                </button>
              ))}
              {item && !chips.some((c) => c.id === sel) && <span className="chip chip-on h-6 px-2 text-[0.6875rem]">{item.name}</span>}
            </div>
            {item?.qualitative ? (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-sm">
                <span className="text-xs text-mist">{item.name}（定性のためグラフなし）</span>
                {qualitativeRows.map((x) => (
                  <span key={x.date} className="text-xs">
                    <span className="text-mist">{md(x.date)}</span> <Val v={x.v} />
                  </span>
                ))}
              </div>
            ) : (
              <LabChart
                series={series}
                band={item ? { low: item.low, high: item.high } : undefined}
                refs={sel === 'BP' ? [{ value: 130, label: '目標130' }, { value: 80, label: '目標80' }] : []}
                unit={sel === 'BP' ? 'mmHg' : sel === 'BW' ? 'kg' : item?.unit}
                height={140}
              />
            )}
          </div>

          {reports.length > 0 && (
            <>
              <div className="mt-3 mb-1.5 flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-line bg-cream p-0.5 text-xs">
                  {FILTERS.map((f) => (
                    <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded px-2.5 py-1 ${filter === f.id ? 'bg-ivory font-medium shadow-soft' : 'text-mist'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="flex-1" />
                <span className="text-[0.6875rem] text-mist">
                  <span className="text-error">↑高い</span> <span className="text-[#1565c0]">↓低い</span>・行を押すとグラフ
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-line bg-ivory">
                <table className="w-full border-collapse text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-line bg-cream text-[0.6875rem] text-mist">
                      <th className="sticky left-0 z-10 bg-cream px-2 py-1.5 text-left font-medium">項目</th>
                      <th className="px-1.5 py-1.5 text-left font-medium whitespace-nowrap">基準値</th>
                      {reports.map((r) => (
                        <th
                          key={r.id}
                          title={`採取 ${ymdSlash(r.date)}・報告 ${ymdSlash(r.reportedAt)}・${r.source}`}
                          className={`px-1.5 py-1 text-right font-medium whitespace-nowrap ${r.reviewed ? '' : 'bg-gold-soft'}`}
                        >
                          <div className="font-num text-[0.75rem] text-ink">{md(r.date)}</div>
                          {r.reviewed ? (
                            <div className="text-[0.625rem]">確認済</div>
                          ) : (
                            <button
                              onClick={() => dispatch({ type: 'reviewLab', patientId: patient.id, reportId: r.id })}
                              className="mt-0.5 rounded bg-gold-dark px-1.5 text-[0.625rem] leading-4 text-white hover:brightness-110"
                            >
                              確認
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <GroupRows key={g.group} group={g.group} count={reports.length}>
                        {g.items.map((it) => {
                          const on = sel === it.code
                          return (
                            <tr key={it.code} onClick={() => setSel(it.code)} className={`cursor-pointer border-b border-line last:border-b-0 ${on ? 'bg-lab-ctr' : 'hover:bg-cream'}`}>
                              <td className={`sticky left-0 z-10 px-2 py-1 whitespace-nowrap ${on ? 'bg-lab-ctr font-medium' : 'bg-ivory'}`}>{it.name}</td>
                              <td className="px-1.5 py-1 text-[0.6875rem] leading-tight whitespace-nowrap text-mist">
                                <span className="font-num">{rangeText(it.code)}</span>
                                {it.unit && <span className="block text-[0.625rem]">{it.unit}</span>}
                              </td>
                              {reports.map((r) => (
                                <td key={r.id} className={`px-1.5 py-1 text-right ${r.reviewed ? '' : 'bg-gold-soft/40'}`}>
                                  <Val v={cell(r, it.code)} />
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </GroupRows>
                    ))}
                    {groups.length === 0 && (
                      <tr>
                        <td colSpan={reports.length + 2} className="px-3 py-6 text-center text-xs text-mist">
                          {filter === 'abn' ? '基準値を外れた項目はありません' : '該当する項目がありません'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[0.6875rem] text-mist">日付は採取日。見出しの日付に触れると報告日と検査会社（架空）が出ます。</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function GroupRows({ group, count, children }: { group: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-b border-line bg-surface-1">
        <td colSpan={count + 2} className="sticky left-0 px-2 py-0.5 text-[0.6875rem] font-medium text-mist">
          {group}
        </td>
      </tr>
      {children}
    </>
  )
}

// ---- 左のメニュー「検査結果」：未確認の結果と取り込み ----

const norm = (s: string) => s.replace(/[\s　]/g, '')

type Match = { status: '一致' | '候補' | '不一致'; patient?: Patient; reason?: string }

// 自動照合：氏名と生年月日が両方合えば一致。氏名・カナ・生年月日のうち2つが合えば候補（自動では入れない）
const matchPatient = (inc: IncomingLab, patients: Patient[]): Match => {
  const exact = patients.find((p) => norm(p.name) === norm(inc.name) && p.birth === inc.birth)
  if (exact) return { status: '一致', patient: exact }
  const scored = patients
    .map((p) => ({
      p,
      hits: [norm(p.name) === norm(inc.name) && '氏名', norm(p.kana) === norm(inc.kana) && 'カナ', p.birth === inc.birth && '生年月日'].filter(Boolean) as string[],
    }))
    .filter((x) => x.hits.length >= 2)
    .sort((a, b) => b.hits.length - a.hits.length)
  if (scored[0]) return { status: '候補', patient: scored[0].p, reason: `${scored[0].hits.join('・')}が一致` }
  return { status: '不一致' }
}

const MATCH_STYLE: Record<Match['status'], string> = {
  一致: 'bg-[#e6f6f2] text-[#0d6e61]',
  候補: 'bg-[#fff8e6] text-gold-dark border border-gold',
  不一致: 'bg-error-ctr text-error',
}

// 異常値の札（最大 max 個、残りは +n）
function AbnChips({ r, max = 4 }: { r: LabReport; max?: number }) {
  const abn = r.values.filter((v) => v.flag)
  if (abn.length === 0) return <span className="text-xs text-mist">異常なし</span>
  return (
    <span className="flex flex-wrap items-center gap-1">
      {abn.slice(0, max).map((v) => (
        <span
          key={v.code}
          className={`rounded border px-1.5 text-[0.6875rem] leading-5 whitespace-nowrap ${v.flag === 'H' ? 'border-red-200 bg-red-50 text-error' : 'border-blue-200 bg-blue-50 text-[#1565c0]'}`}
        >
          {shortName(v.code)} {v.value}
          {typeof v.value === 'number' ? ` ${v.flag}` : ''}
        </span>
      ))}
      {abn.length > max && <span className="text-[0.6875rem] text-mist">+{abn.length - max}</span>}
    </span>
  )
}

type Row = { patient: Patient; report: LabReport }

export function ResultsPage({ patients, dispatch, onOpen }: { patients: Patient[]; dispatch: (a: Action) => void; onOpen: (id: string) => void }) {
  const [showReviewed, setShowReviewed] = useState(false)
  const all: Row[] = patients.flatMap((p) => (p.labs ?? []).map((r) => ({ patient: p, report: r })))
  const pending = all.filter((x) => !x.report.reviewed).sort((a, b) => b.report.reportedAt.localeCompare(a.report.reportedAt) || b.report.date.localeCompare(a.report.date))
  const done = all
    .filter((x) => x.report.reviewed)
    .sort((a, b) => b.report.date.localeCompare(a.report.date))
    .slice(0, 20)
  const rows = showReviewed ? [...pending, ...done] : pending
  const [sel, setSel] = useState(0)
  const cur = rows[Math.min(sel, rows.length - 1)]

  const review = (x: Row) => dispatch({ type: 'reviewLab', patientId: x.patient.id, reportId: x.report.id })

  // キー操作：↑↓（J/K）で選ぶ、E で確認済にして次へ、Enter でカルテを開く。入力中・窓を開いている間は効かない
  const ref = useRef({ rows, cur })
  ref.current = { rows, cur }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || document.querySelector('[aria-modal="true"]')) return
      const { rows, cur } = ref.current
      const n = rows.length
      if (!n) return
      const k = e.key
      if (k === 'ArrowDown' || k === 'j') setSel((i) => Math.min(n - 1, i + 1))
      else if (k === 'ArrowUp' || k === 'k') setSel((i) => Math.max(0, i - 1))
      else if (k === 'Enter' && t === document.body && cur) onOpen(cur.patient.id)
      else if (k.toLowerCase() === 'e' && cur && !cur.report.reviewed) dispatch({ type: 'reviewLab', patientId: cur.patient.id, reportId: cur.report.id })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen, dispatch])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-8 max-md:px-4 max-md:pt-4">
      <div className="mb-4 flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-base font-semibold whitespace-nowrap">検査結果</h1>
        <span className={`rounded px-2 py-1 text-xs font-medium ${pending.length ? 'bg-gold-dark text-white' : 'border border-line bg-cream text-mist'}`}>
          未確認 <span className="font-num">{pending.length}</span>
        </span>
        <button onClick={() => setShowReviewed((v) => !v)} className={`chip h-7 text-xs ${showReviewed ? 'chip-on' : ''}`}>
          {showReviewed && <Icon name="check" size={16} />}
          確認済も表示
        </button>
      </div>

      <div className="grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">{showReviewed ? '未確認・確認済の結果' : '未確認の結果'}</h2>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-ivory px-6 py-10 text-center text-sm text-mist">未確認の結果はありません</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line bg-ivory shadow-soft">
                <table className="w-full text-sm">
                  <thead className="bg-cream text-left text-xs text-mist">
                    <tr className="border-b border-line">
                      <th className="px-3 py-2 font-medium">患者</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap max-md:hidden">採取日</th>
                      <th className="px-3 py-2 font-medium">基準値を外れた項目</th>
                      <th className="w-20 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x, i) => {
                      const on = cur === x
                      return (
                        <tr
                          key={x.report.id}
                          onClick={() => setSel(i)}
                          onDoubleClick={() => onOpen(x.patient.id)}
                          title="押すと右に中身・ダブルクリックでカルテ"
                          className={`cursor-pointer border-b border-line last:border-b-0 ${
                            on ? 'bg-[#f3ead8] outline-2 -outline-offset-2 outline-clinical' : x.report.reviewed ? 'text-mist hover:bg-cream' : 'bg-[#fff8e6] hover:brightness-[0.98]'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <PatientIcon patient={x.patient} size={28} />
                              <div className="min-w-0">
                                <div className="font-medium whitespace-nowrap">{x.patient.name}</div>
                                <div className="text-[0.6875rem] whitespace-nowrap text-mist">
                                  {ageSex(x.patient)}
                                  <span className="md:hidden">・採取 {md(x.report.date)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-num whitespace-nowrap max-md:hidden">
                            {ymdSlash(x.report.date)}
                            <div className="text-[0.6875rem] text-mist">報告 {md(x.report.reportedAt)}</div>
                          </td>
                          <td className="px-3 py-2">
                            <AbnChips r={x.report} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {x.report.reviewed ? (
                              <span className="text-[0.6875rem] text-mist">確認済</span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  review(x)
                                }}
                                className="btn btn-sm btn-tonal"
                              >
                                確認
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-mist">
              <Icon name="keyboard" size={16} />
              ↑↓（J/K）で選ぶ・<span className="kbd">E</span> 確認済にして次へ・<span className="kbd">Enter</span> カルテを開く
            </p>
          </section>

          <Importer patients={patients} dispatch={dispatch} />
        </div>

        <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          {cur ? (
            <Preview row={cur} onReview={() => review(cur)} onOpen={() => onOpen(cur.patient.id)} />
          ) : (
            <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center text-sm text-mist max-lg:hidden">結果を選ぶと中身が出ます</div>
          )}
        </aside>
      </div>
    </main>
  )
}

// 選んだ結果の中身：項目・今回・前回・基準値
function Preview({ row, onReview, onOpen }: { row: Row; onReview: () => void; onOpen: () => void }) {
  const { patient, report } = row
  const prevOf = (code: string) =>
    [...(patient.labs ?? [])]
      .filter((r) => r.date < report.date)
      .sort(byDateDesc)
      .map((r) => ({ date: r.date, v: r.values.find((v) => v.code === code) }))
      .find((x) => x.v)
  const groups = groupRows(new Set(report.values.map((v) => v.code)))
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-l-4 border-line border-l-clinical px-3 py-2.5">
        <PatientIcon patient={patient} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[0.6875rem] text-mist">{patient.kana}</div>
          <div className="font-semibold">{patient.name}</div>
          <div className="text-[0.6875rem] text-mist">
            {ageSex(patient)}・{birthLabel(patient.birth)}生
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 px-3 pt-2 text-[0.6875rem] text-mist">
        <span>採取 {ymdSlash(report.date)}</span>
        <span>報告 {ymdSlash(report.reportedAt)}</span>
        <span>{report.source}</span>
      </div>
      <div className="max-h-[52vh] overflow-y-auto px-3 pb-2">
        <table className="w-full text-[0.8125rem]">
          <thead className="text-[0.6875rem] text-mist">
            <tr className="border-b border-line">
              <th className="py-1 text-left font-medium">項目</th>
              <th className="py-1 text-right font-medium">今回</th>
              <th className="py-1 text-right font-medium">前回</th>
              <th className="py-1 pl-3 text-left font-medium">基準値</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupBlock key={g.group} group={g.group}>
                {g.items.map((it) => {
                  const prev = prevOf(it.code)
                  return (
                    <tr key={it.code} className="border-b border-line/70 last:border-b-0">
                      <td className="py-1 whitespace-nowrap">{it.name}</td>
                      <td className="py-1 text-right">
                        <Val v={report.values.find((x) => x.code === it.code)} />
                      </td>
                      <td className="py-1 text-right font-num text-[0.75rem] text-mist" title={prev ? `${ymdSlash(prev.date)} の値` : undefined}>
                        {prev?.v ? valueText(prev.v) : '—'}
                      </td>
                      <td className="py-1 pl-3 text-[0.6875rem] whitespace-nowrap text-mist">
                        <span className="font-num">{rangeText(it.code)}</span> {it.unit}
                      </td>
                    </tr>
                  )
                })}
              </GroupBlock>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-cream px-3 py-2">
        {report.reviewed ? (
          <span className="flex items-center gap-1 text-xs text-mist">
            <Icon name="check" size={16} />
            確認済
          </span>
        ) : (
          <button onClick={onReview} className="btn btn-sm btn-filled">
            <Icon name="done_all" size={18} />
            確認済にする <span className="kbd">E</span>
          </button>
        )}
        <span className="flex-1" />
        <button onClick={onOpen} className="btn btn-sm btn-outlined">
          カルテを開く <span className="kbd">Enter</span>
        </button>
      </div>
    </div>
  )
}

function GroupBlock({ group, children }: { group: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="pt-2 pb-0.5 text-[0.6875rem] font-medium text-mist">
          {group}
        </td>
      </tr>
      {children}
    </>
  )
}

// 取り込み：検査会社から届いた結果を患者に照合して取り込む（試作は架空の受信。ファイルの中身は読まない）
function Importer({ patients, dispatch }: { patients: Patient[]; dispatch: (a: Action) => void }) {
  const [batch, setBatch] = useState<IncomingLab[] | null>(null)
  const [file, setFile] = useState('')
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [over, setOver] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const imported = (inc: IncomingLab) => patients.some((p) => p.labs?.some((r) => r.id === inc.report.id))
  const receive = (name: string) => {
    const b = incomingLabs()
    setBatch(b)
    setFile(name)
    setDoneMsg('')
    // 一致だけは最初から取り込む先を入れる。候補・不一致は人が選ぶ
    setTargets(
      Object.fromEntries(
        b.map((x) => {
          const m = matchPatient(x, patients)
          return [x.id, m.status === '一致' && m.patient ? m.patient.id : '']
        }),
      ),
    )
  }
  const rows = batch?.filter((x) => !imported(x)) ?? []
  const ready = rows.filter((x) => targets[x.id] && targets[x.id] !== 'skip')
  const waiting = rows.filter((x) => !targets[x.id])

  const run = () => {
    dispatch({ type: 'addLabs', items: ready.map((x) => ({ patientId: targets[x.id], report: x.report })) })
    setDoneMsg(`${ready.length}件を取り込みました。上の「未確認の結果」に入っています。`)
    if (rows.every((x) => ready.includes(x) || targets[x.id] === 'skip')) setBatch(null)
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">取り込み</h2>
      {doneMsg && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md bg-rx-ctr px-3 py-2 text-xs text-rx">
          <Icon name="check_circle" size={16} />
          {doneMsg}
        </p>
      )}
      {!batch || rows.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            receive(e.dataTransfer.files[0]?.name ?? '結果ファイル')
          }}
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-7 text-center transition-colors ${over ? 'border-gold-dark bg-gold-soft/60' : 'border-line bg-ivory'}`}
        >
          <Icon name="upload_file" size={32} className="text-mist" />
          <div className="text-sm">検査会社の結果ファイル（CSV・HL7）をここに落とす</div>
          <div className="text-[0.6875rem] text-mist">試作ではファイルの中身は読まず、架空の結果を受信します</div>
          <button onClick={() => receive(`架空検査センター_${today().replace(/-/g, '')}.csv`)} className="btn btn-sm btn-tonal mt-1">
            <Icon name="cloud_download" size={18} />
            検査会社から受信（架空）
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-ivory shadow-soft">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-cream px-3 py-2 text-xs">
            <Icon name="description" size={16} className="text-mist" />
            <span className="font-medium">{file}</span>
            <span className="text-mist">受信 {rows.length}件・氏名と生年月日で自動照合</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[0.6875rem] text-mist">
                <tr className="border-b border-line">
                  <th className="px-3 py-1.5 font-medium">受信した患者</th>
                  <th className="px-3 py-1.5 font-medium max-md:hidden">結果</th>
                  <th className="px-3 py-1.5 font-medium">照合</th>
                  <th className="px-3 py-1.5 font-medium">取り込む先</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const m = matchPatient(x, patients)
                  const t = targets[x.id] ?? ''
                  return (
                    <tr key={x.id} className={`border-b border-line last:border-b-0 ${t === 'skip' ? 'text-mist' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium whitespace-nowrap">{x.name}</div>
                        <div className="text-[0.6875rem] whitespace-nowrap text-mist">
                          {x.kana}・{birthLabel(x.birth)}・{x.sex}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-md:hidden">
                        <div className="mb-0.5 text-[0.6875rem] text-mist">
                          採取 {md(x.report.date)}・{x.report.values.length}項目
                        </div>
                        <AbnChips r={x.report} max={3} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ${MATCH_STYLE[m.status]}`}>{m.status}</span>
                        {m.reason && <div className="mt-0.5 text-[0.625rem] whitespace-nowrap text-mist">{m.reason}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={t}
                          onChange={(e) => setTargets((cur) => ({ ...cur, [x.id]: e.target.value }))}
                          aria-label={`${x.name}の取り込む先`}
                          className={`field h-8 w-52 px-2 text-xs ${!t ? 'border-gold text-gold-dark' : ''}`}
                        >
                          <option value="">— 患者を選ぶ —</option>
                          {m.status === '候補' && m.patient && (
                            <option value={m.patient.id}>
                              候補：{m.patient.name}（{ymdShort(m.patient.birth)}）
                            </option>
                          )}
                          {patients
                            .filter((p) => !(m.status === '候補' && p.id === m.patient?.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}（{ymdShort(p.birth)}）
                              </option>
                            ))}
                          <option value="skip">取り込まない</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-cream px-3 py-2">
            <span className="text-[0.6875rem] text-mist">{waiting.length > 0 ? `取り込む先が決まっていない ${waiting.length}件は残します（候補・不一致は人が選ぶ）` : '取り込む先が決まりました'}</span>
            <span className="flex-1" />
            <button onClick={() => setBatch(null)} className="btn btn-sm btn-text">
              やめる
            </button>
            <button onClick={run} disabled={ready.length === 0} className="btn btn-sm btn-filled disabled:opacity-40">
              <Icon name="download_done" size={18} />
              {ready.length}件を取り込む
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
