/**
 * 04_Full.gs — Stock en FULL (fulfillment).
 *
 * Endpoints (verificados en la documentacion de ML):
 *   GET /inventories/{inventory_id}/stock/fulfillment
 *       -> { inventory_id, total, available_quantity, not_available_quantity,
 *             not_available_detail: [ { status, quantity } ] }
 *          status incluye "damage", "lost", "noFiscalCoverage", "withdrawal",
 *          "internal_process", entre otros.
 *   GET /stock/fulfillment/operations/search?inventory_id=...&date_from&date_to
 *       -> operaciones, incluye INBOUND_RECEPTION. Rango maximo 60 dias.
 *
 * LIMITE CONOCIDO: no existe endpoint publico para ver envios a FULL EN
 * TRANSITO. Solo se puede ver lo YA RECIBIDO (INBOUND_RECEPTION). Las unidades
 * en camino no aparecen aqui y hay que seguirlas por el panel de ML.
 */

/** Consulta el stock FULL de cada unidad con inventory_id. */
function leerFull_(unidades) {
  var conInv = unidades.filter(function (u) { return u.inventoryId; });
  log_('Unidades con inventory_id: ' + conInv.length + ' de ' + unidades.length);

  conInv.forEach(function (u) {
    var r = mlGetSuave('/inventories/' + u.inventoryId + '/stock/fulfillment');
    if (!r.ok) {
      u.fullError = r.code + ' ' + (r.error || '').slice(0, 120);
      return;
    }
    var j = r.json || {};
    u.fullTotal = num_(j.total);
    u.fullDisponible = num_(j.available_quantity);
    u.fullNoDisponible = num_(j.not_available_quantity);
    u.fullDanado = 0;
    u.fullPerdido = 0;
    u.fullOtroNoDisp = [];

    (j.not_available_detail || []).forEach(function (d) {
      var st = String(d.status || '').toLowerCase();
      var q = num_(d.quantity);
      if (st === 'damage' || st === 'damaged') u.fullDanado += q;
      else if (st === 'lost') u.fullPerdido += q;
      else if (q > 0) u.fullOtroNoDisp.push(st + ':' + q);
    });
  });

  return conInv;
}

/**
 * Recepciones en FULL de los ultimos N dias (INBOUND_RECEPTION).
 * ML limita el rango a 60 dias; FULL_OPS_DIAS se recorta a ese tope.
 * Es tolerante a fallos: si el endpoint no responde, se registra y sigue.
 */
function leerRecepcionesFull_(unidades) {
  var dias = Math.min(propNum('FULL_OPS_DIAS'), 60);
  var hasta = hoy_();
  var desde = new Date(hasta.getTime() - dias * 24 * 3600 * 1000);
  var conInv = unidades.filter(function (u) { return u.inventoryId; });
  var fallos = 0;

  conInv.forEach(function (u) {
    var r = mlGetSuave('/stock/fulfillment/operations/search', {
      inventory_id: u.inventoryId,
      date_from: iso_(desde),
      date_to: iso_(hasta),
      limit: 50
    });
    if (!r.ok) { fallos++; return; }

    var ops = (r.json && (r.json.results || r.json.operations)) || [];
    var recibidas = 0;
    var ultima = '';
    ops.forEach(function (o) {
      var tipo = String(o.type || o.operation_type || '').toUpperCase();
      if (tipo.indexOf('INBOUND') < 0) return;
      recibidas += num_(o.quantity !== undefined ? o.quantity : o.total);
      var f = o.date_created || o.date || '';
      if (f && (!ultima || f > ultima)) ultima = f;
    });
    u.fullRecibidas = recibidas;
    u.fullUltimaRecepcion = ultima ? String(ultima).slice(0, 10) : '';
  });

  if (fallos) log_('Operaciones FULL: ' + fallos + ' de ' + conInv.length + ' unidades sin respuesta.');
  return conInv;
}
