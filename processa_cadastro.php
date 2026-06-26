<?php
/**
 * processa_cadastro.php
 * Recebe ficha de cadastro do paciente (POST JSON) e envia por email para Max.
 * Hospedar em: maxregis.com.br/cadastro/processa_cadastro.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// === CONFIGURAÇÃO ===
define('EMAIL_DESTINO', 'maxregis.o@gmail.com');
define('EMAIL_REMETENTE', 'noreply@maxregis.com.br');
define('NOME_REMETENTE', 'Sistema Cadastro | maxregis.com.br');
define('ASSUNTO_PREFIXO', '[CADASTRO-PACIENTE]');
// ====================

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['ok' => false, 'erro' => 'Método inválido']);
    exit;
}

$raw = file_get_contents('php://input');
$dados = json_decode($raw, true);

if (!$dados) {
    echo json_encode(['ok' => false, 'erro' => 'Dados inválidos']);
    exit;
}

// Sanitizar
function limpar($v) {
    return htmlspecialchars(trim((string)$v), ENT_QUOTES, 'UTF-8');
}

$nome = limpar($dados['nome_completo'] ?? '');
if (empty($nome)) {
    echo json_encode(['ok' => false, 'erro' => 'Nome obrigatório']);
    exit;
}

// Montar JSON limpo para NOUS processar
$payload = [
    'tipo'                  => 'NOVO_CADASTRO_PACIENTE',
    'fonte'                 => 'maxregis.com.br',
    'data_envio'            => $dados['data_envio'] ?? date('c'),
    'nome_completo'         => limpar($dados['nome_completo'] ?? ''),
    'data_nascimento'       => limpar($dados['data_nascimento'] ?? ''),
    'sexo'                  => limpar($dados['sexo'] ?? ''),
    'estado_civil'          => limpar($dados['estado_civil'] ?? ''),
    'escolaridade'          => limpar($dados['escolaridade'] ?? ''),
    'profissao'             => limpar($dados['profissao'] ?? ''),
    'telefone_whatsapp'     => limpar($dados['telefone_whatsapp'] ?? ''),
    'email'                 => limpar($dados['email'] ?? ''),
    'endereco'              => limpar($dados['endereco'] ?? ''),
    'contato_responsavel'   => limpar($dados['contato_responsavel'] ?? ''),
    'parentesco_responsavel'=> limpar($dados['parentesco_responsavel'] ?? ''),
    'diagnostico_medico'    => limpar($dados['diagnostico_medico'] ?? ''),
    'medicamentos'          => limpar($dados['medicamentos'] ?? ''),
    'outros_profissionais'  => limpar($dados['outros_profissionais'] ?? ''),
    'escola_instituicao'    => limpar($dados['escola_instituicao'] ?? ''),
    'encaminhante'          => limpar($dados['encaminhante'] ?? ''),
    'queixa_principal'      => limpar($dados['queixa_principal'] ?? ''),
];

$json_bonito = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

// Corpo do email em texto
$corpo_texto = "NOVO CADASTRO DE PACIENTE\n";
$corpo_texto .= str_repeat('=', 50) . "\n\n";
foreach ($payload as $chave => $valor) {
    if ($chave === 'tipo' || $chave === 'fonte') continue;
    $label = str_pad(str_replace('_', ' ', strtoupper($chave)), 25);
    $corpo_texto .= "{$label}: {$valor}\n";
}
$corpo_texto .= "\n" . str_repeat('-', 50) . "\n";
$corpo_texto .= "JSON para NOUS processar:\n\n" . $json_bonito . "\n";

// Corpo HTML do email
$linhas_html = '';
foreach ($payload as $chave => $valor) {
    if ($chave === 'tipo' || $chave === 'fonte' || empty($valor)) continue;
    $label = ucwords(str_replace('_', ' ', $chave));
    $linhas_html .= "<tr><td style='padding:6px 12px;font-weight:600;color:#2C5F8A;background:#F7F9FC;border-bottom:1px solid #E0E8F0;width:40%'>{$label}</td>"
                  . "<td style='padding:6px 12px;border-bottom:1px solid #E0E8F0'>{$valor}</td></tr>\n";
}

$corpo_html = <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Segoe UI,sans-serif;background:#F7F9FC;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #D0DCE8;overflow:hidden">
    <div style="background:#2C5F8A;color:#fff;padding:20px 24px">
      <h2 style="margin:0;font-size:1.2rem">📋 Novo Cadastro de Paciente</h2>
      <p style="margin:4px 0 0;opacity:.8;font-size:.9rem">maxregis.com.br — {$payload['data_envio']}</p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      {$linhas_html}
    </table>
    <div style="background:#F7F9FC;padding:16px 24px;font-size:.82rem;color:#6B7F92;border-top:1px solid #D0DCE8">
      <strong>Para NOUS:</strong><br>
      <pre style="background:#fff;border:1px solid #D0DCE8;border-radius:6px;padding:12px;overflow:auto;font-size:.78rem">{$json_bonito}</pre>
    </div>
  </div>
</body>
</html>
HTML;

// Assunto
$assunto = ASSUNTO_PREFIXO . ' ' . $nome . ' — ' . date('d/m/Y H:i');

// Headers do email
$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: " . NOME_REMETENTE . " <" . EMAIL_REMETENTE . ">\r\n";
$headers .= "Reply-To: " . limpar($dados['email'] ?? EMAIL_REMETENTE) . "\r\n";
$headers .= "X-Mailer: AGENTLAB-CadastroWeb/1.0\r\n";

$enviado = mail(EMAIL_DESTINO, $assunto, $corpo_html, $headers);

// Salvar backup local no servidor (pasta uploads/ — criar se não existir)
$backup_dir = __DIR__ . '/backups/';
if (!is_dir($backup_dir)) {
    mkdir($backup_dir, 0755, true);
}
$arquivo = $backup_dir . date('Ymd_His') . '_' . preg_replace('/[^a-z0-9]/i', '_', $nome) . '.json';
file_put_contents($arquivo, $json_bonito);

if ($enviado) {
    echo json_encode(['ok' => true, 'msg' => 'Ficha enviada com sucesso']);
} else {
    // Mesmo que o mail() falhe, o arquivo JSON foi salvo — não bloquear o usuário
    echo json_encode(['ok' => true, 'msg' => 'Ficha salva — aguardando processamento']);
}
?>
