import { DRUG_INDICATIONS, TEST_INDICATIONS } from './data'
import type { Disease, Draft, Patient, RxItem, TestOrder } from './types'

export const diseaseLabel = (d: Pick<Disease, 'name' | 'suspected'>) => `${d.name}${d.suspected ? 'の疑い' : ''}`

export type OrderRef = { kind: 'rx'; item: RxItem } | { kind: 'test'; item: TestOrder }

const indications = (o: OrderRef) => (o.kind === 'rx' ? DRUG_INDICATIONS[o.item.drugId] : TEST_INDICATIONS[o.item.code]) ?? []

// オーダーに紐付く病名：継続中で適応に含まれるもの。処方は「疑い」病名には紐付けない。
export const linkedDiseases = (patient: Patient, o: OrderRef): Disease[] => {
  const ind = indications(o)
  return patient.diseases.filter((d) => d.status === '継続' && ind.includes(d.name) && (o.kind === 'test' || !d.suspected))
}

// 紐付く病名がないときの追加候補。検査は「疑い」で付けるのが基本。
export const suggestions = (o: OrderRef) => indications(o).slice(0, 3).map((name) => ({ name, suspected: o.kind === 'test' }))

export const draftOrders = (d: Draft): OrderRef[] => [...d.rx.map((item) => ({ kind: 'rx' as const, item })), ...d.tests.map((item) => ({ kind: 'test' as const, item }))]

export const unlinkedOrders = (patient: Patient, d: Draft) => draftOrders(d).filter((o) => linkedDiseases(patient, o).length === 0)
