// A tiny shared handle so the canvas's global Delete/Backspace handler can defer to
// the timeline when a keyframe is selected (delete the keyframe, not the object).
// The TimelinePanel sets this while a keyframe is selected and clears it otherwise.
export const timelineKeyframeSel: { current: { delete: () => void; deselect: () => void } | null } = { current: null }
