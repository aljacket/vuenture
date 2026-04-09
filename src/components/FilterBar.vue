<script setup lang="ts">
import { computed } from 'vue';
import { useFilterStore } from '@/stores/jobStore';
import type { FilterState } from '@/types/job';

const store = useFilterStore();

const chips = computed<Array<{ key: keyof FilterState; label: string; hint: string }>>(() => [
  { key: 'salaryFilter', label: 'Salary ≥ 45K', hint: 'Within salary range (or unknown)' },
  { key: 'typescriptRequired', label: 'TypeScript', hint: 'TS explicitly required' },
  { key: 'aiToolingBonus', label: 'AI tooling', hint: 'Claude / Copilot / LLM mentioned' },
  { key: 'capacitorBonus', label: 'Capacitor / Ionic', hint: 'Mobile stack bonus' },
]);

const hasActive = computed(() =>
  chips.value.some((c) => store.filters[c.key]),
);

function clearAll() {
  chips.value.forEach((c) => {
    if (store.filters[c.key]) store.toggle(c.key);
  });
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="chip in chips"
      :key="chip.key"
      :title="chip.hint"
      class="flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
      :class="
        store.filters[chip.key]
          ? 'bg-brand-500 text-white shadow-sm'
          : 'border border-border/60 bg-surface text-ink-700 hover:bg-canvas'
      "
      @click="store.toggle(chip.key)"
    >
      <span>{{ chip.label }}</span>
      <span v-if="store.filters[chip.key]" class="material-symbols-outlined text-xs">close</span>
    </button>
    <div class="flex-grow" />
    <button
      v-if="hasActive"
      class="px-2 text-sm font-semibold text-brand-700 hover:underline"
      @click="clearAll"
    >
      Clear all filters
    </button>
  </div>
</template>
