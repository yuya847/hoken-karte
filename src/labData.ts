import type { TestGroup } from './data'
import type { LabReport } from './types'

// 外注検査の結果の項目（基準値は日本の共用基準範囲などを目安にした試作用の値）。
// コードは血液検査のオーダー（data.ts の TESTS）と同じ。尿一般だけは結果が尿蛋白・尿糖・尿潜血に分かれる。
// 結果の中身（initialLabs・取り込み待ちの結果）は検査結果の担当が作る
export type LabItem = { code: string; name: string; unit: string; low?: number; high?: number; group: TestGroup; qualitative?: boolean }

export const LAB_ITEMS: LabItem[] = [
  { code: 'WBC', name: '白血球数', unit: '/μL', low: 3300, high: 8600, group: '血算・凝固' },
  { code: 'RBC', name: '赤血球数', unit: '万/μL', low: 386, high: 492, group: '血算・凝固' },
  { code: 'Hb', name: 'ヘモグロビン', unit: 'g/dL', low: 11.6, high: 16.8, group: '血算・凝固' },
  { code: 'Ht', name: 'ヘマトクリット', unit: '%', low: 35.1, high: 48.9, group: '血算・凝固' },
  { code: 'PLT', name: '血小板数', unit: '万/μL', low: 15.8, high: 34.8, group: '血算・凝固' },
  { code: 'PTINR', name: 'PT-INR', unit: '', low: 0.9, high: 1.1, group: '血算・凝固' },
  { code: 'DDIMER', name: 'D-ダイマー', unit: 'μg/mL', high: 1.0, group: '血算・凝固' },
  { code: 'AST', name: 'AST', unit: 'U/L', low: 13, high: 30, group: '肝・胆' },
  { code: 'ALT', name: 'ALT', unit: 'U/L', low: 7, high: 30, group: '肝・胆' },
  { code: 'GGT', name: 'γ-GT', unit: 'U/L', low: 9, high: 64, group: '肝・胆' },
  { code: 'ALP', name: 'ALP', unit: 'U/L', low: 38, high: 113, group: '肝・胆' },
  { code: 'LDH', name: 'LD', unit: 'U/L', low: 124, high: 222, group: '肝・胆' },
  { code: 'TP', name: '総蛋白', unit: 'g/dL', low: 6.6, high: 8.1, group: '肝・胆' },
  { code: 'ALB', name: 'アルブミン', unit: 'g/dL', low: 4.1, high: 5.1, group: '肝・胆' },
  { code: 'TBIL', name: '総ビリルビン', unit: 'mg/dL', low: 0.4, high: 1.5, group: '肝・胆' },
  { code: 'BUN', name: '尿素窒素', unit: 'mg/dL', low: 8, high: 20, group: '腎・電解質' },
  { code: 'CRE', name: 'クレアチニン', unit: 'mg/dL', low: 0.46, high: 1.07, group: '腎・電解質' },
  { code: 'EGFR', name: 'eGFR', unit: 'mL/分/1.73㎡', low: 60, group: '腎・電解質' },
  { code: 'UA', name: '尿酸', unit: 'mg/dL', low: 2.6, high: 7.0, group: '腎・電解質' },
  { code: 'NA', name: 'Na', unit: 'mmol/L', low: 138, high: 145, group: '腎・電解質' },
  { code: 'K', name: 'K', unit: 'mmol/L', low: 3.6, high: 4.8, group: '腎・電解質' },
  { code: 'CL', name: 'Cl', unit: 'mmol/L', low: 101, high: 108, group: '腎・電解質' },
  { code: 'TC', name: '総コレステロール', unit: 'mg/dL', low: 142, high: 248, group: '脂質' },
  { code: 'TG', name: '中性脂肪', unit: 'mg/dL', low: 40, high: 149, group: '脂質' },
  { code: 'HDL', name: 'HDLコレステロール', unit: 'mg/dL', low: 40, high: 90, group: '脂質' },
  { code: 'LDL', name: 'LDLコレステロール', unit: 'mg/dL', low: 65, high: 139, group: '脂質' },
  { code: 'GLU', name: '血糖', unit: 'mg/dL', low: 73, high: 109, group: '糖' },
  { code: 'HBA1C', name: 'HbA1c', unit: '%', low: 4.9, high: 6.0, group: '糖' },
  { code: 'CRP', name: 'CRP', unit: 'mg/dL', high: 0.14, group: '炎症・心' },
  { code: 'CK', name: 'CK', unit: 'U/L', low: 59, high: 248, group: '炎症・心' },
  { code: 'BNP', name: 'BNP', unit: 'pg/mL', high: 18.4, group: '炎症・心' },
  { code: 'TSH', name: 'TSH', unit: 'μIU/mL', low: 0.5, high: 5.0, group: '甲状腺' },
  { code: 'FT4', name: 'FT4', unit: 'ng/dL', low: 0.9, high: 1.7, group: '甲状腺' },
  { code: 'HBSAG', name: 'HBs抗原', unit: '', group: '感染症', qualitative: true },
  { code: 'HCVAB', name: 'HCV抗体', unit: '', group: '感染症', qualitative: true },
  { code: 'FLU', name: 'インフルエンザ抗原', unit: '', group: '感染症', qualitative: true },
  { code: 'COVID', name: 'SARS-CoV-2抗原', unit: '', group: '感染症', qualitative: true },
  { code: 'PSA', name: 'PSA', unit: 'ng/mL', high: 4.0, group: '腫瘍マーカー' },
  { code: 'CEA', name: 'CEA', unit: 'ng/mL', high: 5.0, group: '腫瘍マーカー' },
  { code: 'UPRO', name: '尿蛋白', unit: '', group: '尿・便', qualitative: true },
  { code: 'UGLU', name: '尿糖', unit: '', group: '尿・便', qualitative: true },
  { code: 'UOB', name: '尿潜血', unit: '', group: '尿・便', qualitative: true },
  { code: 'UACR', name: '尿中アルブミン/Cr比', unit: 'mg/gCr', high: 30, group: '尿・便' },
  { code: 'FOBT', name: '便潜血', unit: '', group: '尿・便', qualitative: true },
]

export const labItem = (code: string) => LAB_ITEMS.find((x) => x.code === code)

// 基準値から H・L を付ける。定性（尿蛋白など）は「+」以上を H、「±」は付けない
const POSITIVE = /^(\d?\+|陽性)$/
export const flagOf = (code: string, value: number | string): 'H' | 'L' | undefined => {
  const it = labItem(code)
  if (!it) return undefined
  if (typeof value === 'string') return POSITIVE.test(value.trim()) ? 'H' : undefined
  if (it.high !== undefined && value > it.high) return 'H'
  if (it.low !== undefined && value < it.low) return 'L'
  return undefined
}

// 基準値の表示（例 4.9–6.0、≦0.14、≧60）
export const rangeText = (code: string) => {
  const it = labItem(code)
  if (!it || it.qualitative) return it?.qualitative ? '（−）' : ''
  if (it.low !== undefined && it.high !== undefined) return `${it.low}–${it.high}`
  if (it.high !== undefined) return `≦${it.high}`
  if (it.low !== undefined) return `≧${it.low}`
  return ''
}

// 今日から n 日前（data.ts の受診日と同じく、日曜なら前の土曜）
const ago = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  while (d.getDay() === 0) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SOURCE = '架空検査センター'

// 1回分の結果。採取は受診日（n 日前）、報告はその2日後
const report = (id: string, n: number, values: Record<string, number | string>, reviewed = true): LabReport => ({
  id,
  date: ago(n),
  reportedAt: ago(Math.max(0, n - 2)),
  source: SOURCE,
  reviewed,
  values: Object.entries(values).map(([code, value]) => ({ code, value, flag: flagOf(code, value) })),
})

const CBC = (wbc: number, rbc: number, hb: number, ht: number, plt: number) => ({ WBC: wbc, RBC: rbc, Hb: hb, Ht: ht, PLT: plt })

// 架空の結果の履歴（受診日は data.ts の enc(n) と同じ日数）。直近の山田・田中は未確認のまま（受信箱に出る）
export const initialLabs = (): Record<string, LabReport[]> => ({
  p1: [
    report('lab-p1-180', 180, { HBA1C: 7.6, GLU: 148, TC: 236, TG: 196, HDL: 41, LDL: 160, AST: 29, ALT: 37, GGT: 58, CRE: 0.9, EGFR: 64, UA: 6.6 }),
    report('lab-p1-87', 87, {
      ...CBC(6200, 468, 14.8, 44.1, 22.1),
      HBA1C: 7.4,
      GLU: 142,
      TC: 228,
      TG: 188,
      HDL: 42,
      LDL: 152,
      AST: 28,
      ALT: 35,
      GGT: 52,
      CRE: 0.92,
      EGFR: 63,
      UA: 6.8,
      NA: 140,
      K: 4.2,
      CL: 104,
      UPRO: '−',
      UGLU: '±',
      UOB: '−',
    }),
    report('lab-p1-59', 59, { HBA1C: 7.2, GLU: 131, TG: 162, HDL: 44, LDL: 138, AST: 26, ALT: 31, CRE: 0.95, EGFR: 61, UA: 6.9, K: 4.3 }),
    report(
      'lab-p1-31',
      31,
      { HBA1C: 6.9, GLU: 124, TC: 190, TG: 145, HDL: 46, LDL: 118, AST: 24, ALT: 28, GGT: 45, CRE: 0.98, EGFR: 59, UA: 7.2, NA: 141, K: 4.6, CL: 103, UPRO: '±', UGLU: '−', UOB: '−', UACR: 42 },
      false,
    ),
  ],
  p2: [report('lab-p2-45', 45, { ...CBC(5400, 372, 11.2, 34.6, 26.0), AST: 18, ALT: 14, TP: 7.0, ALB: 4.3, CRE: 0.61, CRP: 0.05 })],
  p4: [report('lab-p4-33', 33, { TC: 212, TG: 98, HDL: 62, LDL: 128, AST: 21, ALT: 19, GGT: 22, CRE: 0.68, EGFR: 69, NA: 140, K: 4.1, GLU: 98, HBA1C: 5.7 })],
  p5: [
    report('lab-p5-180', 180, { HBA1C: 7.9, GLU: 162, CRE: 0.93, EGFR: 61, UA: 7.4 }),
    report('lab-p5-96', 96, { ...CBC(5800, 421, 13.6, 40.8, 19.4), HBA1C: 7.8, GLU: 156, AST: 22, ALT: 18, CRE: 0.96, EGFR: 59, UA: 7.6, K: 4.6, UPRO: '−', UGLU: '+', UOB: '−' }),
    report('lab-p5-39', 39, { HBA1C: 7.5, GLU: 148, CRE: 1.02, EGFR: 55, UA: 7.3, NA: 139, K: 4.9, UPRO: '±', UGLU: '+', UACR: 68 }, false),
  ],
})

// 検査会社から届いた、まだ取り込んでいない結果（架空）。患者は氏名・カナ・生年月日で照合する
export type IncomingLab = { id: string; name: string; kana: string; birth: string; sex: '男' | '女'; report: LabReport }

export const incomingLabs = (): IncomingLab[] => {
  const r = (id: string, values: Record<string, number | string>) => ({ ...report(id, 2, values, false), reportedAt: ago(0) })
  return [
    { id: 'in-1', name: '佐藤 花子', kana: 'サトウ ハナコ', birth: '1980-09-30', sex: '女', report: r('lab-in-1', { ...CBC(5100, 365, 10.9, 33.8, 27.2), AST: 17, ALT: 13, CRP: 0.04 }) },
    { id: 'in-2', name: '高橋 美咲', kana: 'タカハシ ミサキ', birth: '1971-06-05', sex: '女', report: r('lab-in-2', { TSH: 6.8, FT4: 0.95, TC: 220, LDL: 136, HDL: 60, TG: 112 }) },
    // 漢字が1字違う（候補）。生年月日とカナは登録と同じ
    { id: 'in-3', name: '鈴木 一朗', kana: 'スズキ イチロウ', birth: '1994-01-18', sex: '男', report: r('lab-in-3', { ...CBC(9800, 502, 15.9, 47.2, 24.8), CRP: 2.31, AST: 32, ALT: 41 }) },
    // 登録のない人（不一致）
    { id: 'in-4', name: '中村 恵子', kana: 'ナカムラ ケイコ', birth: '1962-03-02', sex: '女', report: r('lab-in-4', { HBA1C: 6.4, GLU: 118, LDL: 152, TG: 160, HDL: 52 }) },
  ]
}
