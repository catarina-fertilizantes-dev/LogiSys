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
    -- Uncomment the following lines to see any discrepancies:
    /*
    DECLARE
      audit_record RECORD;
    BEGIN
      RAISE NOTICE 'Auditing tipo column before removal...';
      FOR audit_record IN 
        SELECT 
          col.id,
          col.nome,
          col.tipo as legacy_tipo,
          ur.role as current_role
        FROM public.colaboradores col
        LEFT JOIN public.user_roles ur ON ur.user_id = col.user_id
        WHERE col.tipo IS DISTINCT FROM ur.role
      LOOP
        RAISE NOTICE 'Discrepancy found - User: % (%), Legacy tipo: %, Current role: %', 
          audit_record.nome, audit_record.id, audit_record.legacy_tipo, audit_record.current_role;
      END LOOP;
    END;
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
