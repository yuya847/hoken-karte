import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const vaccineDoc: DocDef = {
  kind: 'vaccine',
  title: '予防接種',
  icon: 'vaccines',
  desc: '準備中',
  group: '健診・予防接種',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>予防接種</Paper>,
}
