# admin-users Edge Function - Deployment Guide

## Overview

This document provides deployment instructions and testing procedures for the `admin-users` edge function V2 with enhanced diagnostics, weak password checking, and post-creation verification.

## V2 Features

The V2 implementation includes:

1. **Email normalization** - All emails converted to lowercase
2. **Weak password blacklist** - Blocks common passwords: `123456`, `12345678`, `password`, `senha123`, `admin123`, `qwerty`
3. **Request tracking** - UUID `request_id` generated using `crypto.getRandomValues()` for every request
4. **Structured error responses** - All errors include:
   - `error`: Human-readable error message
   - `details`: Technical details
   - `stage`: One of: `validation`, `env`, `adminCheck`, `createUser`, `postCreateVerify`, `assignRole`, `unexpected`
   - `request_id`: Unique identifier for request tracking
   - `timestamp`: ISO 8601 timestamp
   - `email`: Echoed from request (for client correlation)
   - `role`: Echoed from request (for client correlation)
5. **Success response** - Includes `user_id`, `email`, `role`, `timestamp`, `first_admin_bootstrap`
6. **Enhanced logging** - All log entries prefixed with `[admin-users]`, passwords never logged
7. **Environment validation** - Returns `stage:'env'` with `envStatus` if environment variables missing
8. **Duplicate detection** - Returns HTTP 409 with `stage:'createUser'` when email already exists
9. **Post-create verification** - Fetches created user by ID; rolls back if verification fails
10. **Role assignment with rollback** - On error, deletes user and returns detailed error with `stage:'assignRole'`
11. **Bootstrap logic** - First admin can be created without Authorization header
12. **Allowed roles** - Only `admin` and `logistica` roles permitted
13. **CORS headers** - Proper CORS configuration for web client access
14. **Supabase error codes** - Includes `supabase_error_code` in error responses when available

## Deployment Steps

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project** (first time only):
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

4. **Deploy the function**:
   ```bash
   supabase functions deploy admin-users
   ```

5. **Verify deployment**:
   ```bash
   supabase functions list
   ```

### Option 2: Using Supabase Dashboard

1. Navigate to your Supabase project dashboard
2. Go to **Edge Functions** section in the sidebar
3. Find the `admin-users` function
4. Click the **Deploy** button
5. Confirm the deployment
6. Wait for the deployment to complete (usually takes 1-2 minutes)

### Environment Variables

Ensure these environment variables are set in your Supabase project:

```bash
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**⚠️ Security Warning**: These variables contain sensitive credentials:
- **NEVER** commit them to version control
- **NEVER** share them in plain text (chat, email, documentation)
- The `SUPABASE_SERVICE_ROLE_KEY` has full database access - treat it like a database password
- Store them securely in your password manager or secrets management system

These are automatically available in Supabase Edge Functions. No manual configuration needed unless running locally.

## Testing Procedures

After deployment, perform the following tests to verify V2 functionality:

### Test 1: Weak Password Validation

**Test weak password rejection** (should return HTTP 400 with `stage:'validation'`):

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/admin-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "email": "test@example.com",
    "password": "123456",
    "nome": "Test User",
    "role": "logistica"
  }'
```

**Expected Response**:
```json
{
  "error": "Weak password",
  "details": "The provided password is too common and easily guessable",
  "stage": "validation",
  "suggestions": ["Use letters, numbers and special characters"],
  "email": "test@example.com",
  "role": "logistica",
  "timestamp": "2025-11-24T21:59:15.000Z",
  "request_id": "12345678-1234-4000-8000-123456789abc"
}
```

### Test 2: Successful User Creation

**Create new user with strong password** (should return HTTP 200 with success):

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/admin-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "email": "newuser@example.com",
    "password": "StrongP@ssw0rd!",
    "nome": "New User",
    "role": "logistica"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "user_id": "uuid-of-created-user",
  "email": "newuser@example.com",
  "role": "logistica",
  "timestamp": "2025-11-24T21:59:15.000Z",
  "first_admin_bootstrap": false,
  "request_id": "12345678-1234-4000-8000-123456789abc"
}
```

### Test 3: Duplicate Email Detection

**Attempt to create user with existing email** (should return HTTP 409 with `stage:'createUser'`):

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/admin-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "email": "newuser@example.com",
    "password": "AnotherP@ssw0rd!",
    "nome": "Duplicate User",
    "role": "admin"
  }'
```

**Expected Response**:
```json
{
  "error": "User already exists",
  "details": "A user with this email address already registered",
  "stage": "createUser",
  "email": "newuser@example.com",
  "role": "admin",
  "timestamp": "2025-11-24T21:59:15.000Z",
  "request_id": "12345678-1234-4000-8000-123456789abc",
  "supabase_error_code": "23505"
}
```

### Test 4: Missing Authorization (When Admins Exist)

**Attempt to create user without auth token** (should return HTTP 401 with `stage:'adminCheck'`):

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/admin-users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unauthorized@example.com",
    "password": "StrongP@ssw0rd!",
    "nome": "Unauthorized User",
    "role": "admin"
  }'
```

**Expected Response**:
```json
{
  "error": "Unauthorized",
  "details": "Authentication required to create users",
  "stage": "adminCheck",
  "email": "unauthorized@example.com",
  "role": "admin",
  "timestamp": "2025-11-24T21:59:15.000Z",
  "request_id": "12345678-1234-4000-8000-123456789abc"
}
```

### Test 5: First Admin Bootstrap

**Create the very first admin** (only works when no admins exist):

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/admin-users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "firstadmin@example.com",
    "password": "SecureAdm1n!P@ss",
    "nome": "First Admin",
    "role": "admin"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "user_id": "uuid-of-created-admin",
  "email": "firstadmin@example.com",
  "role": "admin",
  "timestamp": "2025-11-24T21:59:15.000Z",
  "first_admin_bootstrap": true,
  "request_id": "12345678-1234-4000-8000-123456789abc"
}
```

**Note**: `first_admin_bootstrap: true` indicates this was created without authentication.

## Monitoring and Debugging

### Viewing Logs

**Using Supabase Dashboard:**
1. Navigate to **Edge Functions** → **admin-users**
2. Click on the **Logs** tab
3. Look for entries prefixed with `[admin-users]`

**Using Supabase CLI:**
```bash
supabase functions logs admin-users --tail
```

### Log Format

All logs follow this format:
```
[admin-users] <action description>, request_id: <uuid>
```

Example logs:
```
[admin-users] Starting request 12345678-1234-4000-8000-123456789abc
[admin-users] Creating user with role: admin, request_id: 12345678-1234-4000-8000-123456789abc
[admin-users] User created, request_id: 12345678-1234-4000-8000-123456789abc
[admin-users] User verified successfully, request_id: 12345678-1234-4000-8000-123456789abc
[admin-users] Assigning role: admin, request_id: 12345678-1234-4000-8000-123456789abc
[admin-users] User creation completed successfully, request_id: 12345678-1234-4000-8000-123456789abc
```

### Error Stages Reference

| Stage | Meaning | HTTP Status |
|-------|---------|-------------|
| `validation` | Invalid request payload or weak password | 400 |
| `env` | Missing environment variables | 500 |
| `adminCheck` | Authorization/permission check failed | 401, 403, or 500 |
| `createUser` | User creation failed in auth.users | 409 (duplicate) or 500 |
| `postCreateVerify` | Created user could not be verified | 500 |
| `assignRole` | Role assignment failed (user rolled back) | 500 |
| `unexpected` | Unhandled error | 500 |

## Security Considerations

### Password Requirements

- **Minimum length**: 6 characters (enforced by Zod schema)
- **Maximum length**: 128 characters (enforced by Zod schema)
- **Blacklist check**: Rejects 6 common passwords (case-insensitive):
  - `123456`, `12345678`, `password`, `senha123`, `admin123`, `qwerty`
- **Not logged**: Passwords never appear in logs or error messages
- **Force change on first login**: All created users must change their temporary password

**Note**: Password complexity requirements are defined by business requirements. Users are required to change their temporary password on first login, at which point they can choose a stronger password that meets their security needs.

### User Enumeration Protection

- Email/role values are echoed from client request, not looked up
- 409 Duplicate errors intentionally reveal existence (required for proper UX)
- All errors occur in CREATE context, not user lookup

### Role Restrictions

Only two roles are allowed:
- `admin`: Full system access
- `logistica`: Logistics team access

For other roles (cliente, armazem, colaborador), use the respective edge functions:
- `create-customer-user`
- `create-armazem-user`
- `create-colaborador-user`

## Rollback Procedures

If the deployment causes issues:

1. **Identify the problem** from logs
2. **Revert using Git**:
   ```bash
   # Checkout previous version of the function
   git checkout <previous-commit> supabase/functions/admin-users/
   
   # Deploy the reverted version
   supabase functions deploy admin-users
   ```

3. **Or use Dashboard**:
   - Navigate to Edge Functions → admin-users
   - Click on "Versions" or "Deployment History"
   - Select previous working version
   - Click "Redeploy" or "Restore"

4. **Quick hotfix**:
   - Make necessary fixes directly in the code
   - Deploy immediately: `supabase functions deploy admin-users`

## Troubleshooting

### Issue: "Server not configured" error

**Symptoms**: HTTP 500 with `stage:'env'`

**Solution**: 
- Verify environment variables in Supabase Dashboard
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### Issue: Role assignment keeps failing

**Symptoms**: HTTP 500 with `stage:'assignRole'`

**Solution**:
- Check `user_roles` table structure in Supabase
- Verify RLS policies allow service role to insert
- Review logs for specific database error codes

### Issue: Post-create verification fails

**Symptoms**: HTTP 500 with `stage:'postCreateVerify'`, user is rolled back

**Solution**:
- Check Supabase Auth service status
- Verify service role permissions
- May indicate temporary Auth API issue - retry

## Performance Metrics

Expected response times:
- **Validation errors**: < 50ms
- **Successful creation**: 500-1500ms (includes auth user creation, verification, and role assignment)
- **Duplicate detection**: 200-500ms

## Related Documentation

- Main README: `/README.md`
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- LogiSys Architecture: See "Architecture & User Management" section in README.md
