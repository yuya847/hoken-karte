import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const nursingOrderDoc: DocDef = {
  kind: 'nursingOrder',
  title: '訪問看護指示書',
  icon: 'home_health',
  desc: '準備中',
  group: '意見書・指示書',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>訪問看護指示書</Paper>,
}
