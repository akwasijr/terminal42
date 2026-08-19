import type { GoalQualityAnalysis } from '../../../shared/goalQuality'

export function GoalHint({
  analysis,
  onDismiss
}: {
  analysis: GoalQualityAnalysis
  onDismiss: () => void
}): JSX.Element | null {
  const suggestions = analysis.suggestions.slice(0, 2)
  if (suggestions.length === 0) return null

  return (
    <aside className="mb-2 rounded-lg bg-sunken p-3 text-[12px] text-text-secondary" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">This goal may be hard to measure ({analysis.score}/100).</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss goal hint"
          className="rounded-md px-2 py-1 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:bg-elevated focus-visible:text-text-primary"
        >
          Dismiss
        </button>
      </div>
    </aside>
  )
}
