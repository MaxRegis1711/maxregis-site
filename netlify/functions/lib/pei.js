// Apoio das funcoes do questionario do PEI (Projeto Brincar / APAE). Sem dado de paciente aqui.
// Token do link: <prof>.<validade_epoch>.<assinatura> — HMAC-SHA256 de "<prof>.<validade>" com PEI_SEGREDO (mesmo padrao do validar-token.js).
// Revogacao: marcadores na caixa (rev/prof-<prof> revoga todos os links do profissional; rev/tk-<12 primeiros da assinatura> revoga um link).
const crypto = require('crypto');

const LIMITE_POR_HORA = 30;

function assinar(payload, segredo) {
  return crypto.createHmac('sha256', segredo).update(payload).digest('base64url');
}

function iguais(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Devolve { ok: true, prof } ou { ok: false, motivo }. So HMAC e validade; a revogacao e checada a parte (precisa da caixa).
function validarToken(token, agora = Date.now()) {
  const segredo = process.env.PEI_SEGREDO;
  if (!segredo) return { ok: false, motivo: 'configuracao' };
  const partes = String(token || '').split('.');
  if (partes.length !== 3 || !/^[a-z0-9-]{2,24}$/.test(partes[0])) return { ok: false, motivo: 'formato' };
  const [prof, validade, sig] = partes;
  if (!iguais(sig, assinar(`${prof}.${validade}`, segredo))) return { ok: false, motivo: 'assinatura' };
  const v = parseInt(validade, 10);
  if (!Number.isFinite(v) || agora / 1000 > v) return { ok: false, motivo: 'expirado' };
  return { ok: true, prof };
}

function marcadoresRevogacao(token, prof) {
  const sig = String(token).split('.')[2] || '';
  return [`rev/prof-${prof}`, `rev/tk-${sig.slice(0, 12)}`];
}

// Token valido E nao revogado. store = caixa (getStore). Falha ao ler a caixa nega o acesso (fecha por padrao).
async function validarTokenCompleto(store, token, agora = Date.now()) {
  const v = validarToken(token, agora);
  if (!v.ok) return v;
  try {
    for (const k of marcadoresRevogacao(token, v.prof)) if (await store.get(k)) return { ok: false, motivo: 'revogado' };
  } catch (e) {
    return { ok: false, motivo: 'indisponivel' };
  }
  return v;
}

// Contador por profissional e por hora (nao e atomico, mas basta para frear abuso). True = pode enviar.
async function podeEnviar(store, prof, max = LIMITE_POR_HORA) {
  const k = `rate/${prof}-${new Date().toISOString().slice(0, 13)}`;
  const n = parseInt((await store.get(k)) || '0', 10) || 0;
  if (n >= max) return false;
  await store.set(k, String(n + 1));
  return true;
}

function autorizadoBusca(event) {
  const segredo = process.env.PEI_BUSCA_SEGREDO;
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  return !!segredo && h.startsWith('Bearer ') && iguais(h.slice(7), segredo);
}

function resp(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    body: JSON.stringify(obj),
  };
}

function tokenDe(event) {
  return (event.headers && (event.headers['x-pei-token'] || event.headers['X-Pei-Token'])) || '';
}

module.exports = { validarToken, validarTokenCompleto, marcadoresRevogacao, podeEnviar, autorizadoBusca, resp, tokenDe, assinar, LIMITE_POR_HORA };
