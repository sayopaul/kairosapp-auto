import { useState, useEffect } from 'react';
import { enhancedMatchingService, EnhancedMatch } from '../services/enhancedMatchingService';

export function useEnhancedMatching(userId?: string) {
  const [matches, setMatches] = useState<EnhancedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMatches = async (advanced: boolean = false) => {
    if (!userId) {
      setError('No user ID provided');
      return;
    }

    console.log('Starting enhanced match generation for user:', userId);
    setLoading(true);
    setError(null);

    try {
      // Loosened matching criteria for better results
      const options = advanced ? {
        maxValueDifference: 1000,  // Much more flexible for testing
        minMatchScore: 10,         // Very low threshold for testing
        valueTolerance: 100        // Accept any value difference
      } : {
        maxValueDifference: 1000,  // Much more flexible for basic
        minMatchScore: 10,         // Very low threshold for testing
        valueTolerance: 100        // Accept any value difference
      };

      console.log('Using loosened matching criteria:', options);

      const newMatches = await enhancedMatchingService.generateEnhancedMatches(userId, options);

      console.log('Generated enhanced matches:', newMatches.length);
      setMatches(newMatches);

      if (newMatches.length === 0) {
        // Provide detailed debugging information
        const debugInfo = `Enhanced matching found no results.

Debugging steps:
1. Check if you have both trade and want cards
2. Verify other users exist with cards
3. Check browser console for detailed logs
4. Try the Test Lab for algorithm verification

Current settings (loosened for testing):
• Max value difference: $${options.maxValueDifference}
• Min match score: ${options.minMatchScore}%
• Value tolerance: ${options.valueTolerance}%`;

        setError(debugInfo);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate enhanced matches';
      setError(errorMessage);
      console.error('Enhanced matching error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMatches = () => {
    if (userId) {
      generateMatches();
    }
  };

  // Auto-generate matches when user changes
  useEffect(() => {
    if (userId) {
      console.log('Auto-generating enhanced matches for user:', userId);
      generateMatches();
    } else {
      setMatches([]);
      setError(null);
    }
  }, [userId]);

  return {
    matches,
    loading,
    error,
    generateMatches,
    refreshMatches,
  };
}