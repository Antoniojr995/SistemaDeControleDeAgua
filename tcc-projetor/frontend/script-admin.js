const API_BASE = window.location.origin;

// 1. Unificando o uso do localStorage (ou sessionStorage caso use na tela de login)
const token = localStorage.getItem("token") || sessionStorage.getItem("token");
const tipo = localStorage.getItem("tipo") || sessionStorage.getItem("tipo");
const nome = localStorage.getItem("usuario") || sessionStorage.getItem("usuario") || "Admin";

if (!token || tipo !== "admin") {
  window.location.href = "index.html";
}

// Exibe nome no topo
const adminNomeEl = document.getElementById("adminNome");
if (adminNomeEl) adminNomeEl.textContent = nome;

// Helper de cabeçalhos
function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token
  };
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
    const res = await fetch(API_BASE + "/api/caixas", { headers: getHeaders() });
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
  }
}

// 👥 Carrega lista de clientes (Aba Clientes)
async function carregarClientes() {
  const div = document.getElementById("listaClientes");
  if (!div) return;

  try {
    const res = await fetch(API_BASE + "/api/admin/clientes", { headers: getHeaders() });
    const clientes = await res.json();

    if (!Array.isArray(clientes) || clientes.length === 0) {
      div.innerHTML = "<p>Nenhum cliente cadastrado.</p>";
      return;
    }

    div.innerHTML = clientes.map(c => `<p>🆔 ${c.id} | 👤 <b>${c.nome}</b> (${c.email})</p>`).join("");
  } catch (err) {
    div.innerHTML = "<p>Erro ao carregar clientes.</p>";
  }
}

// 📋 Preenche os Selects do Form de Registros (Aba Registros)
async function carregarSelectsFormularios() {
  try {
    // Buscar Clientes
    const resCli = await fetch(API_BASE + "/api/admin/clientes", { headers: getHeaders() });
    const clientes = await resCli.json();

    const selCliCriar = document.getElementById("selectClienteCriar");
    const selCliAssociar = document.getElementById("selectClienteAssociar");

    if (selCliCriar) selCliCriar.innerHTML = '<option value="">Vincular a um cliente (Opcional)...</option>';
    if (selCliAssociar) selCliAssociar.innerHTML = '<option value="">Selecione o Cliente...</option>';

    if (Array.isArray(clientes)) {
      clientes.forEach(c => {
        if (selCliCriar) selCliCriar.innerHTML += `<option value="${c.id}">${c.nome} (ID: ${c.id})</option>`;
        if (selCliAssociar) selCliAssociar.innerHTML += `<option value="${c.id}">${c.nome} (ID: ${c.id})</option>`;
      });
    }

    // Buscar Caixas
    const resCai = await fetch(API_BASE + "/api/caixas", { headers: getHeaders() });
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

    if (!nome || !email || !senha) {
      return alert("⚠️ Preencha todos os campos do cliente!");
    }

    try {
      const res = await fetch(API_BASE + "/api/admin/clientes", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ nome, email, senha })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        alert("✅ Cliente cadastrado com sucesso!");
        document.getElementById("formNovoCliente").reset();
        carregarSelectsFormularios();
      } else {
        alert("❌ Erro: " + (data.erro || "Não foi possível cadastrar"));
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
      const res = await fetch(API_BASE + "/api/admin/caixas", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ nome: nomeCaixa, usuario_id: usuarioId || null })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        alert("✅ Caixa criada com sucesso!");
        document.getElementById("nomeCaixa").value = "";
        carregarSelectsFormularios();
      } else {
        alert("❌ Erro: " + (data.erro || "Falha ao criar caixa"));
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
        headers: getHeaders(),
        body: JSON.stringify({ usuario_id: idUsuario })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        alert("✅ Caixa vinculada com sucesso!");
        carregarSelectsFormularios();
      } else {
        alert("❌ Erro: " + (data.erro || "Falha ao associar"));
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
    const res = await fetch(API_BASE + "/api/chamados", { headers: getHeaders() });
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
    
    localStorage.setItem("caixaSelecionada", id);
    sessionStorage.setItem("caixaSelecionada", id);
    window.location.href = "painel.html";
  };
}

// 🚪 Logout
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.onclick = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "index.html";
  };
}

// Inicializa a primeira visão
carregarCaixas();