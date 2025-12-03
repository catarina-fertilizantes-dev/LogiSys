# Produtos Table Update - Implementation Summary

**Date:** 2025-12-03  
**Issue:** Update documentation/migrations/backend for produtos table to reflect actual SQL audit

## Changes Made

### 1. Database Migration

**File:** `supabase/migrations/20251203_update_produtos_policies_and_permissions.sql`

This migration updates the RLS policies for the `produtos` table to match the security audit results:

#### Removed Policies:
- ❌ "Todos podem ver produtos" - This overly permissive policy allowed all authenticated users to view products

#### New Policies:
- ✅ "Admin e Logística podem visualizar produtos" - SELECT for admin/logistica only
- ✅ "Admin e Logística podem inserir produtos" - INSERT for admin/logistica only
- ✅ "Admin e Logística podem atualizar produtos" - UPDATE for admin/logistica only
- ✅ "Admin e Logística podem deletar produtos" - DELETE for admin/logistica only

#### role_permissions Updates:
```sql
INSERT INTO public.role_permissions (role, resource, can_create, can_read, can_update, can_delete)
VALUES 
  ('admin', 'produtos', true, true, true, true),
  ('logistica', 'produtos', true, true, true, true)
```

### 2. Frontend Updates

#### Updated Files:

**`src/hooks/usePermissions.tsx`**
- Added `'produtos'` to the `Resource` type union
- This enables the permission system to recognize and check produtos resource access

**`src/App.tsx`**
- Imported `Produtos` page component
- Added route for `/produtos` with `ProtectedRoute` guard using `resource="produtos"`
- Route is now accessible at: `http://localhost:5173/produtos`

**`src/components/AppSidebar.tsx`** (already existed)
- "Produtos" menu item was already present in the sidebar
- Configured with `resource: "produtos" as const`
- Menu item visibility controlled by `canAccess("produtos", "read")`

### 3. Documentation Updates

#### README.md

**Permissions Matrix:**
Updated the permissions table to include `produtos` resource:
- `admin`: Full CRUD access to produtos
- `logistica`: Full CRUD access to produtos
- `cliente`: No access
- `armazem`: No access

**Menu Navigation Structure:**
Added Produtos to the Management Group:
```
6. Produtos - Product management (visible only to admin and logistica roles)
7. Clientes - Customer management
8. Armazéns - Warehouse management
9. Colaboradores - Collaborator management
```

**New Section: Produtos Table Structure and Policies**
Documented complete table schema, RLS status, and access control policies with SQL examples.

#### MIGRATION_GUIDE.md

Added new section: "Migration: Produtos Table Policies Update (2025-12-03)"

Includes:
- Overview of the security audit findings
- What changed (removed and updated policies)
- Complete produtos table structure
- Frontend integration details
- Step-by-step migration instructions
- Testing checklist
- Rollback procedures (with security warning)

## Products Table Structure

```sql
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade TEXT DEFAULT 't',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Enabled (`relrowsecurity: true`)

## Access Control Flow

1. **Database Layer:** RLS policies check `user_roles` table for admin/logistica membership
2. **API Layer:** Supabase client respects RLS policies automatically
3. **Frontend Layer:** 
   - `usePermissions` hook queries `role_permissions` table
   - `canAccess("produtos", action)` checks permissions
   - Routes protected by `ProtectedRoute` component
   - Sidebar menu items conditionally rendered

## Testing Verification

To verify the changes work correctly:

### Database Level:
```sql
-- Verify RLS is enabled
SELECT relrowsecurity FROM pg_class WHERE relname = 'produtos';
-- Expected: true

-- Check policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'produtos';
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- Verify role_permissions
SELECT * FROM role_permissions WHERE resource = 'produtos';
-- Expected: 2 rows (admin and logistica with full permissions)
```

### Frontend Level:
1. Login as admin → Verify "Produtos" appears in sidebar → Access /produtos page
2. Login as logistica → Verify "Produtos" appears in sidebar → Access /produtos page
3. Login as cliente → Verify "Produtos" does NOT appear in sidebar → Cannot access /produtos (redirected)
4. Login as armazem → Verify "Produtos" does NOT appear in sidebar → Cannot access /produtos (redirected)

### Functional Tests:
- Admin can create new produtos
- Admin can view all produtos
- Admin can edit produtos
- Admin can delete produtos (if UI supports it)
- Logistica has same permissions as admin
- Other roles receive 403/permission errors

## Security Improvements

This update significantly improves security by:
1. **Principle of Least Privilege:** Only roles that need access (admin/logistica) have it
2. **Defense in Depth:** Security enforced at multiple layers (DB, API, Frontend)
3. **Explicit Permissions:** No default/implicit access granted
4. **Audit Trail:** Clear documentation of who can access what

## Related Files

- Migration: `supabase/migrations/20251203_update_produtos_policies_and_permissions.sql`
- Frontend hook: `src/hooks/usePermissions.tsx`
- Routing: `src/App.tsx`
- Page component: `src/pages/Produtos.tsx` (already existed)
- Sidebar: `src/components/AppSidebar.tsx` (already configured)
- Documentation: `README.md`, `MIGRATION_GUIDE.md`

## Future Considerations

1. If new roles are added that need produtos access, update:
   - Database migration to add RLS policy checks
   - `role_permissions` table entries
   - Documentation in README.md

2. If produtos table schema changes:
   - Create new migration file
   - Update type definitions in `src/integrations/supabase/types.ts`
   - Update this documentation

3. For audit purposes:
   - All policy changes should be documented in migrations
   - Consider adding audit logging for produtos modifications
   - Review access patterns periodically

## Migration Safety

The migration is:
- ✅ **Idempotent:** Safe to run multiple times
- ✅ **Transactional:** Wrapped in BEGIN/COMMIT
- ✅ **Non-destructive:** Only adds/modifies policies, doesn't delete data
- ✅ **Backward Compatible:** Existing data remains intact
- ✅ **Rollback-able:** Can restore old policies if needed (not recommended)

## Questions & Support

For questions about this implementation:
1. Review the detailed comments in the migration file
2. Check MIGRATION_GUIDE.md for step-by-step instructions
3. Verify permissions in Supabase dashboard
4. Test with different user roles

---

**Implementation Status:** ✅ Complete  
**Testing Status:** ⏳ Pending user verification  
**Documentation Status:** ✅ Complete
