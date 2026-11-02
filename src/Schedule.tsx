import { useEffect, useMemo, useRef, useState } from 'react'
import { toHira } from './CommandPalette'
import { Icon } from './Icon'
import { today, uid, ymd } from './data'
import { rxRunsOut } from './karte'
import { Dialog, DialogHead, Segmented } from './Qualification'
import { parseUsage } from './rxFormat'
import { DAY_END, DAY_START, PURPOSES, SLOT, addDays, extraBookings, hhmmOf, isOpenAt, isOpenDay, minOf, purposeStyle, sessionsOf, snapOpen, toDate } from './scheduleData'
import type { Action } from './store'
import type { Appointment, Draft, Patient } from './types'

// 予約。左のメニュー「予約」の予約表（日・週）と、記載の帯の「次回予約」

const WD = ['日', '月', '火', '水', '木', '金', '土']
const md = (s: string) => {
  const d = toDate(s)
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`
}
const longDate = (s: string) => `${s.replace(/-/g, '/')}（${WD[toDate(s).getDay()]}）`
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000)
const ROW = 22 // 15分の高さ(px)

// 予約表に並べる1件。patientId があればカルテのある患者、なければ表示だけの架空の予約
type Booking = { id: string; date: string; time: string; minutes: number; purpose: string; name: string; memo?: string; patientId?: string }

const bookingsOf = (patients: Patient[]): Booking[] => [
  ...patients.flatMap((p) =>
    (p.appointments ?? []).filter((a) => a.status !== 'キャンセル').map((a) => ({ id: a.id, date: a.date, time: a.time, minutes: a.minutes, purpose: a.purpose, memo: a.memo, name: p.name, patientId: p.id })),
  ),
  ...extraBookings(),
]

// その日の空いている枠（分）。ignoreId の予約は空きとして数える（予約の変更のとき）
const freeSlots = (all: Booking[], date: string, minutes: number, ignoreId?: string) => {
  const day = all.filter((b) => b.date === date && b.id !== ignoreId)
  const out: number[] = []
  for (const [s, e] of sessionsOf(toDate(date).getDay()))
    for (let m = s; m + minutes <= e; m += SLOT)
      if (
        !day.some((b) => {
          const bs = minOf(b.time)
          return m < bs + b.minutes && bs < m + minutes
        })
      )
        out.push(m)
  return out
}

// 重なる予約を横に並べる（重なりのまとまりごとに列を割り当てる）
const layout = (bs: Booking[]) => {
  const res = new Map<string, { lane: number; lanes: number }>()
  let cluster: Booking[] = []
  let ends: number[] = []
  let clusterEnd = -1
  const flush = () => {
    cluster.forEach((b) => (res.get(b.id)!.lanes = ends.length))
    cluster = []
    ends = []
  }
  for (const b of [...bs].sort((x, y) => minOf(x.time) - minOf(y.time))) {
    const s = minOf(b.time)
    const e = s + b.minutes
    if (s >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    let lane = ends.findIndex((x) => x <= s)
    if (lane < 0) {
      lane = ends.length
      ends.push(e)
    } else ends[lane] = e
    res.set(b.id, { lane, lanes: 1 })
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, e)
  }
  flush()
  return res
}

// 診療時間の外（昼休み・午後休診・休診日）の範囲
const closedRanges = (date: string): [number, number, string][] => {
  const dow = toDate(date).getDay()
  const ss = sessionsOf(dow)
  if (ss.length === 0) return [[DAY_START, DAY_END, '休診']]
  const out: [number, number, string][] = []
  let cur = DAY_START
  for (const [s, e] of ss) {
    if (s > cur) out.push([cur, s, '昼休み'])
    cur = e
  }
  if (cur < DAY_END) out.push([cur, DAY_END, dow === 6 ? '午後休診' : '診療時間外'])
  return out
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

// ---- 予約表 ----

export function SchedulePage({ patients, dispatch, onOpen }: { patients: Patient[]; dispatch: (a: Action) => void; onOpen: (id: string) => void }) {
  const t = today()
  const [date, setDate] = useState(t)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [book, setBook] = useState<{ date: string; min: number; patientId?: string } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const all = useMemo(() => bookingsOf(patients), [patients])
  const dow = toDate(date).getDay()
  const weekStart = addDays(date, -((dow + 6) % 7))
  const days = view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const step = (n: number) => setDate((d) => addDays(d, n * (view === 'day' ? 1 : 7)))

  // ←→ で前後の日（週）、T で今日、D・W で日・週を切り替え
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'ArrowLeft') stepRef.current(-1)
      else if (e.key === 'ArrowRight') stepRef.current(1)
      else if (e.key === 't') setDate(today())
      else if (e.key === 'd') setView('day')
      else if (e.key === 'w') setView('week')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const shown = all.filter((b) => days.includes(b.date))
  // 定期処方が切れる（切れた）のに先の予約がない患者
  const due = patients
    .map((p) => {
      const out = rxRunsOut(p)
      return out ? { p, out: ymd(out), left: daysBetween(t, ymd(out)) } : null
    })
    .filter((x): x is { p: Patient; out: string; left: number } => !!x && x.left <= 7 && x.left >= -30 && !(x.p.appointments ?? []).some((a) => a.date >= t && a.status !== 'キャンセル'))
    .sort((a, b) => a.left - b.left)

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-8 max-md:px-3 max-md:pt-3 lg:pb-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-base font-semibold">予約</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} title={view === 'day' ? '前の日（←）' : '前の週（←）'} className="icon-btn icon-btn-sm border border-line bg-ivory">
            <Icon name="chevron_left" size={20} />
          </button>
          <button onClick={() => setDate(t)} disabled={view === 'day' ? date === t : days.includes(t)} className="btn btn-sm btn-outlined disabled:opacity-50">
            今日
          </button>
          <button onClick={() => step(1)} title={view === 'day' ? '次の日（→）' : '次の週（→）'} className="icon-btn icon-btn-sm border border-line bg-ivory">
            <Icon name="chevron_right" size={20} />
          </button>
        </div>
        <span className="font-num text-sm font-medium whitespace-nowrap">{view === 'day' ? longDate(date) : `${md(days[0])} 〜 ${md(days[6])}`}</span>
        {view === 'day' && !isOpenDay(date) && <span className="pill">休診日</span>}
        <span className="flex-1" />
        <div className="w-32">
          <Segmented
            value={view}
            options={[
              { id: 'day', label: '日' },
              { id: 'week', label: '週' },
            ]}
            onChange={setView}
          />
        </div>
      </div>

      <div className="flex gap-4 max-lg:flex-col">
        <div className="card min-w-0 flex-1 overflow-auto lg:max-h-[calc(100dvh-96px)]">
          <TimeGrid
            days={days}
            bookings={shown}
            confirmId={confirmId}
            onSlot={(d, m) => setBook({ date: d, min: m })}
            onOpen={onOpen}
            onDay={(d) => {
              setDate(d)
              setView('day')
            }}
            onAskCancel={setConfirmId}
            onCancel={(b) => {
              if (b.patientId) dispatch({ type: 'removeAppointment', patientId: b.patientId, id: b.id })
              setConfirmId(null)
            }}
          />
        </div>

        <aside className="space-y-4 lg:w-72 lg:shrink-0">
          <section className="card px-4 py-3">
            <h2 className="mb-2 text-[13px] font-semibold">{view === 'day' ? 'この日の予約' : 'この週の予約'}</h2>
            <ul className="space-y-1 text-sm">
              {PURPOSES.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${purposeStyle(p).dot}`} />
                  <span className="flex-1">{p}</span>
                  <span className="font-num">{shown.filter((b) => b.purpose === p).length}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 border-t border-line pt-1 font-medium">
                <span className="w-2.5" />
                <span className="flex-1">合計</span>
                <span className="font-num">{shown.length}</span>
              </li>
            </ul>
          </section>

          <section className="card px-4 py-3">
            <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
              <Icon name="medication" size={18} className="text-[#8a5a00]" />
              処方が切れるのに予約がない
            </h2>
            <p className="mb-2 text-[11px] text-mist">定期処方の残りが7日以内（切れたものを含む）で、先の予約がない患者</p>
            {due.length === 0 ? (
              <p className="text-xs text-mist">ありません</p>
            ) : (
              <ul className="divide-y divide-line">
                {due.map(({ p, out, left }) => (
                  <li key={p.id} className="flex items-center gap-2 py-1.5">
                    <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium hover:underline">{p.name}</span>
                      <span className={`block text-[11px] ${left < 0 ? 'font-medium text-error' : 'text-[#8a5a00]'}`}>
                        {left < 0 ? `${md(out)}に切れた（${-left}日前）` : left === 0 ? '今日で切れる' : `${md(out)}に切れる（あと${left}日）`}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const d = snapOpen(left <= 0 ? t : out, left <= 0 ? 1 : -1)
                        const free = freeSlots(all, d, 15)
                        setDate(d)
                        setBook({ date: d, min: free[0] ?? DAY_START, patientId: p.id })
                      }}
                      className="btn btn-sm btn-tonal"
                    >
                      <Icon name="event" size={16} />
                      予約
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="flex items-start gap-1.5 text-[11px] text-mist touch:hidden">
            <Icon name="keyboard" size={14} />
            ←→ で前後の{view === 'day' ? '日' : '週'}、T で今日、D・W で日・週。空いている枠を押すと予約を入れられます。カルテのない予約（氏名に印のないもの）は架空の表示です。
          </p>
        </aside>
      </div>

      {book && (
        <BookDialog
          date={book.date}
          min={book.min}
          patients={patients}
          all={all}
          initialPatientId={book.patientId}
          onClose={() => setBook(null)}
          onSave={(patientId, appt) => {
            dispatch({ type: 'saveAppointment', patientId, appt })
            setBook(null)
          }}
        />
      )}
    </main>
  )
}

type GridProps = {
  days: string[]
  bookings: Booking[]
  confirmId: string | null
  onSlot: (date: string, min: number) => void
  onOpen: (patientId: string) => void
  onDay: (date: string) => void
  onAskCancel: (id: string | null) => void
  onCancel: (b: Booking) => void
}

function TimeGrid({ days, bookings, confirmId, onSlot, onOpen, onDay, onAskCancel, onCancel }: GridProps) {
  const rows = (DAY_END - DAY_START) / SLOT
  const week = days.length > 1
  const t = today()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div className={week ? 'min-w-[760px]' : ''}>
      {week && (
        <div className="sticky top-0 z-20 flex border-b border-line bg-ivory">
          <div className="sticky left-0 z-10 w-12 shrink-0 bg-ivory" />
          {days.map((d) => {
            const n = bookings.filter((b) => b.date === d).length
            return (
              <button key={d} onClick={() => onDay(d)} title="この日を開く" className={`flex-1 border-l border-line py-1.5 text-center text-xs hover:bg-cream ${d === t ? 'font-semibold text-clinical' : toDate(d).getDay() === 0 ? 'text-error' : ''}`}>
                <span className="font-num">{md(d)}</span>
                <span className="ml-1 text-[10px] text-mist">{isOpenDay(d) ? `${n}件` : '休診'}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="flex">
        {/* 時刻の列 */}
        <div className={`relative w-12 shrink-0 ${week ? 'sticky left-0 z-[25] bg-ivory' : ''}`} style={{ height: rows * ROW }}>
          {Array.from({ length: rows / 2 }, (_, i) => DAY_START + i * 30).map((m) => (
            <span key={m} style={{ top: m === DAY_START ? 2 : ((m - DAY_START) / SLOT) * ROW - 6 }} className={`font-num absolute right-1.5 text-[10px] ${m % 60 === 0 ? 'text-ink' : 'text-mist/70'}`}>
              {hhmmOf(m)}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const dayB = bookings.filter((b) => b.date === d)
          const lay = layout(dayB)
          return (
            <div key={d} className="relative min-w-0 flex-1 border-l border-line" style={{ height: rows * ROW }}>
              {/* 空いている枠：押すと予約を入れる */}
              {Array.from({ length: rows }, (_, i) => DAY_START + i * SLOT).map((m) => {
                const open = isOpenAt(d, m)
                return (
                  <button
                    key={m}
                    disabled={!open}
                    tabIndex={open ? 0 : -1}
                    onClick={() => onSlot(d, m)}
                    aria-label={`${md(d)} ${hhmmOf(m)} に予約を入れる`}
                    style={{ top: ((m - DAY_START) / SLOT) * ROW, height: ROW }}
                    className={`group absolute inset-x-0 border-t text-left outline-none ${m % 60 === 0 ? 'border-line' : 'border-line/40'} ${open ? 'hover:bg-gold-soft/50 focus-visible:bg-gold-soft/70' : ''}`}
                  >
                    {open && <span className="hidden pl-1.5 text-[11px] text-gold-dark group-hover:inline group-focus-visible:inline">＋ {hhmmOf(m)}</span>}
                  </button>
                )
              })}
              {/* 昼休み・休診 */}
              {closedRanges(d).map(([s, e, label]) => (
                <div
                  key={s}
                  style={{ top: ((s - DAY_START) / SLOT) * ROW, height: ((e - s) / SLOT) * ROW }}
                  className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,var(--color-surface-2)_0,var(--color-surface-2)_6px,var(--color-surface-1)_6px,var(--color-surface-1)_12px)]"
                >
                  <span className="rounded bg-ivory/80 px-2 py-0.5 text-[11px] text-mist">{label}</span>
                </div>
              ))}
              {/* 今の時刻 */}
              {d === t && nowMin >= DAY_START && nowMin <= DAY_END && (
                <div style={{ top: ((nowMin - DAY_START) / SLOT) * ROW }} className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-error">
                  <span className="absolute -top-[5px] -left-[5px] h-2 w-2 rounded-full bg-error" />
                </div>
              )}
              {dayB.map((b) => {
                const L = lay.get(b.id)!
                const top = ((minOf(b.time) - DAY_START) / SLOT) * ROW + 1
                const h = Math.max(ROW, (b.minutes / SLOT) * ROW) - 2
                const st = purposeStyle(b.purpose)
                const confirming = confirmId === b.id
                return (
                  <div
                    key={b.id}
                    style={{ top, height: h, left: `calc(${(L.lane / L.lanes) * 100}% + 2px)`, width: `calc(${100 / L.lanes}% - 4px)` }}
                    className={`group/card absolute z-10 overflow-hidden rounded-md border-l-4 shadow-sm ${st.card} ${b.patientId ? '' : 'opacity-75'}`}
                  >
                    {confirming ? (
                      <div className="flex h-full items-center gap-1 bg-ivory px-1.5 text-[11px]">
                        <span className="truncate">取り消す？</span>
                        <button onClick={() => onCancel(b)} className="rounded bg-error px-1.5 text-white">
                          はい
                        </button>
                        <button onClick={() => onAskCancel(null)} className="rounded border border-line px-1.5">
                          いいえ
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => b.patientId && onOpen(b.patientId)}
                          disabled={!b.patientId}
                          title={`${b.time} ${b.name}（${b.purpose}・${b.minutes}分）${b.memo ? `\n${b.memo}` : ''}${b.patientId ? '\n押すとカルテを開く' : '\nカルテのない架空の予約'}`}
                          className={`flex h-full w-full items-start gap-1 px-1.5 py-[3px] text-left text-[11px] leading-tight ${b.patientId ? 'hover:brightness-95' : 'cursor-default'}`}
                        >
                          <span className="font-num shrink-0 text-mist">{b.time}</span>
                          <span className={`min-w-0 truncate ${b.patientId ? 'font-semibold' : ''}`}>{b.name}</span>
                          {!week && <span className="shrink-0 text-mist">{b.purpose}</span>}
                          {!week && b.memo && h > ROW && <span className="min-w-0 truncate text-mist">・{b.memo}</span>}
                        </button>
                        {b.patientId && (
                          <button
                            onClick={() => onAskCancel(b.id)}
                            aria-label={`${b.name}の予約を取り消す`}
                            className="absolute top-0.5 right-0.5 hidden h-4 w-4 items-center justify-center rounded bg-ivory/90 text-mist group-hover/card:flex hover:text-error focus-visible:flex"
                          >
                            <Icon name="close" size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 空いている枠を押したときの予約の入力
function BookDialog({
  date,
  min,
  patients,
  all,
  initialPatientId,
  onSave,
  onClose,
}: {
  date: string
  min: number
  patients: Patient[]
  all: Booking[]
  initialPatientId?: string
  onSave: (patientId: string, appt: Appointment) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [pid, setPid] = useState<string | null>(initialPatientId ?? null)
  const patient = patients.find((p) => p.id === pid)
  const [purpose, setPurpose] = useState<string>(patient && patient.encounters.length === 0 ? '初診' : '定期')
  const [minutes, setMinutes] = useState(15)
  const [time, setTime] = useState(min)
  const [memo, setMemo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => (pid ? saveRef.current?.focus() : inputRef.current?.focus()), [pid])

  const hits = useMemo(() => {
    const k = toHira(q.trim().toLowerCase()).replace(/\s/g, '')
    return patients.filter((p) => !k || toHira(`${p.name}${p.kana}${p.id}`.toLowerCase()).replace(/\s/g, '').includes(k)).slice(0, 6)
  }, [q, patients])

  const pick = (p: Patient) => {
    setPid(p.id)
    setPurpose(p.encounters.length === 0 ? '初診' : '定期')
  }
  const busy = new Set(all.filter((b) => b.date === date).map((b) => minOf(b.time)))
  const slots = sessionsOf(toDate(date).getDay()).flatMap(([s, e]) => Array.from({ length: (e - s) / SLOT }, (_, i) => s + i * SLOT))
  const save = () => pid && onSave(pid, { id: uid('ap'), date, time: hhmmOf(time), minutes, purpose, memo: memo.trim() || undefined, status: '予約' })

  return (
    <Dialog label="予約を入れる" onClose={onClose}>
      <DialogHead icon="event" title="予約を入れる" sub={`${longDate(date)} ${hhmmOf(time)}〜`} onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <div className="mb-1 text-xs text-mist">患者</div>
          {patient ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-cream px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{patient.name}</span>
                <span className="block text-xs text-mist">
                  {patient.kana}・ID {patient.id.toUpperCase()}
                </span>
              </span>
              <button
                onClick={() => {
                  setPid(null)
                  setQ('')
                }}
                className="btn btn-sm btn-text"
              >
                変更
              </button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setHi(0)
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'ArrowDown') setHi((i) => Math.min(hits.length - 1, i + 1))
                  else if (e.key === 'ArrowUp') setHi((i) => Math.max(0, i - 1))
                  else if (e.key === 'Enter' && hits[hi]) pick(hits[hi])
                  else return
                  e.preventDefault()
                }}
                placeholder="氏名・カナで探す（例：やまだ）↑↓ Enter"
                className="field h-9 w-full px-3 text-sm"
              />
              <ul className="mt-1 divide-y divide-line overflow-hidden rounded-lg border border-line">
                {hits.map((p, i) => (
                  <li key={p.id}>
                    <button onClick={() => pick(p)} onMouseEnter={() => setHi(i)} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-gold-soft' : ''}`}>
                      <span className="flex-1">{p.name}</span>
                      <span className="text-xs text-mist">{p.kana}</span>
                    </button>
                  </li>
                ))}
                {hits.length === 0 && <li className="px-3 py-2 text-xs text-mist">該当する患者がいません（新患は受付の「新患登録」から）</li>}
              </ul>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="block">
            <span className="mb-1 block text-xs text-mist">時刻</span>
            <select value={time} onChange={(e) => setTime(Number(e.target.value))} className="field h-9 px-2 text-sm">
              {slots.map((m) => (
                <option key={m} value={m}>
                  {hhmmOf(m)}
                  {busy.has(m) ? '（ほかの予約あり）' : ''}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-xs text-mist">時間</span>
            <div className="flex gap-1">
              {[15, 30, 45, 60].map((n) => (
                <button key={n} onClick={() => setMinutes(n)} className={`chip h-9 ${minutes === n ? 'chip-on' : ''}`}>
                  {n}分
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs text-mist">目的</span>
          <div className="flex flex-wrap gap-1">
            {PURPOSES.map((p) => (
              <button key={p} onClick={() => setPurpose(p)} className={`chip h-8 ${purpose === p ? 'chip-on' : ''}`}>
                <span className={`h-2 w-2 rounded-full ${purposeStyle(p).dot}`} />
                {p}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-mist">メモ</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例：空腹で来院" className="field h-9 w-full px-3 text-sm" />
        </label>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3">
        <button onClick={onClose} className="btn btn-outlined">
          やめる
        </button>
        <button ref={saveRef} onClick={save} disabled={!pid} className="btn btn-filled disabled:opacity-50">
          <Icon name="event_available" size={18} />
          予約する
        </button>
      </div>
    </Dialog>
  )
}

// ---- 記載の帯の「次回予約」 ----

export function NextVisit({ patient, draft, dispatch }: { patient: Patient; draft: Draft; dispatch: (a: Action) => void }) {
  // 開いた位置（記載の枠は overflow-hidden なので、ボタンの位置から fixed で出して切れないようにする）
  const [open, setOpen] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const t = today()
  const next = (patient.appointments ?? []).filter((a) => a.date > t && a.status !== 'キャンセル').sort((a, b) => `${a.date} ${a.time.padStart(5, '0')}`.localeCompare(`${b.date} ${b.time.padStart(5, '0')}`))[0]

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(null)
    const resize = () => setOpen(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', resize)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => setOpen(open ? null : e.currentTarget.getBoundingClientRect())}
        aria-expanded={!!open}
        title="次回予約"
        className={`flex h-8 items-center gap-1 rounded-md border px-2 text-xs whitespace-nowrap touch:h-10 ${next ? 'border-clinical/30 bg-[#e6eef4] text-clinical' : 'border-line bg-ivory text-mist hover:bg-cream'}`}
      >
        <Icon name={next ? 'event_available' : 'event'} size={16} />
        <span className="max-sm:hidden">次回</span>
        <span className={`font-num ${next ? 'font-medium' : ''}`}>{next ? `${md(next.date)} ${next.time}` : '未定'}</span>
      </button>
      {open && <NextVisitPanel key={next?.id ?? 'new'} anchor={open} patient={patient} draft={draft} next={next} dispatch={dispatch} onClose={() => setOpen(null)} />}
    </div>
  )
}

const PANEL_W = 352

function NextVisitPanel({ anchor, patient, draft, next, dispatch, onClose }: { anchor: DOMRect; patient: Patient; draft: Draft; next?: Appointment; dispatch: (a: Action) => void; onClose: () => void }) {
  const phone = window.innerWidth < 768
  const pos = phone ? undefined : { top: anchor.bottom + 4, left: Math.max(8, Math.min(anchor.right - PANEL_W, window.innerWidth - PANEL_W - 8)), width: PANEL_W }
  const t = today()
  // 今回の処方（下書き）の内服の最大日数。なければ前回の処方が切れる日
  const draftDays = Math.max(0, ...draft.rx.filter((r) => r.form !== 'external' && r.usage && parseUsage(r.usage).times !== null).map((r) => r.days))
  const lastOut = rxRunsOut(patient)
  const runout = draftDays ? addDays(t, draftDays) : lastOut ? ymd(lastOut) : undefined
  const sugg = [
    ...(runout && runout > t ? [{ label: draftDays ? `処方切れ前（${draftDays}日分）` : '処方切れ前', date: snapOpen(runout, -1) }] : []),
    { label: '2週後', date: snapOpen(addDays(t, 14), -1) },
    { label: '4週後', date: snapOpen(addDays(t, 28), -1) },
    { label: '8週後', date: snapOpen(addDays(t, 56), -1) },
  ]
  const [date, setDate] = useState(next?.date ?? sugg[0].date)
  const [purpose, setPurpose] = useState(next?.purpose ?? '定期')
  const [minutes, setMinutes] = useState(next?.minutes ?? 15)
  // いつもの時刻（今日の予約か、次回の予約の時刻）
  const usual = minOf(next?.time ?? patient.appointments?.find((a) => a.date === t)?.time ?? '10:00')
  const all = useMemo(() => bookingsOf([patient]), [patient])
  const slots = freeSlots(all, date, minutes, next?.id)
  const [time, setTime] = useState<number | null>(null)
  const closest = slots.length ? slots.reduce((a, b) => (Math.abs(b - usual) < Math.abs(a - usual) ? b : a)) : null
  const chosen = time !== null && slots.includes(time) ? time : closest
  const saveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => saveRef.current?.focus(), [])

  const save = () => {
    if (chosen === null) return
    dispatch({ type: 'saveAppointment', patientId: patient.id, appt: { id: next?.id ?? uid('ap'), date, time: hhmmOf(chosen), minutes, purpose, status: '予約' } })
    onClose()
  }
  const saveFn = useRef(save)
  saveFn.current = save
  const suggRef = useRef(sugg)
  suggRef.current = sugg

  // Esc で閉じる、1〜4 で候補の日、Enter（ボタン以外）で予約
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      const typing = isTyping(e.target)
      if (!typing && !e.metaKey && !e.ctrlKey && /^[1-4]$/.test(e.key) && suggRef.current[Number(e.key) - 1]) {
        e.preventDefault()
        e.stopPropagation()
        setDate(suggRef.current[Number(e.key) - 1].date)
        setTime(null)
      } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        e.stopPropagation()
        saveFn.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const am = slots.filter((m) => m < 13 * 60)
  const pm = slots.filter((m) => m >= 13 * 60)
  const timeChips = (list: number[]) =>
    list.map((m) => (
      <button key={m} onClick={() => setTime(m)} className={`font-num h-7 rounded-md border px-1.5 text-xs ${m === chosen ? 'border-clinical bg-clinical text-ivory' : 'border-line bg-white hover:border-clinical'}`}>
        {hhmmOf(m)}
      </button>
    ))

  return (
    <div
      role="dialog"
      aria-label="次回予約"
      style={pos}
      className="fixed z-[70] rounded-xl border border-line bg-ivory p-3 text-sm shadow-soft max-md:inset-x-2 max-md:bottom-2 max-md:shadow-2xl"
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon name="event" size={18} className="text-clinical" />
        <span className="flex-1 font-semibold">次回予約</span>
        {next && (
          <button
            onClick={() => {
              dispatch({ type: 'removeAppointment', patientId: patient.id, id: next.id })
              onClose()
            }}
            className="text-xs text-error hover:underline"
          >
            予約を取り消す
          </button>
        )}
      </div>
      {next && (
        <p className="mb-2 rounded-md bg-[#e6eef4] px-2 py-1 text-xs text-clinical">
          いまの予約：{md(next.date)} {next.time}・{next.purpose}（変更すると置き換えます）
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-1">
        {sugg.map((s, i) => (
          <button
            key={s.label}
            onClick={() => {
              setDate(s.date)
              setTime(null)
            }}
            className={`chip h-auto flex-col items-start gap-0 py-1 text-left ${date === s.date ? 'chip-on' : ''}`}
          >
            <span className="text-[10px] text-mist">
              <span className="kbd mr-1">{i + 1}</span>
              {s.label}
            </span>
            <span className="font-num text-xs font-medium">{md(s.date)}</span>
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <input
          type="date"
          value={date}
          min={t}
          onChange={(e) => {
            if (!e.target.value) return
            setDate(e.target.value)
            setTime(null)
          }}
          className="field h-8 px-2 text-sm"
        />
        <span className="text-xs text-mist">{daysBetween(t, date)}日後</span>
        {!isOpenDay(date) && <span className="text-xs font-medium text-error">休診日です</span>}
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-center gap-2 text-xs text-mist">
          空いている時刻
          <span className="flex-1" />
          {[15, 30].map((n) => (
            <button key={n} onClick={() => setMinutes(n)} className={`rounded px-1.5 py-0.5 ${minutes === n ? 'bg-gold-soft text-ink' : 'hover:bg-cream'}`}>
              {n}分
            </button>
          ))}
        </div>
        {slots.length === 0 ? (
          <p className="rounded-md bg-cream px-2 py-2 text-xs text-mist">この日は空きがありません</p>
        ) : (
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {am.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-7 text-[10px] text-mist">午前</span>
                {timeChips(am)}
              </div>
            )}
            {pm.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-7 text-[10px] text-mist">午後</span>
                {timeChips(pm)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {PURPOSES.filter((p) => p !== '初診').map((p) => (
          <button key={p} onClick={() => setPurpose(p)} className={`chip h-7 text-xs ${purpose === p ? 'chip-on' : ''}`}>
            <span className={`h-2 w-2 rounded-full ${purposeStyle(p).dot}`} />
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-mist touch:invisible">1〜4で候補・Enterで予約</span>
        <button onClick={onClose} className="btn btn-sm btn-text">
          やめる
        </button>
        <button ref={saveRef} onClick={save} disabled={chosen === null} className="btn btn-sm btn-filled disabled:opacity-50">
          {chosen === null ? '予約する' : `${md(date)} ${hhmmOf(chosen)} で予約`}
        </button>
      </div>
    </div>
  )
}
