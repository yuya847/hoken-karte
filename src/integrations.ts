import { useEffect, useState } from 'react'

// 外部連携の設定（PACS・CT/MRIのビューア・画像オーダーの送信先）。この端末のブラウザにだけ保存する。
// URL の {patientId} {accession} {studyUid} は開くときに置き換える。
// 試作では外部へ何も送らない。ビューアは登録したURLを新しいタブで開くだけ。
export type Integrations = {
  pacsViewer: string // 例：OHIF や各社PACSのWebビューア
  advViewer: string // CT・MRI用の外部ソフト（3Dワークステーション等）。https:// のほか独自スキームも可
  advLabel: string
  orderTo: string // CT・MRIオーダーの送信先（RIS・依頼先病院）。本番は HL7 / DICOM MWL
}

const KEY = 'hoken-karte-integrations-v1'
const EVENT = 'hoken-karte-integrations'
const EMPTY: Integrations = { pacsViewer: '', advViewer: '', advLabel: '', orderTo: '' }

export const loadIntegrations = (): Integrations => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return EMPTY
  }
}

export const saveIntegrations = (v: Integrations) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // 保存できなくても画面は動かす
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useIntegrations() {
  const [v, setV] = useState(loadIntegrations)
  useEffect(() => {
    const on = () => setV(loadIntegrations())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return v
}

export const fillUrl = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? encodeURIComponent(vars[k]) : m))

// javascript: などは開かない
export const isSafeUrl = (url: string) => !/^\s*(javascript|data|vbscript):/i.test(url)
