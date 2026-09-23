const API_BASE = window.location.origin;
let graficoCaixa = null;

// Extrai o ID da caixa passado na URL (ex: detalhes-caixa.html?id=1)
const urlParams = new URLSearchParams(window.location.search);
const idCaixa = urlParams.get('id') || '1';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validar sessão do utilizador
  await verificarSessao();

  // 2. Atualizar identificadores visuais iniciais
  document.getElementById('tituloCaixa').textContent = `Caixa d'Água ${idCaixa}`;
  document.getElementById('infoId').textContent = `RES-${idCaixa}`;

  // 3. Configurar Botão Sair / Logout
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

  // 4. Carregar Dados Dinâmicos e Histórico
  await carregarDadosCaixa(idCaixa);
  await carregarHistoricoCaixa(idCaixa);

  // Atualização em tempo real a cada 5 segundos
  setInterval(() => {
    carregarDadosCaixa(idCaixa);
    carregarHistoricoCaixa(idCaixa);
  }, 5000);
});

// Verificar se o utilizador está autenticado
async function verificarSessao() {
  try {
    const res = await fetch(`${API_BASE}/api/usuario-atual`, { credentials: "same-origin" });
    const data = await res.json();
    if (!data.logado) {
      window.location.href = "index.html";
    }
  } catch (err) {
    window.location.href = "index.html";
  }
}

// Procurar dados em tempo real da caixa na API
async function carregarDadosCaixa(id) {
  try {
    const res = await fetch(`${API_BASE}/api/caixas/${id}`, { credentials: "same-origin" });
    if (!res.ok) return;

    const caixa = await res.json();

    // Atualizar títulos e capacidades
    document.getElementById("tituloCaixa").innerText = `${caixa.nome_caixa1 || 'Caixa 1'} / ${caixa.nome_caixa2 || 'Caixa 2'}`;
    
    const cap1 = Number(caixa.capacidade_caixa1) || 1000;
    const cap2 = Number(caixa.capacidade_caixa2) || 1000;
    const capTotal = cap1 + cap2;
    document.getElementById("infoCapacidade").innerText = `${capTotal.toLocaleString('pt-BR')} Litros`;

    // Níveis percentuais
    const n1 = Math.min(100, Math.max(0, caixa.nivel_caixa1 ?? 0));
    const n2 = Math.min(100, Math.max(0, caixa.nivel_caixa2 ?? 0));

    // Cálculo do volume em litros
    const vol1 = Math.round((n1 / 100) * cap1);
    const vol2 = Math.round((n2 / 100) * cap2);
    const volTotal = vol1 + vol2;

    document.getElementById("percCaixa1").innerText = `${n1}%`;
    document.getElementById("volCaixa1").innerText = `${vol1.toLocaleString('pt-BR')} L`;

    document.getElementById("percCaixa2").innerText = `${n2}%`;
    document.getElementById("volCaixa2").innerText = `${vol2.toLocaleString('pt-BR')} L`;

    document.getElementById("infoVolumeTotal").innerText = `${volTotal.toLocaleString('pt-BR')} Litros`;

    // Data da última atualização do sensor
    if (caixa.ultima_atualizacao) {
      const dataFormatada = new Date(caixa.ultima_atualizacao).toLocaleString("pt-BR");
      document.getElementById("infoData").innerText = dataFormatada;
    } else {
      document.getElementById("infoData").innerText = new Date().toLocaleString("pt-BR");
    }

  } catch (err) {
    console.error("Erro ao carregar dados da caixa:", err);
  }
}

// Desenhar e atualizar o gráfico do Chart.js
async function carregarHistoricoCaixa(id) {
  try {
    const res = await fetch(`${API_BASE}/api/historico/${id}`, { credentials: "same-origin" });
    if (!res.ok) return;

    const dados = await res.json();
    if (!Array.isArray(dados) || dados.length === 0) return;

    const labels = dados.map(item => new Date(item.data_registro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })).reverse();
    const niveisCaixa1 = dados.map(item => item.media_caixa1).reverse();
    const niveisCaixa2 = dados.map(item => item.media_caixa2).reverse();

    const ctx = document.getElementById('graficoDetalhadoCaixa');
    if (!ctx) return;

    if (graficoCaixa) {
      graficoCaixa.data.labels = labels;
      graficoCaixa.data.datasets[0].data = niveisCaixa1;
      graficoCaixa.data.datasets[1].data = niveisCaixa2;
      graficoCaixa.update();
    } else {
      graficoCaixa = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Reservatório 1 (%)',
              data: niveisCaixa1,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'Reservatório 2 (%)',
              data: niveisCaixa2,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
              max: 100,
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: { color: '#94a3b8' }
            },
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: { color: '#94a3b8' }
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
  } catch (err) {
    console.error("Erro ao carregar gráfico:", err);
  }
}