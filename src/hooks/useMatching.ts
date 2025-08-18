import { useState, useCallback } from 'react';
import { matchingService } from '../services/matchingService';
import type { PotentialMatch } from '../services/matchingService';

export function useMatching(userId?: string) {
  const [matches, setMatches] = useState<PotentialMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const generateMatches = useCallback(async (useCache: boolean = true) => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      setProgress(0);
      setStatus('Starting match generation...');

      const newMatches = await matchingService.generateAndSaveMatches(userId, {
        maxValueDifference: 500,
        minMatchScore: 50,
        onProgress: (progress: number, status: string) => {
          setProgress(progress);
          setStatus(status);
        }
      });

      setMatches(newMatches);
    } catch (err) {
      console.error('Error generating matches:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate matches');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    matches,
    loading,
    error,
    progress,
    status,
    generateMatches
  };
}