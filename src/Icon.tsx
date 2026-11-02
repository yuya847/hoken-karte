// Material Symbols のアイコン。name は https://fonts.google.com/icons の名前。size は文字サイズ「小」のときのpx（設定で一緒に大きくなる）
export function Icon({ name, fill, size = 20, className = '' }: { name: string; fill?: boolean; size?: number; className?: string }) {
  return (
    <span aria-hidden className={`ms ${fill ? 'ms-fill' : ''} ${className}`} style={{ fontSize: `${size / 16}rem` }}>
      {name}
    </span>
  )
}
