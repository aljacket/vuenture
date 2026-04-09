<script setup lang="ts">
import { computed } from 'vue';
import type { Job } from '@/types/job';
import { useBookmarks } from '@/composables/useBookmarks';

const props = defineProps<{ job: Job }>();
const { isBookmarked, toggle } = useBookmarks();

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

const locationLabel = computed(() =>
  props.job.remotePolicy === 'remote' ? 'Remote' : props.job.location,
);
</script>

<template>
  <article
    class="flex flex-col rounded-xl border border-border/60 bg-surface p-6 transition-all hover:border-brand-500/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
  >
    <!-- Top row: score badge + bookmark -->
    <div class="mb-4 flex items-start justify-between">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500/10"
      >
        <span class="text-lg font-bold tabular-nums text-brand-600">{{ job.score.overall }}</span>
      </div>
      <button
        class="text-ink-500/60 transition-colors hover:text-brand-600"
        :aria-pressed="isBookmarked(job.id)"
        @click="toggle(job.id)"
      >
        <span
          class="material-symbols-outlined"
          :class="isBookmarked(job.id) ? 'text-brand-600' : ''"
          :style="isBookmarked(job.id) ? { fontVariationSettings: `'FILL' 1` } : {}"
        >bookmark</span>
      </button>
    </div>

    <!-- Title + company -->
    <div class="mb-4">
      <h3
        class="mb-1 text-lg font-bold leading-snug tracking-tight text-ink-900 line-clamp-2"
        :title="job.title"
      >
        {{ job.title }}
      </h3>
      <p class="truncate text-sm font-medium text-ink-500">
        {{ job.company }} · {{ locationLabel }}
      </p>
    </div>

    <!-- Reason (Claude scoring explanation, muted) -->
    <p class="mb-4 text-sm leading-relaxed text-ink-700 line-clamp-3">
      {{ job.score.reason }}
    </p>

    <!-- Meta row -->
    <div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-ink-500/80">
      <span class="flex items-center gap-1 uppercase tracking-wider">
        <span class="material-symbols-outlined text-xs">public</span>
        {{ job.remotePolicy }}
      </span>
      <span class="flex items-center gap-1 uppercase tracking-wider tabular-nums">
        <span class="material-symbols-outlined text-xs">schedule</span>
        {{ relativeDate }}
      </span>
      <span v-if="salary" class="font-bold tabular-nums text-brand-600">{{ salary }}</span>
      <span v-else class="italic">salary unknown</span>
    </div>

    <!-- Red flags (kept for Claude-flagged warnings) -->
    <div v-if="job.score.red_flags.length" class="mb-4 flex flex-wrap gap-1.5">
      <span
        v-for="flag in job.score.red_flags"
        :key="flag"
        class="rounded bg-must/10 px-2 py-0.5 text-[11px] font-semibold text-must"
      >
        ⚠ {{ flag }}
      </span>
    </div>

    <!-- Tags -->
    <div v-if="job.tags.length" class="mb-8 flex flex-wrap gap-2">
      <span
        v-for="tag in job.tags"
        :key="tag"
        class="rounded bg-surface-low px-2 py-0.5 text-[11px] font-semibold text-ink-700"
      >{{ tag }}</span>
    </div>

    <!-- Apply CTA — DS: ink-900 solid, no gradient -->
    <a
      :href="job.applyUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink-900 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
    >
      Apply <span class="material-symbols-outlined text-sm">arrow_forward</span>
    </a>
  </article>
</template>
