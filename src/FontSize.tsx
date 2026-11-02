import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

// 文字サイズ（ファストカルテの文字サイズ設定と同じ考え方）。画面全体の文字・余白・アイコンを一緒に大きくする。
// 大きさは rem で書いてあるので、html の font-size を変えるだけで全体が変わる。印刷（A4の文書）は変えない。
// この端末に覚える
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

export const FONT_SIZES: { id: FontSize; label: string; pct: number }[] = [
  { id: 'sm', label: '小', pct: 100 },
  { id: 'md', label: '標準', pct: 112.5 },
  { id: 'lg', label: '大', pct: 125 },
  { id: 'xl', label: '特大', pct: 137.5 },
]

const KEY = 'hoken-karte-fontsize'
const EVENT = 'hoken-karte-fontsize'

export const loadFontSize = (): FontSize => {
  try {
    const v = localStorage.getItem(KEY)
    return FONT_SIZES.some((f) => f.id === v) ? (v as FontSize) : 'md'
  } catch {
    return 'md'
  }
}

export const applyFontSize = (v: FontSize) => {
  document.documentElement.style.fontSize = `${FONT_SIZES.find((f) => f.id === v)!.pct}%`
}

export const saveFontSize = (v: FontSize) => {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // 覚えられなくても今の画面には反映する
  }
  applyFontSize(v)
  window.dispatchEvent(new Event(EVENT))
}

export function useFontSize() {
  const [v, setV] = useState(loadFontSize)
  useEffect(() => {
    const on = () => setV(loadFontSize())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return v
}

// 小・標準・大・特大の切り替え（設定の画面と、右上の「文字」ボタンの中で使う）
export function FontSizePicker() {
  const cur = useFontSize()
  return (
    <div role="radiogroup" aria-label="文字サイズ" className="flex rounded-lg border border-line bg-cream p-0.5">
      {FONT_SIZES.map((f) => (
        <button
          key={f.id}
          role="radio"
          aria-checked={cur === f.id}
          onClick={() => saveFontSize(f.id)}
          className={`flex-1 rounded-md px-3 py-1.5 whitespace-nowrap ${cur === f.id ? 'bg-ivory font-semibold text-ink shadow-soft' : 'text-mist hover:text-ink'}`}
          style={{ fontSize: `${(f.pct / 100) * 0.8125}rem` }}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

// 右上の「文字」ボタン。押すと小・標準・大・特大を選ぶ小さな窓
export function FontSizeButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
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
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} title="文字サイズ" className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-mist hover:bg-ink/6 hover:text-ink">
        <Icon name="format_size" size={18} />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border border-line bg-ivory p-3 shadow-soft">
          <div className="mb-2 text-xs text-mist">文字サイズ（この端末に保存）</div>
          <FontSizePicker />
        </div>
      )}
    </div>
  )
}
