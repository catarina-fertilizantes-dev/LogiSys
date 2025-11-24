-- Migration: Remove 'comercial' role from user_role enum
-- Date: 2025-11-24
-- Description: Completely removes the 'comercial' role from the system
-- as it is no longer used (0 users have this role)

BEGIN;

-- 1. Garantir ausência de registros residuais (idempotente)
-- Remove any user_roles entries with 'comercial' role
DELETE FROM public.user_roles WHERE role = 'comercial';

-- Remove any role_permissions entries with 'comercial' role
DELETE FROM public.role_permissions WHERE role = 'comercial';

-- 2. Criar novo enum sem 'comercial'
-- New enum with only: logistica, cliente, armazem, admin
CREATE TYPE user_role_new AS ENUM ('logistica', 'cliente', 'armazem', 'admin');

-- 3. Alterar coluna role na tabela user_roles para usar o novo enum
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

-- 4. Alterar coluna role na tabela role_permissions para usar o novo enum
ALTER TABLE public.role_permissions
  ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

-- 5. Renomear tipos - trocar enum antigo pelo novo
ALTER TYPE user_role RENAME TO user_role_old;
ALTER TYPE user_role_new RENAME TO user_role;

-- 6. Dropar enum antigo
DROP TYPE user_role_old;

COMMIT;

-- 7. Comentário de documentação
COMMENT ON TYPE user_role IS 'Enum de roles ativas no sistema: admin, logistica, armazem, cliente. Role "comercial" foi removida em 2025-11-24 pois não estava em uso.';
