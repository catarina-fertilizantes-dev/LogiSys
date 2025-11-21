-- Migration: Remove legacy 'tipo' column from colaboradores table
-- This migration ensures the 'tipo' column does not exist in the colaboradores table.
-- The system now uses the user_roles table exclusively for role management.
-- This is an idempotent migration - it will only drop the column if it exists.

DO $$
BEGIN
  -- Check if the 'tipo' column exists in the colaboradores table
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'colaboradores' 
      AND column_name = 'tipo'
  ) THEN
    -- Optional: Audit any divergences between tipo and user_roles before dropping
    -- Uncomment the following block to see any discrepancies:
    /*
    RAISE NOTICE 'Auditing tipo column before removal...';
    PERFORM 
      col.id,
      col.nome,
      col.tipo as legacy_tipo,
      ur.role as current_role
    FROM public.colaboradores col
    LEFT JOIN public.user_roles ur ON ur.user_id = col.user_id
    WHERE col.tipo IS DISTINCT FROM ur.role;
    */
    
    -- Drop the 'tipo' column
    RAISE NOTICE 'Dropping tipo column from colaboradores table...';
    ALTER TABLE public.colaboradores DROP COLUMN tipo;
    RAISE NOTICE 'Successfully removed tipo column from colaboradores table.';
  ELSE
    RAISE NOTICE 'Column tipo does not exist in colaboradores table. No action needed.';
  END IF;
END $$;

-- Add a comment to the table documenting the role management approach
COMMENT ON TABLE public.colaboradores IS 
  'Colaboradores (employees/staff) table. Roles are managed exclusively through the user_roles table. Each user should have exactly one role in user_roles.';
