// Apoio das funcoes do questionario do PEI (Projeto Brincar / APAE). Sem dado de paciente aqui.
// Token do link: <prof>.<validade_epoch>.<assinatura> — HMAC-SHA256 de "<prof>.<validade>" com PEI_SEGREDO (mesmo padrao do validar-token.js).
const crypto = require('crypto');

function assinar(payload, segredo) {
  return crypto.createHmac('sha256', segredo).update(payload).digest('base64url');
}

function iguais(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Devolve { ok: true, prof } ou { ok: false, motivo }.
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

module.exports = { validarToken, autorizadoBusca, resp, tokenDe, assinar };
