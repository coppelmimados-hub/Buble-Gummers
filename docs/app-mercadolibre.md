# App de Mercado Libre — Monitor BG

Creada el **2026-10-06** por la titular, con la cuenta principal **BA BRANDS**.

| Dato | Valor |
|---|---|
| Nombre | Monitor BG |
| **Client ID (App ID)** | `8537530305393558` |
| Client Secret | **no se versiona.** Va solo en Propiedades del script |
| Redirect URI | `https://www.google.com/` (con la diagonal final) |
| Sitio | MLM (México) |
| Estado | Aplicación no certificada — normal para uso propio |

En "Mis aplicaciones" aparece **una sola app**, así que no hay duda de cuál usar.

## Configuración registrada

**Flujos OAuth**

- Authorization Code: activado
- **Refresh Token: activado** (es el "acceso offline"; sin esto el token muere a las 6 h)
- Client Credentials: activado (no se usa)
- PKCE: apagado

**Permisos**

| Permiso | Acceso |
|---|---|
| Usuarios | Lectura y escritura (fijo, no se puede cambiar) |
| Publicación y sincronización | Lectura y escritura |
| Publicidad de un producto | Lectura y escritura |
| Métricas del negocio | Lectura |
| Promociones, cupones y descuentos | Lectura |
| Venta y envíos de un producto | Lectura |
| Comunicaciones pre y post ventas | Sin acceso |
| Facturación de una venta | Sin acceso |

**Tópicos y notificaciones:** ninguno. El monitor consulta cada 6 h por su
cuenta, no recibe avisos. Los tópicos no son scopes, así que se pueden agregar
después sin volver a autorizar.

> Nota: ML no documenta el mapeo exacto entre estos grupos de permisos de la
> pantalla y los endpoints. Se dio lectura tanto a "Métricas del negocio" como a
> "Venta y envíos" porque el stock de fulfillment podría caer en cualquiera de
> los dos. **Falta confirmarlo en la primera corrida.**

## Link de autorización

```
https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=8537530305393558&redirect_uri=https%3A%2F%2Fwww.google.com%2F
```

Lo abre **la titular**, con la cuenta principal de Bubble Gummers, y aprieta
**"Vincular"**. Queda en `https://www.google.com/?code=TG-...`

⚠️ **El code caduca en minutos y es de un solo uso.** Hay que tener
`CLIENT_ID`, `CLIENT_SECRET` y `REDIRECT_URI` ya cargados en el proyecto de
Apps Script ANTES de pedirlo. Si se vence, se vuelve a abrir el mismo link.
