import type { FC } from 'react'
import {
  MeshGradient, StaticMeshGradient, StaticRadialGradient, GrainGradient, DotOrbit, DotGrid, Warp, Spiral, Swirl, Waves,
  NeuroNoise, PerlinNoise, SimplexNoise, Voronoi, PulsingBorder, Metaballs, ColorPanels, SmokeRing, GodRays, Dithering,
  Heatmap, LiquidMetal, GemSmoke, PaperTexture, FlutedGlass, Water, ImageDithering, HalftoneDots, HalftoneCmyk,
} from '@paper-design/shaders-react'

type SC = FC<Record<string, unknown>>
const as = (c: unknown): SC => c as SC

const TRANSPARENT_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/** Image-source shaders need an `image` prop; generative ones ignore it. */
export const IMAGE_SHADERS = new Set(['paper-texture', 'fluted-glass', 'water', 'image-dithering', 'halftone-dots', 'halftone-cmyk', 'heatmap', 'liquid-metal', 'gem-smoke'])

// Registry that adapts the @paper-design/shaders components to our floating
// "Shaders" gallery + per-shader parameter controls. Params are stored in the
// component's native units; the UI shows value * `mul` with `suffix`.

export interface ShaderParam {
  key: string
  label: string
  min: number
  max: number
  step?: number
  def: number
  mul?: number      // display multiplier (e.g. 100 for a 0..1 value shown as %)
  suffix?: string
}

export interface ShaderDef {
  id: string
  label: string
  category: 'Image filters' | 'Logo animations' | 'Effects'
  Component: SC
  params: ShaderParam[]
  colors?: string[]   // foreground colour stops (when the shader supports `colors`)
  thumb: string       // CSS background used as a gallery placeholder
}

const P = (key: string, label: string, min: number, max: number, def: number, opts: Partial<ShaderParam> = {}): ShaderParam => ({ key, label, min, max, def, ...opts })
const PCT = (key: string, label: string, def: number): ShaderParam => P(key, label, 0, 1, def, { step: 0.01, mul: 100, suffix: '%' })
const DEG = (key: string, label: string, def: number): ShaderParam => P(key, label, 0, 360, def, { suffix: '°' })
const SPEED: ShaderParam = P('speed', 'Speed', 0, 2, 1, { step: 0.05, mul: 100, suffix: '%' })
const SCALE: ShaderParam = P('scale', 'Scale', 0.1, 2, 1, { step: 0.01, mul: 100, suffix: '%' })

export const SHADERS: ShaderDef[] = [
  // ── Image filters ──
  { id: 'paper-texture', label: 'Paper Texture', category: 'Image filters', Component: as(PaperTexture), params: [SCALE], thumb: 'linear-gradient(135deg,#e8e4da,#cfc8b8)' },
  { id: 'fluted-glass', label: 'Fluted Glass', category: 'Image filters', Component: as(FlutedGlass), params: [PCT('distortion', 'Distortion', 0.4), SCALE], thumb: 'repeating-linear-gradient(90deg,#cfe3f0,#cfe3f0 6px,#b6d4e8 6px,#b6d4e8 12px)' },
  { id: 'water', label: 'Water', category: 'Image filters', Component: as(Water), params: [SPEED, SCALE], thumb: 'linear-gradient(135deg,#bfe6ff,#8fc7f0)' },
  { id: 'image-dithering', label: 'Image Dithering', category: 'Image filters', Component: as(ImageDithering), params: [SCALE], thumb: 'radial-gradient(circle, #9be36a 30%, #2c3a22 31%)' },
  { id: 'halftone-dots', label: 'Halftone Dots', category: 'Image filters', Component: as(HalftoneDots), params: [SCALE], thumb: 'radial-gradient(circle at 4px 4px, #222 2px, #efeae0 2px) 0 0/10px 10px' },
  { id: 'halftone-cmyk', label: 'Halftone CMYK', category: 'Image filters', Component: as(HalftoneCmyk), params: [SCALE], thumb: 'radial-gradient(circle at 4px 4px, #18a0c8 2px, #f3eee2 2px) 0 0/10px 10px' },

  // ── Logo animations ──
  {
    id: 'heatmap', label: 'Heatmap', category: 'Logo animations', Component: as(Heatmap),
    params: [DEG('angle', 'Angle', 0), PCT('noise', 'Noise', 0), PCT('innerGlow', 'Inner glow', 0.5), PCT('outerGlow', 'Outer glow', 0.5), PCT('contour', 'Contour', 0.5), SPEED, SCALE],
    colors: ['#FF4C00', '#FF991E', '#FFE679', '#6BD7FF', '#2F63E7', '#1F3BA2', '#11206A'],
    thumb: 'radial-gradient(circle at 50% 60%, #ff7a00, #2a3bff 40%, #02030f 75%)',
  },
  {
    id: 'liquid-metal', label: 'Liquid Metal', category: 'Logo animations', Component: as(LiquidMetal),
    params: [P('repetition', 'Repetition', 0, 4, 2, { step: 0.02, mul: 100, suffix: '%' }), PCT('contour', 'Contour', 0.4), PCT('distortion', 'Distortion', 0.07), PCT('softness', 'Softness', 0.1), DEG('angle', 'Angle', 70), PCT('shiftRed', 'Redshift', 0.3), PCT('shiftBlue', 'Blueshift', 0.3), SPEED, P('scale', 'Scale', 0.1, 2, 0.6, { step: 0.01, mul: 100, suffix: '%' })],
    thumb: 'linear-gradient(135deg,#dfe3e8,#7c8694 45%,#0e1116 55%,#cfd6df)',
  },
  { id: 'gem-smoke', label: 'Gem Smoke', category: 'Logo animations', Component: as(GemSmoke), params: [SPEED, SCALE], thumb: 'linear-gradient(135deg,#f2f2f0,#cfcfca)' },

  // ── Effects ──
  { id: 'mesh-gradient', label: 'Mesh Gradient', category: 'Effects', Component: as(MeshGradient), params: [SPEED, SCALE, PCT('distortion', 'Distortion', 0.8), PCT('swirl', 'Swirl', 0.1)], colors: ['#9F50D3', '#F75092', '#241D9A', '#E0EAFF'], thumb: 'linear-gradient(135deg,#c9b6ff,#ff9ec4 40%,#b8c6ff)' },
  { id: 'static-mesh-gradient', label: 'Static Mesh Gradient', category: 'Effects', Component: as(StaticMeshGradient), params: [P('positions', 'Positions', 0, 10, 0), PCT('waveX', 'Horizontal wave', 0.6), PCT('waveXShift', 'Horizontal wave shift', 0.7), PCT('waveY', 'Vertical wave', 0.7), PCT('waveYShift', 'Vertical wave shift', 0.7), PCT('mixing', 'Mixing', 0.5), SCALE, DEG('rotation', 'Rotation', 0)], colors: ['#FFFFFF', '#F4A261', '#9C2B2B', '#264653'], thumb: 'linear-gradient(135deg,#f0c98a,#c25a4f 50%,#264653)' },
  { id: 'static-radial-gradient', label: 'Static Radial Gradient', category: 'Effects', Component: as(StaticRadialGradient), params: [PCT('radius', 'Radius', 0.8), PCT('focalDistance', 'Focal distance', 0.99), DEG('focalAngle', 'Focal angle', 0), PCT('falloff', 'Falloff', 0.24), PCT('mixing', 'Mixing', 0.5), SCALE, P('offsetX', 'Offset X', -1, 1, 0, { step: 0.01, mul: 100, suffix: '%' }), P('offsetY', 'Offset Y', -1, 1, 0, { step: 0.01, mul: 100, suffix: '%' })], colors: ['#00e6c3', '#063b6e'], thumb: 'radial-gradient(circle at 50% 55%, #7ef9e0, #0a2a55 70%, #02030f)' },
  { id: 'dithering', label: 'Dithering', category: 'Effects', Component: as(Dithering), params: [SPEED, SCALE], thumb: 'radial-gradient(circle at 50% 45%, #2f7bdc 30%, #050a1c 70%)' },
  { id: 'grain-gradient', label: 'Grain Gradient', category: 'Effects', Component: as(GrainGradient), params: [SPEED, SCALE, PCT('distortion', 'Distortion', 0.5)], colors: ['#3b1bff', '#b86bff', '#ff66c4'], thumb: 'linear-gradient(135deg,#3b1bff,#b86bff 50%,#02030f)' },
  { id: 'dot-orbit', label: 'Dot Orbit', category: 'Effects', Component: as(DotOrbit), params: [SPEED, SCALE], colors: ['#ff7a00', '#ffb84d', '#7a2b0f'], thumb: 'radial-gradient(circle at 6px 6px, #ff7a00 2px, #120a06 2px) 0 0/14px 14px' },
  { id: 'dot-grid', label: 'Dot Grid', category: 'Effects', Component: as(DotGrid), params: [P('dotSize', 'Dot size', 0, 20, 2), P('gapX', 'Gap X', 4, 60, 24), P('gapY', 'Gap Y', 4, 60, 24)], thumb: 'radial-gradient(circle at 6px 6px, #fff 1.2px, #05060a 1.2px) 0 0/14px 14px' },
  { id: 'warp', label: 'Warp', category: 'Effects', Component: as(Warp), params: [SPEED, SCALE, PCT('distortion', 'Distortion', 0.5), PCT('swirl', 'Swirl', 0.5)], colors: ['#7a3bff', '#c9b6ff'], thumb: 'linear-gradient(135deg,#7a3bff,#3a1a7a)' },
  { id: 'spiral', label: 'Spiral', category: 'Effects', Component: as(Spiral), params: [SPEED, SCALE], colors: ['#69c7ff', '#0a1a2a'], thumb: 'repeating-radial-gradient(circle, #69c7ff 0 6px, #0a1a2a 6px 12px)' },
  { id: 'swirl', label: 'Swirl', category: 'Effects', Component: as(Swirl), params: [SPEED, SCALE], colors: ['#f6c1c1', '#5a1320'], thumb: 'conic-gradient(#f6c1c1,#5a1320,#f6c1c1)' },
  { id: 'waves', label: 'Waves', category: 'Effects', Component: as(Waves), params: [P('amplitude', 'Amplitude', 0, 1, 0.5, { step: 0.01, mul: 100, suffix: '%' }), P('frequency', 'Frequency', 0, 2, 1, { step: 0.01, mul: 100, suffix: '%' }), SCALE], thumb: 'repeating-linear-gradient(135deg,#f2c14e 0 6px,#0b0b0b 6px 12px)' },
  { id: 'neuro-noise', label: 'Neuro Noise', category: 'Effects', Component: as(NeuroNoise), params: [SPEED, SCALE], thumb: 'radial-gradient(circle at 30% 30%, #6fa8ff, #04122a 70%)' },
  { id: 'perlin-noise', label: 'Perlin Noise', category: 'Effects', Component: as(PerlinNoise), params: [SPEED, SCALE], thumb: 'linear-gradient(135deg,#6a3bff,#d6c6ff)' },
  { id: 'simplex-noise', label: 'Simplex Noise', category: 'Effects', Component: as(SimplexNoise), params: [SPEED, SCALE], colors: ['#ffe7b0', '#e07a5f', '#3d5a80'], thumb: 'linear-gradient(135deg,#ffe7b0,#e07a5f 50%,#3d5a80)' },
  { id: 'voronoi', label: 'Voronoi', category: 'Effects', Component: as(Voronoi), params: [SPEED, SCALE], colors: ['#f6b73c', '#7a4a12'], thumb: 'conic-gradient(from 0deg,#f6b73c,#c8862a,#f6b73c)' },
  { id: 'pulsing-border', label: 'Pulsing Border', category: 'Effects', Component: as(PulsingBorder), params: [SPEED, SCALE], colors: ['#ff4ec4', '#6b5bff'], thumb: 'linear-gradient(135deg,#ff4ec4,#6b5bff)' },
  { id: 'metaballs', label: 'Metaballs', category: 'Effects', Component: as(Metaballs), params: [SPEED, SCALE], colors: ['#ffd24d', '#ff5a3c', '#7a2bff'], thumb: 'radial-gradient(circle at 35% 45%, #ff5a3c, #05060a 60%)' },
  { id: 'color-panels', label: 'Color Panels', category: 'Effects', Component: as(ColorPanels), params: [SPEED, SCALE], colors: ['#6b5bff', '#ff5a8a', '#f6c14e'], thumb: 'linear-gradient(180deg,#6b5bff,#ff5a8a,#f6c14e)' },
  { id: 'smoke-ring', label: 'Smoke Ring', category: 'Effects', Component: as(SmokeRing), params: [SPEED, SCALE], thumb: 'radial-gradient(circle, #050505 30%, #cfcfcf 55%, #050505 80%)' },
  { id: 'god-rays', label: 'God Rays', category: 'Effects', Component: as(GodRays), params: [SPEED, SCALE], colors: ['#7a5bff', '#1a0e4a'], thumb: 'conic-gradient(from 200deg at 50% 40%, #7a5bff, #1a0e4a, #7a5bff)' },
]

export const SHADER_CATEGORIES: ShaderDef['category'][] = ['Image filters', 'Logo animations', 'Effects']
export const shaderById = (id?: string): ShaderDef | undefined => SHADERS.find((s) => s.id === id)

/** Default param record for a shader (native units). */
export function defaultShaderParams(def: ShaderDef): Record<string, number> {
  const p: Record<string, number> = {}
  for (const param of def.params) p[param.key] = param.def
  return p
}

/** Live, animated shader layer rendered inside a canvas object (clipped to its
 * corner radius). Only used on screen — exports fall back to no shader. */
export function ShaderLayer({ shaderId, params, colors, image }: { shaderId?: string; params?: Record<string, number>; colors?: string[]; image?: string }): JSX.Element | null {
  const def = shaderById(shaderId)
  if (!def) return null
  const Comp = def.Component
  const merged = { ...defaultShaderParams(def), ...(params ?? {}) }
  const cols = colors ?? def.colors
  const props: Record<string, unknown> = { ...merged, width: '100%', height: '100%', style: { width: '100%', height: '100%', display: 'block' } }
  if (cols && cols.length) props.colors = cols
  if (IMAGE_SHADERS.has(def.id)) props.image = image || TRANSPARENT_PX
  return (
    <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}>
      <Comp {...props} />
    </span>
  )
}
