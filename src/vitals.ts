import type { Vitals } from './types'

// 記載欄の自由文からバイタルを読み取る。「家庭血圧」は診察室血圧として扱わない。
const num = (re: RegExp, text: string) => {
  const m = text.match(re)
  return m ? Number(m[1]) : undefined
}

export function parseVitals(text: string): Vitals {
  const t = text.normalize('NFKC')
  const bp = t.match(/(?<!家庭)(?:BP|血圧)\s*[:：]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i)
  const v: Vitals = {
    sbp: bp ? Number(bp[1]) : undefined,
    dbp: bp ? Number(bp[2]) : undefined,
    hr: num(/(?:HR|P|脈拍|脈)\s*[:：]?\s*(\d{2,3})(?![\d./])/i, t),
    bt: num(/(?:BT|KT|体温)\s*[:：]?\s*(\d{2}(?:\.\d)?)/i, t),
    spo2: num(/(?:SpO2|SAT)\s*[:：]?\s*(\d{2,3})/i, t),
    bw: num(/(?:BW|体重)\s*[:：]?\s*(\d{2,3}(?:\.\d+)?)/i, t),
  }
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Vitals
}
