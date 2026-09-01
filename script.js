const API_BASE = window.location.origin;

document.getElementById("btnLogin").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();
  const msg = document.getElementById("mensagem");

  msg.textContent = "";

  if (!email || !senha) {
    msg.textContent = "Preencha todos os campos!";
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.erro || "Erro ao fazer login.";
      return;
    }

    // ✅ Salva as informações de sessão (dura até fechar o navegador)
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("tipo", data.tipo);
    sessionStorage.setItem("usuario", data.nome);

    // ✅ Redireciona conforme o tipo de usuário
    if (data.tipo === "admin") {
      window.location.href = "painel-admin.html";
    } else {
      window.location.href = "painel.html";
    }

  } catch (err) {
    msg.textContent = "Falha de conexão com o servidor.";
    console.error(err);
  }
});
