// Starter recipes — stripped for public release.
// Add your own design recipes (palettes, fonts, layouts) here.

export type StarterRecipe = {
  slug: string
  kinds: string[]
  industries: string[]
  mood: string
  palette: { bg: string; surface: string; primary: string; text: string; accent?: string }
  font: string
  radius: 'sharp' | 'small' | 'medium' | 'large'
  surface: 'dark' | 'light'
  sections: string[]
}

const _RECIPES: StarterRecipe[] = []

export function pickRecipes(_idea: string, _kind: string): StarterRecipe[] {
  return []
}

export function formatRecipesForPrompt(_recipes: StarterRecipe[]): string {
  return ''
}
