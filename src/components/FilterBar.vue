<script setup lang="ts">
import { computed } from 'vue';
import { useFilterStore } from '@/stores/jobStore';
import type { FilterState } from '@/types/job';

const store = useFilterStore();

interface Chip {
  key: keyof FilterState;
  label: string;
  hint: string;
  icon?: string;
}

const chips = computed<Chip[]>(() => [
  { key: 'salaryFilter', label: 'Salary ≥ 45K', hint: 'Within salary range (or unknown)' },
  { key: 'typescriptRequired', label: 'TypeScript', hint: 'TS explicitly required' },
  { key: 'aiToolingBonus', label: 'AI tooling', hint: 'Claude / Copilot / LLM mentioned' },
  { key: 'capacitorBonus', label: 'Capacitor / Ionic', hint: 'Mobile stack bonus' },
  { key: 'bookmarkedOnly', label: 'Bookmarked', hint: 'Only saved jobs', icon: 'bookmark' },
]);

const activeKeys = computed(() =>
  chips.value.filter((c) => store.filters[c.key]).map((c) => c.key),
);

function clearAll() {
  activeKeys.value.forEach((key) => store.toggle(key));
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
      <span v-if="chip.icon" class="material-symbols-outlined text-sm">{{ chip.icon }}</span>
      <span>{{ chip.label }}</span>
      <span v-if="store.filters[chip.key]" class="material-symbols-outlined text-xs">close</span>
    </button>
    <div class="flex-grow" />
    <button
      v-if="activeKeys.length"
      class="px-2 text-sm font-semibold text-brand-700 hover:underline"
      @click="clearAll"
    >
      Clear all filters
    </button>
  </div>
</template>
