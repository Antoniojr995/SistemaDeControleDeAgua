// Dados simulados de parâmetros registados
const itensCadastrados = [
    { id: 1, categoria: "Modelo de Reservatório", descricao: "Polietileno 1000L", valor: "1000 Litros" },
    { id: 2, categoria: "Modelo de Reservatório", descricao: "Fibra de Vidro 5000L", valor: "5000 Litros" },
    { id: 3, categoria: "Tipo de Sensor", descricao: "Sensor JSN-SR04T (À prova d'água)", valor: "Alcance 20cm - 600cm" },
    { id: 4, categoria: "Parâmetro de Alerta", descricao: "Nível Crítico Mínimo", valor: "20%" }
  ];
  
  document.addEventListener("DOMContentLoaded", () => {
    renderTabelaCadastros();
  
    // Submissão do formulário
    const form = document.getElementById("formCadastroGeral");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
  
        const tipo = document.getElementById("tipoCadastro").options[document.getElementById("tipoCadastro").selectedIndex].text;
        const nome = document.getElementById("nomeItem").value;
        const valor = document.getElementById("valorPadrao").value;
  
        itensCadastrados.push({
          id: Date.now(),
          categoria: tipo,
          descricao: nome,
          valor: valor || "-"
        });
  
        renderTabelaCadastros();
        form.reset();
        alert("Registo guardado com sucesso!");
      });
    }
  
    // Logout
    // Ajuste no cadastros.js (Bloco do Logout):
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        sessionStorage.clear(); // Limpa tokens de sessão
        window.location.href = "index.html"; // Redireciona para a home/login padrão
      });
    }
  });
  
  function renderTabelaCadastros() {
    const tbody = document.getElementById("listaCadastros");
    if (!tbody) return;
  
    tbody.innerHTML = "";
  
    itensCadastrados.forEach(item => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="badge-status badge-ok">${item.categoria}</span></td>
        <td><strong>${item.descricao}</strong></td>
        <td>${item.valor}</td>
        <td>
          <button class="btn-action btn-danger" onclick="removerItem(${item.id})" title="Remover">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
  
  function removerItem(id) {
    if (confirm("Deseja remover este item de registo?")) {
      const idx = itensCadastrados.findIndex(i => i.id === id);
      if (idx !== -1) {
        itensCadastrados.splice(idx, 1);
        renderTabelaCadastros();
      }
    }
  }