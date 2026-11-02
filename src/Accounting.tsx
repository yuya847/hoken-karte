import type { Action } from './store'
import type { Patient } from './types'

// 仮。会計の担当が作る
export function AccountingPage({ patients }: { patients: Patient[]; dispatch: (a: Action) => void; onOpen: (id: string) => void }) {
  return <main className="flex-1 p-6 text-sm text-mist">会計（準備中）{patients.length}</main>
}
