const API_BASE = window.location.origin;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Valida se o utilizador tem sessão ativa e se é administrador
  await verificarSessaoAdmin();

  // 2. Carrega a lista inicial vinda da base de dados PostgreSQL
  carregarCadastros();

  // 3. Submissão do formulário para gravar na base de dados
  const form = document.getElementById("formCadastroGeral");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const tipoSelect = document.getElementById("tipoCadastro");
      const payload = {
        categoria: tipoSelect.options[tipoSelect.selectedIndex].text,
        descricao: document.getElementById("nomeItem").value.trim(),
        valor: document.getElementById("valorPadrao").value.trim() || "-",
        observacoes: document.getElementById("observacoes").value.trim()
      };

      try {
        const res = await fetch(`${API_BASE}/api/parametros`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin"
        });

        if (res.ok) {
          alert("✅ Registo guardado com sucesso na base de dados!");
          form.reset();
          carregarCadastros();
        } else {
          alert("❌ Erro ao guardar registo.");
        }
      } catch (err) {
        alert("❌ Falha na ligação com o servidor.");
      }
    });
  }

  // 4. Terminar sessão (Logout)
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await fetch(API_BASE + "/api/logout", { method: "POST", credentials: "same-origin" });
      } catch (e) {
        console.error("Erro no logout:", e);
      }
      sessionStorage.clear();
      window.location.href = "index.html";
    });
  }
});

// Função para verificar autorização
async function verificarSessaoAdmin() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", { credentials: "same-origin" });
    const data = await res.json();
    if (!data.logado || data.tipo !== "admin") {
      window.location.href = "index.html";
    }
  } catch (err) {
    window.location.href = "index.html";
  }
}

// Função para carregar e renderizar os dados da API
async function carregarCadastros() {
  const tbody = document.getElementById("listaCadastros");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/parametros`, { credentials: "same-origin" });
    const itens = await res.json();

    if (!Array.isArray(itens) || itens.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 15px;">Nenhum parâmetro registado.</td></tr>`;
      return;
    }

    tbody.innerHTML = itens.map(item => `
      <tr>
        <td><span class="badge-status badge-ok">${item.categoria}</span></td>
        <td><strong>${item.descricao}</strong></td>
        <td>${item.valor}</td>
        <td>
          <button class="btn-action btn-danger" onclick="removerItem(${item.id})" title="Remover">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding: 15px;">Erro ao carregar registos da base de dados.</td></tr>`;
  }
}

// Função global para remover itens do banco de dados
window.removerItem = async function(id) {
  if (confirm("Deseja remover este item de registo?")) {
    try {
      const res = await fetch(`${API_BASE}/api/parametros/${id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });

      if (res.ok) {
        carregarCadastros();
      } else {
        alert("❌ Erro ao apagar item.");
      }
    } catch (err) {
      alert("❌ Falha na ligação com o servidor.");
    }
  }
};