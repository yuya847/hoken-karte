import { age } from './data'
import type { Patient } from './types'

// 性別×年齢帯の患者アイコン（scripts/gen-icons.mjs pt で生成）
const generated = import.meta.glob<string>('./assets/icons/pt-*.png', { eager: true, import: 'default' })

const band = (a: number) => (a < 7 ? 'infant' : a < 16 ? 'child' : a < 40 ? 'young' : a < 65 ? 'middle' : 'senior')

export const sexLabel = (p: Patient) => (p.sex === '男' ? '男性' : '女性')
export const ageSex = (p: Patient) => `${age(p.birth)}歳 ${sexLabel(p)}`

const ERAS: [string, string, number][] = [
  ['2019-05-01', '令和', 2019],
  ['1989-01-08', '平成', 1989],
  ['1926-12-25', '昭和', 1926],
  ['1912-07-30', '大正', 1912],
]

// 1970-03-12 → 1970年3月12日（昭和45年）
export const birthLabel = (birth: string) => {
  const [y, m, d] = birth.split('-').map(Number)
  const era = ERAS.find(([start]) => birth >= start)
  const wareki = era ? `${era[1]}${y - era[2] + 1 === 1 ? '元' : y - era[2] + 1}年` : ''
  return `${y}年${m}月${d}日${wareki ? `（${wareki}）` : ''}`
}

export function PatientIcon({ patient, size = 32 }: { patient: Patient; size?: number }) {
  const url = generated[`./assets/icons/pt-${patient.sex === '男' ? 'm' : 'f'}-${band(age(patient.birth))}.png`]
  const style = { width: size, height: size }
  if (url) return <img src={url} alt={ageSex(patient)} style={style} className="shrink-0 rounded-full" />
  return (
    <span style={style} className={`flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${patient.sex === '男' ? 'bg-blue-200 text-blue-800' : 'bg-pink-200 text-pink-800'}`}>
      {patient.name[0]}
    </span>
  )
}
