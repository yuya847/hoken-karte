import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const sickLeaveDoc: DocDef = {
  kind: 'sickLeave',
  title: '傷病手当金意見書',
  icon: 'work_off',
  desc: '準備中',
  group: '診断書・証明',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>傷病手当金意見書</Paper>,
}
