import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { today, uid } from './data'
import { DOC_DEFS, docDef, type DocDef } from './docs/registry'
import { PrintPreview } from './print'
import type { Action } from './store'
import type { DocKind, KarteDoc, Patient } from './types'

const GROUPS: DocDef['group'][] = ['計画書', '意見書・指示書', '診断書・証明', '紹介・返書', '健診・予防接種']

const STATUS_STYLE: Record<KarteDoc['status'], string> = {
  下書き: 'bg-cream text-mist border border-line',
  作成済: 'bg-[#e3ecfb] text-clinical',
  交付済: 'bg-[#e6f6f2] text-[#0d6e61]',
}

// 右の枠：この患者の文書の一覧と、新しく作る文書の一覧。押すと文書のウインドウが開く
export function DocsPanel({ patient, dispatch, onOpen, onLetter }: { patient: Patient; dispatch: (a: Action) => void; onOpen: (id: string) => void; onLetter: () => void }) {
  const docs = [...(patient.docs ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const letters = patient.encounters.flatMap((e) => e.letters.map((l) => ({ ...l, date: e.date })))

  const create = (kind: DocKind) => {
    const def = docDef(kind)
    const doc: KarteDoc = { id: uid('doc'), kind, title: def.title, createdAt: today(), updatedAt: new Date().toISOString(), status: '下書き', fields: def.init(patient) }
    dispatch({ type: 'saveDoc', patientId: patient.id, doc })
    onOpen(doc.id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
        <Icon name="description" size={20} className="text-clinical" />
        <h2 className="flex-1 text-base font-semibold">文書</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <section>
          <h3 className="mb-1.5 text-xs font-medium text-mist">この患者の文書</h3>
          {docs.length === 0 && letters.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-mist">まだありません</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ivory">
              {docs.map((d) => (
                <li key={d.id}>
                  <button onClick={() => onOpen(d.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-cream">
                    <Icon name={docDef(d.kind).icon} size={20} className="text-mist" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{d.title}</span>
                      <span className="block text-[11px] text-mist">
                        {d.createdAt.replace(/-/g, '/')} 作成 ・ {new Date(d.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 更新
                      </span>
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                  </button>
                </li>
              ))}
              {letters.map((l) => (
                <li key={l.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Icon name="forward_to_inbox" size={20} className="text-mist" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{l.title}</span>
                    <span className="block truncate text-[11px] text-mist">
                      {l.date.replace(/-/g, '/')} ・ {l.to || '宛先なし'}
                    </span>
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE['作成済']}`}>カルテに添付</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-medium text-mist">新しく作る</h3>
          <div className="space-y-3">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="mb-1 text-[11px] text-mist">{g}</div>
                <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                  {g === '紹介・返書' && <NewButton icon="forward_to_inbox" title="診療情報提供書（紹介状）" desc="今日のカルテに添付（⌘L）" onClick={onLetter} />}
                  {DOC_DEFS.filter((d) => d.group === g).map((d) => (
                    <NewButton key={d.kind} icon={d.icon} title={d.title} desc={d.desc} onClick={() => create(d.kind)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function NewButton({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 rounded-lg border border-line bg-ivory px-3 py-2 text-left hover:border-gold hover:bg-gold-soft/50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-ink">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block truncate text-[11px] text-mist">{desc}</span>
      </span>
    </button>
  )
}

// 文書のウインドウ：左に入力、右に印刷イメージ（A4）。入力はその場で保存する（確定とは別）
export function DocWindow({ patient, docId, dispatch, onClose }: { patient: Patient; docId: string; dispatch: (a: Action) => void; onClose: () => void }) {
  const doc = patient.docs?.find((d) => d.id === docId)
  const [pane, setPane] = useState<'form' | 'paper'>('form')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onClose])
  if (!doc) return null
  const def = docDef(doc.kind)
  const save = (patch: Partial<KarteDoc>) => dispatch({ type: 'saveDoc', patientId: patient.id, doc: { ...doc, ...patch, updatedAt: new Date().toISOString() } })
  const set = (fields: KarteDoc['fields']) => save({ fields: { ...doc.fields, ...fields } })
  const { Form, Sheet } = def

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 max-md:p-0" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={doc.title} className="flex h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-2xl max-md:h-full max-md:rounded-none">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-ivory px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold-soft">
            <Icon name={def.icon} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{doc.title}</h2>
            <p className="truncate text-[11px] text-mist">
              {patient.name} ・ 入力はその場で保存されます
            </p>
          </div>
          <div className="flex rounded-md border border-line bg-cream p-0.5 text-xs md:hidden">
            {(['form', 'paper'] as const).map((k) => (
              <button key={k} onClick={() => setPane(k)} className={`rounded px-2.5 py-1 ${pane === k ? 'bg-ivory font-medium shadow-soft' : 'text-mist'}`}>
                {k === 'form' ? '入力' : '印刷イメージ'}
              </button>
            ))}
          </div>
          <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[doc.status]}`}>{doc.status}</span>
          {doc.status === '下書き' && (
            <button onClick={() => save({ status: '作成済' })} className="btn btn-sm btn-tonal">
              <Icon name="check" size={18} />
              作成済にする
            </button>
          )}
          {doc.status === '作成済' && (
            <button onClick={() => save({ status: '交付済' })} className="btn btn-sm btn-tonal">
              <Icon name="handshake" size={18} />
              交付した
            </button>
          )}
          <button onClick={() => window.print()} className="btn btn-sm btn-filled">
            <Icon name="print" size={18} />
            印刷
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-1 text-xs">
              削除しますか？
              <button
                onClick={() => {
                  dispatch({ type: 'removeDoc', patientId: patient.id, id: doc.id })
                  onClose()
                }}
                className="btn btn-sm btn-danger"
              >
                削除
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn btn-sm btn-text">
                やめる
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} title="削除" className="icon-btn icon-btn-sm text-mist">
              <Icon name="delete" size={20} />
            </button>
          )}
          <button onClick={onClose} title="閉じる（Esc）" className="icon-btn icon-btn-sm">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className={`min-h-0 overflow-y-auto bg-ivory px-5 py-4 md:w-[46%] md:shrink-0 md:border-r md:border-line max-md:flex-1 ${pane === 'form' ? '' : 'max-md:hidden'}`}>
            <div className="space-y-5">
              <Form patient={patient} doc={doc} set={set} />
            </div>
          </div>
          <div className={`min-h-0 min-w-0 flex-1 ${pane === 'paper' ? '' : 'max-md:hidden'}`}>
            <PrintPreview pages={def.pages?.(doc) ?? 1}>
              <Sheet patient={patient} doc={doc} />
            </PrintPreview>
          </div>
        </div>
      </div>
    </div>
  )
}
