const API_BASE = window.location.origin;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Validação de Sessão/Autenticação
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", { credentials: "same-origin" });
    const user = await res.json();

    if (!user.logado && !sessionStorage.getItem("token")) {
      window.location.href = "index.html";
      return;
    }
  } catch (err) {
    if (!sessionStorage.getItem("token")) {
      window.location.href = "index.html";
      return;
    }
  }

  // 2. Configura o botão de Sair (Logout)
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try {
      await fetch(API_BASE + "/api/logout", { method: "POST", credentials: "same-origin" });
    } catch (e) {}
    sessionStorage.clear();
    window.location.href = "index.html";
  });

  // 3. Carrega a lista de reservatórios
  carregarTodosReservatorios();
});

async function carregarTodosReservatorios() {
  const container = document.getElementById("containerReservatorios");
  if (!container) return;
  
  try {
    const token = sessionStorage.getItem("token");
    const headers = token ? { Authorization: "Bearer " + token } : {};

    const res = await fetch(API_BASE + "/api/minhas-caixas", {
      headers,
      credentials: "same-origin"
    });

    if (res.status === 401) {
      sessionStorage.clear();
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) throw new Error("Erro ao carregar lista de reservatórios");

    const data = await res.json();
    // Suporte caso venha Array ou Objeto contendo caixas
    const caixas = Array.isArray(data) ? data : (data.caixas || [data]);

    if (!caixas || caixas.length === 0 || !caixas[0]?.id) {
      container.innerHTML = `<p class="msg-feedback">Nenhum reservatório cadastrado para esta conta.</p>`;
      return;
    }

    container.innerHTML = ""; // Limpa a mensagem de carregamento

    caixas.forEach(caixa => {
      const caixaId = caixa.id || caixa.caixa_id || 1;

      // Nome formatado para as caixas do utilizador
      const nomeExibicao = (caixa.nome_caixa1 && caixa.nome_caixa2)
        ? `${caixa.nome_caixa1} / ${caixa.nome_caixa2}`
        : (caixa.nome || caixa.nome_caixa1 || `Reservatório ${caixaId}`);

      const nivelPercent = Number(caixa.nivel_caixa1 ?? caixa.nivel ?? caixa.porcentagem ?? 0);
      const capacidade = Number(caixa.capacidade_caixa1 || caixa.capacidade || 1000);
      const volumeAtual = Math.round((nivelPercent / 100) * capacidade);

      // Desenho interativo do SVG da água
      const yTop = 90 - ((90 - 30) * (nivelPercent / 100));
      const pathD = `M13,${yTop} Q50,${yTop + 12} 87,${yTop} L88,90 Q50,105 12,90 Z`;

      const card = document.createElement("div");
      card.className = "card-reservatorio";
      card.innerHTML = `
        <div>
          <div class="res-header">
            <span class="res-title">🛢️ ${nomeExibicao}</span>
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
              <div>Volume: <strong>${volumeAtual.toLocaleString('pt-BR')} L</strong> / ${capacidade.toLocaleString('pt-BR')} L</div>
            </div>
          </div>
        </div>

        <button class="btn-acessar" onclick="selecionarEIrParaPainel('${caixaId}')">
          📊 Ver Painel
        </button>
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Erro ao carregar reservatórios:", err);
    container.innerHTML = `<p class="msg-feedback" style="color: #ef4444;">❌ Erro ao carregar a lista de reservatórios.</p>`;
  }
}

function selecionarEIrParaPainel(caixaId) {
  sessionStorage.setItem("caixaSelecionada", caixaId);
  window.location.href = "painel.html";
}