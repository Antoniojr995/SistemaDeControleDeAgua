document.addEventListener('DOMContentLoaded', () => {
    // Gerenciamento das Abas
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
  
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
  
        // Remove a classe active de todos os botões e painéis
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
  
        // Adiciona a classe active no botão clicado e no painel correspondente
        button.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });
  
    // Evento Formulário Perfil
    const formPerfil = document.getElementById('formPerfil');
    if (formPerfil) {
      formPerfil.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Informações pessoais salvas com sucesso!');
      });
    }
  
    // Evento Formulário Segurança
    const formSeguranca = document.getElementById('formSeguranca');
    if (formSeguranca) {
      formSeguranca.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Senha atualizada com sucesso!');
      });
    }
  });