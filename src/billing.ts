import { TESTS, kindOfTest } from './data'
import { parseUsage } from './rxFormat'
import type { Encounter, Patient } from './types'

// 会計の点数の「仮」計算（UI用）。正式な算定はレセコン（Phase 3）で診療行為マスタと算定ルールから行う。
// 点数は2024年度改定の点数表を目安にした試作用の値で、2026年度改定は未確認。包括・併算定の細かい規則は入れていない。

// 領収証（外来）の保険点数の区分
export const BILL_CATS = ['初・再診料', '医学管理等', '在宅医療', '検査', '画像診断', '投薬', '注射', 'リハビリテーション', '精神科専門療法', '処置', '手術', '麻酔', '放射線治療', '病理診断'] as const
export type BillCat = (typeof BILL_CATS)[number]

export type BillLine = { cat: BillCat; name: string; points: number; count: number; note?: string }
export type Bill = {
  lines: BillLine[]
  byCat: Record<BillCat, number>
  total: number // 合計点数
  burden: number // 負担割合
  charge: number // 窓口負担（円・10円未満四捨五入）
  warnings: string[] // 算定に必要な書類が無い など
}

// 一般名処方の範囲（処方箋の設定から）。all＝すべて一般名、some＝一部
export type GenericLevel = 'all' | 'some' | 'none'

// ---- 医学管理等（仮）----
// 生活習慣病管理料（Ⅱ）の対象（2024年6月から特定疾患療養管理料の対象外になった3疾患）
const LIFESTYLE = /^(高血圧症|脂質異常症|2型糖尿病)$/
// 特定疾患療養管理料の対象（試作で使う病名だけ）
const SPECIFIC = /^(気管支喘息|慢性胃炎|心不全|不整脈|心房細動|狭心症|甲状腺機能低下症|慢性閉塞性肺疾患)$/

// ---- 検体検査（仮）----
type Judge = '尿・糞便等' | '血液学的' | '生化学的(Ⅰ)' | '生化学的(Ⅱ)' | '免疫学的'
const JUDGE: Record<Judge, { name: string; points: number }> = {
  '尿・糞便等': { name: '尿・糞便等検査判断料', points: 34 },
  血液学的: { name: '血液学的検査判断料', points: 125 },
  '生化学的(Ⅰ)': { name: '生化学的検査（Ⅰ）判断料', points: 144 },
  '生化学的(Ⅱ)': { name: '生化学的検査（Ⅱ）判断料', points: 144 },
  免疫学的: { name: '免疫学的検査判断料', points: 144 },
}

// 個別の実施料。chem1 は生化学的検査（Ⅰ）の項目で、5項目以上はまとめた点数になる。
// key をそろえた項目は1つとして数える（血算5項目＝末梢血液一般、Na・Cl＝1項目）。eGFR は計算値なので点数なし
const LAB_FEES: Record<string, { points: number; judge: Judge; chem1?: boolean; key?: string; label?: string }> = {
  WBC: { points: 21, judge: '血液学的', key: 'CBC', label: '末梢血液一般検査' },
  RBC: { points: 21, judge: '血液学的', key: 'CBC', label: '末梢血液一般検査' },
  Hb: { points: 21, judge: '血液学的', key: 'CBC', label: '末梢血液一般検査' },
  Ht: { points: 21, judge: '血液学的', key: 'CBC', label: '末梢血液一般検査' },
  PLT: { points: 21, judge: '血液学的', key: 'CBC', label: '末梢血液一般検査' },
  DIFF: { points: 15, judge: '血液学的' },
  PTINR: { points: 18, judge: '血液学的', label: 'プロトロンビン時間（PT）' },
  DDIMER: { points: 127, judge: '血液学的' },
  HBA1C: { points: 49, judge: '血液学的' },
  AST: { points: 17, judge: '生化学的(Ⅰ)', chem1: true },
  ALT: { points: 17, judge: '生化学的(Ⅰ)', chem1: true },
  GGT: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  ALP: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  LDH: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  TP: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  ALB: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  TBIL: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  BUN: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  CRE: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  EGFR: { points: 0, judge: '生化学的(Ⅰ)', label: 'eGFR（計算値）' },
  UA: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  NA: { points: 11, judge: '生化学的(Ⅰ)', chem1: true, key: 'NACL', label: 'ナトリウム及びクロール' },
  CL: { points: 11, judge: '生化学的(Ⅰ)', chem1: true, key: 'NACL', label: 'ナトリウム及びクロール' },
  K: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  TC: { points: 17, judge: '生化学的(Ⅰ)', chem1: true },
  TG: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  HDL: { points: 17, judge: '生化学的(Ⅰ)', chem1: true },
  LDL: { points: 18, judge: '生化学的(Ⅰ)', chem1: true },
  GLU: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  CK: { points: 11, judge: '生化学的(Ⅰ)', chem1: true },
  CRP: { points: 16, judge: '免疫学的' },
  BNP: { points: 130, judge: '生化学的(Ⅱ)' },
  TSH: { points: 98, judge: '生化学的(Ⅱ)' },
  FT4: { points: 121, judge: '生化学的(Ⅱ)' },
  PSA: { points: 121, judge: '生化学的(Ⅱ)' },
  CEA: { points: 99, judge: '生化学的(Ⅱ)' },
  HBSAG: { points: 29, judge: '免疫学的' },
  HCVAB: { points: 102, judge: '免疫学的' },
  FLU: { points: 132, judge: '免疫学的' },
  COVID: { points: 150, judge: '免疫学的' },
  UGEN: { points: 26, judge: '尿・糞便等' },
  USED: { points: 27, judge: '尿・糞便等' },
  UACR: { points: 99, judge: '尿・糞便等' },
  FOBT: { points: 37, judge: '尿・糞便等' },
}
// 生化学的検査（Ⅰ）の包括（5〜7項目・8〜9項目・10項目以上）
const chem1Bundle = (n: number) => (n >= 10 ? 103 : n >= 8 ? 99 : 93)

// ---- 生理検査・画像・点滴（仮）----
const OTHER_FEES: Record<string, { cat: BillCat; points: number; note?: string }> = {
  t06: { cat: '検査', points: 130 },
  t27: { cat: '検査', points: 100, note: '血管伸展性検査' },
  t28: { cat: '検査', points: 230, note: '肺気量分画・フローボリューム' },
  t29: { cat: '検査', points: 530 },
  t36: { cat: '検査', points: 720 },
  // 単純撮影：撮影＋診断＋電子画像管理加算
  t07: { cat: '画像診断', points: 210, note: '撮影・診断・電子画像管理加算' },
  t30: { cat: '画像診断', points: 210, note: '撮影・診断・電子画像管理加算' },
  t37: { cat: '画像診断', points: 287, note: '2方向' },
  t38: { cat: '画像診断', points: 287, note: '2方向' },
  // 点滴：手技料＋薬剤料（薬剤料は薬価からの仮の値）
  i01: { cat: '注射', points: 102 + 24, note: '点滴注射（500mL以上）＋薬剤' },
  i02: { cat: '注射', points: 102 + 18, note: '点滴注射（500mL以上）＋薬剤' },
  i03: { cat: '注射', points: 102 + 20, note: '点滴注射（500mL以上）＋薬剤' },
  i04: { cat: '注射', points: 53 + 16, note: '点滴注射＋薬剤' },
  i05: { cat: '注射', points: 102 + 21, note: '点滴注射（500mL以上）＋薬剤' },
}

// 10円未満四捨五入
export const roundYen = (yen: number) => Math.round(yen / 10) * 10

export function calcBill(p: Patient, e: Encounter, opt: { generic: GenericLevel } = { generic: 'none' }): Bill {
  const lines: BillLine[] = []
  const warnings: string[] = []
  const add = (cat: BillCat, name: string, points: number, note?: string) => lines.push({ cat, name, points, count: 1, note })
  const first = e.kind === '初診'
  const dx = p.diseases.filter((d) => d.status === '継続' && !d.suspected).map((d) => d.name)
  const codes = e.tests.map((t) => t.code)
  const rxDays = Math.max(0, ...e.rx.filter((r) => r.form !== 'external' && parseUsage(r.usage).times !== null).map((r) => r.days))

  // 医学管理等：生活習慣病管理料（Ⅱ）か特定疾患療養管理料のどちらか（初診の日は算定しない）
  const lifestyle = !first && dx.some((n) => LIFESTYLE.test(n))
  const specific = !first && !lifestyle && dx.some((n) => SPECIFIC.test(n))

  // 初・再診料
  if (first) add('初・再診料', '初診料', 291)
  else {
    add('初・再診料', '再診料', 75)
    // 外来管理加算：生活習慣病管理料・超音波検査の日は算定しない（仮）
    if (!lifestyle && !codes.includes('t29')) add('初・再診料', '外来管理加算', 52)
    add('初・再診料', '明細書発行体制等加算', 1)
  }

  if (lifestyle) {
    add('医学管理等', '生活習慣病管理料（Ⅱ）', 333, dx.filter((n) => LIFESTYLE.test(n)).join('・'))
    if (!p.docs?.some((d) => d.kind === 'plan')) warnings.push('生活習慣病管理料には療養計画書の交付が必要です（文書 > 療養計画書）')
  }
  if (specific) add('医学管理等', '特定疾患療養管理料（診療所）', 225, dx.filter((n) => SPECIFIC.test(n)).join('・'))

  // 投薬（院外処方）：処方箋料＋加算
  if (e.rx.length > 0) {
    add('投薬', '処方箋料', 60)
    if (specific && rxDays >= 28) add('投薬', '特定疾患処方管理加算', 56, '28日以上の処方')
    if (opt.generic === 'all') add('投薬', '一般名処方加算1', 10)
    else if (opt.generic === 'some') add('投薬', '一般名処方加算2', 8)
  }

  // 検体検査：実施料（生化学Ⅰは包括）＋判断料（区分ごとに月1回）＋採血料
  const seen = new Set<string>()
  const chem1: { name: string; points: number }[] = []
  const judges = new Set<Judge>()
  for (const c of codes) {
    const f = LAB_FEES[c]
    if (!f) continue
    judges.add(f.judge)
    const k = f.key ?? c
    if (seen.has(k)) continue
    seen.add(k)
    const name = f.label ?? TESTS.find((t) => t.code === c)?.name ?? c
    if (f.chem1) chem1.push({ name, points: f.points })
    else if (f.points > 0) add('検査', name, f.points)
  }
  if (chem1.length >= 5) add('検査', `生化学的検査（Ⅰ）${chem1.length}項目`, chem1Bundle(chem1.length), chem1.map((x) => x.name).join('・'))
  else chem1.forEach((x) => add('検査', x.name, x.points))
  for (const j of judges) add('検査', JUDGE[j].name, JUDGE[j].points)
  if (codes.some((c) => LAB_FEES[c] && LAB_FEES[c].judge !== '尿・糞便等')) add('検査', '静脈採血料', 40)

  // 生理検査・画像・点滴。CT・MRI は外部へ依頼するので当院では算定しない
  for (const t of e.tests) {
    const f = OTHER_FEES[t.code]
    if (f) add(f.cat, t.name, f.points, f.note)
    else if (kindOfTest(t.code) === 'ct' || kindOfTest(t.code) === 'mri') lines.push({ cat: '画像診断', name: t.name, points: 0, count: 1, note: '外部へ依頼（当院では算定なし）' })
  }

  const byCat = Object.fromEntries(BILL_CATS.map((c) => [c, 0])) as Record<BillCat, number>
  for (const l of lines) byCat[l.cat] += l.points * l.count
  const total = lines.reduce((s, l) => s + l.points * l.count, 0)
  return { lines, byCat, total, burden: p.burden, charge: roundYen(total * 10 * p.burden), warnings }
}

export const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`
