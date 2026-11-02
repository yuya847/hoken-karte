import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const careOpinionDoc: DocDef = {
  kind: 'careOpinion',
  title: '主治医意見書',
  icon: 'elderly',
  desc: '準備中',
  group: '意見書・指示書',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>主治医意見書</Paper>,
}
