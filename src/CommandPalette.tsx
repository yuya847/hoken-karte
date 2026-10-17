import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'

export type Command = {
  id: string
  group: '操作' | '処方' | '検査' | '病名' | 'セット'
  label: string
  sub?: string
  keys: string
  hint?: string
  run: () => void
}

const GROUP_ICON: Record<Command['group'], string> = { 操作: 'bolt', 処方: 'medication', 検査: 'biotech', 病名: 'diagnosis', セット: 'playlist_add' }

export const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const results = useMemo(() => {
    const terms = toHira(q.trim().toLowerCase()).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return commands.filter((c) => c.group === '操作' || c.group === 'セット')
    return commands.filter((c) => {
      const hay = toHira(`${c.label} ${c.keys}`.toLowerCase())
      return terms.every((t) => hay.includes(t))
    })
  }, [q, commands])

  useEffect(() => setIdx(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const choose = (c: Command | undefined) => {
    if (!c) return
    onClose()
    c.run()
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]" onMouseDown={onClose}>
      <div className="w-[680px] max-w-[92vw] overflow-hidden rounded-[28px] bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5">
        <Icon name="search" size={24} className="text-ink-2" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIdx((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIdx((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(results[idx])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
          placeholder="薬・検査・病名・操作を検索（例：あむろ、amlo、HbA1c、感冒）"
          className="h-14 flex-1 text-base outline-none placeholder:text-ink-2/70"
        />
        </div>
        <div className="mx-5 border-t border-surface-2" />
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && <div className="px-4 py-6 text-center text-ink-2">見つかりません</div>}
          {results.map((c, i) => (
            <div
              key={c.id}
              data-idx={i}
              onMouseEnter={() => setIdx(i)}
              onClick={() => choose(c)}
              className={`flex cursor-pointer items-center gap-3 px-5 py-2.5 ${i === idx ? 'bg-surface-1' : ''}`}
            >
              <Icon name={GROUP_ICON[c.group]} size={20} className="text-ink-2" />
              <span className="w-12 shrink-0 text-xs text-ink-2">{c.group}</span>
              <span className="flex-1 truncate">{c.label}</span>
              {c.sub && <span className="truncate text-xs text-ink-2">{c.sub}</span>}
              {c.hint && <span className="kbd text-ink-2">{c.hint}</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-4 bg-surface-1 px-5 py-2.5 text-xs text-ink-2">
          <span>↑↓ 選択</span>
          <span>Enter 決定</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  )
}
