<script setup lang="ts">
import { computed } from 'vue';
import type { Job } from '@/types/job';
import { useBookmarks } from '@/composables/useBookmarks';

const props = defineProps<{ job: Job }>();
const { isBookmarked, toggle } = useBookmarks();

const scoreClass = computed(() => {
  const s = props.job.score.overall;
  if (s >= 80) return 'bg-brand-600 text-white';
  if (s >= 60) return 'bg-nice text-white';
  if (s >= 40) return 'bg-warn text-white';
  return 'bg-slate-400 text-white';
});

const relativeDate = computed(() => {
  const ms = Date.now() - new Date(props.job.postedAt).getTime();
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
});

const salary = computed(() => {
  const { salaryMin, salaryMax } = props.job;
  if (salaryMin == null && salaryMax == null) return null;
  const fmt = (n: number) => `€${Math.round(n / 1000)}K`;
  if (salaryMin && salaryMax) return `${fmt(salaryMin)}–${fmt(salaryMax)}`;
  return fmt((salaryMin ?? salaryMax)!);
});
</script>

<template>
  <article class="group flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-600/30">
    <!-- Header: score + bookmark -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          :class="scoreClass"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold"
        >
          {{ job.score.overall }}
        </div>
        <div class="min-w-0 flex-1">
          <h3
            class="line-clamp-2 text-base font-semibold leading-snug text-ink-900"
            :title="job.title"
          >
            {{ job.title }}
          </h3>
          <p class="mt-0.5 truncate text-sm text-slate-600">
            {{ job.company }} ·
            {{ job.remotePolicy === 'remote' ? 'Remote' : job.location }}
          </p>
        </div>
      </div>
      <button
        class="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-brand-100 hover:text-brand-600"
        :aria-pressed="isBookmarked(job.id)"
        @click="toggle(job.id)"
      >
        <svg v-if="isBookmarked(job.id)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-brand-600">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.447a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.051 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </button>
    </div>

    <!-- Reason -->
    <p class="mt-3 text-sm leading-relaxed text-slate-700">{{ job.score.reason }}</p>

    <!-- Red flags -->
    <div v-if="job.score.red_flags.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="flag in job.score.red_flags"
        :key="flag"
        class="rounded-full bg-must/10 px-2 py-0.5 text-xs font-medium text-must"
      >
        ⚠ {{ flag }}
      </span>
    </div>

    <!-- Meta row -->
    <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span class="rounded bg-brand-100 px-2 py-0.5 font-medium text-brand-600">{{ job.remotePolicy }}</span>
      <span>{{ relativeDate }}</span>
      <span v-if="salary" class="font-medium text-nice">{{ salary }}</span>
      <span v-else class="italic">salary unknown</span>
    </div>

    <!-- Tags -->
    <div v-if="job.tags.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="tag in job.tags"
        :key="tag"
        class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
      >{{ tag }}</span>
    </div>

    <!-- CTA -->
    <a
      :href="job.applyUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
    >
      Apply →
    </a>
  </article>
</template>
