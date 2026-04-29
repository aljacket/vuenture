import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { FilterState } from '@/types/job';
import { useInterviewHistory } from '@/composables/useInterviewHistory';

export const useFilterStore = defineStore('filters', () => {
  // Default `hideInterviewed` based on the current interview-history state:
  // ON when there's anything to hide, OFF on a clean slate. The user can
  // toggle either way after that.
  const { count: interviewCount } = useInterviewHistory();

  const filters = ref<FilterState>({
    salaryFilter: false,
    typescriptRequired: false,
    aiToolingBonus: false,
    capacitorBonus: false,
    bookmarkedOnly: false,
    hideInterviewed: interviewCount.value > 0,
  });

  function toggle(key: keyof FilterState) {
    filters.value[key] = !filters.value[key];
  }

  return { filters, toggle };
});
