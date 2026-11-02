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

export const initialLabs = (): Record<string, LabReport[]> => ({})
