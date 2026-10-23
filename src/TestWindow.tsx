import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { Icon } from './Icon'
import { EXTERNAL_IMAGING, SETS, TESTS, TEST_GROUPS } from './data'
import type { Action } from './store'
import type { Draft, Patient } from './types'

// 検査オーダーのウインドウ。分類ごとに項目を並べ、押すとその場で選択・解除する（確定ボタンを挟まない）。
// 開き方：右端の「検査」・オーダー欄の「検査」・⌘E。閉じる：完了・Esc・外側を押す
export function TestWindow({ patient, draft, dispatch, onClose }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const selected = new Set(draft.tests.map((t) => t.code))
  const last = [...patient.encounters].sort((a, b) => b.date.localeCompare(a.date)).find((e) => e.tests.length > 0)
  const testSets = SETS.filter((x) => x.tests.length > 0)

  const visible = useMemo(() => {
    const terms = toHira(q.trim().toLowerCase()).split(/\s+/).filter(Boolean)
    return TESTS.filter((t) => terms.every((w) => toHira(`${t.name} ${t.kana} ${t.alias}`.toLowerCase()).includes(w)))
  }, [q])

  const toggle = (code: string) => dispatch({ type: 'toggleTest', code })
  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3 max-md:p-0" onPointerDown={onClose}>
      <div
        role="dialog"
        aria-label="検査オーダー"
        className="flex h-[88vh] w-[1040px] max-w-full flex-col overflow-hidden rounded-[28px] bg-surface-1 shadow-2xl max-md:h-full max-md:rounded-none max-md:pt-[env(safe-area-inset-top)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-3 max-md:px-4 max-md:pt-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lab-ctr text-lab">
            <Icon name="biotech" size={20} />
          </span>
          <h2 className="text-[22px]">検査オーダー</h2>
          <span className="flex-1" />
          <button onClick={onClose} className="btn btn-filled">
            <Icon name="check" size={20} />
            完了 <span className="kbd">Esc</span>
          </button>
        </div>

        <div className="px-6 max-md:px-4">
          <div className="relative">
            <Icon name="filter_list" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2" />
            <input
              ref={ref}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && visible[0]) {
                  e.preventDefault()
                  toggle(visible[0].code)
                  setQ('')
                }
              }}
              placeholder="絞り込み（例：a1c、かん）Enterで先頭を選択"
              className="h-11 w-full rounded-full bg-white pr-4 pl-10 text-sm outline-none placeholder:text-ink-2/70 hover:bg-surface-2 focus:bg-white focus:shadow-md"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {last && (
              <button onClick={() => last.tests.forEach((t) => !selected.has(t.code) && toggle(t.code))} className="chip max-w-full">
                <Icon name="history" size={18} />
                <span className="truncate">前回と同じ（{last.date}：{last.tests.map((t) => t.name).join('、')}）</span>
              </button>
            )}
            {testSets.map((x) => (
              <button key={x.id} onClick={() => dispatch({ type: 'applySet', setId: x.id })} className="chip">
                <Icon name="playlist_add" size={18} />
                {x.name}
              </button>
            ))}
            <span className="flex-1" />
            {selected.size > 0 && (
              <button onClick={() => dispatch({ type: 'setTests', codes: [] })} className="btn btn-sm btn-danger">
                すべて解除
              </button>
            )}
          </div>
        </div>

        <div className="mx-3 grid flex-1 auto-rows-min grid-cols-2 gap-x-5 gap-y-4 overflow-y-auto rounded-3xl bg-white px-4 py-4 lg:grid-cols-3">
          {TEST_GROUPS.map((g) => {
            const items = visible.filter((t) => t.group === g)
            if (items.length === 0) return null
            return (
              <div key={g}>
                <div className="label mb-1.5 px-1">{g}</div>
                <div className="space-y-1">
                  {items.map((t) => {
                    const on = selected.has(t.code)
                    return (
                      <button
                        key={t.code}
                        onClick={() => toggle(t.code)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          on ? 'bg-lab-ctr font-medium text-lab' : 'hover:bg-surface-1'
                        }`}
                      >
                        <Icon name={on ? 'check_box' : 'check_box_outline_blank'} fill={on} size={20} className={on ? 'text-lab' : 'text-ink-2'} />
                        <span className="min-w-0 flex-1">{t.name}</span>
                        {EXTERNAL_IMAGING.has(t.code) && (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal whitespace-nowrap text-ink-2">外部依頼</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {visible.length === 0 && <div className="col-span-3 py-8 text-center text-ink-2">該当する検査がありません</div>}
        </div>

        <div className="flex min-h-14 flex-wrap items-center gap-1.5 px-6 py-2.5 text-sm">
          <span className="label mr-1">選択中 {selected.size}件</span>
          {draft.tests.map((t) => (
            <span key={t.id} className="inline-flex h-8 items-center gap-1 rounded-lg bg-lab-ctr pr-1 pl-3 text-[13px] font-medium text-lab">
              {t.name}
              <button onClick={() => toggle(t.code)} className="icon-btn h-6 w-6 text-lab" aria-label="解除">
                <Icon name="close" size={16} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
