/**
 * 10_Main.gs — Orquestacion, menu y disparador.
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('BG Monitor ML')
      .addItem('1. Sembrar propiedades por defecto', 'sembrarPropiedadesPorDefecto')
      .addItem('2. Generar link de autorizacion', 'paso1_urlAutorizacion')
      .addItem('3. Canjear code (AUTH_CODE)', 'paso2_canjearCodigo')
      .addSeparator()
      .addItem('Quien soy (diagnostico)', 'diagnostico_quienSoy')
      .addItem('Actualizar todo', 'actualizarTodo')
      .addSeparator()
      .addItem('Aplicar cambios APROBADOS', 'aplicarCambiosAprobados')
      .addItem('Crear disparador cada 6 h', 'crearDisparador')
      .addToUi();
  } catch (e) { /* sin UI */ }
}

/** Corrida completa: FULL, Precios, Ads y Alertas. */
function actualizarTodo() {
  var t0 = Date.now();
  log_('=== actualizarTodo inicio ===');
  var resumen = [];

  // 1) Catalogo
  var ids = idsActivos_();
  var items = itemsDetalle_(ids);
  var unidades = unidades_(items);
  resumen.push(items.length + ' publicaciones, ' + unidades.length + ' unidades');

  // 2) FULL
  try {
    leerFull_(unidades);
    leerRecepcionesFull_(unidades);
    resumen.push(escribirFull_(unidades) + ' filas en FULL');
  } catch (e) {
    log_('ERROR FULL: ' + e.message);
    resumen.push('FULL con error: ' + e.message);
  }

  // 3) Precios
  try {
    leerPrecios_(unidades);
    resumen.push(escribirPrecios_(unidades) + ' filas en Precios');
  } catch (e) {
    log_('ERROR Precios: ' + e.message);
    resumen.push('Precios con error: ' + e.message);
  }

  // 4) Product Ads
  var campanas = [];
  var anuncios = [];
  var nombrePorCampana = {};
  try {
    var adv = anunciante_();
    if (adv) {
      campanas = campanas_(adv);
      campanas.forEach(function (c) { nombrePorCampana[c.id] = c.nombre; });
      campanas.forEach(function (c) {
        anuncios = anuncios.concat(anunciosDeCampana_(adv, c.id));
      });
    }
    resumen.push(escribirCampanas_(campanas) + ' campanas, ' +
                 escribirAnuncios_(anuncios, nombrePorCampana) + ' anuncios');
  } catch (e) {
    log_('ERROR Ads: ' + e.message);
    resumen.push('Ads con error: ' + e.message);
  }

  // 5) Alertas
  var alertas = calcularAlertas_(unidades, campanas, anuncios, nombrePorCampana);
  resumen.push(escribirAlertas_(alertas) + ' alertas');

  prepararHojaCambios();

  var msg = resumen.join(' | ') + ' | ' + Math.round((Date.now() - t0) / 1000) + 's';
  log_('=== actualizarTodo fin === ' + msg);
  return msg;
}

/** Disparador cada 6 horas. Borra los anteriores para no duplicar. */
function crearDisparador() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'actualizarTodo') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('actualizarTodo').timeBased().everyHours(6).create();
  log_('Disparador creado: actualizarTodo cada 6 h.');
  return 'Disparador creado (cada 6 h).';
}

function borrarDisparadores() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); n++; });
  log_('Disparadores borrados: ' + n);
  return n;
}
