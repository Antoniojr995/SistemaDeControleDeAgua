document.getElementById('btnRegistrar').addEventListener('click', registrar);

async function registrar() {
  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value.trim();
  const msg = document.getElementById('msg');

  if (!nome || !email || !senha) {
    msg.textContent = 'Preencha todos os campos.';
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ nome, email, senha })
    });

    const data = await res.json();

    if (res.ok) {
      msg.style.color = 'green';
      msg.textContent = '✅ Usuário cadastrado com sucesso! Redirecionando...';
      setTimeout(() => location.href = '/index.html', 2000);
    } else {
      msg.style.color = 'red';
      msg.textContent = data.erro || 'Erro ao cadastrar.';
    }
  } catch (e) {
    msg.textContent = 'Erro de conexão com o servidor.';
  }
}
