export type Vitals = {
  sbp?: number
  dbp?: number
  hr?: number
  bw?: number
  bt?: number
  spo2?: number
}

export type RxItem = {
  id: string
  drugId: string
  name: string
  dose: number
  unit: string
  usage: string
  days: number
}

export type TestOrder = { id: string; code: string; name: string }

export type DiseaseStatus = '継続' | '治癒' | '中止'

export type Disease = {
  id: string
  name: string
  start: string
  main: boolean
  status: DiseaseStatus
}

export type Letter = {
  id: string
  title: string
  to: string
  purpose: string
  body: string
  createdAt: string
}

export type Revision = { version: number; savedAt: string; text: string; vitals: Vitals }

export type Encounter = {
  id: string
  date: string
  kind: '初診' | '再診'
  vitals: Vitals
  text: string
  rx: RxItem[]
  tests: TestOrder[]
  letters: Letter[]
  version: number
  history: Revision[]
}

export type QueueStatus = '待ち' | '診察中' | '会計待ち' | '済'

export type Patient = {
  id: string
  name: string
  kana: string
  sex: '男' | '女'
  birth: string
  insurance: string
  burden: number
  allergies: string[]
  status: QueueStatus
  diseases: Disease[]
  encounters: Encounter[]
}

export type Draft = {
  vitals: Vitals
  text: string
  rx: RxItem[]
  tests: TestOrder[]
  letter: Letter | null
  savedAt: string | null
}

export type SessionMetric = {
  patientId: string
  patientName: string
  kind: '初診' | '再診'
  seconds: number
  ops: number
  at: string
}

export type RightMode =
  | { kind: 'chart' }
  | { kind: 'letter' }
  | { kind: 'images' }
  | { kind: 'tests' }
  | { kind: 'edit-past'; encounterId: string }
