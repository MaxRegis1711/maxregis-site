// Valida se um código de paciente existe. Responde APENAS {valido:true|false}.
//
// NUNCA devolve o nome do paciente. Motivo (corrigido em 26/08/2026): a versão
// anterior retornava o nome completo, e como os códigos são sequenciais (P001,
// P002...), qualquer pessoa poderia enumerar de P001 a P999 e extrair a lista
// inteira de pacientes — vazamento de dado sensível de saúde (LGPD art. 11 e
// sigilo profissional CFP).
//
// A vinculação resposta -> paciente acontece LOCALMENTE, no PC de Max
// (scripts/sync_rastreios_pendencias.py), que resolve o código contra o
// fichario.db. O navegador do paciente nunca precisa saber o nome.
//
// A lista vive na variável de ambiente PACIENTES_JSON, no painel do Netlify —
// nunca no repositório, que é público.

const ATRASO_MS = 400; // desacelera enumeração em massa sem incomodar quem digita 1 código

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valido: false }) };
  }

  let codigo;
  try {
    ({ codigo } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ valido: false }) };
  }

  await dormir(ATRASO_MS);

  const cod = String(codigo || '').trim().toUpperCase();
  const resposta = (valido) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ valido }),
  });

  if (!cod) return resposta(false);

  let lista = {};
  try {
    lista = JSON.parse(process.env.PACIENTES_JSON || '{}');
  } catch (e) {
    // Falha de configuração não deve virar oráculo: responde como código inválido.
    console.error('PACIENTES_JSON ausente ou malformado');
    return resposta(false);
  }

  return resposta(Object.prototype.hasOwnProperty.call(lista, cod));
};
