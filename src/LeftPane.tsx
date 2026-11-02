import { useRef, useState } from 'react'
import { ORDER_KINDS, kindOfTest, type OrderKind } from './data'
import { PrescriptionButton } from './Prescription'
import { rxLine } from './rxFormat'
import type { DoPart } from './store'
import type { Encounter, Patient, Vitals } from './types'

export type Filter = '全て' | '記載' | '処方' | '検査' | '文書'
const FILTERS: Filter[] = ['全て', '記載', '処方', '検査', '文書']

export const vitalsLine = (v: Vitals) =>
  [
    v.sbp && v.dbp ? `BP ${v.sbp}/${v.dbp}` : '',
    v.hr ? `HR ${v.hr}` : '',
    v.bt ? `BT ${v.bt}` : '',
    v.spo2 ? `SpO2 ${v.spo2}%` : '',
    v.bw ? `BW ${v.bw}kg` : '',
  ]
    .filter(Boolean)
    .join('  ')

export const encounterSummary = (e: Encounter) =>
  [
    `【${e.date} ${e.kind}】`,
    vitalsLine(e.vitals),
    e.text,
    e.rx.length ? `処方：${e.rx.map(rxLine).join('、')}` : '',
    e.tests.length ? `検査：${e.tests.map((t) => t.name).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

// 過去の記録を右の記載欄へドラッグしてDoする（カードごと＝記載・処方・検査、処方・検査・記載の欄だけでも）
export type DoDrag = { encounterId: string; parts: DoPart[] }

type Props = {
  patient: Patient
  selectedId: string | null
  onDo: (encounterId: string) => void
  onQuote: (text: string) => void
  onEdit: (encounterId: string, focus?: 'orders') => void
  onDrag: (d: DoDrag | null) => void
}

const WD = ['日', '月', '火', '水', '木', '金', '土']
export const dayLabel = (d: string) => {
  const t = new Date(`${d}T00:00:00`)
  return `${d.replace(/-/g, '/')}（${WD[t.getDay()]}）`
}

// 左：経過（ファストカルテの ChartDateRail＋タイムラインと同じ形）。
// 一番左に月ごとの日付の列、押すとその日へ飛ぶ。日ごとに見出し、その下に「記録」のカード（左に色の太線）と「オーダー」の枠
export function LeftPane({ patient, selectedId, onDo, onQuote, onEdit, onDrag }: Props) {
  const [filter, setFilter] = useState<Filter>('全て')
  const list = [...patient.encounters].sort((a, b) => b.date.localeCompare(a.date))
  const scroller = useRef<HTMLDivElement>(null)
  const months = list.reduce<{ ym: string; days: string[] }[]>((acc, e) => {
    const ym = e.date.slice(0, 7)
    const m = acc.find((x) => x.ym === ym) ?? (acc.push({ ym, days: [] }), acc[acc.length - 1])
    if (!m.days.includes(e.date)) m.days.push(e.date)
    return acc
  }, [])
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set(list.length > 12 ? months.slice(0, 1).map((m) => m.ym) : months.map((m) => m.ym)))
  const jump = (d: string) => scroller.current?.querySelector(`#day-${d}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  return (
    <div className="flex h-full gap-3">
      {list.length > 0 && (
        <nav aria-label="日付" className="w-[4.5rem] shrink-0 overflow-y-auto max-lg:hidden">
          {months.map((m) => {
            const open = openMonths.has(m.ym)
            return (
              <div key={m.ym} className="mb-1.5">
                <button
                  onClick={() => setOpenMonths((cur) => (cur.has(m.ym) ? new Set([...cur].filter((x) => x !== m.ym)) : new Set(cur).add(m.ym)))}
                  className="flex items-center gap-0.5 text-[0.6875rem] whitespace-nowrap text-mist hover:text-ink"
                >
                  <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                  <span className="font-num">{m.ym.replace('-', '/')}</span>
                </button>
                {open && (
                  <div className="mt-1 ml-1.5 flex flex-col gap-1 border-l border-line pl-1">
                    {m.days.map((d) => (
                      <button key={d} onClick={() => jump(d)} className="rounded-md border border-line bg-ivory px-1.5 py-1 text-center text-xs leading-tight text-clinical hover:bg-gold-soft">
                        <span className="font-num block">{Number(d.slice(8))}日</span>
                        <span className="block text-[0.6875rem] text-mist">（{WD[new Date(`${d}T00:00:00`).getDay()]}）</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 gap-1 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? 'chip-on' : ''}`}>
              {f}
            </button>
          ))}
        </div>

        <div ref={scroller} className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 pb-3">
          {list.length === 0 && <div className="rounded-lg border border-dashed border-line bg-ivory px-6 py-12 text-center text-mist">過去の記録はありません（初診）</div>}
          {list.map((e) => {
            const showText = filter === '全て' || filter === '記載'
            const showRx = (filter === '全て' || filter === '処方') && e.rx.length > 0
            const showTests = (filter === '全て' || filter === '検査') && e.tests.length > 0
            const showDocs = (filter === '全て' || filter === '文書') && e.letters.length > 0
            if (!showText && !showRx && !showTests && !showDocs) return null
            const drag = (parts: DoPart[]) => ({
              draggable: true,
              onDragStart: (ev: React.DragEvent) => {
                ev.stopPropagation()
                ev.dataTransfer.effectAllowed = 'copy'
                ev.dataTransfer.setData('text/plain', encounterSummary(e))
                onDrag({ encounterId: e.id, parts })
              },
              onDragEnd: () => onDrag(null),
            })
            const sel = selectedId === e.id
            return (
              <section key={e.id} id={`day-${e.date}`} {...drag(['text', 'rx', 'tests'])} title="右へドラッグするとこの日の記載・処方・検査をDo" className="group scroll-mt-1">
                <h3 className="mb-2 flex items-baseline gap-2 border-b border-line pb-1 text-sm font-semibold">
                  <span className="font-num">{dayLabel(e.date)}</span>
                  <span className="text-xs font-normal text-mist">{e.kind}</span>
                  {e.version > 1 && <span className="rounded bg-doc-ctr px-1.5 text-[0.6875rem] font-medium text-doc">訂正 v{e.version}</span>}
                </h3>
                {showText && (
                  <div
                    {...drag(['text'])}
                    onDoubleClick={() => onEdit(e.id)}
                    title="ダブルクリックで訂正・右へドラッグで記載をコピー"
                    className={`mb-2 cursor-grab rounded-md border border-l-4 border-line border-l-sky-400 p-3 active:cursor-grabbing ${sel ? 'bg-gold-soft ring-2 ring-gold-dark' : 'bg-sky-50/60'}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-mist">
                      <span>記録</span>
                      <span>担当: 青木</span>
                      <span className="rounded bg-sky-100 px-1 text-[0.6875rem] text-sky-800">Dr</span>
                      <span className="flex-1" />
                      <span className="flex gap-2 opacity-70 transition-opacity group-hover:opacity-100 touch:opacity-100">
                        {e.rx.length > 0 && (
                          <button onClick={() => onDo(e.id)} className="text-clinical hover:underline" title="この処方をDo（⌘D）">
                            Do
                          </button>
                        )}
                        <button onClick={() => onQuote(encounterSummary(e))} className="text-clinical hover:underline">
                          引用
                        </button>
                        <button onClick={() => onEdit(e.id)} className="text-clinical hover:underline">
                          開く
                        </button>
                      </span>
                    </div>
                    {vitalsLine(e.vitals) && <div className="mb-1 font-num text-xs text-mist">{vitalsLine(e.vitals)}</div>}
                    <div className="text-[0.8125rem] leading-relaxed whitespace-pre-wrap">{e.text || <span className="text-mist">（記載なし）</span>}</div>
                  </div>
                )}
                {(showRx || showTests || showDocs) && (
                  <div className="rounded-md border border-line bg-ivory p-3">
                    <div className="mb-1 flex items-center text-xs text-mist">
                      オーダー
                      <span className="flex-1" />
                      {e.rx.length > 0 && <PrescriptionButton patient={patient} encounter={e} compact />}
                    </div>
                    {showRx && (
                      <div {...drag(['rx'])} onDoubleClick={() => onEdit(e.id, 'orders')} title="ダブルクリックで訂正・右へドラッグで処方をDo" className="cursor-grab rounded hover:bg-cream active:cursor-grabbing">
                        {e.rx.map((r) => (
                          <div key={r.id} className="flex items-baseline gap-2 border-b border-line py-1.5 text-sm last:border-b-0">
                            <span className="w-8 shrink-0 rounded bg-rx-ctr text-center text-[0.6875rem] text-rx">処方</span>
                            <span className="min-w-0 flex-1">{rxLine(r)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showTests && (
                      <div {...drag(['tests'])} onDoubleClick={() => onEdit(e.id, 'orders')} title="ダブルクリックで訂正・右へドラッグで検査をDo" className="cursor-grab rounded hover:bg-cream active:cursor-grabbing">
                        {(Object.keys(ORDER_KINDS) as OrderKind[]).map((k) => {
                          const ts = e.tests.filter((t) => kindOfTest(t.code) === k)
                          return (
                            ts.length > 0 && (
                              <div key={k} className="flex items-baseline gap-2 border-b border-line py-1.5 text-sm last:border-b-0">
                                <span className={`w-8 shrink-0 rounded text-center text-[0.6875rem] ${ORDER_KINDS[k].tone}`}>{ORDER_KINDS[k].short}</span>
                                <span className="min-w-0 flex-1">{ts.map((t) => t.name).join('、')}</span>
                              </div>
                            )
                          )
                        })}
                      </div>
                    )}
                    {showDocs &&
                      e.letters.map((l) => (
                        <div key={l.id} className="flex items-baseline gap-2 py-1.5 text-sm">
                          <span className="w-8 shrink-0 rounded bg-doc-ctr text-center text-[0.6875rem] text-doc">文書</span>
                          <span className="min-w-0 flex-1">
                            {l.title}（{l.to || '宛先未記入'}）
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
