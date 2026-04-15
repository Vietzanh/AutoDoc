/**
 * useJobPoll — polls a job's status every `interval` ms until it reaches
 * a terminal state (done / failed), then stops.
 */

import { useState, useEffect, useRef } from "react";
import { api, Job } from "@/services/api";

export function useJobPoll(jobId: number, interval = 2000) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    // Reset internal state when jobId becomes falsy (e.g. after a reset / "start over")
    if (!jobId) {
      setJob(null);
      setError(null);
      return;
    }

    stoppedRef.current = false;

    async function poll() {
      try {
        const fresh = await api.getJob(jobId);
        setJob(fresh);
        if (stoppedRef.current) return;
        if (fresh.status === "done" || fresh.status === "failed") {
          return; // Stop polling
        }
      } catch (e) {
        setError(String(e));
      }
    }

    // Poll immediately, then on interval
    poll();
    const id = setInterval(poll, interval);
    return () => {
      stoppedRef.current = true;
      clearInterval(id);
    };
  }, [jobId, interval]);

  return { job, error };
}
