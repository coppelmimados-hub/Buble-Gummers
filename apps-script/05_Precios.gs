/**
 * 05_Precios.gs — Precio base y precio de venta (promocion).
 *
 * Endpoints (verificados en la documentacion de ML):
 *   GET /items/{item_id}/prices
 *       -> { prices: [ { id, type: 'standard'|'promotion', amount, ... } ] }
 *   GET /items/{item_id}/sale_price
 *       -> { price_id, amount, regular_amount, currency_id, reference_date,
 *            metadata: { promotion_id, promotion_type } }
 *
 * Nota: sale_price acepta el parametro opcional `context` para filtrar canal.
 * Se consulta primero sin context; si falla, se reintenta con
 * context=channel_marketplace.
 */

function leerPrecios_(unidades) {
  // /items/{id}/prices es por publicacion, no por variante: se consulta una vez
  // por item y el resultado se reparte a sus variantes.
  var porItem = {};
  unidades.forEach(function (u) { porItem[u.itemId] = true; });
  var items = Object.keys(porItem);
  log_('Publicaciones a consultar precios: ' + items.length);

  var cache = {};
  items.forEach(function (id) { cache[id] = preciosDeItem_(id); });

  unidades.forEach(function (u) {
    var c = cache[u.itemId] || {};
    u.precioBase = c.base;
    u.precioPromo = c.promo;
    u.tipoPromo = c.tipoPromo || '';
    u.monedaPrecio = c.moneda || '';
    u.precioError = c.error || '';
  });
  return unidades;
}

function preciosDeItem_(itemId) {
  var out = { base: '', promo: '', tipoPromo: '', moneda: '', error: '' };

  var p = mlGetSuave('/items/' + itemId + '/prices');
  if (p.ok && p.json && p.json.prices) {
    p.json.prices.forEach(function (x) {
      var tipo = String(x.type || '').toLowerCase();
      if (tipo === 'standard' && out.base === '') out.base = num_(x.amount);
      if (tipo === 'promotion' && out.promo === '') out.promo = num_(x.amount);
      if (!out.moneda && x.currency_id) out.moneda = x.currency_id;
    });
  } else if (!p.ok) {
    out.error = 'prices ' + p.code;
  }

  var s = mlGetSuave('/items/' + itemId + '/sale_price');
  if (!s.ok) s = mlGetSuave('/items/' + itemId + '/sale_price', { context: 'channel_marketplace' });

  if (s.ok && s.json) {
    var j = s.json;
    if (j.amount !== undefined && j.amount !== null) out.promo = num_(j.amount);
    if (out.base === '' && j.regular_amount !== undefined && j.regular_amount !== null) {
      out.base = num_(j.regular_amount);
    }
    if (!out.moneda && j.currency_id) out.moneda = j.currency_id;
    if (j.metadata && j.metadata.promotion_type) out.tipoPromo = j.metadata.promotion_type;
  } else {
    out.error = (out.error ? out.error + ' | ' : '') + 'sale_price ' + s.code;
  }

  // Si promo == base no hay promocion vigente: se deja vacio para no confundir.
  if (out.promo !== '' && out.base !== '' && num_(out.promo) === num_(out.base)) {
    out.promo = '';
    out.tipoPromo = '';
  }
  return out;
}
