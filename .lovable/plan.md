

## Plan: Add "Vendedor" and "Implantação" roles

### Overview
Create two new access roles in the system. **Vendedores** get a WS-like interface without "Pré-Cadastro" and can only see their own pre-viabilidades. **Implantação** gets basic access (same as WS for now, just a distinct role).

### 1. Database: Extend the `app_role` enum

Add `vendedor` and `implantacao` to the existing `app_role` enum via migration:

```sql
ALTER TYPE public.app_role ADD VALUE 'vendedor';
ALTER TYPE public.app_role ADD VALUE 'implantacao';
```

### 2. Add RLS policies for new roles on `pre_viabilidades`

Vendedores and Implantação users need SELECT/INSERT on `pre_viabilidades` (own rows only). The existing "Users can view own" and "Users can insert own" policies already cover `auth.uid() = user_id`, so these will work automatically once the users are authenticated.

### 3. Update `useUserRole.ts`

- Extend `AppRole` type: `"admin" | "ws_user" | "vendedor" | "implantacao"`
- Add `isVendedor` and `isImplantacao` boolean flags

### 4. Update `App.tsx` routing

- **Vendedores**: Route to `/ws/*` like WS users but with a flag that hides "Pré-Cadastro"
- **Implantação**: Route to `/ws/*` same as WS users
- Update `WsRoutes` guard to allow `vendedor` and `implantacao` roles
- Update `LandingRoute`, `AuthRoute`, `WsAuthRoute` to handle the new roles (redirect to `/ws`)
- Update `ProtectedRoutes` to redirect non-admin roles appropriately

### 5. Update `WsLayout.tsx`

- Accept role info (via `useUserRole`) and conditionally filter out "Pré-Cadastro" link when the user is a `vendedor`

### 6. Update `LandingPage.tsx`

No changes needed -- vendedores and implantação will use the same WS login entry point.

### 7. Update `Auth.tsx` (login page)

No changes needed -- the WS login flow already works for any role assigned via admin.

### 8. Update `WsUsersPage.tsx` (admin user management)

- Add tabs for "Vendedores" and "Implantação"
- Update pending user assignment buttons to include the new roles
- Update the total counter to include all role types
- Update `changeRole` mutation to cycle through more roles

### 9. Update `manage-ws-users` edge function

- Update `assign_role` action: accept `vendedor` and `implantacao` as valid roles (currently it defaults to `ws_user` for anything non-admin)
- Update `create_user` action similarly
- Update `change_role` to handle the new role values

### 10. Update `PreViabilidadePage.tsx`

No code changes needed -- the existing logic already shows "own records" for non-admin users via the `usePreViabilidades` hook which filters by `user_id` for non-admins, and the RLS policies enforce this.

### Technical details

**Files to modify:**
- `supabase/migrations/` -- new migration for enum extension
- `src/hooks/useUserRole.ts` -- add new role flags
- `src/App.tsx` -- update route guards
- `src/components/WsLayout.tsx` -- conditionally hide Pré-Cadastro
- `src/pages/WsUsersPage.tsx` -- add tabs for new roles
- `supabase/functions/manage-ws-users/index.ts` -- accept new role values

**No changes needed:**
- `pre_viabilidades` RLS -- existing "Users can view own" policy works
- `PreViabilidadePage.tsx` -- already filters by user for non-admins
- `LandingPage.tsx` / `Auth.tsx` -- login flow is role-agnostic

