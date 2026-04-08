<script setup lang="ts">
import { computed } from 'vue';
import { useFilterStore } from '@/stores/jobStore';
import type { FilterState } from '@/types/job';

const store = useFilterStore();

const chips = computed<Array<{ key: keyof FilterState; label: string; hint: string }>>(() => [
  { key: 'salaryFilter', label: '€45–80K', hint: 'Within salary range (or unknown)' },
  { key: 'typescriptRequired', label: 'TypeScript', hint: 'TS explicitly required' },
  { key: 'aiToolingBonus', label: 'AI tooling', hint: 'Claude / Copilot / LLM mentioned' },
  { key: 'capacitorBonus', label: 'Capacitor / Ionic', hint: 'Mobile stack bonus' },
]);
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="chip in chips"
      :key="chip.key"
      :title="chip.hint"
      class="rounded-full border px-4 py-1.5 text-sm font-medium transition"
      :class="
        store.filters[chip.key]
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-700 hover:border-brand-600 hover:text-brand-600'
      "
      @click="store.toggle(chip.key)"
    >
      {{ chip.label }}
    </button>
  </div>
</template>
