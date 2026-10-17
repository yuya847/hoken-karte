import { useEffect, useMemo, useRef, useState } from 'react'
import { DISEASES, DRUGS, SETS, TESTS } from './data'
import { vitalsLine } from './LeftPane'
import { Icon } from './Icon'
import { diseaseLabel, linkedDiseases, suggestions, type OrderRef } from './orders'
import { OrderSearch, type SearchItem } from './OrderSearch'
import type { Action } from './store'
import type { Draft, Encounter, Patient } from './types'
import { parseVitals } from './vitals'

export type FocusReq = { target: 'order' | 'disease'; n: number } | null

// 処方・検査・病名・セットをひとつの検索欄で引く
const ORDER_ITEMS: SearchItem[] = [
  ...SETS.map((x) => ({ id: `set:${x.id}`, label: x.name, keys: `${x.kana} ${x.alias}`, icon: 'playlist_add', iconClass: 'text-primary', tag: 'セット' })),
  ...DRUGS.map((d) => ({ id: `rx:${d.id}`, label: d.name, sub: `${d.dose}${d.unit} ${d.usage} ${d.days}日`, keys: `${d.kana} ${d.alias}`, icon: 'medication', iconClass: 'text-rx', tag: '処方' })),
  ...TESTS.map((t) => ({ id: `test:${t.code}`, label: t.name, keys: `${t.kana} ${t.alias}`, icon: 'biotech', iconClass: 'text-lab', tag: '検査' })),
  ...DISEASES.map((x) => ({ id: `dx:${x.name}`, label: x.name, keys: `${x.kana} ${x.alias}`, icon: 'diagnosis', iconClass: 'text-dx', tag: '病名' })),
]

const VITALS_HINT = 'BP 128/78　HR 72　BT 36.5　SpO2 98　BW 62.4 のように書くとバイタルとして読み取ります'

type ChartProps = {
  patient: Patient
  draft: Draft
  dispatch: (a: Action) => void
  focusReq: FocusReq
}

function SectionTitle({ icon, label, tone, children }: { icon: string; label: string; tone: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1 text-base font-medium">{label}</span>
      {children}
    </div>
  )
}

// オーダーに紐付いた病名。なければ警告と追加候補を出す
export function DiseaseLink({ patient, order, dispatch }: { patient: Patient; order: OrderRef; dispatch: (a: Action) => void }) {
  const linked = linkedDiseases(patient, order)
  if (linked.length > 0)
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs text-dx">
        <Icon name="link" size={16} />
        {linked.map((d) => (
          <span key={d.id} className="rounded-md bg-white/80 px-1.5 py-0.5">
            {diseaseLabel(d)}
          </span>
        ))}
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="flex items-center gap-1 rounded-md bg-error-ctr px-1.5 py-0.5 font-medium text-error">
        <Icon name="link_off" size={16} />
        適応病名なし
      </span>
      {suggestions(order).map((sg) => (
        <button
          key={sg.name}
          onClick={() => dispatch({ type: 'addDisease', name: sg.name, suspected: sg.suspected })}
          className="flex items-center gap-0.5 rounded-md border border-outline-var bg-white px-1.5 py-0.5 text-ink-2 hover:border-primary hover:text-primary"
        >
          <Icon name="add" size={14} />
          {diseaseLabel(sg)}
        </button>
      ))}
    </div>
  )
}

export function ChartEditor({ patient, draft, dispatch, focusReq }: ChartProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const orderRef = useRef<HTMLInputElement>(null)
  const diseaseRef = useRef<HTMLDivElement>(null)
  useEffect(() => textRef.current?.focus(), [])
  useEffect(() => {
    if (!focusReq) return
    if (focusReq.target === 'disease') diseaseRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    else orderRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    orderRef.current?.focus({ preventScroll: true })
  }, [focusReq])

  const active = patient.diseases.filter((d) => d.status === '継続')
  const detected = useMemo(() => vitalsLine(parseVitals(draft.text)), [draft.text])
  const empty = draft.rx.length === 0 && draft.tests.length === 0

  const pick = (id: string) => {
    const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)]
    if (kind === 'rx') dispatch({ type: 'addRx', drugId: key })
    if (kind === 'test') dispatch({ type: 'addTest', code: key })
    if (kind === 'dx') dispatch({ type: 'addDisease', name: key })
    if (kind === 'set') dispatch({ type: 'applySet', setId: key })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <section className="px-6 pt-5 pb-4">
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
          className="field h-48 resize-y px-4 py-3 text-[15px] leading-relaxed"
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

      <div className="mx-6 border-t border-surface-2" />

      <section className="px-6 py-5">
        <SectionTitle icon="assignment" label="オーダー" tone="bg-surface-2 text-ink-2">
          <button onClick={() => dispatch({ type: 'do' })} className="btn btn-sm btn-tonal">
            <Icon name="replay" size={18} />
            Do処方 <span className="kbd">⌘D</span>
          </button>
          <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'tests' } })} className="btn btn-sm btn-tonal">
            <Icon name="checklist" size={18} />
            検査を選ぶ
          </button>
        </SectionTitle>
        <OrderSearch items={ORDER_ITEMS} inputRef={orderRef} placeholder="処方・検査・病名・セットを検索（例：amlo、a1c、こうけつ、kaze）⌘P" onPick={pick} />

        <div className="mt-3 space-y-1.5">
          {empty && (
            <div className="rounded-xl border border-dashed border-outline-var px-4 py-3 text-sm text-ink-2">
              オーダーなし — 上の検索欄、Do処方、検査を選ぶ から追加
            </div>
          )}
          {draft.rx.map((r) => (
            <div key={r.id} className="rounded-xl bg-rx-ctr/70 py-1.5 pr-1.5 pl-3 text-sm">
              <div className="flex items-center gap-2">
                <Icon name="medication" size={18} className="text-rx" />
                <span className="flex-1 truncate font-medium">{r.name}</span>
                <input
                  value={r.dose}
                  onChange={(e) => dispatch({ type: 'updateRx', id: r.id, patch: { dose: Number(e.target.value) || 0 } })}
                  className="field field-sm w-12 text-right tabular-nums"
                />
                <span className="text-xs text-ink-2">{r.unit}</span>
                <input value={r.usage} onChange={(e) => dispatch({ type: 'updateRx', id: r.id, patch: { usage: e.target.value } })} className="field field-sm w-36" />
                <input
                  value={r.days}
                  onChange={(e) => dispatch({ type: 'updateRx', id: r.id, patch: { days: Number(e.target.value) || 0 } })}
                  className="field field-sm w-12 text-right tabular-nums"
                />
                <span className="text-xs text-ink-2">日</span>
                <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="icon-btn icon-btn-sm" aria-label="削除">
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className="mt-1 pl-7">
                <DiseaseLink patient={patient} order={{ kind: 'rx', item: r }} dispatch={dispatch} />
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
              <div className="mt-0.5 mb-0.5 pl-7">
                <DiseaseLink patient={patient} order={{ kind: 'test', item: t }} dispatch={dispatch} />
              </div>
            </div>
          ))}
        </div>

        <div ref={diseaseRef} className="mt-5">
          <div className="label mb-1.5 flex items-center gap-1">
            <Icon name="diagnosis" size={16} className="text-dx" />
            病名
          </div>
          <div className="space-y-1">
            {patient.diseases.map((d) => (
              <div key={d.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 text-sm ${d.status === '継続' ? 'bg-dx-ctr/70' : 'bg-surface-1 text-ink-2'}`}>
                <button
                  onClick={() => dispatch({ type: 'updateDisease', id: d.id, patch: { main: !d.main } })}
                  className={`icon-btn icon-btn-sm ${d.main ? 'text-primary' : 'text-outline'}`}
                  title={d.main ? '主病名' : '主病名にする'}
                >
                  <Icon name="star" fill={d.main} size={20} />
                </button>
                <span className="flex-1">{diseaseLabel(d)}</span>
                <button
                  onClick={() => dispatch({ type: 'updateDisease', id: d.id, patch: { suspected: !d.suspected } })}
                  className={`chip h-6 px-2 text-xs ${d.suspected ? 'chip-on' : ''}`}
                  title="疑い病名の切り替え"
                >
                  疑い
                </button>
                <span className="text-xs text-ink-2">{d.start}〜</span>
                <select
                  value={d.status}
                  onChange={(e) => dispatch({ type: 'updateDisease', id: d.id, patch: { status: e.target.value as typeof d.status } })}
                  className="field field-sm w-auto rounded-lg text-xs"
                >
                  <option>継続</option>
                  <option>治癒</option>
                  <option>中止</option>
                </select>
              </div>
            ))}
            {active.length === 0 && <div className="text-sm text-ink-2">継続中の病名なし（検索欄から追加）</div>}
          </div>
        </div>
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
