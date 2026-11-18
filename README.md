# SISTEMA DE CONTROL DE ALMACÉN – INDUSTRAC S.A.C.

Sistema web moderno, rápido y responsive diseñado para el control diario de inventario de repuestos de **INDUSTRAC S.A.C.** mediante el uso de stickers físicos con códigos alfanuméricos correlativos únicos y reconocimiento OCR por cámara móvil.

---

## 1. Características Principales

* **Identificación Física Unitaria:** Cada repuesto cuenta con un sticker único correlativo (ej. `AF-100-00001`, `OSVK-704-00002`). Un código = una sola unidad física.
* **Escaneo OCR con Cámara Móvil:** Lectura automática de códigos alfanuméricos impresos mediante la cámara del celular con visor de enfoque asistido y preprocesamiento de contraste. Permite edición manual inmediata ante desgaste físico del sticker.
* **Operaciones Transaccionales Atómicas (PostgreSQL RPC):**
  * Validación estricta que impide salidas dobles (`FOR UPDATE`).
  * Bloqueo contra duplicación de códigos físicos.
  * Trazabilidad histórica completa e inmutable.
* **Módulos Integrados:**
  1. **Dashboard:** Indicadores clave en tiempo real, alertas de stock mínimo y tabla de últimos movimientos.
  2. **Catálogo de Productos:** Gestión de referencias comerciales, consulta de unidades físicas individuales e importación masiva vía Excel/CSV.
  3. **Ingresos:** Registro unitario o por lotes correlativos con pase directo a estado `DISPONIBLE`.
  4. **Salidas:** Escaneo continuo por cámara con confirmación visual obligatoria antes de descontar.
  5. **Devoluciones:** Reintegro de unidades previamente retiradas a estado `DISPONIBLE` conservando el historial previo.
  6. **Historial de Movimientos:** Auditoría cronológica completa con filtros avanzados y exportación a Excel.
  7. **Reposición:** Detección automática de referencias en estado agotado, crítico o próximo al mínimo con sugerencias de compra exportables a Excel.
* **Seguridad y Acceso:** Supabase Auth con perfiles de rol (`admin` y `operador`) y Row Level Security (RLS).
* **Diseño Corporativo:** Paleta oficial INDUSTRAC (`#031240`, `#051A59`, `#18A2D9`, `#14B5D9`), interfaz táctil optimizada para celular y escritorio.

---

## 2. Estructura del Proyecto

```text
inventario/
├── index.html                   # Contenedor SPA principal con navegación adaptable
├── css/
│   ├── main.css                 # Paleta corporativa, resets y layout
│   ├── components.css           # Botones táctiles, tarjetas KPI, tablas, badges y modales
│   └── responsive.css           # Barra rápida para celulares y navegación táctil
├── js/
│   ├── app.js                   # Bootstrap de la aplicación y ciclo de vida
│   ├── config.js                # Conexión con Supabase Client
│   ├── auth.js                  # Control de sesiones y roles (admin/operador)
│   ├── router.js                # Enrutador por hash (#/dashboard, #/salidas, etc.)
│   ├── ocr.js                   # Cámara web/móvil, preprocesamiento canvas y Tesseract OCR
│   ├── modules/
│   │   ├── dashboard.js         # Panel principal de indicadores en tiempo real
│   │   ├── products.js          # Catálogo maestro e importación Excel/CSV
│   │   ├── entries.js           # Registro de ingresos y validador de unicidad
│   │   ├── exits.js             # Módulo de salidas con OCR y confirmación
│   │   ├── returns.js           # Devoluciones al almacén
│   │   ├── history.js           # Historial inmutable con exportación a Excel
│   │   └── replenishment.js     # Sugerencias de reposición por referencia comercial
│   └── utils/
│       ├── ui.js                # Toasts, modales y formateadores
│       └── excel.js             # Parser y generador de archivos XLSX (SheetJS)
├── supabase/
│   └── schema.sql               # Script SQL completo (Tablas, Vistas, Triggers, RLS y RPCs)
├── vercel.json                  # Configuración para despliegue en Vercel
├── .gitignore                   # Exclusiones de control de versiones
└── README.md                    # Manual operativo
```

---

## 3. Configuración de Base de Datos en Supabase

1. Ingrese a su proyecto en [Supabase](https://supabase.com/).
2. Diríjase a la sección **SQL Editor** en el panel lateral de Supabase (`>_`).
3. Abra el archivo `supabase/schema.sql` de este repositorio, copie su contenido completo y péguelo en el editor de Supabase.
4. Presione **Run**. Este script creará:
   * Tablas `profiles`, `products` (con nombres y familias), `inventory_units` y `inventory_movements`.
   * Vistas automáticas: `v_product_stock_summary` y `v_family_stock_summary` (resumen por familias para el Dashboard).
   * Funciones atómicas RPC:
     * `register_batch_unit_range`: para cargar lotes de stock de 50 o más unidades de golpe.
     * `register_unit_entry`: para ingresos individuales con validación de duplicados.
     * `lookup_unit_for_exit`: para consulta instantánea por OCR o manual.
     * `register_unit_exit`: para salidas atómicas bloqueantes (`FOR UPDATE`).
     * `register_unit_return`: para devoluciones directas a estado disponible.
     * `get_next_correlative`: cálculo seguro del siguiente número correlativo por familia.
   * Políticas de seguridad RLS universales para acceso web directo con la `anon key`.

---

## 4. Ejecución Local

Para probar el aplicativo en su computadora o en su red local:

```bash
# Servidor local ligero integrado
node server.js
```

Abra su navegador en:
* **Computadora:** `http://localhost:3000`
* **Celular (en la misma red Wi-Fi):** `http://<IP_LOCAL>:3000`

---

## 5. Despliegue en Vercel y GitHub

* **Repositorio Oficial:** [https://github.com/martinescriba1503-tech/inventario-industrac](https://github.com/martinescriba1503-tech/inventario-industrac)
* **Despliegue en Vercel:**
  1. Ingrese a [vercel.com/new](https://vercel.com/new).
  2. Importe el repositorio `martinescriba1503-tech/inventario-industrac`.
  3. Presione **Deploy** (no requiere configuración de build).
  4. Vercel le otorgará una URL con HTTPS automático para que la cámara del celular funcione nativamente en cualquier lugar.

