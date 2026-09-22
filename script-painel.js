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
    fetchLatest();
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

  // Evento para fechar modal ao clicar no fundo escuro
  window.addEventListener('click', (event) => {
    const modalPerfil = document.getElementById('modalPerfil');
    if (event.target === modalPerfil) {
      fecharModalPerfil();
    }
  });

  // 4. Inicialização de Dados
  carregarDadosUsuario();
  carregarMinhasCaixas().then(() => {
    fetchLatest();
    carregarHistorico();
  });
  
  // Polling a cada 5 segundos para manter atualizado em tempo real
  setInterval(fetchLatest, 5000); 
});

// =======================
// 📦 Busca Caixas do Cliente
// =======================
async function carregarMinhasCaixas() {
  try {
    const res = await fetch(API_BASE + "/api/minhas-caixas", {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) {
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) return;

    const data = await res.json();
    const selectCaixa = document.getElementById("selectIdReservatorio") || document.getElementById("selectCaixa");
    
    // Suporte caso a API retorne um objeto único com propriedades de caixas ou um array
    const caixas = Array.isArray(data) ? data : (data.caixas || [data]);

    if (selectCaixa) {
      selectCaixa.innerHTML = "";
      if (caixas.length === 0) {
        selectCaixa.innerHTML = '<option value="">Sem caixas</option>';
        return;
      }

      caixas.forEach(caixa => {
        const option = document.createElement("option");
        option.value = caixa.id || 1;
        option.textContent = `ID: ${caixa.id || 1} (${caixa.nome || caixa.nome_caixa1 || 'Reservatório'})`;
        selectCaixa.appendChild(option);
      });

      const caixaSalva = sessionStorage.getItem("caixaSelecionada");
      if (caixaSalva) {
        selectCaixa.value = caixaSalva;
      } else if (caixas.length > 0) {
        sessionStorage.setItem("caixaSelecionada", caixas[0].id || 1);
      }
    }
  } catch (err) {
    console.error("Erro ao carregar caixas:", err);
  }
}

// =======================
// 💧 Auxiliar SVG 3D da Água
// =======================
function atualizarSvgAgua(elementId, porcentagem) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const pct = Math.min(Math.max(porcentagem, 0), 100);
  const yTop = 90 - ((90 - 30) * (pct / 100));
  el.setAttribute("d", `M13,${yTop} Q50,${yTop + 12} 87,${yTop} L88,90 Q50,105 12,90 Z`);
}

// =======================
// 💧 Leitura em Tempo Real e Atualização da UI
// =======================
async function fetchLatest() {
  try {
    const res = await fetch(API_BASE + "/api/dados/latest", {
      headers: { Authorization: "Bearer " + token }
    });
    
    if (res.status === 401) {
      window.location.href = "index.html";
      return;
    }
    
    if (!res.ok) throw new Error("Erro na resposta da API");

    const d = await res.json();

    const valC1 = Number(d.caixa1 ?? d.nivel_caixa1 ?? d.nivel ?? 0);
    const valC2 = Number(d.caixa2 ?? d.nivel_caixa2 ?? 0);

    // Capacidades (Integração com o segundo código para cálculo dinâmico em Litros)
    const cap1 = Number(d.capacidade_caixa1 || 1000);
    const cap2 = Number(d.capacidade_caixa2 || 1000);

    const cap1El = document.getElementById("capCaixa1");
    const cap2El = document.getElementById("capCaixa2");
    const bannerTotal = document.getElementById("bannerCapacidadeTotal");

    if (cap1El) cap1El.innerText = `${cap1.toLocaleString('pt-BR')} L`;
    if (cap2El) cap2El.innerText = `${cap2.toLocaleString('pt-BR')} L`;
    if (bannerTotal) bannerTotal.innerText = `${(cap1 + cap2).toLocaleString('pt-BR')} L`;

    // Títulos personalizados
    const titulo1 = document.getElementById("tituloCaixa1");
    const titulo2 = document.getElementById("tituloCaixa2");
    if (titulo1 && d.nome_caixa1) titulo1.innerText = d.nome_caixa1;
    if (titulo2 && d.nome_caixa2) titulo2.innerText = d.nome_caixa2;

    // 1. Atualizar Textos da Porcentagem
    const perc1 = document.getElementById("percCaixa1");
    const perc2 = document.getElementById("percCaixa2");
    if (perc1) perc1.innerText = `${valC1}%`;
    if (perc2) perc2.innerText = `${valC2}%`;

    // 2. Atualizar Círculos Redondos (conic-gradient)
    const ring1 = document.querySelector(".card-caixa:nth-child(1) .ring-circle");
    const ring2 = document.querySelector(".card-caixa:nth-child(2) .ring-circle");

    if (ring1) ring1.style.background = `conic-gradient(#38bdf8 0% ${valC1}%, #082247 ${valC1}% 100%)`;
    if (ring2) ring2.style.background = `conic-gradient(#38bdf8 0% ${valC2}%, #082247 ${valC2}% 100%)`;

    // 3. Atualizar Animação de Água nos Ícones SVG 3D
    atualizarSvgAgua("svgNivelCaixa1", valC1);
    atualizarSvgAgua("svgNivelCaixa2", valC2);

    // 4. Atualizar Volumes em Litros Baseados na Capacidade Real
    const vol1Text = document.getElementById("volCaixa1");
    const vol2Text = document.getElementById("volCaixa2");
    const vol1 = Math.round((cap1 * valC1) / 100);
    const vol2 = Math.round((cap2 * valC2) / 100);

    if (vol1Text) vol1Text.innerText = `${vol1.toLocaleString('pt-BR')} L`;
    if (vol2Text) vol2Text.innerText = `${vol2.toLocaleString('pt-BR')} L`;

    // 5. Atualizar Barras Retas de Progresso
    const bar1 = document.getElementById("barCaixa1");
    const bar2 = document.getElementById("barCaixa2");
    if (bar1) bar1.style.width = `${valC1}%`;
    if (bar2) bar2.style.width = `${valC2}%`;

    // 6. Data de Atualização
    const elData = document.getElementById("dataAtualizacao");
    if (elData) {
      const agora = new Date();
      elData.innerText = agora.toLocaleDateString("pt-BR") + " - " + agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    }

    const bombaStatus = d.bomba === 1 || d.bomba === true || d.status_bomba === 'LIGADA';
    atualizarEstadoBombaUI(bombaStatus);

    // Atualiza histórico se vier embutido nos dados em tempo real
    if (d.historico && Array.isArray(d.historico)) {
      atualizarTabela(d.historico);
      renderizarGrafico(
        d.historico.map(h => h.hora || h.data),
        d.historico.map(h => h.nivel1 ?? h.media_caixa1),
        d.historico.map(h => h.nivel2 ?? h.media_caixa2)
      );
    }

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
    const statusStr = ligar ? 'LIGADA' : 'DESLIGADA';

    await fetch(API_BASE + "/api/bomba", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ ligar, status: statusStr })
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
    if (!Array.isArray(data) || data.length === 0) return;

    atualizarTabela(data);

    const historicoOrdenado = [...data].reverse();
    const rotulos = historicoOrdenado.map(d => d.hora || d.dia || d.data);
    const dadosCaixa1 = historicoOrdenado.map(d => d.nivel1 ?? d.media_caixa1 ?? d.caixa1);
    const dadosCaixa2 = historicoOrdenado.map(d => d.nivel2 ?? d.media_caixa2 ?? d.caixa2);

    renderizarGrafico(rotulos, dadosCaixa1, dadosCaixa2);

  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

function atualizarTabela(historico) {
  const tbody = document.getElementById("tabelaLeiturasBody") || document.querySelector("#tabelaHistorico tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  historico.slice(0, 5).forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.data_hora || d.hora || d.dia || d.data}</td>
      <td>${d.nivel1 ?? d.media_caixa1 ?? d.caixa1}%</td>
      <td>${d.nivel2 ?? d.media_caixa2 ?? d.caixa2}%</td>
      <td><span class="status-ok badge-ok">Normal</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderizarGrafico(labels, caixa1, caixa2) {
  const canvas = document.getElementById("graficoHistorico") || document.getElementById("graficoNivelAgua");
  if (!canvas) return;

  if (meuGrafico) {
    meuGrafico.destroy();
  }

  meuGrafico = new Chart(canvas.getContext("2d"), {
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
      body: JSON.stringify({ assunto, tipo: assunto, mensagem })
    });

    const data = await res.json().catch(() => ({ success: res.ok }));

    if (res.ok) {
      alert("✅ Chamado enviado com sucesso! Nossa equipe entrará em contato.");
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

// =======================
// 👤 Usuário e Perfil
// =======================
async function carregarDadosUsuario() {
  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", {
      headers: { Authorization: "Bearer " + token }
    });
    const dados = await res.json();

    if (res.ok && (dados.logado || dados.nome || dados.usuario)) {
      const elNomeHeader = document.getElementById("nomeUsuarioHeader");
      if (elNomeHeader) {
        elNomeHeader.innerText = dados.nome || dados.usuario || "Perfil";
      }
    }
  } catch (err) {
    console.error("Erro ao carregar dados do usuário:", err);
  }
}

window.abrirModalPerfil = async function() {
  const modal = document.getElementById("modalPerfil");
  if (modal) modal.style.display = "flex";

  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", {
      headers: { Authorization: "Bearer " + token }
    });
    const dados = await res.json();

    if (res.ok) {
      const userEl = document.getElementById("perfilNome") || document.getElementById("perfilUsuario");
      const emailEl = document.getElementById("perfilEmail");
      const passEl = document.getElementById("perfilSenha");

      if (userEl) userEl.value = dados.nome || dados.usuario || "";
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

    if (response.ok) {
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

function fecharModalPerfil() {
  window.fecharModal('modalPerfil');
}

function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}