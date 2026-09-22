// Dados simulados de Clientes
const clientesData = [
    { id: 1, nome: "João Silva", email: "joao@email.com", telefone: "(21) 98888-7777", caixas: 1, status: "Ativo" },
    { id: 2, nome: "Maria Oliveira", email: "maria@email.com", telefone: "(21) 97777-6666", caixas: 1, status: "Ativo" },
    { id: 3, nome: "Carlos Eduardo", email: "carlos@email.com", telefone: "(21) 96666-5555", caixas: 1, status: "Inativo" },
    { id: 4, nome: "Ana Paula", email: "ana.paula@email.com", telefone: "(21) 95555-4444", caixas: 2, status: "Ativo" }
  ];
  
  document.addEventListener("DOMContentLoaded", () => {
    renderTabelaClientes(clientesData);
  
    // Filtro de busca em tempo real
    const inputBusca = document.getElementById("inputBuscaCliente");
    if (inputBusca) {
      inputBusca.addEventListener("input", (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = clientesData.filter(cliente => 
          cliente.nome.toLowerCase().includes(termo) ||
          cliente.email.toLowerCase().includes(termo) ||
          cliente.telefone.includes(termo)
        );
        renderTabelaClientes(filtrados);
      });
    }
  
    // Evento para botão de Novo Cliente
    const btnNovoCliente = document.getElementById("btnNovoCliente");
    if (btnNovoCliente) {
      btnNovoCliente.addEventListener("click", () => {
        alert("Abrir formulário para cadastrar novo cliente.");
      });
    }
  
    // Logout
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        window.location.href = "login.html";
      });
    }
  });
  
  function renderTabelaClientes(lista) {
    const tbody = document.getElementById("listaClientes");
    if (!tbody) return;
  
    tbody.innerHTML = "";
  
    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#7b93b8; padding:20px;">Nenhum cliente encontrado.</td></tr>`;
      return;
    }
  
    lista.forEach(cliente => {
      const badgeClass = cliente.status === "Ativo" ? "badge-active" : "badge-inactive";
  
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${cliente.nome}</strong></td>
        <td>${cliente.email}</td>
        <td>${cliente.telefone}</td>
        <td><i class="fas fa-cube text-cyan"></i> ${cliente.caixas} caixa(s)</td>
        <td><span class="badge-status ${badgeClass}">${cliente.status}</span></td>
        <td>
          <button class="btn-action" onclick="editarCliente(${cliente.id})" title="Editar">
            <i class="fas fa-user-edit"></i>
          </button>
          <button class="btn-action btn-danger" onclick="excluirCliente(${cliente.id})" title="Excluir">
            <i class="fas fa-user-times"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }
  
  function editarCliente(id) {
    alert(`Editar cliente ID: ${id}`);
  }
  
  function excluirCliente(id) {
    if (confirm(`Deseja realmente remover este cliente?`)) {
      alert(`Cliente ID: ${id} removido.`);
    }
  }