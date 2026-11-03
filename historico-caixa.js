const API_BASE = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
const idCaixa = urlParams.get('id') || sessionStorage.getItem("caixaSelecionada") || '1';

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('tituloHistorico').textContent = `Histórico - Caixa d'Água ${idCaixa}`;
  
  await carregarDadosHistorico();

  document.getElementById('filtroPeriodo')?.addEventListener('change', async (e) => {
    const periodoSelecionado = e.target.value;
    await carregarDadosHistorico(periodoSelecionado);
  });
});

async function carregarDadosHistorico(periodo = '24h') {
  try {
    const res = await fetch(`${API_BASE}/api/historico/${idCaixa}?periodo=${periodo}`, { credentials: "same-origin" });
    
    if (!res.ok) throw new Error("Erro ao carregar dados do histórico");
    
    const dados = await res.json();
    
    renderizarTabela(dados);
    renderizarGraficoSVG(dados, periodo);
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

function renderizarGraficoSVG(dados, periodo) {
  const container = document.getElementById('svgContainer');
  
  let labels, valoresCaixa1, valoresCaixa2;

  // Se o banco estiver vazio, usa dados de exemplo reais abrangendo o ciclo completo
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
      // 24 Horas completo (de 00:00 até 22:00)
      labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
      valoresCaixa1 = [150, 100, 450, 800, 600, 950, 300];
      valoresCaixa2 = [80,  50,  250, 400, 300, 500, 180];
    }
  } else {
    const dadosOrdenados = [...dados].reverse();
    labels = dadosOrdenados.map(d => d.dia);
    valoresCaixa1 = dadosOrdenados.map(d => Number(d.media_caixa1 || 0));
    valoresCaixa2 = dadosOrdenados.map(d => Number(d.media_caixa2 || 0));
  }

  // Dimensões do desenho SVG (aumentamos um pouco o paddingTop para dar folga aos textos dos pontos)
  const width = container.clientWidth || 700;
  const height = 390;
  const paddingLeft = 60;
  const paddingRight = 50;
  const paddingTop = 35;
  const paddingBottom = 50;

  const graficoWidth = width - paddingLeft - paddingRight;
  const graficoHeight = height - paddingTop - paddingBottom;

  const maxY = 1000;
  const minY = 0;

  const getX = (index) => {
    if (labels.length === 1) return paddingLeft + graficoWidth / 2;
    return paddingLeft + (index / (labels.length - 1)) * graficoWidth;
  };

  const getY = (val) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return paddingTop + graficoHeight - ((clamped - minY) / (maxY - minY)) * graficoHeight;
  };

  const yTicks = [0, 200, 400, 600, 800, 1000];
  let svgHTML = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;

  // Grelha horizontal e rótulos Y
  yTicks.forEach(tick => {
    const yPos = getY(tick);
    svgHTML += `
      <line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="rgba(51, 65, 85, 0.4)" stroke-dasharray="4" />
      <text x="${paddingLeft - 12}" y="${yPos + 4}" fill="#94a3b8" font-size="12" text-anchor="end">${tick}</text>
    `;
  });

  // Título eixo Y
  svgHTML += `
    <text transform="translate(15, ${paddingTop + graficoHeight / 2}) rotate(-90)" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="middle">Volume (Litros)</text>
  `;

  // Área e Linha Reservatório 2 (Verde)
  let ptsRes2 = [];
  valoresCaixa2.forEach((val, i) => {
    ptsRes2.push(`${getX(i)},${getY(val)}`);
  });
  const pathRes2 = `M ${ptsRes2.join(' L ')}`;
  const areaRes2 = `M ${paddingLeft},${getY(0)} L ${ptsRes2.join(' L ')} L ${width - paddingRight},${getY(0)} Z`;

  svgHTML += `
    <path d="${areaRes2}" fill="rgba(52, 211, 153, 0.12)" />
    <path d="${pathRes2}" fill="none" stroke="#34d399" stroke-width="3" />
  `;

  // Área e Linha Reservatório 1 (Azul)
  let ptsRes1 = [];
  valoresCaixa1.forEach((val, i) => {
    ptsRes1.push(`${getX(i)},${getY(val)}`);
  });
  const pathRes1 = `M ${ptsRes1.join(' L ')}`;
  const areaRes1 = `M ${paddingLeft},${getY(0)} L ${ptsRes1.join(' L ')} L ${width - paddingRight},${getY(0)} Z`;

  svgHTML += `
    <path d="${areaRes1}" fill="rgba(56, 189, 248, 0.12)" />
    <path d="${pathRes1}" fill="none" stroke="#38bdf8" stroke-width="3" />
  `;

  // Desenhar círculos e os VALORES exatos em cima de cada ponto
  valoresCaixa1.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    svgHTML += `
      <circle cx="${x}" cy="${y}" r="5" fill="#38bdf8" stroke="#0f172a" stroke-width="2" />
      <text x="${x}" y="${y - 10}" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle">${val}L</text>
    `;
  });

  valoresCaixa2.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    svgHTML += `
      <circle cx="${x}" cy="${y}" r="5" fill="#34d399" stroke="#0f172a" stroke-width="2" />
      <text x="${x}" y="${y - 10}" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle">${val}L</text>
    `;
  });

  // Rótulos do Eixo X (Tempo / Data)
  labels.forEach((label, i) => {
    const xPos = getX(i);
    const yPos = paddingTop + graficoHeight + 20;
    svgHTML += `
      <line x1="${xPos}" y1="${paddingTop + graficoHeight}" x2="${xPos}" y2="${paddingTop + graficoHeight + 6}" stroke="#94a3b8" />
      <text x="${xPos}" y="${yPos}" fill="#94a3b8" font-size="12" text-anchor="middle">${label}</text>
    `;
  });

  // Título eixo X
  svgHTML += `
    <text x="${paddingLeft + graficoWidth / 2}" y="${height - 5}" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="middle">Tempo / Data</text>
  `;

  svgHTML += `</svg>`;
  container.innerHTML = svgHTML;
}