// Usada SO pelo PC de Max (Bearer PEI_BUSCA_SEGREDO). GET lista o que ainda nao foi recebido (texto cifrado); POST {ids} marca como recebido.
// Nada e apagado: o "recebido" e um marcador ao lado e o texto cifrado permanece como copia.
const { getStore, connectLambda } = require('@netlify/blobs');
const { autorizadoBusca, resp } = require('./lib/pei');

exports.handler = async (event) => {
  if (!autorizadoBusca(event)) return resp(401, { ok: false });
  try {
    connectLambda(event);
    const store = getStore('pei');
    if (event.httpMethod === 'POST') {
      const { ids } = JSON.parse(event.body || '{}');
      if (!Array.isArray(ids) || ids.length > 100 || !ids.every((i) => /^[0-9]+-[0-9a-f]{8}$/.test(i))) return resp(400, { ok: false });
      for (const id of ids) await store.set(`ack/${id}`, new Date().toISOString());
      return resp(200, { ok: true, marcados: ids.length });
    }
    if (event.httpMethod !== 'GET') return resp(405, { ok: false });
    const { blobs } = await store.list({ prefix: 'r/' });
    const itens = [];
    for (const b of blobs) {
      if (itens.length >= 50) break;
      const id = b.key.slice(2);
      if (await store.get(`ack/${id}`)) continue;
      const it = await store.get(b.key, { type: 'json' });
      if (it) itens.push(it);
    }
    return resp(200, { ok: true, itens });
  } catch (e) {
    console.error('pei-buscar:', e && e.message);
    return resp(500, { ok: false });
  }
};
