import { useMemo, useState } from 'react'
import { toHira } from './CommandPalette'

export type SearchItem = { id: string; label: string; sub?: string; keys: string }

type Props = {
  items: SearchItem[]
  placeholder: string
  onPick: (id: string) => void
  inputRef?: React.Ref<HTMLInputElement>
  tone: 'emerald' | 'violet' | 'blue'
}

const RING = { emerald: 'focus:border-emerald-500 focus:ring-emerald-100', violet: 'focus:border-violet-500 focus:ring-violet-100', blue: 'focus:border-blue-500 focus:ring-blue-100' }
const ACTIVE = { emerald: 'bg-emerald-50', violet: 'bg-violet-50', blue: 'bg-blue-50' }

// 種類ごとの検索欄。かな・ローマ字略称で引き、Enterで追加して欄を空に戻す（続けて次を引ける）。
export function OrderSearch({ items, placeholder, onPick, inputRef, tone }: Props) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const terms = toHira(q.trim().toLowerCase()).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []
    return items.filter((c) => terms.every((t) => toHira(`${c.label} ${c.keys}`.toLowerCase()).includes(t))).slice(0, 8)
  }, [q, items])

  const pick = (c: SearchItem | undefined) => {
    if (!c) return
    onPick(c.id)
    setQ('')
    setIdx(0)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setIdx(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIdx((i) => Math.min(i + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIdx((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            pick(results[idx])
          } else if (e.key === 'Escape') {
            setQ('')
          }
        }}
        placeholder={placeholder}
        className={`w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 ${RING[tone]}`}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((c, i) => (
            <div
              key={c.id}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(c)
              }}
              className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm ${i === idx ? ACTIVE[tone] : ''}`}
            >
              <span className="flex-1 truncate">{c.label}</span>
              {c.sub && <span className="truncate text-xs text-slate-500">{c.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
