/**
 * 02_Api.gs — Cliente HTTP contra api.mercadolibre.com.
 * Reintentos, renovacion de token en 401 y paginacion.
 */

var MAX_REINTENTOS = 4;

/** GET que devuelve el JSON o lanza error. */
function mlGet(ruta, params, headers) {
  return mlFetch('get', ruta, params, null, headers).json;
}

/** GET tolerante: nunca lanza. Devuelve {ok, code, json, error}. */
function mlGetSuave(ruta, params, headers) {
  try {
    var r = mlFetch('get', ruta, params, null, headers);
    return { ok: true, code: r.code, json: r.json, error: null };
  } catch (e) {
    return { ok: false, code: e.httpCode || 0, json: null, error: String(e.message || e) };
  }
}

function mlPut(ruta, body, headers) {
  return mlFetch('put', ruta, null, body, headers).json;
}

function mlPost(ruta, body, headers) {
  return mlFetch('post', ruta, null, body, headers).json;
}

function mlFetch(metodo, ruta, params, body, headers) {
  var url = prop('API_HOST') + ruta + qs_(params);
  var espera = 1000;

  for (var intento = 1; intento <= MAX_REINTENTOS; intento++) {
    var opts = {
      method: metodo,
      headers: Object.assign(
        { Authorization: 'Bearer ' + token_(), accept: 'application/json' },
        headers || {}
      ),
      muteHttpExceptions: true
    };
    if (body) {
      opts.contentType = 'application/json';
      opts.payload = JSON.stringify(body);
    }

    var res = UrlFetchApp.fetch(url, opts);
    var code = res.getResponseCode();
    var txt = res.getContentText();

    if (code >= 200 && code < 300) {
      return { code: code, json: txt ? JSON.parse(txt) : null };
    }

    // Token vencido o revocado: renovar una vez y reintentar.
    if (code === 401 && intento === 1) {
      renovarToken_();
      continue;
    }

    // Rate limit o error del lado de ML: backoff exponencial.
    if ((code === 429 || code >= 500) && intento < MAX_REINTENTOS) {
      Utilities.sleep(espera);
      espera *= 2;
      continue;
    }

    var err = new Error(metodo.toUpperCase() + ' ' + ruta + ' -> ' + code + ' ' + txt.slice(0, 400));
    err.httpCode = code;
    throw err;
  }
  throw new Error('Se agotaron los reintentos en ' + ruta);
}

function qs_(params) {
  if (!params) return '';
  var partes = [];
  Object.keys(params).forEach(function (k) {
    var v = params[k];
    if (v === null || v === undefined || v === '') return;
    partes.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  });
  return partes.length ? '?' + partes.join('&') : '';
}

/**
 * Prueba una lista de rutas candidatas y devuelve la primera que responda 200.
 * Se usa donde la documentacion publica no deja clara la ruta definitiva
 * (campanas y anuncios de Product Ads). Deja registro de cual funciono.
 */
function primeraRutaQueResponde_(etiqueta, candidatas, params, headers) {
  var fallos = [];
  for (var i = 0; i < candidatas.length; i++) {
    var r = mlGetSuave(candidatas[i], params, headers);
    if (r.ok) {
      if (i > 0) log_('Ads: ' + etiqueta + ' respondio en la ruta alterna ' + candidatas[i]);
      return { json: r.json, ruta: candidatas[i], fallos: fallos };
    }
    fallos.push(candidatas[i] + ' -> ' + r.code + ' ' + (r.error || '').slice(0, 160));
  }
  return { json: null, ruta: null, fallos: fallos };
}

/** Parte un arreglo en bloques de n. */
function bloques_(arr, n) {
  var out = [];
  for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
