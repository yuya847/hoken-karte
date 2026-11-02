import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const checkupDoc: DocDef = {
  kind: 'checkup',
  title: '特定健診・がん検診',
  icon: 'health_and_safety',
  desc: '準備中',
  group: '健診・予防接種',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>特定健診・がん検診</Paper>,
}
