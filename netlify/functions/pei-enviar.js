// Recebe o relatorio JA CIFRADO no navegador e guarda como esta. Esta funcao nunca consegue ler o conteudo (nao tem a chave privada).
const crypto = require('crypto');
const { getStore, connectLambda } = require('@netlify/blobs');
const { validarToken, resp, tokenDe } = require('./lib/pei');

const MAX_BYTES = 60000;

function pacoteValido(c) {
  return c && c.v === 1 && ['k', 'iv', 'd'].every((x) => typeof c[x] === 'string' && /^[A-Za-z0-9+/=]+$/.test(c[x]) && c[x].length < 50000);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, erro: 'Método não permitido.' });
  const v = validarToken(tokenDe(event));
  if (!v.ok) return resp(v.motivo === 'configuracao' ? 500 : 401, { ok: false, erro: v.motivo === 'expirado' ? 'Este link expirou. Peça um novo link.' : 'Link inválido.' });
  if ((event.body || '').length > MAX_BYTES) return resp(413, { ok: false, erro: 'Texto grande demais.' });
  let c;
  try { c = JSON.parse(event.body || '{}').c; } catch (e) { return resp(400, { ok: false, erro: 'Formato inválido.' }); }
  if (!pacoteValido(c)) return resp(400, { ok: false, erro: 'Formato inválido.' });
  try {
    connectLambda(event);
    const store = getStore('pei');
    const protocolo = crypto.createHash('sha256').update(c.d + c.iv).digest('hex').slice(0, 8);
    const id = `${Date.now()}-${protocolo}`;
    await store.setJSON(`r/${id}`, { id, quando: new Date().toISOString(), prof: v.prof, c });
    return resp(200, { ok: true, protocolo });
  } catch (e) {
    console.error('pei-enviar: falha ao guardar', e && e.message);
    return resp(503, { ok: false, erro: 'Não consegui guardar agora. Seu texto NÃO foi enviado: use Copiar texto e mande no WhatsApp.' });
  }
};
