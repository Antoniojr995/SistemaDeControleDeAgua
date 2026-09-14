const API_BASE = window.location.origin;
const token = sessionStorage.getItem("token");

// 🔒 1. VERIFICAÇÃO DE SESSÃO
async function verificarSessao() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", {
      headers: { Authorization: "Bearer " + token }
    });
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

// 🗂️ 2. NAVEGAÇÃO POR ABAS
function mudarAba(idAba) {
  document.querySelectorAll(".camada-conteudo").forEach(div => {
    div.style.display = "none";
  });
  
  const aba = document.getElementById(idAba);
  if (aba) aba.style.display = "block";

  if (idAba === "abaCaixas") carregarCaixas();
  if (idAba === "abaClientes") carregarClientes();
  if (idAba === "abaRegistros") carregarSelectsFormularios();
  if (idAba === "abaChamados") {
    carregarChamados();
    carregarAlertasAdmin();
  }
}

// 📦 3. ABA CAIXAS D'ÁGUA
async function carregarCaixas() {
  const listaCaixas = document.getElementById("listaCaixas");
  if (!listaCaixas) return;

  try {
    const res = await fetch(API_BASE + "/api/caixas", {
      headers: { Authorization: "Bearer " + token }
    });
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

async function renomearCaixaSelecionada() {
  const select = document.getElementById("listaCaixas");
  const id = select ? select.value : null;

  if (!id) return alert("⚠️ Selecione uma caixa para renomear!");

  const novoNome = prompt("Digite o novo nome para esta caixa:");
  if (!novoNome) return;

  try {
    const res = await fetch(`${API_BASE}/api/caixas/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
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

async function deletarCaixaSelecionada() {
  const select = document.getElementById("listaCaixas");
  const id = select ? select.value : null;

  if (!id) return alert("⚠️ Selecione uma caixa para excluir!");

  if (confirm(`Tem certeza que deseja apagar a caixa ID ${id}?`)) {
    try {
      const res = await fetch(`${API_BASE}/api/caixas/${id}`, { 
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
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

// 👥 4. ABA CLIENTES (LISTA E AÇÕES)
let clienteAtualId = null;

async function carregarClientes() {
  const div = document.getElementById("listaClientes");
  if (!div) return;

  try {
    const res = await fetch(API_BASE + "/api/clientes", {
      headers: { Authorization: "Bearer " + token }
    });
    const clientes = await res.json();

    if (!Array.isArray(clientes) || clientes.length === 0) {
      div.innerHTML = "<p>Nenhum cliente cadastrado.</p>";
      return;
    }

    div.innerHTML = clientes.map(c => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 12px; border-radius: 6px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span>🆔 <b>${c.id}</b> | 👤 <b>${c.usuario}</b></span>
        <div>
          <button onclick="abrirFichaCliente(${c.id})" style="background: #0275d8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">🔍 Ver Ficha / Editar</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    div.innerHTML = "<p>Erro ao carregar clientes.</p>";
  }
}

async function abrirFichaCliente(id) {
  clienteAtualId = id;
  
  try {
    const headers = { Authorization: "Bearer " + token };
    const [resCliente, resCaixasLivres] = await Promise.all([
      fetch(`${API_BASE}/api/admin/clientes/${id}`, { headers }),
      fetch(`${API_BASE}/api/caixas`, { headers })
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; padding:5px; background:#fff; border:1px solid #ddd; border-radius:4px;">
          <span>📦 <b>${c.nome}</b> (ID ${c.id}) - <small style="color:${c.status === 'Online' ? 'green' : 'red'};">● ${c.status || 'Offline/Desconhecido'}</small></span>
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
          selectLivre.innerHTML += `<option value="${c.id}">${c.nome} (ID: ${c.id})</option>`;
        });
    }

    document.getElementById("modalFichaCliente").style.display = "flex";
  } catch (err) {
    console.error(err);
    alert("❌ Erro ao abrir a ficha do cliente.");
  }
}

function fecharFichaCliente() {
  document.getElementById("modalFichaCliente").style.display = "none";
  clienteAtualId = null;
}

async function salvarFichaCliente() {
  if (!clienteAtualId) return;

  const usuario = document.getElementById("fichaUsuario").value.trim();
  const senha = document.getElementById("fichaSenha").value.trim();
  const caixaAdicionar = document.getElementById("fichaSelectCaixasLivre").value;

  try {
    const res = await fetch(`${API_BASE}/api/admin/clientes/${clienteAtualId}/completo`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
      body: JSON.stringify({
        usuario,
        senha,
        caixa_id_adicionar: caixaAdicionar || null
      })
    });

    if (res.ok) {
      alert("✅ Ficha atualizada com sucesso!");
      fecharFichaCliente();
      carregarClientes();
    } else {
      alert("❌ Erro ao salvar ficha.");
    }
  } catch (err) {
    alert("❌ Erro na conexão.");
  }
}

async function desvincularCaixaCliente(caixaId) {
  if (!confirm("Deseja remover o vínculo desta caixa d'água com este cliente?")) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/clientes/${clienteAtualId}/completo`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
      body: JSON.stringify({ caixa_id_remover: caixaId })
    });

    if (res.ok) {
      alert("✅ Caixa desvinculada!");
      abrirFichaCliente(clienteAtualId);
    }
  } catch (err) {
    alert("❌ Erro ao desvincular caixa.");
  }
}

async function excluirClienteFicha() {
  if (!clienteAtualId) return;

  if (confirm(`Tem certeza que deseja apagar o cliente ID ${clienteAtualId}? Todas as caixas dele ficarão sem dono.`)) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/clientes/${clienteAtualId}`, { 
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      if (res.ok) {
        alert("✅ Cliente removido!");
        fecharFichaCliente();
        carregarClientes();
      } else {
        alert("❌ Erro ao remover cliente.");
      }
    } catch (err) {
      alert("❌ Erro de conexão.");
    }
  }
}

// 📝 5. PREENCHER SELECTS DOS FORMULÁRIOS (ABA REGISTROS)
async function carregarSelectsFormularios() {
  try {
    const headers = { Authorization: "Bearer " + token };
    const [resCli, resCai] = await Promise.all([
      fetch(API_BASE + "/api/clientes", { headers }),
      fetch(API_BASE + "/api/caixas", { headers })
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
        caixas.forEach(c => selCaixasAssoc.innerHTML += `<option value="${c.id}">${c.nome} (ID: ${c.id})</option>`);
      }
    }
  } catch (err) {
    console.error("Erro ao carregar opções dos selects:", err);
  }
}

// 🔔 6. ABA CHAMADOS E ALERTAS
async function carregarAlertasAdmin() {
  try {
    const res = await fetch(API_BASE + "/api/alertas", {
      headers: { Authorization: "Bearer " + token }
    });
    const alertas = await res.json();
    const tbody = document.querySelector("#tabelaAlertasAdmin tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (!Array.isArray(alertas) || alertas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum chamado ou alerta pendente.</td></tr>';
      return;
    }

    alertas.forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:8px;">${new Date(a.criado_em).toLocaleString("pt-BR")}</td>
        <td style="padding:8px;"><strong>${a.usuario}</strong></td>
        <td style="padding:8px;">${a.tipo}</td>
        <td style="padding:8px; text-align: left;">${a.mensagem}</td>
        <td style="padding:8px;"><span style="color: red; font-weight: bold;">Pendente</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao carregar alertas:", err);
  }
}

async function carregarChamados() {
  try {
    const res = await fetch('/api/chamados');
    const chamados = await res.json();
    
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;

    if (!Array.isArray(chamados) || chamados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 15px;">Nenhum chamado registrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = chamados.map(c => {
      const statusAtual = c.status || 'Pendente';
      const isConcluido = statusAtual === 'Concluído';

      return `
        <tr style="border-bottom: 1px solid #eee; text-align: center;">
          <td style="padding: 8px;">#${c.id}</td>
          <td style="padding: 8px;">${c.cliente_nome || 'Cliente'}</td>
          <td style="padding: 8px;">${c.assunto || 'Outro'}</td>
          <td style="padding: 8px;">${c.mensagem || '-'}</td>
          <td style="padding: 8px;">
            ${isConcluido 
              ? `<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px; font-weight: bold;">✅ Concluído</span>`
              : `<button onclick="atualizarStatus(${c.id}, 'Concluído')" style="background: #ffc107; color: #212529; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                   ⏳ Pendente (Marcar Concluído)
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

// Função para enviar a atualização para o servidor
async function atualizarStatus(id, novoStatus) {
  try {
    const res = await fetch(`/api/chamados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    });

    const data = await res.json();
    if (data.success) {
      carregarChamados(); // Recarrega a tabela na tela
    } else {
      alert('Erro ao atualizar: ' + data.error);
    }
  } catch (err) {
    console.error('Erro na requisição:', err);
    alert('Erro de conexão ao atualizar status.');
  }
}

document.addEventListener('DOMContentLoaded', carregarChamados);

// 🚀 7. EVENTOS E INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  verificarSessao();
  carregarCaixas();

  // Botão Ver Caixa Selecionada
  const btnVer = document.getElementById("btnVer");
  if (btnVer) {
    btnVer.onclick = () => {
      const select = document.getElementById("listaCaixas");
      const id = select ? select.value : null;
      if (!id) return alert("Selecione uma caixa!");

      sessionStorage.setItem("caixaSelecionada", id);
      window.location.href = "painel.html";
    };
  }

  // Botão Cadastrar Cliente
  const btnCadastrarCliente = document.getElementById("btnCadastrarCliente");
  if (btnCadastrarCliente) {
    btnCadastrarCliente.onclick = async () => {
      const email = document.getElementById("novoClienteEmail").value.trim();
      const senha = document.getElementById("novoClienteSenha").value.trim();

      if (!email || !senha) return alert("⚠️ Preencha o e-mail e a senha!");

      try {
        const res = await fetch(API_BASE + "/api/usuarios", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: "Bearer " + token 
          },
          body: JSON.stringify({ usuario: email, senha, tipo: "usuario" })
        });

        if (res.ok) {
          alert("✅ Cliente cadastrado com sucesso!");
          document.getElementById("formNovoCliente").reset();
          carregarSelectsFormularios();
        } else {
          alert("❌ Erro ao cadastrar cliente.");
        }
      } catch (err) {
        alert("❌ Falha de conexão.");
      }
    };
  }

  // Botão Criar Caixa
  const btnAdicionar = document.getElementById("btnAdicionar");
  if (btnAdicionar) {
    btnAdicionar.onclick = async () => {
      const nomeCaixa = document.getElementById("nomeCaixa").value.trim();
      const usuarioId = document.getElementById("selectClienteCriar").value;

      if (!nomeCaixa) return alert("⚠️ Digite o nome da caixa!");

      try {
        const res = await fetch(API_BASE + "/api/caixas", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: "Bearer " + token 
          },
          body: JSON.stringify({ nome: nomeCaixa, usuario_id: usuarioId || null })
        });

        if (res.ok) {
          alert("✅ Caixa criada com sucesso!");
          document.getElementById("nomeCaixa").value = "";
          carregarSelectsFormularios();
        } else {
          alert("❌ Erro ao criar caixa.");
        }
      } catch (err) {
        alert("❌ Falha de conexão.");
      }
    };
  }

  // Botão Associar Caixa
  const btnAssociar = document.getElementById("btnAssociar");
  if (btnAssociar) {
    btnAssociar.onclick = async () => {
      const idCaixa = document.getElementById("selectCaixaAssociar").value;
      const idUsuario = document.getElementById("selectClienteAssociar").value;

      if (!idCaixa || !idUsuario) return alert("⚠️ Selecione a caixa e o cliente!");

      try {
        const res = await fetch(`${API_BASE}/api/caixas/${idCaixa}/associar`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            Authorization: "Bearer " + token 
          },
          body: JSON.stringify({ usuario_id: idUsuario })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert("✅ Caixa vinculada com sucesso!");
          carregarSelectsFormularios();
        } else {
          alert("❌ Erro ao associar caixa.");
        }
      } catch (err) {
        alert("❌ Erro de conexão.");
      }
    };
  }

  // Botão Logout
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.onclick = async () => {
      await fetch(API_BASE + "/api/logout", { 
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
      sessionStorage.clear();
      window.location.href = "index.html";
    };
  }
});