# Stock

Control de inventario con alerta cuando un producto cae por debajo del mínimo y lista de reposición.

## Cómo se trabaja este proyecto

Se construye en 3 etapas. No saltees etapas: cada una reutiliza lo que ya viste funcionar.

### Etapa 1 — Demo local (lista)

Archivos en la raíz: `index.html` + `style.css` + `script.js`

Cómo correrlo:

1. Abrí `index.html` en el navegador, o
2. Usá Live Server en VS Code / Cursor sobre esta carpeta.

Qué vas a ver:

- Tabla de productos con stock actual y stock mínimo
- Filas en rojo cuando el stock está por debajo del mínimo
- Lista de reposición en vivo
- ABM más completo: SKU único, categoría, proveedor, unidad, precio, ubicación
- Búsqueda, filtros, orden por columnas y baja masiva
- Movimientos de entrada / salida con motivo (no deja vender más de lo que hay)
- Se guarda en el navegador

Los datos son un array hardcodeado en `script.js`. Cero instalación.

### Etapa 2 — Herramienta real (pendiente)

React (Vite) + Express + PostgreSQL.

- Tabla `productos` (stock actual, stock mínimo, proveedor)
- Endpoint que descuenta stock al registrar una venta (integrable con Financiero)
- Genera reporte de reposición

### Etapa 3 — WhatsApp (pendiente)

Aviso por WhatsApp al encargado de compras cuando algo cruza el mínimo, o un chatbot simple vía Kapso que responde “¿cuánto queda de X?” consultando la base en tiempo real.

## Estructura

```
03-Stock/
  README.md
  index.html
  style.css
  script.js
```
