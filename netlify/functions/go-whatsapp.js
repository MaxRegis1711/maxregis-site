// Netlify Function: /go/whatsapp
// Medição agregada sem cookies, sem armazenamento de IP e sem dados pessoais (LGPD).
// Registra apenas origem (utm_source / host do referer), página e placement, redirecionando 302 para o WhatsApp oficial.

const WA_PHONE = "5527992463839";
const DEFAULT_MSG = "Olá, Max! Gostaria de informações sobre disponibilidade e atendimento.";

function sanitizeToken(val, maxLen = 64) {
  if (!val || typeof val !== "string") return "direto";
  const clean = val.trim().toLowerCase().replace(/[^a-z0-9._/\-]/g, "").slice(0, maxLen);
  return clean || "direto";
}

function extractRefHost(referer) {
  if (!referer || typeof referer !== "string") return "none";
  try {
    return sanitizeToken(new URL(referer).hostname, 64);
  } catch {
    return "none";
  }
}

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const headers = event.headers || {};
  const referer = headers.referer || headers.Referer || "";

  const refHost = extractRefHost(referer);
  const rawSource = qs.src || qs.utm_source || (refHost !== "none" && refHost !== "maxregis.com.br" ? refHost : "site");
  const source = sanitizeToken(rawSource, 48);
  const page = sanitizeToken(qs.page || "/", 80);
  const placement = sanitizeToken(qs.placement || "default", 48);
  const msg = (typeof qs.msg === "string" && qs.msg.trim())
    ? qs.msg.trim().slice(0, 240)
    : DEFAULT_MSG;

  // Log estritamente agregado: zero IP, zero User-Agent, zero cookie, zero conteúdo da mensagem ou dado pessoal
  console.log(JSON.stringify({
    event: "whatsapp_click",
    day: new Date().toISOString().slice(0, 10),
    source,
    page,
    placement,
    refHost,
  }));

  const target = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(msg)}`;
  return {
    statusCode: 302,
    headers: {
      Location: target,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
    body: "",
  };
};
