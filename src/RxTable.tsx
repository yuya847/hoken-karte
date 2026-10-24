import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { DRUG_CLASS, DRUGS } from './data'
import { Icon } from './Icon'
import { daysText, doseText, groupRp, isExternal, parseUsage, usageLine } from './rxFormat'
import type { Action } from './store'
import type { Draft, RxItem } from './types'

// 処方の表（富士通カルテの院外処方と同じ並び：Rp／後発変更不可／選択薬品／数量／単位）。
// 最後の行に薬品名を直接打つ。2文字で候補が出て、↑↓とEnterで選ぶ（例：「フラ」→フランドルテープ）。
// 数量は内服なら1日量、外用なら総量。行を押すと下で1回量・用法・日数（外用は部位）を直せる。
const MIN_CHARS = 2

export function RxTable({
  draft,
  history,
  dispatch,
  inputRef,
  selected,
  onSelect,
}: {
  draft: Draft
  history: Set<string>
  dispatch: (a: Action) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  selected: string | null
  onSelect: (rxId: string | null) => void
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  // 候補から入れた薬を、表に入ったところで選んだ状態にする
  const pending = useRef<string | null>(null)
  const groups = groupRp(draft.rx)

  const candidates = useMemo(() => {
    const w = toHira(q.trim().toLowerCase())
    if (w.length < MIN_CHARS) return []
    const hay = (d: (typeof DRUGS)[number]) => toHira(`${d.name} ${d.kana} ${d.alias}`.toLowerCase())
    const head = (d: (typeof DRUGS)[number]) => hay(d).split(/\s+/).some((x) => x.startsWith(w))
    return DRUGS.filter((d) => hay(d).includes(w))
      .sort((a, b) => Number(head(b)) - Number(head(a)) || Number(history.has(b.id)) - Number(history.has(a.id)))
      .slice(0, 8)
  }, [q, history])

  useEffect(() => setHi(0), [q])
  useEffect(() => {
    const r = pending.current && draft.rx.find((x) => x.drugId === pending.current)
    if (r) {
      pending.current = null
      onSelect(r.id)
    }
  }, [draft.rx, onSelect])

  const pick = (drugId: string) => {
    pending.current = drugId
    if (!draft.rx.some((r) => r.drugId === drugId)) dispatch({ type: 'addRx', drugId })
    else onSelect(draft.rx.find((r) => r.drugId === drugId)!.id)
    setQ('')
    inputRef.current?.focus()
  }

  const set = (r: RxItem, patch: Partial<RxItem>) => dispatch({ type: 'updateRx', id: r.id, patch })
  const cell = 'border-b border-surface-2 px-2 py-1.5 align-middle'
  const sub = 'px-2 py-1 text-right text-[13px]'
  const numInput = 'w-full rounded-md bg-transparent px-1 py-0.5 text-right tabular-nums outline-none hover:bg-surface-1 focus:bg-white focus:ring-2 focus:ring-primary'

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr className="bg-rx-ctr text-xs font-medium text-rx">
          <th className="w-10 px-2 py-2 text-left">Rp</th>
          <th className="w-12 px-1 py-2 text-center" title="後発医薬品への変更不可">
            変更
            <br />
            不可
          </th>
          <th className="px-2 py-2 text-left">選択薬品</th>
          <th className="w-20 px-2 py-2 text-right">数量</th>
          <th className="w-11 px-1 py-2 text-left">単位</th>
          <th className="w-9" />
        </tr>
      </thead>
      {groups.map((g, gi) => {
        const head = g[0]
        const ext = isExternal(head)
        const u = parseUsage(head.usage)
        return (
          <tbody key={head.id} className="border-b-2 border-surface-2">
            {g.map((r, i) => (
              <tr
                key={r.id}
                onClick={() => onSelect(selected === r.id ? null : r.id)}
                className={`cursor-pointer ${selected === r.id ? 'bg-primary-ctr/50' : 'hover:bg-surface-1'}`}
              >
                <td className={`${cell} font-medium text-rx tabular-nums`}>{i === 0 ? gi + 1 : ''}</td>
                <td className={`${cell} text-center`} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!r.noGeneric}
                    onChange={(e) => set(r, { noGeneric: e.target.checked })}
                    aria-label={`${r.name} 後発品への変更不可`}
                    className="h-4 w-4 accent-[var(--color-rx)]"
                  />
                </td>
                <td className={`${cell} truncate font-medium`} title={r.name}>
                  {r.name}
                </td>
                <td className={cell} onClick={(e) => e.stopPropagation()}>
                  <input
                    value={r.dose}
                    onChange={(e) => set(r, { dose: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    inputMode="decimal"
                    aria-label={`${r.name} ${isExternal(r) ? '総量' : u.times ? '1日量' : '1回量'}`}
                    className={numInput}
                  />
                </td>
                <td className={`${cell} px-1`}>{r.unit}</td>
                <td className={`${cell} px-0`} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => dispatch({ type: 'removeRx', id: r.id })} className="icon-btn icon-btn-sm" aria-label={`${r.name}を削除`}>
                    <Icon name="close" size={18} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-surface-1/60">
              <td />
              <td />
              <td className={sub}>
                <button onClick={() => onSelect(head.id)} className="hover:underline" title="押すと用法を直せます">
                  {usageLine(head)}
                  {!ext && u.times && g.length === 1 && <span className="text-ink-2">（{doseText(head).split('（')[0]}）</span>}
                </button>
              </td>
              {ext ? (
                <>
                  <td />
                  <td />
                </>
              ) : (
                <>
                  <td className="px-2 py-1">
                    <input
                      value={head.days}
                      onChange={(e) => g.forEach((r) => set(r, { days: Number(e.target.value) || 0 }))}
                      onFocus={(e) => e.target.select()}
                      inputMode="numeric"
                      aria-label={`Rp${gi + 1} ${u.times ? '日数' : '回数'}`}
                      className={numInput}
                    />
                  </td>
                  <td className="px-1 py-1 text-[13px]">{daysText(head).replace(/^\d+/, '')}</td>
                </>
              )}
              <td />
            </tr>
            {ext && (
              <tr className="bg-surface-1/60">
                <td />
                <td />
                <td className={`${sub} text-primary`}>
                  <button onClick={() => onSelect(head.id)} className="hover:underline">
                    {head.site || '部位未記入'}
                  </button>
                </td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        )
      })}
      <tbody>
        <tr>
          <td className="px-2 py-2 font-medium text-ink-2 tabular-nums">{groups.length + 1}</td>
          <td />
          <td colSpan={4} className="relative py-1.5 pr-2">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'ArrowDown' && candidates.length) {
                  e.preventDefault()
                  setHi((hi + 1) % candidates.length)
                } else if (e.key === 'ArrowUp' && candidates.length) {
                  e.preventDefault()
                  setHi((hi - 1 + candidates.length) % candidates.length)
                } else if (e.key === 'Enter' && candidates[hi]) {
                  e.preventDefault()
                  pick(candidates[hi].id)
                } else if (e.key === 'Escape' && q) {
                  e.stopPropagation()
                  setQ('')
                }
              }}
              role="combobox"
              aria-expanded={candidates.length > 0}
              aria-controls="rx-candidates"
              aria-label="薬品名を入力"
              placeholder="薬品名を入力（2文字で候補）"
              className="h-9 w-full rounded-lg border border-dashed border-outline-var bg-white px-3 text-sm outline-none placeholder:text-ink-2/70 focus:border-solid focus:border-primary"
            />
            {q.trim().length > 0 && q.trim().length < MIN_CHARS && <div className="absolute top-full left-0 z-20 mt-1 text-xs text-ink-2">あと{MIN_CHARS - q.trim().length}文字</div>}
            {candidates.length > 0 && (
              <ul id="rx-candidates" role="listbox" className="absolute top-full right-2 left-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-outline-var">
                {candidates.map((d, i) => (
                  <li
                    key={d.id}
                    role="option"
                    aria-selected={i === hi}
                    onMouseEnter={() => setHi(i)}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      pick(d.id)
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${i === hi ? 'bg-primary-ctr/60' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{d.name}</span>
                      <span className="block truncate text-xs text-ink-2">
                        {DRUG_CLASS[d.id]}・{isExternal(d) ? `${doseText(d)} ${usageLine(d)} ${d.site ?? ''}` : `${doseText(d)} ${usageLine(d)} ${daysText(d)}`}
                      </span>
                    </span>
                    {history.has(d.id) && <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">処方歴あり</span>}
                    {draft.rx.some((r) => r.drugId === d.id) && <span className="shrink-0 text-[11px] text-rx">入力済み</span>}
                  </li>
                ))}
              </ul>
            )}
            {q.trim().length >= MIN_CHARS && candidates.length === 0 && <div className="absolute top-full left-0 z-20 mt-1 text-xs text-ink-2">該当する薬がありません</div>}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
