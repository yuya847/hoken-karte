import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BILL_CATS, yen, type Bill } from './billing'
import { CLINIC } from './data'
import { wareki } from './docs/kit'
import { Icon } from './Icon'
import { Paper, PrintPreview } from './print'
import type { Encounter, Patient } from './types'

// 領収証と診療明細書（A4 1枚：上に領収証、下に明細書）。点数は billing.ts の仮計算
type Paid = { received: number; method: string } | null

const cell = 'border-r border-b border-black px-[1mm] text-center'

export function ReceiptSheet({ patient, encounter, bill, paid }: { patient: Patient; encounter: Encounter; bill: Bill; paid: Paid }) {
  const no = `R${encounter.date.replace(/-/g, '')}-${patient.id.toUpperCase()}`
  const cats = BILL_CATS
  const half = Math.ceil(cats.length / 2)
  const rows = [cats.slice(0, half), cats.slice(half)]
  return (
    <Paper className="px-[14mm]! py-[12mm]! text-[9pt]!">
      {/* 領収証 */}
      <div className="flex items-end justify-between">
        <h1 className="text-[18pt] tracking-[0.6em]">領収証</h1>
        <span className="text-[8pt]">領収書番号 {no}</span>
      </div>
      <div className="mt-[2mm] grid grid-cols-[22mm_1fr_22mm_1fr] border-t border-l border-black text-[9pt]">
        <div className={`${cell} bg-[#f2f2f2]`}>患者ID</div>
        <div className="border-r border-b border-black px-[2mm]">{patient.id.toUpperCase()}</div>
        <div className={`${cell} bg-[#f2f2f2]`}>氏名</div>
        <div className="border-r border-b border-black px-[2mm] text-[11pt]">{patient.name} 様</div>
        <div className={`${cell} bg-[#f2f2f2]`}>受診日</div>
        <div className="border-r border-b border-black px-[2mm]">{wareki(encounter.date)}</div>
        <div className={`${cell} bg-[#f2f2f2]`}>費用区分</div>
        <div className="border-r border-b border-black px-[2mm]">
          {patient.insurance}（負担 {Math.round(patient.burden * 10)}割）・外来・{encounter.kind}
        </div>
      </div>

      <div className="mt-[3mm] text-[8.5pt]">保険（点数）</div>
      <div className="border-t border-l border-black text-[8pt]">
        {rows.map((r, i) => (
          <div key={i} className="grid" style={{ gridTemplateColumns: `repeat(${half}, 1fr)` }}>
            {r.map((c) => (
              <div key={c} className="border-r border-b border-black">
                <div className="border-b border-black bg-[#f2f2f2] py-[0.5mm] text-center text-[7pt] leading-tight">{c}</div>
                <div className="py-[1mm] pr-[1.5mm] text-right text-[10pt]">{bill.byCat[c] ? `${bill.byCat[c].toLocaleString()}点` : ''}</div>
              </div>
            ))}
            {r.length < half && <div className="border-r border-b border-black" />}
          </div>
        ))}
      </div>

      <div className="mt-[3mm] flex gap-[4mm]">
        <div className="grid flex-1 grid-cols-[1fr_1fr] border-t border-l border-black text-[9pt]">
          <div className={`${cell} bg-[#f2f2f2]`}>保険 合計</div>
          <div className="border-r border-b border-black px-[2mm] text-right">{bill.total.toLocaleString()}点</div>
          <div className={`${cell} bg-[#f2f2f2]`}>保険 負担額</div>
          <div className="border-r border-b border-black px-[2mm] text-right">{yen(bill.charge)}</div>
          <div className={`${cell} bg-[#f2f2f2]`}>保険外負担（自費）</div>
          <div className="border-r border-b border-black px-[2mm] text-right">0円</div>
        </div>
        <div className="flex w-[70mm] flex-col border border-black">
          <div className="bg-[#f2f2f2] py-[0.5mm] text-center text-[8pt]">領収金額</div>
          <div className="flex flex-1 items-center justify-center text-[18pt] font-semibold">{yen(bill.charge)}</div>
          {paid && (
            <div className="border-t border-black px-[2mm] py-[0.5mm] text-[7.5pt]">
              {paid.method}
              {paid.method === '現金' && `　お預り ${yen(paid.received)}　おつり ${yen(Math.max(0, paid.received - bill.charge))}`}
            </div>
          )}
        </div>
      </div>

      <div className="mt-[3mm] flex items-end justify-between text-[8pt]">
        <div className="space-y-[0.3mm]">
          <div className="text-[10pt]">{CLINIC.name}</div>
          <div>
            〒{CLINIC.zip} {CLINIC.address}
          </div>
          <div>電話 {CLINIC.phone}</div>
        </div>
        <div className="flex h-[16mm] w-[16mm] items-center justify-center border border-black text-[8pt]">領収印</div>
      </div>
      <p className="mt-[1.5mm] text-[6.5pt]">※厚生労働省が定める診療報酬や薬価等には、医療機関等が仕入れ時に負担する消費税が反映されています。</p>

      {/* 切り取り線 */}
      <div className="my-[4mm] flex items-center gap-[2mm] text-[7pt] text-[#555]">
        <span className="flex-1 border-t border-dashed border-[#888]" />
        きりとり
        <span className="flex-1 border-t border-dashed border-[#888]" />
      </div>

      {/* 診療明細書 */}
      <div className="flex items-end justify-between">
        <h2 className="text-[14pt] tracking-[0.4em]">診療明細書</h2>
        <span className="text-[8pt]">
          {patient.name} 様 ・ {wareki(encounter.date)} ・ 外来
        </span>
      </div>
      <table className="mt-[2mm] w-full border-collapse text-[8.5pt]">
        <thead>
          <tr className="bg-[#f2f2f2]">
            <th className="w-[26mm] border border-black py-[0.5mm] font-normal">部</th>
            <th className="border border-black font-normal">項目名</th>
            <th className="w-[18mm] border border-black font-normal">点数</th>
            <th className="w-[12mm] border border-black font-normal">回数</th>
          </tr>
        </thead>
        <tbody>
          {BILL_CATS.flatMap((c) =>
            bill.lines
              .filter((l) => l.cat === c)
              .map((l, i) => (
                <tr key={`${c}-${i}`}>
                  <td className="border border-black px-[1.5mm] py-[0.3mm]">{i === 0 ? c : ''}</td>
                  <td className="border border-black px-[1.5mm]">
                    {l.name}
                    {l.note && <span className="ml-[2mm] text-[7pt] text-[#444]">{l.note}</span>}
                  </td>
                  <td className="border border-black px-[1.5mm] text-right">{l.points.toLocaleString()}</td>
                  <td className="border border-black px-[1.5mm] text-right">{l.count}</td>
                </tr>
              )),
          )}
        </tbody>
      </table>
      <p className="mt-[1.5mm] text-[6.5pt]">点数は試作用の仮計算です（正式な算定はレセコンで行います）。</p>
    </Paper>
  )
}

export function ReceiptWindow({ patient, encounter, bill, paid, onClose }: { patient: Patient; encounter: Encounter; bill: Bill; paid: Paid; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onClose])
  return createPortal(
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 max-md:p-0" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="領収証・明細書" className="flex h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-2xl max-md:h-full max-md:rounded-none">
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-ivory px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-soft">
            <Icon name="receipt_long" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">領収証・診療明細書</h2>
            <p className="truncate text-[11px] text-mist">
              {patient.name} ・ {encounter.date.replace(/-/g, '/')} ・ {yen(bill.charge)}
            </p>
          </div>
          <button onClick={() => window.print()} className="btn btn-sm btn-filled">
            <Icon name="print" size={18} />
            印刷
          </button>
          <button onClick={onClose} title="閉じる（Esc）" className="icon-btn icon-btn-sm">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <PrintPreview>
            <ReceiptSheet patient={patient} encounter={encounter} bill={bill} paid={paid} />
          </PrintPreview>
        </div>
      </div>
    </div>,
    document.body,
  )
}
