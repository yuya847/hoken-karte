import { useEffect, useRef } from 'react'
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
    <div className="flex h-full flex-col bg-white">
      <div className="no-print flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h2 className="font-semibold">診療情報提供書（紹介状）</h2>
        <div className="flex gap-1.5 text-xs">
          <span className="self-center text-slate-500">左の記録の「引用」で本文に追加</span>
          <button onClick={() => window.print()} className="rounded border border-slate-300 px-2.5 py-1 hover:bg-slate-50">
            印刷
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'letter', patch: null })
              dispatch({ type: 'mode', mode: { kind: 'chart' } })
            }}
            className="rounded border border-slate-300 px-2.5 py-1 text-red-600 hover:bg-red-50"
          >
            破棄
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        <label className="block">
          <span className="text-xs text-slate-500">紹介先（医療機関・診療科・医師名）</span>
          <input
            ref={toRef}
            value={letter?.to ?? ''}
            onChange={(e) => set({ to: e.target.value })}
            placeholder="例：〇〇病院 循環器内科 〇〇先生"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
          />
        </label>
        <div className="rounded bg-slate-50 p-3">
          <div>
            患者：{patient.name}（{patient.kana}） {ageSex(patient)} {birthLabel(patient.birth)}生
          </div>
          <div className="mt-1">傷病名：{diseases.map((d) => d.name).join('、') || '—'}</div>
          <div className="mt-1">直近のバイタル：{vitalsLine(vitals) || '—'}</div>
          <div className="mt-1">
            現在の処方：
            {rx.length === 0
              ? '—'
              : rx.map((r) => (
                  <div key={r.id} className="pl-4">
                    {r.name} {r.dose}
                    {r.unit} {r.usage} {r.days}日
                  </div>
                ))}
          </div>
          {patient.allergies.length > 0 && <div className="mt-1 text-red-700">アレルギー：{patient.allergies.join('、')}</div>}
        </div>
        <label className="block">
          <span className="text-xs text-slate-500">紹介目的</span>
          <input
            value={letter?.purpose ?? ''}
            onChange={(e) => set({ purpose: e.target.value })}
            placeholder="例：精査・加療のお願い"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">症状経過・検査結果・治療経過</span>
          <textarea
            value={letter?.body ?? ''}
            onChange={(e) => set({ body: e.target.value })}
            className="mt-0.5 h-64 w-full resize-y rounded border border-slate-300 px-3 py-2 leading-relaxed outline-none focus:border-blue-500"
          />
        </label>
        <div className="text-xs text-slate-500">確定（⌘Enter）すると今日のカルテに添付されます。</div>
      </div>
    </div>
  )
}
