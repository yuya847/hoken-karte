// 右端のオーダーアイコン列。アイコン画像は scripts/gen-icons.mjs（Gemini API）で src/assets/icons/ に生成する。
// 未生成のアイコンは簡易SVGで代替表示する。
const generated = import.meta.glob<string>('./assets/icons/*.png', { eager: true, import: 'default' })
const iconUrl = (id: string) => generated[`./assets/icons/${id}.png`]

export type RailId = 'rx' | 'test' | 'disease' | 'letter' | 'image'

export const RAIL: { id: RailId; label: string; hint?: string; tone: string }[] = [
  { id: 'rx', label: '処方', hint: '⌘P', tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'test', label: '検査', tone: 'bg-violet-100 text-violet-700' },
  { id: 'disease', label: '病名', tone: 'bg-blue-100 text-blue-700' },
  { id: 'letter', label: '紹介状', hint: '⌘L', tone: 'bg-orange-100 text-orange-700' },
  { id: 'image', label: '画像', tone: 'bg-cyan-100 text-cyan-700' },
]

const FALLBACK: Record<RailId, React.ReactNode> = {
  rx: <path d="M8.5 15.5l7-7a3.5 3.5 0 015 5l-7 7a3.5 3.5 0 01-5-5zM12 12l5 5" />,
  test: <path d="M9 3h6M10 3v11a3 3 0 006 0V3M10 10h6" />,
  disease: <path d="M4 12V5a1 1 0 011-1h7l8 8-8 8-8-8zM8 8h.01" />,
  letter: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  image: <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01" />,
}

export function OrderRail({ active, onSelect }: { active: RailId | null; onSelect: (id: RailId) => void }) {
  return (
    <nav className="no-print flex w-[68px] shrink-0 flex-col items-center gap-2 pt-2">
      {RAIL.map((r) => {
        const url = iconUrl(r.id)
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            title={r.hint ? `${r.label}（${r.hint}）` : r.label}
            className={`group flex w-16 flex-col items-center gap-1 py-1 text-[11px] font-medium ${active === r.id ? 'text-on-secondary-ctr' : 'text-ink-2'}`}
          >
            {url ? (
              <span className={`flex h-10 w-14 items-center justify-center rounded-full transition-colors ${active === r.id ? 'bg-secondary-ctr' : 'group-hover:bg-ink/8'}`}>
                <img src={url} alt="" className="h-7 w-7 rounded-md" />
              </span>
            ) : (
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${r.tone}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {FALLBACK[r.id]}
                </svg>
              </span>
            )}
            <span>{r.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
