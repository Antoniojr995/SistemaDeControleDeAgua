const API_BASE = window.location.origin;
let meuGrafico = null;

document.addEventListener("DOMContentLoaded", () => {
  verificarSessao();

  // Botão Sair
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    if (confirm("Deseja realmente sair?")) {
      await fetch(API_BASE + "/api/logout", { method: "POST", credentials: "same-origin" });
      sessionStorage.clear();
      window.location.href = "index.html";
    }
  });

  // Atualizar manualmente
  document.getElementById("btnAtualizarAgora")?.addEventListener("click", () => {
    fetchLatest();
  });

  // Switch da Bomba
  document.getElementById("switchBomba")?.addEventListener("change", (e) => {
    enviarComandoBomba(e.target.checked);
  });

  // Troca de Reservatório no Select
  document.getElementById("selectIdReservatorio")?.addEventListener("change", (e) => {
    sessionStorage.setItem("caixaSelecionada", e.target.value);
    carregarHistorico();
    fetchLatest();
  });

  // Inicialização
  carregarMinhasCaixas().then(() => {
    fetchLatest();
    carregarHistorico();
  });

  setInterval(fetchLatest, 5000);
});

async function verificarSessao() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", { credentials: "same-origin" });
    const data = await res.json();
    if (!data.logado) window.location.href = "index.html";
  } catch (err) {
    window.location.href = "index.html";
  }
}

async function carregarMinhasCaixas() {
  try {
    const res = await fetch(API_BASE + "/api/minhas-caixas", { credentials: "same-origin" });
    if (!res.ok) return;

    const caixas = await res.json();
    const select = document.getElementById("selectIdReservatorio");
    if (!select) return;

    select.innerHTML = "";
    if (!Array.isArray(caixas) || caixas.length === 0) {
      select.innerHTML = '<option value="">Sem caixas</option>';
      return;
    }

    caixas.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `ID: ${c.id} - ${c.nome_caixa1 || 'Reservatório'}`;
      select.appendChild(opt);
    });

    const salva = sessionStorage.getItem("caixaSelecionada");
    if (salva) select.value = salva;
    else sessionStorage.setItem("caixaSelecionada", caixas[0].id);
  } catch (err) {
    console.error("Erro ao carregar caixas:", err);
  }
}

window.abrirModalPerfil = async function() {
  document.getElementById("modalPerfil").style.display = "flex";
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", { credentials: "same-origin" });
    const data = await res.json();
    if (res.ok && data.logado) {
      document.getElementById("perfilNome").innerText = data.nome || data.usuario || "N/D";
      document.getElementById("perfilEmail").innerText = data.email || data.usuario || "N/D";
    }
  } catch (err) {
    console.error("Erro perfil:", err);
  }
};

window.abrirModal = (id) => { document.getElementById(id).style.display = "flex"; };
window.fecharModal = (id) => { document.getElementById(id).style.display = "none"; };

async function fetchLatest() {
  try {
    const res = await fetch(API_BASE + "/api/dados/latest", { credentials: "same-origin" });
    if (!res.ok) return;
    const d = await res.json();

    const v1 = Number(d.caixa1 || 0);
    const v2 = Number(d.caixa2 || 0);
    const c1 = Number(d.capacidade_caixa1 || 1000);
    const c2 = Number(d.capacidade_caixa2 || 1000);

    document.getElementById("capCaixa1").innerText = `${c1.toLocaleString('pt-BR')} L`;
    document.getElementById("capCaixa2").innerText = `${c2.toLocaleString('pt-BR')} L`;
    document.getElementById("bannerCapacidadeTotal").innerText = `${(c1 + c2).toLocaleString('pt-BR')} L`;

    if (d.nome_caixa1) document.getElementById("tituloCaixa1").innerText = d.nome_caixa1;
    if (d.nome_caixa2) document.getElementById("tituloCaixa2").innerText = d.nome_caixa2;

    document.getElementById("percCaixa1").innerText = `${v1}%`;
    document.getElementById("percCaixa2").innerText = `${v2}%`;

    document.getElementById("volCaixa1").innerText = `${Math.round((c1 * v1) / 100).toLocaleString('pt-BR')} L`;
    document.getElementById("volCaixa2").innerText = `${Math.round((c2 * v2) / 100).toLocaleString('pt-BR')} L`;

    document.getElementById("barCaixa1").style.width = `${v1}%`;
    document.getElementById("barCaixa2").style.width = `${v2}%`;

    const agora = new Date();
    document.getElementById("dataAtualizacao").innerText = agora.toLocaleDateString("pt-BR") + " - " + agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });

    const ligada = d.bomba === 1 || d.bomba === true;
    document.getElementById("switchBomba").checked = ligada;
    const badge = document.getElementById("statusBombaBadge");
    const texto = document.getElementById("textoStatusBomba");
    if (badge && texto) {
      badge.className = ligada ? "bomba-status-badge ligada" : "bomba-status-badge desligada";
      texto.innerText = ligada ? "Bomba Ligada" : "Bomba Desligada";
      texto.style.color = ligada ? "#10b981" : "#ef4444";
    }
  } catch (err) {
    console.error("Erro dados latest:", err);
  }
}

async function enviarComandoBomba(ligar) {
  try {
    await fetch(API_BASE + "/api/bomba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ligar, status: ligar ? 'LIGADA' : 'DESLIGADA' })
    });
  } catch (err) {
    console.error("Erro bomba:", err);
  }
}

async function carregarHistorico() {
  try {
    const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
    const res = await fetch(`${API_BASE}/api/historico/${caixaId}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const tbody = document.getElementById("tabelaLeiturasBody");
    if (tbody) {
      tbody.innerHTML = data.slice(0, 5).map(d => `
        <tr>
          <td>${d.data_hora || d.dia || '-'}</td>
          <td>${d.media_caixa1 ?? d.caixa1 ?? 0}%</td>
          <td>${d.media_caixa2 ?? d.caixa2 ?? 0}%</td>
          <td><span style="color: #10b981;">Normal</span></td>
        </tr>
      `).join('');
    }

    const labels = [...data].reverse().map(d => d.dia || d.data || '');
    const c1 = [...data].reverse().map(d => d.media_caixa1 ?? d.caixa1 ?? 0);
    const c2 = [...data].reverse().map(d => d.media_caixa2 ?? d.caixa2 ?? 0);

    const canvas = document.getElementById("graficoHistorico");
    if (canvas) {
      if (meuGrafico) meuGrafico.destroy();
      meuGrafico = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Caixa 1 (%)", data: c1, borderColor: "#38bdf8", tension: 0.4, fill: true },
            { label: "Caixa 2 (%)", data: c2, borderColor: "#10b981", tension: 0.4, fill: true }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  } catch (err) {
    console.error("Erro histórico:", err);
  }
}

window.enviarAlertaTecnico = async function(event) {
  event.preventDefault();
  const assunto = document.getElementById("alertaTipo").value;
  const mensagem = document.getElementById("alertaMensagem").value.trim();
  if (!mensagem) return;

  try {
    const res = await fetch(API_BASE + "/api/chamados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ assunto, mensagem })
    });
    if (res.ok) {
      alert("✅ Chamado enviado com sucesso!");
      document.getElementById("alertaMensagem").value = "";
      window.fecharModal("modalChamado");
    } else {
      alert("❌ Erro ao enviar chamado.");
    }
  } catch (err) {
    alert("❌ Erro de conexão.");
  }
};