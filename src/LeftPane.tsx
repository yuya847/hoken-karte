import { useState } from 'react'
import { Icon } from './Icon'
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
      <div className="space-y-3 px-5 pt-4 pb-3">
        {patient.allergies.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-error-ctr px-3 py-2 text-sm font-medium text-error">
            <Icon name="warning" fill size={20} />
            アレルギー：{patient.allergies.join('、')}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label mr-1">病名</span>
          {active.length === 0 && <span className="text-sm text-ink-2">なし</span>}
          {active.map((d) => (
            <span key={d.id} className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[13px] ${d.main ? 'bg-dx-ctr font-medium text-dx' : 'bg-surface-1 text-ink-2'}`}>
              {d.main && <Icon name="star" fill size={14} />}
              {d.name}
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? 'chip-on' : ''}`}>
              {filter === f && <Icon name="check" size={16} />}
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-ink-2">
            <Icon name="person_add" size={40} className="text-outline" />
            過去の記録はありません（初診）
          </div>
        )}
        {list.map((e) => {
          const showText = filter === '全て' || filter === '記載'
          const showRx = (filter === '全て' || filter === '処方') && e.rx.length > 0
          const showTests = (filter === '全て' || filter === '検査') && e.tests.length > 0
          const showDocs = (filter === '全て' || filter === '文書') && e.letters.length > 0
          if (!showText && !showRx && !showTests && !showDocs) return null
          return (
            <div
              key={e.id}
              className={`group rounded-2xl p-4 transition-colors ${selectedId === e.id ? 'bg-primary-ctr/60 ring-2 ring-primary' : 'bg-surface-1 hover:bg-surface-2'}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium">{e.date}</span>
                <span className="text-xs text-ink-2">{e.kind}</span>
                {e.version > 1 && <span className="rounded-md bg-doc-ctr px-1.5 text-[11px] font-medium text-doc">訂正 v{e.version}</span>}
                <span className="flex-1" />
                <div className="flex gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                  {e.rx.length > 0 && (
                    <button onClick={() => onDo(e.id)} className="btn btn-sm btn-text px-2.5" title="この処方をDo">
                      <Icon name="replay" size={18} />
                      Do
                    </button>
                  )}
                  <button onClick={() => onQuote(encounterSummary(e))} className="icon-btn icon-btn-sm" title="引用">
                    <Icon name="format_quote" size={18} />
                  </button>
                  <button onClick={() => onEdit(e.id)} className="icon-btn icon-btn-sm" title="編集（訂正）">
                    <Icon name="edit" size={18} />
                  </button>
                </div>
              </div>
              {showText && (
                <>
                  {vitalsLine(e.vitals) && <div className="mb-1 text-xs tabular-nums text-ink-2">{vitalsLine(e.vitals)}</div>}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{e.text || <span className="text-ink-2">（記載なし）</span>}</div>
                </>
              )}
              {showRx && (
                <div className="mt-2.5 rounded-xl bg-white px-3 py-2 text-sm">
                  <div className="mb-0.5 flex items-center gap-1 text-xs font-medium text-rx">
                    <Icon name="medication" size={16} />
                    処方
                  </div>
                  {e.rx.map((r) => (
                    <div key={r.id}>
                      {r.name} {r.dose}
                      {r.unit} {r.usage} {r.days}日
                    </div>
                  ))}
                </div>
              )}
              {showTests && (
                <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm">
                  <Icon name="biotech" size={16} className="text-lab" />
                  {e.tests.map((t) => t.name).join('、')}
                </div>
              )}
              {showDocs &&
                e.letters.map((l) => (
                  <div key={l.id} className="mt-2 flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm">
                    <Icon name="description" size={16} className="text-doc" />
                    {l.title}（{l.to || '宛先未記入'}）
                  </div>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
