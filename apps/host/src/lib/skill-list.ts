import { knownTranslation, tr } from './i18n';
import { DISCOVER_SKILLS } from './discover-catalog';
import type { Skill } from './types';

/** The name shown for a skill: built-in copy follows the language, a name the person gave stays as written. */
export const skillName = (s: Skill) => s.source === 'bundled' ? tr(s.name) : s.name;

/** Known interface copy follows the language; a description the person wrote stays exactly as written. */
export const skillDescription = (s: Skill) => s.source === 'bundled' ? tr(s.description) : (knownTranslation(s.description) ?? s.description);

/** What the Skills screen lists for a search: the installed skills that match, and the recommendations not installed yet. */
export function skillRows(skills: Skill[], query: string) {
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = (...parts: string[]) => parts.join(' ').toLowerCase().includes(needle);
  const recommended = DISCOVER_SKILLS.filter(s => !skills.some(x => x.id === `my-${s.id}` || x.name.toLowerCase() === s.name.toLowerCase()));
  const visible = skills.filter(s => matches(skillName(s), skillDescription(s), s.triggers.join(' ')));
  const visibleRecommended = recommended.filter(s => matches(s.name, tr(s.description), s.triggers.join(' '), tr(s.requires)));
  return { visible, visibleRecommended, searching, hasResults: visible.length > 0 || visibleRecommended.length > 0 };
}
