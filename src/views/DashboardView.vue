<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useJobs } from '@/composables/useJobs';
import { useJobFilter } from '@/composables/useJobFilter';
import { useFilterStore } from '@/stores/jobStore';
import { storeToRefs } from 'pinia';
import JobCard from '@/components/JobCard.vue';
import FilterBar from '@/components/FilterBar.vue';
import SkeletonCard from '@/components/SkeletonCard.vue';

const { jobs, needsReview, fetchedAt, loading, error, load } = useJobs();
const filterStore = useFilterStore();
const { filters } = storeToRefs(filterStore);

const visible = useJobFilter(jobs, filters);
const visibleNeedsReview = useJobFilter(needsReview, filters);
const showNeedsReview = ref(false);

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
    <!-- Top Navigation Bar -->
    <header class="sticky top-0 z-50 border-b border-border/30 bg-surface">
      <nav class="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-8 py-4">
        <div class="flex flex-col">
          <span class="font-serif text-2xl font-bold leading-none text-ink-900">vuenture</span>
          <span class="-mt-0.5 text-[10px] font-bold uppercase tracking-widest text-ink-500/70">
            The Digital Surgeon
          </span>
        </div>
        <div class="flex items-center gap-4">
          <div
            class="hidden items-center gap-2 rounded-full border border-border/30 bg-surface-low px-3 py-1.5 md:flex"
          >
            <span class="text-[11px] font-medium tabular-nums text-ink-500">
              Last refreshed: {{ fetchedRelative }} · {{ visible.length }}/{{ jobs.length }} shown
            </span>
          </div>
          <button
            class="rounded-lg p-2 text-ink-500 transition-colors hover:bg-canvas disabled:opacity-50"
            :disabled="loading"
            :title="loading ? 'Refreshing…' : 'Refresh'"
            @click="load"
          >
            <span class="material-symbols-outlined" :class="loading ? 'animate-spin' : ''">refresh</span>
          </button>
        </div>
      </nav>
    </header>

    <main class="mx-auto max-w-screen-2xl px-8 py-10">
      <!-- Page header + filters -->
      <div class="mb-12">
        <div class="mb-8">
          <h1 class="mb-2 text-4xl font-bold tracking-tight text-ink-900">
            Vue.js remote jobs, triaged
          </h1>
          <p class="max-w-xl leading-relaxed text-ink-500">
            High-context engineering roles for the modern Vue ecosystem.
            No clutter, just the signal. Scored by surgical precision.
          </p>
        </div>
        <FilterBar />
      </div>

      <!-- Error -->
      <div v-if="error" class="rounded-xl border border-must/30 bg-must/5 p-4 text-sm text-must">
        Failed to load jobs: {{ error }}. The daily GitHub Action may not have run yet.
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard v-for="n in 6" :key="n" />
      </div>

      <!-- Empty -->
      <div
        v-else-if="visible.length === 0"
        class="rounded-xl border-2 border-dashed border-border bg-surface p-16 text-center"
      >
        <p class="text-lg font-medium text-ink-700">No matches right now</p>
        <p class="mt-2 text-sm text-ink-500">
          Try relaxing the optional filters above, or wait for the next daily fetch (09:00 CET).
        </p>
      </div>

      <!-- Grid -->
      <div v-else class="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <JobCard v-for="job in visible" :key="job.id" :job="job" />
      </div>

      <!-- Needs Review -->
      <section v-if="!loading && !error && visibleNeedsReview.length" class="opacity-70">
        <button
          class="group mb-6 flex w-full items-center justify-between border-b border-border/30 pb-4 text-left"
          @click="showNeedsReview = !showNeedsReview"
        >
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold text-ink-900">Needs Review</h2>
            <span class="rounded-full bg-canvas px-2 py-0.5 text-xs font-bold tabular-nums text-ink-500">
              {{ visibleNeedsReview.length }}
            </span>
          </div>
          <span
            class="material-symbols-outlined text-ink-500 transition-transform group-hover:text-ink-700"
            :class="showNeedsReview ? 'rotate-180' : ''"
          >expand_more</span>
        </button>
        <div
          v-if="showNeedsReview"
          class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
        >
          <JobCard v-for="job in visibleNeedsReview" :key="job.id" :job="job" />
        </div>
      </section>
    </main>

    <footer
      class="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-6 border-t border-border/20 px-8 py-12 md:flex-row"
    >
      <div class="flex flex-col gap-1">
        <span class="font-serif text-xl font-bold text-ink-900">vuenture</span>
        <span class="text-xs font-medium text-ink-500/70">
          The Digital Surgeon for Senior Vue Developers.
        </span>
      </div>
      <div class="flex items-center gap-6 text-sm font-medium text-ink-500">
        <a
          href="https://github.com/aljacket"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-brand-700"
        >GitHub</a>
        <span class="text-ink-500/40">|</span>
        <span class="italic text-ink-500/70">scored by Claude</span>
      </div>
    </footer>
  </div>
</template>
