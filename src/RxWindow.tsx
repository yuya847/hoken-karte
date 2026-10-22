import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { DAY_PRESETS, DRUG_CLASS, DRUG_CLASSES, DRUGS } from './data'
import { Icon } from './Icon'
import { daysText, doseText, groupRp, parseUsage, perDose, PRN_TIMINGS, TIMES, TIMINGS, usageOf, usageText } from './rxFormat'
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
                        {DRUG_CLASS[d.id]}・{doseText(d)} {usageText(d.usage)} {daysText(d)}
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
            <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
              {draft.rx.length === 0 && <div className="rounded-xl border border-dashed border-outline-var px-4 py-6 text-center text-sm text-ink-2">左から薬を選ぶと、ここに入ります</div>}
              {groupRp(draft.rx).map((g, gi) => (
                <div key={g[0].id}>
                  <div className="mb-1 flex items-center gap-2 px-1 text-xs text-ink-2">
                    <span className="font-medium text-rx">Rp{gi + 1}</span>
                    <span>
                      {usageText(g[0].usage)}・{daysText(g[0])}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {g.map((r) => (
                      <RxCard key={r.id} r={r} dispatch={dispatch} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 1回量・1日の回数・タイミング・日数を分けて入れる（富士通カルテの「1回1錠（1日3錠）／1日3回 毎食後／5日分」）
function RxCard({ r, dispatch }: { r: RxItem; dispatch: (a: Action) => void }) {
  const set = (patch: Partial<RxItem>) => dispatch({ type: 'updateRx', id: r.id, patch })
  const u = parseUsage(r.usage)
  const per = perDose(r)
  // 1回量を変えたら1日量を、回数を変えたら1回量を保ったまま1日量を直す
  const setPer = (n: number) => set({ dose: u.times ? n * u.times : n })
  const setTimes = (times: number | null) => {
    if (times === u.times) return
    const timing = times ? (TIMINGS[times].includes(u.timing) ? u.timing : TIMINGS[times][0]) : PRN_TIMINGS[0]
    set({ usage: usageOf({ times, timing }), dose: times ? per * times : per })
  }
  const timings = u.times ? TIMINGS[u.times] : PRN_TIMINGS
  const step = (n: number, up: boolean) => (up ? n + (n < 1 ? 0.5 : 1) : Math.max(0.5, n - (n > 1 ? 1 : 0.5)))
  const row = 'flex flex-wrap items-center gap-1.5 pl-7'
  const head = 'w-12 shrink-0 text-xs text-ink-2'

  return (
    <div className="rounded-2xl bg-rx-ctr/70 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <Icon name="medication" size={18} className="text-rx" />
        <span className="flex-1 truncate font-medium">{r.name}</span>
        <label className="flex shrink-0 items-center gap-1 text-xs text-ink-2" title="後発医薬品への変更不可">
          <input type="checkbox" checked={!!r.noGeneric} onChange={(e) => set({ noGeneric: e.target.checked })} className="h-4 w-4 accent-[var(--color-rx)]" />
          変更不可
        </label>
        <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="icon-btn icon-btn-sm" aria-label="削除">
          <Icon name="delete" size={18} />
        </button>
      </div>

      <div className={`mt-2 ${row}`}>
        <span className={head}>1回</span>
        <span className="flex items-center rounded-full bg-white">
          <button onClick={() => setPer(step(per, false))} className="icon-btn icon-btn-sm" aria-label="1回量を減らす">
            <Icon name="remove" size={18} />
          </button>
          <span className="min-w-12 text-center font-medium tabular-nums">
            {per}
            {r.unit}
          </span>
          <button onClick={() => setPer(step(per, true))} className="icon-btn icon-btn-sm" aria-label="1回量を増やす">
            <Icon name="add" size={18} />
          </button>
        </span>
        {u.times && (
          <span className="text-xs text-ink-2 tabular-nums">
            （1日{r.dose}
            {r.unit}）
          </span>
        )}
      </div>

      <div className={`mt-1.5 ${row}`}>
        <span className={head}>1日</span>
        {TIMES.map((n) => (
          <button key={n} onClick={() => setTimes(n)} className={`chip h-7 px-2.5 text-xs ${u.times === n ? 'chip-on' : ''}`}>
            {n}回
          </button>
        ))}
        <button onClick={() => setTimes(null)} className={`chip h-7 px-2.5 text-xs ${u.times === null ? 'chip-on' : ''}`}>
          頓用
        </button>
      </div>

      <div className={`mt-1.5 ${row}`}>
        <span className={head}>{u.times ? 'いつ' : 'どんな時'}</span>
        {timings.map((t) => (
          <button key={t} onClick={() => set({ usage: usageOf({ times: u.times, timing: t }) })} className={`chip h-7 px-2.5 text-xs ${u.timing === t ? 'chip-on' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      <div className={`mt-1.5 ${row}`}>
        <span className={head}>{u.times ? '日数' : '回数'}</span>
        {(u.times ? DAY_PRESETS : [3, 5, 10]).map((n) => (
          <button key={n} onClick={() => set({ days: n })} className={`chip h-7 px-2.5 text-xs ${r.days === n ? 'chip-on' : ''}`}>
            {n}
            {u.times ? '日' : '回'}
          </button>
        ))}
        <input
          value={r.days}
          onChange={(e) => set({ days: Number(e.target.value) || 0 })}
          inputMode="numeric"
          className="field field-sm w-14 text-right tabular-nums"
          aria-label={u.times ? '日数（自由入力）' : '回数（自由入力）'}
        />
      </div>
    </div>
  )
}
