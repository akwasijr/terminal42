// Pure, stateless helpers describing how each design kind exports: which
// formats are offered, the offscreen render viewport, and PDF page geometry.
// Extracted from design.ts; no runtime dependencies.

export type ExportFormat = 'html' | 'pdf' | 'png' | 'pptx'

export function extFor(fmt: ExportFormat): string {
  return fmt === 'pptx' ? 'pptx' : fmt === 'png' ? 'png' : fmt === 'pdf' ? 'pdf' : 'html'
}

export function viewportForKind(kind: string | undefined): { width: number; height: number } {
  switch (kind) {
    case 'social-post':   return { width: 1080, height: 1080 }
    case 'social-story':  return { width: 1080, height: 1920 }
    case 'cover-image':   return { width: 1500, height: 500 }
    case 'ad-banner':     return { width: 728,  height: 90 }
    case 'business-card': return { width: 1050, height: 600 }
    case 'poster':        return { width: 1240, height: 1754 }
    case 'flyer':         return { width: 740,  height: 1050 }
    case 'invitation':    return { width: 1500, height: 2100 }
    case 'certificate':   return { width: 1754, height: 1240 }
    case 'pitch-deck':
    case 'sales-deck':
    case 'talk-slides':
    case 'workshop-deck': return { width: 1280, height: 720 }
    case 'chart':         return { width: 800,  height: 500 }
    case 'a4-portrait':
    case 'resume':
    case 'one-pager':
    case 'report':        return { width: 794,  height: 1123 }
    case 'brochure':      return { width: 2232, height: 1050 }
    case 'email':         return { width: 600,  height: 1400 }
    case 'infographic':   return { width: 800,  height: 2400 }
    default:              return { width: 1280, height: 1600 }
  }
}

export function pdfPageForKind(kind: string | undefined): 'A3' | 'A4' | 'A5' | { width: number; height: number } {
  switch (kind) {
    case 'poster':       return 'A3'
    case 'flyer':        return 'A5'
    case 'resume':
    case 'one-pager':
    case 'report':       return 'A4'
    case 'certificate':  return 'A4'
    case 'business-card':return { width: 1050, height: 600 }
    case 'invitation':   return { width: 1500, height: 2100 }
    case 'social-post':  return { width: 1080, height: 1080 }
    case 'social-story': return { width: 1080, height: 1920 }
    default:             return 'A4'
  }
}

export function pdfLandscapeForKind(kind: string | undefined): boolean {
  return kind === 'certificate' || kind === 'pitch-deck' || kind === 'sales-deck' ||
         kind === 'talk-slides' || kind === 'workshop-deck' || kind === 'cover-image' ||
         kind === 'ad-banner' || kind === 'brochure'
}

// What formats does each kind sensibly export to?
//
// Rule of thumb:
//   - Interactive web (app screen, dashboard, login, landing, hero,
//     component) → HTML (live) + PNG (screenshot). PDF dumps of an app
//     are garbage — buttons aren't clickable, scroll regions are
//     cropped, and viewport widths are guessed. Same for emails.
//   - Print-oriented work (resume, report, poster, flyer, etc.) → PDF
//     is the primary deliverable.
//   - Decks → PowerPoint + PDF + PNG.
//   - Social / banners → PNG (the only thing platforms accept).
export function formatsForKind(kind: string | undefined): ExportFormat[] {
  switch (kind) {
    // Decks
    case 'pitch-deck': case 'sales-deck': case 'talk-slides': case 'workshop-deck':
      return ['pptx', 'pdf', 'png', 'html']

    // Print-first
    case 'poster': case 'flyer': case 'invitation':
    case 'business-card': case 'certificate':
      return ['pdf', 'png', 'html']

    // Social / banners
    case 'social-post': case 'social-story': case 'cover-image': case 'ad-banner':
      return ['png', 'html']

    // Documents (read-only, PDF is the canonical share)
    case 'resume': case 'one-pager': case 'report': case 'brochure':
    case 'case-study': case 'blog-post':
      return ['pdf', 'html']

    // Data visuals
    case 'chart': case 'infographic':
      return ['png', 'pdf', 'html']

    // Interactive web — NO PDF (you can't meaningfully export an app to
    // PDF: scroll, tooltips, hover, dark-mode toggle, modal states all
    // collapse to one frozen frame). PNG screenshot is fine though.
    case 'landing': case 'app-screen': case 'dashboard': case 'pricing':
    case 'login': case 'hero': case 'component':
      return ['html', 'png']

    // Email — HTML only (PDF preview misleads; PNG of a marketing
    // email is useless because clients render their own HTML).
    case 'email':
      return ['html']

    // Design artefacts (system / library / wireframe / mood-board /
    // style-tile / user-flow / sitemap) — HTML viewer + PNG snapshot.
    case 'design-system': case 'component-library': case 'wireframe':
    case 'mood-board': case 'style-tile': case 'user-flow': case 'sitemap':
      return ['html', 'png']

    // Anything else (blank canvas, unknown). Be conservative: HTML
    // always works; offer PNG as a snapshot but skip PDF so we don't
    // suggest a deliverable that won't look right.
    default:
      return ['html', 'png']
  }
}

// Can this design be meaningfully recreated in Figma? Almost everything
// visual can, but for HTML-email kinds the result is just a stack of
// boxes — Figma adds no value and the icons / images won't translate.
// Returning false hides the Figma button for those kinds.
export function canExportToFigma(kind: string | undefined): boolean {
  if (!kind) return true
  if (kind === 'email') return false
  return true
}
