document.addEventListener('DOMContentLoaded', () => {
  carregarCaixas();
});

async function carregarCaixas() {
  const tbody = document.getElementById('listaCaixas');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando dados...</td></tr>';

  try {
    // Altere a URL abaixo caso sua rota no Node/Express seja diferente (ex: /api/caixas)
    const resposta = await fetch('/api/caixas'); 
    
    if (!resposta.ok) {
      throw new Error('Erro ao buscar dados do servidor');
    }

    const caixas = await resposta.json();

    // Se o banco retornar vazio
    if (caixas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma caixa cadastrada no banco.</td></tr>';
      return;
    }

    // Limpa a tabela para renderizar os dados reais
    tbody.innerHTML = '';

    caixas.forEach(caixa => {
      // Ajuste os nomes das propriedades (caixa.id, caixa.cliente, etc) de acordo com a resposta da sua API
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td>CX-${caixa.id}</td>
        <td>${caixa.cliente_nome || caixa.cliente || 'Sem Dono (Livre)'}</td>
        <td>${caixa.capacidade} L</td>
        <td>${caixa.altura_sensor || '--'} cm</td>
        <td>
          <span class="badge-status ${getBadgeClass(caixa.nivel_atual)}">
            ${caixa.nivel_atual}%
          </span>
        </td>
        <td>
          <button class="btn-action" onclick="editarCaixa(${caixa.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-action" onclick="deletarCaixa(${caixa.id})"><i class="fas fa-trash"></i></button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (erro) {
    console.error('Erro:', erro);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #f87171;">Erro ao carregar dados do banco de dados.</td></tr>';
  }
}

// Função auxiliar para definir a cor da badge do nível da água
function getBadgeClass(nivel) {
  if (nivel <= 20) return 'badge-warning'; // Amarelo/Vermelho para nível baixo
  return 'badge-ok'; // Verde para nível bom
}

document.addEventListener('DOMContentLoaded', () => {
  carregarCaixas();
});

async function carregarCaixas() {
  const tbody = document.getElementById('listaCaixas');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando reservatórios...</td></tr>';

  try {
    const resposta = await fetch('/api/caixas');
    
    if (resposta.status === 401) {
      window.location.href = 'index.html'; // Redireciona se a sessão expirar
      return;
    }

    const caixas = await resposta.json();

    if (!caixas || caixas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma caixa d\'água cadastrada.</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    caixas.forEach(caixa => {
      const tr = document.createElement('tr');
      const nivel = caixa.nivel_atual ?? 0;
      
      tr.innerHTML = `
        <td>CX-${caixa.id}</td>
        <td>${caixa.cliente_nome || 'Sem Dono (Livre)'}</td>
        <td>${caixa.capacidade || 1000} L</td>
        <td>${caixa.altura_sensor || 100} cm</td>
        <td>
          <span class="badge-status ${getBadgeClass(nivel)}">
            ${nivel}%
          </span>
        </td>
        <td>
          <button class="btn-action" title="Editar" onclick="editarCaixa(${caixa.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-action" title="Excluir" onclick="deletarCaixa(${caixa.id})"><i class="fas fa-trash"></i></button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (erro) {
    console.error('Erro ao carregar caixas:', erro);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #f87171;">Erro ao carregar dados do banco.</td></tr>';
  }
}

function getBadgeClass(nivel) {
  if (nivel <= 20) return 'badge-warning';
  return 'badge-ok';
}

async function deletarCaixa(id) {
  if (!confirm(`Deseja realmente remover a caixa CX-${id}?`)) return;

  try {
    const res = await fetch(`/api/caixas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      carregarCaixas();
    } else {
      alert(data.error || 'Erro ao deletar caixa.');
    }
  } catch (err) {
    alert('Erro de conexão ao deletar caixa.');
  }
}