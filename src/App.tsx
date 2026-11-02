import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CommandPalette, type Command } from './CommandPalette'
import { DISEASES, DRUGS, ORDER_KINDS, SETS, TESTS, kindOfTest, today, type OrderKind } from './data'
import { LeftPane, dayLabel, type DoDrag } from './LeftPane'
import { LetterEditor } from './LetterEditor'
import { Icon } from './Icon'
import { BrandWordmark } from './BrandMark'
import { daysText, doseText, isBlank, usageLine } from './rxFormat'
import { PacsPanel } from './PacsPanel'
import { TestWindow } from './TestWindow'
import { PatientIcon, ageSex, birthLabel } from './PatientIcon'
import { OrderBar, OrderRail, type RailId } from './OrderRail'
import { ChartEditor, PastEditor } from './RightPane'
import { DiseasePanel } from './DiseasePanel'
import { DocWindow, DocsPanel } from './DocsPanel'
import { LabsPanel } from './Labs'
import { NextVisit } from './Schedule'
import { QualBadge } from './Qualification'
import { RxWindow } from './RxWindow'
import { SaveSplitButton, loadSaveMode, SAVE_MODES, type SaveMode } from './SaveSplitButton'
import { Desk, MobileTabBar, NAV, NavRail, type View } from './Desk'
import { emptyDraft, loadState, reducer, saveState, type Action, type State } from './store'
import type { Draft, Patient } from './types'

const GOAL_SECONDS = 60
const GOAL_OPS = 15

const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// 右端の列のうち、右の枠を切り替える項目
const RIGHT = { disease: 'diseases', docs: 'docs', labs: 'labs', image: 'images' } as const

const dropLabel = (parts: DoDrag['parts']) =>
  parts.length === 3 ? '記載・処方・検査' : parts.map((p) => ({ text: '記載', rx: '処方', tests: '検査' })[p]).join('・')

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [palette, setPalette] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [view, setView] = useState<View>('reception')
  const [rxOpen, setRxOpen] = useState(false)
  // 開いているオーダーのウインドウ（点滴・血液検査・単純写真・CT・MRI・生理検査）
  const [testOpen, setTestOpen] = useState<OrderKind | null>(null)
  const winRef = useRef({ rx: false, test: false })
  winRef.current = { rx: rxOpen, test: testOpen !== null }
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
  // 左の過去の記録をドラッグしている間だけ、右に落とし先を出す
  const [doDrag, setDoDrag] = useState<DoDrag | null>(null)
  const [dropHover, setDropHover] = useState(false)
  const [saveOk, setSaveOk] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  // 開いている文書（療養計画書・主治医意見書など）のウインドウ
  const [docOpen, setDocOpen] = useState<string | null>(null)
  // 確定のあとの行き先（主ボタン）。最後に選んだものを覚える
  const [saveMode, setSaveMode] = useState<SaveMode>(loadSaveMode)
  const saveModeRef = useRef(saveMode)
  saveModeRef.current = saveMode
  const [, tick] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const patient = state.patients.find((p) => p.id === state.currentId) ?? null
  const draft = (patient && state.drafts[patient.id]) || emptyDraft()
  const mk = state.mode.kind
  const railActive: RailId | null =
    mk === 'letter' || mk === 'docs' ? 'docs' : mk === 'labs' ? 'labs' : mk === 'images' ? 'image' : testOpen ? testOpen : rxOpen ? 'rx' : mk === 'diseases' ? 'disease' : null

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
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // 病名は確定時にオーダーから自動で更新される（orders.ts の planDiseases）
  const confirm = (m: SaveMode = saveModeRef.current) => {
    const s = stateRef.current
    const p = s.patients.find((x) => x.id === s.currentId)
    if (!p) return
    // 用法を選んでいない薬があれば確定しない（処方ウインドウでその行を開く）
    const blank = s.drafts[p.id]?.rx.find(isBlank)
    if (blank) {
      setToast(`${blank.name} の用法が未入力です`)
      openRx()
      return
    }
    const secs = s.session ? Math.round((Date.now() - s.session.startedAt) / 1000) : 0
    const ops = s.session?.ops ?? 0
    const next = m === 'next' ? s.patients.find((x) => x.status === '待ち' && x.id !== p.id) : undefined
    setRxOpen(false)
    setTestOpen(null)
    dispatch({ type: 'confirm', then: m === 'next' ? 'next' : 'list' })
    if (m !== 'next') setView(m)
    setToast(`${p.name} を確定（${secs}秒・${ops}操作）${m === 'next' ? (next ? ` → 次：${next.name}` : ' → 待ち患者なし') : ''}`)
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

  // オーダーのウインドウ（右端のオーダーの列・オーダー欄の「検査」・⌘E は血液検査）
  const openTests = (kind: OrderKind = 'blood') => {
    if (!stateRef.current.currentId) return
    dispatch({ type: 'mode', mode: { kind: 'chart' } })
    setRxOpen(false)
    setTestOpen(kind)
  }

  const selectRail = (id: RailId) => {
    const s = stateRef.current
    setPhonePane('now')
    if (id === 'rx') return openRx()
    if (id in ORDER_KINDS) return openTests(id as OrderKind)
    if (!(id in RIGHT)) return
    // 病名・文書・検査結果・画像は右の枠を切り替える（もう一度押すと記載に戻る）
    const kind = RIGHT[id as keyof typeof RIGHT]
    const on = s.mode.kind === kind || (kind === 'docs' && s.mode.kind === 'letter')
    dispatch({ type: 'mode', mode: on ? { kind: 'chart' } : { kind } })
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
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if (e.key === '?' && !mod && !typing) return hit(() => setHelp((v) => !v))
      if (e.key === 'Escape') {
        setMetricsOpen(false)
        setHelp(false)
        if (closingRef.current) return hit(() => setClosing(null))
        if (winRef.current.rx) return hit(() => setRxOpen(false))
        if (winRef.current.test) return hit(() => setTestOpen(null))
        if (s.mode.kind !== 'chart' && s.mode.kind !== 'letter' && s.mode.kind !== 'docs') hit(() => dispatch({ type: 'mode', mode: { kind: 'chart' } }))
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
      if (mod && k === 'e') return hit(() => openTests())
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
        label: '確定（主ボタンの行き先へ）',
        keys: 'confirm かくてい かいけい つぎ',
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
        sub: `${doseText(d)} ${usageLine(d)} ${daysText(d) || (d.site ?? '')}`,
        keys: `${d.kana} ${d.alias}`,
        // 用法はその行で選ぶので、入れたら処方ウインドウを開く
        run: () => {
          run({ type: 'addRx', drugId: d.id })()
          openRx()
        },
      })),
      ...TESTS.map((t) => ({
        id: t.code,
        group: '検査' as const,
        sub: ORDER_KINDS[kindOfTest(t.code)].label,
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

  const metricsChips = state.session && (
    <span className="flex items-center gap-1 text-xs">
      <span className={`flex h-6 items-center gap-0.5 rounded px-1.5 font-num font-medium ${elapsed > GOAL_SECONDS ? 'bg-error-ctr text-error' : 'bg-rx-ctr text-rx'}`} title="開いてからの時間">
        <Icon name="timer" size={15} />
        {fmtSec(elapsed)}
      </span>
      <span className={`flex h-6 items-center gap-0.5 rounded px-1.5 font-num font-medium ${ops > GOAL_OPS ? 'bg-error-ctr text-error' : 'bg-rx-ctr text-rx'}`} title="操作数">
        <Icon name="ads_click" size={15} />
        {ops}
      </span>
    </span>
  )

  return (
    <div className="flex h-full bg-cream">
      <NavRail view={patient ? null : view} patients={state.patients} onSelect={selectView} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ファストカルテと同じく、パソコンでは上の帯を出さない（ロゴは左の縦メニュー）。スマホだけ出す */}
        <header className="no-print flex h-12 shrink-0 items-center gap-2 border-b border-line bg-ivory pr-2 pl-3 md:hidden">
          <BrandWordmark height={20} />
          <span className="pill">保険診療</span>
          <span className="flex-1" />
          {metricsChips}
          <button onClick={() => setMetricsOpen(true)} className="icon-btn" title="操作計測">
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
          right={
            <span className="flex shrink-0 items-center gap-1 pr-1 pl-2 max-md:hidden">
              {metricsChips}
              <button onClick={() => setMetricsOpen(true)} className="icon-btn icon-btn-sm" title="操作計測（⌘M）">
                <Icon name="monitoring" size={18} />
              </button>
              <button onClick={() => setHelp(true)} className="icon-btn icon-btn-sm font-medium" title="キー操作（?）">
                ?
              </button>
            </span>
          }
        />

        {patient ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-3 max-md:gap-2 max-md:px-2 max-md:pt-2 max-md:pb-1">
            {/* 患者の帯（ファストカルテの PatientBanner：白いカードに左の藍の太線、1行に並べる） */}
            <div className="no-print card shrink-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-l-4 border-clinical py-2.5 pr-3 pl-4 max-md:gap-x-2.5 max-md:py-2 max-md:pl-3">
                <span className="max-md:hidden">
                  <PatientIcon patient={patient} size={34} />
                </span>
                <div className="leading-tight whitespace-nowrap">
                  <div className="text-[11px] text-mist max-md:hidden">{patient.kana}</div>
                  <h1 className="text-xl font-semibold max-md:text-lg">{patient.name}</h1>
                </div>
                <span className="font-mono text-sm font-semibold text-clinical max-md:hidden">
                  <span className="mr-1 font-sans text-[11px] font-normal text-mist">ID</span>
                  {patient.id.toUpperCase()}
                </span>
                <span className="text-line max-md:hidden">|</span>
                <span className="text-sm whitespace-nowrap">
                  <span className={patient.sex === '女' ? 'text-red-600' : 'text-clinical'}>{ageSex(patient)}</span>
                  <span className="text-mist max-md:hidden">・{birthLabel(patient.birth)}</span>
                </span>
                {/* アレルギーは無くても「—」で必ず出す（確認したかどうかが分かる） */}
                <span
                  className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs whitespace-nowrap max-md:order-last ${
                    patient.allergies.length ? 'border-red-200 bg-red-50 font-medium text-red-600' : 'border-line text-mist'
                  }`}
                >
                  <Icon name={patient.allergies.length ? 'warning' : 'check'} fill={patient.allergies.length > 0} size={15} />
                  アレルギー {patient.allergies.length ? patient.allergies.join('、') : '—'}
                </span>
                <span className="pill whitespace-nowrap max-md:hidden">
                  {patient.insurance} {Math.round(patient.burden * 10)}割
                </span>
                <span className="pill max-md:hidden">{patient.encounters.length === 0 ? '初診' : '再診'}</span>
                <QualBadge patient={patient} dispatch={dispatch} />
                <span className="flex-1" />
                <span className={`hidden items-center gap-1 text-[11px] lg:flex ${saveOk ? 'text-mist' : 'font-medium text-error'}`}>
                  <Icon name={saveOk ? (draft.savedAt ? 'cloud_done' : 'draft') : 'error'} size={15} />
                  {saveOk ? (draft.savedAt ? `下書き ${draft.savedAt}` : '下書きなし') : '下書きを保存できません'}
                </span>
              </div>
            </div>
            <div role="tablist" aria-label="表示" className="no-print flex shrink-0 rounded-lg bg-gold-soft/70 p-1 md:hidden">
              {(
                [
                  ['past', `経過（${patient.encounters.length}）`],
                  ['now', '記載'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={phonePane === k}
                  onClick={() => setPhonePane(k)}
                  className={`h-9 flex-1 rounded-md text-sm ${phonePane === k ? 'bg-ivory font-medium text-ink shadow-soft' : 'text-mist'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <main className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-5">
              {/* 左：経過（ファストカルテと同じく、広い画面では経過の列を記載より広く取る 1.3：1） */}
              <div className={`no-print min-h-0 shrink-0 basis-[34%] lg:shrink lg:basis-0 lg:flex-[1.3] max-md:flex-1 max-md:basis-auto ${phonePane === 'past' ? '' : 'max-md:hidden'}`}>
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
                  onEdit={(id, focus) => {
                    setPhonePane('now')
                    dispatch({
                      type: 'mode',
                      mode: { kind: 'edit-past', encounterId: id, focus },
                    })
                  }}
                  onDrag={(d) => {
                    setDoDrag(d)
                    setDropHover(false)
                  }}
                />
              </div>
              <div className={`flex min-h-0 min-w-0 flex-1 gap-3 lg:flex-[1] ${phonePane === 'now' ? '' : 'max-md:hidden'}`}>
                <div className="card relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  {/* 保存の帯（ファストカルテの EntryPanel と同じ：左に「記載」、右に確定のボタン） */}
                  <div className="no-print flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
                    <span className="text-sm font-semibold">記載</span>
                    <span className="font-num text-[11px] whitespace-nowrap text-mist max-xl:hidden">{dayLabel(today())}</span>
                    <span className="flex-1" />
                    <NextVisit patient={patient} draft={draft} dispatch={dispatch} />
                    <SaveSplitButton mode={saveMode} onMode={setSaveMode} onSave={(m) => confirm(m)} />
                  </div>
                  {editing && (
                    <div className="no-print flex shrink-0 items-center gap-2 border-b border-gold bg-gold-soft px-3 py-1.5 text-xs">
                      <Icon name="edit" size={15} />
                      <span className="font-medium">{editing.date} の記録を編集中</span>
                      <span className="flex-1" />
                      <button onClick={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} className="rounded border border-gold bg-ivory px-2 py-0.5 hover:bg-cream">
                        編集をやめる
                      </button>
                    </div>
                  )}
                  <div className="relative min-h-0 flex-1">
                    {doDrag && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'copy'
                          setDropHover(true)
                        }}
                        onDragLeave={() => setDropHover(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          dispatch({ type: 'mode', mode: { kind: 'chart' } })
                          dispatch({ type: 'do', encounterId: doDrag.encounterId, parts: doDrag.parts })
                          const date = patient.encounters.find((x) => x.id === doDrag.encounterId)?.date
                          setToast(`${date} の${dropLabel(doDrag.parts)}をDoしました`)
                          setDoDrag(null)
                          setDropHover(false)
                        }}
                        className={`absolute inset-0 z-10 flex items-center justify-center transition-colors ${
                          dropHover ? 'bg-gold-soft/60 ring-2 ring-gold-dark ring-inset' : 'bg-ivory/60 ring-2 ring-line ring-inset'
                        }`}
                      >
                        <span className="pointer-events-none flex items-center gap-1.5 rounded-full bg-ink/90 px-4 py-2 text-sm text-ivory">
                          <Icon name="replay" size={18} />
                          ここに落とすと{dropLabel(doDrag.parts)}をDo
                        </span>
                      </div>
                    )}
                    <div className="h-full">
                      {mode.kind === 'letter' ? (
                        <LetterEditor patient={patient} draft={draft} dispatch={dispatch} />
                      ) : mode.kind === 'images' ? (
                        <PacsPanel patient={patient} draft={draft} onClose={() => dispatch({ type: 'mode', mode: { kind: 'chart' } })} />
                      ) : mode.kind === 'diseases' ? (
                        <DiseasePanel patient={patient} draft={draft} dispatch={dispatch} />
                      ) : mode.kind === 'docs' ? (
                        <DocsPanel patient={patient} dispatch={dispatch} onOpen={setDocOpen} onLetter={toggleLetter} />
                      ) : mode.kind === 'labs' ? (
                        <LabsPanel patient={patient} dispatch={dispatch} />
                      ) : editing ? (
                        <PastEditor key={editing.id} encounter={editing} focus={mode.kind === 'edit-past' ? mode.focus : undefined} dispatch={dispatch} />
                      ) : (
                        <ChartEditor key={patient.id} patient={patient} draft={draft} dispatch={dispatch} onOpenRx={openRx} onOpenTests={openTests} />
                      )}
                    </div>
                  </div>
                </div>
                <OrderRail active={railActive} onSelect={selectRail} onSearch={() => setPalette(true)} />
              </div>
            </main>
          </div>
        ) : (
          <Desk view={view} patients={state.patients} dispatch={dispatch} onMetrics={() => setMetricsOpen(true)} />
        )}

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
      {testOpen && patient && <TestWindow key={testOpen} kind={testOpen} patient={patient} draft={draft} dispatch={dispatch} onClose={() => setTestOpen(null)} />}
      {docOpen && patient && <DocWindow patient={patient} docId={docOpen} dispatch={dispatch} onClose={() => setDocOpen(null)} />}
      {rxOpen && patient && <RxWindow patient={patient} draft={draft} dispatch={dispatch} onClose={() => setRxOpen(false)} />}
      {metricsOpen && <MetricsPanel state={state} dispatch={dispatch} onClose={() => setMetricsOpen(false)} />}
      {help && <ShortcutsHelp saveLabel={SAVE_MODES.find((m) => m.id === saveMode)!.label} onClose={() => setHelp(false)} />}
      {/* ファストカルテの「オーダーに追加しました」と同じ、下の真ん中の小さな黒い帯 */}
      {toast && (
        <div role="status" className="no-print fixed bottom-24 left-1/2 z-[120] max-w-[90vw] -translate-x-1/2 rounded-full bg-ink/90 px-4 py-1.5 text-xs text-ivory shadow-lg md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  )
}

const isDirty = (d?: Draft) => !!d && (d.text.trim() !== '' || d.rx.length > 0 || d.tests.length > 0 || !!d.letter)

// ファストカルテのダイアログの形：墨の薄い幕＋白い角丸の箱、主ボタンは藍、ほかは枠だけ
function Dialog({ label, onCancel, children, wide }: { label: string; onCancel: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="no-print fixed inset-0 z-[95] flex items-center justify-center p-4">
      <button aria-label="閉じる" tabIndex={-1} onClick={onCancel} className="absolute inset-0 cursor-default bg-ink/40" />
      <div role="dialog" aria-modal="true" aria-label={label} className={`relative w-full rounded-2xl border border-line bg-ivory p-5 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        {children}
      </div>
    </div>
  )
}

// 確定していない患者のタブを✗で閉じるときの確認。下書きは残すのが既定
function CloseDialog({ patient, onCancel, onKeep, onDiscard }: { patient: Patient; onCancel: () => void; onKeep: () => void; onDiscard: () => void }) {
  return (
    <Dialog label="タブを閉じる" onCancel={onCancel}>
      <h2 className="text-base font-semibold">{patient.name}さんのカルテは確定していません</h2>
      <p className="mt-2 text-sm text-mist">記載とオーダーは下書きとして残っています。下書きを残して閉じれば、次に開いたときに続きから書けます。</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button autoFocus onClick={onKeep} className="rounded-md bg-clinical px-4 py-2 text-sm font-medium text-ivory hover:brightness-110">
          下書きを残して閉じる
        </button>
        <button onClick={onCancel} className="rounded-md border border-line px-3 py-2 text-sm hover:bg-cream">
          戻る
        </button>
        <button onClick={onDiscard} className="ml-auto text-xs text-red-600 underline">
          破棄して閉じる
        </button>
      </div>
    </Dialog>
  )
}

// ? で開くキー操作の一覧（ファストカルテの ShortcutsHelp と同じ扱い。入力中は開かない）
function ShortcutsHelp({ saveLabel, onClose }: { saveLabel: string; onClose: () => void }) {
  const keys: [string, string][] = [
    ['⌘K', '検索・追加（薬・検査・病名・セット・操作）'],
    ['⌘P', '処方'],
    ['⌘E', '検査'],
    ['⌘D', 'Do処方（前回と同じ処方）'],
    ['⌘⇧D', '前回の記載をコピー'],
    ['⌘L', '紹介状'],
    ['⌘Enter', saveLabel],
    ['⌘J', '次の患者'],
    ['⌘M', '操作計測'],
    ['Esc', '開いている窓・パネルを閉じる'],
    ['?', 'この一覧'],
  ]
  return (
    <Dialog label="キー操作" onCancel={onClose}>
      <h2 className="mb-3 text-base font-semibold">キー操作</h2>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
        {keys.map(([k, l]) => (
          <div key={k} className="contents">
            <dt>
              <span className="kbd">{k}</span>
            </dt>
            <dd>{l}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-mist">左の経過は、ダブルクリックで訂正、右へドラッグでDo。処方の表は薬品名を2文字打つと候補が出ます。</p>
    </Dialog>
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
  right?: React.ReactNode
}

type DragState = { id: string; x: number; at: number; touch: boolean; started: boolean }

function PatientTabs({ view, patients, currentId, closed, order, onReorder, onClose, dispatch, right }: TabsProps) {
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

  // ファストカルテの AppTabs と同じ：白い帯に並べ、開いているタブは下に藍の線
  const tab = (on: boolean) =>
    `relative flex h-9 max-w-56 touch:h-11 shrink-0 items-center text-[12px] transition-colors ${
      on ? 'z-10 bg-cream font-semibold text-ink shadow-[inset_0_-2px_0_0_var(--color-clinical)]' : 'text-mist hover:bg-gold-soft'
    }`
  return (
    <div className="no-print flex shrink-0 items-stretch border-b border-line bg-ivory">
    <div ref={listRef} role="tablist" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
      <button role="tab" aria-selected={home} onClick={goHome} className={`${tab(home)} gap-1.5 px-3`}>
        <Icon name={nav.icon} size={16} />
        {nav.label} {view === 'reception' && <span className="font-num text-[11px] text-mist">{waiting.length}</span>}
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
            {!on && !prevOn && dragging !== p.id && <span className="absolute top-2 left-0 h-5 w-px bg-line" />}
            <button
              role="tab"
              aria-selected={on}
              onClick={() => !justDragged.current && openP(p.id)}
              className="flex h-full min-w-0 items-center gap-2 pr-1 pl-3"
              title="ドラッグで並べ替え"
            >
              <span className="truncate">{p.name}</span>
              <span className="text-[11px] font-normal whitespace-nowrap text-mist">{ageSex(p)}</span>
              {p.status === '診察中' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-clinical" />}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onClose(p.id)}
              aria-label={`${p.name}のタブを閉じる`}
              title="タブを閉じる"
              className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-mist hover:bg-ink/10 hover:text-ink touch:h-9 touch:w-9"
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )
      })}
    </div>
    {right}
    </div>
  )
}

function MetricsPanel({ state, dispatch, onClose }: { state: State; dispatch: (a: Action) => void; onClose: () => void }) {
  const m = state.metrics
  const avg = (f: (x: (typeof m)[number]) => number) => (m.length ? Math.round(m.reduce((s, x) => s + f(x), 0) / m.length) : 0)
  return (
    <Dialog label="操作計測" onCancel={onClose} wide>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Icon name="monitoring" size={20} className="text-clinical" />
          <h2 className="flex-1 text-base font-semibold">操作計測</h2>
          <button onClick={onClose} className="icon-btn" title="閉じる（Esc）">
            <Icon name="close" />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-2">
          患者を開いてから確定までの時間と操作数（クリック＋ショートカット。文字入力は含まない）。目標は再診 {GOAL_SECONDS}秒・{GOAL_OPS}操作以内。
        </p>
        {m.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line py-10 text-center text-mist">まだ計測結果がありません</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs text-mist">
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
    </Dialog>
  )
}
