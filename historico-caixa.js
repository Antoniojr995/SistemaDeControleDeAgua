const API_BASE = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
const idCaixa = urlParams.get('id') || sessionStorage.getItem("caixaSelecionada") || '1';
let meuGrafico = null;

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('tituloHistorico').textContent = `Histórico - Caixa d'Água ${idCaixa}`;
  await carregarDadosHistorico();
});

async function carregarDadosHistorico() {
  try {
    const res = await fetch(`${API_BASE}/api/historico/${idCaixa}`, { credentials: "same-origin" });
    
    if (!res.ok) throw new Error("Erro ao carregar dados do histórico");
    
    const dados = await res.json();
    
    renderizarTabela(dados);
    renderizarGrafico(dados);
  } catch (err) {
    console.error(err);
    document.getElementById('tabelaLogs').innerHTML = `
      <tr>
        <td colspan="5" style="padding: 10px; color: #ef4444; text-align: center;">
          ❌ Não foi possível carregar os registros do histórico.
        </td>
      </tr>
    `;
  }
}

function renderizarTabela(dados) {
  const tbody = document.getElementById('tabelaLogs');
  
  if (!dados || dados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 10px; text-align: center;">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = dados.map(item => {
    const v1 = Number(item.media_caixa1 || 0);
    const v2 = Number(item.media_caixa2 || 0);
    const total = v1 + v2;

    return `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px;">${item.dia}</td>
        <td style="padding: 10px; color: #38bdf8;">${v1} L</td>
        <td style="padding: 10px; color: #34d399;">${v2} L</td>
        <td style="padding: 10px; font-weight: bold;">${total} L</td>
        <td style="padding: 10px;"><span style="color: #4ade80;">OK</span></td>
      </tr>
    `;
  }).join('');
}

function renderizarGrafico(dados) {
  const ctx = document.getElementById('graficoHistoricoCompleto').getContext('2d');

  // Inverte o array para exibir o mais antigo à esquerda e o mais recente à direita no eixo do tempo (X)
  const dadosOrdenados = [...dados].reverse();

  const labels = dadosOrdenados.map(d => d.dia);
  const valoresCaixa1 = dadosOrdenados.map(d => Number(d.media_caixa1 || 0));
  const valoresCaixa2 = dadosOrdenados.map(d => Number(d.media_caixa2 || 0));

  if (meuGrafico) {
    meuGrafico.destroy();
  }

  meuGrafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels, // Eixo X: Tempo / Datas
      datasets: [
        {
          label: 'Reservatório 1 (L)',
          data: valoresCaixa1, // Eixo Y: Volumes em Litros
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Reservatório 2 (L)',
          data: valoresCaixa2, // Eixo Y: Volumes em Litros
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8' },
          title: {
            display: true,
            text: 'Volume (Litros)',
            color: '#38bdf8'
          }
        },
        x: {
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8' },
          title: {
            display: true,
            text: 'Tempo / Data',
            color: '#38bdf8'
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f8fafc' }
        }
      }
    }
  });
}