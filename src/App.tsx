import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CommandPalette, type Command } from './CommandPalette'
import { DISEASES, DRUGS, SETS, TESTS } from './data'
import { LeftPane } from './LeftPane'
import { LetterEditor } from './LetterEditor'
import { Icon } from './Icon'
import { ImageViewer } from './ImageViewer'
import { TestPicker } from './TestPicker'
import { PatientIcon, ageSex, birthLabel } from './PatientIcon'
import { OrderRail, type RailId } from './OrderRail'
import { ChartEditor, PastEditor } from './RightPane'
import { DiseasePanel } from './DiseasePanel'
import { RxWindow } from './RxWindow'
import { Desk, NAV, NavRail, type View } from './Desk'
import { emptyDraft, loadState, reducer, saveState, type Action, type State } from './store'
import type { Patient } from './types'

const GOAL_SECONDS = 60
const GOAL_OPS = 15

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [palette, setPalette] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [view, setView] = useState<View>('reception')
  const [rxOpen, setRxOpen] = useState(false)
  const rxRef = useRef(false)
  rxRef.current = rxOpen
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

  // 病名は確定時にオーダーから自動で更新される（orders.ts の planDiseases）
  const confirm = () => {
    const s = stateRef.current
    const p = s.patients.find((x) => x.id === s.currentId)
    if (!p) return
    const secs = s.session ? Math.round((Date.now() - s.session.startedAt) / 1000) : 0
    const ops = s.session?.ops ?? 0
    const next = s.patients.find((x) => x.status === '待ち' && x.id !== p.id)
    setRxOpen(false)
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

  // 処方ウインドウ（右端の処方アイコン・オーダー欄の「処方」・⌘P）
  const openRx = () => {
    if (!stateRef.current.currentId) return
    dispatch({ type: 'mode', mode: { kind: 'chart' } })
    setRxOpen(true)
  }

  const selectRail = (id: RailId) => {
    const s = stateRef.current
    if (id === 'letter') return toggleLetter()
    if (id === 'test')
      return dispatch({
        type: 'mode',
        mode: s.mode.kind === 'tests' ? { kind: 'chart' } : { kind: 'tests' },
      })
    if (id === 'image')
      return dispatch({
        type: 'mode',
        mode: s.mode.kind === 'images' ? { kind: 'chart' } : { kind: 'images' },
      })
    if (id === 'disease')
      return dispatch({
        type: 'mode',
        mode: s.mode.kind === 'diseases' ? { kind: 'chart' } : { kind: 'diseases' },
      })
    openRx()
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
        if (rxRef.current) return hit(() => setRxOpen(false))
        if (s.mode.kind !== 'chart' && s.mode.kind !== 'letter') hit(() => dispatch({ type: 'mode', mode: { kind: 'chart' } }))
        return
      }
      if (mod && k === 'k') return hit(() => setPalette((v) => !v))
      if (mod && k === 'm') return hit(() => setMetricsOpen((v) => !v))
      if (mod && k === 'j') return hit(nextPatient)
      if (!s.currentId) return
      if (mod && e.shiftKey && k === 'd') return hit(() => dispatch({ type: 'copyLastText' }))
      if (mod && k === 'd') return hit(() => dispatch({ type: 'do' }))
      if (mod && k === 'l') return hit(toggleLetter)
      if (mod && k === 'p') return hit(openRx)
      if (mod && e.key === 'Enter') return hit(() => confirm())
    }
    const onClick = () => {
      if (stateRef.current.session) dispatch({ type: 'op' })
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onClick)
    }
  }, [])

  const commands = useMemo<Command[]>(() => {
    const run = (a: Action) => () => {
      dispatch({ type: 'op' })
      dispatch(a)
    }
    return [
      {
        id: 'a-do',
        group: '操作',
        label: 'Do処方（前回と同じ処方）',
        keys: 'do でぃーおー',
        hint: '⌘D',
        run: run({ type: 'do' }),
      },
      {
        id: 'a-copy',
        group: '操作',
        label: '前回記載をコピー',
        keys: 'copy こぴー ぜんかい',
        hint: '⌘⇧D',
        run: run({ type: 'copyLastText' }),
      },
      {
        id: 'a-letter',
        group: '操作',
        label: '紹介状を作成',
        keys: 'letter しょうかいじょう ぶんしょ',
        hint: '⌘L',
        run: toggleLetter,
      },
      {
        id: 'a-confirm',
        group: '操作',
        label: '確定して会計へ',
        keys: 'confirm かくてい かいけい',
        hint: '⌘Enter',
        run: () => confirm(),
      },
      {
        id: 'a-next',
        group: '操作',
        label: '次の患者',
        keys: 'next つぎ',
        hint: '⌘J',
        run: nextPatient,
      },
      ...SETS.map((x) => ({
        id: x.id,
        group: 'セット' as const,
        label: x.name,
        keys: `${x.kana} ${x.alias}`,
        run: run({ type: 'applySet', setId: x.id }),
      })),
      ...DRUGS.map((d) => ({
        id: d.id,
        group: '処方' as const,
        label: d.name,
        sub: `${d.dose}${d.unit} ${d.usage} ${d.days}日`,
        keys: `${d.kana} ${d.alias}`,
        run: run({ type: 'addRx', drugId: d.id }),
      })),
      ...TESTS.map((t) => ({
        id: t.code,
        group: '検査' as const,
        label: t.name,
        keys: `${t.kana} ${t.alias}`,
        run: run({ type: 'addTest', code: t.code }),
      })),
      ...DISEASES.map((x) => ({
        id: `dz-${x.name}`,
        group: '病名' as const,
        label: x.name,
        keys: `${x.kana} ${x.alias}`,
        run: run({ type: 'addDisease', name: x.name }),
      })),
    ]
  }, [])

  const elapsed = state.session ? Math.round((Date.now() - state.session.startedAt) / 1000) : 0
  const ops = state.session?.ops ?? 0
  const mode = state.mode
  const editing = patient && mode.kind === 'edit-past' ? patient.encounters.find((e) => e.id === mode.encounterId) : undefined

  return (
    <div className="flex h-full bg-page">
      <NavRail
        view={patient ? null : view}
        slim={!!patient}
        onSelect={(v) => {
          setView(v)
          dispatch({ type: 'close' })
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center gap-2 pr-3">
          <span className="hidden pr-2 text-[22px] text-ink-2 lg:inline">保険診療カルテ</span>
          <span className="hidden rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2 xl:inline">試作・架空データ</span>

          <button
            onClick={() => setPalette(true)}
            className="mx-auto flex h-12 w-full max-w-[640px] items-center gap-3 rounded-full bg-surface-2 px-4 text-left text-ink-2 transition-colors hover:bg-surface-2/70 hover:shadow-sm"
          >
            <Icon name="search" size={22} />
            <span className="flex-1 text-[15px]">薬・検査・病名・操作を検索</span>
            <span className="kbd">⌘K</span>
          </button>

          {state.session && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className={`flex h-8 items-center gap-1 rounded-lg px-2.5 font-medium ${elapsed > GOAL_SECONDS ? 'bg-error-ctr text-error' : 'bg-rx-ctr text-rx'}`}>
                <Icon name="timer" size={18} />
                {fmtSec(elapsed)}
              </span>
              <span className={`flex h-8 items-center gap-1 rounded-lg px-2.5 font-medium ${ops > GOAL_OPS ? 'bg-error-ctr text-error' : 'bg-rx-ctr text-rx'}`}>
                <Icon name="ads_click" size={18} />
                {ops}
              </span>
            </div>
          )}
          <button onClick={() => setMetricsOpen(true)} className="icon-btn" title="操作計測（⌘M）">
            <Icon name="monitoring" />
          </button>
        </header>

        <PatientTabs view={view} patients={state.patients} currentId={state.currentId} dispatch={dispatch} />

        {patient ? (
          <>
            <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <PatientIcon patient={patient} size={48} />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] leading-7">{patient.name}</span>
                  <span className="text-sm text-ink-2">{patient.kana}</span>
                </div>
                <div className="text-xs text-ink-2">{birthLabel(patient.birth)}生</div>
              </div>
              <span className="text-base font-medium">{ageSex(patient)}</span>
              <span className="flex h-8 items-center gap-1 rounded-lg border border-outline-var px-3 text-[13px] text-ink-2">
                <Icon name="badge" size={18} />
                {patient.insurance} {Math.round(patient.burden * 10)}割
              </span>
              <span className="flex h-8 items-center rounded-lg border border-outline-var px-3 text-[13px] text-ink-2">{patient.encounters.length === 0 ? '初診' : '再診'}</span>
              <span className="flex-1" />
              <span className={`hidden items-center gap-1 text-xs md:flex ${saveOk ? 'text-ink-2' : 'font-medium text-error'}`}>
                <Icon name={saveOk ? (draft.savedAt ? 'cloud_done' : 'draft') : 'error'} size={18} />
                {saveOk ? (draft.savedAt ? `下書き保存 ${draft.savedAt}` : '下書きなし') : '下書きを保存できません'}
              </span>
              <button onClick={() => confirm()} className="btn btn-filled">
                <Icon name="check" size={20} />
                確定して会計へ <span className="kbd">⌘Enter</span>
              </button>
            </div>
            <main className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-1 lg:flex-row">
              <div className="no-print card min-h-0 shrink-0 basis-[34%] overflow-hidden lg:shrink lg:basis-0 lg:flex-[2]">
                <LeftPane
                  patient={patient}
                  selectedId={editing?.id ?? null}
                  onDo={(id) => dispatch({ type: 'do', encounterId: id })}
                  onQuote={(text) =>
                    mode.kind === 'letter'
                      ? dispatch({
                          type: 'letter',
                          patch: {
                            body: draft.letter?.body ? `${draft.letter.body}\n${text}` : text,
                          },
                        })
                      : dispatch({ type: 'insertText', text })
                  }
                  onEdit={(id) =>
                    dispatch({
                      type: 'mode',
                      mode: { kind: 'edit-past', encounterId: id },
                    })
                  }
                />
              </div>
              <div className="flex min-h-0 flex-1 gap-2 lg:flex-[3]">
                <div className="card min-h-0 flex-1 overflow-hidden">
                  {mode.kind === 'letter' ? (
                    <LetterEditor patient={patient} draft={draft} dispatch={dispatch} />
                  ) : mode.kind === 'tests' ? (
                    <TestPicker patient={patient} draft={draft} dispatch={dispatch} />
                  ) : mode.kind === 'images' ? (
                    <ImageViewer key={patient.id} patientName={patient.name} />
                  ) : mode.kind === 'diseases' ? (
                    <DiseasePanel patient={patient} draft={draft} dispatch={dispatch} />
                  ) : editing ? (
                    <PastEditor key={editing.id} encounter={editing} dispatch={dispatch} />
                  ) : (
                    <ChartEditor key={patient.id} patient={patient} draft={draft} dispatch={dispatch} onOpenRx={openRx} />
                  )}
                </div>
                <OrderRail
                  active={mode.kind === 'letter' ? 'letter' : mode.kind === 'images' ? 'image' : mode.kind === 'tests' ? 'test' : mode.kind === 'diseases' ? 'disease' : null}
                  onSelect={selectRail}
                />
              </div>
            </main>
          </>
        ) : (
          <Desk view={view} patients={state.patients} dispatch={dispatch} onMetrics={() => setMetricsOpen(true)} />
        )}

        <footer className="no-print touch:hidden flex shrink-0 flex-wrap gap-x-4 gap-y-1 px-5 py-2 text-xs text-ink-2">
          {[
            ['⌘K', '検索・追加'],
            ['⌘P', '処方'],
            ['⌘D', 'Do処方'],
            ['⌘⇧D', '前回記載コピー'],
            ['⌘L', '紹介状'],
            ['⌘Enter', '確定'],
            ['⌘J', '次の患者'],
          ].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="kbd">{k}</span>
              {l}
            </span>
          ))}
          <span className="flex-1" />
          <span>
            目標：再診 {GOAL_SECONDS}秒・{GOAL_OPS}操作以内
          </span>
        </footer>
      </div>

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {rxOpen && patient && <RxWindow patient={patient} draft={draft} dispatch={dispatch} onClose={() => setRxOpen(false)} />}
      {metricsOpen && <MetricsPanel state={state} dispatch={dispatch} onClose={() => setMetricsOpen(false)} />}
      {toast && (
        <div className="no-print fixed bottom-6 left-6 z-50 flex min-w-[344px] items-center gap-3 rounded-lg bg-[#303030] px-4 py-3.5 text-sm text-[#f2f2f2] shadow-lg">
          <Icon name="check_circle" size={20} className="text-[#a8c7fa]" />
          {toast}
        </div>
      )}
    </div>
  )
}

// 受付一覧と診察対象の患者を切り替えるタブ（ブラウザ型）
function PatientTabs({ view, patients, currentId, dispatch }: { view: View; patients: Patient[]; currentId: string | null; dispatch: (a: Action) => void }) {
  const open = patients.filter((p) => p.status === '待ち' || p.status === '診察中')
  const home = currentId === null
  const nav = NAV.find((n) => n.id === view) ?? NAV[1]
  const goHome = () => dispatch({ type: 'close' })
  const openP = (id: string) => dispatch({ type: 'open', patientId: id })
  const tab = (on: boolean) =>
    `relative -mb-px flex h-10 max-w-60 touch:h-12 shrink-0 items-center gap-2 rounded-t-xl px-3 text-sm transition-colors ${
      on ? 'z-10 bg-page font-medium text-ink' : 'text-ink-2 hover:bg-white/60'
    }`
  return (
    <div role="tablist" className="no-print flex shrink-0 items-end gap-0.5 overflow-x-auto bg-surface-2 px-2 pt-2">
      <button role="tab" aria-selected={home} onClick={goHome} className={tab(home)}>
        <Icon name={nav.icon} fill={home} size={18} />
        {nav.label} {view === 'reception' && <span className="text-xs text-ink-2">{open.length}</span>}
      </button>
      {open.map((p, i) => {
        const on = p.id === currentId
        const prevOn = i === 0 ? home : open[i - 1].id === currentId
        return (
          <button key={p.id} role="tab" aria-selected={on} onClick={() => openP(p.id)} className={tab(on)}>
            {!on && !prevOn && <span className="absolute top-2.5 left-0 h-5 w-px bg-outline-var" />}
            <PatientIcon patient={p} size={20} />
            <span className="truncate">{p.name}</span>
            <span className="text-xs text-ink-2">{ageSex(p)}</span>
            {p.status === '診察中' && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

function MetricsPanel({ state, dispatch, onClose }: { state: State; dispatch: (a: Action) => void; onClose: () => void }) {
  const m = state.metrics
  const avg = (f: (x: (typeof m)[number]) => number) => (m.length ? Math.round(m.reduce((s, x) => s + f(x), 0) / m.length) : 0)
  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div className="w-[640px] max-w-[92vw] rounded-[28px] bg-surface-1 p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-3">
          <Icon name="monitoring" size={24} className="text-primary" />
          <h2 className="flex-1 text-2xl">操作計測</h2>
          <button onClick={onClose} className="icon-btn" title="閉じる（Esc）">
            <Icon name="close" />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-2">
          患者を開いてから確定までの時間と操作数（クリック＋ショートカット。文字入力は含まない）。目標は再診 {GOAL_SECONDS}秒・{GOAL_OPS}操作以内。
        </p>
        {m.length === 0 ? (
          <div className="rounded-2xl bg-white py-10 text-center text-ink-2">まだ計測結果がありません</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-2">
                <tr>
                  <th className="px-4 py-2 font-medium">患者</th>
                  <th className="font-medium">区分</th>
                  <th className="text-right font-medium">時間</th>
                  <th className="text-right font-medium">操作</th>
                  <th className="px-4 text-right font-medium">判定</th>
                </tr>
              </thead>
              <tbody>
                {m.map((x) => {
                  const ok = x.seconds <= GOAL_SECONDS && x.ops <= GOAL_OPS
                  return (
                    <tr key={x.at} className="border-t border-surface-2">
                      <td className="px-4 py-2">{x.patientName}</td>
                      <td>{x.kind}</td>
                      <td className="text-right tabular-nums">{fmtSec(x.seconds)}</td>
                      <td className="text-right tabular-nums">{x.ops}</td>
                      <td className="px-4 text-right">
                        {x.kind === '再診' ? (
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${ok ? 'bg-rx-ctr text-rx' : 'bg-error-ctr text-error'}`}>{ok ? '達成' : '未達'}</span>
                        ) : (
                          <span className="text-xs text-ink-2">対象外</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t border-outline-var font-medium">
                  <td className="px-4 py-2">平均（{m.length}件）</td>
                  <td></td>
                  <td className="text-right tabular-nums">{fmtSec(avg((x) => x.seconds))}</td>
                  <td className="text-right tabular-nums">{avg((x) => x.ops)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={() => dispatch({ type: 'clearMetrics' })} className="btn btn-sm btn-text">
            計測結果を消去
          </button>
        </div>
      </div>
    </div>
  )
}
