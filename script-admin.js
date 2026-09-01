const API_BASE = window.location.origin;
const token = sessionStorage.getItem("token");
const tipo = sessionStorage.getItem("tipo");
const nome = sessionStorage.getItem("usuario");

if (!token || tipo !== "admin") {
  window.location.href = "index.html";
}

document.getElementById("adminNome").textContent = nome;
const listaCaixas = document.getElementById("listaCaixas");
const msg = document.getElementById("msg");

// 🔄 Carrega as caixas existentes
async function carregarCaixas() {
  try {
    const res = await fetch(API_BASE + "/api/caixas", {
      headers: { Authorization: "Bearer " + token }
    });
    const caixas = await res.json();
    listaCaixas.innerHTML = "";

    if (!caixas.length) {
      listaCaixas.innerHTML = '<option value="">Nenhuma caixa cadastrada</option>';
      return;
    }

    caixas.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `ID ${c.id} - ${c.nome} (Usuário ${c.usuario_id || "não associado"})`;
      listaCaixas.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar caixas:", err);
  }
}

// ➕ Adicionar nova caixa
document.getElementById("btnAdicionar").addEventListener("click", async () => {
  const nomeCaixa = document.getElementById("nomeCaixa").value.trim();
  const usuarioId = document.getElementById("usuarioId").value.trim();

  if (!nomeCaixa || !usuarioId) {
    msg.style.color = "red";
    msg.textContent = "Preencha todos os campos!";
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/caixas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ nome: nomeCaixa, usuario_id: usuarioId })
    });

    const data = await res.json();
    if (res.ok) {
      msg.style.color = "green";
      msg.textContent = "✅ Caixa adicionada com sucesso!";
      carregarCaixas();
    } else {
      msg.style.color = "red";
      msg.textContent = data.erro || "Erro ao adicionar caixa.";
    }
  } catch (err) {
    msg.style.color = "red";
    msg.textContent = "Falha ao conectar ao servidor.";
  }
});

// 🔗 Associar caixa a outro usuário
document.getElementById("btnAssociar").addEventListener("click", async () => {
  const id = listaCaixas.value;
  const novoUsuarioId = document.getElementById("novoUsuarioId").value.trim();

  if (!id || !novoUsuarioId) {
    msg.style.color = "red";
    msg.textContent = "Selecione uma caixa e insira o novo usuário!";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/caixas/${id}/associar`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ usuario_id: novoUsuarioId })
    });

    const data = await res.json();
    if (res.ok) {
      msg.style.color = "green";
      msg.textContent = "✅ Associação atualizada!";
      carregarCaixas();
    } else {
      msg.style.color = "red";
      msg.textContent = data.erro || "Erro ao associar.";
    }
  } catch (err) {
    msg.style.color = "red";
    msg.textContent = "Falha de conexão com o servidor.";
  }
});

// 👁️ Ver caixa selecionada
document.getElementById("btnVer").addEventListener("click", () => {
  const id = listaCaixas.value;
  if (!id) {
    msg.style.color = "red";
    msg.textContent = "Selecione uma caixa!";
    return;
  }
  sessionStorage.setItem("caixaSelecionada", id);
  window.location.href = "painel.html"; // reusa o painel do cliente
});

// 🚪 Logout
document.getElementById("btnLogout").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

// Carrega as caixas ao abrir o painel
carregarCaixas();
