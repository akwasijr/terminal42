// Design foundation directives — stripped for public release.
// Add your own look anatomy and foundation blocks here.

export type LookAnatomy = {
  surfaces: string
  type: string
  shape: string
  motion: string
  signature: string
}

export function buildFoundationBlock(_opts: {
  look?: string | null
  designSystem?: string | null
  theme?: string | null
}): string {
  // Implement your own design foundation prompt here.
  return ''
}
