import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { SETS, TESTS, TEST_GROUPS } from './data'
import type { Action } from './store'
import type { Draft, Patient } from './types'

// 検査オーダー画面。分類ごとに項目を並べ、押すとその場で選択・解除する（確定ボタンを挟まない）。
export function TestPicker({ patient, draft, dispatch }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void }) {
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
  const back = () => dispatch({ type: 'mode', mode: { kind: 'chart' } })

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
        <h2 className="font-semibold text-violet-700">検査オーダー</h2>
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
          className="w-64 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        />
        <span className="flex-1" />
        <button onClick={back} className="rounded bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700">
          完了 <kbd className="opacity-70">Esc</kbd>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-xs">
        {last && (
          <button
            onClick={() => last.tests.forEach((t) => !selected.has(t.code) && toggle(t.code))}
            className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-violet-800 hover:bg-violet-100"
          >
            前回と同じ（{last.date}：{last.tests.map((t) => t.name).join('、')}）
          </button>
        )}
        {testSets.map((x) => (
          <button key={x.id} onClick={() => dispatch({ type: 'applySet', setId: x.id })} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
            {x.name}
          </button>
        ))}
        <span className="flex-1" />
        {selected.size > 0 && (
          <button onClick={() => dispatch({ type: 'setTests', codes: [] })} className="px-2 py-1 text-slate-500 hover:text-red-600">
            選択をすべて解除
          </button>
        )}
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-3 gap-x-4 gap-y-3 overflow-y-auto px-4 py-3">
        {TEST_GROUPS.map((g) => {
          const items = visible.filter((t) => t.group === g)
          if (items.length === 0) return null
          return (
            <div key={g}>
              <div className="mb-1 border-b border-slate-200 pb-0.5 text-xs font-semibold text-slate-500">{g}</div>
              <div className="space-y-1">
                {items.map((t) => {
                  const on = selected.has(t.code)
                  return (
                    <button
                      key={t.code}
                      onClick={() => toggle(t.code)}
                      className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                        on ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50'
                      }`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] ${on ? 'border-white' : 'border-slate-400'}`}>{on && '✓'}</span>
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <div className="col-span-3 py-8 text-center text-slate-400">該当する検査がありません</div>}
      </div>

      <div className="flex min-h-11 flex-wrap items-center gap-1.5 border-t border-slate-200 bg-violet-50/50 px-4 py-2 text-sm">
        <span className="text-xs text-slate-500">選択中 {selected.size}件</span>
        {draft.tests.map((t) => (
          <span key={t.id} className="flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5">
            {t.name}
            <button onClick={() => toggle(t.code)} className="text-slate-400 hover:text-red-600" aria-label="解除">
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
