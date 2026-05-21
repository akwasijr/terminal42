import { useState } from 'react'
import { DesignChatRail } from './DesignChatRail'
import { DesignCanvas } from './DesignCanvas'
import { ResizeHandle } from './ResizeHandle'

const LS_RAIL_WIDTH = 't42:design:rail:width'

export function DesignWorkspace({
  designId,
  title,
  onRename,
  onClose
}: {
  designId: string
  title: string
  onRename: (newTitle: string) => void
  onClose: () => void
}): JSX.Element {
  const [railWidth, setRailWidth] = useState<number>(() => {
    try { return Math.max(320, Math.min(640, Number(localStorage.getItem(LS_RAIL_WIDTH)) || 420)) } catch { return 420 }
  })

  const persistWidth = (w: number): void => {
    setRailWidth(w)
    try { localStorage.setItem(LS_RAIL_WIDTH, String(w)) } catch {}
  }

  // The dedicated header row (back / title / close) is gone — those
  // controls now live in `DesignCanvas`'s toolbar, on the same line as
  // the viewport / annotate / edit / export buttons. Title + onRename +
  // onClose are forwarded to the canvas.
  return (
    <div className="flex h-full w-full flex-col bg-bg">
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: railWidth }} className="shrink-0">
          <DesignChatRail designId={designId} />
        </div>
        <ResizeHandle side="left" currentWidth={railWidth} onChange={persistWidth} min={320} max={640} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DesignCanvas
            designId={designId}
            title={title}
            onRename={onRename}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  )
}
