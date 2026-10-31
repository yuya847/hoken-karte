import { useEffect, useMemo, useRef, useState } from 'react'
import { DRUGS, ORDER_KINDS, SETS, TESTS, kindOfTest } from './data'
import { vitalsLine } from './LeftPane'
import { Icon } from './Icon'
import { daysText, doseText, groupRp, isBlank, rxLine, usageLine } from './rxFormat'
import { RxCard } from './RxWindow'
import { DxStrip } from './DiseasePanel'
import { OrderSearch, type SearchItem } from './OrderSearch'
import type { Action } from './store'
import type { Draft, Encounter, Patient } from './types'
import { parseVitals } from './vitals'

// 処方・検査・セットをひとつの検索欄で引く。病名はオーダーから自動で付くのでここには出さない
const ORDER_ITEMS: SearchItem[] = [
  ...SETS.map((x) => ({ id: `set:${x.id}`, label: x.name, keys: `${x.kana} ${x.alias}`, icon: 'playlist_add', iconClass: 'text-primary', tag: 'セット' })),
  ...DRUGS.map((d) => ({ id: `rx:${d.id}`, label: d.name, sub: `${doseText(d)} ${usageLine(d)} ${daysText(d) || (d.site ?? '')}`, keys: `${d.kana} ${d.alias}`, icon: 'medication', iconClass: 'text-rx', tag: '処方' })),
  ...TESTS.map((t) => ({ id: `test:${t.code}`, label: t.name, keys: `${t.kana} ${t.alias}`, icon: ORDER_KINDS[kindOfTest(t.code)].icon, iconClass: 'text-lab', tag: ORDER_KINDS[kindOfTest(t.code)].short })),
]

const VITALS_HINT = 'BP 128/78　HR 72　BT 36.5　SpO2 98　BW 62.4 のように書くとバイタルとして読み取ります'

type ChartProps = {
  patient: Patient
  draft: Draft
  dispatch: (a: Action) => void
  onOpenRx: () => void
  onOpenTests: () => void
}

function SectionTitle({ icon, label, tone, children }: { icon: string; label: string; tone: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded ${tone}`}>
        <Icon name={icon} size={16} />
      </span>
      <span className="flex-1 text-sm font-semibold whitespace-nowrap">{label}</span>
      {children}
    </div>
  )
}

export function ChartEditor({ patient, draft, dispatch, onOpenRx, onOpenTests }: ChartProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const orderRef = useRef<HTMLInputElement>(null)
  useEffect(() => textRef.current?.focus(), [])

  const detected = useMemo(() => vitalsLine(parseVitals(draft.text)), [draft.text])
  const empty = draft.rx.length === 0 && draft.tests.length === 0

  const pick = (id: string) => {
    const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)]
    if (kind === 'rx') {
      // 用法はその行で選ぶので、入れたら処方ウインドウを開く
      dispatch({ type: 'addRx', drugId: key })
      onOpenRx()
    }
    if (kind === 'test') dispatch({ type: 'addTest', code: key })
    if (kind === 'set') dispatch({ type: 'applySet', setId: key })
  }

  // ファストカルテの RecordForm と同じ形：1つの枠の中に、上の道具の列・本文・オーダー。枠の下に「下書きは自動保存されます」
  const tool = 'h-7 shrink-0 inline-flex items-center gap-1 rounded border border-line bg-white px-2 text-xs shadow-sm hover:bg-gold-soft touch:h-9'
  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-3 pb-4 max-md:px-3">
      <div className="rounded-md border border-line bg-ivory">
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-cream/60 px-1.5 py-1">
          <button onClick={() => dispatch({ type: 'copyLastText' })} className={tool} title="前回の記載をコピー（⌘⇧D）">
            <Icon name="content_copy" size={15} />
            前回を複製
          </button>
          <button onClick={() => dispatch({ type: 'do' })} className={tool} title="前回と同じ処方（⌘D）">
            <Icon name="replay" size={15} />
            Do処方
          </button>
          <button onClick={onOpenRx} className={`${tool} max-md:hidden`} title="処方（⌘P）">
            <Icon name="medication" size={15} className="text-rx" />
            処方
          </button>
          <button onClick={() => onOpenTests()} className={`${tool} max-md:hidden`} title="血液検査（⌘E）">
            <Icon name="bloodtype" size={15} className="text-lab" />
            血液検査
          </button>
        </div>
        <textarea
          ref={textRef}
          value={draft.text}
          onChange={(e) => dispatch({ type: 'text', text: e.target.value })}
          placeholder={`ここに自由に記載（主訴・所見・評価・方針）\n${VITALS_HINT}`}
          className="block h-52 w-full resize-y bg-transparent px-3 py-2 text-[13px] leading-[1.8] outline-none placeholder:text-mist/60 max-md:h-40 max-md:text-base"
        />
        {detected && (
          <div className="flex items-center gap-1 px-3 pb-1.5 text-[11px] text-mist">
            <Icon name="monitor_heart" size={14} className="text-clinical" />
            読み取ったバイタル：<span className="font-num">{detected}</span>
          </div>
        )}

        <div className="space-y-2 border-t border-line bg-cream/30 px-2.5 py-2.5">
          <OrderSearch items={ORDER_ITEMS} inputRef={orderRef} placeholder="オーダーを追加（例：amlo、a1c、kaze）" onPick={pick} />
          {empty && <div className="px-1 text-xs text-mist">オーダーなし — 検索・Do処方・右のオーダーの列から追加</div>}
          {/* 処方は用法・日数が同じ薬を1つのRpにまとめて表示（富士通カルテと同じ並び）。直すときは処方ウインドウで */}
          {groupRp(draft.rx).map((g, gi) => (
            <div key={g[0].id} className="flex gap-2 rounded-md border border-line bg-ivory p-2 text-sm">
              <span className="h-fit w-9 shrink-0 rounded bg-rx-ctr py-0.5 text-center text-[11px] text-rx">Rp{gi + 1}</span>
              <div className="min-w-0 flex-1">
                {g.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <button onClick={onOpenRx} className="min-w-0 flex-1 truncate text-left font-medium hover:underline max-md:whitespace-normal" title="処方ウインドウで直す">
                      {r.name}
                    </button>
                    {r.noGeneric && <span className="pill whitespace-nowrap">後発変更不可</span>}
                    <span className="text-[13px] whitespace-nowrap text-rx font-num">{doseText(r)}</span>
                    <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50" aria-label="削除">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-4 pr-8 text-xs text-mist">
                  <span className={`flex-1 text-right ${isBlank(g[0]) ? 'font-medium text-error' : ''}`}>{usageLine(g[0])}</span>
                  <span className="w-14 text-right font-num">{daysText(g[0]) || g[0].site}</span>
                </div>
              </div>
            </div>
          ))}
          {draft.tests.map((t) => (
            <div key={t.id} className="rounded-md border border-line bg-ivory p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-9 shrink-0 rounded py-0.5 text-center text-[11px] ${ORDER_KINDS[kindOfTest(t.code)].tone}`}>{ORDER_KINDS[kindOfTest(t.code)].short}</span>
                <span className="flex-1 truncate font-medium">{t.name}</span>
                <button onClick={() => dispatch({ type: 'removeTest', id: t.id })} className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50" aria-label="削除">
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 px-0.5 text-[11px] text-mist">
        下書きは自動保存されます
        {(draft.text || !empty) && (
          <button onClick={() => dispatch({ type: 'discardDraft', patientId: patient.id })} className="text-clinical hover:underline">
            破棄
          </button>
        )}
      </div>

      <div className="mt-4">
        <DxStrip patient={patient} draft={draft} dispatch={dispatch} />
      </div>
    </div>
  )
}

// 過去の記録の訂正。記載・バイタルに加えて処方・検査も直せる（左の過去オーダーをダブルクリックすると処方・検査から開く）。
// 保存すると版が1つ上がり、元の記載・オーダーは履歴に残る
export function PastEditor({ encounter, focus, dispatch }: { encounter: Encounter; focus?: 'orders'; dispatch: (a: Action) => void }) {
  const [text, setText] = useState(encounter.text)
  const [rx, setRx] = useState(encounter.rx)
  const [tests, setTests] = useState(encounter.tests)
  const ref = useRef<HTMLTextAreaElement>(null)
  const ordersRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (focus === 'orders') ordersRef.current?.scrollIntoView({ block: 'start' })
    else ref.current?.focus()
  }, [focus])
  // 記載にバイタルが書かれていればそれを優先し、なければ元の値を残す
  const vitals = { ...encounter.vitals, ...parseVitals(text) }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pt-5 pb-3 max-md:px-4">
        <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="icon-btn" title="やめる（Esc）">
          <Icon name="arrow_back" />
        </button>
        <h2 className="flex-1 text-base font-semibold">
          {encounter.date} {encounter.kind} を訂正
        </h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-3 max-md:px-4">
        <div className="flex items-center gap-2 rounded-md bg-doc-ctr px-3 py-2 text-sm text-doc">
          <Icon name="history" size={18} />
          保存すると v{encounter.version + 1} になり、元の版は履歴に残ります
        </div>
        {vitalsLine(vitals) && <div className="text-xs tabular-nums text-ink-2">バイタル：{vitalsLine(vitals)}</div>}
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} className="field h-48 resize-y px-4 py-3 text-[15px] leading-relaxed" />

        <section ref={ordersRef} className="scroll-mt-2 space-y-2">
          <SectionTitle icon="assignment" label="この日のオーダー" tone="bg-surface-2 text-ink-2" />
          {rx.length === 0 && tests.length === 0 && <div className="rounded-md border border-dashed border-outline-var px-4 py-3 text-sm text-ink-2">オーダーなし</div>}
          {rx.map((r) => (
            <RxCard
              key={r.id}
              r={r}
              onChange={(patch) => setRx((cur) => cur.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))}
              onRemove={() => setRx((cur) => cur.filter((x) => x.id !== r.id))}
            />
          ))}
          {tests.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tests.map((t) => (
                <span key={t.id} className="flex h-8 items-center gap-1 rounded-lg bg-lab-ctr pr-1 pl-3 text-[13px] font-medium text-lab">
                  {t.name}
                  <button onClick={() => setTests((cur) => cur.filter((x) => x.id !== t.id))} className="icon-btn icon-btn-sm" aria-label={`${t.name}を外す`}>
                    <Icon name="close" size={16} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {encounter.history.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-2">過去の版（{encounter.history.length}）</summary>
            {encounter.history.map((h) => (
              <div key={h.version} className="mt-1.5 rounded-md bg-surface-1 p-3">
                <div className="text-xs text-ink-2">
                  v{h.version} · {new Date(h.savedAt).toLocaleString('ja-JP')}まで
                </div>
                <div className="text-xs tabular-nums">{vitalsLine(h.vitals)}</div>
                <div className="whitespace-pre-wrap">{h.text}</div>
                {h.rx?.map((r) => (
                  <div key={r.id} className="text-xs text-rx">
                    {rxLine(r)}
                  </div>
                ))}
                {!!h.tests?.length && <div className="text-xs text-lab">{h.tests.map((t) => t.name).join('、')}</div>}
              </div>
            ))}
          </details>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-2 px-6 py-3 max-md:px-4">
        <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="btn btn-text">
          やめる
        </button>
        <button onClick={() => dispatch({ type: 'savePast', encounterId: encounter.id, text, vitals, rx, tests })} className="btn btn-filled">
          <Icon name="save" size={20} />
          訂正を保存
        </button>
      </div>
    </div>
  )
}
