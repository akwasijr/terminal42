import { type IconStyle } from '../lib/designSystem'

// A small, hand-authored icon set on a 24x24 grid. Each icon has an outline
// path (`o`) and, where a solid silhouette reads well, a filled path (`f`).
// Rendering style (outlined / filled / duotone / sharp) is applied by <DsIcon>.

type IconDef = { o: string; f?: string }

export type IconName =
  | 'home' | 'search' | 'user' | 'settings' | 'heart' | 'star' | 'bell' | 'calendar' | 'mail' | 'trash' | 'tag' | 'image'
  | 'chevronDown' | 'chevronRight' | 'chevronLeft' | 'chevronUp' | 'close' | 'plus' | 'minus' | 'check' | 'arrowRight' | 'info' | 'filter'
  | 'eye' | 'eyeOff' | 'clock' | 'copy'

const ICONS: Record<IconName, IconDef> = {
  home: { o: 'M3.6 11.4 12 4l8.4 7.4M5.6 10v9.5h4.4V14h4v5.5h4.4V10', f: 'M11.34 3.6 2.74 11a1 1 0 0 0 .66 1.75H4v6.75c0 .55.45 1 1 1h4.5V15h5v5.5H19c.55 0 1-.45 1-1v-6.75h.6a1 1 0 0 0 .66-1.75l-8.6-7.4a1 1 0 0 0-1.32 0Z' },
  search: { o: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20.5 20.5 16 16', f: 'M11 3a8 8 0 0 1 6.32 12.9l3.39 3.39a1 1 0 0 1-1.42 1.42l-3.39-3.39A8 8 0 1 1 11 3Zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z' },
  user: { o: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0', f: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.2 0-7.5 2.7-7.5 6 0 .55.45 1 1 1h13c.55 0 1-.45 1-1 0-3.3-3.3-6-7.5-6Z' },
  settings: { o: 'M19 12a7 7 0 0 0-.13-1.3l2.06-1.6-2-3.46-2.43 1a7 7 0 0 0-2.25-1.3L13.9 2.5h-3.8l-.35 2.54a7 7 0 0 0-2.25 1.3l-2.43-1-2 3.46 2.06 1.6a7 7 0 0 0 0 2.6L3.07 14.1l2 3.46 2.43-1a7 7 0 0 0 2.25 1.3l.35 2.54h3.8l.35-2.54a7 7 0 0 0 2.25-1.3l2.43 1 2-3.46-2.06-1.6A7 7 0 0 0 19 12ZM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z', f: 'M19 12a7 7 0 0 0-.13-1.3l2.06-1.6-2-3.46-2.43 1a7 7 0 0 0-2.25-1.3L13.9 2.5h-3.8l-.35 2.54a7 7 0 0 0-2.25 1.3l-2.43-1-2 3.46 2.06 1.6a7 7 0 0 0 0 2.6L3.07 14.1l2 3.46 2.43-1a7 7 0 0 0 2.25 1.3l.35 2.54h3.8l.35-2.54a7 7 0 0 0 2.25-1.3l2.43 1 2-3.46-2.06-1.6A7 7 0 0 0 19 12ZM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z' },
  heart: { o: 'M12 20.3C8 17 3.5 13.3 3.5 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.5 1.8c0 4.5-4.5 8.2-8.5 11.5Z', f: 'M12 20.3C8 17 3.5 13.3 3.5 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.5 1.8c0 4.5-4.5 8.2-8.5 11.5Z' },
  star: { o: 'M12 3.2l2.6 5.5 6 .7-4.4 4.2 1.1 6L12 16.9 6.7 19.6l1.1-6L3.4 9.4l6-.7Z', f: 'M12 3.2l2.6 5.5 6 .7-4.4 4.2 1.1 6L12 16.9 6.7 19.6l1.1-6L3.4 9.4l6-.7Z' },
  bell: { o: 'M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.5 2 5.8 2 5.8H4.5s2-1.3 2-5.8ZM10 19.5a2 2 0 0 0 4 0', f: 'M12 3a6.5 6.5 0 0 0-6.5 6.5c0 3.8-1.4 5-1.9 5.5a1 1 0 0 0 .7 1.7h15.4a1 1 0 0 0 .7-1.7c-.5-.5-1.9-1.7-1.9-5.5A6.5 6.5 0 0 0 12 3ZM9.6 19.5a2.5 2.5 0 0 0 4.8 0Z' },
  calendar: { o: 'M4.5 6.5h15v13h-15ZM4.5 10h15M8.5 4v4M15.5 4v4', f: 'M7 3a1 1 0 0 1 1 1v1h8V4a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v2H3V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1ZM3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' },
  mail: { o: 'M3.5 6.5h17v11h-17ZM3.5 7.5l8.5 6 8.5-6', f: 'M3 7.2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v.2l-9 6.3ZM21 9.4V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.4l9 6.3Z' },
  trash: { o: 'M5 7h14M9 7V5h6v2M6.6 7l.8 12.5h9.2L17.4 7', f: 'M9 3a1 1 0 0 0-1 1v1H4.5a1 1 0 0 0 0 2H5l.8 12.6A2 2 0 0 0 7.8 21h8.4a2 2 0 0 0 2-1.4L19 7h.5a1 1 0 0 0 0-2H16V4a1 1 0 0 0-1-1Zm1 4V5h4v2Z' },
  tag: { o: 'M4 4h7l9 9-7 7-9-9ZM7.4 7.4h.01', f: 'M3 4a1 1 0 0 1 1-1h7a1 1 0 0 1 .7.3l9 9a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-9-9A1 1 0 0 1 3 11Zm4.4 4.4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z' },
  image: { o: 'M4.5 5.5h15v13h-15ZM8 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM5 17.5l5-5 4 4 2-2 3.5 3.5', f: 'M5 4h14a2 2 0 0 1 2 2v8.7l-3.3-3.3a1 1 0 0 0-1.4 0L13 14.7l-2.8-2.8a1 1 0 0 0-1.4 0L3 17.9V6a2 2 0 0 1 2-2Zm3 5.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z' },
  // utility line icons (always stroked)
  chevronDown: { o: 'M6 9.5l6 6 6-6' },
  chevronRight: { o: 'M9.5 6l6 6-6 6' },
  chevronLeft: { o: 'M14.5 6l-6 6 6 6' },
  chevronUp: { o: 'M6 14.5l6-6 6 6' },
  close: { o: 'M6 6l12 12M18 6 6 18' },
  plus: { o: 'M12 5v14M5 12h14' },
  minus: { o: 'M5 12h14' },
  check: { o: 'M5 12.5l4.5 4.5L19 7' },
  arrowRight: { o: 'M5 12h14M13 6l6 6-6 6' },
  info: { o: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.6h.01' },
  filter: { o: 'M4 6h16M7 12h10M10 18h4' },
  eye: { o: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z' },
  eyeOff: { o: 'M4 4l16 16M9.6 9.7a2.8 2.8 0 0 0 3.9 3.9M6.6 6.8C3.9 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.9-.4 4.1-1M9.9 5.8C10.6 5.6 11.3 5.5 12 5.5c6 0 9.5 6.5 9.5 6.5s-.8 1.4-2.2 3' },
  clock: { o: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2' },
  copy: { o: 'M9 8.5h9.5v9.5H9zM6.5 15.5h-1v-9.5H15v1' }
}

/** Icons shown on the Icons foundation page (silhouettes that read well filled). */
export const ICON_SAMPLE: IconName[] = ['home', 'search', 'user', 'settings', 'heart', 'star', 'bell', 'calendar', 'mail', 'trash', 'tag', 'image']

export function DsIcon({ name, style, size = 22, color = 'currentColor', strokeWidth }: { name: IconName | string; style: IconStyle; size?: number; color?: string; strokeWidth?: number }): JSX.Element {
  const def = ICONS[name as IconName] ?? ICONS.info
  const common = { width: size, height: size, viewBox: '0 0 24 24' }
  if (style === 'filled' && def.f) {
    return <svg {...common} fill={color} stroke="none"><path d={def.f} fillRule="evenodd" /></svg>
  }
  if (style === 'duotone' && def.f) {
    return (
      <svg {...common} fill="none">
        <path d={def.f} fill={color} opacity={0.18} fillRule="evenodd" />
        <path d={def.o} stroke={color} strokeWidth={strokeWidth ?? 1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  const sharp = style === 'sharp'
  const w = strokeWidth ?? (style === 'filled' ? 2.4 : 1.7)
  return <svg {...common} fill="none"><path d={def.o} stroke={color} strokeWidth={w} strokeLinecap={sharp ? 'butt' : 'round'} strokeLinejoin={sharp ? 'miter' : 'round'} /></svg>
}

/** A copy-pasteable SVG snippet for one icon in the chosen style. */
export function iconSnippet(name: IconName, style: IconStyle): string {
  const def = ICONS[name]
  if (style === 'filled' && def.f) {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">\n  <path fill-rule="evenodd" d="${def.f}" />\n</svg>`
  }
  const sharp = style === 'sharp'
  const w = style === 'filled' ? 2.4 : 1.7
  const caps = sharp ? 'butt' : 'round'
  const join = sharp ? 'miter' : 'round'
  if (style === 'duotone' && def.f) {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">\n  <path fill="currentColor" opacity="0.18" fill-rule="evenodd" d="${def.f}" />\n  <path stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="${def.o}" />\n</svg>`
  }
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"\n     stroke-width="${w}" stroke-linecap="${caps}" stroke-linejoin="${join}">\n  <path d="${def.o}" />\n</svg>`
}
