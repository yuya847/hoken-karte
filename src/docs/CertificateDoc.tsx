import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const certificateDoc: DocDef = {
  kind: 'certificate',
  title: '診断書',
  icon: 'verified',
  desc: '準備中',
  group: '診断書・証明',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>診断書</Paper>,
}
