document.addEventListener('DOMContentLoaded', () => {
    const formSuporte = document.getElementById('formSuporte');
  
    if (formSuporte) {
      formSuporte.addEventListener('submit', (e) => {
        e.preventDefault();
  
        const assunto = document.getElementById('assuntoChamado').value;
        const mensagem = document.getElementById('mensagemChamado').value;
  
        // Seu número do WhatsApp com DDD (apenas números)
        const meuNumero = '5584999481693'; // <-- Coloque seu número aqui
  
        // Formata o texto para abrir no WhatsApp
        const textoFormatado = `*Novo Chamado de Suporte*%0A%0A*Assunto:* ${assunto}%0A*Mensagem:* ${mensagem}`;
  
        // Redireciona para o WhatsApp do Administrador
        const urlWhatsapp = `https://wa.me/${meuNumero}?text=${textoFormatado}`;
        window.open(urlWhatsapp, '_blank');
  
        formSuporte.reset();
      });
    }
  });