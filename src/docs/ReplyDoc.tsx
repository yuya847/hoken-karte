import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const replyDoc: DocDef = {
  kind: 'reply',
  title: '紹介状の返書',
  icon: 'reply',
  desc: '準備中',
  group: '紹介・返書',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>紹介状の返書</Paper>,
}
