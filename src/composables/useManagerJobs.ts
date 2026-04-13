import { ref } from 'vue';
import type { Job, JobsFile } from '@/types/job';

const jobs = ref<Job[]>([]);
const needsReview = ref<Job[]>([]);
const fetchedAt = ref<string>('');
const loading = ref(false);
const error = ref<string | null>(null);

export function useManagerJobs() {
  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}manager-jobs.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as JobsFile;
      jobs.value = data.jobs ?? [];
      needsReview.value = data.needsReview ?? [];
      fetchedAt.value = data.fetchedAt ?? '';
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      jobs.value = [];
      needsReview.value = [];
    } finally {
      loading.value = false;
    }
  }

  return { jobs, needsReview, fetchedAt, loading, error, load };
}
