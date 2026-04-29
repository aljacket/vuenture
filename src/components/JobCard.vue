<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Job } from '@/types/job';
import { useBookmarks } from '@/composables/useBookmarks';
import { useInterviewHistory } from '@/composables/useInterviewHistory';

const props = defineProps<{ job: Job }>();
const { isBookmarked, toggle } = useBookmarks();
const { isInterviewed, getEntry, mark, unmark } = useInterviewHistory();

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

const interviewed = computed(() => isInterviewed(props.job.company));
const interviewedReason = computed(() => getEntry(props.job.company)?.reason ?? '');

const menuOpen = ref(false);
const showReasonInput = ref(false);
const reasonDraft = ref('');

function openMarkPrompt() {
  reasonDraft.value = '';
  showReasonInput.value = true;
  menuOpen.value = false;
}

function submitMark() {
  mark(props.job.company, reasonDraft.value.trim());
  showReasonInput.value = false;
  reasonDraft.value = '';
}

function cancelMark() {
  showReasonInput.value = false;
  reasonDraft.value = '';
}

function handleUnmark() {
  unmark(props.job.company);
  menuOpen.value = false;
}
</script>

<template>
  <article
    class="flex flex-col rounded-xl border border-border/60 bg-surface p-6 transition-all hover:border-brand-500/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
  >
    <!-- Top row: score badge + bookmark + kebab menu -->
    <div class="mb-4 flex items-start justify-between">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500/10"
      >
        <span class="text-lg font-bold tabular-nums text-brand-600">{{ job.score.overall }}</span>
      </div>
      <div class="flex items-center gap-1">
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
        <div class="relative">
          <button
            class="text-ink-500/60 transition-colors hover:text-brand-600"
            :aria-haspopup="true"
            :aria-expanded="menuOpen"
            aria-label="More actions"
            @click="menuOpen = !menuOpen"
          >
            <span class="material-symbols-outlined">more_vert</span>
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 z-10 mt-1 w-56 rounded-md border border-border/60 bg-surface py-1 shadow-lg"
            @mouseleave="menuOpen = false"
          >
            <button
              v-if="!interviewed"
              class="block w-full cursor-pointer px-3 py-2 text-left text-sm text-ink-700 hover:bg-canvas"
              @click="openMarkPrompt"
            >
              Mark as interviewed…
            </button>
            <button
              v-else
              class="block w-full cursor-pointer px-3 py-2 text-left text-sm text-ink-700 hover:bg-canvas"
              @click="handleUnmark"
            >
              Unmark interviewed
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Already-interviewed banner (only renders when the chip is OFF and
         this card actually slipped through to the list). -->
    <div
      v-if="interviewed"
      class="mb-3 rounded border border-must/20 bg-must/5 px-3 py-2 text-[12px] font-medium text-must"
    >
      <span class="material-symbols-outlined align-middle text-sm">history</span>
      Already interviewed{{ interviewedReason ? ` — ${interviewedReason}` : '' }}
    </div>

    <!-- Inline reason prompt (shown when the user is marking) -->
    <div
      v-if="showReasonInput"
      class="mb-3 rounded border border-border/60 bg-canvas px-3 py-2"
    >
      <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        Reason (optional)
      </label>
      <input
        v-model="reasonDraft"
        type="text"
        placeholder="e.g. FE architecture depth"
        class="w-full rounded border border-border/60 bg-surface px-2 py-1 text-sm text-ink-900 outline-none focus:border-brand-500"
        @keydown.enter="submitMark"
        @keydown.esc="cancelMark"
      />
      <div class="mt-2 flex gap-2">
        <button
          class="rounded bg-ink-900 px-3 py-1 text-xs font-bold text-white hover:opacity-90"
          @click="submitMark"
        >
          Save
        </button>
        <button
          class="rounded border border-border/60 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-canvas"
          @click="cancelMark"
        >
          Cancel
        </button>
      </div>
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
