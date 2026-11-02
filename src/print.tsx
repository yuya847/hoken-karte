import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A4 の文書。画面では枠の幅に合わせて縮めて見せ、印刷するとこの紙だけが出る（画面のほかの部分は出さない）。
// 中身は mm 単位で書く（210mm × 297mm、余白は中で取る）
export function PrintPreview({ children, pages = 1 }: { children: React.ReactNode; pages?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const el = box.current
    if (!el) return
    // 210mm ≒ 793.7px
    const fit = () => setScale(Math.min(1, (el.clientWidth - 32) / 793.7))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className="h-full overflow-auto bg-surface-2 py-4">
      <div style={{ width: 793.7 * scale, height: 1122.5 * scale * pages }} className="mx-auto">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: '210mm' }} className="bg-white text-black shadow-soft">
          {children}
        </div>
      </div>
      {createPortal(<div className="print-sheet">{children}</div>, document.body)}
    </div>
  )
}

// 紙の1ページ（A4・余白つき）。複数ページの文書はこれを並べる
export function Paper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`paper relative box-border h-[297mm] w-[210mm] overflow-hidden px-[16mm] py-[14mm] text-[10pt] leading-[1.5] ${className}`}>{children}</section>
}
