// Dados simulados das Caixas d'Água (pode vir de uma API/Backend)
const caixasData = [
    { id: "CX-101", cliente: "João Silva", capacidade: 1000, alturaSensor: 120, nivelAtual: "85%" },
    { id: "CX-102", cliente: "Maria Oliveira", capacidade: 500, alturaSensor: 80, nivelAtual: "40%" },
    { id: "CX-103", cliente: "Sem Dono (Livre)", capacidade: 2000, alturaSensor: 180, nivelAtual: "100%" },
    { id: "CX-104", cliente: "Carlos Eduardo", capacidade: 1000, alturaSensor: 120, nivelAtual: "15%" }
  ];
  
  document.addEventListener("DOMContentLoaded", () => {
    renderTabelaCaixas();
  
    // Evento para criar nova caixa
    const btnNovaCaixa = document.getElementById("btnNovaCaixa");
    if (btnNovaCaixa) {
      btnNovaCaixa.addEventListener("click", () => {
        alert("Abrir formulário de cadastro de nova Caixa d'Água.");
      });
    }
  
    // Evento do botão de Logout
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        window.location.href = "login.html";
      });
    }
  });
  
  // Função para desenhar as linhas da tabela
  function renderTabelaCaixas() {
    const tbody = document.getElementById("listaCaixas");
    if (!tbody) return;
  
    tbody.innerHTML = "";
  
    caixasData.forEach(caixa => {
      const porcentagem = parseInt(caixa.nivelAtual);
      const badgeClass = porcentagem < 25 ? "badge-warning" : "badge-ok";
  
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${caixa.id}</strong></td>
        <td>${caixa.cliente}</td>
        <td>${caixa.capacidade} L</td>
        <td>${caixa.alturaSensor} cm</td>
        <td><span class="badge-status ${badgeClass}">${caixa.nivelAtual}</span></td>
        <td>
          <button class="btn-action" onclick="editarCaixa('${caixa.id}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-action btn-danger" onclick="excluirCaixa('${caixa.id}')" title="Excluir">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
  
  function editarCaixa(id) {
    alert(`Editar caixa: ${id}`);
  }
  
  function excluirCaixa(id) {
    if (confirm(`Tem certeza que deseja remover a caixa ${id}?`)) {
      alert(`Caixa ${id} removida com sucesso!`);
    }
  }