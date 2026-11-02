import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CLINIC } from './data'
import { wareki } from './docs/kit'
import { Icon } from './Icon'
import { Paper, PrintPreview } from './print'
import { groupRp, isExternal, parseUsage, perDose, usageText } from './rxFormat'
import type { GenericLevel } from './billing'
import type { Encounter, Patient, RxItem } from './types'

// 院外処方箋（様式第二号に合わせたA4の印刷面）と、その設定のウインドウ。
// 一般名処方・変更不可・患者希望・残薬の対応・リフィルはこの処方箋の設定として端末に保存する（カルテの処方は変えない）

export type SheetOpts = {
  generic: Record<string, boolean> // 一般名で書く（rx の id ごと）
  noChange: Record<string, boolean> // 変更不可（医療上必要）
  wish: Record<string, boolean> // 患者希望（長期収載品＝先発品を希望）
  residual: '' | '疑義照会' | '情報提供' // 薬局が残薬を見つけたときの対応
  refill: number // 0＝リフィルなし、2・3＝総使用回数
  issued: string // 交付年月日 YYYY-MM-DD
  until: string // 使用期間（空＝交付日を含めて4日以内）
}

const KEY = 'hoken-karte-rxsheet-v1'

const readAll = (): Record<string, SheetOpts> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

// 一般名処方を既定にする
export const loadSheet = (e: Encounter): SheetOpts => {
  const base: SheetOpts = {
    generic: Object.fromEntries(e.rx.map((r) => [r.id, true])),
    noChange: Object.fromEntries(e.rx.map((r) => [r.id, !!r.noGeneric])),
    wish: {},
    residual: '',
    refill: 0,
    issued: e.date,
    until: '',
  }
  return { ...base, ...readAll()[e.id] }
}

const saveSheet = (id: string, o: SheetOpts) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [id]: o }))
  } catch {
    // 保存できなくても印刷はできる
  }
}

// 会計の一般名処方加算に使う
export const genericLevel = (e: Encounter): GenericLevel => {
  if (e.rx.length === 0) return 'none'
  const o = loadSheet(e)
  const n = e.rx.filter((r) => o.generic[r.id] && !o.wish[r.id]).length
  return n === e.rx.length ? 'all' : n > 0 ? 'some' : 'none'
}

// 一般名（【般】のあとに書く名前）。銘柄名のものは表で置き換え、それ以外は屋号「…」を外す
const GENERIC: Record<string, string> = {
  フランドルテープ40mg: '硝酸イソソルビドテープ40mg',
}
export const genericName = (name: string) =>
  GENERIC[name] ??
  name
    .replace(/「.*?」/g, '')
    .replace('OD錠', '口腔内崩壊錠')
    .replace(/Na(?=テープ|錠)/, 'ナトリウム')

const num = (n: number) => String(Math.round(n * 100) / 100)

// 処方欄の薬の名前と量
const drugLabel = (r: RxItem, o: SheetOpts) => (o.generic[r.id] && !o.wish[r.id] ? `【般】${genericName(r.name)}` : r.name)
const amount = (r: RxItem) => {
  if (isExternal(r)) return `${num(r.dose)}${r.unit}`
  const { times } = parseUsage(r.usage)
  return times ? `1回${num(perDose(r))}${r.unit}（1日${num(r.dose)}${r.unit}）` : `1回${num(r.dose)}${r.unit}`
}
const usageRow = (r: RxItem) => (isExternal(r) ? `${usageText(r.usage)}（1回${num(r.perUse ?? 1)}${r.unit}）${r.site ? `　${r.site}` : ''}` : usageText(r.usage))
const daysRow = (r: RxItem) => (isExternal(r) ? '' : `${r.days}${parseUsage(r.usage).times ? '日分' : '回分'}`)

// ---- 印刷面 ----

// 数字を1文字ずつ枠に入れる（右詰め。国保の6桁は左を空ける）
function Digits({ value = '', n, w = '5.2mm' }: { value?: string; n: number; w?: string }) {
  const v = value.replace(/\D/g, '').slice(-n).padStart(n, ' ')
  return (
    <span className="inline-flex">
      {[...v].map((c, i) => (
        <span key={i} style={{ width: w }} className="flex h-[6.5mm] items-center justify-center border-l border-black text-[11pt]">
          {c.trim()}
        </span>
      ))}
    </span>
  )
}

// 生年月日を元号つきで（1957-04-12 → 昭和 32年 4月 12日）
const ERAS: [string, string, number][] = [
  ['2019-05-01', '令和', 2019],
  ['1989-01-08', '平成', 1989],
  ['1926-12-25', '昭和', 1926],
  ['1912-07-30', '大正', 1912],
  ['1868-01-25', '明治', 1868],
]
const eraOf = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  const e = ERAS.find(([s]) => d >= s) ?? ERAS[ERAS.length - 1]
  return { era: e[1], y: y - e[2] + 1, m, d: day }
}

const th = 'flex shrink-0 items-center justify-center border-black px-[1mm] text-center text-[7.5pt] leading-tight'

export function PrescriptionSheet({ patient, encounter, opts }: { patient: Patient; encounter: Encounter; opts: SheetOpts }) {
  const ins = patient.insurer
  const b = eraOf(patient.birth)
  const groups = groupRp(encounter.rx)
  const insNo = [ins?.symbol, ins?.number].filter(Boolean).join('・')
  return (
    <Paper className="px-[12mm]! py-[10mm]! text-[9pt]!">
      <div className="mb-[1mm] text-center text-[17pt] tracking-[0.8em]">処方箋</div>
      <div className="mb-[2mm] text-center text-[8pt]">（この処方箋は、どの保険薬局でも有効です。）</div>

      <div className="border-[1.5px] border-black">
        {/* 公費・保険者 */}
        <div className="flex border-b border-black">
          <div className="flex w-1/2 border-r border-black">
            <div className={`${th} w-[30mm]`}>公費負担者番号</div>
            <Digits value={ins?.publicPayer} n={8} />
          </div>
          <div className="flex w-1/2">
            <div className={`${th} w-[30mm]`}>保険者番号</div>
            <Digits value={ins?.payer} n={8} />
          </div>
        </div>
        <div className="flex border-b border-black">
          <div className="flex w-1/2 border-r border-black">
            <div className={`${th} w-[30mm]`}>
              公費負担医療の
              <br />
              受給者番号
            </div>
            <Digits value={ins?.publicRecipient} n={7} />
          </div>
          <div className="flex w-1/2">
            <div className={`${th} w-[30mm] border-r`}>
              被保険者証・被保険者
              <br />
              手帳の記号・番号
            </div>
            <div className="flex flex-1 items-center px-[2mm] text-[10pt]">
              {insNo}
              {ins?.branch && <span className="ml-auto text-[8.5pt]">（枝番）{ins.branch}</span>}
            </div>
          </div>
        </div>

        {/* 患者・医療機関 */}
        <div className="flex border-b border-black">
          <div className="flex w-1/2 border-r border-black">
            <div className={`${th} w-[7mm] border-r [writing-mode:vertical-rl]`}>患　者</div>
            <div className="flex-1">
              <div className="flex min-h-[11mm] border-b border-black">
                <div className={`${th} w-[17mm] border-r`}>氏名</div>
                <div className="flex flex-1 flex-col justify-center px-[2mm]">
                  <span className="text-[7pt]">{patient.kana}</span>
                  <span className="text-[13pt] tracking-wider">{patient.name}</span>
                </div>
              </div>
              <div className="flex min-h-[8mm] border-b border-black">
                <div className={`${th} w-[17mm] border-r`}>生年月日</div>
                <div className="flex flex-1 items-center gap-[2mm] px-[2mm] text-[8.5pt]">
                  <span>
                    {b.era} {b.y}年 {b.m}月 {b.d}日
                  </span>
                  <span className="ml-auto">
                    <Circle on={patient.sex === '男'}>男</Circle>・<Circle on={patient.sex === '女'}>女</Circle>
                  </span>
                </div>
              </div>
              <div className="flex min-h-[7mm]">
                <div className={`${th} w-[17mm] border-r`}>区分</div>
                <div className="flex flex-1 items-center gap-[4mm] px-[2mm] text-[8.5pt]">
                  <Circle on={ins?.relation === '本人'}>被保険者</Circle>
                  <Circle on={ins?.relation === '家族'}>被扶養者</Circle>
                </div>
              </div>
            </div>
          </div>
          <div className="w-1/2">
            <div className="flex min-h-[13mm] border-b border-black">
              <div className={`${th} w-[24mm] border-r`}>
                保険医療機関の
                <br />
                所在地及び名称
              </div>
              <div className="flex flex-1 flex-col justify-center px-[2mm] text-[8pt] leading-snug">
                <span>{CLINIC.address}</span>
                <span className="text-[10pt]">{CLINIC.name}</span>
              </div>
            </div>
            <div className="flex min-h-[6mm] border-b border-black">
              <div className={`${th} w-[24mm] border-r`}>電話番号</div>
              <div className="flex flex-1 items-center px-[2mm] text-[8.5pt]">{CLINIC.phone}</div>
            </div>
            <div className="flex min-h-[7mm]">
              <div className={`${th} w-[24mm] border-r`}>保険医氏名</div>
              <div className="flex flex-1 items-center px-[2mm] text-[11pt]">
                {CLINIC.doctor}
                <Seal />
              </div>
            </div>
          </div>
        </div>
        <div className="flex border-b border-black">
          <div className="w-1/2 border-r border-black" />
          <div className="flex w-1/2 text-[7pt]">
            <div className={`${th} w-[15mm]`}>都道府県番号</div>
            <Digits value={CLINIC.pref} n={2} w="4.6mm" />
            <div className={`${th} w-[13mm] border-l`}>点数表番号</div>
            <Digits value="1" n={1} w="4.6mm" />
            <div className={`${th} w-[16mm] border-l`}>医療機関コード</div>
            <Digits value={CLINIC.code} n={7} w="4.6mm" />
          </div>
        </div>

        {/* 交付年月日・使用期間 */}
        <div className="flex border-b border-black">
          <div className={`${th} w-[17mm] border-r`}>交付年月日</div>
          <div className="flex w-[44mm] items-center border-r border-black px-[2mm] text-[9pt]">{wareki(opts.issued)}</div>
          <div className={`${th} w-[17mm] border-r`}>
            処方箋の
            <br />
            使用期間
          </div>
          <div className="flex w-[40mm] items-center border-r border-black px-[2mm] text-[9pt]">{opts.until ? wareki(opts.until) : '令和　年　月　日'}</div>
          <div className="flex flex-1 items-center px-[2mm] text-[7pt] leading-tight">特に記載のある場合を除き、交付の日を含めて４日以内に保険薬局に提出すること。</div>
        </div>

        {/* 処方 */}
        <div className="flex border-b border-black">
          <div className={`${th} w-[7mm] border-r [writing-mode:vertical-rl]`}>処　　方</div>
          <div className="min-w-0 flex-1">
            <div className="flex border-b border-black text-[6.5pt] leading-tight">
              <div className={`${th} w-[11mm] border-r py-[0.5mm] text-[6.5pt]!`}>
                変更不可
                <br />
                （医療上
                <br />
                必要）
              </div>
              <div className={`${th} w-[11mm] border-r text-[6.5pt]!`}>患者希望</div>
              <div className="flex-1 px-[1.5mm] py-[0.8mm]">
                個々の処方薬について、医療上の必要性があるため、後発医薬品（ジェネリック医薬品）への変更に差し支えがあると判断した場合には、「変更不可」欄に「✓」又は「×」を記載し、「保険医署名」欄に署名又は記名・押印すること。また、患者の希望を踏まえ、先発医薬品を処方した場合には、「患者希望」欄に「✓」又は「×」を記載すること。
              </div>
            </div>
            <div className="relative h-[112mm]">
              {/* 変更不可・患者希望の縦の罫線 */}
              <div className="absolute inset-y-0 left-[11mm] border-l border-black" />
              <div className="absolute inset-y-0 left-[22mm] border-l border-black" />
              <div className="py-[1.5mm] text-[9.5pt] leading-[1.45]">
                {groups.map((g, gi) => (
                  <div key={g[0].id} className="mb-[1.2mm]">
                    {g.map((r, i) => (
                      <div key={r.id} className="flex">
                        <span className="w-[11mm] shrink-0 text-center">{opts.noChange[r.id] ? '✓' : ''}</span>
                        <span className="w-[11mm] shrink-0 text-center">{opts.wish[r.id] ? '✓' : ''}</span>
                        <span className="w-[11mm] shrink-0 pl-[1.5mm]">{i === 0 ? `Rp${gi + 1})` : ''}</span>
                        <span className="min-w-0 flex-1">{drugLabel(r, opts)}</span>
                        <span className="shrink-0 pr-[2mm] text-right">{amount(r)}</span>
                      </div>
                    ))}
                    <div className="flex">
                      <span className="w-[33mm] shrink-0" />
                      <span className="min-w-0 flex-1 pl-[3mm]">{usageRow(g[0])}</span>
                      <span className="shrink-0 pr-[2mm] text-right">{daysRow(g[0])}</span>
                    </div>
                  </div>
                ))}
                <div className="flex">
                  <span className="w-[33mm] shrink-0" />
                  <span className="pl-[1.5mm] text-[8.5pt]">以下余白</span>
                </div>
              </div>
              <div className="absolute right-[3mm] bottom-[2mm] text-[9pt]">
                リフィル可　{opts.refill > 0 ? '☑' : '□'}　（　{opts.refill > 0 ? opts.refill : '　'}　回）
              </div>
            </div>
          </div>
        </div>

        {/* 備考 */}
        <div className="flex border-b border-black">
          <div className={`${th} w-[7mm] border-r [writing-mode:vertical-rl]`}>備　考</div>
          <div className="flex-1 px-[2mm] py-[1.2mm] text-[8pt] leading-snug">
            <div className="flex items-center gap-[3mm]">
              <span className="shrink-0">保険医署名</span>
              <span className="inline-block w-[36mm] shrink-0 border-b border-black text-center text-[10pt]">{encounter.rx.some((r) => opts.noChange[r.id]) ? CLINIC.doctor : '　'}</span>
              <span className="text-[6.5pt]">［「変更不可」欄に「✓」又は「×」を記載した場合は、署名又は記名・押印すること。］</span>
            </div>
            {encounter.rx.some((r) => opts.wish[r.id]) && <div className="mt-[1mm]">患者の希望により長期収載品（先発医薬品）を処方（選定療養）</div>}
            <div className="mt-[1.5mm] text-[7pt]">保険薬局が調剤時に残薬を確認した場合の対応（特に指示がある場合は「✓」又は「×」を記載すること。）</div>
            <div className="mt-[0.5mm] flex gap-[6mm]">
              <span>{opts.residual === '疑義照会' ? '☑' : '□'} 保険医療機関へ疑義照会した上で調剤</span>
              <span>{opts.residual === '情報提供' ? '☑' : '□'} 保険医療機関へ情報提供</span>
            </div>
          </div>
        </div>

        {/* 調剤実施回数（リフィル） */}
        <div className="border-b border-black px-[2mm] py-[1mm] text-[7pt] leading-snug">
          調剤実施回数（調剤回数に応じて、□に「✓」又は「×」を記載するとともに、調剤日及び次回調剤予定日を記載すること。）
          <div className="mt-[0.5mm] flex flex-wrap gap-x-[5mm] text-[7.5pt]">
            <span>□1回目調剤日（　　年　月　日）</span>
            <span>□2回目調剤日（　　年　月　日）</span>
            <span>□3回目調剤日（　　年　月　日）</span>
          </div>
          <div className="flex gap-x-[5mm] text-[7.5pt]">
            <span>次回調剤予定日（　　年　月　日）</span>
            <span>次回調剤予定日（　　年　月　日）</span>
          </div>
        </div>

        {/* 薬局が書く欄 */}
        <div className="flex border-b border-black">
          <div className={`${th} w-[22mm] border-r`}>調剤済年月日</div>
          <div className="flex w-[48mm] items-center border-r border-black px-[2mm]">令和　　年　　月　　日</div>
          <div className={`${th} w-[24mm]`}>公費負担者番号</div>
          <Digits n={8} />
        </div>
        <div className="flex">
          <div className={`${th} w-[22mm] border-r`}>
            保険薬局の所在地
            <br />
            及び名称
            <br />
            保険薬剤師氏名
          </div>
          <div className="flex h-[16mm] w-[48mm] items-end justify-end border-r border-black p-[1mm]">
            <span className="text-[7pt]">印</span>
          </div>
          <div className={`${th} w-[24mm]`}>
            公費負担医療の
            <br />
            受給者番号
          </div>
          <Digits n={7} />
        </div>
      </div>
      <ol className="mt-[1.5mm] list-inside list-decimal text-[6.5pt] leading-snug">
        <li>「処方」欄には、薬名、分量、用法及び用量を記載すること。</li>
        <li>この用紙は、A列5番を標準とすること。</li>
        <li>
          療養の給付及び公費負担医療に関する費用の請求に関する命令（昭和51年厚生省令第36号）第1条の公費負担医療については、「保険医療機関」とあるのは「公費負担医療の担当医療機関」と、「保険医氏名」とあるのは「公費負担医療の担当医氏名」と読み替えるものとすること。
        </li>
      </ol>
    </Paper>
  )
}

function Circle({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-[1mm] ${on ? 'outline outline-1 outline-black' : ''}`}>{children}</span>
}
function Seal() {
  return <span className="ml-auto inline-flex h-[7mm] w-[7mm] items-center justify-center rounded-full border border-[#c33] text-[6pt] text-[#c33]">印</span>
}

// ---- 処方箋のウインドウ（左：設定、右：印刷イメージ） ----

export function PrescriptionWindow({ patient, encounter, onClose }: { patient: Patient; encounter: Encounter; onClose: () => void }) {
  const [opts, setOpts] = useState(() => loadSheet(encounter))
  const [pane, setPane] = useState<'form' | 'paper'>('form')
  const set = (patch: Partial<SheetOpts>) => setOpts((cur) => ({ ...cur, ...patch }))
  const flip = (k: 'generic' | 'noChange' | 'wish', id: string) => setOpts((cur) => ({ ...cur, [k]: { ...cur[k], [id]: !cur[k][id] } }))
  useEffect(() => saveSheet(encounter.id, opts), [encounter.id, opts])

  useEffect(() => {
    // Esc で閉じる。⌘P はブラウザの印刷のまま使う（カルテの処方ウインドウを開かない）
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const groups = groupRp(encounter.rx)
  const toggle = (on: boolean, label: string, onClick: () => void, title: string) => (
    <button type="button" onClick={onClick} title={title} className={`chip h-6 px-2 text-[11px] ${on ? 'chip-on' : ''}`}>
      {on ? '✓ ' : ''}
      {label}
    </button>
  )

  // 経過の枠（ドラッグでDo・ダブルクリックで訂正）にイベントが伝わらないよう body に出し、伝わる分も止める
  return createPortal(
    <div
      className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 max-md:p-0"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onDragStart={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div role="dialog" aria-modal="true" aria-label="院外処方箋" className="flex h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-2xl max-md:h-full max-md:rounded-none">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-ivory px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-rx-ctr text-rx">
            <Icon name="prescriptions" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">院外処方箋</h2>
            <p className="truncate text-[11px] text-mist">
              {patient.name} ・ {encounter.date.replace(/-/g, '/')} の処方 {encounter.rx.length}剤 ・ 設定はこの端末に保存されます
            </p>
          </div>
          <div className="flex rounded-md border border-line bg-cream p-0.5 text-xs md:hidden">
            {(['form', 'paper'] as const).map((k) => (
              <button key={k} onClick={() => setPane(k)} className={`rounded px-2.5 py-1 ${pane === k ? 'bg-ivory font-medium shadow-soft' : 'text-mist'}`}>
                {k === 'form' ? '設定' : '印刷イメージ'}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="btn btn-sm btn-filled">
            <Icon name="print" size={18} />
            印刷
          </button>
          <button onClick={onClose} title="閉じる（Esc）" className="icon-btn icon-btn-sm">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className={`min-h-0 space-y-5 overflow-y-auto bg-ivory px-5 py-4 text-sm md:w-[42%] md:shrink-0 md:border-r md:border-line max-md:flex-1 ${pane === 'form' ? '' : 'max-md:hidden'}`}>
            <section className="space-y-2">
              <h3 className="border-b border-line pb-1 text-[13px] font-semibold">日付</h3>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-mist">交付年月日</span>
                  <input type="date" value={opts.issued} onChange={(e) => set({ issued: e.target.value })} className="field h-8 w-40 px-2" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-mist">使用期間（空なら交付日を含めて4日以内）</span>
                  <span className="flex items-center gap-1.5">
                    <input type="date" value={opts.until} min={opts.issued} onChange={(e) => set({ until: e.target.value })} className="field h-8 w-40 px-2" />
                    {opts.until && (
                      <button onClick={() => set({ until: '' })} className="btn btn-sm btn-text">
                        消す
                      </button>
                    )}
                  </span>
                </label>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex flex-wrap items-baseline gap-x-2 border-b border-line pb-1 text-[13px] font-semibold">
                処方
                <span className="text-[11px] font-normal text-mist">薬ごとに 一般名で書く・後発品への変更不可・患者希望（先発品）</span>
              </h3>
              {groups.map((g, gi) => (
                <div key={g[0].id} className="rounded-lg border border-line bg-white px-3 py-2">
                  <div className="mb-1 flex items-baseline gap-2 text-[11px] text-mist">
                    <span className="font-medium text-ink">Rp{gi + 1}</span>
                    {usageRow(g[0])}
                    <span className="ml-auto font-num">{daysRow(g[0])}</span>
                  </div>
                  {g.map((r) => (
                    <div key={r.id} className="border-t border-line py-1.5 first:border-t-0">
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{drugLabel(r, opts)}</span>
                        <span className="shrink-0 font-num text-xs text-mist">{amount(r)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {toggle(!!opts.generic[r.id], '一般名', () => flip('generic', r.id), '【般】一般名で書く（一般名処方加算の対象）')}
                        {toggle(!!opts.noChange[r.id], '変更不可', () => flip('noChange', r.id), '医療上の必要で後発品への変更不可（保険医署名が入ります）')}
                        {toggle(!!opts.wish[r.id], '患者希望', () => flip('wish', r.id), '患者が先発品（長期収載品）を希望。選定療養の対象')}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {encounter.rx.some((r) => opts.wish[r.id]) && (
                <p className="flex gap-1.5 rounded-md bg-gold-soft px-3 py-2 text-xs">
                  <Icon name="info" size={16} className="shrink-0" />
                  患者希望の先発品（長期収載品）は選定療養の対象です。後発品との差額の一部が保険外の負担になることを伝えてください。
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="border-b border-line pb-1 text-[13px] font-semibold">薬局が残薬を確認したときの対応</h3>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ['', '指示なし'],
                    ['疑義照会', '疑義照会した上で調剤'],
                    ['情報提供', '情報提供'],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} onClick={() => set({ residual: v })} className={`chip ${opts.residual === v ? 'chip-on' : ''}`}>
                    {l}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex flex-wrap items-baseline gap-x-2 border-b border-line pb-1 text-[13px] font-semibold">
                リフィル
                <span className="text-[11px] font-normal text-mist">症状が安定した定期処方を受診なしで繰り返し使う（総使用回数3回まで）</span>
              </h3>
              <div className="flex flex-wrap gap-1">
                {[0, 2, 3].map((n) => (
                  <button key={n} onClick={() => set({ refill: n })} className={`chip ${opts.refill === n ? 'chip-on' : ''}`}>
                    {n === 0 ? 'リフィルにしない' : `リフィル可 ${n}回`}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className={`min-h-0 min-w-0 flex-1 ${pane === 'paper' ? '' : 'max-md:hidden'}`}>
            <PrintPreview>
              <PrescriptionSheet patient={patient} encounter={encounter} opts={opts} />
            </PrintPreview>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// 経過の「オーダー」の右上（compact）と会計に置くボタン。押すと処方箋のウインドウ
export function PrescriptionButton({ patient, encounter, compact }: { patient: Patient; encounter: Encounter; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  if (encounter.rx.length === 0) return null
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title="院外処方箋を表示・印刷"
        className={compact ? 'flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-clinical hover:bg-gold-soft' : 'btn btn-outlined'}
      >
        <Icon name="print" size={compact ? 14 : 18} />
        {compact ? '処方箋' : '処方箋を印刷'}
      </button>
      {open && <PrescriptionWindow patient={patient} encounter={encounter} onClose={() => setOpen(false)} />}
    </>
  )
}
