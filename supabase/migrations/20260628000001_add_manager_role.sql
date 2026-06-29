-- Extender el enum app_role con el nuevo valor 'manager'.
-- IMPORTANTE: los INSERT que usan 'manager' van en el archivo
-- 20260628000002_add_manager_permissions.sql porque PostgreSQL no permite
-- referenciar un valor de enum recién agregado en la misma transacción.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
