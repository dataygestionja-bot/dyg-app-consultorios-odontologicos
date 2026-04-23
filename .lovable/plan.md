

## Corregir el doble cartel de confirmación de sobreturno

### Causa

En `src/pages/Turnos.tsx`, `confirmarComoSobreturno()` hace:

```ts
setEsSobreturno(true);
setConfirmSobreturno(false);
setTimeout(() => guardar(), 0);
```

El `setTimeout(0)` no garantiza que el `setState` de React ya haya re-renderizado, así que `guardar()` corre con la closure vieja donde `esSobreturno === false`. Resultado: el insert vuelve a la DB con `es_sobreturno = false`, la constraint lo rechaza, y se reabre el `AlertDialog` por segunda vez. Recién al cancelar el segundo modal y guardar manualmente (con el estado ya actualizado) funciona.

### Solución

Pasar el flag explícitamente a `guardar()` en vez de depender del estado de React.

**Cambios en `src/pages/Turnos.tsx`:**

1. Cambiar la firma de `guardar` para aceptar un override opcional:
   ```ts
   async function guardar(forceSobreturno?: boolean) {
     const sobreturnoFlag = forceSobreturno ?? esSobreturno;
     // ...usar sobreturnoFlag en los insert/update en vez de esSobreturno
   }
   ```

2. En los dos lugares (insert y update) reemplazar `es_sobreturno: esSobreturno` por `es_sobreturno: sobreturnoFlag`.

3. En el toast de éxito del insert, usar `sobreturnoFlag` también (para que diga "Sobreturno creado" correctamente la primera vez).

4. Reescribir `confirmarComoSobreturno`:
   ```ts
   async function confirmarComoSobreturno() {
     setEsSobreturno(true);          // sólo para reflejar el checkbox en UI
     setConfirmSobreturno(false);
     await guardar(true);            // pasa el flag directo, sin esperar a React
   }
   ```

5. Mantener el handler `onSubmit={(e) => { e.preventDefault(); guardar(); }}` igual (sin argumento) — usa el estado normal del checkbox.

### Lo que NO se toca

- DB, constraint, trigger, migraciones (ya quedaron correctas).
- Diseño del `AlertDialog`, RLS, `MisTurnos.tsx`, ni el resto del flujo.

### Resultado

Al confirmar "Crear como sobreturno", el insert se reintenta inmediatamente con `es_sobreturno = true` y la constraint lo acepta a la primera. El cartel deja de aparecer dos veces.

