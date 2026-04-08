import { LEADERBOARD_LIMIT } from './config.js';

const NAME_REGEX = /^[A-Z]{3}$/;

const sanitizeInitials = (value) =>
  (value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);

export class LeaderboardStore {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  getEntries() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          initials: sanitizeInitials(entry.initials),
          score: Number(entry.score) || 0,
          createdAt: Number(entry.createdAt) || Date.now()
        }))
        .filter((entry) => NAME_REGEX.test(entry.initials))
        .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
        .slice(0, LEADERBOARD_LIMIT);
    } catch {
      return [];
    }
  }

  qualifies(score) {
    const entries = this.getEntries();
    if (entries.length < LEADERBOARD_LIMIT) return true;
    return score > entries[entries.length - 1].score;
  }

  addEntry(initials, score) {
    const normalizedInitials = sanitizeInitials(initials);
    if (!NAME_REGEX.test(normalizedInitials)) {
      throw new Error('Initials must be exactly three letters.');
    }

    const newEntry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      initials: normalizedInitials,
      score: Number(score) || 0,
      createdAt: Date.now()
    };

    const next = [...this.getEntries(), newEntry]
      .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)
      .slice(0, LEADERBOARD_LIMIT);

    localStorage.setItem(this.storageKey, JSON.stringify(next));

    const rank = next.findIndex((entry) => entry.id === newEntry.id);
    return {
      entries: next,
      rank,
      entry: newEntry,
      inserted: rank >= 0
    };
  }
}

export function normalizeInitialsInput(value) {
  return sanitizeInitials(value);
}
