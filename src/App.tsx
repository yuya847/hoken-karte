import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CommandPalette, type Command } from './CommandPalette'
import { DISEASES, DRUGS, SETS, TESTS } from './data'
import { LeftPane } from './LeftPane'
import { LetterEditor } from './LetterEditor'
import { Icon } from './Icon'
import { daysText, doseText, usageText } from './rxFormat'
import { PacsPanel } from './PacsPanel'
import { TestWindow } from './TestWindow'
import { PatientIcon, ageSex, birthLabel } from './PatientIcon'
import { OrderBar, OrderRail, type RailId } from './OrderRail'
import { ChartEditor, PastEditor } from './RightPane'
import { DiseasePanel } from './DiseasePanel'
import { RxWindow } from './RxWindow'
import { Desk, MobileTabBar, NAV, NavRail, type View } from './Desk'
import { emptyDraft, loadState, reducer, saveState, type Action, type State } from './store'
import type { Draft, Patient } from './types'

const GOAL_SECONDS = 60
const GOAL_OPS = 15

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [palette, setPalette] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [view, setView] = useState<View>('reception')
  const [rxOpen, setRxOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const winRef = useRef({ rx: false, test: false })
  winRef.current = { rx: rxOpen, test: testOpen }
  // ✗で閉じた患者タブ（もう一度開けば戻る）
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set())
  // ドラッグで並べ替えたタブの順（患者ID）
  const [tabOrder, setTabOrder] = useState<string[]>([])
  // 確定していない患者のタブを閉じようとしたときの確認
  const [closing, setClosing] = useState<string | null>(null)
  const closingRef = useRef<string | null>(null)
  closingRef.current = closing
  // スマホ（md未満）では過去の記録と今回の記載を切り替えて1つずつ出す
  const [phonePane, setPhonePane] = useState<'past' | 'now'>('now')
  const [saveOk, setSaveOk] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [, tick] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const patient = state.patients.find((p) => p.id === state.currentId) ?? null
  const draft = (patient && state.drafts[patient.id]) || emptyDraft()
  const mk = state.mode.kind
  const railActive: RailId | null = mk === 'letter' ? 'letter' : mk === 'images' ? 'image' : testOpen ? 'test' : mk === 'diseases' ? 'disease' : null

  useEffect(() => setSaveOk(saveState(state)), [state])
  useEffect(() => {
    const id = state.currentId
    if (id) setClosedTabs((cur) => (cur.has(id) ? new Set([...cur].filter((x) => x !== id)) : cur))
    setPhonePane('now')
  }, [state.currentId])
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
    setTestOpen(false)
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

  // 検査ウインドウ（右端の検査アイコン・オーダー欄の「検査」・⌘E）
  const openTests = () => {
    if (!stateRef.current.currentId) return
    dispatch({ type: 'mode', mode: { kind: 'chart' } })
    setTestOpen(true)
  }

  const selectRail = (id: RailId) => {
    const s = stateRef.current
    setPhonePane('now')
    if (id === 'letter') return toggleLetter()
    if (id === 'test') return openTests()
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
        if (closingRef.current) return hit(() => setClosing(null))
        if (winRef.current.rx) return hit(() => setRxOpen(false))
        if (winRef.current.test) return hit(() => setTestOpen(false))
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
      if (mod && k === 'e') return hit(openTests)
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
        sub: `${doseText(d)} ${usageText(d.usage)} ${daysText(d)}`,
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

  const closeTab = (id: string) => {
    setClosing(null)
    setClosedTabs((cur) => new Set(cur).add(id))
    if (stateRef.current.currentId === id) dispatch({ type: 'close' })
  }

  const selectView = (v: View) => {
    setView(v)
    dispatch({ type: 'close' })
  }

  return (
    <div className="flex h-full bg-page">
      <NavRail view={patient ? null : view} slim={!!patient} onSelect={selectView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center gap-2 pr-3 max-md:h-12 max-md:pl-3">
          <span className="hidden pr-2 text-[22px] text-ink-2 lg:inline">保険診療カルテ</span>
          <span className="hidden rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2 xl:inline">試作・架空データ</span>

          <span className="flex-1" />

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

        <PatientTabs
          view={view}
          patients={state.patients}
          currentId={state.currentId}
          closed={closedTabs}
          order={tabOrder}
          onReorder={setTabOrder}
          onClose={(id) => (isDirty(stateRef.current.drafts[id]) ? setClosing(id) : closeTab(id))}
          dispatch={dispatch}
        />

        {patient ? (
          <>
            <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 max-md:gap-x-2 max-md:px-3 max-md:py-2">
              <span className="max-md:hidden">
                <PatientIcon patient={patient} size={48} />
              </span>
              <div className="whitespace-nowrap">
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] leading-7 max-md:text-lg">{patient.name}</span>
                  <span className="text-sm text-ink-2 max-md:hidden">{patient.kana}</span>
                </div>
                <div className="text-xs text-ink-2 max-md:hidden">{birthLabel(patient.birth)}生</div>
              </div>
              <span className="text-base font-medium whitespace-nowrap">{ageSex(patient)}</span>
              {/* アレルギーは無くても「—」で必ず出す（確認したかどうかが分かる） */}
              <span
                className={`flex h-8 items-center gap-1 rounded-lg px-3 text-[13px] whitespace-nowrap max-md:order-last ${
                  patient.allergies.length ? 'bg-error-ctr font-medium text-error' : 'border border-outline-var text-ink-2'
                }`}
              >
                <Icon name={patient.allergies.length ? 'warning' : 'check'} fill={patient.allergies.length > 0} size={18} />
                アレルギー {patient.allergies.length ? patient.allergies.join('、') : '—'}
              </span>
              <span className="flex h-8 items-center gap-1 rounded-lg border border-outline-var px-3 text-[13px] whitespace-nowrap text-ink-2 max-md:hidden">
                <Icon name="badge" size={18} />
                {patient.insurance} {Math.round(patient.burden * 10)}割
              </span>
              <span className="flex h-8 items-center rounded-lg border border-outline-var px-3 text-[13px] whitespace-nowrap text-ink-2 max-md:hidden">{patient.encounters.length === 0 ? '初診' : '再診'}</span>
              <span className="flex-1 max-md:hidden" />
              <span className={`hidden items-center gap-1 text-xs md:flex ${saveOk ? 'text-ink-2' : 'font-medium text-error'}`}>
                <Icon name={saveOk ? (draft.savedAt ? 'cloud_done' : 'draft') : 'error'} size={18} />
                {saveOk ? (draft.savedAt ? `下書き保存 ${draft.savedAt}` : '下書きなし') : '下書きを保存できません'}
              </span>
              <button onClick={() => confirm()} className="btn btn-filled max-md:ml-auto max-md:h-10 max-md:px-4">
                <Icon name="check" size={20} />
                <span className="md:hidden">確定</span>
                <span className="max-md:hidden">確定して会計へ</span> <span className="kbd">⌘Enter</span>
              </button>
            </div>
            <div role="tablist" aria-label="表示" className="no-print mx-3 mb-2 flex rounded-full bg-surface-2 p-1 md:hidden">
              {(
                [
                  ['past', `過去の記録（${patient.encounters.length}）`],
                  ['now', '今回の記載'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={phonePane === k}
                  onClick={() => setPhonePane(k)}
                  className={`h-10 flex-1 rounded-full text-sm font-medium ${phonePane === k ? 'bg-white text-ink shadow-sm' : 'text-ink-2'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <main className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-1 lg:flex-row">
              <div
                className={`no-print card min-h-0 shrink-0 basis-[34%] overflow-hidden lg:shrink lg:basis-0 lg:flex-[2] max-md:flex-1 max-md:basis-auto ${phonePane === 'past' ? '' : 'max-md:hidden'}`}
              >
                <LeftPane
                  patient={patient}
                  selectedId={editing?.id ?? null}
                  onDo={(id) => {
                    dispatch({ type: 'do', encounterId: id })
                    setPhonePane('now')
                  }}
                  onQuote={(text) => {
                    setPhonePane('now')
                    return mode.kind === 'letter'
                      ? dispatch({
                          type: 'letter',
                          patch: {
                            body: draft.letter?.body ? `${draft.letter.body}\n${text}` : text,
                          },
                        })
                      : dispatch({ type: 'insertText', text })
                  }}
                  onEdit={(id) => {
                    setPhonePane('now')
                    dispatch({
                      type: 'mode',
                      mode: { kind: 'edit-past', encounterId: id },
                    })
                  }}
                />
              </div>
              <div className={`flex min-h-0 flex-1 gap-2 lg:flex-[3] ${phonePane === 'now' ? '' : 'max-md:hidden'}`}>
                <div className="card min-h-0 flex-1 overflow-hidden">
                  {mode.kind === 'letter' ? (
                    <LetterEditor patient={patient} draft={draft} dispatch={dispatch} />
                  ) : mode.kind === 'images' ? (
                    <PacsPanel patient={patient} draft={draft} onClose={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} />
                  ) : mode.kind === 'diseases' ? (
                    <DiseasePanel patient={patient} draft={draft} dispatch={dispatch} />
                  ) : editing ? (
                    <PastEditor key={editing.id} encounter={editing} dispatch={dispatch} />
                  ) : (
                    <ChartEditor key={patient.id} patient={patient} draft={draft} dispatch={dispatch} onOpenRx={openRx} onOpenTests={openTests} />
                  )}
                </div>
                <OrderRail
                  active={railActive}
                  onSelect={selectRail}
                />
              </div>
            </main>
          </>
        ) : (
          <Desk view={view} patients={state.patients} dispatch={dispatch} onMetrics={() => setMetricsOpen(true)} />
        )}

        <footer className="no-print touch:hidden flex max-md:hidden shrink-0 flex-wrap gap-x-4 gap-y-1 px-5 py-2 text-xs text-ink-2">
          {[
            ['⌘K', '検索・追加'],
            ['⌘P', '処方'],
            ['⌘E', '検査'],
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
        {patient ? <OrderBar active={railActive} onSelect={selectRail} /> : <MobileTabBar view={view} onSelect={selectView} />}
      </div>

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {closing && (
        <CloseDialog
          patient={state.patients.find((p) => p.id === closing)!}
          onCancel={() => setClosing(null)}
          onKeep={() => closeTab(closing)}
          onDiscard={() => {
            dispatch({ type: 'discardDraft', patientId: closing })
            closeTab(closing)
          }}
        />
      )}
      {testOpen && patient && <TestWindow patient={patient} draft={draft} dispatch={dispatch} onClose={() => setTestOpen(false)} />}
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

const isDirty = (d?: Draft) => !!d && (d.text.trim() !== '' || d.rx.length > 0 || d.tests.length > 0 || !!d.letter)

// 確定していない患者のタブを✗で閉じるときの確認。下書きは残すのが既定
function CloseDialog({ patient, onCancel, onKeep, onDiscard }: { patient: Patient; onCancel: () => void; onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onPointerDown={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label="タブを閉じる" className="w-[520px] max-w-full rounded-[28px] bg-surface-1 p-6 shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
        <Icon name="edit_note" size={24} className="text-primary" />
        <h2 className="mt-3 text-2xl">{patient.name}さんのカルテは確定していません</h2>
        <p className="mt-3 text-sm text-ink-2">記載とオーダーは下書きとして残っています。下書きを残して閉じれば、次に開いたときに続きから書けます。</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button onClick={onCancel} className="btn btn-text">
            キャンセル
          </button>
          <button onClick={onDiscard} className="btn btn-danger">
            破棄して閉じる
          </button>
          <button autoFocus onClick={onKeep} className="btn btn-filled">
            下書きを残して閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// 受付一覧と診察対象の患者を切り替えるタブ（ブラウザ型）。✗で閉じたタブは、その患者をもう一度開くまで出さない。
// ドラッグで並べ替えられる（タッチは長押ししてから動かす。すぐ動かすとタブ列の横スクロール）
type TabsProps = {
  view: View
  patients: Patient[]
  currentId: string | null
  closed: Set<string>
  order: string[]
  onReorder: (ids: string[]) => void
  onClose: (id: string) => void
  dispatch: (a: Action) => void
}

type DragState = { id: string; x: number; at: number; touch: boolean; started: boolean }

function PatientTabs({ view, patients, currentId, closed, order, onReorder, onClose, dispatch }: TabsProps) {
  const waiting = patients.filter((p) => p.status === '待ち' || p.status === '診察中')
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length + patients.findIndex((p) => p.id === id))
  const open = patients.filter((p) => p.id === currentId || ((p.status === '待ち' || p.status === '診察中') && !closed.has(p.id))).sort((a, b) => rank(a.id) - rank(b.id))
  const home = currentId === null
  const nav = NAV.find((n) => n.id === view) ?? NAV[1]
  const goHome = () => dispatch({ type: 'close' })
  const openP = (id: string) => dispatch({ type: 'open', patientId: id })

  const listRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const justDragged = useRef(false)
  const [dragging, setDragging] = useState<string | null>(null)

  // ドラッグ中はタッチでタブ列がスクロールしないようにする
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const stop = (e: TouchEvent) => drag.current?.started && e.preventDefault()
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [])

  const onDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return
    drag.current = { id, x: e.clientX, at: Date.now(), touch: e.pointerType !== 'mouse', started: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.started) {
      const moved = Math.abs(e.clientX - d.x)
      if (d.touch && Date.now() - d.at < 300) {
        if (moved > 8) drag.current = null
        return
      }
      if (moved < 6 && !d.touch) return
      d.started = true
      setDragging(d.id)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    const over = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-tab]') ?? [])].find((el) => {
      const r = el.getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right
    })?.dataset.tab
    if (!over || over === d.id) return
    const ids = open.map((p) => p.id).filter((x) => x !== d.id)
    const to = open.findIndex((p) => p.id === over)
    ids.splice(to, 0, d.id)
    onReorder(ids)
  }
  const onUp = () => {
    if (drag.current?.started) {
      justDragged.current = true
      setTimeout(() => (justDragged.current = false))
    }
    drag.current = null
    setDragging(null)
  }

  const tab = (on: boolean) =>
    `relative -mb-px flex h-10 max-w-64 touch:h-12 shrink-0 items-center rounded-t-xl text-sm transition-colors ${
      on ? 'z-10 bg-page font-medium text-ink' : 'text-ink-2 hover:bg-white/60'
    }`
  return (
    <div ref={listRef} role="tablist" className="no-print flex shrink-0 items-end gap-0.5 overflow-x-auto bg-surface-2 px-2 pt-2">
      <button role="tab" aria-selected={home} onClick={goHome} className={`${tab(home)} gap-2 px-3`}>
        <Icon name={nav.icon} fill={home} size={18} />
        {nav.label} {view === 'reception' && <span className="text-xs text-ink-2">{waiting.length}</span>}
      </button>
      {open.map((p, i) => {
        const on = p.id === currentId
        const prevOn = i === 0 ? home : open[i - 1].id === currentId
        return (
          <div
            key={p.id}
            data-tab={p.id}
            onPointerDown={(e) => onDown(e, p.id)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={`group select-none ${tab(on)} ${dragging === p.id ? 'z-20 cursor-grabbing bg-white shadow-md' : ''}`}
          >
            {!on && !prevOn && dragging !== p.id && <span className="absolute top-2.5 left-0 h-5 w-px bg-outline-var" />}
            <button
              role="tab"
              aria-selected={on}
              onClick={() => !justDragged.current && openP(p.id)}
              className="flex h-full min-w-0 items-center gap-2 pr-1 pl-3"
              title="ドラッグで並べ替え"
            >
              <PatientIcon patient={p} size={20} />
              <span className="truncate">{p.name}</span>
              <span className="text-xs whitespace-nowrap text-ink-2">{ageSex(p)}</span>
              {p.status === '診察中' && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onClose(p.id)}
              aria-label={`${p.name}のタブを閉じる`}
              title="タブを閉じる"
              className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-ink/10 hover:text-ink touch:h-9 touch:w-9"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
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
