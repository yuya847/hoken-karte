import { STUDIES, TESTS, type Study } from './data'
import { Icon } from './Icon'
import { fillUrl, isSafeUrl, useIntegrations } from './integrations'
import type { Draft, Patient } from './types'

const MODALITY: Record<Study['modality'], { label: string; tone: string }> = {
  CR: { label: 'X線', tone: 'bg-surface-2 text-ink' },
  CT: { label: 'CT', tone: 'bg-[#e0f7fa] text-[#00696f]' },
  MR: { label: 'MRI', tone: 'bg-[#ede7f6] text-[#4a2c8f]' },
  US: { label: 'エコー', tone: 'bg-[#fff3e0] text-[#8a4b00]' },
}

const IMAGING = new Set(TESTS.filter((t) => t.group === '画像').map((t) => t.code))

// 右端の「画像」で開く。画像そのものはPACSのビューアで見る（カルテの中に画像を持たない）。
// 検査一覧は試作では架空（data.ts の STUDIES）。本番は DICOMweb で取得する。
export function PacsPanel({ patient, draft, onClose }: { patient: Patient; draft: Draft; onClose: () => void }) {
  const cfg = useIntegrations()
  const studies = [...(STUDIES[patient.id] ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const requested = draft.tests.filter((t) => IMAGING.has(t.code))

  const open = (template: string, s: Study) => {
    const url = fillUrl(template, { patientId: patient.id, accession: s.accession, studyUid: s.uid })
    if (isSafeUrl(url)) window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pt-5 pb-3">
        <button onClick={onClose} className="icon-btn" title="記載に戻る（Esc）">
          <Icon name="arrow_back" />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e0f7fa] text-[#00696f]">
          <Icon name="radiology" size={20} />
        </span>
        <h2 className="flex-1 text-[22px]">画像（PACS）</h2>
        <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${cfg.pacsViewer ? 'text-ink-2' : 'text-error'}`}>
          <Icon name={cfg.pacsViewer ? 'link' : 'link_off'} size={16} />
          {cfg.pacsViewer ? 'PACS連携あり' : 'PACS未設定'}
        </span>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-5">
        {requested.length > 0 && (
          <section>
            <div className="label mb-1.5">今回の依頼（確定時に送信）</div>
            <div className="flex flex-wrap gap-1.5">
              {requested.map((t) => (
                <span key={t.id} className="flex h-8 items-center gap-1 rounded-lg bg-lab-ctr px-3 text-[13px] font-medium whitespace-nowrap text-lab">
                  <Icon name="send" size={16} />
                  {t.name}
                  <span className="font-normal text-ink-2">→ {cfg.orderTo || '送信先未設定'}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="label mb-1.5">過去の画像（{studies.length}件）</div>
          {studies.length === 0 ? (
            <div className="rounded-2xl bg-surface-1 py-10 text-center text-sm text-ink-2">PACSにこの患者の画像はありません</div>
          ) : (
            <div className="space-y-1.5">
              {studies.map((s) => {
                const m = MODALITY[s.modality]
                const adv = (s.modality === 'CT' || s.modality === 'MR') && cfg.advViewer
                return (
                  <div
                    key={s.uid}
                    onClick={() => cfg.pacsViewer && open(cfg.pacsViewer, s)}
                    className={`flex flex-wrap items-center gap-3 rounded-2xl bg-surface-1 px-3 py-2.5 text-sm ${cfg.pacsViewer ? 'cursor-pointer hover:bg-surface-2' : ''}`}
                  >
                    <span className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${m.tone}`}>{m.label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.description}</span>
                      <span className="block text-xs whitespace-nowrap text-ink-2 tabular-nums">
                        {s.date}・{s.images}枚・受付番号 {s.accession}
                      </span>
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${s.report === '読影済' ? 'bg-rx-ctr text-rx' : 'bg-[#ffefc9] text-[#5c4300]'}`}>
                      {s.report}
                    </span>
                    {adv && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          open(cfg.advViewer, s)
                        }}
                        className="btn btn-sm btn-text"
                      >
                        <Icon name="view_in_ar" size={18} />
                        {cfg.advLabel || 'CT・MRIソフト'}
                      </button>
                    )}
                    <button
                      disabled={!cfg.pacsViewer}
                      onClick={(e) => {
                        e.stopPropagation()
                        open(cfg.pacsViewer, s)
                      }}
                      className="btn btn-sm btn-tonal disabled:opacity-40"
                    >
                      <Icon name="open_in_new" size={18} />
                      PACSで開く
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <p className="flex items-start gap-1.5 text-xs text-ink-2">
          <Icon name="info" size={16} />
          画像は院内のPACSビューアで開きます（カルテには画像を保存しません）。PACS・CT/MRI用ソフト・依頼の送信先は「設定 › 外部連携」で登録します。一覧は試作用の架空データです。
        </p>
      </div>
    </div>
  )
}
