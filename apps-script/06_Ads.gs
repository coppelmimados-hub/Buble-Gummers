/**
 * 06_Ads.gs — Product Ads (PADS): anunciante, campanas y anuncios con metricas.
 *
 * Verificado en la documentacion de ML:
 *   GET /advertising/advertisers?product_id=PADS   (header  Api-Version: 1 )
 *       -> { advertisers: [ { advertiser_id, site_id, advertiser_name } ] }
 *   Campanas y anuncios con metricas usan el header  api-version: 2  y aceptan
 *   date_from, date_to, metrics, limit, offset. Las metricas llegan hasta 90
 *   dias hacia atras.
 *
 * NO VERIFICADO: la ruta exacta de campanas/anuncios aparece documentada de mas
 * de una forma segun el portal. Por eso se prueban rutas candidatas en orden y
 * se registra en el Log cual respondio. Si ninguna responde, la pestana queda
 * vacia con el detalle de los codigos de error (403 = falta permiso de
 * publicidad en la app; 404 = ruta equivocada para esta cuenta).
 *
 * ROAS y ACOS se CALCULAN a partir de ventas e inversion (ROAS_FUENTE =
 * 'calculado'). Poner ROAS_FUENTE = 'ml' para usar los campos que manda ML.
 */

var METRICAS_ADS = [
  'clicks', 'prints', 'ctr', 'cost', 'cpc', 'acos', 'roas', 'cvr',
  'units_quantity', 'direct_units_quantity', 'indirect_units_quantity',
  'total_amount', 'direct_amount', 'indirect_amount'
].join(',');

var H_ADS_V1 = { 'Api-Version': '1' };
var H_ADS_V2 = { 'api-version': '2' };

function rangoAds_() {
  var hasta = ayer_(); // corte en ayer: el dia en curso viene incompleto
  var desde = new Date(hasta.getTime() - (propNum('ADS_DIAS') - 1) * 24 * 3600 * 1000);
  return { date_from: iso_(desde), date_to: iso_(hasta) };
}

/** Anunciante PADS de la cuenta. Devuelve null si no hay o no hay permiso. */
function anunciante_() {
  var r = mlGetSuave('/advertising/advertisers', { product_id: 'PADS' }, H_ADS_V1);
  if (!r.ok) {
    log_('Ads: /advertising/advertisers fallo (' + r.code + '). ' +
         (r.code === 403 ? 'Revisar que la app tenga permiso de publicidad.' : r.error));
    return null;
  }
  var lista = (r.json && r.json.advertisers) || [];
  if (!lista.length) { log_('Ads: la cuenta no tiene anunciante PADS.'); return null; }
  var a = lista[0];
  if (lista.length > 1) log_('Ads: hay ' + lista.length + ' anunciantes; se usa ' + a.advertiser_id);
  setProp('ADVERTISER_ID', a.advertiser_id);
  log_('Ads: advertiser_id=' + a.advertiser_id + ' site=' + a.site_id);
  return a;
}

/** Campanas con metricas del rango. */
function campanas_(adv) {
  var rango = rangoAds_();
  var params = {
    date_from: rango.date_from,
    date_to: rango.date_to,
    metrics: METRICAS_ADS,
    limit: 100,
    offset: 0
  };
  var site = prop('SITE_ID');
  var r = primeraRutaQueResponde_('campanas', [
    '/advertising/advertisers/' + adv.advertiser_id + '/product_ads/campaigns',
    '/advertising/advertisers/' + adv.advertiser_id + '/product_ads/campaigns/search',
    '/marketplace/advertising/' + site + '/advertisers/' + adv.advertiser_id + '/product_ads/campaigns/search'
  ], params, H_ADS_V2);

  if (!r.json) {
    log_('Ads: ninguna ruta de campanas respondio. ' + r.fallos.join(' || '));
    return [];
  }
  var lista = r.json.results || r.json.campaigns || [];
  setProp('ADS_RUTA_CAMPANAS', r.ruta);
  log_('Ads: ' + lista.length + ' campanas (' + rango.date_from + ' a ' + rango.date_to + ')');
  return lista.map(function (c) { return normalizaCampana_(c); });
}

/** Anuncios (items) de una campana, con metricas del mismo rango. */
function anunciosDeCampana_(adv, campanaId) {
  var rango = rangoAds_();
  var params = {
    date_from: rango.date_from,
    date_to: rango.date_to,
    metrics: METRICAS_ADS,
    limit: 100,
    offset: 0
  };
  var site = prop('SITE_ID');
  var r = primeraRutaQueResponde_('anuncios', [
    '/advertising/advertisers/' + adv.advertiser_id + '/product_ads/campaigns/' + campanaId + '/items',
    '/advertising/product_ads/campaigns/' + campanaId + '/items',
    '/marketplace/advertising/' + site + '/advertisers/' + adv.advertiser_id + '/product_ads/campaigns/' + campanaId + '/items/search'
  ], params, H_ADS_V2);

  if (!r.json) {
    log_('Ads: anuncios de la campana ' + campanaId + ' sin respuesta. ' + r.fallos.join(' || '));
    return [];
  }
  setProp('ADS_RUTA_ANUNCIOS', r.ruta);
  var lista = r.json.results || r.json.items || [];
  return lista.map(function (a) { return normalizaAnuncio_(a, campanaId); });
}

function normalizaCampana_(c) {
  var m = c.metrics || c;
  var o = {
    id: c.id || c.campaign_id,
    nombre: c.name || c.campaign_name || '',
    estado: String(c.status || '').toUpperCase(),
    presupuesto: num_(c.budget),
    estrategia: c.strategy || '',
    acosObjetivo: c.acos_target !== undefined ? num_(c.acos_target) : '',
    clics: num_(m.clicks),
    impresiones: num_(m.prints),
    inversion: num_(m.cost),
    cpc: num_(m.cpc),
    ctr: num_(m.ctr),
    unidades: num_(m.units_quantity),
    ventas: ventas_(m),
    roasMl: m.roas !== undefined ? num_(m.roas) : '',
    acosMl: m.acos !== undefined ? num_(m.acos) : ''
  };
  aplicaRoasAcos_(o);
  return o;
}

function normalizaAnuncio_(a, campanaId) {
  var m = a.metrics || a;
  var o = {
    campanaId: campanaId,
    itemId: a.id || a.item_id,
    titulo: a.title || '',
    estado: String(a.status || '').toUpperCase(),
    clics: num_(m.clicks),
    impresiones: num_(m.prints),
    inversion: num_(m.cost),
    cpc: num_(m.cpc),
    ctr: num_(m.ctr),
    unidades: num_(m.units_quantity),
    ventas: ventas_(m),
    roasMl: m.roas !== undefined ? num_(m.roas) : '',
    acosMl: m.acos !== undefined ? num_(m.acos) : ''
  };
  aplicaRoasAcos_(o);
  return o;
}

/** Ventas atribuidas: total_amount, o la suma de directas + indirectas. */
function ventas_(m) {
  if (m.total_amount !== undefined && m.total_amount !== null) return num_(m.total_amount);
  return num_(m.direct_amount) + num_(m.indirect_amount);
}

/** ROAS y ACOS segun ROAS_FUENTE. Deja siempre las dos versiones a la vista. */
function aplicaRoasAcos_(o) {
  o.roasCalc = o.inversion > 0 ? redondea_(o.ventas / o.inversion, 2) : '';
  o.acosCalc = o.ventas > 0 ? redondea_((o.inversion / o.ventas) * 100, 2) : '';

  if (prop('ROAS_FUENTE') === 'ml') {
    o.roas = o.roasMl !== '' ? o.roasMl : o.roasCalc;
    o.acos = o.acosMl !== '' ? o.acosMl : o.acosCalc;
  } else {
    o.roas = o.roasCalc;
    o.acos = o.acosCalc;
  }
}
