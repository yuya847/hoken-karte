import wordmark from './assets/brand/fastkarte-wordmark.svg'

// ファストカルテのロゴを流用（~/biyou-karte の components/BrandMark.tsx・public/brand/ と同じ図形）。
// アイコンは二重シェブロン「»」、ワードマークは手書き風の「ファストカルテ」（横長 1100×218）

export function BrandIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#3F6F8F" />
      <g fill="none" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 18 L32 32 L18 46" stroke="#FAF8F4" />
        <path d="M34 18 L48 32 L34 46" stroke="#E4D3B0" />
      </g>
    </svg>
  )
}

export function BrandWordmark({ height = 22 }: { height?: number }) {
  return <img src={wordmark} alt="ファストカルテ" height={height} width={Math.round((height * 1100) / 218)} draggable={false} />
}
