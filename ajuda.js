document.addEventListener('DOMContentLoaded', () => {
    const formSuporte = document.getElementById('formSuporte');
  
    if (formSuporte) {
      formSuporte.addEventListener('submit', (e) => {
        e.preventDefault();
  
        const assunto = document.getElementById('assuntoChamado').value;
        const mensagem = document.getElementById('mensagemChamado').value;
  
        if (!assunto || !mensagem) {
          alert('Por favor, preencha todos os campos.');
          return;
        }
  
        // Aqui podes adicionar uma chamada API (fetch) para gravar o chamado na base de dados
        alert('Sua mensagem foi enviada ao administrador com sucesso! Responderemos em breve.');
        
        formSuporte.reset();
      });
    }
  });