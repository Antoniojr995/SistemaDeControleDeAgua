const API_BASE = window.location.origin;
const token = sessionStorage.getItem("token");
const tipo = sessionStorage.getItem("tipo");

let meuGrafico = null; // Guarda referência do Chart.js
let ultimosDadosRelatorio = []; // Relatórios CSV/PDF

document.addEventListener("DOMContentLoaded", () => {
  // 1. Verificação de Autenticação
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // 2. Alerta e botão de Voltar para Administradores
  if (tipo === "admin") {
    const alertaAdmin = document.getElementById("alertaAdmin");
    const btnVoltar = document.getElementById("btnVoltarAdmin");

    if (alertaAdmin) alertaAdmin.style.display = "block";
    if (btnVoltar) {
      btnVoltar.style.display = "inline-block";
      btnVoltar.addEventListener("click", () => {
        window.location.href = "painel-admin.html";
      });
    }
  }

  // 3. Eventos da Interface (Botões e Selects)
  
  // Atualizar Manualmente
  const btnAtualizar = document.getElementById("btnAtualizarAgora") || document.getElementById("btnAtualizar");
  btnAtualizar?.addEventListener("click", () => {
    btnAtualizar.innerText = "⏳ Atualizando...";
    fetchLatest().then(() => {
      setTimeout(() => {
        btnAtualizar.innerText = "🔄 Atualizar Agora";
      }, 500);
    });
  });

  // Switch de Controle da Bomba
  const switchBomba = document.getElementById("switchBomba") || document.getElementById("btnLigarBomba");
  switchBomba?.addEventListener("change", (ev) => {
    enviarComandoBomba(ev.target.checked);
  });

  // Botão Sair
  document.getElementById("btnLogout")?.addEventListener("click", () => {
    if (confirm("Deseja realmente sair do sistema?")) {
      sessionStorage.clear();
      window.location.href = "index.html";
    }
  });

  // Troca de Reservatório / Caixa Selecionada
  const selectCaixa = document.getElementById("selectIdReservatorio") || document.getElementById("selectCaixa") || document.getElementById("minhasCaixas");
  selectCaixa?.addEventListener("change", (e) => {
    sessionStorage.setItem("caixaSelecionada", e.target.value);
    carregarHistorico();
  });

  // Modais de Chamado e Perfil
  document.getElementById("btnAbrirChamado")?.addEventListener("click", () => {
    const modal = document.getElementById("modalChamado") || document.getElementById("modalAlertaTecnico");
    if (modal) modal.style.display = "flex";
  });

  document.getElementById("btnPerfil")?.addEventListener("click", () => {
    if (typeof window.abrirModalPerfil === "function") {
      window.abrirModalPerfil();
    } else {
      const modal = document.getElementById("modalPerfil");
      if (modal) modal.style.display = "flex";
    }
  });

  // Botão de Relatório
  document.getElementById("btnRelatorio")?.addEventListener("click", gerarRelatorio);

  // 4. Inicialização de Dados
  fetchLatest();
  carregarMinhasCaixas();
  carregarHistorico();
  setInterval(fetchLatest, 3000); // Polling a cada 3 segundos
});

// =======================
// 📦 Busca Caixas do Cliente
// =======================
async function carregarMinhasCaixas() {
  try {
    const res = await fetch(API_BASE + "/api/minhas-caixas", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) return;

    const caixas = await res.json();
    const selectCaixa = document.getElementById("selectIdReservatorio") || document.getElementById("selectCaixa");
    
    if (selectCaixa) {
      selectCaixa.innerHTML = "";
      if (caixas.length === 0) {
        selectCaixa.innerHTML = '<option value="">Sem caixas</option>';
        return;
      }

      caixas.forEach(caixa => {
        const option = document.createElement("option");
        option.value = caixa.id;
        option.textContent = `ID: ${caixa.id} (${caixa.nome || 'Reservatório'})`;
        selectCaixa.appendChild(option);
      });

      const caixaSalva = sessionStorage.getItem("caixaSelecionada");
      if (caixaSalva) {
        selectCaixa.value = caixaSalva;
      } else if (caixas.length > 0) {
        sessionStorage.setItem("caixaSelecionada", caixas[0].id);
      }
    }
  } catch (err) {
    console.error("Erro ao carregar caixas:", err);
  }
}

// =======================
// 💧 Leitura em Tempo Real e Atualização da UI
// =======================
async function fetchLatest() {
  try {
    const res = await fetch(API_BASE + "/api/dados/latest", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Erro na resposta da API");

    const d = await res.json();

    const valC1 = d.caixa1 ?? d.nivel ?? 0;
    const valC2 = d.caixa2 ?? 0;

    const perc1 = document.getElementById("percCaixa1");
    const perc2 = document.getElementById("percCaixa2");
    if (perc1) perc1.innerText = `${valC1}%`;
    if (perc2) perc2.innerText = `${valC2}%`;

    const vol1Text = document.getElementById("volCaixa1");
    const vol2Text = document.getElementById("volCaixa2");
    if (vol1Text) vol1Text.innerText = `${Math.round((valC1 / 100) * 1000)} L`;
    if (vol2Text) vol2Text.innerText = `${Math.round((valC2 / 100) * 1000)} L`;

    const bar1 = document.getElementById("barCaixa1");
    const bar2 = document.getElementById("barCaixa2");
    if (bar1) bar1.style.width = `${valC1}%`;
    if (bar2) bar2.style.width = `${valC2}%`;

    const elData = document.getElementById("dataAtualizacao");
    if (elData) {
      const agora = new Date();
      elData.innerText = agora.toLocaleDateString("pt-BR") + " - " + agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    }

    atualizarEstadoBombaUI(d.bomba === 1);

  } catch (err) {
    console.error("Erro ao carregar dados em tempo real:", err);
  }
}

function atualizarEstadoBombaUI(ligada) {
  const switchBomba = document.getElementById("switchBomba") || document.getElementById("btnLigarBomba");
  const statusBadge = document.getElementById("statusBombaBadge");
  const statusTexto = document.getElementById("textoStatusBomba");

  if (switchBomba) switchBomba.checked = ligada;

  if (statusBadge && statusTexto) {
    if (ligada) {
      statusBadge.className = "bomba-status-badge ligada";
      statusBadge.style.background = "#022c22";
      statusBadge.style.borderColor = "#10b981";
      statusTexto.innerText = "Bomba Ligada";
      statusTexto.style.color = "#10b981";
    } else {
      statusBadge.className = "bomba-status-badge desligada";
      statusBadge.style.background = "#1a0c0c";
      statusBadge.style.borderColor = "#ef4444";
      statusTexto.innerText = "Bomba Desligada";
      statusTexto.style.color = "#ef4444";
    }
  }
}

async function enviarComandoBomba(ligar) {
  try {
    atualizarEstadoBombaUI(ligar);

    await fetch(API_BASE + "/api/bomba", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ ligar })
    });
  } catch (err) {
    console.error("Erro ao enviar comando da bomba:", err);
  }
}

// =======================
// 📈 Histórico e Gráfico
// =======================
async function carregarHistorico() {
  try {
    const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
    const res = await fetch(`${API_BASE}/api/historico/${caixaId}`, {
      headers: { Authorization: "Bearer " + token },
    });

    if (!res.ok) return;

    const data = await res.json();
    const tbody = document.getElementById("tabelaLeiturasBody") || document.querySelector("#tabelaHistorico tbody");

    if (!Array.isArray(data) || data.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum registro encontrado.</td></tr>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = "";
      data.slice(0, 5).forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.dia || d.data || d.created_at}</td>
          <td>${d.media_caixa1 ?? d.caixa1}%</td>
          <td>${d.media_caixa2 ?? d.caixa2}%</td>
          <td><span class="badge-ok">OK</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    const historicoOrdenado = [...data].reverse();
    const rotulos = historicoOrdenado.map(d => d.dia || d.data);
    const dadosCaixa1 = historicoOrdenado.map(d => d.media_caixa1 ?? d.caixa1);
    const dadosCaixa2 = historicoOrdenado.map(d => d.media_caixa2 ?? d.caixa2);

    renderizarGrafico(rotulos, dadosCaixa1, dadosCaixa2);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

function renderizarGrafico(labels, caixa1, caixa2) {
  const ctx = document.getElementById("graficoHistorico") || document.getElementById("graficoNivelAgua");
  if (!ctx) return;

  if (meuGrafico) {
    meuGrafico.destroy();
  }

  meuGrafico = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Caixa 1 (%)",
          data: caixa1,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          fill: true
        },
        {
          label: "Caixa 2 (%)",
          data: caixa2,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: "#64748b", callback: value => value + "%" },
          grid: { color: "#0d284f" }
        },
        x: {
          ticks: { color: "#64748b" },
          grid: { color: "#0d284f" }
        }
      }
    }
  });
}

// =======================
// ⚠️ Chamados e Suporte
// =======================
window.enviarAlertaTecnico = async function(event) {
  if (event) event.preventDefault();

  const tipoElemento = document.getElementById("alertaTipo") || document.getElementById("tipoAlerta");
  const mensagemElemento = document.getElementById("alertaMensagem") || document.getElementById("descricaoAlerta") || document.getElementById("mensagem");

  const assunto = tipoElemento ? tipoElemento.value : "Outro problema";
  const mensagem = mensagemElemento ? mensagemElemento.value.trim() : "";

  if (!mensagem) {
    alert("⚠️ Por favor, descreva o problema.");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/chamados", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ assunto, mensagem })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      alert("✅ Chamado enviado com sucesso!");
      if (mensagemElemento) mensagemElemento.value = "";
      window.fecharModal("modalChamado");
      window.fecharModal("modalAlertaTecnico");
    } else {
      alert("❌ Erro: " + (data.error || "Falha ao enviar chamado"));
    }
  } catch (err) {
    console.error("Erro ao enviar chamado:", err);
    alert("❌ Erro de conexão com o servidor.");
  }
};

// Função para carregar e exibir os dados fixos do usuário no topo
async function carregarDadosUsuario() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", {
      headers: { Authorization: "Bearer " + token }
    });
    const dados = await res.json();

    if (res.ok && dados.logado) {
      const elNomeHeader = document.getElementById("nomeUsuarioHeader");
      if (elNomeHeader) {
        // Exibe o nome retornado do banco de dados no botão superior
        elNomeHeader.innerText = dados.nome || dados.usuario || "Perfil";
      }
    }
  } catch (err) {
    console.error("Erro ao carregar dados do usuário:", err);
  }
}

// Chame a função dentro do DOMContentLoaded para carregar assim que a página abrir:
document.addEventListener("DOMContentLoaded", () => {
  // ... seus outros códigos ...
  carregarDadosUsuario();
});

// =======================
// 📁 Relatórios
// =======================
window.gerarRelatorio = async function() {
  const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
  const elInicio = document.getElementById("dataInicio");
  const elFim = document.getElementById("dataFim");

  if (!elInicio || !elFim) return;

  try {
    const res = await fetch(API_BASE + "/api/relatorio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ caixa_id: caixaId, dataInicio: elInicio.value, dataFim: elFim.value }),
    });

    const dados = await res.json();
    ultimosDadosRelatorio = dados;
    alert("Relatório gerado com sucesso! Utilize as opções de exportar.");
  } catch (err) {
    console.error("Erro no relatório:", err);
  }
};

// =======================
// 🚪 Fechar Modal
// =======================
window.fecharModal = function(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) modal.style.display = "none";
};

// =======================
// 👤 Perfil do Usuário
// =======================
window.abrirModalPerfil = async function() {
  const modal = document.getElementById("modalPerfil");
  if (modal) modal.style.display = "flex";

  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", {
      headers: { Authorization: "Bearer " + token }
    });
    const dados = await res.json();

    if (res.ok && dados.logado) {
      const userEl = document.getElementById("perfilUsuario") || document.getElementById("perfilNome");
      const emailEl = document.getElementById("perfilEmail");
      const passEl = document.getElementById("perfilSenha");

      if (userEl) userEl.value = dados.usuario || dados.nome || "";
      if (emailEl) emailEl.value = dados.email || "";
      if (passEl) passEl.value = "";
    }
  } catch (err) {
    console.error("Erro ao carregar dados do perfil:", err);
  }
};

window.salvarPerfil = async function(event) {
  if (event) event.preventDefault();

  const userEl = document.getElementById("perfilUsuario") || document.getElementById("perfilNome");
  const emailEl = document.getElementById("perfilEmail");
  const passEl = document.getElementById("perfilSenha");

  const usuario = userEl ? userEl.value.trim() : "";
  const nome = userEl ? userEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  const senha = passEl ? passEl.value.trim() : "";

  if (!usuario && !nome) {
    alert("⚠️ Por favor, informe o nome de usuário.");
    return;
  }

  try {
    const response = await fetch(API_BASE + "/api/perfil", {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
      body: JSON.stringify({ usuario, nome, email, senha })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert("✅ Perfil atualizado com sucesso!");
      window.fecharModal("modalPerfil");
    } else {
      alert(result.error || "❌ Erro ao atualizar perfil.");
    }
  } catch (err) {
    console.error("Erro ao salvar perfil:", err);
    alert("❌ Erro de conexão com o servidor.");
  }
};

// Função para abrir o modal de perfil
function abrirPerfil() {
  const modal = document.getElementById('modalPerfil');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// Função para fechar qualquer modal pelo ID
function fecharModal(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) {
    modal.style.display = 'none';
  }
}