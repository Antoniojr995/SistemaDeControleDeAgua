const API_BASE = window.location.origin;
const token = sessionStorage.getItem("token");
const tipo = sessionStorage.getItem("tipo");

document.addEventListener("DOMContentLoaded", () => {
  // 1. Verificação de Autenticação
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // 2. Exibir barra de alerta e botão para Administradores
  if (tipo === "admin") {
    const alertaAdmin = document.getElementById("alertaAdmin");
    const btnVoltar = document.getElementById("btnVoltarAdmin");

    if (alertaAdmin) {
      alertaAdmin.style.display = "block";
    }

    if (btnVoltar) {
      btnVoltar.style.display = "inline-block";
      btnVoltar.addEventListener("click", () => {
        window.location.href = "painel-admin.html";
      });
    }
  }

  // 3. Configuração dos Eventos Básicos
  document.getElementById("btnAtualizar")?.addEventListener("click", fetchLatest);
  
  document.getElementById("btnLigarBomba")?.addEventListener("change", (ev) => {
    enviarComandoBomba(ev.target.checked);
  });

  document.getElementById("btnLogout")?.addEventListener("click", () => {
    if (confirm("Deseja realmente sair?")) {
      sessionStorage.clear();
      window.location.href = "index.html";
    }
  });

  // Evento do botão de Relatório
  document.getElementById("btnRelatorio")?.addEventListener("click", gerarRelatorio);

  // 4. Inicialização das Chamadas
  fetchLatest();
  carregarHistorico();
  setInterval(fetchLatest, 3000);
});

// =======================
// 💧 Leitura dos Dados e Bomba
// =======================
async function fetchLatest() {
  try {
    const res = await fetch(API_BASE + "/api/dados/latest", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Erro na resposta do servidor");

    const d = await res.json();
    const vol1 = document.getElementById("volume1");
    const vol2 = document.getElementById("volume2");
    
    if (vol1) vol1.style.width = (d.caixa1 || 0) + "%";
    if (vol2) vol2.style.width = (d.caixa2 || 0) + "%";
    
    const btnBomba = document.getElementById("btnLigarBomba");
    if (btnBomba) btnBomba.checked = d.bomba === 1;
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
  }
}

async function enviarComandoBomba(ligar) {
  try {
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
// ⚠️ Chamados e Alertas de Suporte Técnico
// =======================
function abrirModalAlerta() {
  const modal = document.getElementById("modalAlertaTecnico");
  if (modal) modal.style.display = "block";
}

function fecharModalAlerta() {
  const modal = document.getElementById("modalAlertaTecnico");
  if (modal) modal.style.display = "none";
}

async function enviarAlertaTecnico(event) {
  event.preventDefault();

  const tipoAlerta = document.getElementById("alertaTipo").value;
  const mensagem = document.getElementById("alertaMensagem").value;

  try {
    const res = await fetch(API_BASE + "/api/alertas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ tipo: tipoAlerta, mensagem })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Alerta enviado com sucesso! A equipe técnica foi notificada.");
      document.getElementById("alertaMensagem").value = "";
      fecharModalAlerta();
    } else {
      alert(data.error || "Erro ao enviar o alerta.");
    }
  } catch (err) {
    console.error("Erro ao enviar alerta:", err);
    alert("Erro de conexão ao enviar o chamado.");
  }
}

// =======================
// 📅 Histórico e Relatórios
// =======================
async function carregarHistorico() {
  try {
    const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
    const res = await fetch(API_BASE + "/api/historico/" + caixaId, {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    const tbody = document.querySelector("#tabelaHistorico tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    data.forEach((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.dia}</td>
        <td>${d.media_caixa1}</td>
        <td>${d.media_caixa2}</td>
        <td>${d.leituras}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

async function gerarRelatorio() {
  const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;

  if (!dataInicio || !dataFim) {
    alert("Preencha as duas datas!");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/relatorio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ caixa_id: caixaId, dataInicio, dataFim }),
    });

    const dados = await res.json();
    const div = document.getElementById("resultadoRelatorio");
    div.innerHTML = "<h4>Resultados:</h4>";

    if (!dados || dados.length === 0) {
      div.innerHTML += "<p>Nenhum dado no período selecionado.</p>";
      return;
    }

    let html = "<table border='1' style='width:100%; text-align:center;'><tr><th>Data</th><th>Caixa 1</th><th>Caixa 2</th><th>Bomba</th></tr>";
    dados.forEach((d) => {
      html += `<tr>
        <td>${d.data}</td>
        <td>${d.caixa1}</td>
        <td>${d.caixa2}</td>
        <td>${d.bomba ? "Ligada" : "Desligada"}</td>
      </tr>`;
    });
    html += "</table>";
    div.innerHTML += html;
  } catch (err) {
    console.error("Erro ao gerar relatório:", err);
  }
}

// =======================
// 👤 Funções do Modal de Perfil (Globais)
// =======================
async function abrirModalPerfil() {
  const modal = document.getElementById("modalPerfil");
  if (modal) modal.style.display = "block";

  try {
    const res = await fetch(API_BASE + "/api/usuario-atual", {
      headers: { Authorization: "Bearer " + token }
    });
    const dados = await res.json();

    if (res.ok && dados.logado) {
      document.getElementById("perfilUsuario").value = dados.usuario || "";
      document.getElementById("perfilSenha").value = "";
    }
  } catch (err) {
    console.error("Erro ao buscar dados do perfil:", err);
  }
}

function fecharModalPerfil() {
  const modal = document.getElementById("modalPerfil");
  if (modal) modal.style.display = "none";
}

async function salvarPerfil(event) {
  event.preventDefault();

  const usuario = document.getElementById("perfilUsuario").value;
  const senha = document.getElementById("perfilSenha").value;

  try {
    const response = await fetch(API_BASE + "/api/perfil", {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
      body: JSON.stringify({ usuario, senha })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert("Perfil atualizado com sucesso!");
      fecharModalPerfil();
    } else {
      alert(result.error || "Erro ao atualizar perfil.");
    }
  } catch (err) {
    console.error("Erro ao salvar perfil:", err);
    alert("Erro de conexão com o servidor.");
  }
}