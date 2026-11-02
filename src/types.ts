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
  diseases?: string[] // 確定時に紐付いた病名（表示名）
  noGeneric?: boolean // 後発品への変更不可
  // 外用薬（湿布・塗り薬）は日数ではなく総量で出し、1回量と部位を書く（dose＝総量、days は使わない）
  form?: 'external'
  perUse?: number
  site?: string
}

export type TestOrder = { id: string; code: string; name: string; diseases?: string[] }

export type DiseaseStatus = '継続' | '治癒' | '中止'

export type Disease = {
  id: string
  name: string
  start: string
  main: boolean
  status: DiseaseStatus
  suspected?: boolean
  end?: string // 転帰日
  auto?: string // 自動で追加・変更したときの理由
}

export type Letter = {
  id: string
  title: string
  to: string
  purpose: string
  body: string
  createdAt: string
}

export type Revision = { version: number; savedAt: string; text: string; vitals: Vitals; rx?: RxItem[]; tests?: TestOrder[] }

export type Encounter = {
  id: string
  date: string
  kind: '初診' | '再診'
  vitals: Vitals
  text: string
  rx: RxItem[]
  tests: TestOrder[]
  letters: Letter[]
  dxLog?: string[] // 確定時に自動で行った病名の変更（監査用の記録）
  version: number
  history: Revision[]
}

export type QueueStatus = '待ち' | '診察中' | '会計待ち' | '済'

// 保険証（マイナ保険証）の内容。番号はすべて架空
export type Insurer = {
  payer: string // 保険者番号（8桁。国保は6桁）
  symbol?: string // 記号
  number: string // 番号
  branch?: string // 枝番
  relation: '本人' | '家族'
  publicPayer?: string // 公費負担者番号
  publicRecipient?: string // 公費受給者番号
}

// オンライン資格確認の結果（試作は架空の応答）
export type Qualification = {
  checkedAt: string // ISO
  method: 'マイナ保険証' | '資格確認書' | '保険証'
  valid: boolean
  burden: number // 確認できた負担割合
  limitClass?: string // 限度額適用区分（例 ア・イ・ウ・エ・オ）
  consent: { drugs: boolean; checkups: boolean; records: boolean } // 薬剤情報・特定健診情報・診療情報の閲覧への同意
  diff?: string[] // 登録内容との違い（保険者番号が変わった など）
}

// 文書（療養計画書・主治医意見書・診断書など）。様式ごとの入力は fields に持つ
export type DocKind = 'plan' | 'careOpinion' | 'certificate' | 'sickLeave' | 'nursingOrder' | 'reply' | 'checkup' | 'vaccine'
export type DocFields = Record<string, string | boolean | string[]>
export type KarteDoc = {
  id: string
  kind: DocKind
  title: string
  createdAt: string // YYYY-MM-DD
  updatedAt: string // ISO
  status: '下書き' | '作成済' | '交付済'
  fields: DocFields
}

// 外注検査の結果（1回の採血・採尿ぶん）。値の項目は labData.ts の LAB_ITEMS
export type LabValue = { code: string; value: number | string; flag?: 'H' | 'L' }
export type LabReport = {
  id: string
  date: string // 採取日
  reportedAt: string // 報告日
  source: string // 検査会社（架空）
  values: LabValue[]
  reviewed: boolean // 医師が確認したか
  comment?: string
}

// 予約
export type Appointment = {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  minutes: number
  purpose: string // 定期・検査・健診・予防接種 など
  memo?: string
  status?: '予約' | '来院' | 'キャンセル'
}

// 会計の記録（点数はUI用の仮計算。正式な算定はレセコンで行う）
export type Payment = {
  id: string
  date: string
  encounterId?: string
  points: number
  charge: number // 窓口負担（円）
  received: number
  method: '現金' | 'カード' | 'QR'
}

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
  // ここから下はクリニックの実務用（架空）
  zip?: string
  address?: string
  phone?: string
  occupation?: string
  insurer?: Insurer
  careLevel?: string // 介護度（要支援1〜要介護5）
  qualification?: Qualification
  docs?: KarteDoc[]
  labs?: LabReport[]
  appointments?: Appointment[]
  payments?: Payment[]
}

export type Draft = {
  vitals: Vitals
  text: string
  rx: RxItem[]
  tests: TestOrder[]
  letter: Letter | null
  dxChoice?: Record<string, string> // オーダーID → 選び直した病名
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
  | { kind: 'diseases' }
  | { kind: 'edit-past'; encounterId: string; focus?: 'orders' }
  | { kind: 'docs' }
  | { kind: 'labs' }
