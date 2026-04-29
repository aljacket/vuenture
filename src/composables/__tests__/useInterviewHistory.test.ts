import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'vuenture:interviewHistory';

async function freshComposable() {
  // Each test exercises a different localStorage starting state, so we
  // must re-import the module to re-run its top-level loadAndMaybeSeed().
  vi.resetModules();
  const mod = await import('../useInterviewHistory');
  return mod.useInterviewHistory();
}

describe('useInterviewHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('seeds Reedsy on first launch when storage is absent', async () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    const { isInterviewed, getEntry, count } = await freshComposable();
    expect(isInterviewed('Reedsy')).toBe(true);
    expect(getEntry('Reedsy')?.reason).toMatch(/architecture/i);
    expect(getEntry('Reedsy')?.markedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(count.value).toBe(1);
    // Seed must be persisted so the next reload doesn't treat it as fresh.
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('does NOT seed when storage exists as an empty object', async () => {
    localStorage.setItem(STORAGE_KEY, '{}');
    const { isInterviewed, count } = await freshComposable();
    expect(isInterviewed('Reedsy')).toBe(false);
    expect(count.value).toBe(0);
  });

  it('mark + unmark roundtrip persists to localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, '{}');
    const { mark, unmark, isInterviewed } = await freshComposable();

    mark('Globant', 'agency vibe');
    await new Promise((r) => setTimeout(r, 0)); // let the watcher flush
    expect(isInterviewed('Globant')).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveProperty('globant');

    unmark('Globant');
    await new Promise((r) => setTimeout(r, 0));
    expect(isInterviewed('Globant')).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).not.toHaveProperty('globant');
  });

  it('matches companies via normalized lookup', async () => {
    localStorage.setItem(STORAGE_KEY, '{}');
    const { mark, isInterviewed } = await freshComposable();
    mark('Too Good To Go', '');
    expect(isInterviewed('too good to go')).toBe(true);
    expect(isInterviewed('TOO  GOOD  TO  GO')).toBe(true);
    expect(isInterviewed('TooGoodToGo')).toBe(false); // no separator → different normalized form
  });

  it('ignores empty company strings', async () => {
    localStorage.setItem(STORAGE_KEY, '{}');
    const { mark, count } = await freshComposable();
    mark('   ', 'anything');
    expect(count.value).toBe(0);
  });
});
