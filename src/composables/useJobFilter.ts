import { computed, type Ref } from 'vue';
import type { Job, FilterState } from '@/types/job';
import { PROFILE } from '@/config/profile';
import { useBookmarks } from '@/composables/useBookmarks';
import { useInterviewHistory } from '@/composables/useInterviewHistory';

export function useJobFilter(jobs: Ref<Job[]>, filters: Ref<FilterState>) {
  const { isBookmarked } = useBookmarks();
  const { isInterviewed } = useInterviewHistory();
  return computed<Job[]>(() => {
    return jobs.value.filter((j) => {
      if (filters.value.bookmarkedOnly && !isBookmarked(j.id)) return false;

      const desc = j.rawDescription.toLowerCase();

      if (filters.value.salaryFilter) {
        const { minEUR, maxEUR } = PROFILE.salary;
        if (j.salaryMin != null && j.salaryMax != null) {
          if (j.salaryMax < minEUR || j.salaryMin > maxEUR) return false;
        }
        // Unknown salaries pass through — tagged with a "salary unknown" badge.
      }

      if (filters.value.typescriptRequired && !desc.includes('typescript')) {
        return false;
      }

      if (filters.value.aiToolingBonus) {
        const ai = /claude|copilot|cursor|llm|\bmcp\b|ai.assisted|windsurf/.test(desc);
        if (!ai) return false;
      }

      if (filters.value.capacitorBonus) {
        if (!/capacitor|ionic/.test(desc)) return false;
      }

      // F9 — hide companies Alfonso has already interviewed with (and didn't
      // continue). Reactive via useInterviewHistory's shared `entries` ref.
      if (filters.value.hideInterviewed && isInterviewed(j.company)) {
        return false;
      }

      return true;
    });
  });
}
