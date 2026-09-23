const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Valida se é admin logado antes de carregar os dados
  await verificarSessaoAdmin();

  // 2. Carrega lista e dropdowns
  carregarCaixas();
  carregarClientesSelect();

  // 3. Evento do Formulário
  const formCaixa = document.getElementById('formCaixa');
  if (formCaixa) {
    formCaixa.addEventListener('submit', salvarCaixas);
  }

  // 4. Evento do Botão Sair (Logout)
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

// VERIFICAR SESSÃO ADMIN
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

// CARREGAR LISTA DE CAIXAS DE ÁGUA
async function carregarCaixas() {
  const tbody = document.getElementById('listaCaixas');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando reservatórios...</td></tr>';

  try {
    const resposta = await fetch('/api/caixas', {
      credentials: 'same-origin'
    });

    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = 'index.html';
      return;
    }

    const caixas = await resposta.json();

    if (!Array.isArray(caixas) || caixas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhum par de caixas cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    caixas.forEach(item => {
      const tr = document.createElement('tr');
      
      const nivel1 = item.nivel_caixa1 ?? 0;
      const nivel2 = item.nivel_caixa2 ?? 0;

      tr.innerHTML = `
        <td>CX-${item.id}</td>
        <td>${item.cliente_nome || 'Sem Dono (Livre)'}</td>
        <td>${item.nome_caixa1 || 'Caixa 1'} (${item.capacidade_caixa1 || 1000}L)</td>
        <td><span class="badge-status ${getBadgeClass(nivel1)}">${nivel1}%</span></td>
        <td>${item.nome_caixa2 || 'Caixa 2'} (${item.capacidade_caixa2 || 1000}L)</td>
        <td><span class="badge-status ${getBadgeClass(nivel2)}">${nivel2}%</span></td>
        <td>
          <button class="btn-action btn-danger" title="Excluir" onclick="deletarCaixa(${item.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (erro) {
    console.error('Erro ao carregar caixas:', erro);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #f87171;">Erro ao carregar dados do banco de dados.</td></tr>';
  }
}

// SALVAR NOVO PAR DE CAIXAS
async function salvarCaixas(e) {
  e.preventDefault();

  const dados = {
    usuario_id: document.getElementById('selectCliente').value,
    nome_caixa1: document.getElementById('nomeCaixa1').value.trim(),
    capacidade_caixa1: document.getElementById('capacidadeCaixa1').value,
    altura_sensor1: document.getElementById('alturaSensor1').value,
    nome_caixa2: document.getElementById('nomeCaixa2').value.trim(),
    capacidade_caixa2: document.getElementById('capacidadeCaixa2').value,
    altura_sensor2: document.getElementById('alturaSensor2').value
  };

  try {
    const res = await fetch('/api/caixas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
      credentials: 'same-origin'
    });

    if (res.ok) {
      alert("✅ Par de caixas cadastrado com sucesso!");
      fecharModalCaixa();
      document.getElementById('formCaixa').reset();
      carregarCaixas();
    } else {
      const errData = await res.json();
      alert(errData.error || 'Erro ao salvar conjunto de caixas.');
    }
  } catch (err) {
    console.error('Erro ao salvar:', err);
    alert('Erro de conexão ao salvar caixas.');
  }
}

// CARREGAR CLIENTES NO SELECT
async function carregarClientesSelect() {
  try {
    const res = await fetch('/api/clientes', { credentials: 'same-origin' });
    const clientes = await res.json();
    const select = document.getElementById('selectCliente');

    if (!select) return;

    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    if (Array.isArray(clientes)) {
      clientes.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.usuario} (${c.email || 'Sem email'})</option>`;
      });
    }
  } catch (err) {
    console.error('Erro ao carregar lista de clientes:', err);
  }
}

// DELETAR CAIXA
window.deletarCaixa = async function(id) {
  if (!confirm(`Deseja realmente remover o par de caixas CX-${id}?`)) return;

  try {
    const res = await fetch(`/api/caixas/${id}`, { 
      method: 'DELETE',
      credentials: 'same-origin'
    });

    if (res.ok) {
      carregarCaixas();
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao deletar caixa.');
    }
  } catch (err) {
    alert('Erro de conexão ao deletar caixa.');
  }
};

// BADGES DE CORES
function getBadgeClass(nivel) {
  if (nivel <= 20) return 'badge-warning';
  return 'badge-ok';
}

// CONTROLE DO MODAL
window.abrirModalCaixa = function() {
  const modal = document.getElementById('modalCaixa');
  if (modal) modal.style.display = 'flex';
};

window.fecharModalCaixa = function() {
  const modal = document.getElementById('modalCaixa');
  if (modal) modal.style.display = 'none';
};