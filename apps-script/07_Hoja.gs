/**
 * 07_Hoja.gs — Escritura de las pestanas de "BG - Monitor ML".
 */

function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Este script debe correr desde la hoja "BG - Monitor ML".');
  return ss;
}

function hoja_(nombre) {
  var ss = ss_();
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

/** Reemplaza el contenido de una pestana. No toca Cambios ni Log. */
function escribirHoja_(nombre, encabezados, filas) {
  var sh = hoja_(nombre);
  sh.clearContents();
  sh.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
    .setFontWeight('bold').setBackground('#efefef');
  if (filas.length) {
    sh.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
  }
  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, Math.min(encabezados.length, 20)); } catch (e) {}
  return sh;
}

function escribirFull_(unidades) {
  var enc = ['Item', 'Titulo', 'Variacion', 'SKU', 'Inventory ID', 'Logistica',
             'Stock publicado', 'FULL total', 'FULL disponible', 'FULL no disponible',
             'Danadas', 'Perdidas', 'Otro no disponible', 'Recibidas (rango)',
             'Ultima recepcion', 'Error'];
  var filas = unidades
    .filter(function (u) { return u.esFull || u.inventoryId; })
    .map(function (u) {
      return [u.itemId, u.titulo, u.variacion, u.sku, u.inventoryId, u.logistica,
              u.stockPublicado,
              v_(u.fullTotal), v_(u.fullDisponible), v_(u.fullNoDisponible),
              v_(u.fullDanado), v_(u.fullPerdido),
              (u.fullOtroNoDisp || []).join(' '),
              v_(u.fullRecibidas), u.fullUltimaRecepcion || '',
              u.fullError || ''];
    });
  escribirHoja_(HOJAS.FULL, enc, filas);
  return filas.length;
}

function escribirPrecios_(unidades) {
  var enc = ['Item', 'Titulo', 'Variacion', 'SKU', 'Moneda',
             'Precio base', 'Cumple 5/9', 'Sugerido base',
             'Precio promo', 'Cumple 5/9', 'Sugerido promo',
             'Tipo promo', 'Permalink', 'Error'];
  var filas = unidades.map(function (u) {
    return [u.itemId, u.titulo, u.variacion, u.sku, u.monedaPrecio || '',
            v_(u.precioBase), u.precioBase === '' ? '' : (precioCumpleRegla(u.precioBase) ? 'si' : 'NO'),
            u.precioBase === '' || precioCumpleRegla(u.precioBase) ? '' : sugerirPrecio(u.precioBase),
            v_(u.precioPromo), u.precioPromo === '' ? '' : (precioCumpleRegla(u.precioPromo) ? 'si' : 'NO'),
            u.precioPromo === '' || precioCumpleRegla(u.precioPromo) ? '' : sugerirPrecio(u.precioPromo),
            u.tipoPromo || '', u.permalink || '', u.precioError || ''];
  });
  escribirHoja_(HOJAS.PRECIOS, enc, filas);
  return filas.length;
}

function escribirCampanas_(camps) {
  var enc = ['Campana ID', 'Nombre', 'Estado', 'Presupuesto diario', 'Estrategia',
             'ACOS objetivo', 'Impresiones', 'Clics', 'CTR', 'CPC',
             'Inversion', 'Ventas', 'Unidades',
             'ROAS calc', 'ACOS calc %', 'ROAS ML', 'ACOS ML %'];
  var filas = camps.map(function (c) {
    return [c.id, c.nombre, c.estado, c.presupuesto, c.estrategia, c.acosObjetivo,
            c.impresiones, c.clics, redondea_(c.ctr, 4), redondea_(c.cpc, 2),
            redondea_(c.inversion, 2), redondea_(c.ventas, 2), c.unidades,
            c.roasCalc, c.acosCalc, c.roasMl, c.acosMl];
  });
  escribirHoja_(HOJAS.ADS_CAMPANAS, enc, filas);
  return filas.length;
}

function escribirAnuncios_(anuncios, nombrePorCampana) {
  var enc = ['Campana ID', 'Campana', 'Item', 'Titulo', 'Estado',
             'Impresiones', 'Clics', 'CTR', 'CPC',
             'Inversion', 'Ventas', 'Unidades',
             'ROAS calc', 'ACOS calc %', 'ROAS ML', 'ACOS ML %'];
  var filas = anuncios.map(function (a) {
    return [a.campanaId, nombrePorCampana[a.campanaId] || '', a.itemId, a.titulo, a.estado,
            a.impresiones, a.clics, redondea_(a.ctr, 4), redondea_(a.cpc, 2),
            redondea_(a.inversion, 2), redondea_(a.ventas, 2), a.unidades,
            a.roasCalc, a.acosCalc, a.roasMl, a.acosMl];
  });
  escribirHoja_(HOJAS.ADS_ANUNCIOS, enc, filas);
  return filas.length;
}

function escribirAlertas_(alertas) {
  var enc = ['Fecha', 'Severidad', 'Tipo', 'Objeto', 'ID', 'Detalle', 'Sugerencia'];
  var filas = alertas.map(function (a) {
    return [a.fecha, a.severidad, a.tipo, a.objeto, a.id, a.detalle, a.sugerencia || ''];
  });
  var sh = escribirHoja_(HOJAS.ALERTAS, enc, filas);
  if (filas.length) {
    // Rojo para alta, amarillo para media.
    for (var i = 0; i < filas.length; i++) {
      if (filas[i][1] === 'alta') sh.getRange(i + 2, 1, 1, enc.length).setBackground('#fde0e0');
      else if (filas[i][1] === 'media') sh.getRange(i + 2, 1, 1, enc.length).setBackground('#fff6d6');
    }
  }
  return filas.length;
}

/** '' cuando el valor no existe, para no escribir 0 falsos. */
function v_(x) {
  return (x === undefined || x === null) ? '' : x;
}
