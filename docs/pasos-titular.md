# Pasos para la titular — Bubble Gummers

Mensaje listo para reenviar. **Corrige el paso 2**: "Mis aplicaciones" no está
en el menú de la cuenta, se entra por URL directa.

---

Te paso los pasos para conectar la cuenta de Mercado Libre de Bubble Gummers.
La conexión sirve para vigilar el stock en Full, los precios y la publicidad.
**Todo cambio se revisa y se aprueba antes de aplicarse.**

## Parte 1 — Crear la aplicación (desde computadora)

1. Entra a **developers.mercadolibre.com.mx** con la **cuenta principal** de
   Bubble Gummers (BA BRANDS).
2. Pega esta dirección en la barra del navegador:
   **https://developers.mercadolibre.com.mx/devcenter**
   (no busques "Mis aplicaciones" en el menú de arriba, ahí no aparece).
3. Dale en **"Crear nueva aplicación"**.
4. Llénala así:
   - **Nombre:** Monitor BG
   - **Nombre corto:** monitorbg
   - **Descripción:** Monitoreo y gestión de stock Full, precios y publicidad
   - **Logo:** cualquier imagen de la marca
5. En **URI de redirección** pon exactamente: `https://www.google.com/`
6. Deja **apagada** la opción **PKCE**.
7. En permisos:
   - **Acceso offline:** activado
   - **Publicidad** y **publicaciones:** lectura y escritura
   - **Usuarios, envíos, precios, promociones y métricas:** solo lectura
   - Si alguna no da opción de solo lectura, déjala **apagada**
8. **No llenes** tópicos ni notificaciones. Guarda.
9. Te va a mostrar el **App ID** y el **Secret Key**. Mándamelos por mensaje
   privado. El Secret es como una contraseña: no lo compartas con nadie más.

> **Antes de crear:** fíjate si en el DevCenter ya aparece una aplicación creada.
> Si ya hay una, no crees otra — mándame el App ID de esa.

## Parte 2 — Autorizar

10. Yo te mando un link. Ábrelo con la cuenta principal de Bubble Gummers
    abierta y dale en **"Vincular"** (ese es el botón de permitir).
11. Te va a mandar a Google. **Copia la dirección completa de la barra de arriba**
    (empieza con `https://www.google.com/?code=TG-`) y mándamela de inmediato,
    porque caduca en unos minutos.

Si el código se vence no pasa nada: vuelves a abrir el mismo link, le das
Vincular otra vez y te da uno nuevo.

Si en algún paso te sale algo distinto, mándame captura y lo vemos.

---

## Notas para quien administra (no van en el mensaje)

- **Un usuario colaborador no puede autorizar apps.** ML devuelve
  `invalid_operator_user_id`. Tiene que ser la cuenta principal.
- En México solo se pueden crear apps con los **datos del titular cargados y
  validados**, y deben coincidir exactamente con los de apertura de la cuenta.
  Si el DevCenter rebota a la portada, ese suele ser el motivo.
- El `code` (`TG-…`) es de **un solo uso** y caduca en minutos. Hay que tener
  `CLIENT_ID` y `CLIENT_SECRET` ya cargados en el script antes de pedirlo.
- El **Secret no debería circular por chat**: va directo en Apps Script →
  ⚙️ Configuración del proyecto → Propiedades del script.
