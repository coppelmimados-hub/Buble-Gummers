# BG – Monitor ML

Monitor de la cuenta de **Mercado Libre México (MLM) de Bubble Gummers** por API:
stock en FULL, precios, Product Ads y alertas, sobre Google Sheets + Apps Script,
corriendo cada 6 h en la nube.

Solo esta cuenta. Las demás marcas (JYL, DEVIT, NUN, YOIKO, etc.) siguen por
Chrome/archivos y **no se mezclan aquí**.

---

## Por qué esta ruta

- No hay conector de Mercado Libre en el directorio de Claude.
- El MCP oficial de ML (`mcp.mercadolibre.com/mcp`) **solo busca en la documentación**;
  no trae datos de la cuenta. Descartado.
- Ruta elegida: **app propia en el DevCenter de ML + Google Apps Script + Google Sheets**.

## Quién tiene que hacer qué

| Paso | Quién |
|---|---|
| Crear la app en el DevCenter | **La titular**, con la cuenta principal (BA BRANDS) |
| Autorizar la app ("Vincular") | **La titular** |
| Cargar propiedades y correr el script | Quien administre la hoja |

Un **usuario colaborador no puede autorizar apps**: ML devuelve `invalid_operator_user_id`.
En México, además, solo se pueden crear apps con los **datos del titular cargados y
validados**, y deben coincidir exactamente con los de apertura de la cuenta.

> "Mis aplicaciones" **no está en el menú** del portal. Se entra por URL directa:
> `https://developers.mercadolibre.com.mx/devcenter`

---

## Instalación

1. Crear la hoja de cálculo **"BG – Monitor ML"**.
2. `Extensiones → Apps Script`.
3. Copiar cada archivo de `apps-script/` como un archivo del proyecto (mismo nombre).
4. `⚙️ Configuración del proyecto → Propiedades del script` y cargar:

| Propiedad | Valor |
|---|---|
| `CLIENT_ID` | App ID de la app del DevCenter |
| `CLIENT_SECRET` | Secret Key de la app |
| `REDIRECT_URI` | `https://www.google.com/` (idéntica a la de la app) |

5. Recargar la hoja → aparece el menú **BG Monitor ML**.
6. Menú → **1. Sembrar propiedades por defecto** (carga los umbrales editables).

### Autorización (OAuth)

7. Menú → **2. Generar link de autorización**. Mandarle el link a la titular.
8. La titular aprieta **Vincular** (es el "Permitir"). El navegador queda en
   `https://www.google.com/?code=TG-...`
9. Copiar **la URL completa**, pegarla en la propiedad `AUTH_CODE`.
10. Menú → **3. Canjear code**. ⚠️ **De inmediato: el code caduca en minutos.**
    Si se vence no pasa nada: se vuelve a abrir el mismo link y da uno nuevo.

Comprobar con **Quien soy (diagnostico)**: debe devolver el `user_id` de la cuenta
de Bubble Gummers.

### Puesta en marcha

11. Menú → **Actualizar todo**. Revisar las pestañas.
12. Si sale bien → menú → **Crear disparador cada 6 h**.

---

## Pestañas

| Pestaña | Contenido |
|---|---|
| `FULL` | Stock por variante en fulfillment: total, disponible, no disponible, dañadas, perdidas, recepciones |
| `Precios` | Precio base y promo por variante, si cumplen la regla 5/9 y el sugerido |
| `Ads campanas` | Campañas con presupuesto, inversión, ventas, ROAS y ACOS |
| `Ads anuncios` | Anuncios (ítems) con las mismas métricas |
| `Alertas` | Todo lo que se salió de regla, con severidad y sugerencia |
| `Cambios` | Propuestas de cambio → aprobación → aplicación |
| `Log` | Bitácora de cada corrida |

---

## Reglas de la cuenta que el código respeta

- Todo precio (base y promo) **termina en 5 o 9**, redondeando **hacia arriba**.
- En campañas con bajo rendimiento se ajusta el **presupuesto**, **nunca el precio**.
- Product Ads BG: tope **$1,500/día**, ACOS máximo **12%**, piso de rentabilidad **5.4x de ROAS**.
- **No pausar productos**: se mueven entre campañas o a "Aislamiento | Pruebas".
- **No modificar** precios, inventario, promociones ni publicaciones al optimizar publicidad.
- No aceptar recomendaciones automáticas de la plataforma.
- **Nada se cambia sin aprobación.**

El módulo `09_Cambios.gs` tiene esas reglas como candados en el código: una lista
blanca de tipos de cambio (`presupuesto_campana`, `mover_anuncio`), rechazo explícito
de cualquier cambio de precio/inventario/promoción/publicación, y validación contra
el tope de $1,500/día.

### Doble candado de escritura

1. Solo se aplican las filas con Estado **exactamente** `Aprobado`.
2. La propiedad `CAMBIOS_HABILITADOS` debe valer `SI`. Con `NO` (**valor por defecto**)
   el script **simula**: escribe en la columna Resultado la petición exacta que mandaría,
   sin tocar Mercado Libre.

---

## Umbrales editables (Propiedades del script)

| Propiedad | Default | Qué controla |
|---|---|---|
| `STOCK_MIN_FULL` | `2` | Alerta de stock FULL bajo |
| `ROAS_MIN` | `5.4` | Piso de rentabilidad |
| `ACOS_MAX` | `12` | ACOS máximo (%) |
| `TOPE_PRESUPUESTO` | `1500` | Tope de presupuesto diario total |
| `GASTO_SIN_VENTA` | `150` | Gasto sin ventas que dispara alerta |
| `CLICS_MIN_BAJAR` | `200` | Clics mínimos para marcar un anuncio candidato a bajar |
| `ADS_DIAS` | `7` | Ventana de métricas (corte en ayer) |
| `FULL_OPS_DIAS` | `30` | Ventana de recepciones FULL (ML topa en 60) |
| `ROAS_FUENTE` | `calculado` | `calculado` o `ml` |
| `CAMBIOS_HABILITADOS` | `NO` | Interruptor maestro de escritura |

---

## Límites conocidos

- **No hay endpoint público para ver envíos a FULL en tránsito.** Solo se ve lo ya
  recibido (`INBOUND_RECEPTION`). Lo que viene en camino se sigue por el panel de ML.
- `access_token` dura **6 h**. El `refresh_token` es de **un solo uso**: cada
  renovación devuelve uno nuevo. Por eso toda renovación va dentro de un `LockService`.
- El acceso se pierde si la app no se usa en **4 meses**, si cambia la contraseña de
  la cuenta, si se regenera el Secret o si se revocan permisos.
- Métricas de Product Ads: hasta **90 días** hacia atrás. Operaciones de FULL: rango
  máximo **60 días**.
- **Crear o gestionar campañas por API podría requerir ser desarrollador autorizado
  por ML. No está confirmado para esta cuenta.**

Ver `docs/endpoints.md` para el detalle de qué endpoint está verificado y cuál no.

## Riesgos de la primera corrida

- `403` en Ads → a la app le falta el permiso de publicidad.
- `404` en campañas/anuncios → la ruta documentada no aplica a esta cuenta; el script
  prueba rutas alternas y deja en el `Log` cuál respondió.
- SKU por variante vacío → `seller_custom_field` sin cargar en ML.
- Columnas de promoción vacías → no hay promoción vigente, o `sale_price` necesita `context`.
