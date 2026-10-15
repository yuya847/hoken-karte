import { useEffect, useRef, useState } from 'react'
import { vitalsLine } from './LeftPane'
import type { Action } from './store'
import type { Draft, Encounter, Patient, Vitals } from './types'

const VITAL_FIELDS: { key: keyof Vitals; label: string; w: string; step?: string }[] = [
  { key: 'sbp', label: '収縮期', w: 'w-16' },
  { key: 'dbp', label: '拡張期', w: 'w-16' },
  { key: 'hr', label: '脈拍', w: 'w-16' },
  { key: 'bt', label: '体温', w: 'w-16', step: '0.1' },
  { key: 'spo2', label: 'SpO2', w: 'w-16' },
  { key: 'bw', label: '体重', w: 'w-20', step: '0.1' },
]

function VitalsRow({ value, onChange, firstRef }: { value: Vitals; onChange: (p: Vitals) => void; firstRef?: React.Ref<HTMLInputElement> }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {VITAL_FIELDS.map((f, i) => (
        <label key={f.key} className="flex flex-col text-xs text-slate-500">
          {f.label}
          <input
            ref={i === 0 ? firstRef : undefined}
            inputMode="decimal"
            value={value[f.key] ?? ''}
            onChange={(e) => {
              const n = e.target.value === '' ? undefined : Number(e.target.value)
              onChange({ [f.key]: Number.isNaN(n) ? value[f.key] : n })
            }}
            className={`${f.w} rounded border border-slate-300 px-2 py-1 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100`}
          />
        </label>
      ))}
    </div>
  )
}

type ChartProps = {
  patient: Patient
  draft: Draft
  dispatch: (a: Action) => void
  openPalette: () => void
}

export function ChartEditor({ patient, draft, dispatch, openPalette }: ChartProps) {
  const firstRef = useRef<HTMLInputElement>(null)
  useEffect(() => firstRef.current?.focus(), [])
  const active = patient.diseases.filter((d) => d.status === '継続')

  return (
    <div className="flex h-full flex-col">
      <section className="space-y-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">今回の記載</h2>
          <div className="flex gap-1.5 text-xs">
            <button onClick={() => dispatch({ type: 'copyLastText' })} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
              前回記載コピー <kbd className="text-slate-400">⌘⇧D</kbd>
            </button>
          </div>
        </div>
        <VitalsRow value={draft.vitals} onChange={(patch) => dispatch({ type: 'vitals', patch })} firstRef={firstRef} />
        <textarea
          value={draft.text}
          onChange={(e) => dispatch({ type: 'text', text: e.target.value })}
          placeholder="自由記載（主訴・所見・評価・方針）"
          className="h-40 w-full resize-y rounded border border-slate-300 px-3 py-2 leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </section>

      <section className="flex-1 space-y-3 overflow-y-auto bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">オーダー</h2>
          <div className="flex gap-1.5 text-xs">
            <button onClick={() => dispatch({ type: 'do' })} className="rounded bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-700">
              Do処方 <kbd className="opacity-70">⌘D</kbd>
            </button>
            <button onClick={openPalette} className="rounded border border-slate-300 px-2.5 py-1 hover:bg-slate-50">
              薬・検査・病名を追加 <kbd className="text-slate-400">⌘K</kbd>
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-emerald-700">処方（院外）</div>
          {draft.rx.length === 0 && <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">処方なし</div>}
          <div className="space-y-1">
            {draft.rx.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded bg-emerald-50 px-2 py-1.5 text-sm">
                <span className="flex-1 truncate">{r.name}</span>
                <input
                  value={r.dose}
                  onChange={(e) => dispatch({ type: 'updateRx', id: r.id, patch: { dose: Number(e.target.value) || 0 } })}
                  className="w-12 rounded border border-slate-300 px-1 text-right font-mono"
                />
                <span className="text-xs">{r.unit}</span>
                <input
                  value={r.usage}
                  onChange={(e) => dispatch({ type: 'updateRx', id: r.id, patch: { usage: e.target.value } })}
                  className="w-36 rounded border border-slate-300 px-1"
                />
                <input
                  value={r.days}
                  onChange={(e) => dispatch({ type: 'updateRx', id: r.id, patch: { days: Number(e.target.value) || 0 } })}
                  className="w-12 rounded border border-slate-300 px-1 text-right font-mono"
                />
                <span className="text-xs">日</span>
                <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="px-1 text-slate-400 hover:text-red-600" aria-label="削除">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-violet-700">検査</div>
          {draft.tests.length === 0 && <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">検査なし</div>}
          <div className="flex flex-wrap gap-1.5">
            {draft.tests.map((t) => (
              <span key={t.id} className="flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-sm">
                {t.name}
                <button onClick={() => dispatch({ type: 'removeTest', id: t.id })} className="text-slate-400 hover:text-red-600" aria-label="削除">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-blue-700">病名</div>
          <div className="space-y-1">
            {patient.diseases.map((d) => (
              <div key={d.id} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${d.status === '継続' ? 'bg-blue-50' : 'bg-slate-50 text-slate-400'}`}>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={d.main}
                    onChange={(e) => dispatch({ type: 'updateDisease', id: d.id, patch: { main: e.target.checked } })}
                  />
                  主
                </label>
                <span className="flex-1">{d.name}</span>
                <span className="text-xs text-slate-500">{d.start}〜</span>
                <select
                  value={d.status}
                  onChange={(e) => dispatch({ type: 'updateDisease', id: d.id, patch: { status: e.target.value as typeof d.status } })}
                  className="rounded border border-slate-300 bg-white px-1 text-xs"
                >
                  <option>継続</option>
                  <option>治癒</option>
                  <option>中止</option>
                </select>
              </div>
            ))}
            {active.length === 0 && <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">継続中の病名なし</div>}
          </div>
        </div>
      </section>
    </div>
  )
}

export function PastEditor({ encounter, dispatch }: { encounter: Encounter; dispatch: (a: Action) => void }) {
  const [text, setText] = useState(encounter.text)
  const [vitals, setVitals] = useState<Vitals>(encounter.vitals)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])

  return (
    <div className="flex h-full flex-col gap-3 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">
          {encounter.date} {encounter.kind} の記載を訂正
        </h2>
        <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">保存すると v{encounter.version + 1}（元の版は履歴に残ります）</span>
      </div>
      <VitalsRow value={vitals} onChange={(p) => setVitals((v) => ({ ...v, ...p }))} />
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-48 flex-1 resize-none rounded border border-slate-300 px-3 py-2 leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {encounter.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">過去の版（{encounter.history.length}）</summary>
          {encounter.history.map((h) => (
            <div key={h.version} className="mt-1 rounded bg-slate-50 p-2">
              <div className="text-xs text-slate-500">
                v{h.version} · {new Date(h.savedAt).toLocaleString('ja-JP')}まで
              </div>
              <div className="font-mono text-xs">{vitalsLine(h.vitals)}</div>
              <div className="whitespace-pre-wrap">{h.text}</div>
            </div>
          ))}
        </details>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          やめる <kbd className="text-slate-400">Esc</kbd>
        </button>
        <button
          onClick={() => dispatch({ type: 'savePast', encounterId: encounter.id, text, vitals })}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          訂正を保存
        </button>
      </div>
    </div>
  )
}
