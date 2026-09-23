document.addEventListener('DOMContentLoaded', () => {
  const formPasso1 = document.getElementById('form-passo-1');
  const formPasso2 = document.getElementById('form-passo-2');
  const formPasso3 = document.getElementById('form-passo-3');
  const stepDescription = document.getElementById('step-description');

  let emailUsuario = '';
  let codigoValidado = '';

  // PASSO 1: Enviar E-mail com o Código
  if (formPasso1) {
    formPasso1.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = formPasso1.querySelector('button[type="submit"]');
      emailUsuario = document.getElementById('email-recuperacao').value.trim();

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'A enviar...';

        const response = await fetch('/api/solicitar-codigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.erro || 'Erro ao enviar e-mail.');
        }

        alert('✅ Código enviado com sucesso! Verifique a sua caixa de entrada.');
        
        formPasso1.classList.remove('active');
        formPasso1.classList.add('hidden');
        formPasso2.classList.remove('hidden');
        formPasso2.classList.add('active');
        if (stepDescription) {
          stepDescription.textContent = 'Digite o código de 6 dígitos enviado ao seu e-mail.';
        }

      } catch (err) {
        alert('❌ ' + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Código';
      }
    });
  }

  // PASSO 2: Validar o Código
  if (formPasso2) {
    formPasso2.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = formPasso2.querySelector('button[type="submit"]');
      const codigo = document.getElementById('codigo-verificacao').value.trim();

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'A validar...';

        const response = await fetch('/api/validar-codigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailUsuario, codigo })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.erro || 'Código inválido ou expirado.');
        }

        codigoValidado = codigo; // Armazena o código para a confirmação final

        formPasso2.classList.remove('active');
        formPasso2.classList.add('hidden');
        formPasso3.classList.remove('hidden');
        formPasso3.classList.add('active');
        if (stepDescription) {
          stepDescription.textContent = 'Informe e confirme a sua nova palavra-passe.';
        }

      } catch (err) {
        alert('❌ ' + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-check-double"></i> Validar Código';
      }
    });
  }

  // PASSO 3: Alterar a Senha
  if (formPasso3) {
    formPasso3.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = formPasso3.querySelector('button[type="submit"]');
      const novaSenha = document.getElementById('nova-senha').value;
      const confirmarSenha = document.getElementById('confirmar-nova-senha').value;

      if (novaSenha !== confirmarSenha) {
        alert('❌ As palavras-passe não coincidem!');
        return;
      }

      if (novaSenha.length < 6) {
        alert('❌ A palavra-passe deve ter pelo menos 6 caracteres.');
        return;
      }

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'A atualizar...';

        const response = await fetch('/api/redefinir-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: emailUsuario, 
            codigo: codigoValidado, 
            novaSenha 
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.erro || 'Erro ao atualizar a palavra-passe.');
        }

        alert('✅ Palavra-passe alterada com sucesso! Faça login com a nova senha.');
        window.location.href = 'index.html';

      } catch (err) {
        alert('❌ ' + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-rotate"></i> Alterar Senha';
      }
    });
  }
});