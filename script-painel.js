const API_BASE = window.location.origin;

// =======================
// 🔒 VERIFICAÇÃO DE SESSÃO
// =======================
async function verificarSessao() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", { credentials: "same-origin" });
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

// =======================
// 🧭 NAVEGAÇÃO POR ABAS
// =======================
function mudarAba(idAba) {
  document.querySelectorAll(".camada-conteudo").forEach(div => {
    div.style.display = "none";
  });
  
  const aba = document.getElementById(idAba);
  if (aba) aba.style.display = "block";

  if (idAba === "abaCaixas") {
    carregarCaixas();
    carregarClientesSelectAdmin();
  }
  if (idAba === "abaClientes") {
    carregarClientes();
  }
  if (idAba === "abaRegistros") carregarSelectsFormularios();
  if (idAba === "abaChamados") carregarChamados();
}

// =======================
// 🚀 SELEÇÃO RÁPIDA (BRASILIT / FORTILIT / PERSONALIZADO)
// =======================
function aplicarPadraoCaixa(tipo) {
  const nome1El = document.getElementById("nomeCaixa1");
  const cap1El = document.getElementById("caixaCapacidade1");
  const alt1El = document.getElementById("caixaAltura1");
  
  const nome2El = document.getElementById("nomeCaixa2");
  const cap2El = document.getElementById("caixaCapacidade2");
  const alt2El = document.getElementById("caixaAltura2");

  if (tipo === "brasilit_1000_500") {
    if(nome1El) nome1El.value = "Brasilit - Caixa Principal";
    if(cap1El) cap1El.value = 1000;
    if(alt1El) alt1El.value = 95;

    if(nome2El) nome2El.value = "Brasilit - Caixa Secundária";
    if(cap2El) cap2El.value = 500;
    if(alt2El) alt2El.value = 72;
  } 
  else if (tipo === "brasilit_500_250") {
    if(nome1El) nome1El.value = "Brasilit - Caixa 500L";
    if(cap1El) cap1El.value = 500;
    if(alt1El) alt1El.value = 72;

    if(nome2El) nome2El.value = "Brasilit - Caixa 250L";
    if(cap2El) cap2El.value = 250;
    if(alt2El) alt2El.value = 55;
  }
  else if (tipo === "fortilit_1000_1000") {
    if(nome1El) nome1El.value = "Fortilit - Bloco A";
    if(cap1El) cap1El.value = 1000;
    if(alt1El) alt1El.value = 95;

    if(nome2El) nome2El.value = "Fortilit - Bloco B";
    if(cap2El) cap2El.value = 1000;
    if(alt2El) alt2El.value = 95;
  }
  else if (tipo === "fortilit_500_500") {
    if(nome1El) nome1El.value = "Fortilit - Reservatório 1";
    if(cap1El) cap1El.value = 500;
    if(alt1El) alt1El.value = 72;

    if(nome2El) nome2El.value = "Fortilit - Reservatório 2";
    if(cap2El) cap2El.value = 500;
    if(alt2El) alt2El.value = 72;
  }
}

// =======================
// 👥 CADASTRAR CLIENTE COMPLETO
// =======================
window.cadastrarClienteCompleto = async function(event) {
  event.preventDefault();

  const nome = document.getElementById("novoClienteNome").value.trim();
  const cpf = document.getElementById("novoClienteCpf").value.trim();
  const telefone = document.getElementById("novoClienteTelefone").value.trim();
  const endereco = document.getElementById("novoClienteEndereco").value.trim();
  const email = document.getElementById("novoClienteEmail").value.trim();
  const senha = document.getElementById("novoClienteSenha").value.trim();

  if (!email || !senha || !nome) {
    return alert("⚠️ Por favor, preencha os campos obrigatórios principais!");
  }

  const payload = {
    usuario: email,
    senha: senha,
    nome: nome,
    cpf: cpf,
    telefone: telefone,
    endereco: endereco
  };

  try {
    const res = await fetch(API_BASE + "/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });

    const data = await res.json();

    if (res.ok) {
      alert("✅ Cliente cadastrado com sucesso!");
      document.getElementById("formNovoCliente").reset();
      carregarClientes();
      carregarSelectsFormularios();
      carregarClientesSelectAdmin();
    } else {
      alert("❌ " + (data.error || "Erro ao cadastrar cliente."));
    }
  } catch (err) {
    console.error(err);
    alert("❌ Falha de conexão com o servidor.");
  }
};

// =======================
// 📦 SALVAR E GERENCIAR CAIXAS
// =======================
async function carregarClientesSelectAdmin() {
  const selectUsuario = document.getElementById("selectUsuarioDono");
  if (!selectUsuario) return;

  try {
    const res = await fetch(API_BASE + "/api/clientes", { credentials: "same-origin" });
    const clientes = await res.json();
    selectUsuario.innerHTML = '<option value="">Sem Dono (Caixa Livre)</option>';

    if (Array.isArray(clientes)) {
      clientes.forEach(c => {
        selectUsuario.innerHTML += `<option value="${c.id}">${c.usuario} (ID: ${c.id})</option>`;
      });
    }
  } catch (err) {
    console.error("Erro ao carregar clientes no select:", err);
  }
}

async function salvarCaixaAdmin(event) {
  event.preventDefault();

  const usuarioId = document.getElementById("selectUsuarioDono")?.value || null;

  const payload = {
    usuario_id: usuarioId ? parseInt(usuarioId) : null,
    nome_caixa1: document.getElementById("nomeCaixa1").value.trim(),
    capacidade_caixa1: parseInt(document.getElementById("caixaCapacidade1").value) || 1000,
    altura_sensor1: parseInt(document.getElementById("caixaAltura1").value) || 100,
    nome_caixa2: document.getElementById("nomeCaixa2").value.trim(),
    capacidade_caixa2: parseInt(document.getElementById("caixaCapacidade2").value) || 500,
    altura_sensor2: parseInt(document.getElementById("caixaAltura2").value) || 100
  };

  try {
    const res = await fetch(API_BASE + "/api/caixas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });

    if (res.ok) {
      alert("✅ Caixas cadastradas com sucesso!");
      carregarCaixas();
    } else {
      alert("❌ Erro ao cadastrar caixas.");
    }
  } catch (err) {
    alert("❌ Falha na conexão com o servidor.");
  }
}

async function carregarCaixas() {
  const tabelaAdmin = document.getElementById("tabelaCaixasAdmin");
  if (!tabelaAdmin) return;

  try {
    const res = await fetch(API_BASE + "/api/caixas", { credentials: "same-origin" });
    const caixas = await res.json();

    if (!Array.isArray(caixas) || caixas.length === 0) {
      tabelaAdmin.innerHTML = `<tr><td colspan="5" style="padding: 10px; text-align:center;">Nenhuma caixa cadastrada.</td></tr>`;
      return;
    }

    tabelaAdmin.innerHTML = caixas.map(c => `
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 8px;"><b>#${c.id}</b></td>
        <td style="padding: 8px;">${c.cliente_nome || '<i>Sem Dono</i>'}</td>
        <td style="padding: 8px;">
          <div><b>${c.nome_caixa1 || 'Caixa 1'}</b></div>
          <small style="color: #aaa;">Cap: ${c.capacidade_caixa1 || 1000}L | Altura: ${c.altura_sensor1 || 100}cm</small>
        </td>
        <td style="padding: 8px;">
          <div><b>${c.nome_caixa2 || 'Caixa 2'}</b></div>
          <small style="color: #aaa;">Cap: ${c.capacidade_caixa2 || 500}L | Altura: ${c.altura_sensor2 || 100}cm</small>
        </td>
        <td style="padding: 8px;">
          <button onclick="deletarCaixaDireto(${c.id})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            <i class="fa-solid fa-trash"></i> Excluir
          </button>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Erro ao carregar caixas:", err);
    tabelaAdmin.innerHTML = `<tr><td colspan="5" style="padding: 10px; text-align:center; color:red;">Erro ao carregar dados do servidor.</td></tr>`;
  }
}

async function deletarCaixaDireto(id) {
  if (confirm(`Tem certeza que deseja apagar a caixa ID ${id}?`)) {
    try {
      const res = await fetch(`${API_BASE}/api/caixas/${id}`, { 
        method: "DELETE",
        credentials: "same-origin"
      });
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

// =======================
// 👥 FICHA E LISTA DE CLIENTES
// =======================
let clienteAtualId = null;

async function carregarClientes() {
  const div = document.getElementById("listaClientes");
  if (!div) return;

  try {
    const res = await fetch(API_BASE + "/api/clientes", { credentials: "same-origin" });
    const clientes = await res.json();

    if (!Array.isArray(clientes) || clientes.length === 0) {
      div.innerHTML = "<p>Nenhum cliente cadastrado.</p>";
      return;
    }

    div.innerHTML = clientes.map(c => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; color: #000; padding: 12px; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span>🆔 <b>${c.id}</b> | 👤 <b>${c.usuario}</b></span>
        <div>
          <button onclick="abrirFichaCliente(${c.id})" style="background: #0275d8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">🔍 Ver Ficha / Histórico</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    div.innerHTML = "<p>Erro ao carregar clientes.</p>";
  }
}

window.abrirFichaCliente = async function(id) {
  clienteAtualId = id;
  
  try {
    const [resCliente, resCaixasLivres] = await Promise.all([
      fetch(`${API_BASE}/api/admin/clientes/${id}`, { credentials: "same-origin" }),
      fetch(`${API_BASE}/api/caixas`, { credentials: "same-origin" })
    ]);

    const dataCliente = await resCliente.json();
    const caixasTodas = await resCaixasLivres.json();

    if (!resCliente.ok) return alert("Erro ao carregar ficha.");

    document.getElementById("fichaId").textContent = dataCliente.cliente.id;
    document.getElementById("fichaUsuario").value = dataCliente.cliente.usuario;
    document.getElementById("fichaSenha").value = "";

    const divCaixas = document.getElementById("fichaListaCaixas");
    if (dataCliente.caixas.length === 0) {
      divCaixas.innerHTML = "<i>Nenhuma caixa vinculada a este cliente.</i>";
    } else {
      divCaixas.innerHTML = dataCliente.caixas.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding:5px; background:#fff; color:#000; border:1px solid #ddd; border-radius:4px;">
          <span>📦 <b>${c.nome_caixa1 || c.nome}</b> (ID ${c.id})</span>
          <button onclick="desvincularCaixaCliente(${c.id})" style="background:#ffc107; color:#000; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:12px;">Desvincular</button>
        </div>
      `).join("");
    }

    const selectLivre = document.getElementById("fichaSelectCaixasLivre");
    selectLivre.innerHTML = '<option value="">Selecione uma caixa para vincular...</option>';
    
    if (Array.isArray(caixasTodas)) {
      caixasTodas
        .filter(c => !c.cliente_nome && !c.usuario_id)
        .forEach(c => {
          selectLivre.innerHTML += `<option value="${c.id}">${c.nome_caixa1 || c.nome} (ID: ${c.id})</option>`;
        });
    }

    document.getElementById("modalFichaCliente").style.display = "flex";
  } catch (err) {
    alert("❌ Erro ao abrir a ficha do cliente.");
  }
};

window.fecharFichaCliente = function() {
  document.getElementById("modalFichaCliente").style.display = "none";
  clienteAtualId = null;
};

window.salvarFichaCliente = async function() {
  if (!clienteAtualId) return;

  const usuario = document.getElementById("fichaUsuario").value.trim();
  const senha = document.getElementById("fichaSenha").value.trim();
  const caixaAdicionar = document.getElementById("fichaSelectCaixasLivre").value;

  try {
    const res = await fetch(`${API_BASE}/api/admin/clientes/${clienteAtualId}/completo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario,
        senha,
        caixa_id_adicionar: caixaAdicionar || null
      }),
      credentials: "same-origin"
    });

    if (res.ok) {
      alert("✅ Ficha atualizada com sucesso!");
      fecharFichaCliente();
      carregarClientes();
    } else {
      alert("❌ Erro ao atualizar ficha.");
    }
  } catch (err) {
    alert("❌ Erro na conexão.");
  }
};

window.excluirClienteFicha = async function() {
  if (!clienteAtualId) return;

  if (confirm("Tem certeza que deseja excluir este cliente?")) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/clientes/${clienteAtualId}`, {
        method: "DELETE",
        credentials: "same-origin"
      });

      if (res.ok) {
        alert("✅ Cliente removido!");
        fecharFichaCliente();
        carregarClientes();
      } else {
        alert("❌ Erro ao remover cliente.");
      }
    } catch (err) {
      alert("❌ Erro na conexão.");
    }
  }
};

// =======================
// 📝 SELECTS DE OUTROS FORMULÁRIOS
// =======================
async function carregarSelectsFormularios() {
  try {
    const [resCli, resCai] = await Promise.all([
      fetch(API_BASE + "/api/clientes", { credentials: "same-origin" }),
      fetch(API_BASE + "/api/caixas", { credentials: "same-origin" })
    ]);

    const clientes = await resCli.json();
    const caixas = await resCai.json();

    const selCliCriar = document.getElementById("selectClienteCriar");
    const selCliAssociar = document.getElementById("selectClienteAssociar");
    const selCaixasAssoc = document.getElementById("selectCaixaAssociar");

    if (selCliCriar) {
      selCliCriar.innerHTML = '<option value="">Vincular a um cliente (Opcional)...</option>';
      if (Array.isArray(clientes)) {
        clientes.forEach(c => selCliCriar.innerHTML += `<option value="${c.id}">${c.usuario} (ID: ${c.id})</option>`);
      }
    }

    if (selCliAssociar) {
      selCliAssociar.innerHTML = '<option value="">Selecione o Cliente...</option>';
      if (Array.isArray(clientes)) {
        clientes.forEach(c => selCliAssociar.innerHTML += `<option value="${c.id}">${c.usuario} (ID: ${c.id})</option>`);
      }
    }

    if (selCaixasAssoc) {
      selCaixasAssoc.innerHTML = '<option value="">Selecione a Caixa...</option>';
      if (Array.isArray(caixas)) {
        caixas.forEach(c => selCaixasAssoc.innerHTML += `<option value="${c.id}">${c.nome_caixa1 || 'Caixa'} (ID: ${c.id})</option>`);
      }
    }
  } catch (err) {
    console.error("Erro ao carregar opções dos selects:", err);
  }
}

// =======================
// 🚨 GERENCIAMENTO DE CHAMADOS
// =======================
async function carregarChamados() {
  try {
    const res = await fetch(API_BASE + '/api/chamados', { credentials: "same-origin" });
    if (!res.ok) return;

    const chamados = await res.json();
    const tbody = document.querySelector('#tabelaAlertasAdmin tbody');
    if (!tbody) return;

    if (!Array.isArray(chamados) || chamados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 15px;">Nenhum chamado registrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = chamados.map(c => {
      const isConcluido = c.status === 'Concluído';
      return `
        <tr style="border-bottom: 1px solid #333; text-align: center;">
          <td style="padding: 8px;">${c.data_hora || '-'}</td>
          <td style="padding: 8px;">${c.cliente_nome || 'Cliente'}</td>
          <td style="padding: 8px;">${c.assunto || 'Outro'}</td>
          <td style="padding: 8px;">
            <div>${c.mensagem || '-'}</div>
            ${c.solucao ? `<div style="font-size:12px; color: #155724; background: #d4edda; padding: 4px; border-radius: 4px; margin-top: 4px; text-align: left;"><b>Solução:</b> ${c.solucao}</div>` : ''}
          </td>
          <td style="padding: 8px;">
            ${isConcluido 
              ? `<span style="background: #10b981; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;">✅ Concluído</span>`
              : `<button onclick="atualizarStatus(${c.id})" style="background: #ffc107; color: #212529; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                   ⏳ Resolver chamado
                 </button>`
            }
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao renderizar chamados:', err);
  }
}

window.atualizarStatus = async function(id) {
  const solucaoText = prompt("Descreva o que foi feito para resolver este problema:");
  if (solucaoText === null) return; 

  if (!solucaoText.trim()) {
    return alert("⚠️ É necessário descrever a solução para concluir o chamado!");
  }

  try {
    const res = await fetch(`${API_BASE}/api/chamados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'Concluído',
        solucao: solucaoText.trim()
      }),
      credentials: "same-origin"
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert("✅ Chamado resolvido e salvo no histórico!");
      carregarChamados();
    } else {
      alert('Erro ao atualizar chamado.');
    }
  } catch (err) {
    alert('Erro de conexão ao atualizar status.');
  }
};

// =======================
// ⚡ INICIALIZAÇÃO DA PÁGINA
// =======================
document.addEventListener("DOMContentLoaded", () => {
  verificarSessao();
  carregarCaixas();
  carregarClientesSelectAdmin();
  carregarChamados();

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = async () => {
      await fetch(API_BASE + "/api/logout", { 
        method: "POST",
        credentials: "same-origin"
      });
      sessionStorage.clear();
      window.location.href = "index.html";
    };
  }
});