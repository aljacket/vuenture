<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useJobs } from '@/composables/useJobs';
import { useJobFilter } from '@/composables/useJobFilter';
import { useFilterStore } from '@/stores/jobStore';
import { storeToRefs } from 'pinia';
import JobCard from '@/components/JobCard.vue';
import FilterBar from '@/components/FilterBar.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';

const { jobs, fetchedAt, loading, error, load } = useJobs();
const filterStore = useFilterStore();
const { filters } = storeToRefs(filterStore);

const visible = useJobFilter(jobs, filters);

const fetchedRelative = computed(() => {
  if (!fetchedAt.value) return '—';
  const ms = Date.now() - new Date(fetchedAt.value).getTime();
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
});

onMounted(load);
</script>

<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-ink-900">
            vuenture <span class="text-brand-600">·</span>
            <span class="text-sm font-normal text-slate-500">Vue.js remote jobs, triaged</span>
          </h1>
          <p class="mt-0.5 text-xs text-slate-500">
            Last refreshed: {{ fetchedRelative }} · {{ visible.length }} / {{ jobs.length }} shown
          </p>
        </div>
        <button
          class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-600 hover:text-brand-600 disabled:opacity-50"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
      <div class="mx-auto max-w-6xl px-6 pb-4">
        <FilterBar />
      </div>
    </header>

    <!-- Body -->
    <main class="mx-auto max-w-6xl px-6 py-8">
      <!-- Error -->
      <div v-if="error" class="rounded-xl border border-must/30 bg-must/5 p-4 text-sm text-must">
        Failed to load jobs: {{ error }}. The daily GitHub Action may not have run yet.
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard v-for="n in 6" :key="n" />
      </div>

      <!-- Empty -->
      <div v-else-if="visible.length === 0" class="rounded-xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
        <p class="text-lg font-medium text-slate-700">No matches right now</p>
        <p class="mt-2 text-sm text-slate-500">
          Try relaxing the optional filters above, or wait for the next daily fetch (09:00 CET).
        </p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <JobCard v-for="job in visible" :key="job.id" :job="job" />
      </div>
    </main>

    <footer class="mx-auto max-w-6xl px-6 pb-10 pt-6 text-center text-xs text-slate-500">
      vuenture · built for Alfonso Cavalieri · scored by
      <a href="https://claude.com/claude-code" class="underline hover:text-brand-600">Claude</a>
    </footer>
  </div>
</template>
