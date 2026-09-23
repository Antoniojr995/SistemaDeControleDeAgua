const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validar sessão do utilizador e carregar perfil
  await carregarPerfilUtilizador();

  // 2. Gestão das Abas
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      button.classList.add('active');
      const paneTarget = document.getElementById(targetTab);
      if (paneTarget) paneTarget.classList.add('active');
    });
  });

  // 3. Submissão do Formulário de Perfil
  const formPerfil = document.getElementById('formPerfil');
  if (formPerfil) {
    formPerfil.addEventListener('submit', async (e) => {
      e.preventDefault();

      const dados = {
        usuario: document.getElementById('nomeCliente').value.trim(),
        email: document.getElementById('emailCliente').value.trim(),
        telefone: document.getElementById('telefCliente').value.trim()
      };

      try {
        const res = await fetch(`${API_BASE}/api/perfil`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados),
          credentials: 'same-origin'
        });

        if (res.ok) {
          alert('✅ Informações pessoais salvas com sucesso!');
        } else {
          const err = await res.json();
          alert(err.error || 'Erro ao atualizar dados.');
        }
      } catch (err) {
        alert('❌ Falha na ligação com o servidor.');
      }
    });
  }

  // 4. Submissão do Formulário de Segurança (Alterar Senha)
  const formSeguranca = document.getElementById('formSeguranca');
  if (formSeguranca) {
    formSeguranca.addEventListener('submit', async (e) => {
      e.preventDefault();

      const senhaAtual = document.getElementById('senhaAtual').value;
      const novaSenha = document.getElementById('novaSenha').value;
      const confirmaSenha = document.getElementById('confirmaSenha').value;

      if (novaSenha !== confirmaSenha) {
        alert('❌ A nova palavra-passe e a confirmação não coincidem.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/alterar-senha`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senhaAtual, novaSenha }),
          credentials: 'same-origin'
        });

        if (res.ok) {
          alert('✅ Palavra-passe atualizada com sucesso!');
          formSeguranca.reset();
        } else {
          const err = await res.json();
          alert(err.error || 'Erro ao alterar palavra-passe.');
        }
      } catch (err) {
        alert('❌ Falha na ligação com o servidor.');
      }
    });
  }
});

// Carregar Dados Atuais do Utilizador
async function carregarPerfilUtilizador() {
  try {
    const res = await fetch(`${API_BASE}/api/usuario-atual`, { credentials: 'same-origin' });
    const data = await res.json();

    if (!data.logado) {
      window.location.href = 'index.html';
      return;
    }

    // Preencher os campos do formulário com os dados reais da sessão/banco
    if (data.usuario) {
      const inputNome = document.getElementById('nomeCliente');
      if (inputNome) inputNome.value = data.usuario;
    }
    if (data.email) {
      const inputEmail = document.getElementById('emailCliente');
      if (inputEmail) inputEmail.value = data.email;
    }
    if (data.telefone) {
      const inputTelef = document.getElementById('telefCliente');
      if (inputTelef) inputTelef.value = data.telefone;
    }
  } catch (err) {
    console.error('Erro ao carregar sessão:', err);
    window.location.href = 'index.html';
  }
}