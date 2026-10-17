// Material Symbols のアイコン。name は https://fonts.google.com/icons の名前
export function Icon({ name, fill, size = 20, className = '' }: { name: string; fill?: boolean; size?: number; className?: string }) {
  return (
    <span aria-hidden className={`ms ${fill ? 'ms-fill' : ''} ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  )
}
