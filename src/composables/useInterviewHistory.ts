import { computed, ref, watch } from 'vue';
import type { InterviewEntry } from '@/types/job';
import { normalize } from '@/utils/normalize';

const STORAGE_KEY = 'vuenture:interviewHistory';

const SEED_REEDSY: InterviewEntry = {
  reason: 'Frontend architecture depth (hexagonal/DDD) — under study',
  markedAt: new Date().toISOString(),
};

type Store = Record<string, InterviewEntry>;

function loadAndMaybeSeed(): Store {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in private mode / SSR — treat as missing.
    return {};
  }
  // First-launch seeding: ONLY when the key is genuinely absent. An empty
  // object means "user cleared everything" — must be respected.
  if (raw === null) {
    const seeded: Store = { reedsy: { ...SEED_REEDSY } };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      /* swallow — seeding is best-effort */
    }
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Store;
    }
  } catch {
    /* fall through */
  }
  return {};
}

const entries = ref<Store>(loadAndMaybeSeed());

watch(
  entries,
  (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* swallow */
    }
  },
  { deep: true }
);

const count = computed(() => Object.keys(entries.value).length);

function mark(company: string, reason: string) {
  const key = normalize(company);
  if (!key) return;
  entries.value = {
    ...entries.value,
    [key]: { reason: reason ?? '', markedAt: new Date().toISOString() },
  };
}

function unmark(company: string) {
  const key = normalize(company);
  if (!key) return;
  if (!(key in entries.value)) return;
  const next = { ...entries.value };
  delete next[key];
  entries.value = next;
}

function isInterviewed(company: string): boolean {
  const key = normalize(company);
  if (!key) return false;
  return key in entries.value;
}

function getEntry(company: string): InterviewEntry | undefined {
  const key = normalize(company);
  if (!key) return undefined;
  return entries.value[key];
}

export function useInterviewHistory() {
  return { entries, count, mark, unmark, isInterviewed, getEntry };
}
