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

const RECIPES: StarterRecipe[] = []

export function pickRecipes(idea: string, kind: string): StarterRecipe[] {
  return []
}

export function formatRecipesForPrompt(recipes: StarterRecipe[]): string {
  return ''
}
