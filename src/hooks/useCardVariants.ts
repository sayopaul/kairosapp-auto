import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

import { supabase } from '../lib/supabase';

interface CardVariant {
  id: string;
  card_id: string | null;
  variant_type: string;
  api_slug: string | null;
  price_usd: number | null;
  image_url: string | null;
  created_at: string | null;
  name: string | null;
  description: string | null;
}

export function useCardVariants() {
  const [variants, setVariants] = useState<CardVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCardVariants();
  }, []);

  const fetchCardVariants = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('card_variants')
        .select('*')
        .order('variant_type', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setVariants(data || []);
    } catch (err) {
      console.error('Error fetching card variants:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch card variants');
    } finally {
      setLoading(false);
    }
  };

  return {
    variants,
    loading,
    error,
    refetch: fetchCardVariants,
  };
}