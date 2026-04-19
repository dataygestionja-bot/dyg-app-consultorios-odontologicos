

User wants ALL users (any role) to land on Dashboard after login. Currently `landing.ts` already returns "/" for all roles, but `resolvePostLoginPath` preserves `attemptedPath` for non-recepcion roles. User wants Dashboard always.

Simple change: make `resolvePostLoginPath` always return `/` for any role after login.

