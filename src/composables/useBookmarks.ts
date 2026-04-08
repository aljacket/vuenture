import { ref, watch } from 'vue';

const STORAGE_KEY = 'vuenture:bookmarks';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

const bookmarks = ref<Set<string>>(load());

watch(
  bookmarks,
  (set) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  },
  { deep: true }
);

export function useBookmarks() {
  function toggle(id: string) {
    const next = new Set(bookmarks.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    bookmarks.value = next;
  }
  function isBookmarked(id: string) {
    return bookmarks.value.has(id);
  }
  return { bookmarks, toggle, isBookmarked };
}
