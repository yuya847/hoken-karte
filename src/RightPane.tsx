import { useEffect, useMemo, useRef, useState } from 'react'
import { DRUGS, SETS, TESTS } from './data'
import { vitalsLine } from './LeftPane'
import { Icon } from './Icon'
import { daysText, doseText, groupRp, usageText } from './rxFormat'
import { DxStrip } from './DiseasePanel'
import { OrderSearch, type SearchItem } from './OrderSearch'
import type { Action } from './store'
import type { Draft, Encounter, Patient } from './types'
import { parseVitals } from './vitals'

// 処方・検査・セットをひとつの検索欄で引く。病名はオーダーから自動で付くのでここには出さない
const ORDER_ITEMS: SearchItem[] = [
  ...SETS.map((x) => ({ id: `set:${x.id}`, label: x.name, keys: `${x.kana} ${x.alias}`, icon: 'playlist_add', iconClass: 'text-primary', tag: 'セット' })),
  ...DRUGS.map((d) => ({ id: `rx:${d.id}`, label: d.name, sub: `${doseText(d)} ${usageText(d.usage)} ${daysText(d)}`, keys: `${d.kana} ${d.alias}`, icon: 'medication', iconClass: 'text-rx', tag: '処方' })),
  ...TESTS.map((t) => ({ id: `test:${t.code}`, label: t.name, keys: `${t.kana} ${t.alias}`, icon: 'biotech', iconClass: 'text-lab', tag: '検査' })),
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
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1 text-base font-medium whitespace-nowrap">{label}</span>
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
    if (kind === 'rx') dispatch({ type: 'addRx', drugId: key })
    if (kind === 'test') dispatch({ type: 'addTest', code: key })
    if (kind === 'set') dispatch({ type: 'applySet', setId: key })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <section className="px-6 pt-5 pb-4 max-md:px-4 max-md:pt-4">
        <SectionTitle icon="edit_note" label="今回の記載" tone="bg-primary-ctr text-on-primary-ctr">
          <button onClick={() => dispatch({ type: 'copyLastText' })} className="btn btn-sm btn-text">
            <Icon name="content_copy" size={18} />
            前回記載コピー <span className="kbd">⌘⇧D</span>
          </button>
        </SectionTitle>
        <textarea
          ref={textRef}
          value={draft.text}
          onChange={(e) => dispatch({ type: 'text', text: e.target.value })}
          placeholder={`自由記載（主訴・所見・評価・方針）\n${VITALS_HINT}`}
          className="field h-48 resize-y px-4 py-3 text-[15px] leading-relaxed max-md:h-40"
        />
        <div className="mt-1.5 flex min-h-5 items-center gap-1 text-xs text-ink-2">
          {detected && (
            <>
              <Icon name="monitor_heart" size={16} className="text-primary" />
              読み取ったバイタル：<span className="tabular-nums">{detected}</span>
            </>
          )}
        </div>
      </section>

      <div className="mx-6 border-t border-surface-2 max-md:mx-4" />

      <section className="px-6 py-5 max-md:px-4">
        <SectionTitle icon="assignment" label="オーダー" tone="bg-surface-2 text-ink-2">
          <button onClick={onOpenRx} className="btn btn-sm btn-tonal max-md:hidden">
            <Icon name="medication" size={18} />
            処方 <span className="kbd">⌘P</span>
          </button>
          <button onClick={() => dispatch({ type: 'do' })} className="btn btn-sm btn-tonal">
            <Icon name="replay" size={18} />
            Do処方 <span className="kbd">⌘D</span>
          </button>
          <button onClick={onOpenTests} className="btn btn-sm btn-tonal max-md:hidden">
            <Icon name="biotech" size={18} />
            検査 <span className="kbd">⌘E</span>
          </button>
        </SectionTitle>
        <OrderSearch items={ORDER_ITEMS} inputRef={orderRef} placeholder="処方・検査・セットを検索（例：amlo、a1c、kaze）" onPick={pick} />

        <div className="mt-3 space-y-1.5">
          {empty && (
            <div className="rounded-xl border border-dashed border-outline-var px-4 py-3 text-sm text-ink-2">
              オーダーなし — 上の検索欄、Do処方、検査 から追加
            </div>
          )}
          {/* 処方は用法・日数が同じ薬を1つのRpにまとめて表示（富士通カルテと同じ並び）。直すときは処方ウインドウで */}
          {groupRp(draft.rx).map((g, gi) => (
            <div key={g[0].id} className="flex gap-2 rounded-xl bg-rx-ctr/70 py-1.5 pr-1.5 pl-3 text-sm">
              <span className="w-8 shrink-0 pt-1.5 text-xs font-medium text-rx">Rp{gi + 1}</span>
              <div className="min-w-0 flex-1">
                {g.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <button onClick={onOpenRx} className="min-w-0 flex-1 truncate py-1 text-left font-medium hover:underline max-md:whitespace-normal" title="処方ウインドウで直す">
                      {r.name}
                    </button>
                    {r.noGeneric && <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] whitespace-nowrap text-ink-2">後発変更不可</span>}
                    <span className="text-[13px] whitespace-nowrap text-rx tabular-nums">{doseText(r)}</span>
                    <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="icon-btn icon-btn-sm" aria-label="削除">
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-4 pr-10 pb-0.5 text-[13px] text-ink-2">
                  <span className="flex-1 text-right">{usageText(g[0].usage)}</span>
                  <span className="w-14 text-right tabular-nums">{daysText(g[0])}</span>
                </div>
              </div>
            </div>
          ))}
          {draft.tests.map((t) => (
            <div key={t.id} className="rounded-xl bg-lab-ctr/70 py-1.5 pr-1.5 pl-3 text-sm">
              <div className="flex items-center gap-2">
                <Icon name="biotech" size={18} className="text-lab" />
                <span className="flex-1 truncate font-medium">{t.name}</span>
                <button onClick={() => dispatch({ type: 'removeTest', id: t.id })} className="icon-btn icon-btn-sm" aria-label="削除">
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <DxStrip patient={patient} draft={draft} dispatch={dispatch} />
      </section>
    </div>
  )
}

export function PastEditor({ encounter, dispatch }: { encounter: Encounter; dispatch: (a: Action) => void }) {
  const [text, setText] = useState(encounter.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  // 記載にバイタルが書かれていればそれを優先し、なければ元の値を残す
  const vitals = { ...encounter.vitals, ...parseVitals(text) }

  return (
    <div className="flex h-full flex-col gap-3 px-6 py-5">
      <div className="flex items-center gap-3">
        <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="icon-btn" title="やめる（Esc）">
          <Icon name="arrow_back" />
        </button>
        <h2 className="text-[22px]">
          {encounter.date} {encounter.kind} の記載を訂正
        </h2>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-doc-ctr px-3 py-2 text-sm text-doc">
        <Icon name="history" size={18} />
        保存すると v{encounter.version + 1} になり、元の版は履歴に残ります
      </div>
      {vitalsLine(vitals) && <div className="text-xs tabular-nums text-ink-2">バイタル：{vitalsLine(vitals)}</div>}
      <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} className="field min-h-48 flex-1 resize-none px-4 py-3 text-[15px] leading-relaxed" />
      {encounter.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-2">過去の版（{encounter.history.length}）</summary>
          {encounter.history.map((h) => (
            <div key={h.version} className="mt-1.5 rounded-xl bg-surface-1 p-3">
              <div className="text-xs text-ink-2">
                v{h.version} · {new Date(h.savedAt).toLocaleString('ja-JP')}まで
              </div>
              <div className="text-xs tabular-nums">{vitalsLine(h.vitals)}</div>
              <div className="whitespace-pre-wrap">{h.text}</div>
            </div>
          ))}
        </details>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="btn btn-text">
          やめる
        </button>
        <button onClick={() => dispatch({ type: 'savePast', encounterId: encounter.id, text, vitals })} className="btn btn-filled">
          <Icon name="save" size={20} />
          訂正を保存
        </button>
      </div>
    </div>
  )
}
