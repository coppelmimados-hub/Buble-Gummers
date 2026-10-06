/**
 * 09_Cambios.gs — Flujo de cambios con aprobacion previa.
 *
 * Regla de la cuenta: NADA se cambia en Mercado Libre sin aprobacion.
 * El flujo es: el script (o la persona) PROPONE una fila -> alguien escribe
 * "Aprobado" en la columna Estado -> se corre aplicarCambiosAprobados() ->
 * el script aplica SOLO esas filas y escribe el resultado.
 *
 * Doble candado:
 *   1. Solo se aplican filas con Estado exactamente "Aprobado".
 *   2. La propiedad CAMBIOS_HABILITADOS debe valer "SI". Con "NO" (default)
 *      el script SIMULA: escribe en Resultado la peticion exacta que mandaria,
 *      sin tocar Mercado Libre.
 *
 * Tipos permitidos (lista blanca). Cualquier otro se rechaza:
 *   presupuesto_campana  -> cambia el presupuesto diario de una campana
 *   mover_anuncio        -> mueve un anuncio de campana
 *
 * Tipos PROHIBIDOS por regla de la cuenta (el codigo los rechaza):
 *   precio, promocion, inventario, publicacion, pausar producto.
 */

var CAMBIOS_PERMITIDOS = ['presupuesto_campana', 'mover_anuncio'];
var CAMBIOS_PROHIBIDOS = ['precio', 'promocion', 'inventario', 'publicacion', 'pausar'];

var COLS_CAMBIOS = ['ID cambio', 'Fecha propuesta', 'Tipo', 'Objeto', 'ID objeto',
                    'Campo', 'Valor actual', 'Valor propuesto', 'Motivo',
                    'Estado', 'Aplicado en', 'Resultado'];

/** Crea la pestana Cambios si no existe. Nunca borra lo que ya hay. */
function prepararHojaCambios() {
  var ss = ss_();
  var sh = ss.getSheetByName(HOJAS.CAMBIOS);
  if (!sh) {
    sh = ss.insertSheet(HOJAS.CAMBIOS);
    sh.appendRow(COLS_CAMBIOS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLS_CAMBIOS.length).setFontWeight('bold').setBackground('#efefef');

    // Validacion en la columna Estado.
    var regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(['', 'Propuesto', 'Aprobado', 'Rechazado', 'Aplicado', 'Error'], true)
      .setAllowInvalid(false).build();
    sh.getRange(2, 10, 500, 1).setDataValidation(regla);
    log_('Pestana Cambios creada.');
  }
  return sh;
}

/** Agrega una propuesta (no aplica nada). */
function proponerCambio_(tipo, objeto, idObjeto, campo, valorActual, valorPropuesto, motivo) {
  var sh = prepararHojaCambios();
  sh.appendRow(['C' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                ahora_(), tipo, objeto, idObjeto, campo,
                valorActual, valorPropuesto, motivo, 'Propuesto', '', '']);
}

/**
 * Aplica SOLO las filas con Estado = "Aprobado".
 * Con CAMBIOS_HABILITADOS != 'SI' simula y escribe la peticion en Resultado.
 */
function aplicarCambiosAprobados() {
  var sh = prepararHojaCambios();
  var ultima = sh.getLastRow();
  if (ultima < 2) { log_('Cambios: no hay filas.'); return 'Sin filas'; }

  var datos = sh.getRange(2, 1, ultima - 1, COLS_CAMBIOS.length).getValues();
  var habilitado = String(prop('CAMBIOS_HABILITADOS')).toUpperCase() === 'SI';
  var aplicados = 0, simulados = 0, errores = 0;

  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    if (String(fila[9]).trim() !== 'Aprobado') continue;

    var r = fila0_(fila);
    var res;
    try {
      res = ejecutarCambio_(r, habilitado);
    } catch (e) {
      res = { estado: 'Error', texto: String(e.message || e) };
    }

    sh.getRange(i + 2, 10).setValue(res.estado);
    sh.getRange(i + 2, 11).setValue(ahora_());
    sh.getRange(i + 2, 12).setValue(res.texto);

    if (res.estado === 'Aplicado') aplicados++;
    else if (res.estado === 'Simulado') simulados++;
    else errores++;
  }

  var msg = 'Cambios: ' + aplicados + ' aplicados, ' + simulados + ' simulados, ' + errores + ' con error.' +
            (habilitado ? '' : ' (CAMBIOS_HABILITADOS=NO: no se toco Mercado Libre)');
  log_(msg);
  return msg;
}

function fila0_(f) {
  return {
    id: f[0], tipo: String(f[2] || '').trim().toLowerCase(), objeto: f[3],
    idObjeto: String(f[4] || '').trim(), campo: String(f[5] || '').trim(),
    valorActual: f[6], valorPropuesto: f[7], motivo: f[8]
  };
}

function ejecutarCambio_(r, habilitado) {
  // Candado de reglas de la cuenta.
  for (var i = 0; i < CAMBIOS_PROHIBIDOS.length; i++) {
    if (r.tipo.indexOf(CAMBIOS_PROHIBIDOS[i]) >= 0) {
      return { estado: 'Error', texto: 'RECHAZADO: "' + r.tipo + '" toca ' + CAMBIOS_PROHIBIDOS[i] +
               '. Regla de la cuenta: no se modifican precios, inventario, promociones ni publicaciones por este flujo.' };
    }
  }
  if (CAMBIOS_PERMITIDOS.indexOf(r.tipo) < 0) {
    return { estado: 'Error', texto: 'Tipo no permitido: "' + r.tipo + '". Permitidos: ' + CAMBIOS_PERMITIDOS.join(', ') };
  }

  var advId = props_().getProperty('ADVERTISER_ID');
  if (!advId) return { estado: 'Error', texto: 'Falta ADVERTISER_ID. Corre actualizarTodo() primero.' };

  if (r.tipo === 'presupuesto_campana') {
    var nuevo = Number(r.valorPropuesto);
    if (isNaN(nuevo) || nuevo <= 0) return { estado: 'Error', texto: 'Presupuesto propuesto invalido: ' + r.valorPropuesto };

    var tope = propNum('TOPE_PRESUPUESTO');
    if (nuevo > tope) {
      return { estado: 'Error', texto: 'RECHAZADO: ' + nuevo + ' supera el tope de ' + tope + '/dia de Product Ads BG.' };
    }

    var ruta = '/advertising/advertisers/' + advId + '/product_ads/campaigns/' + r.idObjeto;
    var body = { budget: nuevo };

    if (!habilitado) {
      return { estado: 'Simulado', texto: 'PUT ' + ruta + ' ' + JSON.stringify(body) +
               ' (header api-version: 2). Poner CAMBIOS_HABILITADOS=SI para aplicarlo de verdad.' };
    }
    var resp = mlPut(ruta, body, H_ADS_V2);
    return { estado: 'Aplicado', texto: 'OK. Presupuesto -> ' + nuevo + '. Respuesta: ' + JSON.stringify(resp).slice(0, 300) };
  }

  if (r.tipo === 'mover_anuncio') {
    // r.idObjeto = item id ; r.valorPropuesto = campaign id destino
    var destino = String(r.valorPropuesto || '').trim();
    if (!destino) return { estado: 'Error', texto: 'Falta la campana destino en Valor propuesto.' };

    var ruta2 = '/advertising/advertisers/' + advId + '/product_ads/campaigns/' + destino + '/items/' + r.idObjeto;
    var body2 = { status: 'active' };

    if (!habilitado) {
      return { estado: 'Simulado', texto: 'PUT ' + ruta2 + ' ' + JSON.stringify(body2) +
               ' (header api-version: 2). RUTA NO VERIFICADA: probar primero con un anuncio de prueba.' };
    }
    var resp2 = mlPut(ruta2, body2, H_ADS_V2);
    return { estado: 'Aplicado', texto: 'OK. Movido a campana ' + destino + '. Respuesta: ' + JSON.stringify(resp2).slice(0, 300) };
  }

  return { estado: 'Error', texto: 'Tipo sin implementacion: ' + r.tipo };
}
