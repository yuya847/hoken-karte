import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { DAY_PRESETS, DRUG_CLASS, DRUG_CLASSES, DRUGS, USAGES } from './data'
import { Icon } from './Icon'
import type { Action } from './store'
import type { Draft, Patient, RxItem } from './types'

type Filter = 'all' | 'history' | (typeof DRUG_CLASSES)[number]

// 処方ウインドウ。左で薬を検索・分類から選び、右で今回の処方の量・用法・日数を整える。
// 押した時点で今回の処方に入る（確定ボタンを挟まない）。
export function RxWindow({ patient, draft, dispatch, onClose }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const history = useMemo(() => new Set(patient.encounters.flatMap((e) => e.rx.map((r) => r.drugId))), [patient])
  const inDraft = new Map(draft.rx.map((r) => [r.drugId, r]))
  const hasPast = patient.encounters.some((e) => e.rx.length > 0)

  const visible = useMemo(() => {
    const terms = toHira(q.trim().toLowerCase()).split(/\s+/).filter(Boolean)
    return DRUGS.filter(
      (d) =>
        (filter === 'all' || (filter === 'history' ? history.has(d.id) : DRUG_CLASS[d.id] === filter)) &&
        terms.every((w) => toHira(`${d.name} ${d.kana} ${d.alias}`.toLowerCase()).includes(w)),
    )
  }, [q, filter, history])

  const toggle = (drugId: string) => {
    const cur = inDraft.get(drugId)
    dispatch(cur ? { type: 'removeRx', id: cur.id } : { type: 'addRx', drugId })
  }

  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3" onPointerDown={onClose}>
      <div
        role="dialog"
        aria-label="処方"
        className="flex h-[88vh] w-[1040px] max-w-full flex-col overflow-hidden rounded-[28px] bg-surface-1 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rx-ctr text-rx">
            <Icon name="medication" size={22} />
          </span>
          <h2 className="text-[22px]">処方</h2>
          {patient.allergies.length > 0 && (
            <span className="flex items-center gap-1 rounded-lg bg-error-ctr px-2.5 py-1 text-xs font-medium text-error">
              <Icon name="warning" fill size={16} />
              アレルギー：{patient.allergies.join('、')}
            </span>
          )}
          <span className="flex-1" />
          {hasPast && (
            <button onClick={() => dispatch({ type: 'do' })} className="btn btn-sm btn-tonal">
              <Icon name="replay" size={18} />
              Do処方
            </button>
          )}
          <button onClick={onClose} className="btn btn-filled">
            <Icon name="check" size={20} />
            完了 <span className="kbd">Esc</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 lg:flex-row">
          {/* 薬を探す */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl bg-white">
            <div className="px-4 pt-4">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" />
                <input
                  ref={ref}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return
                    if (e.key === 'Enter' && visible[0]) {
                      e.preventDefault()
                      if (!inDraft.has(visible[0].id)) dispatch({ type: 'addRx', drugId: visible[0].id })
                      setQ('')
                    }
                  }}
                  placeholder="薬を検索（例：amlo、あむろ、ろきそ）Enterで追加"
                  className="h-12 w-full rounded-full bg-surface-1 pr-4 pl-10 text-sm outline-none placeholder:text-ink-2/70 focus:bg-white focus:shadow-md"
                />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {(['all', ...(history.size ? (['history'] as const) : []), ...DRUG_CLASSES] as Filter[]).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? 'chip-on' : ''}`}>
                    {f === 'history' && <Icon name="history" size={16} />}
                    {f === 'all' ? 'すべて' : f === 'history' ? 'この患者の処方歴' : f}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
              {visible.map((d) => {
                const on = inDraft.has(d.id)
                return (
                  <button
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${on ? 'bg-rx-ctr' : 'hover:bg-surface-1'}`}
                  >
                    <Icon name={on ? 'check_circle' : 'add_circle'} fill={on} size={22} className={on ? 'text-rx' : 'text-ink-2'} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${on ? 'font-medium text-rx' : ''}`}>{d.name}</span>
                      <span className="block text-xs text-ink-2">
                        {DRUG_CLASS[d.id]}・{d.dose}
                        {d.unit} {d.usage} {d.days}日
                      </span>
                    </span>
                    {history.has(d.id) && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">処方歴あり</span>}
                  </button>
                )
              })}
              {visible.length === 0 && <div className="py-10 text-center text-ink-2">該当する薬がありません</div>}
            </div>
          </div>

          {/* 今回の処方 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl bg-white">
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <span className="flex-1 text-base font-medium">今回の処方</span>
              <span className="label">{draft.rx.length}剤</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {draft.rx.length === 0 && <div className="rounded-xl border border-dashed border-outline-var px-4 py-6 text-center text-sm text-ink-2">左から薬を選ぶと、ここに入ります</div>}
              {draft.rx.map((r) => (
                <RxCard key={r.id} r={r} dispatch={dispatch} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RxCard({ r, dispatch }: { r: RxItem; dispatch: (a: Action) => void }) {
  const set = (patch: Partial<RxItem>) => dispatch({ type: 'updateRx', id: r.id, patch })
  const usages = USAGES.includes(r.usage) ? USAGES : [r.usage, ...USAGES]
  return (
    <div className="rounded-2xl bg-rx-ctr/70 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <Icon name="medication" size={18} className="text-rx" />
        <span className="flex-1 truncate font-medium">{r.name}</span>
        <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="icon-btn icon-btn-sm" aria-label="削除">
          <Icon name="delete" size={18} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
        <span className="flex items-center rounded-full bg-white">
          <button onClick={() => set({ dose: Math.max(0.5, r.dose - (r.dose > 1 ? 1 : 0.5)) })} className="icon-btn icon-btn-sm" aria-label="減らす">
            <Icon name="remove" size={18} />
          </button>
          <span className="w-10 text-center tabular-nums">
            {r.dose}
            {r.unit}
          </span>
          <button onClick={() => set({ dose: r.dose + (r.dose < 1 ? 0.5 : 1) })} className="icon-btn icon-btn-sm" aria-label="増やす">
            <Icon name="add" size={18} />
          </button>
        </span>
        <select value={r.usage} onChange={(e) => set({ usage: e.target.value })} className="field field-sm w-auto rounded-full">
          {usages.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 pl-7">
        {DAY_PRESETS.map((n) => (
          <button key={n} onClick={() => set({ days: n })} className={`chip h-7 px-2.5 text-xs ${r.days === n ? 'chip-on' : ''}`}>
            {n}日
          </button>
        ))}
        <input
          value={r.days}
          onChange={(e) => set({ days: Number(e.target.value) || 0 })}
          inputMode="numeric"
          className="field field-sm w-14 text-right tabular-nums"
          aria-label="日数（自由入力）"
        />
      </div>
    </div>
  )
}
