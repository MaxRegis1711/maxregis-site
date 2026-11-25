// Entrega a configuracao do questionario SO a quem tem link valido: lista de criancas (nome abreviado + no do prontuario) e a chave publica de cifra.
// A lista fica em variavel de ambiente (PEI_CRIANCAS), nunca no codigo nem na pagina publica.
const { validarToken, resp, tokenDe } = require('./lib/pei');
const CHAVE = require('./lib/pei_chave');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return resp(405, { ok: false });
  const v = validarToken(tokenDe(event));
  if (!v.ok) return resp(v.motivo === 'configuracao' ? 500 : 401, { ok: false, motivo: v.motivo });
  let criancas = [];
  try { criancas = JSON.parse(process.env.PEI_CRIANCAS || '[]'); } catch (e) { return resp(500, { ok: false, motivo: 'configuracao' }); }
  return resp(200, { ok: true, criancas, chave: CHAVE });
};
