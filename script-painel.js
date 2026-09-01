document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.location.origin;
  const token = sessionStorage.getItem("token");
  const tipo = sessionStorage.getItem("tipo");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // ✅ Mostrar botão "Voltar" se for admin
  if (tipo === "admin") {
    const btnVoltar = document.getElementById("btnVoltarAdmin");
    btnVoltar.style.display = "inline-block";
    btnVoltar.addEventListener("click", () => {
      window.location.href = "painel-admin.html";
    });
  }

  async function fetchLatest() {
    try {
      const res = await fetch(API_BASE + "/api/dados/latest", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!res.ok) throw new Error("Erro na resposta do servidor");

      const d = await res.json();
      document.getElementById("volume1").style.width = (d.caixa1 || 0) + "%";
      document.getElementById("volume2").style.width = (d.caixa2 || 0) + "%";
      document.getElementById("btnLigarBomba").checked = d.bomba === 1;
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    }
  }

  // =======================
  // 📅 Carregar histórico diário
  // =======================
  async function carregarHistorico() {
    try {
      const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
      const res = await fetch(API_BASE + "/api/historico/" + caixaId, {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      const tbody = document.querySelector("#tabelaHistorico tbody");
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

  // =======================
  // 📊 Gerar relatório personalizado
  // =======================
  document.getElementById("btnRelatorio").addEventListener("click", async () => {
    const caixaId = sessionStorage.getItem("caixaSelecionada") || 1;
    const dataInicio = document.getElementById("dataInicio").value;
    const dataFim = document.getElementById("dataFim").value;

    if (!dataInicio || !dataFim) {
      alert("Preencha as duas datas!");
      return;
    }

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

    if (dados.length === 0) {
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
  });

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
      console.error("Erro ao enviar comando:", err);
    }
  }

  // === Eventos ===
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

  // Atualização automática
  setInterval(fetchLatest, 3000);
  fetchLatest();
  carregarHistorico();
});
