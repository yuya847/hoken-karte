import type { RxItem } from './types'

// 処方の表記（富士通カルテの院外処方に合わせる）
//   Rp1  ロキソプロフェン錠60mg            1回1錠（1日3錠）
//        1日3回 毎食後                      5日分
// データは従来どおり dose＝1日量、usage＝「1日3回毎食後」の文字列で持ち、1回量は 1日量÷回数 で出す。
// 頓用（回数のない用法）は dose＝1回量、days＝回数。

export const TIMINGS: Record<number, string[]> = {
  1: ['朝食後', '夕食後', '就寝前', '昼食後', '起床時'],
  2: ['朝夕食後', '朝食後・就寝前'],
  3: ['毎食後', '毎食前', '毎食直前'],
  4: ['毎食後・就寝前'],
}
export const PRN_TIMINGS = ['発熱・疼痛時', '不眠時', '便秘時', '嘔気時']
// 外用薬の使い方と部位の候補
export const EXT_TIMINGS = ['貼付', '塗布']
export const SITES = ['前胸部', '背部', '腰部', '両膝', '肩', '両下腿', '患部', '全身']

type Ext = Pick<RxItem, 'form' | 'perUse' | 'site'>
export const isExternal = (r: Ext) => r.form === 'external'
export const TIMES = [1, 2, 3, 4] as const

export type Usage = { times: number | null; timing: string } // times が null なら頓用

export const parseUsage = (usage: string): Usage => {
  const m = usage.match(/^1日(\d)回\s*(.*)$/)
  return m ? { times: Number(m[1]), timing: m[2] } : { times: null, timing: usage }
}

export const usageOf = (u: Usage) => (u.times ? `1日${u.times}回${u.timing}` : u.timing)

const num = (n: number) => String(Math.round(n * 100) / 100)

export const perDose = (r: Pick<RxItem, 'dose' | 'usage'> & Ext) => {
  if (isExternal(r)) return r.perUse ?? 1
  const { times } = parseUsage(r.usage)
  return times ? r.dose / times : r.dose
}

// 1回1錠（1日3錠）／頓用は 1回2錠／外用は総量 7枚
export const doseText = (r: Pick<RxItem, 'dose' | 'usage' | 'unit'> & Ext) => {
  if (isExternal(r)) return `${num(r.dose)}${r.unit}`
  const { times } = parseUsage(r.usage)
  return times ? `1回${num(r.dose / times)}${r.unit}（1日${num(r.dose)}${r.unit}）` : `1回${num(r.dose)}${r.unit}`
}

// 1日3回 毎食後／発熱・疼痛時
export const usageText = (usage: string) => {
  const u = parseUsage(usage)
  return u.times ? `1日${u.times}回 ${u.timing}` : u.timing
}

// 外用は日数を書かない（総量で出す）
export const daysText = (r: Pick<RxItem, 'days' | 'usage'> & Ext) => (isExternal(r) ? '' : `${r.days}${parseUsage(r.usage).times ? '日分' : '回分'}`)

// 用法の行：内服は 1日3回 毎食後、外用は 1日1回 貼付（1回1枚）
export const usageLine = (r: Pick<RxItem, 'usage' | 'unit'> & Ext) => (isExternal(r) ? `${usageText(r.usage)}（1回${num(r.perUse ?? 1)}${r.unit}）` : usageText(r.usage))

// 1行にまとめた表記（経過・紹介状・検索候補用）：ロキソプロフェン錠60mg 1回1錠 1日3回 毎食後 5日分
export const rxLine = (r: Pick<RxItem, 'name' | 'dose' | 'usage' | 'unit' | 'days'> & Ext) => {
  if (isExternal(r)) return `${r.name} ${num(r.dose)}${r.unit} ${usageLine(r)}${r.site ? ` ${r.site}` : ''}`
  const u = parseUsage(r.usage)
  return `${r.name} 1回${num(perDose(r))}${r.unit} ${usageText(r.usage)} ${r.days}${u.times ? '日分' : '回分'}`
}

// 用法と日数が同じ薬を1つのRpにまとめる（並びは入れた順）。外用薬は1剤ずつ別のRp
export const groupRp = <T extends Pick<RxItem, 'usage' | 'days'> & Ext>(items: T[]): T[][] => {
  const groups: T[][] = []
  for (const r of items) {
    const g = isExternal(r) ? undefined : groups.find((x) => !isExternal(x[0]) && x[0].usage === r.usage && x[0].days === r.days)
    if (g) g.push(r)
    else groups.push([r])
  }
  return groups
}
