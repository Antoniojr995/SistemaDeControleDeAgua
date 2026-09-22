// script.js
const API_BASE = window.location.origin;

document.getElementById("btnLogin")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();
  const msg = document.getElementById("mensagem");

  if (msg) msg.textContent = "";

  if (!email || !senha) {
    if (msg) msg.textContent = "Preencha todos os campos!";
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: email, senha: senha }),
      credentials: "same-origin"
    });

    const data = await res.json();

    if (!res.ok) {
      if (msg) msg.textContent = data.error || data.erro || "Erro ao fazer login.";
      return;
    }

    sessionStorage.setItem("logado", "true");
    sessionStorage.setItem("usuario", data.usuario);
    sessionStorage.setItem("tipo", data.tipo);

    if (data.tipo === "admin") {
      window.location.href = "painel-admin.html";
    } else {
      window.location.href = "painel_2.html";
    }

  } catch (err) {
    if (msg) msg.textContent = "Falha de conexão com o servidor.";
    console.error(err);
  }
});