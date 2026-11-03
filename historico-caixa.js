const API_BASE = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
const idCaixa = urlParams.get('id') || sessionStorage.getItem("caixaSelecionada") || '1';
let meuGrafico = null;

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('tituloHistorico').textContent = `Histórico - Caixa d'Água ${idCaixa}`;
  
  // Carrega o histórico inicial (padrão 24h ou o que estiver selecionado)
  await carregarDadosHistorico();

  // Ouve a alteração no select de período para atualizar o gráfico na hora
  document.getElementById('filtroPeriodo')?.addEventListener('change', async (e) => {
    const periodoSelecionado = e.target.value;
    await carregarDadosHistorico(periodoSelecionado);
  });
});

async function carregarDadosHistorico(periodo = '24h') {
  try {
    // Passa o período na query string para o backend (ex: /api/historico/1?periodo=7d)
    const res = await fetch(`${API_BASE}/api/historico/${idCaixa}?periodo=${periodo}`, { credentials: "same-origin" });
    
    if (!res.ok) throw new Error("Erro ao carregar dados do histórico");
    
    const dados = await res.json();
    
    renderizarTabela(dados);
    renderizarGrafico(dados, periodo);
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
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 10px; text-align: center;">Nenhum registro encontrado (Sensor desativado ou sem dados).</td></tr>`;
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

function renderizarGrafico(dados, periodo) {
  const canvas = document.getElementById('graficoHistoricoCompleto');
  const ctx = canvas.getContext('2d');

  let labels, valoresCaixa1, valoresCaixa2;

  // Se o banco estiver vazio (sensor desligado), gera dados simulados adaptados ao período escolhido
  if (!dados || dados.length === 0) {
    if (periodo === '30d') {
      labels = ['Dia 05', 'Dia 10', 'Dia 15', 'Dia 20', 'Dia 25', 'Dia 30'];
      valoresCaixa1 = [400, 600, 750, 500, 850, 900];
      valoresCaixa2 = [200, 300, 450, 350, 500, 450];
    } else if (periodo === '7d') {
      labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      valoresCaixa1 = [300, 500, 700, 650, 800, 750, 900];
      valoresCaixa2 = [150, 250, 400, 350, 450, 400, 500];
    } else {
      labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
      valoresCaixa1 = [200, 450, 800, 600, 950, 400];
      valoresCaixa2 = [100, 250, 400, 300, 500, 200];
    }
  } else {
    const dadosOrdenados = [...dados].reverse();
    labels = dadosOrdenados.map(d => d.dia);
    valoresCaixa1 = dadosOrdenados.map(d => Number(d.media_caixa1 || 0));
    valoresCaixa2 = dadosOrdenados.map(d => Number(d.media_caixa2 || 0));
  }

  if (meuGrafico) {
    meuGrafico.destroy();
  }

  meuGrafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Reservatório 1 (L)',
          data: valoresCaixa1,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.2,
          pointRadius: 4,
          pointBackgroundColor: '#38bdf8'
        },
        {
          label: 'Reservatório 2 (L)',
          data: valoresCaixa2,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.2,
          pointRadius: 4,
          pointBackgroundColor: '#34d399'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 25,   // Garante espaço seguro para o "0" aparecer inteiro
          right: 35,  // Garante espaço seguro para a última etiqueta da direita não cortar
          top: 25,
          bottom: 15  // Dá respiro para o eixo X e o título "Tempo / Data"
        }
      },
      scales: {
        y: {
          min: 0,    // Fixa o início rigidamente em 0 Litros
          max: 1000, // Fixa o teto em 1000 Litros
          grid: { 
            color: 'rgba(51, 65, 85, 0.5)',
            drawBorder: false
          },
          ticks: { 
            color: '#94a3b8',
            font: { size: 12 },
            stepSize: 200 // Escala limpa: 0, 200, 400, 600, 800, 1000
          },
          title: {
            display: true,
            text: 'Volume (Litros)',
            color: '#38bdf8',
            font: { size: 13, weight: 'bold' }
          }
        },
        x: {
          grid: { 
            display: false
          },
          ticks: { 
            color: '#94a3b8',
            font: { size: 12 },
            maxRotation: 0,
            autoSkip: false // Mantém todas as etiquetas visíveis sem cortar as pontas
          },
          title: {
            display: true,
            text: 'Tempo / Data',
            color: '#38bdf8',
            font: { size: 13, weight: 'bold' }
          }
        }
      },
      plugins: {
        legend: {
          labels: { 
            color: '#f8fafc',
            font: { size: 13, weight: 'bold' }
          }
        }
      }
    }
  });
}