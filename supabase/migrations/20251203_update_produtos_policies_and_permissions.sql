-- Migration: Update produtos table policies and permissions
-- Date: 2025-12-03
-- Description: Updates RLS policies and permissions for produtos table to reflect audit results
-- - Removes "Todos podem ver produtos" policy
-- - Keeps only admin and logistica with SELECT and INSERT access via user_roles
-- - Updates role_permissions table to reflect correct permissions

BEGIN;

-- 1. Drop the old "Todos podem ver produtos" policy if it exists
DROP POLICY IF EXISTS "Todos podem ver produtos" ON public.produtos;

-- 2. Drop old "Logística pode gerenciar produtos" policy if it exists (will be replaced)
DROP POLICY IF EXISTS "Logística pode gerenciar produtos" ON public.produtos;

-- 3. Create new policies for produtos table
-- Admin and Logistica can SELECT produtos
CREATE POLICY "Admin e Logística podem visualizar produtos"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  );

-- Admin and Logistica can INSERT produtos
CREATE POLICY "Admin e Logística podem inserir produtos"
  ON public.produtos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  );

-- Admin and Logistica can UPDATE produtos
CREATE POLICY "Admin e Logística podem atualizar produtos"
  ON public.produtos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  );

-- Admin and Logistica can DELETE produtos
CREATE POLICY "Admin e Logística podem deletar produtos"
  ON public.produtos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('logistica', 'admin')
    )
  );

-- 4. Insert/update permissions in role_permissions table
INSERT INTO public.role_permissions (role, resource, can_create, can_read, can_update, can_delete)
VALUES 
  ('admin', 'produtos', true, true, true, true),
  ('logistica', 'produtos', true, true, true, true)
ON CONFLICT (role, resource) DO UPDATE SET
  can_create = EXCLUDED.can_create,
  can_read = EXCLUDED.can_read,
  can_update = EXCLUDED.can_update,
  can_delete = EXCLUDED.can_delete;

-- 5. Add comment to document the policy structure
COMMENT ON TABLE public.produtos IS 'Tabela de produtos. RLS habilitado: apenas admin e logistica podem acessar via user_roles.';

COMMIT;
