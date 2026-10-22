import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { rxLine } from './rxFormat'
import { diseaseLabel } from './orders'
import { ageSex, birthLabel } from './PatientIcon'
import { vitalsLine } from './LeftPane'
import type { Action } from './store'
import type { Draft, Patient } from './types'
import { parseVitals } from './vitals'

export function LetterEditor({ patient, draft, dispatch }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void }) {
  const toRef = useRef<HTMLInputElement>(null)
  useEffect(() => toRef.current?.focus(), [])
  const letter = draft.letter
  const latest = [...patient.encounters].sort((a, b) => b.date.localeCompare(a.date))[0]
  const rx = draft.rx.length ? draft.rx : (latest?.rx ?? [])
  const now = parseVitals(draft.text)
  const vitals = Object.keys(now).length ? now : (latest?.vitals ?? {})
  const diseases = patient.diseases.filter((d) => d.status === '継続')

  const set = (patch: Partial<NonNullable<Draft['letter']>>) => dispatch({ type: 'letter', patch })

  return (
    <div className="flex h-full flex-col">
      <div className="no-print flex items-center gap-3 px-6 pt-5 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-doc-ctr text-doc">
          <Icon name="forward_to_inbox" size={20} />
        </span>
        <h2 className="flex-1 text-[22px]">診療情報提供書（紹介状）</h2>
        <button
          onClick={() => {
            dispatch({ type: 'letter', patch: null })
            dispatch({ type: 'mode', mode: { kind: 'chart' } })
          }}
          className="btn btn-sm btn-danger"
        >
          <Icon name="delete" size={18} />
          破棄
        </button>
        <button onClick={() => window.print()} className="btn btn-sm btn-tonal">
          <Icon name="print" size={18} />
          印刷
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-5 text-sm">
        <label className="block">
          <span className="label">紹介先（医療機関・診療科・医師名）</span>
          <input ref={toRef} value={letter?.to ?? ''} onChange={(e) => set({ to: e.target.value })} placeholder="例：〇〇病院 循環器内科 〇〇先生" className="field mt-1" />
        </label>
        <div className="space-y-1 rounded-2xl bg-surface-1 p-4">
          <div>
            患者：{patient.name}（{patient.kana}） {ageSex(patient)} {birthLabel(patient.birth)}生
          </div>
          <div>傷病名：{diseases.map(diseaseLabel).join('、') || '—'}</div>
          <div>直近のバイタル：{vitalsLine(vitals) || '—'}</div>
          <div>
            現在の処方：
            {rx.length === 0
              ? '—'
              : rx.map((r) => (
                  <div key={r.id} className="pl-4">
                    {rxLine(r)}
                  </div>
                ))}
          </div>
          {patient.allergies.length > 0 && <div className="font-medium text-error">アレルギー：{patient.allergies.join('、')}</div>}
        </div>
        <label className="block">
          <span className="label">紹介目的</span>
          <input value={letter?.purpose ?? ''} onChange={(e) => set({ purpose: e.target.value })} placeholder="例：精査・加療のお願い" className="field mt-1" />
        </label>
        <label className="block">
          <span className="label">症状経過・検査結果・治療経過</span>
          <textarea value={letter?.body ?? ''} onChange={(e) => set({ body: e.target.value })} className="field mt-1 h-64 resize-y px-4 py-3 leading-relaxed" />
        </label>
        <div className="no-print flex items-center gap-1.5 text-xs text-ink-2">
          <Icon name="info" size={16} />
          左の記録の「引用」で本文に追加できます。確定（⌘Enter）すると今日のカルテに添付されます。
        </div>
      </div>
    </div>
  )
}
