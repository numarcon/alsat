# Implementation status

## Implemented locally

- Supabase email/password Auth with SSR cookie refresh and protected Workspace routes.
- Tenant session resolved from active `company_users` membership.
- Company onboarding RPC creating the company and owner membership atomically.
- Full Architecture v1 relational schema and RLS policies.
- Company roles and independent sales-agent profile/approval relationship.
- Products CRUD with `workspace_active`, `sales_agent_visible`, and `marketplace_published`.
- Company-owned customers, warehouses and forwarders.
- Composite foreign keys preventing cross-company customer, product, warehouse, and forwarder assignment.
- Order total calculation and delivered + paid commission trigger.
- PWA manifest and mobile-friendly shell.
- pgTAP architecture contract starter.

## Live validation completed

- Architecture v1 upgrade applied to the Supabase production database without losing the existing company, products, order, or order items.
- Authenticated owner tenant session verified against the live database.
- Products create/read/update/delete verified; test product removed afterward.
- Customer/store, warehouse, forwarder, and company order flows verified; all temporary test records removed afterward.
- Seven rollback-based checks passed for RLS isolation, blocked cross-company assignments, and delivered + paid commission calculation.
- Independent sales-agent PWA registration and operational flow confirmed by the user.

## Next deployment action

Connect the project to GitHub/Vercel, configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, deploy, then add the production `/auth/confirm` URL to Supabase Auth redirect URLs. No secret/service-role key is required by the browser application.
