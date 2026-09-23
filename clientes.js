const API_BASE = window.location.origin;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Validar sessão de administrador
  await verificarSessaoAdmin();

  // 2. Carregar lista de clientes do banco de dados
  carregarClientes();

  // 3. Filtro de busca em tempo real
  const inputBusca = document.getElementById("inputBuscaCliente");
  if (inputBusca) {
    inputBusca.addEventListener("input", (e) => {
      filtrarTabela(e.target.value);
    });
  }

  // 4. Botão de Novo Cliente
  const btnNovoCliente = document.getElementById("btnNovoCliente");
  if (btnNovoCliente) {
    btnNovoCliente.addEventListener("click", () => {
      const usuario = prompt("Nome do Cliente / Utilizador:");
      if (!usuario) return;
      const email = prompt("E-mail do Cliente:");
      if (!email) return;
      const senha = prompt("Palavra-passe temporária:");
      if (!senha) return;

      cadastrarCliente({ usuario, email, senha, tipo: "cliente" });
    });
  }

  // 5. Logout
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

// Cache local de clientes para a pesquisa
let listaClientesGlobal = [];

// Autenticação Admin
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

// Buscar Clientes na API (PostgreSQL)
async function carregarClientes() {
  const tbody = document.getElementById("listaClientes");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Carregando clientes...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/api/clientes`, { credentials: "same-origin" });
    
    if (res.status === 401 || res.status === 403) {
      window.location.href = "index.html";
      return;
    }

    listaClientesGlobal = await res.json();
    renderTabelaClientes(listaClientesGlobal);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#f87171; padding:20px;">Erro ao carregar lista do banco de dados.</td></tr>`;
  }
}

// Cadastrar Cliente na API
async function cadastrarCliente(dados) {
  try {
    const res = await fetch(`${API_BASE}/api/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
      credentials: "same-origin"
    });

    if (res.ok) {
      alert("✅ Cliente registado com sucesso!");
      carregarClientes();
    } else {
      const err = await res.json();
      alert(err.error || "Erro ao registar cliente.");
    }
  } catch (err) {
    alert("Falha na ligação com o servidor.");
  }
}

// Renderizar Tabela
function renderTabelaClientes(lista) {
  const tbody = document.getElementById("listaClientes");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(lista) || lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#7b93b8; padding:20px;">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  lista.forEach(cliente => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${cliente.usuario}</strong></td>
      <td>${cliente.email || "Não informado"}</td>
      <td>${cliente.telefone || "(--)"}</td>
      <td><i class="fas fa-cube text-cyan"></i> ${cliente.total_caixas || 0} conjunto(s)</td>
      <td><span class="badge-status badge-ok">Ativo</span></td>
      <td>
        <button class="btn-action btn-danger" onclick="excluirCliente(${cliente.id})" title="Excluir">
          <i class="fas fa-user-times"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Filtrar Tabela
function filtrarTabela(termo) {
  const busca = termo.toLowerCase();
  const filtrados = listaClientesGlobal.filter(c => 
    (c.usuario && c.usuario.toLowerCase().includes(busca)) ||
    (c.email && c.email.toLowerCase().includes(busca))
  );
  renderTabelaClientes(filtrados);
}

// Remover Cliente
window.excluirCliente = async function(id) {
  if (confirm(`Deseja realmente remover o cliente ID ${id}?`)) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/clientes/${id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      
      if (res.ok) {
        carregarClientes();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao eliminar cliente.");
      }
    } catch (err) {
      alert("Falha na ligação com o servidor.");
    }
  }
};