import { useEffect, useMemo, useRef, useState } from 'react'

export type Command = {
  id: string
  group: '操作' | '処方' | '検査' | '病名' | 'セット'
  label: string
  sub?: string
  keys: string
  hint?: string
  run: () => void
}

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
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-[640px] max-w-[92vw] overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
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
          className="w-full border-b border-slate-200 px-4 py-3 text-base outline-none"
        />
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <div className="px-4 py-6 text-center text-slate-500">見つかりません</div>}
          {results.map((c, i) => (
            <div
              key={c.id}
              data-idx={i}
              onMouseEnter={() => setIdx(i)}
              onClick={() => choose(c)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === idx ? 'bg-blue-50' : ''}`}
            >
              <span className="w-12 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-xs text-slate-600">{c.group}</span>
              <span className="flex-1 truncate">{c.label}</span>
              {c.sub && <span className="truncate text-xs text-slate-500">{c.sub}</span>}
              {c.hint && <kbd className="rounded border border-slate-300 px-1.5 text-xs text-slate-500">{c.hint}</kbd>}
            </div>
          ))}
        </div>
        <div className="flex gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span>↑↓ 選択</span>
          <span>Enter 決定</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  )
}
