document.addEventListener('DOMContentLoaded', () => {
  const formPasso1 = document.getElementById('form-passo-1');
  const formPasso2 = document.getElementById('form-passo-2');
  const formPasso3 = document.getElementById('form-passo-3');
  const stepDescription = document.getElementById('step-description');

  let emailUsuario = '';

  // PASSO 1: Enviar E-mail com o Código
  if (formPasso1) {
    formPasso1.addEventListener('submit', async (e) => {
      e.preventDefault();
      emailUsuario = document.getElementById('email-recuperacao').value;

      try {
        const response = await fetch('/api/solicitar-codigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.erro || 'Erro ao enviar e-mail.');
        }

        alert('Código enviado com sucesso! Verifique a sua caixa de entrada.');
        
        formPasso1.classList.remove('active');
        formPasso1.classList.add('hidden');
        formPasso2.classList.remove('hidden');
        formPasso2.classList.add('active');
        if (stepDescription) {
          stepDescription.textContent = 'Digite o código de 6 dígitos enviado ao seu e-mail.';
        }

      } catch (err) {
        alert(err.message);
      }
    });
  }

  // PASSO 2: Validar o Código
  if (formPasso2) {
    formPasso2.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codigo = document.getElementById('codigo-verificacao').value;

      try {
        const response = await fetch('/api/validar-codigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario, codigo })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.erro || 'Código inválido.');
        }

        formPasso2.classList.remove('active');
        formPasso2.classList.add('hidden');
        formPasso3.classList.remove('hidden');
        formPasso3.classList.add('active');
        if (stepDescription) {
          stepDescription.textContent = 'Informe e confirme a sua nova senha.';
        }

      } catch (err) {
        alert(err.message);
      }
    });
  }

  // PASSO 3: Alterar a Senha
  if (formPasso3) {
    formPasso3.addEventListener('submit', async (e) => {
      e.preventDefault();
      const novaSenha = document.getElementById('nova-senha').value;
      const confirmarSenha = document.getElementById('confirmar-nova-senha').value;

      if (novaSenha !== confirmarSenha) {
        alert('As senhas não coincidem!');
        return;
      }

      try {
        const response = await fetch('/api/redefinir-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario, novaSenha })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.erro || 'Erro ao atualizar senha.');
        }

        alert('Senha alterada com sucesso!');
        window.location.href = 'index.html';

      } catch (err) {
        alert(err.message);
      }
    });
  }
});