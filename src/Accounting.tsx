import { useEffect, useMemo, useRef, useState } from 'react'
import { BILL_CATS, calcBill, yen, type Bill, type GenericLevel } from './billing'
import { today, uid } from './data'
import { Icon } from './Icon'
import { dayLabel } from './LeftPane'
import { PatientIcon, ageSex } from './PatientIcon'
import { PrescriptionWindow, genericLevel } from './Prescription'
import { ReceiptWindow } from './Receipt'
import type { Action } from './store'
import type { Encounter, Patient, Payment } from './types'

// 会計：左に会計待ち・会計済の一覧、右に選んだ患者の点数（仮）と精算。
// キー：↑↓で患者を選ぶ、Enterで預り金へ、預り金でEnter または ⌘Enter で会計済
type Method = Payment['method']
const METHODS: Method[] = ['現金', 'カード', 'QR']

const STATUS_CHIP: Record<string, string> = {
  会計待ち: 'bg-gold-dark text-white',
  済: 'bg-cream text-mist border border-line',
}

const lastEncounter = (p: Patient): Encounter | undefined => [...p.encounters].sort((a, b) => b.date.localeCompare(a.date))[0]
const paymentOf = (p: Patient, e?: Encounter) => (e ? p.payments?.findLast((x) => x.encounterId === e.id) : undefined)
const summary = (e?: Encounter) => (e ? [e.kind, e.rx.length && `処方${e.rx.length}剤`, e.tests.length && `検査${e.tests.length}`, e.letters.length && '紹介状'].filter(Boolean).join('・') : '受診の記録なし')

// 会計済なら会計した時の点数に合う計算を使う（あとで処方箋の一般名の設定を変えても領収書の金額を変えない）。
// 合わなければ今の計算に、違いの警告を足す
const billFor = (p: Patient, e: Encounter, paid?: Payment): Bill => {
  const now = calcBill(p, e, { generic: genericLevel(e) })
  if (!paid || now.total === paid.points) return now
  const levels: GenericLevel[] = ['all', 'some', 'none']
  const same = levels.map((g) => calcBill(p, e, { generic: g })).find((b) => b.total === paid.points)
  return same ?? { ...now, warnings: [...now.warnings, `会計済の金額（${yen(paid.charge)}）と今の計算（${yen(now.charge)}）が違います。返金・追加の徴収を確認してください`] }
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

export function AccountingPage({ patients, dispatch, onOpen }: { patients: Patient[]; dispatch: (a: Action) => void; onOpen: (id: string) => void }) {
  const list = useMemo(
    () => patients.filter((p) => p.status === '会計待ち' || p.status === '済').sort((a, b) => (a.status === b.status ? 0 : a.status === '会計待ち' ? -1 : 1)),
    [patients],
  )
  const [selId, setSelId] = useState<string | null>(null)
  const sel = list.find((p) => p.id === selId) ?? list.find((p) => p.status === '会計待ち') ?? list[0]
  const [done, setDone] = useState<string | null>(null)
  const receivedRef = useRef<HTMLInputElement>(null)
  const payRef = useRef<() => void>(() => {})
  const listRef = useRef({ list, sel })
  listRef.current = { list, sel }

  const paidToday = patients.flatMap((p) => (p.payments ?? []).filter((x) => x.date === today()))
  const waiting = list.filter((p) => p.status === '会計待ち').length

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(null), 5000)
    return () => clearTimeout(t)
  }, [done])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || document.querySelector('[aria-modal="true"]')) return
      const { list: l, sel: s } = listRef.current
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        return payRef.current()
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || !l.length) return
      const i = s ? l.indexOf(s) : -1
      if (e.key === 'ArrowDown' || e.key === 'j') setSelId(l[Math.min(l.length - 1, i + 1)].id)
      else if (e.key === 'ArrowUp' || e.key === 'k') setSelId(l[Math.max(0, i - 1)].id)
      else if (e.key === 'Enter') receivedRef.current?.focus()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onPaid = (p: Patient, change: number) => {
    setDone(`${p.name} さんの会計を済にしました${change > 0 ? `（おつり ${yen(change)}）` : ''}`)
    const next = list.find((x) => x.status === '会計待ち' && x.id !== p.id)
    setSelId(next?.id ?? p.id)
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6 pt-5 pb-4 max-lg:overflow-y-auto max-md:px-3 max-md:pt-3">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="mr-1 text-base font-semibold whitespace-nowrap">会計</h1>
        <Stat label="会計待ち" value={`${waiting}人`} strong={waiting > 0} />
        <Stat label="本日の会計済" value={`${paidToday.length}件`} />
        <Stat label="窓口負担の合計" value={yen(paidToday.reduce((s, x) => s + x.charge, 0))} />
        <span className="flex-1" />
        {done && (
          <span role="status" className="flex items-center gap-1.5 rounded-full bg-ink/90 px-3 py-1 text-xs text-ivory">
            <Icon name="check_circle" size={16} />
            {done}
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="max-w-5xl rounded-lg border border-dashed border-line bg-ivory px-6 py-12 text-center text-mist">会計待ちの患者はいません（カルテを確定すると会計待ちになります）</div>
      ) : (
        <div className="flex gap-4 max-lg:flex-col lg:min-h-0 lg:flex-1">
          <ul aria-label="会計の一覧" className="card shrink-0 divide-y divide-line overflow-hidden lg:w-80 lg:overflow-y-auto">
            {list.map((p) => {
              const e = lastEncounter(p)
              const on = p === sel
              const charge = paymentOf(p, e)?.charge ?? (e ? billFor(p, e).charge : 0)
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSelId(p.id)}
                    aria-current={on}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${on ? 'bg-[#f3ead8] outline-2 -outline-offset-2 outline-clinical' : p.status === '会計待ち' ? 'bg-[#fff8e6] hover:brightness-[0.98]' : 'hover:bg-cream'}`}
                  >
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ${STATUS_CHIP[p.status]}`}>{p.status}</span>
                    <PatientIcon patient={p} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-[0.6875rem] text-mist">{summary(e)}</span>
                    </span>
                    <span className={`shrink-0 font-num text-sm ${p.status === '済' ? 'text-mist' : 'font-medium'}`}>{yen(charge)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {sel && <Checkout key={sel.id} patient={sel} dispatch={dispatch} onOpen={onOpen} onPaid={onPaid} receivedRef={receivedRef} payRef={payRef} />}
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-mist">
        <Icon name="info" size={16} />
        点数は画面確認用の仮計算です（2024年度の点数表が目安・2026年度改定は未反映）。正式な算定はレセコンで行います。↑↓で患者、Enterで預り金、⌘Enterで会計済。
      </p>
    </main>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className={`flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 text-xs ${strong ? 'border-gold bg-gold-soft' : 'border-line bg-ivory'}`}>
      <span className="text-mist">{label}</span>
      <span className="font-num text-sm font-semibold">{value}</span>
    </span>
  )
}

type CheckoutProps = {
  patient: Patient
  dispatch: (a: Action) => void
  onOpen: (id: string) => void
  onPaid: (p: Patient, change: number) => void
  receivedRef: React.RefObject<HTMLInputElement | null>
  payRef: React.RefObject<() => void>
}

function Checkout({ patient, dispatch, onOpen, onPaid, receivedRef, payRef }: CheckoutProps) {
  const e = lastEncounter(patient)
  const [rev, setRev] = useState(0) // 処方箋の設定（一般名）を変えたら点数を計算し直す
  const paid = paymentOf(patient, e)
  const bill = useMemo(() => (e ? billFor(patient, e, paid) : null), [patient, e, paid, rev])
  const [received, setReceived] = useState('')
  const [method, setMethod] = useState<Method>('現金')
  const [err, setErr] = useState('')
  const [win, setWin] = useState<'rx' | 'receipt' | null>(null)
  const waiting = patient.status === '会計待ち'

  const recv = received === '' ? (bill?.charge ?? 0) : Number(received)
  const change = recv - (bill?.charge ?? 0)

  const pay = () => {
    if (!waiting || !e || !bill) return
    const r = method === '現金' ? recv : bill.charge
    if (r < bill.charge) {
      setErr(`預り金が ${yen(bill.charge - r)} 足りません`)
      receivedRef.current?.focus()
      return
    }
    dispatch({ type: 'paid', patientId: patient.id, payment: { id: uid('pay'), date: today(), encounterId: e.id, points: bill.total, charge: bill.charge, received: r, method } })
    onPaid(patient, r - bill.charge)
  }
  payRef.current = pay

  if (!e || !bill)
    return <div className="card flex flex-1 items-center justify-center p-10 text-sm text-mist">{patient.name} さんの受診の記録がありません</div>

  return (
    <section aria-label={`${patient.name}の会計`} className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1">
      {/* 患者と受診日・操作 */}
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-l-clinical px-4 py-2.5">
        <PatientIcon patient={patient} size={34} />
        <div className="leading-tight">
          <div className="text-[0.6875rem] text-mist">{patient.kana}</div>
          <div className="text-lg font-semibold">{patient.name}</div>
        </div>
        <span className="text-sm">
          <span className={patient.sex === '女' ? 'text-red-600' : 'text-clinical'}>{ageSex(patient)}</span>
        </span>
        <span className="pill whitespace-nowrap">
          {patient.insurance} {Math.round(patient.burden * 10)}割
        </span>
        <span className="text-sm whitespace-nowrap text-mist">
          {dayLabel(e.date)} {e.kind}
        </span>
        <span className="flex-1" />
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => onOpen(patient.id)} className="btn btn-sm btn-text">
            <Icon name="clinical_notes" size={18} />
            カルテ
          </button>
          {e.rx.length > 0 && (
            <button onClick={() => setWin('rx')} className="btn btn-sm btn-outlined">
              <Icon name="prescriptions" size={18} />
              処方箋を印刷
            </button>
          )}
          <button onClick={() => setWin('receipt')} className="btn btn-sm btn-outlined">
            <Icon name="receipt_long" size={18} />
            領収書・明細書
          </button>
        </div>
      </div>

      {bill.warnings.map((w) => (
        <p key={w} className="flex items-center gap-1.5 rounded-md border border-gold bg-gold-soft px-3 py-2 text-xs">
          <Icon name="warning" size={16} className="text-gold-dark" />
          {w}
        </p>
      ))}

      <div className="flex gap-3 max-xl:flex-col lg:min-h-0 lg:flex-1">
        {/* 点数（仮） */}
        <div className="card flex min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1">
          <div className="flex shrink-0 items-baseline gap-2 border-b border-line bg-cream px-4 py-2">
            <h2 className="text-sm font-semibold">診療内容と点数</h2>
            <span className="rounded bg-gold-soft px-1.5 text-[0.6875rem] text-gold-dark">仮計算</span>
            <span className="flex-1" />
            <span className="font-num text-sm">
              合計 <span className="text-base font-semibold">{bill.total.toLocaleString()}</span> 点
            </span>
          </div>
          <div className="px-4 py-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {BILL_CATS.filter((c) => bill.lines.some((l) => l.cat === c)).map((c) => (
              <div key={c} className="border-b border-line py-2 last:border-b-0">
                <div className="mb-1 flex items-baseline text-xs font-medium text-mist">
                  {c}
                  <span className="flex-1" />
                  <span className="font-num">{bill.byCat[c].toLocaleString()}点</span>
                </div>
                {bill.lines
                  .filter((l) => l.cat === c)
                  .map((l, i) => (
                    <div key={i} className="flex items-baseline gap-2 py-0.5 pl-3 text-[0.8125rem]">
                      <span className="min-w-0 flex-1">
                        {l.name}
                        {l.note && <span className="ml-2 text-[0.6875rem] text-mist">{l.note}</span>}
                      </span>
                      <span className={`shrink-0 font-num ${l.points ? '' : 'text-mist'}`}>{l.points.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>

        {/* 精算 */}
        <div className="card shrink-0 space-y-3 px-4 py-3 xl:w-80">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-mist">合計点数</span>
            <span className="font-num">{bill.total.toLocaleString()}点</span>
          </div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-mist">負担割合</span>
            <span>{Math.round(bill.burden * 10)}割</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-2">
            <span className="text-sm font-medium">請求額</span>
            <span className="font-num text-3xl font-semibold">{yen(bill.charge)}</span>
          </div>

          {paid ? (
            <div className="space-y-1.5 rounded-lg bg-cream px-3 py-2.5 text-sm">
              <div className="flex items-center gap-1.5 font-medium text-[#0d6e61]">
                <Icon name="check_circle" size={18} fill />
                会計済（{paid.method}）
              </div>
              {paid.method === '現金' && (
                <div className="flex justify-between font-num text-xs text-mist">
                  <span>お預り {yen(paid.received)}</span>
                  <span>おつり {yen(paid.received - paid.charge)}</span>
                </div>
              )}
              <button onClick={() => setWin('receipt')} className="btn btn-sm btn-tonal w-full">
                <Icon name="print" size={16} />
                領収書を再発行
              </button>
            </div>
          ) : waiting ? (
            <>
              <div>
                <span className="mb-1 block text-xs text-mist">支払方法</span>
                <div className="flex rounded-md border border-line bg-cream p-0.5">
                  {METHODS.map((m) => (
                    <button key={m} onClick={() => setMethod(m)} className={`h-8 flex-1 rounded text-sm ${method === m ? 'bg-ivory font-medium shadow-soft' : 'text-mist'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {method === '現金' && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs text-mist">預り金（空ならちょうど）</span>
                    <span className="flex items-center gap-1.5">
                      <input
                        ref={receivedRef}
                        value={received}
                        inputMode="numeric"
                        onChange={(ev) => {
                          setReceived(ev.target.value.replace(/\D/g, ''))
                          setErr('')
                        }}
                        onKeyDown={(ev) => {
                          if (ev.nativeEvent.isComposing || ev.key !== 'Enter' || ev.metaKey || ev.ctrlKey) return
                          ev.preventDefault()
                          pay()
                        }}
                        placeholder={bill.charge.toLocaleString()}
                        aria-label="預り金"
                        className="field h-10 flex-1 text-right font-num text-lg"
                      />
                      <span className="text-sm text-mist">円</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 1000, 5000, 10000].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setReceived(v ? String(v) : String(bill.charge))
                          setErr('')
                        }}
                        className="chip justify-center px-1 font-num"
                      >
                        {v ? v.toLocaleString() : 'ちょうど'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm">{change < 0 ? '不足' : 'おつり'}</span>
                    <span className={`font-num text-2xl font-semibold ${change < 0 ? 'text-error' : ''}`}>{yen(Math.abs(change))}</span>
                  </div>
                </>
              )}
              {err && <p className="text-xs font-medium text-error">{err}</p>}
              <button onClick={pay} className="btn btn-filled h-11 w-full text-base">
                <Icon name="payments" size={20} />
                会計を済にする
                <span className="kbd">⌘Enter</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {win === 'rx' && (
        <PrescriptionWindow
          patient={patient}
          encounter={e}
          onClose={() => {
            setWin(null)
            setRev((n) => n + 1)
          }}
        />
      )}
      {win === 'receipt' && <ReceiptWindow patient={patient} encounter={e} bill={bill} paid={paid ? { received: paid.received, method: paid.method } : null} onClose={() => setWin(null)} />}
    </section>
  )
}
