import { ref } from 'vue';
import type { Job, JobsFile } from '@/types/job';

const jobs = ref<Job[]>([]);
const fetchedAt = ref<string>('');
const loading = ref(false);
const error = ref<string | null>(null);

export function useJobs() {
  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}jobs.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as JobsFile;
      jobs.value = data.jobs ?? [];
      fetchedAt.value = data.fetchedAt ?? '';
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      jobs.value = [];
    } finally {
      loading.value = false;
    }
  }

  return { jobs, fetchedAt, loading, error, load };
}
