# Migration Guide: Profiles Table Removal

This guide explains the major architectural change in LogiSys where the `profiles` table has been removed and replaced with direct entity-based user management.

## Overview

The system has migrated from a centralized `profiles` table to a distributed entity-based user model where users are linked directly to their respective entity tables (`clientes`, `armazens`, `colaboradores`) via `user_id` foreign keys to `auth.users`.

## What Changed

### Database Schema

#### Removed:
- ❌ `public.profiles` table
- ❌ `handle_new_user()` trigger function
- ❌ `on_auth_user_created` trigger
- ❌ All RLS policies on profiles table
- ❌ Foreign key constraints from other tables to `profiles(id)`

#### Added:
- ✅ `public.colaboradores` table with `user_id` FK to `auth.users(id)`
- ✅ `user_id` column in `armazens` table (FK to `auth.users(id)`)
- ✅ Updated `clientes` table already has `user_id` column
- ✅ Updated FK constraints: all now point to `auth.users(id)` directly
- ✅ New `get_users_with_roles()` function that aggregates from entity tables
- ✅ New edge functions: `create-armazem-user`, `create-colaborador-user`

### Entity Tables Structure

Each entity table now contains:

**clientes:**
```sql
- id (PK)
- nome, cnpj_cpf, email, telefone
- endereco, cidade, estado, cep
- ativo (boolean)
- user_id (FK to auth.users, nullable)
- created_at, updated_at
```

**armazens:**
```sql
- id (PK)
- nome, cidade, estado
- ativo (boolean)
- user_id (FK to auth.users, nullable)
- created_at
```

**colaboradores:**
```sql
- id (PK)
- nome, cpf, email, telefone
- cargo, departamento
- ativo (boolean)
- user_id (FK to auth.users, nullable)
- created_at, updated_at
```

### User Creation Flow Changes

#### Before (Using Profiles):
1. Create auth.users
2. Auto-create profiles via trigger
3. Auto-assign default 'cliente' role via trigger
4. Assign role to user_roles (references profiles.id)
5. Optionally create entity record

#### After (Entity-Based with Explicit Role Assignment):
1. Create auth.users
2. **Explicitly assign appropriate role** in user_roles (references auth.users.id)
3. **Rollback user creation if role assignment fails**
4. Create entity record with user_id link
5. No profiles table involved
6. No automatic default role assignment via trigger

**Important:** As of migration 20251121173817, the `assign_default_role()` function and its associated triggers have been removed. All edge functions now explicitly assign roles during user creation and implement rollback mechanisms to prevent orphaned users without proper permissions.

## Migration Steps for Existing Deployments

### Prerequisites
- Backup your database before starting
- Ensure you have Supabase CLI installed
- Have service role key available

### Step 1: Apply Migrations

Run migrations in order:

```bash
# 1. Create colaboradores table
supabase db push supabase/migrations/20251120_create_colaboradores_table.sql

# 2. Add user_id to armazens
supabase db push supabase/migrations/20251120_add_user_id_to_armazens.sql

# 3. Update FK constraints
supabase db push supabase/migrations/20251120_update_fks_to_auth_users.sql

# 4. Update get_users_with_roles function
supabase db push supabase/migrations/20251120_update_get_users_function.sql

# 5. Remove profiles dependencies
supabase db push supabase/migrations/20251120_remove_profiles_dependencies.sql

# 6. Drop profiles table (FINAL STEP - NO ROLLBACK)
supabase db push supabase/migrations/20251120_drop_profiles_table.sql

# 7. Remove default role trigger (Migration 20251121173817)
supabase db push supabase/migrations/20251121173817_remove_default_role_trigger.sql

# 8. Remove legacy tipo column from colaboradores (idempotent safety measure)
supabase db push supabase/migrations/20251121183327_remove_tipo_from_colaboradores.sql
```

**Note on Step 8:** This migration is idempotent and will only drop the `tipo` column if it exists. The colaboradores table was created without this column, but this step ensures it doesn't exist if it was manually added. All role management is now exclusively through the `user_roles` table.

### Step 2: Data Migration (If Needed)

If you have existing users in the `profiles` table that need to be migrated to entity tables, run this SQL:

```sql
-- Identify users without entity links
SELECT 
  p.id,
  p.nome,
  p.email,
  ur.role,
  'No entity record' as status
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN clientes c ON c.user_id = p.id
LEFT JOIN armazens a ON a.user_id = p.id
LEFT JOIN colaboradores col ON col.user_id = p.id
WHERE c.id IS NULL 
  AND a.id IS NULL 
  AND col.id IS NULL;

-- For each orphaned profile, create appropriate entity record
-- Example for a cliente:
INSERT INTO clientes (nome, cnpj_cpf, email, user_id, ativo)
VALUES ('Nome', 'CNPJ', 'email@example.com', 'user-id-uuid', true);

-- Example for a colaborador:
INSERT INTO colaboradores (nome, cpf, email, user_id, ativo)
VALUES ('Nome', 'CPF', 'email@example.com', 'user-id-uuid', true);

-- Example for an armazem (link existing warehouse to user):
UPDATE armazens 
SET user_id = 'user-id-uuid'
WHERE id = 'armazem-id-uuid';
```

### Step 3: Deploy Edge Functions

```bash
supabase functions deploy create-armazem-user
supabase functions deploy create-colaborador-user
supabase functions deploy create-customer-user
```

### Step 4: Update Frontend

Deploy the new frontend code which includes:
- Updated TypeScript types
- New Colaboradores page
- Updated routing
- Updated permissions

## Testing Checklist

After migration, verify:

- [ ] Existing users can still login
- [ ] User roles are correctly associated
- [ ] Menu items show based on permissions
- [ ] Creating new cliente works
- [ ] Creating new colaborador works
- [ ] Creating/linking armazem user works
- [ ] Admin page shows all users correctly
- [ ] RLS policies work (users see only their data)
- [ ] All CRUD operations work correctly

## Rollback Plan

If issues occur, rollback is possible BEFORE step 6 (dropping profiles):

```sql
-- Restore FK constraints to profiles (if needed)
ALTER TABLE user_roles
  DROP CONSTRAINT user_roles_user_id_fkey,
  ADD CONSTRAINT user_roles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;

-- Restore other FK constraints similarly
-- Re-create handle_new_user trigger
-- Re-enable profiles RLS policies
```

**Important:** After step 6 (dropping profiles table), full rollback requires restoring from backup.

## Breaking Changes

### For Developers:

1. **No more profiles table queries**
   - Old: `SELECT * FROM profiles WHERE id = auth.uid()`
   - New: Query the appropriate entity table with `user_id = auth.uid()`

2. **User creation requires entity specification**
   - Must use appropriate edge function for user type
   - Cannot create generic users without entity

3. **Foreign keys changed**
   - All `created_by`, `updated_by` fields now reference `auth.users(id)`
   - Update any queries joining to profiles

4. **TypeScript types updated**
   - `profiles` table types removed
   - New `clientes`, `colaboradores`, `armazens` types added with `user_id`

### For End Users:

No breaking changes in functionality. The user experience remains the same.

## Benefits of This Change

1. **Simplified Architecture**: Direct relationship between users and business entities
2. **Better Data Integrity**: Single source of truth for user data
3. **Improved Security**: RLS policies directly on entity tables
4. **Clearer User Types**: Each user type has its own table with relevant fields
5. **Easier Maintenance**: No intermediate table to manage
6. **Better Performance**: One less join for most queries

## Support

If you encounter issues during migration:
1. Check logs in Supabase dashboard
2. Verify all migrations applied successfully
3. Check RLS policies are active
4. Verify edge functions deployed correctly
5. Contact development team if issues persist

## Additional Notes

- All temporary passwords generated for new users require change on first login
- User credentials should be securely transmitted to users
- Backup database regularly
- Monitor RLS policy performance after migration
- Update any custom scripts or integrations that query the profiles table

---

## Migration: Produtos Table Policies Update (2025-12-03)

### Overview

A security audit revealed that the `produtos` table had overly permissive RLS policies. This migration updates the policies to restrict access to only `admin` and `logistica` roles.

### What Changed

#### Removed:
- ❌ "Todos podem ver produtos" policy (allowed all authenticated users to view products)

#### Updated:
- ✅ Separate policies for SELECT, INSERT, UPDATE, and DELETE operations
- ✅ All policies now check `user_roles` table to verify user has 'admin' or 'logistica' role
- ✅ Updated `role_permissions` table with explicit produtos permissions

### produtos Table Structure

**Current Schema:**
```sql
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT DEFAULT 't',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Status:** Enabled (`relrowsecurity: true`)

**Current Policies:**
1. `Admin e Logística podem visualizar produtos` - SELECT for admin/logistica
2. `Admin e Logística podem inserir produtos` - INSERT for admin/logistica
3. `Admin e Logística podem atualizar produtos` - UPDATE for admin/logistica
4. `Admin e Logística podem deletar produtos` - DELETE for admin/logistica

### Frontend Integration

**Resource Type:**
- Added `'produtos'` to the `Resource` type in `usePermissions` hook
- Added route `/produtos` in `App.tsx` with proper `ProtectedRoute` guard
- Menu item "Produtos" in sidebar visible only to users with 'produtos' read permission

**Permissions:**
```typescript
// role_permissions table entries
admin:     { produtos: { can_create: true, can_read: true, can_update: true, can_delete: true } }
logistica: { produtos: { can_create: true, can_read: true, can_update: true, can_delete: true } }
```

### Migration Steps

To apply this migration to an existing deployment:

```bash
# Apply the migration
supabase db push supabase/migrations/20251203_update_produtos_policies_and_permissions.sql
```

The migration is idempotent and safe to run multiple times. It:
1. Drops old policies if they exist
2. Creates new restrictive policies
3. Updates role_permissions table with correct entries

### Testing Checklist

After applying this migration, verify:

- [ ] Users with 'admin' role can access /produtos page
- [ ] Users with 'logistica' role can access /produtos page
- [ ] Users with 'cliente' role cannot access /produtos page (redirected)
- [ ] Users with 'armazem' role cannot access /produtos page (redirected)
- [ ] "Produtos" menu item appears only for admin/logistica users
- [ ] Admin can create, read, update, and delete produtos
- [ ] Logistica can create, read, update, and delete produtos
- [ ] Other roles receive permission denied errors when accessing produtos table directly

### Rollback

If needed, rollback by restoring the original "Todos podem ver produtos" policy:

```sql
CREATE POLICY "Todos podem ver produtos"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (true);
```

**Warning:** This reverts to the insecure state. Only use for emergency rollback.
