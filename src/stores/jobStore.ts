import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { FilterState } from '@/types/job';

export const useFilterStore = defineStore('filters', () => {
  const filters = ref<FilterState>({
    salaryFilter: false,
    typescriptRequired: false,
    aiToolingBonus: false,
    capacitorBonus: false,
  });

  function toggle(key: keyof FilterState) {
    filters.value[key] = !filters.value[key];
  }

  return { filters, toggle };
});
