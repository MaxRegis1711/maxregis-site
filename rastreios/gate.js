/* Portão de acesso compartilhado para rastreios de Nível 2 (BDI, BHS, PHQ-9).
   Valida o código do paciente contra a Netlify Function verificar-codigo,
   que por sua vez confere a variável de ambiente PACIENTES_JSON (nunca
   fica no repositório público). Sem validação real, mostra aviso e não
   libera o formulário. */
(function(){
  function liberar(codigo){
    window.RASTREIO_GATE.codigoConfirmado = codigo;
    const gate = document.getElementById('gate');
    if(gate) gate.style.display = 'none';
    const cont = document.getElementById('conteudo');
    if(cont) cont.classList.add('visivel');
    document.querySelectorAll('.campoCodigoOculto').forEach(el=>el.value = codigo);
    const confEl = document.getElementById('confirmacaoNome');
    if(confEl) confEl.textContent = `Código ${codigo} confirmado`;
  }

  // Link com token assinado (?t=...): identifica o paciente sem ele digitar
  // nada. Se o token nao valer, cai no portao normal de codigo.
  async function tentarToken(){
    const t = new URLSearchParams(location.search).get('t');
    if(!t) return;
    try{
      const resp = await fetch('/.netlify/functions/validar-token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({token: t})
      });
      const data = await resp.json();
      if(data && data.valido && data.codigo){
        liberar(data.codigo);
        // limpa o token da barra de endereco para nao ficar em historico/print
        history.replaceState(null, '', location.pathname);
      } else {
        const erroEl = document.getElementById('erroCodigo');
        if(erroEl){
          erroEl.textContent = data && data.motivo === 'expirado'
            ? 'Este link expirou. Peça um novo ao seu psicólogo, ou use o código de acesso.'
            : 'Link inválido. Use o código de acesso que seu psicólogo te passou.';
          erroEl.style.color = '#C0392B';
          erroEl.style.display = 'block';
        }
      }
    }catch(e){ /* silencioso: o portao de codigo continua disponivel */ }
  }
  document.addEventListener('DOMContentLoaded', tentarToken);

  window.RASTREIO_GATE = {
    liberar,
    codigoConfirmado: null,
    async verificar(){
      const input = document.getElementById('codigoAcesso');
      const erroEl = document.getElementById('erroCodigo');
      const codigo = (input.value || '').trim().toUpperCase();
      if(!codigo){ erroEl.textContent = 'Digite o código de acesso.'; erroEl.style.display='block'; return; }
      erroEl.textContent = 'Verificando...'; erroEl.style.display='block'; erroEl.style.color = '#555';
      try{
        const resp = await fetch('/.netlify/functions/verificar-codigo', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({codigo})
        });
        const data = await resp.json();
        if(data && data.valido){
          // O endpoint NAO devolve o nome (evita enumeracao de pacientes).
          // A vinculacao resposta -> paciente e feita localmente por Max,
          // resolvendo o codigo contra o fichario.db.
          liberar(codigo);
        } else {
          erroEl.textContent = 'Código inválido. Confirme com seu psicólogo.'; erroEl.style.color = '#C0392B';
        }
      } catch(e){
        erroEl.textContent = 'Não foi possível verificar agora. Tente novamente em instantes.'; erroEl.style.color = '#C0392B';
      }
    }
  };
})();
