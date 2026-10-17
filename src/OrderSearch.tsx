import { useMemo, useState } from 'react'
import { toHira } from './CommandPalette'
import { Icon } from './Icon'

export type SearchItem = { id: string; label: string; sub?: string; keys: string }

type Props = {
  items: SearchItem[]
  placeholder: string
  onPick: (id: string) => void
  inputRef?: React.Ref<HTMLInputElement>
  icon?: string
}

// 種類ごとの検索欄。かな・ローマ字略称で引き、Enterで追加して欄を空に戻す（続けて次を引ける）。
export function OrderSearch({ items, placeholder, onPick, inputRef, icon = 'search' }: Props) {
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

  const showList = open && results.length > 0

  return (
    <div className="relative">
      <Icon name={icon} size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" />
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
        className={`h-11 w-full rounded-full bg-surface-1 pr-4 pl-10 text-sm outline-none transition-colors placeholder:text-ink-2/70 hover:bg-surface-2 focus:bg-white focus:shadow-md ${showList ? 'rounded-b-none rounded-t-3xl' : ''}`}
      />
      {showList && (
        <div className="absolute z-20 w-full overflow-hidden rounded-b-3xl bg-white pb-2 shadow-md">
          <div className="mx-4 mb-1 border-t border-surface-2" />
          {results.map((c, i) => (
            <div
              key={c.id}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(c)
              }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${i === idx ? 'bg-surface-1' : ''}`}
            >
              <Icon name="add" size={18} className="text-ink-2" />
              <span className="flex-1 truncate">{c.label}</span>
              {c.sub && <span className="truncate text-xs text-ink-2">{c.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
