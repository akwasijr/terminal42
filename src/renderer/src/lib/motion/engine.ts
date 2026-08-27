// The Motion scene.
//
// The engine has one unusual rule: it owns no clock. Every render takes the
// loop phase as an argument. On screen a requestAnimationFrame loop supplies
// it; the exporter supplies k/frames; the scrubber supplies whatever the user
// is pointing at. Because nothing else can advance time, those three always
// agree, and an exported video is the same animation the user approved rather
// than a recording of it.
//
// The transform hierarchy exists so the shared control sections compose
// without fighting each other:
//
//   root        — Transform: position and scale of the whole piece
//     pose      — Pose: the tilt you set by dragging in the frame
//       drift   — Displacement: orbit and pan, which move the camera's view of
//                 the piece without disturbing the pose you set
//         cards — the component's own arrangement
//
// Flattening any two of those would make one control silently redefine
// another: tilt would rotate the pan, or pan would fight the layout.

import type * as THREE from 'three'
import type { CardPlacement, MotionDoc } from '../../../../shared/motion/types'
import { TAU, wrap01 } from '../../../../shared/motion/math'
import { imageAssignment, resolvedPose, waveAt } from '../../../../shared/motion/frame'
import { CAMERA } from '../../../../shared/motion/visibility'
import { applyBendShader, cardAspect, drawCardFace } from './cardTexture'

type CardHandle = {
  group: THREE.Group
  front: THREE.Mesh
  back: THREE.Mesh
  frontMat: THREE.MeshBasicMaterial
  backMat: THREE.MeshBasicMaterial
  bendUniforms: Array<{ bend: { value: number }; axis: { value: number } }>
}

export type SceneDeps = typeof import('three')

/** How many segments a card plane gets, which is what makes a bend look curved. */
const BEND_SEGMENTS = 24

export class MotionEngine {
  private three: SceneDeps
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private root: THREE.Group
  private poseGroup: THREE.Group
  private driftGroup: THREE.Group
  private cards: CardHandle[] = []
  private textures = new Map<string, THREE.Texture>()
  private images = new Map<string, HTMLImageElement>()
  private doc: MotionDoc | null = null
  private cardGeometry: THREE.PlaneGeometry | null = null
  private geometryAspect = 0
  private disposed = false
  private raycaster: THREE.Raycaster
  private selected: number | null = null
  private outline: THREE.LineSegments | null = null

  constructor(three: SceneDeps, canvas: HTMLCanvasElement) {
    this.three = three
    this.renderer = new three.WebGLRenderer({
      canvas,
      antialias: true,
      // Premultiplied alpha off, so a transparent still exports with clean
      // edges instead of a dark halo where the card meets nothing.
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    })
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new three.Scene()
    this.camera = new three.PerspectiveCamera(CAMERA.fov, 16 / 9, CAMERA.near, CAMERA.far)
    this.camera.position.set(0, 0, CAMERA.z)
    this.root = new three.Group()
    this.poseGroup = new three.Group()
    this.driftGroup = new three.Group()
    this.poseGroup.add(this.driftGroup)
    this.root.add(this.poseGroup)
    this.scene.add(this.root)
    this.raycaster = new three.Raycaster()
  }

  /**
   * Which card is under a point in the frame, if any.
   *
   * Takes normalised device coordinates so the caller owns the arithmetic
   * from mouse event to canvas, which is the part that differs between the
   * stage and anything else that might one day want to pick.
   */
  pick(ndcX: number, ndcY: number): number | null {
    if (this.disposed) return null
    this.raycaster.setFromCamera(new this.three.Vector2(ndcX, ndcY), this.camera)
    const meshes: THREE.Object3D[] = []
    for (const c of this.cards) {
      if (!c.group.visible) continue
      meshes.push(c.front, c.back)
    }
    const hits = this.raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return null
    // Cards are drawn from a shared pool, so identity is the only way back to
    // an index; the pool is small enough that a scan beats a lookup map.
    const hit = hits[0].object
    for (let i = 0; i < this.cards.length; i++) {
      if (this.cards[i].front === hit || this.cards[i].back === hit) return i
    }
    return null
  }

  /** Ring the chosen card, or clear the ring when given null. */
  setSelected(index: number | null): void {
    if (this.disposed) return
    this.selected = index
    if (!this.outline) {
      const geo = new this.three.EdgesGeometry(new this.three.PlaneGeometry(1, 1))
      const mat = new this.three.LineBasicMaterial({ color: 0x7cf27c, transparent: true, depthTest: false })
      this.outline = new this.three.LineSegments(geo, mat)
      this.outline.renderOrder = 999
    }
    this.outline.removeFromParent()
    if (index === null || !this.cards[index]) return
    // Parented to the card rather than positioned each frame, so the ring
    // follows the card through the animation without a second code path that
    // could lag a frame behind it.
    this.outline.scale.set(this.geometryAspect || 1, 1, 1)
    this.cards[index].group.add(this.outline)
  }

  /**
   * Turn a drag across the frame into a move in the scene.
   *
   * The card is dragged in the plane it already sits in, facing the camera:
   * unprojecting at the card's own depth is what makes it keep pace with the
   * pointer instead of sliding faster the further back it is.
   */
  dragDelta(index: number, fromNdc: [number, number], toNdc: [number, number]): { x: number; y: number; z: number } | null {
    const card = this.cards[index]
    if (this.disposed || !card) return null
    const three = this.three
    const world = card.group.getWorldPosition(new three.Vector3())
    const depth = world.clone().project(this.camera).z
    const at = (ndc: [number, number]): THREE.Vector3 =>
      this.driftGroup.worldToLocal(new three.Vector3(ndc[0], ndc[1], depth).unproject(this.camera))
    const delta = at(toNdc).sub(at(fromNdc))
    return { x: delta.x, y: delta.y, z: delta.z }
  }

  dispose(): void {
    this.disposed = true
    for (const c of this.cards) {
      c.frontMat.dispose()
      c.backMat.dispose()
    }
    for (const t of this.textures.values()) t.dispose()
    this.outline?.geometry.dispose()
    if (this.outline && !Array.isArray(this.outline.material)) this.outline.material.dispose()
    this.cardGeometry?.dispose()
    this.renderer.dispose()
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    if (this.disposed || width <= 0 || height <= 0) return
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /**
   * Point the document at the scene.
   *
   * Meshes are rebuilt only when something structural changed — the number of
   * cards, the card shape, the images. Rebuilding on every parameter tweak
   * would drop a frame each time a slider moved, which is exactly when
   * smoothness matters most.
   */
  setDoc(doc: MotionDoc, cardCount: number): void {
    if (this.disposed) return
    const styleKey = this.styleKey(doc)
    const previous = this.doc ? this.styleKey(this.doc) : null
    this.doc = doc
    const aspect = cardAspect(doc.visual.card)
    if (!this.cardGeometry || this.geometryAspect !== aspect) {
      this.cardGeometry?.dispose()
      this.cardGeometry = new this.three.PlaneGeometry(aspect, 1, BEND_SEGMENTS, BEND_SEGMENTS)
      this.geometryAspect = aspect
      for (const c of this.cards) {
        c.front.geometry = this.cardGeometry
        c.back.geometry = this.cardGeometry
      }
    }
    if (this.cards.length !== cardCount) this.resizeCardPool(cardCount)
    // The pool may have shrunk under the selection, and a ring parented to a
    // discarded card would be discarded with it.
    if (this.selected !== null) {
      this.setSelected(this.selected < this.cards.length ? this.selected : null)
    }
    if (styleKey !== previous) this.refreshTextures(doc)
  }

  private styleKey(doc: MotionDoc): string {
    const c = doc.visual.card
    return [
      c.aspect, c.corner, c.gradient, c.gradientOpacity, c.gradientSide, c.backOpacity,
      c.borderWidth, c.borderColour, c.borderOpacity,
      doc.visual.imageOrder,
      doc.visual.images.map((i) => i.id).join(',')
    ].join('|')
  }

  private resizeCardPool(count: number): void {
    const three = this.three
    while (this.cards.length > count) {
      const c = this.cards.pop()
      if (!c) break
      this.driftGroup.remove(c.group)
      c.frontMat.dispose()
      c.backMat.dispose()
    }
    while (this.cards.length < count) {
      const group = new three.Group()
      const frontMat = new three.MeshBasicMaterial({ transparent: true, side: three.FrontSide, toneMapped: false })
      const backMat = new three.MeshBasicMaterial({ transparent: true, side: three.BackSide, toneMapped: false })
      const bendUniforms = [applyBendShader(frontMat), applyBendShader(backMat)]
      const front = new three.Mesh(this.cardGeometry ?? new three.PlaneGeometry(1, 1), frontMat)
      const back = new three.Mesh(this.cardGeometry ?? new three.PlaneGeometry(1, 1), backMat)
      group.add(front)
      group.add(back)
      this.driftGroup.add(group)
      this.cards.push({ group, front, back, frontMat, backMat, bendUniforms })
    }
    if (this.doc) this.refreshTextures(this.doc)
  }

  /**
   * Register a decoded image so cards can wear it.
   *
   * Loading happens outside the engine because the studio also needs the
   * decoded image for thumbnails and for the library, and decoding the same
   * file twice for two consumers is a visible stall on a large photo.
   */
  /** The source pictures, so overlays drawn in 2D can reach the same images. */
  get sourceImages(): Map<string, HTMLImageElement> {
    return this.images
  }

  setImages(images: Map<string, HTMLImageElement>): void {
    this.images = images
    if (this.doc) {
      this.textures.clear()
      this.refreshTextures(this.doc)
    }
  }

  private refreshTextures(doc: MotionDoc): void {
    const three = this.three
    const imgs = doc.visual.images
    const assignment = imageAssignment(doc, this.cards.length)
    for (let i = 0; i < this.cards.length; i++) {
      const pick = assignment[i]
      const ref = pick >= 0 ? imgs[pick] ?? null : null
      const image = ref ? this.images.get(ref.id) ?? null : null
      for (const side of ['front', 'back'] as const) {
        const key = `${ref?.id ?? 'placeholder'}|${side}|${this.styleKey(doc)}`
        let tex = this.textures.get(key)
        if (!tex) {
          const canvas = document.createElement('canvas')
          drawCardFace(canvas, doc.visual.card, { image, label: 'Surface°', side })
          tex = new three.CanvasTexture(canvas)
          tex.colorSpace = three.SRGBColorSpace
          tex.anisotropy = 4
          this.textures.set(key, tex)
        }
        const mat = side === 'front' ? this.cards[i].frontMat : this.cards[i].backMat
        mat.map = tex
        mat.needsUpdate = true
      }
    }
  }

  /**
   * Draw one frame of the loop.
   *
   * `placements` come from the component, which knows nothing about three.js;
   * everything three-specific happens here so a component stays a page of
   * arithmetic that can be tested without a GPU.
   */
  render(phase: number, placements: CardPlacement[]): void {
    if (this.disposed || !this.doc) return
    const doc = this.doc
    const p = wrap01(phase)

    this.root.position.set(doc.transform.positionX, doc.transform.positionY, 0)
    // Frame gap is padding, and padding on a 3D scene is the piece stepping
    // back from the edges — there is no border to thicken, only room to give.
    const gap = Math.min(90, Math.max(0, doc.frame.gap)) / 100
    this.root.scale.setScalar(Math.max(0.01, doc.transform.scale) * (1 - gap))

    const d = doc.displacement
    // Read through resolvedPose so a keyed tilt moves the camera over the
    // loop. Unkeyed it is doc.pose unchanged, so this costs nothing.
    const pose = resolvedPose(doc, p)
    this.poseGroup.rotation.set(
      degToRad(pose.tiltX),
      degToRad(pose.tiltY),
      degToRad(pose.tiltZ)
    )

    // Displacement is expressed in whole turns per loop for the same reason
    // component speeds are: a partial orbit would leave the scene somewhere
    // else at the end of the loop and the video would jump.
    const orbitTurns = Math.round(d.freeOrbit)
    const panTurns = Math.max(1, Math.round(d.panSpeed))
    const driftPhase = wrap01(p * Math.max(1, Math.round(d.speed)) + d.offset)
    this.driftGroup.rotation.y = orbitTurns !== 0 ? p * TAU * orbitTurns : 0
    this.driftGroup.position.set(
      d.panX !== 0 ? Math.sin(p * TAU * panTurns) * d.panX : 0,
      d.displaceY !== 0 ? Math.sin(driftPhase * TAU) * d.displaceY : 0,
      (d.panZ !== 0 ? Math.cos(p * TAU * panTurns) * d.panZ : 0) +
        (d.displaceZ !== 0 ? Math.sin(driftPhase * TAU) * d.displaceZ : 0)
    )

    const tilt = doc.cardTilt
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i]
      const pl = placements[i]
      if (!pl) { c.group.visible = false; continue }
      c.group.visible = pl.opacity > 0.001
      c.group.position.set(pl.x, pl.y, pl.z + waveAt(d.wave, pl.x, pl.y, p))
      // Card tilt is added on top of whatever the component decided, so it
      // reads as "and also lean them all like this" rather than replacing the
      // arrangement's own orientation.
      const stagger = tilt.stagger ? (i / Math.max(1, this.cards.length - 1)) : 1
      c.group.rotation.set(
        pl.rotX + degToRad(tilt.tiltX) * stagger,
        pl.rotY + degToRad(tilt.tiltY) * stagger,
        pl.rotZ + degToRad(tilt.tiltZ) * stagger
      )
      c.group.scale.setScalar(Math.max(0.001, pl.scale))
      c.frontMat.opacity = pl.opacity
      c.backMat.opacity = pl.opacity
      for (const u of c.bendUniforms) {
        u.bend.value = pl.bend
        u.axis.value = pl.bendAxis === 'horizontal' ? 1 : 0
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  /** Render at a size that is not the on-screen size, for stills and video. */
  renderAtSize(width: number, height: number, phase: number, placements: CardPlacement[]): HTMLCanvasElement {
    const prevSize = { w: this.renderer.domElement.width, h: this.renderer.domElement.height }
    const prevRatio = this.renderer.getPixelRatio()
    // The selection ring is a working aid, not part of the piece, so it never
    // reaches a file.
    const ringParent = this.outline?.parent ?? null
    this.outline?.removeFromParent()
    this.setSize(width, height, 1)
    this.render(phase, placements)
    if (ringParent && this.outline) ringParent.add(this.outline)
    const out = this.renderer.domElement
    // The caller copies before the next resize; returning the live canvas
    // rather than a clone keeps a 4K export from allocating a second buffer
    // per frame, which is what makes long exports run out of memory.
    void prevSize
    void prevRatio
    return out
  }
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180
}
