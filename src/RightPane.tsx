import { useEffect, useMemo, useRef, useState } from 'react'
import { DISEASES, DRUGS, TESTS } from './data'
import { vitalsLine } from './LeftPane'
import { Icon } from './Icon'
import { OrderSearch, type SearchItem } from './OrderSearch'
import type { Action } from './store'
import type { Draft, Encounter, Patient } from './types'
import { parseVitals } from './vitals'

export type FocusReq = { target: 'rx' | 'test' | 'disease'; n: number } | null

const DRUG_ITEMS: SearchItem[] = DRUGS.map((d) => ({ id: d.id, label: d.name, sub: `${d.dose}${d.unit} ${d.usage} ${d.days}日`, keys: `${d.kana} ${d.alias}` }))
const TEST_ITEMS: SearchItem[] = TESTS.map((t) => ({ id: t.code, label: t.name, keys: `${t.kana} ${t.alias}` }))
const DISEASE_ITEMS: SearchItem[] = DISEASES.map((x) => ({ id: x.name, label: x.name, keys: `${x.kana} ${x.alias}` }))

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

export function ChartEditor({ patient, draft, dispatch, focusReq }: ChartProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const rxRef = useRef<HTMLInputElement>(null)
  const testRef = useRef<HTMLInputElement>(null)
  const diseaseRef = useRef<HTMLInputElement>(null)
  useEffect(() => textRef.current?.focus(), [])
  useEffect(() => {
    if (!focusReq) return
    const el = { rx: rxRef, test: testRef, disease: diseaseRef }[focusReq.target].current
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus()
  }, [focusReq])

  const active = patient.diseases.filter((d) => d.status === '継続')
  const detected = useMemo(() => vitalsLine(parseVitals(draft.text)), [draft.text])

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

      <section className="space-y-6 px-6 py-5">
        <div>
          <SectionTitle icon="medication" label="処方（院外）" tone="bg-rx-ctr text-rx">
            <span className="kbd text-ink-2">⌘P</span>
            <button onClick={() => dispatch({ type: 'do' })} className="btn btn-sm btn-tonal">
              <Icon name="replay" size={18} />
              Do処方 <span className="kbd">⌘D</span>
            </button>
          </SectionTitle>
          <OrderSearch items={DRUG_ITEMS} inputRef={rxRef} icon="search" placeholder="処方を検索（例：あむろ、amlo、ロキソ）→ Enterで追加" onPick={(id) => dispatch({ type: 'addRx', drugId: id })} />
          <div className="mt-2 space-y-1.5">
            {draft.rx.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl bg-rx-ctr/70 py-1.5 pr-1.5 pl-3 text-sm">
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
            ))}
          </div>
        </div>

        <div>
          <SectionTitle icon="biotech" label="検査" tone="bg-lab-ctr text-lab">
            <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'tests' } })} className="btn btn-sm btn-tonal">
              <Icon name="checklist" size={18} />
              項目から選ぶ
            </button>
          </SectionTitle>
          <OrderSearch items={TEST_ITEMS} inputRef={testRef} icon="search" placeholder="検査を検索（例：a1c、けっさん、ecg）" onPick={(code) => dispatch({ type: 'addTest', code })} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.tests.map((t) => (
              <span key={t.id} className="inline-flex h-8 items-center gap-1 rounded-lg bg-lab-ctr pr-1 pl-3 text-[13px] font-medium text-lab">
                {t.name}
                <button onClick={() => dispatch({ type: 'removeTest', id: t.id })} className="icon-btn h-6 w-6 text-lab" aria-label="削除">
                  <Icon name="close" size={16} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle icon="diagnosis" label="病名" tone="bg-dx-ctr text-dx" />
          <OrderSearch items={DISEASE_ITEMS} inputRef={diseaseRef} icon="search" placeholder="病名を検索（例：こうけつ、dm）" onPick={(name) => dispatch({ type: 'addDisease', name })} />
          <div className="mt-2 space-y-1">
            {patient.diseases.map((d) => (
              <div key={d.id} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm ${d.status === '継続' ? 'bg-dx-ctr/70' : 'bg-surface-1 text-ink-2'}`}>
                <button
                  onClick={() => dispatch({ type: 'updateDisease', id: d.id, patch: { main: !d.main } })}
                  className={`icon-btn icon-btn-sm ${d.main ? 'text-primary' : 'text-outline'}`}
                  title={d.main ? '主病名' : '主病名にする'}
                >
                  <Icon name="star" fill={d.main} size={20} />
                </button>
                <span className="flex-1">{d.name}</span>
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
            {active.length === 0 && <div className="text-sm text-ink-2">継続中の病名なし</div>}
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
