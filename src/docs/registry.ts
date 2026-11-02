import type { DocFields, DocKind, KarteDoc, Patient } from '../types'
import { planDoc } from './PlanDoc'
import { careOpinionDoc } from './CareOpinionDoc'
import { certificateDoc } from './CertificateDoc'
import { sickLeaveDoc } from './SickLeaveDoc'
import { nursingOrderDoc } from './NursingOrderDoc'
import { replyDoc } from './ReplyDoc'
import { checkupDoc } from './CheckupDoc'
import { vaccineDoc } from './VaccineDoc'

// 文書の様式。1様式＝1ファイル（docs/XxxDoc.tsx）で、入力欄（Form）と印刷面（Sheet）を持つ。
// init はカルテ（病名・処方・バイタル・検査値・患者情報）から最初の値を埋める
export type DocProps = { patient: Patient; doc: KarteDoc; set: (patch: DocFields) => void }
export type DocDef = {
  kind: DocKind
  title: string
  icon: string // Material Symbols の名前
  desc: string // 一覧に出す一行の説明
  group: '計画書' | '意見書・指示書' | '診断書・証明' | '健診・予防接種' | '紹介・返書'
  init: (p: Patient) => DocFields
  Form: (props: DocProps) => React.ReactNode
  Sheet: (props: { patient: Patient; doc: KarteDoc }) => React.ReactNode // A4（print.tsx の Paper を並べる）
  pages?: (doc: KarteDoc) => number // 2ページ以上の様式
}

export const DOC_DEFS: DocDef[] = [planDoc, careOpinionDoc, certificateDoc, sickLeaveDoc, nursingOrderDoc, replyDoc, checkupDoc, vaccineDoc]

export const docDef = (kind: DocKind) => DOC_DEFS.find((d) => d.kind === kind)!
