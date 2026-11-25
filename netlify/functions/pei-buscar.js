// Usada SO pelo PC de Max (Bearer PEI_BUSCA_SEGREDO).
//   GET                      lista o que ainda nao foi tratado (texto cifrado); pula o que tem ack/ ou rej/.
//   POST {ids}               marca como recebido (ack/)
//   POST {rejeitados:[ids]}  marca como rejeitado em definitivo (rej/): sai da fila, o texto cifrado permanece
//   POST {revogar:[...]}     revoga um link ("tk-<12 da assinatura>") ou todos os links de um profissional ("prof-<apelido>")
// Nada e apagado: sao marcadores ao lado; o texto cifrado permanece como copia.
const { getStore, connectLambda } = require('@netlify/blobs');
const { autorizadoBusca, resp } = require('./lib/pei');

const ID = /^[0-9]+-[0-9a-f]{8}$/;
const REV = /^(prof-[a-z0-9-]{2,24}|tk-[A-Za-z0-9_-]{12})$/;
const lista = (x, re) => Array.isArray(x) && x.length <= 100 && x.every((i) => re.test(i));

exports.handler = async (event) => {
  if (!autorizadoBusca(event)) return resp(401, { ok: false });
  try {
    connectLambda(event);
    const store = getStore('pei');
    const agora = new Date().toISOString();
    if (event.httpMethod === 'POST') {
      const { ids = [], rejeitados = [], revogar = [] } = JSON.parse(event.body || '{}');
      if (!lista(ids, ID) || !lista(rejeitados, ID) || !lista(revogar, REV)) return resp(400, { ok: false });
      for (const id of ids) await store.set(`ack/${id}`, agora);
      for (const id of rejeitados) await store.set(`rej/${id}`, agora);
      for (const k of revogar) await store.set(`rev/${k}`, agora);
      return resp(200, { ok: true, marcados: ids.length, rejeitados: rejeitados.length, revogados: revogar.length });
    }
    if (event.httpMethod !== 'GET') return resp(405, { ok: false });
    const { blobs } = await store.list({ prefix: 'r/' });
    const itens = [];
    for (const b of blobs) {
      if (itens.length >= 50) break;
      const id = b.key.slice(2);
      if ((await store.get(`ack/${id}`)) || (await store.get(`rej/${id}`))) continue;
      const it = await store.get(b.key, { type: 'json' });
      if (it) itens.push(it);
    }
    return resp(200, { ok: true, itens });
  } catch (e) {
    console.error('pei-buscar:', e && e.message);
    return resp(500, { ok: false });
  }
};
