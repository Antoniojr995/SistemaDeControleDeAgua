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

    if (alertaAdmin) alertaAdmin.style.display = "block";

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
  carregarMinhasCaixas(); // Puxa apenas as caixas do cliente logado
  carregarHistorico();
  setInterval(fetchLatest, 3000);
});

// =======================
// 📦 Busca Apenas Caixas do Cliente Logado
// =======================
async function carregarMinhasCaixas() {
  try {
    const res = await fetch(API_BASE + "/api/minhas-caixas", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) return;

    const caixas = await res.json();
    const selectCaixa = document.getElementById("selectCaixa") || document.getElementById("minhasCaixas");
    
    if (selectCaixa) {
      selectCaixa.innerHTML = "";
      if (caixas.length === 0) {
        selectCaixa.innerHTML = '<option value="">Nenhuma caixa vinculada</option>';
        return;
      }

      caixas.forEach(caixa => {
        const option = document.createElement("option");
        option.value = caixa.id;
        option.textContent = `${caixa.nome} (ID: ${caixa.id})`;
        selectCaixa.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Erro ao carregar minhas caixas:", err);
  }
}

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
    
    if (vol1) vol1.style.width = (d.caixa1 || d.nivel || 0) + "%";
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
  if (event) event.preventDefault();

  const tipoElemento = document.getElementById("alertaTipo") || document.getElementById("tipoAlerta");
  const mensagemElemento = document.getElementById("alertaMensagem") || document.getElementById("descricaoAlerta") || document.getElementById("mensagem");

  const assunto = tipoElemento ? tipoElemento.value : "Outro problema";
  const mensagem = mensagemElemento ? mensagemElemento.value.trim() : "";

  if (!mensagem) {
    alert("⚠️ Por favor, preencha a descrição do problema.");
    return;
  }

  try {
    const res = await fetch(API_BASE + "/api/chamados", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ assunto, mensagem })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      alert("✅ Chamado aberto com sucesso!");
      if (mensagemElemento) mensagemElemento.value = "";
      fecharModalAlerta();
    } else {
      alert("❌ Erro ao enviar: " + (data.error || "Erro desconhecido"));
    }
  } catch (err) {
    console.error("Erro na requisição de alerta:", err);
    alert("❌ Erro de conexão com o servidor.");
  }
}

// =======================
// 📅 Histórico e Relatórios
// =======================
let meuGrafico = null; // Guarda a referência do gráfico para atualizar sem duplicar

async function carregarHistorico() {
  try {
    const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
    const res = await fetch(`${API_BASE}/api/historico/${caixaId}`, {
      headers: { Authorization: "Bearer " + token },
    });

    if (!res.ok) return;

    const data = await res.json();
    const tbody = document.querySelector("#tabelaHistorico tbody");

    if (!Array.isArray(data) || data.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4">Nenhum registro encontrado.</td></tr>';
      
      // Oculta a área do gráfico se não houver leituras para desenhar
      const areaGrafico = document.getElementById("graficoNivelAgua")?.parentElement;
      if (areaGrafico) areaGrafico.style.display = "none";
      
      return;
    } else {
      // Exibe a área do gráfico se houver dados
      const areaGrafico = document.getElementById("graficoNivelAgua")?.parentElement;
      if (areaGrafico) areaGrafico.style.display = "block";
    }

    // 1. Atualizar Tabela
    if (tbody) {
      tbody.innerHTML = "";
      data.forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.dia || d.data}</td>
          <td>${d.media_caixa1 ?? d.caixa1}%</td>
          <td>${d.media_caixa2 ?? d.caixa2}%</td>
          <td>${d.leituras ?? 1}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 2. Montar Dados para o Gráfico (invertemos para ficar em ordem cronológica)
    const historicoOrdenado = [...data].reverse();
    const rotulos = historicoOrdenado.map(d => d.dia || d.data);
    const dadosCaixa1 = historicoOrdenado.map(d => d.media_caixa1 ?? d.caixa1);
    const dadosCaixa2 = historicoOrdenado.map(d => d.media_caixa2 ?? d.caixa2);

    renderizarGrafico(rotulos, dadosCaixa1, dadosCaixa2);

  } catch (err) {
    console.error("Erro ao carregar histórico e gráfico:", err);
  }
}

function renderizarGrafico(labels, caixa1, caixa2) {
  const ctx = document.getElementById('graficoNivelAgua');
  if (!ctx) return;

  // Destrói gráfico antigo se já existir para evitar bugs visuais
  if (meuGrafico) {
    meuGrafico.destroy();
  }

  meuGrafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Caixa 1 (%)',
          data: caixa1,
          borderColor: '#00a2ff',
          backgroundColor: 'rgba(0, 162, 255, 0.2)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Caixa 2 (%)',
          data: caixa2,
          borderColor: '#0057e7',
          backgroundColor: 'rgba(0, 87, 231, 0.2)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Nível (%)' }
        },
        x: {
          title: { display: true, text: 'Data / Hora' }
        }
      }
    }
  });
}

let ultimosDadosRelatorio = []; // Variável global para guardar os dados buscados

async function gerarRelatorio() {
  const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;

  if (!dataInicio || !dataFim) {
    alert("⚠️ Preencha as duas datas!");
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
    ultimosDadosRelatorio = dados; // Salva para exportar
    
    const div = document.getElementById("resultadoRelatorio");
    const divExport = document.getElementById("acoesExportacao");
    div.innerHTML = "";

    if (!dados || dados.length === 0) {
      div.innerHTML = "<p>Nenhum dado encontrado no período selecionado.</p>";
      if (divExport) divExport.style.display = "none";
      return;
    }

    // Exibe tabela na tela
    let html = `<table border='1' style='width:100%; text-align:center; margin-top: 10px;'>
      <thead>
        <tr>
          <th>Data / Hora</th>
          <th>Caixa 1 (%)</th>
          <th>Caixa 2 (%)</th>
          <th>Estado Bomba</th>
        </tr>
      </thead>
      <tbody>`;

    dados.forEach((d) => {
      html += `<tr>
        <td>${d.data || d.created_at}</td>
        <td>${d.caixa1}%</td>
        <td>${d.caixa2}%</td>
        <td>${d.bomba ? "Ligada" : "Desligada"}</td>
      </tr>`;
    });

    html += "tbody></table>";
    div.innerHTML = html;

    // Exibe botões de download
    if (divExport) divExport.style.display = "block";

  } catch (err) {
    console.error("Erro ao gerar relatório:", err);
    alert("❌ Erro ao buscar relatório no servidor.");
  }
}

// 📁 Exportar para CSV
function exportarCSV() {
  if (ultimosDadosRelatorio.length === 0) return;

  let csvContent = "data:text/csv;charset=utf-8,Data/Hora,Caixa 1 (%),Caixa 2 (%),Bomba\n";

  ultimosDadosRelatorio.forEach(d => {
    const dataHora = d.data || d.created_at;
    const bombaStatus = d.bomba ? "Ligada" : "Desligada";
    csvContent += `"${dataHora}",${d.caixa1},${d.caixa2},"${bombaStatus}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `relatorio_leituras_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 📄 Exportar para PDF
function exportarPDF() {
  if (ultimosDadosRelatorio.length === 0) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Relatório de Monitoramento - Reservatório", 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

  const colunas = ["Data / Hora", "Caixa 1 (%)", "Caixa 2 (%)", "Bomba"];
  const linhas = ultimosDadosRelatorio.map(d => [
    d.data || d.created_at,
    `${d.caixa1}%`,
    `${d.caixa2}%`,
    d.bomba ? "Ligada" : "Desligada"
  ]);

  doc.autoTable({
    startY: 28,
    head: [colunas],
    body: linhas,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] }
  });

  doc.save(`relatorio_leituras_${Date.now()}.pdf`);
}

// =======================
// 👤 Modal Perfil
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