import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

// ファストカルテの SaveSplitButton と同じ形：左が主ボタン、右の ▾ で確定のあとの行き先を選ぶ。
// 最後に選んだ行き先が次から主ボタンになる（この端末に覚える）。⌘Enter は主ボタンと同じ
export type SaveMode = 'next' | 'accounting' | 'reception'

export const SAVE_MODES: { id: SaveMode; label: string; short: string; desc: string }[] = [
  { id: 'next', label: '確定して次の患者へ', short: '確定→次へ', desc: '待ちの患者がいれば続けて開く' },
  { id: 'accounting', label: '確定して会計へ', short: '確定→会計', desc: '会計の画面に移る' },
  { id: 'reception', label: '確定して受付へ戻る', short: '確定→受付', desc: '受付の一覧に戻る' },
]

const KEY = 'hoken-karte-savemode'

export const loadSaveMode = (): SaveMode => {
  try {
    const v = localStorage.getItem(KEY)
    return SAVE_MODES.some((m) => m.id === v) ? (v as SaveMode) : 'next'
  } catch {
    return 'next'
  }
}

export function SaveSplitButton({ mode, onMode, onSave }: { mode: SaveMode; onMode: (m: SaveMode) => void; onSave: (m: SaveMode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cur = SAVE_MODES.find((m) => m.id === mode)!

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc, true)
    }
  }, [open])

  const pick = (m: SaveMode) => {
    setOpen(false)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* 覚えられなくても保存はする */
    }
    onMode(m)
    onSave(m)
  }

  return (
    <div ref={ref} className="relative flex shrink-0">
      <button onClick={() => onSave(mode)} title={`${cur.label}（⌘Enter）`} className="flex h-8 items-center gap-1 rounded-l-md bg-clinical px-3 text-sm font-medium whitespace-nowrap text-ivory hover:brightness-110 touch:h-10">
        {/* 記載の枠の幅で切り替える（文字サイズを大きくしたときも確定ボタンがはみ出さない） */}
        <span className="hidden @[30rem]:inline">{cur.label}</span>
        <span className="@[30rem]:hidden">{cur.short}</span>
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="確定のあとの行き先を選ぶ"
        aria-expanded={open}
        className="flex h-8 w-7 items-center justify-center rounded-r-md border-l border-ivory/30 bg-clinical text-ivory hover:brightness-110 touch:h-10 touch:w-9"
      >
        <Icon name="expand_more" size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-1 w-64 divide-y divide-line overflow-hidden rounded-lg border border-line bg-ivory shadow-soft">
          {SAVE_MODES.map((m) => (
            <button key={m.id} role="menuitem" onClick={() => pick(m.id)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gold-soft">
              <Icon name="check" size={18} className={m.id === mode ? 'text-clinical' : 'invisible'} />
              <span>
                <span className="block text-sm font-medium">{m.label}</span>
                <span className="block text-[0.6875rem] text-mist">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
