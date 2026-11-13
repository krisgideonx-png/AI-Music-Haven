export interface StoryPromptInput {
  title?: string;
  creator?: string;
  genre?: string;
  subgenre?: string;
  mood?: string;
  aiToolOrigin?: string;
  description?: string;
  lyrics?: string;
}

export function extractLyricalHighlights(lyrics?: string): string[] {
  if (!lyrics || !lyrics.trim()) return [];
  const lines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 3 && !/^\[.*\]$/.test(line) && !/^\(.*\)$/.test(line));
  return lines.slice(0, 3).map((line) => line.slice(0, 120));
}

export function buildStoryGenerationPrompt(input: StoryPromptInput): string {
  const title = (input.title || 'Untitled Track').trim().slice(0, 120);
  const creator = (input.creator || 'Haven Creator').trim().slice(0, 80);
  const genre = (input.genre || 'Electronic').trim().slice(0, 60);
  const subgenre = (input.subgenre || '').trim().slice(0, 60);
  const mood = (input.mood || 'Atmospheric').trim().slice(0, 60);
  const aiToolOrigin = (input.aiToolOrigin || 'AI Music Studio').trim().slice(0, 60);
  const description = (input.description || '').trim().slice(0, 1000);
  const lyrics = (input.lyrics || '').trim().slice(0, 4000);

  return [
    'You are the editorial storyteller for AI Music Haven ("Where AI Music Finds Its Home").',
    'Write a warm, authentic 2 to 4 sentence "Story Behind the Song" for the listener dossier of an already completed song.',
    'Base the story directly on BOTH the creator description and the song lyrics (weaving in the lyrical themes, imagery, and emotional arc when lyrics are supplied).',
    'Do NOT mention DAW tweaking, stem editing, or audio generation prompts.',
    'Return plain text only (no markdown headings, no quotes around the full response, max 700 characters).',
    '',
    `Song Title: ${title}`,
    `Creator: ${creator}`,
    `Genre: ${genre}${subgenre ? ` / ${subgenre}` : ''}`,
    `Mood: ${mood}`,
    `Origin Tool: ${aiToolOrigin}`,
    `Song Description: ${description || 'Completed release shared with the community'}`,
    `Song Lyrics: ${lyrics || 'Instrumental / no lyrics provided'}`,
  ].join('\n');
}

export function buildFallbackStory(input: StoryPromptInput): string {
  const title = (input.title || 'Untitled Track').trim().slice(0, 120);
  const creator = (input.creator || 'Haven Creator').trim().slice(0, 80);
  const genre = (input.genre || 'Electronic').trim().slice(0, 60);
  const subgenre = (input.subgenre || '').trim().slice(0, 60);
  const moodLower = (input.mood || 'Atmospheric').trim().toLowerCase();
  const aiToolOrigin = (input.aiToolOrigin || 'AI Music Studio').trim().slice(0, 60);
  const description = (input.description || '').trim();
  const highlights = extractLyricalHighlights(input.lyrics);

  const styleLabel = subgenre ? `${genre} (${subgenre})` : genre;
  const descClause = description
    ? `, rooted in ${description.charAt(0).toLowerCase() + description.slice(1).replace(/\.+$/, '')}`
    : '';
  const lyricClause =
    highlights.length > 0
      ? ` Its lyrics echo themes like "${highlights[0].replace(/"/g, '')}"${
          highlights[1] ? ` and "${highlights[1].replace(/"/g, '')}"` : ''
        }, turning personal reflection into a cohesive narrative.`
      : '';

  return `Shaped during a focused creative session, "${title}" reflects ${creator}'s pursuit of ${moodLower} ${styleLabel} storytelling${descClause}.${lyricClause} Archived in AI Music Haven in its original master crafted with ${aiToolOrigin}.`.slice(
    0,
    1400
  );
}
