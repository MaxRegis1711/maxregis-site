// Valida um token de rastreio assinado (HMAC) e devolve o codigo do paciente.
//
// Formato do token: <codigo>.<validade_epoch>.<assinatura_base64url>
// A assinatura e HMAC-SHA256 de "<codigo>.<validade>" com RASTREIO_SEGREDO.
//
// Por que assinado em vez de sorteado-e-guardado: nao precisa manter banco de
// tokens nem redeploy a cada link gerado. O token carrega a propria validade,
// e sem o segredo ninguem consegue forjar um.
//
// NAO devolve o nome do paciente — mesma razao do verificar-codigo.js: nome
// vindo de endpoint publico permite enumerar a lista de pacientes. A pagina
// so precisa saber QUAL codigo preencher no formulario; quem resolve o nome
// e o sync, no PC de Max.

const crypto = require('crypto');

function assinar(payload, segredo) {
  return crypto.createHmac('sha256', segredo).update(payload).digest('base64url');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valido: false }) };
  }

  const resposta = (corpo) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(corpo),
  });

  let token;
  try {
    ({ token } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return resposta({ valido: false, motivo: 'formato' });
  }

  const segredo = process.env.RASTREIO_SEGREDO;
  if (!segredo) {
    console.error('RASTREIO_SEGREDO nao configurado');
    return resposta({ valido: false, motivo: 'configuracao' });
  }

  const partes = String(token || '').split('.');
  if (partes.length !== 3) return resposta({ valido: false, motivo: 'formato' });

  const [codigo, validadeStr, assinaturaRecebida] = partes;
  const esperada = assinar(`${codigo}.${validadeStr}`, segredo);

  // comparacao em tempo constante: evita descobrir a assinatura por timing
  const a = Buffer.from(assinaturaRecebida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return resposta({ valido: false, motivo: 'assinatura' });
  }

  const validade = parseInt(validadeStr, 10);
  if (!Number.isFinite(validade) || Date.now() / 1000 > validade) {
    return resposta({ valido: false, motivo: 'expirado' });
  }

  return resposta({ valido: true, codigo: codigo.toUpperCase() });
};
