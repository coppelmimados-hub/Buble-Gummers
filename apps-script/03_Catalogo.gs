/**
 * 03_Catalogo.gs — Publicaciones activas y sus variantes.
 *
 * Endpoints:
 *   GET /users/{user_id}/items/search?search_type=scan&status=active
 *   GET /items?ids=a,b,c&attributes=...   (multiget, maximo 20 ids)
 */

var ATRIBUTOS_ITEM = [
  'id', 'title', 'status', 'price', 'available_quantity', 'sold_quantity',
  'permalink', 'seller_custom_field', 'inventory_id', 'variations',
  'shipping', 'catalog_listing', 'listing_type_id'
].join(',');

function userId_() {
  var id = props_().getProperty('ML_USER_ID');
  if (id) return id;
  var me = mlGet('/users/me');
  setProp('ML_USER_ID', me.id);
  return String(me.id);
}

/** Todos los IDs de publicaciones activas (scan, sin tope de 1000). */
function idsActivos_() {
  var uid = userId_();
  var ids = [];
  var scroll = null;
  var vueltas = 0;

  do {
    var r = mlGet('/users/' + uid + '/items/search', {
      search_type: 'scan',
      status: 'active',
      limit: 100,
      scroll_id: scroll
    });
    var lote = (r && r.results) || [];
    ids = ids.concat(lote);
    scroll = r && r.scroll_id;
    if (!lote.length) break;
  } while (scroll && ++vueltas < 200);

  log_('Publicaciones activas: ' + ids.length);
  return ids;
}

/** Detalle de las publicaciones (multiget por bloques de 20). */
function itemsDetalle_(ids) {
  var out = [];
  bloques_(ids, 20).forEach(function (b) {
    var r = mlGet('/items', { ids: b.join(','), attributes: ATRIBUTOS_ITEM });
    (r || []).forEach(function (fila) {
      if (fila && fila.code === 200 && fila.body) out.push(fila.body);
      else if (fila && fila.body && fila.body.id) log_('Item no leido: ' + fila.body.id + ' code=' + fila.code);
    });
  });
  return out;
}

/**
 * Aplana publicaciones a "unidades": una fila por publicacion sin variantes,
 * o una por variante. Es la base de las pestanas FULL y Precios.
 */
function unidades_(items) {
  var out = [];
  items.forEach(function (it) {
    var logistica = (it.shipping && it.shipping.logistic_type) || '';
    var esFull = logistica === 'fulfillment';

    if (it.variations && it.variations.length) {
      it.variations.forEach(function (v) {
        out.push({
          itemId: it.id,
          titulo: it.title,
          permalink: it.permalink,
          logistica: logistica,
          esFull: esFull,
          variacionId: v.id,
          variacion: descVariacion_(v),
          sku: v.seller_custom_field || it.seller_custom_field || '',
          inventoryId: v.inventory_id || '',
          stockPublicado: v.available_quantity,
          precioPublicado: v.price !== undefined && v.price !== null ? v.price : it.price
        });
      });
    } else {
      out.push({
        itemId: it.id,
        titulo: it.title,
        permalink: it.permalink,
        logistica: logistica,
        esFull: esFull,
        variacionId: '',
        variacion: '',
        sku: it.seller_custom_field || '',
        inventoryId: it.inventory_id || '',
        stockPublicado: it.available_quantity,
        precioPublicado: it.price
      });
    }
  });
  return out;
}

/** "Talla: 23 | Color: Rosa" a partir de attribute_combinations. */
function descVariacion_(v) {
  var ac = v.attribute_combinations || [];
  return ac.map(function (a) {
    return (a.name || a.id) + ': ' + (a.value_name || a.value_id || '');
  }).join(' | ');
}
