document.addEventListener('DOMContentLoaded', () => {
    const formPasso1 = document.getElementById('form-passo-1');
    const formPasso2 = document.getElementById('form-passo-2');
    const formPasso3 = document.getElementById('form-passo-3');
    const stepDescription = document.getElementById('step-description');
  
    let emailUsuario = '';
    let codigoVerificado = '';
  
    // PASSO 1: Enviar E-mail
    formPasso1.addEventListener('submit', async (e) => {
      e.preventDefault();
      emailUsuario = document.getElementById('email-recuperacao').value;
  
      // AQUI FARIA A CHAMADA PARA O BACKEND ENVIAR O CÓDIGO
      alert(`Código enviado para o e-mail: ${emailUsuario}`);
  
      // Transição para o Passo 2
      formPasso1.classList.remove('active');
      formPasso1.classList.add('hidden');
      formPasso2.classList.remove('hidden');
      formPasso2.classList.add('active');
  
      stepDescription.textContent = 'Digite o código de 6 dígitos enviado ao seu e-mail.';
    });
  
    // PASSO 2: Validar Código
    formPasso2.addEventListener('submit', async (e) => {
      e.preventDefault();
      codigoVerificado = document.getElementById('codigo-verificacao').value;
  
      // AQUI FARIA A CHAMADA PARA O BACKEND VALIDAR O CÓDIGO
      // Se o código estiver correto:
      formPasso2.classList.remove('active');
      formPasso2.classList.add('hidden');
      formPasso3.classList.remove('hidden');
      formPasso3.classList.add('active');
  
      stepDescription.textContent = 'Informe e confirme a sua nova senha.';
    });
  
    // PASSO 3: Redefinir Senha
    formPasso3.addEventListener('submit', async (e) => {
      e.preventDefault();
      const novaSenha = document.getElementById('nova-senha').value;
      const confirmarSenha = document.getElementById('confirmar-nova-senha').value;
  
      if (novaSenha !== confirmarSenha) {
        alert('As senhas não coincidem!');
        return;
      }
  
      // AQUI FARIA A CHAMADA PARA O BACKEND ATUALIZAR A SENHA NO BANCO
      alert('Senha alterada com sucesso!');
      window.location.href = 'index.html';
    });
  });