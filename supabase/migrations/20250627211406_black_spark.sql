/*
  # Add foreign key constraint between cards and users tables

  1. Changes
    - Add foreign key constraint `cards_user_id_fkey` linking `cards.user_id` to `users.id`
    - This enables proper joins between cards and users tables in Supabase queries
    - Uses CASCADE delete to maintain referential integrity

  2. Security
    - No changes to existing RLS policies
    - Maintains current security model
*/

-- Add foreign key constraint between cards and users tables
ALTER TABLE public.cards 
ADD CONSTRAINT cards_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;