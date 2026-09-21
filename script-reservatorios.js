const API_BASE = window.location.origin;
const token = sessionStorage.getItem("token");

document.addEventListener("DOMContentLoaded", () => {
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  });

  carregarTodosReservatorios();
});

// Busca todas as caixas cadastradas para o usuário logado
async function carregarTodosReservatorios() {
  const container = document.getElementById("containerReservatorios");
  
  try {
    const res = await fetch(API_BASE + "/api/minhas-caixas", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Erro ao buscar reservatórios");

    const caixas = await res.json();

    if (!Array.isArray(caixas) || caixas.length === 0) {
      container.innerHTML = `<p style="color: #94a3b8;">Nenhum reservatório encontrado para esta conta.</p>`;
      return;
    }

    container.innerHTML = ""; // Limpa mensagem de carregamento

    caixas.forEach(caixa => {
      // Valor padrão de nível se não houver no objeto
      const nivelPercent = Number(caixa.nivel ?? caixa.porcentagem ?? 0);
      const capacidade = caixa.capacidade || 1000;
      const volumeAtual = Math.round((nivelPercent / 100) * capacidade);

      // Mapeamento Y do SVG: 0% = Y 90 (fundo), 100% = Y 30 (topo)
      const yTop = 90 - ((90 - 30) * (nivelPercent / 100));
      const pathD = `M13,${yTop} Q50,${yTop + 12} 87,${yTop} L88,90 Q50,105 12,90 Z`;

      const card = document.createElement("div");
      card.className = "card-reservatorio";
      card.innerHTML = `
        <div>
          <div class="res-header">
            <span class="res-title">🛢️ ${caixa.nome || 'Reservatório ID: ' + caixa.id}</span>
            <span class="badge-status badge-online">Ativo</span>
          </div>

          <div class="res-info-body">
            <div class="res-svg-box">
              <svg viewBox="0 0 100 120" style="width: 100%; height: 100%;">
                <ellipse cx="50" cy="20" rx="40" ry="12" fill="#0284c7" />
                <path d="M10,20 L15,95 Q50,110 85,95 L90,20 Z" fill="#0f172a" stroke="#0284c7" stroke-width="2" />
                <path d="${pathD}" fill="#38bdf8" opacity="0.85" />
                <ellipse cx="50" cy="20" rx="40" ry="12" fill="none" stroke="#38bdf8" stroke-width="2" />
              </svg>
            </div>
            <div class="res-details">
              <div>Nível Atual: <strong>${nivelPercent}%</strong></div>
              <div>Volume: <strong>${volumeAtual} L</strong> / ${capacidade} L</div>
            </div>
          </div>
        </div>

        <button class="btn-acessar" onclick="selecionarEIrParaPainel('${caixa.id}')">
          📊 Ver Painel
        </button>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Erro:", err);
    container.innerHTML = `<p style="color: #ef4444;">Erro ao carregar a lista de reservatórios.</p>`;
  }
}

// Salva a escolha do usuário e redireciona para a tela de monitoramento detalhado
function selecionarEIrParaPainel(caixaId) {
  sessionStorage.setItem("caixaSelecionada", caixaId);
  window.location.href = "painel.html";
}