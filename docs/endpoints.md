# Endpoints usados y estado de verificación

Fecha de revisión: **2026-10-06**.

> `developers.mercadolibre.com.mx` está bloqueado por la política de red del
> entorno donde se escribió este código, así que la verificación de esta sesión
> se hizo contra resultados de búsqueda de la documentación oficial de ML, no
> contra la página directa. **Lo marcado como NO VERIFICADO hay que confirmarlo
> en la primera corrida real contra la cuenta.**

## OAuth

| Endpoint | Estado |
|---|---|
| `GET {AUTH_HOST}/authorization?response_type=code&client_id=&redirect_uri=` | Verificado (flujo estándar de ML). `AUTH_HOST` para MLM: `https://auth.mercadolibre.com.mx` |
| `POST https://api.mercadolibre.com/oauth/token` | **Verificado.** `Content-Type: application/x-www-form-urlencoded` |

Parámetros del body:

- `grant_type=authorization_code` + `client_id`, `client_secret`, `code`, `redirect_uri`
- `grant_type=refresh_token` + `client_id`, `client_secret`, `refresh_token`

Respuesta: `access_token`, `token_type`, `expires_in` (21600 = 6 h), `scope`,
`user_id`, `refresh_token`.

**El `refresh_token` es de un solo uso.** Cada renovación devuelve uno nuevo y
el anterior deja de servir. Por eso `renovarToken_()` corre dentro de un
`LockService`: dos corridas en paralelo quemarían el token y obligarían a
reautorizar con la titular.

## Publicaciones

| Endpoint | Estado |
|---|---|
| `GET /users/me` | Verificado |
| `GET /users/{user_id}/items/search?search_type=scan&status=active` | Verificado |
| `GET /items?ids=...&attributes=...` (multiget, máx. 20 ids) | Verificado |

## FULL (fulfillment)

| Endpoint | Estado |
|---|---|
| `GET /inventories/{inventory_id}/stock/fulfillment` | **Verificado** |
| `GET /stock/fulfillment/operations/search` | Verificado; rango máximo 60 días |

Respuesta de stock: `inventory_id`, `total`, `available_quantity`,
`not_available_quantity`, `not_available_detail[] = { status, quantity }`.
Estados de `status`: `damage`, `lost`, `noFiscalCoverage`, `withdrawal`,
`internal_process`, entre otros. La API informa los últimos 12 meses.

**Límite conocido: no existe endpoint público para ver envíos a FULL EN
TRÁNSITO.** Solo se puede ver lo ya recibido (`INBOUND_RECEPTION`).

## Precios

| Endpoint | Estado |
|---|---|
| `GET /items/{item_id}/prices` | **Verificado.** Devuelve `prices[]` con `type: standard \| promotion` |
| `GET /items/{item_id}/sale_price` | **Verificado.** `amount`, `regular_amount`, `currency_id`, `reference_date`, `metadata.promotion_id`, `metadata.promotion_type` |

`sale_price` acepta el parámetro opcional `context` para filtrar canal de venta
y nivel de comprador. El script consulta primero sin `context` y reintenta con
`context=channel_marketplace`.

## Product Ads

| Endpoint | Estado |
|---|---|
| `GET /advertising/advertisers?product_id=PADS` — header `Api-Version: 1` | **Verificado.** Devuelve `advertisers[] = { advertiser_id, site_id, advertiser_name }` |
| Campañas con métricas — header `api-version: 2` | **NO VERIFICADO** (ver abajo) |
| Anuncios con métricas — header `api-version: 2` | **NO VERIFICADO** |

Valores de `product_id`: `PADS` (Product Ads), `DISPLAY`, `BADS` (Brand Ads).

### Por qué las rutas de campañas/anuncios no están verificadas

La documentación aparece con **más de una forma de la ruta** según el portal:

```
/advertising/advertisers/{advertiser_id}/product_ads/campaigns
/advertising/advertisers/{advertiser_id}/product_ads/campaigns/search
/marketplace/advertising/{site_id}/advertisers/{advertiser_id}/product_ads/campaigns/search
```

`06_Ads.gs` prueba las tres **en ese orden** y usa la primera que responda 200.
Deja en el `Log` y en las propiedades `ADS_RUTA_CAMPANAS` / `ADS_RUTA_ANUNCIOS`
cuál funcionó. Si ninguna responde, la pestaña queda vacía con el detalle de los
códigos de error.

Parámetros aceptados: `date_from`, `date_to`, `metrics`, `limit`, `offset`.
Métricas disponibles: `clicks`, `prints`, `ctr`, `cost`, `cpc`, `acos`, `roas`,
`cvr`, `sov`, `units_quantity`, `direct_units_quantity`,
`indirect_units_quantity`, `direct_amount`, `indirect_amount`, `total_amount`,
`organic_units_quantity`, `organic_items_quantity`, y otras.

Las métricas llegan hasta **90 días** hacia atrás. La app necesita el scope
`advertising/product_ads`.

### ROAS y ACOS

El script los **calcula** a partir de ventas e inversión:

```
ROAS = ventas / inversión
ACOS = inversión / ventas * 100
```

Y además deja a la vista los campos `roas` / `acos` que manda ML, en columnas
aparte, para poder compararlos. La propiedad `ROAS_FUENTE` decide cuál se usa
para disparar las alertas (`calculado` por defecto, `ml` para usar los de ML).

## Escritura (pestaña Cambios)

| Endpoint | Estado |
|---|---|
| `PUT /advertising/advertisers/{adv}/product_ads/campaigns/{id}` body `{budget}` | **NO VERIFICADO** |
| `PUT /advertising/advertisers/{adv}/product_ads/campaigns/{dest}/items/{item}` | **NO VERIFICADO** |

Por eso `CAMBIOS_HABILITADOS` viene en `NO`: con ese valor el script **no toca
Mercado Libre**, solo escribe en la columna Resultado la petición exacta que
mandaría. Hay que confirmar la ruta con un cambio chico antes de habilitarlo.

**Crear o gestionar campañas por API podría requerir ser desarrollador
autorizado por ML. No está confirmado para esta cuenta.**
