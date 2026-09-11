const API_BASE = window.location.origin;

// 1. Verifica autenticação via sessão no servidor ao carregar a página
async function verificarSessao() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual");
    const data = await res.json();

    if (!data.logado || data.tipo !== "admin") {
      window.location.href = "index.html";
      return;
    }

    const adminNomeEl = document.getElementById("adminNome");
    if (adminNomeEl) adminNomeEl.textContent = data.usuario || "Admin";
  } catch (err) {
    console.error("Erro ao verificar sessão:", err);
    window.location.href = "index.html";
  }
}

// 🗂️ Navegação por Abas
function mudarAba(idAba) {
  document.querySelectorAll('.camada-conteudo').forEach(div => {
    div.style.display = 'none';
  });
  const aba = document.getElementById(idAba);
  if (aba) aba.style.display = 'block';

  if (idAba === 'abaCaixas') carregarCaixas();
  if (idAba === 'abaClientes') carregarClientes();
  if (idAba === 'abaRegistros') carregarSelectsFormularios();
  if (idAba === 'abaChamados') carregarChamados();
}

// 🔄 Carrega as caixas (Aba Caixas)
async function carregarCaixas() {
  const listaCaixas = document.getElementById("listaCaixas");
  if (!listaCaixas) return;

  try {
    const res = await fetch(API_BASE + "/api/caixas");
    const caixas = await res.json();
    listaCaixas.innerHTML = "";

    if (!Array.isArray(caixas) || !caixas.length) {
      listaCaixas.innerHTML = '<option value="">Nenhuma caixa cadastrada</option>';
      return;
    }

    caixas.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `ID ${c.id} - ${c.nome} ${c.cliente_nome ? `(Cliente: ${c.cliente_nome})` : '(Sem Dono)'}`;
      listaCaixas.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar caixas:", err);
    listaCaixas.innerHTML = '<option value="">Erro ao carregar caixas</option>';
  }
}

// 🗑️ Deletar caixa d'água selecionada
async function deletarCaixaSelecionada() {
  const listaCaixas = document.getElementById("listaCaixas");
  const id = listaCaixas ? listaCaixas.value : null;

  if (!id) return alert("Selecione uma caixa para excluir!");

  if (confirm(`Tem certeza que deseja apagar a caixa ID ${id}?`)) {
    try {
      const res = await fetch(`${API_BASE}/api/caixas/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok && data.success) {
        alert("✅ Caixa removida com sucesso!");
        carregarCaixas();
      } else {
        alert("❌ Erro ao apagar caixa.");
      }
    } catch (err) {
      alert("❌ Falha na conexão com o servidor.");
    }
  }
}

// ✏️ Renomear Caixa selecionada
async function renomearCaixaSelecionada() {
  const listaCaixas = document.getElementById("listaCaixas");
  const id = listaCaixas ? listaCaixas.value : null;

  if (!id) return alert("Selecione uma caixa para renomear!");

  const novoNome = prompt("Digite o novo nome para esta caixa:");
  if (!novoNome) return;

  try {
    const res = await fetch(`${API_BASE}/api/caixas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      alert("✅ Caixa renomeada com sucesso!");
      carregarCaixas();
    } else {
      alert("❌ Erro ao renomear.");
    }
  } catch (err) {
    alert("❌ Erro na conexão.");
  }
}

// 🗑️ Deletar Cliente da Lista
async function deletarCliente(id) {
  if (confirm(`Tem certeza que deseja apagar o cliente ID ${id}?`)) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/clientes/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok && data.success) {
        alert("✅ Cliente removido!");
        carregarClientes();
      } else {
        alert("❌ Erro ao remover cliente.");
      }
    } catch (err) {
      alert("❌ Erro na conexão.");
    }
  }
}

// 👥 Carrega lista de clientes com botões de Ação
async function carregarClientes() {
  const div = document.getElementById("listaClientes");
  if (!div) return;

  try {
    const res = await fetch(API_BASE + "/api/clientes");
    const clientes = await res.json();

    if (!Array.isArray(clientes) || clientes.length === 0) {
      div.innerHTML = "<p>Nenhum cliente cadastrado.</p>";
      return;
    }

    div.innerHTML = clientes.map(c => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #f4f4f4; padding: 10px; border-radius: 5px; margin-bottom: 8px;">
        <span>🆔 <b>${c.id}</b> | 👤 <b>${c.usuario}</b></span>
        <div>
          <button onclick="editarCliente(${c.id}, '${c.usuario}')" style="background: #337ab7; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">✏️ Editar</button>
          <button onclick="deletarCliente(${c.id})" style="background: #d9534f; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">🗑️ Excluir</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    div.innerHTML = "<p>Erro ao carregar clientes.</p>";
  }
}

// ✏️ Função para Editar Cliente
async function editarCliente(id, usuarioAtual) {
  const novoNome = prompt("Digite o novo nome/e-mail do cliente:", usuarioAtual);
  if (!novoNome) return;

  const novaSenha = prompt("Digite a nova senha (ou deixe em branco para não alterar):");

  try {
    const res = await fetch(`${API_BASE}/api/admin/clientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: novoNome, senha: novaSenha })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert("✅ Cliente atualizado com sucesso!");
      carregarClientes();
    } else {
      alert("❌ Erro ao atualizar cliente.");
    }
  } catch (err) {
    alert("❌ Erro na conexão.");
  }
}

// 👥 Carrega lista de clientes (Aba Clientes)
async function carregarClientes() {
  const div = document.getElementById("listaClientes");
  if (!div) return;

  try {
    const res = await fetch(API_BASE + "/api/clientes");
    const clientes = await res.json();

    if (!Array.isArray(clientes) || clientes.length === 0) {
      div.innerHTML = "<p>Nenhum cliente cadastrado.</p>";
      return;
    }

    div.innerHTML = clientes.map(c => `<p>🆔 ${c.id} | 👤 <b>${c.usuario}</b></p>`).join("");
  } catch (err) {
    div.innerHTML = "<p>Erro ao carregar clientes.</p>";
  }
}

// 📋 Preenche os Selects do Form de Registros (Aba Registros)
async function carregarSelectsFormularios() {
  try {
    // Buscar Clientes
    const resCli = await fetch(API_BASE + "/api/clientes");
    const clientes = await resCli.json();

    const selCliCriar = document.getElementById("selectClienteCriar");
    const selCliAssociar = document.getElementById("selectClienteAssociar");

    if (selCliCriar) selCliCriar.innerHTML = '<option value="">Vincular a um cliente (Opcional)...</option>';
    if (selCliAssociar) selCliAssociar.innerHTML = '<option value="">Selecione o Cliente...</option>';

    if (Array.isArray(clientes)) {
      clientes.forEach(c => {
        if (selCliCriar) selCliCriar.innerHTML += `<option value="${c.id}">${c.usuario} (ID: ${c.id})</option>`;
        if (selCliAssociar) selCliAssociar.innerHTML += `<option value="${c.id}">${c.usuario} (ID: ${c.id})</option>`;
      });
    }

    // Buscar Caixas
    const resCai = await fetch(API_BASE + "/api/caixas");
    const caixas = await resCai.json();
    const selCaixasAssoc = document.getElementById("selectCaixaAssociar");

    if (selCaixasAssoc) selCaixasAssoc.innerHTML = '<option value="">Selecione a Caixa...</option>';

    if (Array.isArray(caixas)) {
      caixas.forEach(c => {
        if (selCaixasAssoc) selCaixasAssoc.innerHTML += `<option value="${c.id}">${c.nome} (ID: ${c.id})</option>`;
      });
    }
  } catch (err) {
    console.error("Erro ao carregar opções de seleção:", err);
  }
}

// 👤 1. CADASTRAR NOVO CLIENTE (COLUNA 1)
const btnCadastrarCliente = document.getElementById("btnCadastrarCliente");
if (btnCadastrarCliente) {
  btnCadastrarCliente.onclick = async () => {
    const nome = document.getElementById("novoClienteNome").value.trim();
    const email = document.getElementById("novoClienteEmail").value.trim();
    const senha = document.getElementById("novoClienteSenha").value.trim();

    if (!email || !senha) {
      return alert("⚠️ Preencha o e-mail e a senha do cliente!");
    }

    try {
      const res = await fetch(API_BASE + "/api/cadastrar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("✅ Cliente cadastrado com sucesso!");
        document.getElementById("formNovoCliente").reset();
        carregarSelectsFormularios();
      } else {
        alert("❌ Erro: " + (data.error || "Não foi possível cadastrar"));
      }
    } catch (err) {
      alert("❌ Falha na conexão com o servidor.");
    }
  };
}

// 📦 2. CRIAR NOVA CAIXA (COLUNA 2)
const btnAdicionar = document.getElementById("btnAdicionar");
if (btnAdicionar) {
  btnAdicionar.onclick = async () => {
    const nomeCaixa = document.getElementById("nomeCaixa").value.trim();
    const usuarioId = document.getElementById("selectClienteCriar").value;

    if (!nomeCaixa) {
      return alert("⚠️ Digite o nome da caixa!");
    }

    try {
      const res = await fetch(API_BASE + "/api/caixas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeCaixa, usuario_id: usuarioId || null })
      });

      const data = await res.json();
      if (res.ok && (data.success || data.ok)) {
        alert("✅ Caixa criada com sucesso!");
        document.getElementById("nomeCaixa").value = "";
        
        // AQUI: Recarrega as opções de caixas e clientes nos selects na hora!
        carregarSelectsFormularios(); 
      } else {
        alert("❌ Erro: " + (data.error || data.erro || "Falha ao criar caixa"));
      }
    } catch (err) {
      alert("❌ Falha de conexão com o servidor.");
    }
  };
}

// 🔗 3. ASSOCIAR CAIXA A CLIENTE (COLUNA 3)
const btnAssociar = document.getElementById("btnAssociar");
if (btnAssociar) {
  btnAssociar.onclick = async () => {
    const idCaixa = document.getElementById("selectCaixaAssociar").value;
    const idUsuario = document.getElementById("selectClienteAssociar").value;

    if (!idCaixa || !idUsuario) {
      return alert("⚠️ Selecione a caixa e o cliente!");
    }

    try {
      const res = await fetch(`${API_BASE}/api/caixas/${idCaixa}/associar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: idUsuario })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("✅ Caixa vinculada com sucesso!");
        carregarSelectsFormularios();
      } else {
        alert("❌ Erro: " + (data.error || "Falha ao associar"));
      }
    } catch (err) {
      alert("❌ Erro ao conectar ao servidor.");
    }
  };
}

// 🔔 Chamados
async function carregarChamados() {
  const div = document.getElementById("listaChamados");
  if (!div) return;

  try {
    const res = await fetch(API_BASE + "/api/chamados");
    const chamados = await res.json();

    if (!Array.isArray(chamados) || chamados.length === 0) {
      div.innerHTML = "<p>Nenhum chamado pendente.</p>";
      return;
    }

    div.innerHTML = chamados.map(ch => `
      <div style="border:1px solid #ccc; padding:10px; margin-bottom:10px; border-radius:5px;">
        <p><b>Cliente:</b> ${ch.cliente_nome}</p>
        <p><b>Assunto:</b> ${ch.assunto}</p>
        <p><b>Mensagem:</b> ${ch.mensagem}</p>
      </div>
    `).join("");
  } catch (err) {
    div.innerHTML = "<p>Erro ao carregar chamados.</p>";
  }
}

// 👁️ Ver caixa selecionada
const btnVer = document.getElementById("btnVer");
if (btnVer) {
  btnVer.onclick = () => {
    const listaCaixas = document.getElementById("listaCaixas");
    const id = listaCaixas ? listaCaixas.value : null;
    if (!id) return alert("Selecione uma caixa!");
    
    sessionStorage.setItem("caixaSelecionada", id);
    window.location.href = "painel.html";
  };
}

async function carregarSelects() {
  try {
    // 1. Busca caixas para o select
    const resCaixas = await fetch('/api/caixas');
    const caixas = await resCaixas.json();

    // 2. Busca clientes para os selects
    const resClientes = await fetch('/api/clientes');
    const clientes = await resClientes.json();

    // Preenche Select de Caixas (Associar Caixa)
    const selectCaixas = document.getElementById('select-caixas') || document.querySelector('#form-associar select:nth-child(1)');
    if (selectCaixas) {
      selectCaixas.innerHTML = '<option value="">Selecione a Caixa...</option>';
      caixas.forEach(caixa => {
        selectCaixas.innerHTML += `<option value="${caixa.id}">${caixa.nome}</option>`;
      });
    }

    // Preenche Selects de Clientes (Criar Caixa Opcional + Associar Caixa)
    const selectsClientes = document.querySelectorAll('.select-clientes');
    selectsClientes.forEach(select => {
      select.innerHTML = '<option value="">Selecione o Cliente...</option>';
      clientes.forEach(cliente => {
        select.innerHTML += `<option value="${cliente.id}">${cliente.usuario}</option>`;
      });
    });

  } catch (err) {
    console.error('Erro ao preencher opções dos selects:', err);
  }
}

// Chame a função sempre que abrir a aba de Cadastros ou ao carregar a página
document.addEventListener('DOMContentLoaded', carregarSelects);

// 🚪 Logout
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.onclick = async () => {
    await fetch(API_BASE + "/api/logout", { method: "POST" });
    window.location.href = "index.html";
  };
}

// Inicializa verificação de sessão e carrega a aba principal
verificarSessao();
carregarCaixas();