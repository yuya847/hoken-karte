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
import { ChartEditor, DiseaseLink, PastEditor, type FocusReq } from './RightPane'
import { unlinkedOrders } from './orders'
import { emptyDraft, loadState, reducer, saveState, type Action, type State } from './store'
import type { Draft, Patient, QueueStatus } from './types'

const GOAL_SECONDS = 60
const GOAL_OPS = 15

const STATUS_STYLE: Record<QueueStatus, string> = {
  待ち: 'bg-[#ffefc9] text-[#5c4300]',
  診察中: 'bg-primary-ctr text-on-primary-ctr',
  会計待ち: 'bg-rx-ctr text-rx',
  済: 'bg-surface-2 text-ink-2',
}

type TabStyle = 'underline' | 'chrome' | 'pill' | 'card'
const TAB_STYLES: { id: TabStyle; label: string; desc: string }[] = [
  { id: 'underline', label: 'A 下線タブ', desc: 'Material標準。軽く、数が多くても並ぶ' },
  { id: 'chrome', label: 'B ブラウザ型', desc: 'Chromeのタブ風。開いている感覚が強い' },
  { id: 'pill', label: 'C ピル型', desc: '丸い札。選択中が塗りでひと目で分かる' },
  { id: 'card', label: 'D カード型', desc: '2行で主病名・状態まで見える。待合の把握向き' },
]
const TAB_KEY = 'hoken-karte-tab-style'
const loadTabStyle = (): TabStyle => {
  try {
    const v = localStorage.getItem(TAB_KEY)
    if (TAB_STYLES.some((t) => t.id === v)) return v as TabStyle
  } catch {
    // 読めなければ既定
  }
  return 'underline'
}

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [palette, setPalette] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [saveOk, setSaveOk] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [focusReq, setFocusReq] = useState<FocusReq>(null)
  const [checkOpen, setCheckOpen] = useState(false)
  const [tabStyle, setTabStyle] = useState<TabStyle>(loadTabStyle)
  const [tabMenu, setTabMenu] = useState(false)
  const checkRef = useRef(false)
  checkRef.current = checkOpen
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

  // 病名漏れがあれば確認画面を出す。force で漏れがあっても確定する
  const confirm = (force = false) => {
    const s = stateRef.current
    const p = s.patients.find((x) => x.id === s.currentId)
    if (!p) return
    if (!force && unlinkedOrders(p, s.drafts[p.id] ?? emptyDraft()).length > 0) return setCheckOpen(true)
    setCheckOpen(false)
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

  const focusOrder = (target: 'order' | 'disease') => {
    dispatch({ type: 'mode', mode: { kind: 'chart' } })
    setFocusReq((r) => ({ target, n: (r?.n ?? 0) + 1 }))
  }

  const selectRail = (id: RailId) => {
    const s = stateRef.current
    if (id === 'letter') return toggleLetter()
    if (id === 'test') return dispatch({ type: 'mode', mode: s.mode.kind === 'tests' ? { kind: 'chart' } : { kind: 'tests' } })
    if (id === 'image') return dispatch({ type: 'mode', mode: s.mode.kind === 'images' ? { kind: 'chart' } : { kind: 'images' } })
    focusOrder(id === 'disease' ? 'disease' : 'order')
  }

  const chooseTabStyle = (t: TabStyle) => {
    setTabStyle(t)
    setTabMenu(false)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      // 保存できなくても今回は反映する
    }
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
      if (checkRef.current) {
        if (e.key === 'Escape') hit(() => setCheckOpen(false))
        if (mod && e.key === 'Enter') hit(() => confirm())
        return
      }
      if (e.key === 'Escape') {
        setMetricsOpen(false)
        setTabMenu(false)
        if (s.mode.kind === 'edit-past' || s.mode.kind === 'images' || s.mode.kind === 'tests') hit(() => dispatch({ type: 'mode', mode: { kind: 'chart' } }))
        return
      }
      if (mod && k === 'k') return hit(() => setPalette((v) => !v))
      if (mod && k === 'm') return hit(() => setMetricsOpen((v) => !v))
      if (mod && k === 'j') return hit(nextPatient)
      if (!s.currentId) return
      if (mod && e.shiftKey && k === 'd') return hit(() => dispatch({ type: 'copyLastText' }))
      if (mod && k === 'd') return hit(() => dispatch({ type: 'do' }))
      if (mod && k === 'l') return hit(toggleLetter)
      if (mod && k === 'p') return hit(() => focusOrder('order'))
      if (mod && e.key === 'Enter') return hit(() => confirm())
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
      { id: 'a-confirm', group: '操作', label: '確定して会計へ', keys: 'confirm かくてい かいけい', hint: '⌘Enter', run: () => confirm() },
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
    <div className="flex h-full flex-col bg-page">
      <header className="no-print flex h-16 shrink-0 items-center gap-2 px-3">
        <button onClick={() => dispatch({ type: 'close' })} className="flex items-center gap-2 rounded-full py-1 pr-4 pl-2 hover:bg-ink/5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
            <Icon name="clinical_notes" fill size={22} />
          </span>
          <span className="text-[22px] text-ink-2">保険診療カルテ</span>
        </button>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">試作・架空データ</span>

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
        <div className="relative">
          <button onClick={() => setTabMenu((v) => !v)} className={`icon-btn ${tabMenu ? 'bg-ink/8' : ''}`} title="タブのデザインを切り替え">
            <Icon name="tab" />
          </button>
          {tabMenu && (
            <div className="absolute right-0 z-40 mt-1 w-80 rounded-2xl bg-surface-1 py-2 shadow-xl">
              <div className="label px-4 pb-1">タブのデザイン</div>
              {TAB_STYLES.map((t) => (
                <button key={t.id} onClick={() => chooseTabStyle(t.id)} className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-ink/5">
                  <Icon name={tabStyle === t.id ? 'radio_button_checked' : 'radio_button_unchecked'} className={tabStyle === t.id ? 'text-primary' : 'text-ink-2'} />
                  <span>
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-xs text-ink-2">{t.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setMetricsOpen(true)} className="icon-btn" title="操作計測（⌘M）">
          <Icon name="monitoring" />
        </button>
      </header>

      <PatientTabs variant={tabStyle} patients={state.patients} currentId={state.currentId} dispatch={dispatch} />

      {patient ? (
        <>
          <div className="no-print flex items-center gap-4 px-5 py-3">
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
            <span className="flex h-8 items-center rounded-lg border border-outline-var px-3 text-[13px] text-ink-2">
              {patient.encounters.length === 0 ? '初診' : '再診'}
            </span>
            <span className="flex-1" />
            <span className={`flex items-center gap-1 text-xs ${saveOk ? 'text-ink-2' : 'font-medium text-error'}`}>
              <Icon name={saveOk ? (draft.savedAt ? 'cloud_done' : 'draft') : 'error'} size={18} />
              {saveOk ? (draft.savedAt ? `下書き保存 ${draft.savedAt}` : '下書きなし') : '下書きを保存できません'}
            </span>
            <button onClick={() => confirm()} className="btn btn-filled">
              <Icon name="check" size={20} />
              確定して会計へ <span className="kbd">⌘Enter</span>
            </button>
          </div>
          <main className="flex min-h-0 flex-1 gap-2 px-2 pb-1">
            <div className="no-print card min-h-0 flex-[2] overflow-hidden">
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
            <div className="card min-h-0 flex-[3] overflow-hidden">
              {mode.kind === 'letter' ? (
                <LetterEditor patient={patient} draft={draft} dispatch={dispatch} />
              ) : mode.kind === 'tests' ? (
                <TestPicker patient={patient} draft={draft} dispatch={dispatch} />
              ) : mode.kind === 'images' ? (
                <ImageViewer key={patient.id} patientName={patient.name} />
              ) : editing ? (
                <PastEditor key={editing.id} encounter={editing} dispatch={dispatch} />
              ) : (
                <ChartEditor key={patient.id} patient={patient} draft={draft} dispatch={dispatch} focusReq={focusReq} />
              )}
            </div>
            <OrderRail active={mode.kind === 'letter' ? 'letter' : mode.kind === 'images' ? 'image' : mode.kind === 'tests' ? 'test' : null} onSelect={selectRail} />
          </main>
        </>
      ) : (
        <Reception patients={state.patients} dispatch={dispatch} />
      )}

      <footer className="no-print flex shrink-0 flex-wrap gap-x-4 gap-y-1 px-5 py-2 text-xs text-ink-2">
        {[
          ['⌘K', '検索・追加'],
          ['⌘P', '処方検索'],
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

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {checkOpen && patient && <DiseaseCheck patient={patient} draft={draft} dispatch={dispatch} onBack={() => setCheckOpen(false)} onConfirm={confirm} />}
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

// 受付一覧と診察対象の患者を切り替えるタブ。デザインは4案から右上で切り替えられる
function PatientTabs({ variant, patients, currentId, dispatch }: { variant: TabStyle; patients: Patient[]; currentId: string | null; dispatch: (a: Action) => void }) {
  const open = patients.filter((p) => p.status === '待ち' || p.status === '診察中')
  const home = currentId === null
  const goHome = () => dispatch({ type: 'close' })
  const openP = (id: string) => dispatch({ type: 'open', patientId: id })
  const mainDx = (p: Patient) => p.diseases.find((d) => d.status === '継続' && d.main)?.name ?? (p.encounters.length === 0 ? '初診' : '病名なし')

  if (variant === 'chrome') {
    const tab = (on: boolean) =>
      `relative -mb-px flex h-10 max-w-60 shrink-0 items-center gap-2 rounded-t-xl px-3 text-sm transition-colors ${
        on ? 'z-10 bg-page font-medium text-ink' : 'text-ink-2 hover:bg-white/60'
      }`
    return (
      <div role="tablist" className="no-print flex shrink-0 items-end gap-0.5 overflow-x-auto bg-surface-2 px-2 pt-2">
        <button role="tab" aria-selected={home} onClick={goHome} className={tab(home)}>
          <Icon name="groups" fill={home} size={18} />
          受付一覧 <span className="text-xs text-ink-2">{open.length}</span>
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

  if (variant === 'pill') {
    const tab = (on: boolean) =>
      `flex h-9 shrink-0 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm font-medium transition-colors ${
        on ? 'bg-secondary-ctr text-on-secondary-ctr' : 'text-ink-2 hover:bg-ink/5'
      }`
    return (
      <div role="tablist" className="no-print flex shrink-0 items-center gap-1 overflow-x-auto px-3 py-1.5">
        <button role="tab" aria-selected={home} onClick={goHome} className={`${tab(home)} pl-3`}>
          <Icon name="groups" fill={home} size={20} />
          受付一覧 <span className="text-xs opacity-70">{open.length}</span>
        </button>
        <span className="mx-1 h-6 w-px bg-outline-var" />
        {open.map((p) => {
          const on = p.id === currentId
          return (
            <button key={p.id} role="tab" aria-selected={on} onClick={() => openP(p.id)} className={tab(on)}>
              <PatientIcon patient={p} size={26} />
              {p.name}
              <span className="text-xs font-normal opacity-70">{ageSex(p)}</span>
              {on && <Icon name="check" size={18} />}
            </button>
          )
        })}
      </div>
    )
  }

  if (variant === 'card') {
    const tab = (on: boolean, w = 'w-52') =>
      `flex h-14 ${w} shrink-0 items-center gap-2.5 rounded-2xl px-3 text-left transition-colors ${
        on ? 'bg-primary-ctr text-on-primary-ctr ring-2 ring-primary' : 'bg-white text-ink hover:bg-surface-2'
      }`
    return (
      <div role="tablist" className="no-print flex shrink-0 items-center gap-2 overflow-x-auto px-3 py-2">
        <button role="tab" aria-selected={home} onClick={goHome} className={tab(home, 'w-36')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
            <Icon name="groups" fill={home} />
          </span>
          <span>
            <span className="block text-sm font-medium">受付一覧</span>
            <span className="block text-xs text-ink-2">待ち {open.length}人</span>
          </span>
        </button>
        {open.map((p) => {
          const on = p.id === currentId
          return (
            <button key={p.id} role="tab" aria-selected={on} onClick={() => openP(p.id)} className={tab(on)}>
              <PatientIcon patient={p} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-2">{ageSex(p)}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-2">
                  <span className={`rounded px-1 text-[10px] font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  <span className="truncate">{mainDx(p)}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const tab = (active: boolean) =>
    `relative flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-medium transition-colors hover:bg-ink/5 ${active ? 'text-primary' : 'text-ink-2'}`
  const Indicator = ({ on }: { on: boolean }) => (on ? <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-primary" /> : null)
  return (
    <div role="tablist" className="no-print flex shrink-0 items-end overflow-x-auto border-b border-outline-var px-3">
      <button role="tab" aria-selected={home} onClick={goHome} className={tab(home)}>
        <Icon name="groups" fill={home} />
        受付一覧
        <span className={`rounded-full px-1.5 text-[11px] ${home ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2'}`}>{open.length}</span>
        <Indicator on={home} />
      </button>
      {open.map((p) => (
        <button key={p.id} role="tab" aria-selected={p.id === currentId} onClick={() => openP(p.id)} className={`${tab(p.id === currentId)} max-w-64`}>
          <PatientIcon patient={p} size={24} />
          <span className="truncate">{p.name}</span>
          <span className="text-xs font-normal text-ink-2">{ageSex(p)}</span>
          {p.status === '診察中' && <span className="h-2 w-2 rounded-full bg-primary" title="診察中" />}
          <Indicator on={p.id === currentId} />
        </button>
      ))}
    </div>
  )
}

// 確定前の病名漏れチェック。候補をその場で追加でき、解消すると確定ボタンが主ボタンになる
function DiseaseCheck({ patient, draft, dispatch, onBack, onConfirm }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void; onBack: () => void; onConfirm: (force?: boolean) => void }) {
  const left = unlinkedOrders(patient, draft)
  const done = left.length === 0
  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/30" onMouseDown={onBack}>
      <div className="w-[560px] max-w-[92vw] rounded-[28px] bg-surface-1 p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-col items-center gap-2 text-center">
          <Icon name={done ? 'task_alt' : 'link_off'} size={28} className={done ? 'text-rx' : 'text-error'} />
          <h2 className="text-2xl">{done ? '病名の漏れはありません' : `病名が紐付いていないオーダーが ${left.length}件`}</h2>
        </div>
        <p className="mb-4 text-center text-sm text-ink-2">
          {done ? 'このまま確定できます。' : '適応する病名がないと、レセプト審査で査定・返戻の対象になります。候補を押すと病名に追加されます。'}
        </p>
        {!done && (
          <div className="space-y-2">
            {left.map((o) => (
              <div key={o.item.id} className="rounded-2xl bg-white px-4 py-3">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <Icon name={o.kind === 'rx' ? 'medication' : 'biotech'} size={18} className={o.kind === 'rx' ? 'text-rx' : 'text-lab'} />
                  {o.item.name}
                </div>
                <DiseaseLink patient={patient} order={o} dispatch={dispatch} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {done ? (
            <>
              <button onClick={onBack} className="btn btn-text">
                戻る
              </button>
              <button onClick={() => onConfirm()} className="btn btn-filled">
                <Icon name="check" size={20} />
                確定して会計へ <span className="kbd">⌘Enter</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onConfirm(true)} className="btn btn-text text-ink-2">
                このまま確定
              </button>
              <button onClick={onBack} className="btn btn-filled">
                戻って修正 <span className="kbd">Esc</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Reception({ patients, dispatch }: { patients: Patient[]; dispatch: (a: Action) => void }) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-1">
      <div className="card px-6 py-5">
        <h1 className="mb-4 text-[22px]">受付・会計</h1>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-2">
            <tr className="border-b border-outline-var">
              <th className="px-3 py-2 font-medium">状態</th>
              <th className="px-3 py-2 font-medium">氏名</th>
              <th className="px-3 py-2 font-medium">年齢・性別／生年月日</th>
              <th className="px-3 py-2 font-medium">保険</th>
              <th className="px-3 py-2 font-medium">今日の内容</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const done = p.status === '会計待ち' || p.status === '済'
              const last = p.encounters.at(-1)
              return (
                <tr key={p.id} className="border-b border-surface-2 hover:bg-surface-1">
                  <td className="px-3 py-2.5">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <PatientIcon patient={p} size={36} />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-ink-2">{p.kana}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div>{ageSex(p)}</div>
                    <div className="text-xs text-ink-2">{birthLabel(p.birth)}生</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.insurance} {Math.round(p.burden * 10)}割
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">
                    {done && last ? `${last.kind}・処方${last.rx.length}剤・検査${last.tests.length}件${last.letters.length ? '・紹介状' : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!done && (
                      <button onClick={() => dispatch({ type: 'open', patientId: p.id })} className="btn btn-sm btn-filled">
                        <Icon name="stethoscope" size={18} />
                        診察
                      </button>
                    )}
                    {p.status === '会計待ち' && (
                      <button onClick={() => dispatch({ type: 'paid', patientId: p.id })} className="btn btn-sm btn-tonal">
                        <Icon name="payments" size={18} />
                        会計済にする
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-2">
          <Icon name="info" size={16} />
          点数・窓口負担の計算は算定エンジン（Phase 3）で実装します。この画面は流れの確認用です。
        </p>
        <button onClick={() => dispatch({ type: 'reset' })} className="btn btn-sm btn-text mt-4 -ml-3">
          <Icon name="restart_alt" size={18} />
          架空データを初期状態に戻す
        </button>
      </div>
    </main>
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
