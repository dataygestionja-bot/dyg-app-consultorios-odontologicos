

User reports: in the published site, the `recepcion` user cannot access **Turnos** and **Atenciones** — screen goes blank.

Let me investigate. The blank screen on Turnos/Atenciones for `recepcion` is suspicious because:
- Both routes use `<Private>` (no role restriction), so access should be granted.
- Blank screen usually = JS runtime error or infinite redirect/loop.

Let me check Turnos and Atenciones pages, and AppSidebar (which might filter incorrectly).
