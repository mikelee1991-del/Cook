import { formatStructuredRecipe } from './recipeFormat';
import type { SortedClip } from './recipeSort';

export interface RawVisionRecipe {
  title?: string;
  ingredients?: string[];
  directions?: string[];
  notes?: string;
}

export interface RawVisionPage {
  recipes?: RawVisionRecipe[];
  other?: Array<{ title?: string; text?: string }>;
}

function clipId(prefix: string, n: number): string {
  return `${prefix}-${n}-${Math.random().toString(36).slice(2, 7)}`;
}

export function clipsFromVisionPage(page: RawVisionPage, sourceImageIndex: number): SortedClip[] {
  const clips: SortedClip[] = [];
  const recipes = Array.isArray(page.recipes) ? page.recipes : [];
  recipes.forEach((recipe, i) => {
    const formatted = formatStructuredRecipe({
      title: recipe.title,
      ingredients: recipe.ingredients,
      directions: recipe.directions,
      notes: recipe.notes,
    });
    if (!formatted.body.trim()) return;
    clips.push({
      id: clipId(`img${sourceImageIndex}-r`, i),
      kind: 'recipe',
      title: formatted.title,
      body: formatted.body,
      confidence: 0.94,
      sourceImageIndex,
    });
  });

  const other = Array.isArray(page.other) ? page.other : [];
  other.forEach((row, i) => {
    const body = (row.text || '').trim();
    if (body.length < 8) return;
    clips.push({
      id: clipId(`img${sourceImageIndex}-o`, i),
      kind: 'other',
      title: (row.title || '').trim() || 'Other text',
      body,
      confidence: 0.4,
      sourceImageIndex,
    });
  });

  return clips;
}

export const RECIPE_VISION_PROMPT = `You read a recipe photo (cookbook page, index card, screenshot, or handwriting).

Do NOT transcribe with naive OCR. Look at the whole document:
- Which way the page faces; mentally rotate if needed
- Two-column cards, colored bands, photos of the dish vs the cooking text
- Print vs handwriting vs mixed
- Multiple recipes on one page — split them into separate recipes
- Leftover text from a neighboring recipe at the edge — drop it
- Titles, ingredient lists (including quantities), numbered or prose directions, notes/yield
- Crossed-out lines, decorations, and headers like Ingredients / Directions / Method / Preparation

Return cookable structure, not a dump of characters. Keep original measures. If a page is not a recipe, put any useful text in other and leave recipes empty.

Return JSON:
{"recipes":[{"title":"","ingredients":[""],"directions":[""],"notes":""}],"other":[{"title":"","text":""}]}
`;
