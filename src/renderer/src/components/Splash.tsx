import { useEffect } from 'react'

interface Props {
  minDurationMs?: number
}

export function Splash({ minDurationMs = 2600 }: Props): null {
  useEffect(() => {
    const node = document.getElementById('t42-boot-splash')
    if (!node) return
    const t = window.setTimeout(() => {
      node.classList.add('t42-fade')
      window.setTimeout(() => {
        node.parentNode?.removeChild(node)
      }, 360)
    }, minDurationMs)
    return () => window.clearTimeout(t)
  }, [minDurationMs])
  return null
}
