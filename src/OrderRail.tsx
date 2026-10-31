import { Icon } from './Icon'
import { ORDER_KINDS, type OrderKind } from './data'

// 右端のオーダーの列。Material Design 3 のナビゲーションレールの形（幅80px・上に検索のFAB・
// 押している項目はアイコンの後ろに横長の丸い面）。オーダーは種類ごとに分ける
export type RailId = 'rx' | OrderKind | 'disease' | 'letter' | 'image'

type Item = { id: RailId; label: string; icon: string; hint?: string }

const ORDER_ITEMS: Item[] = [
  { id: 'rx', label: '処方', icon: 'medication', hint: '⌘P' },
  ...(['drip', 'blood', 'xray', 'ct', 'mri', 'physio'] as OrderKind[]).map((k) => ({ id: k, label: ORDER_KINDS[k].label, icon: ORDER_KINDS[k].icon, hint: k === 'blood' ? '⌘E' : undefined })),
]
const ACTION_ITEMS: Item[] = [
  { id: 'disease', label: '病名', icon: 'sell' },
  { id: 'letter', label: '紹介状', icon: 'mail', hint: '⌘L' },
  { id: 'image', label: '画像', icon: 'photo_library' },
]
export const RAIL = [...ORDER_ITEMS, ...ACTION_ITEMS]

function RailButton({ item, on, onSelect }: { item: Item; on: boolean; onSelect: (id: RailId) => void }) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      title={item.hint ? `${item.label}（${item.hint}）` : item.label}
      aria-pressed={on}
      className={`group flex w-full flex-col items-center gap-1 pt-1 pb-1.5 text-[11px] leading-tight ${on ? 'font-semibold text-ink' : 'font-medium text-mist'}`}
    >
      <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${on ? 'bg-gold-soft' : 'group-hover:bg-ink/6'}`}>
        <Icon name={item.icon} fill={on} size={22} />
      </span>
      {item.label}
    </button>
  )
}

export function OrderRail({ active, onSelect, onSearch }: { active: RailId | null; onSelect: (id: RailId) => void; onSearch: () => void }) {
  return (
    <nav aria-label="オーダー" className="no-print flex w-20 shrink-0 flex-col items-center gap-0.5 overflow-y-auto pt-1 max-md:hidden">
      <button onClick={onSearch} title="薬・検査・病名・セットを探す（⌘K）" className="mb-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-soft text-ink shadow-md transition-shadow hover:shadow-lg">
        <Icon name="search" size={24} />
      </button>
      {ORDER_ITEMS.map((it) => (
        <RailButton key={it.id} item={it} on={active === it.id} onSelect={onSelect} />
      ))}
      <span className="my-1.5 h-px w-10 shrink-0 bg-line" />
      {ACTION_ITEMS.map((it) => (
        <RailButton key={it.id} item={it} on={active === it.id} onSelect={onSelect} />
      ))}
    </nav>
  )
}

// スマホではオーダーの列を画面の下に並べる（親指で押せる位置）。種類が多いので横にずらして見る
export function OrderBar({ active, onSelect }: { active: RailId | null; onSelect: (id: RailId) => void }) {
  return (
    <nav aria-label="オーダー" className="no-print flex shrink-0 overflow-x-auto border-t border-line bg-ivory pb-[env(safe-area-inset-bottom)] md:hidden">
      {RAIL.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          aria-pressed={active === r.id}
          className={`flex h-16 min-w-[68px] flex-1 flex-col items-center justify-center gap-1 text-[11px] ${active === r.id ? 'font-semibold text-ink' : 'font-medium text-mist'}`}
        >
          <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active === r.id ? 'bg-gold-soft' : ''}`}>
            <Icon name={r.icon} fill={active === r.id} size={22} />
          </span>
          {r.label}
        </button>
      ))}
    </nav>
  )
}
