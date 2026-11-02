import type { Action } from './store'
import type { Patient } from './types'

// 仮。検査結果の担当が作る。右の枠に出す、この患者の検査結果の表とグラフ
export function LabsPanel({ patient }: { patient: Patient; dispatch: (a: Action) => void }) {
  return <div className="p-4 text-sm text-mist">検査結果（準備中）{patient.name}</div>
}

// 左のメニュー「検査結果」：届いた結果の取り込みと未確認の一覧
export function ResultsPage({ patients }: { patients: Patient[]; dispatch: (a: Action) => void; onOpen: (id: string) => void }) {
  return <main className="flex-1 p-6 text-sm text-mist">検査結果（準備中）{patients.length}</main>
}
