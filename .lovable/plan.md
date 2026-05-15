## Cambio

En `src/components/turnos/AgendaSemanalMatriz.tsx`, el badge "HOY" del encabezado de la columna del día actual.

### Estado actual (línea ~319)
```tsx
<span className="ml-1 rounded-full bg-[hsl(120,100%,25%)] px-1.5 py-0.5 text-[9px] font-bold text-white">
  HOY
</span>
```

Es una píldora verde con texto blanco.

### Nuevo estilo
- Forma: círculo perfecto (mismo ancho y alto, ej. `h-6 w-6`).
- Fondo: blanco para que destaque sobre el verde de la cabecera.
- Borde: negro de 1.5px (`border-2 border-black`).
- Texto: negro, en negrita, tamaño chico (`text-[9px] font-bold`) para que entre dentro del círculo.
- Centrado con `inline-flex items-center justify-center`.

```tsx
<span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-white text-[9px] font-bold text-black">
  HOY
</span>
```

No se tocan otros estilos (fondo verde de la columna, header, etc.).
