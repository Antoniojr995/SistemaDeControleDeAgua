// Pega o ID passado na URL (ex: detalhes-caixa.html?id=01)
const urlParams = new URLSearchParams(window.location.search);
const idCaixa = urlParams.get('id') || '01';

document.addEventListener('DOMContentLoaded', () => {
  // Atualiza os títulos na tela
  document.getElementById('tituloCaixa').textContent = `Caixa d'Água ${idCaixa}`;
  document.getElementById('infoId').textContent = `RES-${idCaixa}`;

  // Aqui você chama suas funções de API/Banco para puxar os dados específicos dessa caixa
  carregarDadosCaixa(idCaixa);
});

function carregarDadosCaixa(id) {
  console.log(`Carregando dados específicos da Caixa ${id}`);
  // Lógica para buscar do Firebase/API e renderizar o gráfico e valores
}