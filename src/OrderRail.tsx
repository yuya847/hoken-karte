import { Icon } from './Icon'

// 右端のオーダーの列。アイコンはファストカルテと同じ細い線の絵（押している間は線を太く）。
// 以前の色付きの画像（src/assets/icons/*.png）は使わない

export type RailId = 'rx' | 'test' | 'disease' | 'letter' | 'image'

export const RAIL: { id: RailId; label: string; hint?: string; tone: string }[] = [
  { id: 'rx', label: '処方', hint: '⌘P', tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'test', label: '検査', tone: 'bg-violet-100 text-violet-700' },
  { id: 'disease', label: '病名', tone: 'bg-blue-100 text-blue-700' },
  { id: 'letter', label: '紹介状', hint: '⌘L', tone: 'bg-orange-100 text-orange-700' },
  { id: 'image', label: '画像', tone: 'bg-cyan-100 text-cyan-700' },
]

const LINE: Record<RailId, React.ReactNode> = {
  rx: <path d="M8.5 15.5l7-7a3.5 3.5 0 015 5l-7 7a3.5 3.5 0 01-5-5zM12 12l5 5" />,
  test: <path d="M9 3h6M10 3v11a3 3 0 006 0V3M10 10h6" />,
  disease: <path d="M4 12V5a1 1 0 011-1h7l8 8-8 8-8-8zM8 8h.01" />,
  letter: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  image: <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01" />,
}

function RailIcon({ id, on, size = 24 }: { id: RailId; on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} fill="none" stroke="currentColor" strokeWidth={on ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      {LINE[id]}
    </svg>
  )
}

// 右端のオーダーの列（ファストカルテの OrderRail と同じ：上に検索、下にクリーム地の枠に小さなタイルを並べる。
// 幅が広い画面（xl）は3列、それ以外は1列。押しているタイルは藍で塗る）
const SECTIONS: { title: string; ids: RailId[] }[] = [
  { title: 'オーダー', ids: ['rx', 'test', 'disease'] },
  { title: '操作', ids: ['letter', 'image'] },
]

export function OrderRail({ active, onSelect, onSearch }: { active: RailId | null; onSelect: (id: RailId) => void; onSearch: () => void }) {
  return (
    <nav aria-label="オーダー" className="no-print flex w-[100px] shrink-0 flex-col gap-2 max-md:hidden xl:w-[228px]">
      <button
        onClick={onSearch}
        title="薬・検査・病名・セットを探す（⌘K）"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-2 text-left text-xs text-mist shadow-soft hover:border-clinical"
      >
        <Icon name="search" size={16} />
        <span className="flex-1 truncate">検索</span>
        <span className="kbd max-xl:hidden">⌘K</span>
      </button>
      <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-line bg-cream p-1.5">
        {SECTIONS.map((sec, si) => (
          <div key={sec.title}>
            <div className={`flex items-center gap-1 px-0.5 pb-1 text-[10px] text-mist ${si > 0 ? 'mt-1.5 border-t border-gold/40 pt-1.5' : ''}`}>{sec.title}</div>
            <div className="grid grid-cols-1 gap-1 xl:grid-cols-3">
              {sec.ids.map((id) => {
                const r = RAIL.find((x) => x.id === id)!
                const on = active === id
                return (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
                    title={r.hint ? `${r.label}（${r.hint}）` : r.label}
                    aria-pressed={on}
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-0.5 py-1.5 text-[11px] transition-colors ${
                      on ? 'border-clinical bg-clinical font-semibold text-ivory' : 'border-line bg-ivory text-mist hover:border-clinical hover:bg-gold-soft hover:text-ink'
                    }`}
                  >
                    <RailIcon id={id} on={on} />
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}

// スマホではオーダーの列を画面の下に並べる（親指で押せる位置）
export function OrderBar({ active, onSelect }: { active: RailId | null; onSelect: (id: RailId) => void }) {
  return (
    <nav aria-label="オーダー" className="no-print flex shrink-0 border-t border-line bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {RAIL.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          aria-pressed={active === r.id}
          className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active === r.id ? 'font-semibold text-clinical' : 'text-mist'}`}
        >
          <RailIcon id={r.id} on={active === r.id} size={22} />
          {r.label}
        </button>
      ))}
    </nav>
  )
}
