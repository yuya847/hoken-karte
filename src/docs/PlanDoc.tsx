import { Paper } from '../print'
import type { DocDef } from './registry'

// 仮。担当が様式を作る
export const planDoc: DocDef = {
  kind: 'plan',
  title: '生活習慣病 療養計画書',
  icon: 'assignment',
  desc: '準備中',
  group: '計画書',
  init: () => ({}),
  Form: () => <p className="text-sm text-mist">準備中</p>,
  Sheet: () => <Paper>生活習慣病 療養計画書</Paper>,
}
