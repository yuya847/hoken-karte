import { useState } from 'react'
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
    e.rx.length ? `処方：${e.rx.map((r) => `${r.name} ${r.dose}${r.unit} ${r.usage} ${r.days}日`).join('、')}` : '',
    e.tests.length ? `検査：${e.tests.map((t) => t.name).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

type Props = {
  patient: Patient
  selectedId: string | null
  onDo: (encounterId: string) => void
  onQuote: (text: string) => void
  onEdit: (encounterId: string) => void
}

export function LeftPane({ patient, selectedId, onDo, onQuote, onEdit }: Props) {
  const [filter, setFilter] = useState<Filter>('全て')
  const list = [...patient.encounters].sort((a, b) => b.date.localeCompare(a.date))
  const active = patient.diseases.filter((d) => d.status === '継続')

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-slate-200 bg-white px-4 py-3">
        {patient.allergies.length > 0 && (
          <div className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">アレルギー：{patient.allergies.join('、')}</div>
        )}
        <div className="flex flex-wrap gap-1.5 text-sm">
          <span className="text-slate-500">病名</span>
          {active.length === 0 && <span className="text-slate-400">なし</span>}
          {active.map((d) => (
            <span key={d.id} className={`rounded px-2 py-0.5 ${d.main ? 'bg-blue-100 text-blue-800' : 'bg-slate-100'}`}>
              {d.main && '主 '}
              {d.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2.5 py-1 text-sm ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {list.length === 0 && <div className="py-10 text-center text-slate-400">過去の記録はありません（初診）</div>}
        {list.map((e) => {
          const showText = filter === '全て' || filter === '記載'
          const showRx = (filter === '全て' || filter === '処方') && e.rx.length > 0
          const showTests = (filter === '全て' || filter === '検査') && e.tests.length > 0
          const showDocs = (filter === '全て' || filter === '文書') && e.letters.length > 0
          if (!showText && !showRx && !showTests && !showDocs) return null
          return (
            <div
              key={e.id}
              className={`group rounded-lg border bg-white p-3 ${selectedId === e.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-semibold">{e.date}</span>
                <span className="text-xs text-slate-500">{e.kind}</span>
                {e.version > 1 && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">訂正 v{e.version}</span>}
                <span className="flex-1" />
                <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                  {e.rx.length > 0 && (
                    <button onClick={() => onDo(e.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-blue-50">
                      この処方をDo
                    </button>
                  )}
                  <button onClick={() => onQuote(encounterSummary(e))} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-blue-50">
                    引用
                  </button>
                  <button onClick={() => onEdit(e.id)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-blue-50">
                    編集
                  </button>
                </div>
              </div>
              {showText && (
                <>
                  {vitalsLine(e.vitals) && <div className="mb-1 font-mono text-xs text-slate-600">{vitalsLine(e.vitals)}</div>}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{e.text || <span className="text-slate-400">（記載なし）</span>}</div>
                </>
              )}
              {showRx && (
                <div className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-sm">
                  {e.rx.map((r) => (
                    <div key={r.id}>
                      Rp {r.name} {r.dose}
                      {r.unit} {r.usage} {r.days}日
                    </div>
                  ))}
                </div>
              )}
              {showTests && <div className="mt-2 rounded bg-violet-50 px-2 py-1.5 text-sm">検査：{e.tests.map((t) => t.name).join('、')}</div>}
              {showDocs &&
                e.letters.map((l) => (
                  <div key={l.id} className="mt-2 rounded bg-orange-50 px-2 py-1.5 text-sm">
                    文書：{l.title}（{l.to || '宛先未記入'}）
                  </div>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
