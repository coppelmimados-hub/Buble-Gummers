/**
 * 01_Auth.gs — OAuth 2.0 de Mercado Libre (authorization_code + refresh_token).
 *
 * Verificado en la documentacion de ML:
 *  - access_token dura 6 h (expires_in = 21600).
 *  - refresh_token es de UN SOLO USO: cada renovacion devuelve uno nuevo y el
 *    anterior deja de servir. Por eso toda renovacion va dentro de un lock y
 *    el token nuevo se guarda antes de usarse.
 *  - El acceso se pierde si la app no se usa en 4 meses, si cambia la
 *    contrasena de la cuenta, si se regenera el Secret o si se revocan permisos.
 *
 * PKCE esta APAGADO en la app (decision tomada), por eso no se envia
 * code_verifier/code_challenge.
 */

var MARGEN_RENOVACION_MS = 10 * 60 * 1000; // renueva 10 min antes de vencer

/** PASO 1 — genera el link que debe abrir la TITULAR (cuenta principal). */
function paso1_urlAutorizacion() {
  var url = prop('AUTH_HOST') + '/authorization'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(prop('CLIENT_ID'))
    + '&redirect_uri=' + encodeURIComponent(prop('REDIRECT_URI'))
    + '&state=bg' + Date.now();

  Logger.log('--- MANDAR ESTE LINK A LA TITULAR ---');
  Logger.log(url);
  log_('paso1: URL de autorizacion generada');

  try {
    SpreadsheetApp.getUi().alert(
      'Link de autorizacion',
      'Mandale este link a la titular. Despues de "Permitir", la barra queda en\n' +
      prop('REDIRECT_URI') + '?code=TG-...\n' +
      'Ese code se pega en la propiedad AUTH_CODE y se corre paso2 DE INMEDIATO.\n\n' + url,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) { /* sin UI: queda en el Log */ }
  return url;
}

/**
 * PASO 2 — canjea el code (TG-...) por access_token + refresh_token.
 * El code caduca en minutos: correr en cuanto llegue.
 * Lee la propiedad AUTH_CODE y la BORRA al terminar (es de un solo uso).
 */
function paso2_canjearCodigo() {
  var code = props_().getProperty('AUTH_CODE');
  if (!code) throw new Error('Carga primero la propiedad AUTH_CODE con el code TG-...');
  code = String(code).trim();

  // Tolera que peguen la URL completa en lugar del code.
  var m = code.match(/[?&]code=([^&\s]+)/);
  if (m) code = decodeURIComponent(m[1]);

  var r = postToken_({
    grant_type: 'authorization_code',
    client_id: prop('CLIENT_ID'),
    client_secret: prop('CLIENT_SECRET'),
    code: code,
    redirect_uri: prop('REDIRECT_URI')
  });

  guardarTokens_(r);
  props_().deleteProperty('AUTH_CODE');

  var msg = 'paso2 OK. user_id=' + r.user_id + ' scope=' + (r.scope || '(sin scope en la respuesta)');
  log_(msg);
  Logger.log(msg);
  return msg;
}

/** Devuelve un access_token valido, renovando si hace falta. */
function token_() {
  var p = props_();
  var at = p.getProperty('ACCESS_TOKEN');
  var exp = Number(p.getProperty('TOKEN_EXP') || 0);

  if (at && exp - MARGEN_RENOVACION_MS > Date.now()) return at;
  if (!p.getProperty('REFRESH_TOKEN')) {
    throw new Error('No hay REFRESH_TOKEN. Hay que repetir paso1 + paso2 con la titular.');
  }
  return renovarToken_();
}

/**
 * Renueva el access_token. El refresh_token es de un solo uso, asi que:
 *  - se serializa con LockService (dos corridas en paralelo quemarian el token),
 *  - se vuelve a leer la propiedad DENTRO del lock,
 *  - el token nuevo se guarda antes de devolverlo.
 */
function renovarToken_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) throw new Error('No se pudo tomar el lock para renovar el token');
  try {
    var p = props_();
    var at = p.getProperty('ACCESS_TOKEN');
    var exp = Number(p.getProperty('TOKEN_EXP') || 0);
    if (at && exp - MARGEN_RENOVACION_MS > Date.now()) return at; // otro hilo ya renovo

    var rt = p.getProperty('REFRESH_TOKEN');
    if (!rt) throw new Error('No hay REFRESH_TOKEN guardado.');

    var r = postToken_({
      grant_type: 'refresh_token',
      client_id: prop('CLIENT_ID'),
      client_secret: prop('CLIENT_SECRET'),
      refresh_token: rt
    });
    guardarTokens_(r);
    log_('Token renovado. Vence ' + ahora_() + ' + ' + (r.expires_in || '?') + 's');
    return r.access_token;
  } finally {
    lock.releaseLock();
  }
}

function postToken_(payload) {
  var res = UrlFetchApp.fetch(prop('API_HOST') + '/oauth/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { accept: 'application/json' },
    payload: payload,
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var txt = res.getContentText();
  if (code < 200 || code >= 300) {
    // No se registra el body de la peticion: lleva client_secret y el code.
    throw new Error('oauth/token devolvio ' + code + ': ' + txt.slice(0, 500));
  }
  var j = JSON.parse(txt);
  if (!j.access_token) throw new Error('oauth/token sin access_token: ' + txt.slice(0, 300));
  return j;
}

function guardarTokens_(r) {
  var vals = {
    ACCESS_TOKEN: r.access_token,
    TOKEN_EXP: String(Date.now() + (Number(r.expires_in || 21600) * 1000))
  };
  if (r.refresh_token) vals.REFRESH_TOKEN = r.refresh_token;
  if (r.user_id) vals.ML_USER_ID = String(r.user_id);
  if (r.scope) vals.SCOPE_OTORGADO = String(r.scope);
  props_().setProperties(vals, false);
}

/** Diagnostico: confirma que el token sirve y de que cuenta es. */
function diagnostico_quienSoy() {
  var me = mlGet('/users/me');
  var txt = 'user_id=' + me.id + ' | nickname=' + me.nickname
    + ' | site=' + me.site_id + ' | tipo=' + (me.user_type || '?')
    + ' | scope=' + (props_().getProperty('SCOPE_OTORGADO') || '(no informado)');
  log_('quienSoy: ' + txt);
  Logger.log(txt);
  return txt;
}

/** Borra tokens (p. ej. si se regenero el Secret y hay que reautorizar). */
function resetTokens() {
  ['ACCESS_TOKEN', 'REFRESH_TOKEN', 'TOKEN_EXP', 'ML_USER_ID', 'SCOPE_OTORGADO']
    .forEach(function (k) { props_().deleteProperty(k); });
  log_('Tokens borrados. Hay que repetir paso1 + paso2.');
}
