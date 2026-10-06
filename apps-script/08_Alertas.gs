/**
 * 08_Alertas.gs — Reglas de alerta de Bubble Gummers.
 *
 * Umbrales editables en Propiedades del script:
 *   STOCK_MIN_FULL (2) | ROAS_MIN (5.4) | ACOS_MAX (12) |
 *   TOPE_PRESUPUESTO (1500) | GASTO_SIN_VENTA (150) | CLICS_MIN_BAJAR (200)
 *
 * Las alertas NO cambian nada en Mercado Libre: solo describen y sugieren.
 * Toda accion pasa por la pestana Cambios con aprobacion explicita.
 */

function calcularAlertas_(unidades, campanas, anuncios, nombrePorCampana) {
  var f = ahora_();
  var a = [];
  var minStock = propNum('STOCK_MIN_FULL');
  var roasMin = propNum('ROAS_MIN');
  var acosMax = propNum('ACOS_MAX');
  var tope = propNum('TOPE_PRESUPUESTO');
  var gastoSinVenta = propNum('GASTO_SIN_VENTA');
  var clicsMin = propNum('CLICS_MIN_BAJAR');

  // --- FULL -----------------------------------------------------------------
  unidades.forEach(function (u) {
    var etq = u.titulo + (u.variacion ? ' [' + u.variacion + ']' : '');

    if (u.fullDisponible !== undefined && u.fullDisponible <= minStock) {
      a.push({
        fecha: f, severidad: u.fullDisponible === 0 ? 'alta' : 'media',
        tipo: 'Stock FULL bajo', objeto: etq, id: u.itemId,
        detalle: 'Disponible en FULL: ' + u.fullDisponible + ' (umbral ' + minStock + '). SKU ' + (u.sku || 's/sku'),
        sugerencia: 'Reponer en FULL. Recordatorio: no hay API publica de envios en transito, confirmar en el panel.'
      });
    }
    if (num_(u.fullDanado) > 0) {
      a.push({
        fecha: f, severidad: 'alta', tipo: 'Unidades danadas en FULL', objeto: etq, id: u.itemId,
        detalle: u.fullDanado + ' unidades con estado damage.',
        sugerencia: 'Abrir reclamo de reembolso por mercancia danada.'
      });
    }
    if (num_(u.fullPerdido) > 0) {
      a.push({
        fecha: f, severidad: 'alta', tipo: 'Unidades perdidas en FULL', objeto: etq, id: u.itemId,
        detalle: u.fullPerdido + ' unidades con estado lost.',
        sugerencia: 'Abrir reclamo de reembolso por mercancia perdida.'
      });
    }
  });

  // --- Precios (regla 5/9, redondeo hacia arriba) ----------------------------
  unidades.forEach(function (u) {
    var etq = u.titulo + (u.variacion ? ' [' + u.variacion + ']' : '');
    if (u.precioBase !== '' && u.precioBase !== undefined && !precioCumpleRegla(u.precioBase)) {
      a.push({
        fecha: f, severidad: 'media', tipo: 'Precio base fuera de regla', objeto: etq, id: u.itemId,
        detalle: 'Precio base ' + u.precioBase + ' no termina en 5 ni 9.',
        sugerencia: 'Subir a ' + sugerirPrecio(u.precioBase) + '.'
      });
    }
    if (u.precioPromo !== '' && u.precioPromo !== undefined && !precioCumpleRegla(u.precioPromo)) {
      a.push({
        fecha: f, severidad: 'media', tipo: 'Precio promo fuera de regla', objeto: etq, id: u.itemId,
        detalle: 'Precio promo ' + u.precioPromo + ' no termina en 5 ni 9.' +
                 (u.tipoPromo ? ' Promo: ' + u.tipoPromo + '.' : ''),
        sugerencia: 'Subir a ' + sugerirPrecio(u.precioPromo) + '.'
      });
    }
  });

  // --- Campanas --------------------------------------------------------------
  var sumaPresupuesto = 0;
  campanas.forEach(function (c) {
    var activa = c.estado === 'ACTIVE' || c.estado === 'ACTIVO';
    if (activa) sumaPresupuesto += num_(c.presupuesto);

    if (c.inversion > 0 && c.roas !== '' && num_(c.roas) < roasMin) {
      a.push({
        fecha: f, severidad: 'alta', tipo: 'Campana bajo el piso de ROAS', objeto: c.nombre, id: c.id,
        detalle: 'ROAS ' + c.roas + 'x contra piso ' + roasMin + 'x. Inversion ' + redondea_(c.inversion, 2) +
                 ', ventas ' + redondea_(c.ventas, 2) + '.',
        sugerencia: 'Ajustar PRESUPUESTO (nunca bajar precio). Proponer en la pestana Cambios.'
      });
    }
    if (c.inversion > 0 && c.acos !== '' && num_(c.acos) > acosMax) {
      a.push({
        fecha: f, severidad: 'alta', tipo: 'Campana sobre el ACOS maximo', objeto: c.nombre, id: c.id,
        detalle: 'ACOS ' + c.acos + '% contra maximo ' + acosMax + '%.',
        sugerencia: 'Ajustar PRESUPUESTO. No modificar precios ni publicaciones.'
      });
    }
  });

  if (sumaPresupuesto > tope) {
    a.push({
      fecha: f, severidad: 'alta', tipo: 'Presupuesto total sobre el tope', objeto: 'Product Ads BG', id: '',
      detalle: 'Suma de presupuestos activos ' + redondea_(sumaPresupuesto, 2) + ' contra tope ' + tope + '/dia.',
      sugerencia: 'Bajar presupuesto de las campanas menos rentables hasta volver al tope.'
    });
  }

  // --- Anuncios --------------------------------------------------------------
  anuncios.forEach(function (an) {
    var camp = nombrePorCampana[an.campanaId] || an.campanaId;

    if (an.inversion >= gastoSinVenta && num_(an.unidades) === 0 && num_(an.ventas) === 0) {
      a.push({
        fecha: f, severidad: 'alta', tipo: 'Anuncio gasta sin vender', objeto: an.titulo || an.itemId, id: an.itemId,
        detalle: 'Gasto ' + redondea_(an.inversion, 2) + ' sin ventas en la campana ' + camp + '.',
        sugerencia: 'Mover a "Aislamiento | Pruebas". No pausar el producto.'
      });
    }
    if (an.clics >= clicsMin && an.roas !== '' && num_(an.roas) < roasMin && an.inversion > 0) {
      a.push({
        fecha: f, severidad: 'media', tipo: 'Anuncio candidato a bajar de nivel', objeto: an.titulo || an.itemId, id: an.itemId,
        detalle: 'ROAS ' + an.roas + 'x con ' + an.clics + ' clics en la campana ' + camp + '.',
        sugerencia: 'Mover a una campana de menor nivel. No pausar, no cambiar precio.'
      });
    }
  });

  return a;
}
