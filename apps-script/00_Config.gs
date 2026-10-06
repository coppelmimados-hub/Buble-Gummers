/**
 * 00_Config.gs — BG Monitor ML
 * Configuracion, propiedades del script y utilidades base.
 *
 * Reglas de la cuenta que el codigo respeta (ver README):
 *  - Todo precio (base y promo) termina en 5 o 9, redondeando HACIA ARRIBA.
 *  - En campanas con bajo rendimiento se ajusta el PRESUPUESTO, nunca el precio.
 *  - No pausar productos. No modificar precios, inventario, promociones ni
 *    publicaciones al optimizar publicidad.
 *  - Nada se escribe en Mercado Libre sin aprobacion explicita en la hoja.
 */

/** Valores por defecto. Se sobreescriben con propiedades del script. */
var DEFAULTS = {
  REDIRECT_URI: 'https://www.google.com/',
  AUTH_HOST: 'https://auth.mercadolibre.com.mx',
  API_HOST: 'https://api.mercadolibre.com',
  SITE_ID: 'MLM',

  // Umbrales de alerta (editables en Propiedades del script)
  STOCK_MIN_FULL: '2',
  ROAS_MIN: '5.4',
  ACOS_MAX: '12',
  TOPE_PRESUPUESTO: '1500',
  GASTO_SIN_VENTA: '150',
  CLICS_MIN_BAJAR: '200',
  ADS_DIAS: '7',
  FULL_OPS_DIAS: '30',

  // 'calculado' = ROAS/ACOS a partir de ventas e inversion (default).
  // 'ml'        = usar los campos roas/acos que devuelve Mercado Libre.
  ROAS_FUENTE: 'calculado',

  // Interruptor maestro de escritura. 'NO' = la pestana Cambios solo SIMULA.
  CAMBIOS_HABILITADOS: 'NO'
};

/** Propiedades obligatorias que debe cargar la persona. */
var REQUERIDAS = ['CLIENT_ID', 'CLIENT_SECRET'];

var HOJAS = {
  FULL: 'FULL',
  PRECIOS: 'Precios',
  ADS_CAMPANAS: 'Ads campanas',
  ADS_ANUNCIOS: 'Ads anuncios',
  ALERTAS: 'Alertas',
  CAMBIOS: 'Cambios',
  LOG: 'Log'
};

function props_() {
  return PropertiesService.getScriptProperties();
}

/** Lee una propiedad; cae al default; lanza error si es obligatoria y falta. */
function prop(nombre) {
  var v = props_().getProperty(nombre);
  if (v === null || v === '') v = DEFAULTS.hasOwnProperty(nombre) ? DEFAULTS[nombre] : null;
  if ((v === null || v === '') && REQUERIDAS.indexOf(nombre) >= 0) {
    throw new Error('Falta la propiedad del script: ' + nombre);
  }
  return v;
}

function propNum(nombre) {
  var n = Number(prop(nombre));
  if (isNaN(n)) throw new Error('La propiedad ' + nombre + ' no es un numero: ' + prop(nombre));
  return n;
}

function setProp(nombre, valor) {
  props_().setProperty(nombre, String(valor));
}

/** Carga los defaults en Propiedades del script para que sean visibles/editables. */
function sembrarPropiedadesPorDefecto() {
  var p = props_();
  var actuales = p.getProperties();
  var nuevas = {};
  Object.keys(DEFAULTS).forEach(function (k) {
    if (!actuales.hasOwnProperty(k) || actuales[k] === '') nuevas[k] = DEFAULTS[k];
  });
  if (Object.keys(nuevas).length) p.setProperties(nuevas, false);
  var claves = Object.keys(nuevas);
  log_('Propiedades sembradas: ' + (claves.length ? claves.join(', ') : 'ninguna (ya estaban todas)'));
  return nuevas;
}

/* ---------------------------------------------------------------- utilidades */

function hoy_() {
  return new Date();
}

function ayer_() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function iso_(d) {
  return Utilities.formatDate(d, prop('TZ') || 'America/Mexico_City', 'yyyy-MM-dd');
}

function ahora_() {
  return Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Siguiente precio valido HACIA ARRIBA cuyo peso (ultimo digito entero)
 * termina en 5 o 9. 123 -> 125 | 126 -> 129 | 129 -> 129 | 130 -> 135.
 */
function sugerirPrecio(monto) {
  if (monto === null || monto === undefined || monto === '' || isNaN(Number(monto))) return '';
  var n = Math.ceil(Number(monto));
  var guard = 0;
  while (guard++ < 20) {
    var d = n % 10;
    if (d === 5 || d === 9) return n;
    n++;
  }
  return n;
}

/** true si el monto ya cumple la regla de terminacion 5/9 (sin centavos). */
function precioCumpleRegla(monto) {
  if (monto === null || monto === undefined || monto === '' || isNaN(Number(monto))) return true;
  var n = Number(monto);
  if (n !== Math.floor(n)) return false; // centavos => no cumple
  var d = n % 10;
  return d === 5 || d === 9;
}

function redondea_(n, dec) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '';
  var f = Math.pow(10, dec === undefined ? 2 : dec);
  return Math.round(Number(n) * f) / f;
}

function num_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

/** Log a la pestana Log (y a Logger). Nunca escribe secretos. */
function log_(msg) {
  try {
    Logger.log(msg);
  } catch (e) { /* ignorar */ }
  try {
    var sh = hojaLog_();
    sh.appendRow([ahora_(), String(msg).slice(0, 2000)]);
  } catch (e) { /* la hoja puede no existir al correr desde el editor */ }
}

function hojaLog_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Sin hoja activa');
  var sh = ss.getSheetByName(HOJAS.LOG);
  if (!sh) {
    sh = ss.insertSheet(HOJAS.LOG);
    sh.appendRow(['Fecha', 'Mensaje']);
    sh.setFrozenRows(1);
  }
  return sh;
}
