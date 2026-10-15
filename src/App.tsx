import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CommandPalette, type Command } from './CommandPalette'
import { DISEASES, DRUGS, SETS, TESTS, age } from './data'
import { LeftPane } from './LeftPane'
import { LetterEditor } from './LetterEditor'
import { ChartEditor, PastEditor } from './RightPane'
import { emptyDraft, loadState, reducer, saveState, type Action, type State } from './store'
import type { Patient, QueueStatus } from './types'

const GOAL_SECONDS = 60
const GOAL_OPS = 15

const STATUS_STYLE: Record<QueueStatus, string> = {
  待ち: 'bg-amber-100 text-amber-800',
  診察中: 'bg-blue-600 text-white',
  会計待ち: 'bg-emerald-100 text-emerald-800',
  済: 'bg-slate-100 text-slate-400',
}

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [palette, setPalette] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [saveOk, setSaveOk] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [, tick] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const patient = state.patients.find((p) => p.id === state.currentId) ?? null
  const draft = (patient && state.drafts[patient.id]) || emptyDraft()

  useEffect(() => setSaveOk(saveState(state)), [state])
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const confirm = () => {
    const s = stateRef.current
    const p = s.patients.find((x) => x.id === s.currentId)
    if (!p) return
    const secs = s.session ? Math.round((Date.now() - s.session.startedAt) / 1000) : 0
    const ops = s.session?.ops ?? 0
    const next = s.patients.find((x) => x.status === '待ち' && x.id !== p.id)
    dispatch({ type: 'confirm' })
    setToast(`${p.name} を確定（${secs}秒・${ops}操作）${next ? ` → 次：${next.name}` : ' → 待ち患者なし'}`)
  }

  const nextPatient = () => {
    const s = stateRef.current
    const open = s.patients.filter((p) => p.status === '待ち' || p.status === '診察中')
    if (open.length === 0) return
    const i = open.findIndex((p) => p.id === s.currentId)
    dispatch({ type: 'open', patientId: open[(i + 1) % open.length].id })
  }

  const toggleLetter = () => {
    const s = stateRef.current
    if (!s.currentId) return
    if (s.mode.kind === 'letter') return dispatch({ type: 'mode', mode: { kind: 'chart' } })
    if (!s.drafts[s.currentId]?.letter) dispatch({ type: 'letter', patch: {} })
    dispatch({ type: 'mode', mode: { kind: 'letter' } })
  }

  // ショートカットとクリックを「操作数」として数える（文字入力は数えない）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      const s = stateRef.current
      const hit = (fn: () => void) => {
        e.preventDefault()
        dispatch({ type: 'op' })
        fn()
      }
      if (e.key === 'Escape') {
        setMetricsOpen(false)
        if (s.mode.kind === 'edit-past') hit(() => dispatch({ type: 'mode', mode: { kind: 'chart' } }))
        return
      }
      if (mod && k === 'k') return hit(() => setPalette((v) => !v))
      if (mod && k === 'm') return hit(() => setMetricsOpen((v) => !v))
      if (mod && k === 'j') return hit(nextPatient)
      if (!s.currentId) return
      if (mod && e.shiftKey && k === 'd') return hit(() => dispatch({ type: 'copyLastText' }))
      if (mod && k === 'd') return hit(() => dispatch({ type: 'do' }))
      if (mod && k === 'l') return hit(toggleLetter)
      if (mod && e.key === 'Enter') return hit(confirm)
    }
    const onClick = () => {
      if (stateRef.current.session) dispatch({ type: 'op' })
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [])

  const commands = useMemo<Command[]>(() => {
    const run = (a: Action) => () => {
      dispatch({ type: 'op' })
      dispatch(a)
    }
    return [
      { id: 'a-do', group: '操作', label: 'Do処方（前回と同じ処方）', keys: 'do でぃーおー', hint: '⌘D', run: run({ type: 'do' }) },
      { id: 'a-copy', group: '操作', label: '前回記載をコピー', keys: 'copy こぴー ぜんかい', hint: '⌘⇧D', run: run({ type: 'copyLastText' }) },
      { id: 'a-letter', group: '操作', label: '紹介状を作成', keys: 'letter しょうかいじょう ぶんしょ', hint: '⌘L', run: toggleLetter },
      { id: 'a-confirm', group: '操作', label: '確定して会計へ', keys: 'confirm かくてい かいけい', hint: '⌘Enter', run: confirm },
      { id: 'a-next', group: '操作', label: '次の患者', keys: 'next つぎ', hint: '⌘J', run: nextPatient },
      ...SETS.map((x) => ({ id: x.id, group: 'セット' as const, label: x.name, keys: `${x.kana} ${x.alias}`, run: run({ type: 'applySet', setId: x.id }) })),
      ...DRUGS.map((d) => ({
        id: d.id,
        group: '処方' as const,
        label: d.name,
        sub: `${d.dose}${d.unit} ${d.usage} ${d.days}日`,
        keys: `${d.kana} ${d.alias}`,
        run: run({ type: 'addRx', drugId: d.id }),
      })),
      ...TESTS.map((t) => ({ id: t.code, group: '検査' as const, label: t.name, keys: `${t.kana} ${t.alias}`, run: run({ type: 'addTest', code: t.code }) })),
      ...DISEASES.map((x) => ({ id: `dz-${x.name}`, group: '病名' as const, label: x.name, keys: `${x.kana} ${x.alias}`, run: run({ type: 'addDisease', name: x.name }) })),
    ]
  }, [])

  const elapsed = state.session ? Math.round((Date.now() - state.session.startedAt) / 1000) : 0
  const ops = state.session?.ops ?? 0
  const mode = state.mode
  const editing = patient && mode.kind === 'edit-past' ? patient.encounters.find((e) => e.id === mode.encounterId) : undefined

  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex items-center gap-3 bg-slate-900 px-4 py-2 text-white">
        <button onClick={() => dispatch({ type: 'close' })} className="font-semibold">
          保険診療カルテ
        </button>
        <span className="rounded bg-slate-700 px-1.5 text-xs">試作・架空データ</span>
        <div className="flex flex-1 gap-1.5 overflow-x-auto">
          {state.patients.map((p) => (
            <button
              key={p.id}
              onClick={() => dispatch({ type: 'open', patientId: p.id })}
              disabled={p.status === '会計待ち' || p.status === '済'}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${STATUS_STYLE[p.status]} ${p.id === state.currentId ? 'ring-2 ring-white' : ''}`}
            >
              {p.name}・{p.status}
            </button>
          ))}
        </div>
        {state.session && (
          <div className="flex gap-3 font-mono text-sm">
            <span className={elapsed > GOAL_SECONDS ? 'text-red-300' : 'text-emerald-300'}>⏱ {fmtSec(elapsed)}</span>
            <span className={ops > GOAL_OPS ? 'text-red-300' : 'text-emerald-300'}>操作 {ops}</span>
          </div>
        )}
        <button onClick={() => setMetricsOpen(true)} className="rounded border border-slate-600 px-2 py-1 text-xs">
          計測 ⌘M
        </button>
      </header>

      {patient ? (
        <>
          <div className="no-print flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
            <div>
              <span className="text-lg font-bold">{patient.name}</span>
              <span className="ml-2 text-sm text-slate-500">{patient.kana}</span>
            </div>
            <span className="text-sm">
              {age(patient.birth)}歳 {patient.sex}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-sm">
              {patient.insurance} {Math.round(patient.burden * 10)}割
            </span>
            <span className="text-sm text-slate-500">{patient.encounters.length === 0 ? '初診' : '再診'}</span>
            <span className="flex-1" />
            <div className="flex overflow-hidden rounded border border-slate-300 text-sm">
              <button
                onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })}
                className={`px-3 py-1 ${mode.kind !== 'letter' ? 'bg-slate-800 text-white' : ''}`}
              >
                カルテ
              </button>
              <button onClick={toggleLetter} className={`px-3 py-1 ${mode.kind === 'letter' ? 'bg-slate-800 text-white' : ''}`}>
                紹介状{draft.letter && ' ●'}
              </button>
            </div>
            <span className={`text-xs ${saveOk ? 'text-slate-500' : 'font-bold text-red-600'}`}>
              {saveOk ? (draft.savedAt ? `下書き保存 ${draft.savedAt}` : '下書きなし') : '下書きを保存できません'}
            </span>
            <button onClick={confirm} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
              確定して会計へ <kbd className="opacity-70">⌘Enter</kbd>
            </button>
          </div>
          <main className="grid min-h-0 flex-1 grid-cols-[2fr_3fr]">
            <div className="no-print min-h-0 border-r border-slate-200 bg-slate-50">
              <LeftPane
                patient={patient}
                selectedId={editing?.id ?? null}
                onDo={(id) => dispatch({ type: 'do', encounterId: id })}
                onQuote={(text) =>
                  mode.kind === 'letter'
                    ? dispatch({ type: 'letter', patch: { body: draft.letter?.body ? `${draft.letter.body}\n${text}` : text } })
                    : dispatch({ type: 'insertText', text })
                }
                onEdit={(id) => dispatch({ type: 'mode', mode: { kind: 'edit-past', encounterId: id } })}
              />
            </div>
            <div className="min-h-0">
              {mode.kind === 'letter' ? (
                <LetterEditor patient={patient} draft={draft} dispatch={dispatch} />
              ) : editing ? (
                <PastEditor key={editing.id} encounter={editing} dispatch={dispatch} />
              ) : (
                <ChartEditor key={patient.id} patient={patient} draft={draft} dispatch={dispatch} openPalette={() => setPalette(true)} />
              )}
            </div>
          </main>
        </>
      ) : (
        <Reception patients={state.patients} dispatch={dispatch} />
      )}

      <footer className="no-print flex gap-4 border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500">
        <span>⌘K 検索・追加</span>
        <span>⌘D Do処方</span>
        <span>⌘⇧D 前回記載コピー</span>
        <span>⌘L 紹介状</span>
        <span>⌘Enter 確定</span>
        <span>⌘J 次の患者</span>
        <span className="flex-1" />
        <span>
          目標：再診 {GOAL_SECONDS}秒・{GOAL_OPS}操作以内
        </span>
      </footer>

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {metricsOpen && <MetricsPanel state={state} dispatch={dispatch} onClose={() => setMetricsOpen(false)} />}
      {toast && <div className="no-print fixed bottom-12 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}

function Reception({ patients, dispatch }: { patients: Patient[]; dispatch: (a: Action) => void }) {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <h1 className="mb-3 text-lg font-bold">受付・会計</h1>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">状態</th>
              <th className="px-3 py-2">氏名</th>
              <th className="px-3 py-2">年齢</th>
              <th className="px-3 py-2">保険</th>
              <th className="px-3 py-2">今日の内容</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const done = p.status === '会計待ち' || p.status === '済'
              const last = p.encounters.at(-1)
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{age(p.birth)}</td>
                  <td className="px-3 py-2">
                    {p.insurance} {Math.round(p.burden * 10)}割
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {done && last ? `${last.kind}・処方${last.rx.length}剤・検査${last.tests.length}件${last.letters.length ? '・紹介状' : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!done && (
                      <button onClick={() => dispatch({ type: 'open', patientId: p.id })} className="rounded bg-blue-600 px-3 py-1 text-xs text-white">
                        診察
                      </button>
                    )}
                    {p.status === '会計待ち' && (
                      <button onClick={() => dispatch({ type: 'paid', patientId: p.id })} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">
                        会計済にする
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">点数・窓口負担の計算は算定エンジン（Phase 3）で実装します。この画面は流れの確認用です。</p>
      <button onClick={() => dispatch({ type: 'reset' })} className="mt-6 rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-500">
        架空データを初期状態に戻す
      </button>
    </main>
  )
}

function MetricsPanel({ state, dispatch, onClose }: { state: State; dispatch: (a: Action) => void; onClose: () => void }) {
  const m = state.metrics
  const avg = (f: (x: (typeof m)[number]) => number) => (m.length ? Math.round(m.reduce((s, x) => s + f(x), 0) / m.length) : 0)
  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className="w-[640px] max-w-[92vw] rounded-xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">操作計測</h2>
          <button onClick={onClose} className="text-sm text-slate-400">
            閉じる Esc
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          患者を開いてから確定までの時間と操作数（クリック＋ショートカット。文字入力は含まない）。目標は再診 {GOAL_SECONDS}秒・{GOAL_OPS}操作以内。
        </p>
        {m.length === 0 ? (
          <div className="py-8 text-center text-slate-400">まだ計測結果がありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1">患者</th>
                <th>区分</th>
                <th className="text-right">時間</th>
                <th className="text-right">操作</th>
                <th className="text-right">判定</th>
              </tr>
            </thead>
            <tbody>
              {m.map((x) => {
                const ok = x.seconds <= GOAL_SECONDS && x.ops <= GOAL_OPS
                return (
                  <tr key={x.at} className="border-t border-slate-100">
                    <td className="py-1">{x.patientName}</td>
                    <td>{x.kind}</td>
                    <td className="text-right font-mono">{fmtSec(x.seconds)}</td>
                    <td className="text-right font-mono">{x.ops}</td>
                    <td className={`text-right ${x.kind === '再診' ? (ok ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`}>
                      {x.kind === '再診' ? (ok ? '達成' : '未達') : '対象外'}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-1">平均（{m.length}件）</td>
                <td></td>
                <td className="text-right font-mono">{fmtSec(avg((x) => x.seconds))}</td>
                <td className="text-right font-mono">{avg((x) => x.ops)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={() => dispatch({ type: 'clearMetrics' })} className="rounded border border-slate-300 px-3 py-1 text-xs">
            計測結果を消去
          </button>
        </div>
      </div>
    </div>
  )
}
