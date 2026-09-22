document.addEventListener('DOMContentLoaded', () => {
  carregarCaixas();
  carregarClientesSelect();

  const formCaixa = document.getElementById('formCaixa');
  if (formCaixa) {
    formCaixa.addEventListener('submit', salvarCaixas);
  }
});

// CARREGAR LISTA DE CAIXAS (2 CAIXAS POR CLIENTE)
// Exemplo de inclusão do token nas requisições do caixas.js
const token = sessionStorage.getItem("token");

async function carregarCaixas() {
  const tbody = document.getElementById('listaCaixas');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando reservatórios...</td></tr>';

  try {
    const resposta = await fetch('/api/caixas', {
      headers: { Authorization: "Bearer " + token } // Adicionado o token
    });
    
    if (resposta.status === 401) {
      window.location.href = 'index.html';
      return;
    }
    
    const caixas = await resposta.json();

    if (!caixas || caixas.length === 0) {
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
          <button class="btn-action" title="Excluir" onclick="deletarCaixa(${item.id})"><i class="fas fa-trash"></i></button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (erro) {
    console.error('Erro ao carregar caixas:', erro);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #f87171;">Erro ao carregar dados do banco de dados.</td></tr>';
  }
}

// SALVAR CAIXAS (CADASTRAR PAR DE CAIXAS)
async function salvarCaixas(e) {
  e.preventDefault();

  const dados = {
    usuario_id: document.getElementById('selectCliente').value,
    nome_caixa1: document.getElementById('nomeCaixa1').value,
    capacidade_caixa1: document.getElementById('capacidadeCaixa1').value,
    altura_sensor1: document.getElementById('alturaSensor1').value,
    nome_caixa2: document.getElementById('nomeCaixa2').value,
    capacidade_caixa2: document.getElementById('capacidadeCaixa2').value,
    altura_sensor2: document.getElementById('alturaSensor2').value
  };

  try {
    const res = await fetch('/api/caixas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (res.ok) {
      fecharModalCaixa();
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

// CARREGAR CLIENTES NO DROPDOWN DO MODAL
async function carregarClientesSelect() {
  try {
    const res = await fetch('/api/clientes');
    const clientes = await res.json();
    const select = document.getElementById('selectCliente');

    if (!select) return;

    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    clientes.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.usuario}</option>`;
    });
  } catch (err) {
    console.error('Erro ao carregar lista de clientes:', err);
  }
}

// EXCLUIR REGISTRO
async function deletarCaixa(id) {
  if (!confirm(`Deseja realmente remover o par de caixas CX-${id}?`)) return;

  try {
    const res = await fetch(`/api/caixas/${id}`, { method: 'DELETE' });
    if (res.ok) {
      carregarCaixas();
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao deletar caixa.');
    }
  } catch (err) {
    alert('Erro de conexão ao deletar caixa.');
  }
}

// CORES DAS BADGES DE NÍVEL
function getBadgeClass(nivel) {
  if (nivel <= 20) return 'badge-warning';
  return 'badge-ok';
}

// CONTROLE DO MODAL
function abrirModalCaixa() {
  const modal = document.getElementById('modalCaixa');
  if (modal) modal.style.display = 'flex';
}

function fecharModalCaixa() {
  const modal = document.getElementById('modalCaixa');
  if (modal) modal.style.display = 'none';
}