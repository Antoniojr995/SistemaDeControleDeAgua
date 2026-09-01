// =======================
// 📦 Importações
// =======================
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// =======================
// ⚙️ Configurações
// =======================
const SECRET_KEY = "meusegredoseguro123";
const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath);
const app = express();
app.use(cors());
app.use(bodyParser.json());

// =======================
// 🧩 Banco de dados
// =======================
const initSql = fs.readFileSync(path.join(__dirname, "init-db.sql"), "utf8");
db.exec(initSql, (err) => {
  if (err) console.error("Erro ao inicializar o banco:", err);
  else console.log("✅ Banco pronto ou já existente.");
});

// =======================
// 🔑 Funções auxiliares
// =======================
function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, tipo: usuario.tipo },
    SECRET_KEY,
    { expiresIn: "8h" }
  );
}

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: "Token ausente" });
  try {
    req.user = jwt.verify(auth.split(" ")[1], SECRET_KEY);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
  }
}

// =======================
// 👤 Registro de usuários
// =======================
app.post("/api/register", async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Campos obrigatórios" });

  db.get("SELECT COUNT(*) AS total FROM usuarios", async (err, row) => {
    if (err) return res.status(500).json({ erro: "Erro no banco" });
    const tipo = row.total === 0 ? "admin" : "cliente";

    const hash = await bcrypt.hash(senha, 10);
    db.run(
      "INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES (?, ?, ?, ?)",
      [nome, email, hash, tipo],
      function (err2) {
        if (err2)
          return res.status(500).json({ erro: "Email já cadastrado" });
        res.json({ ok: true, tipo, id: this.lastID });
      }
    );
  });
});

// =======================
// 🔐 Login
// =======================
app.post("/api/login", (req, res) => {
  const { email, senha } = req.body;
  db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, user) => {
    if (!user) return res.status(404).json({ erro: "Usuário não encontrado" });
    const match = await bcrypt.compare(senha, user.senha_hash);
    if (!match) return res.status(403).json({ erro: "Senha incorreta" });
    const token = gerarToken(user);
    res.json({ token, tipo: user.tipo, nome: user.nome, id: user.id });
  });
});

// =======================
// 💧 Receber dados do ESP32 (sem autenticação)
// =======================
app.post("/api/dados", (req, res) => {
  const { caixa_id, caixa1, caixa2, bomba } = req.body;
  db.run(
    "INSERT INTO niveis (caixa_id, caixa1, caixa2, bomba) VALUES (?, ?, ?, ?)",
    [caixa_id || 1, caixa1 || 0, caixa2 || 0, bomba ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ ok: true });
    }
  );
});

// =======================
// 📊 Consultas protegidas
// =======================
app.get("/api/caixas", autenticar, (req, res) => {
  const sql =
    req.user.tipo === "admin"
      ? "SELECT * FROM caixas"
      : "SELECT * FROM caixas WHERE usuario_id = ?";
  const params = req.user.tipo === "admin" ? [] : [req.user.id];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

app.get('/api/dados/:caixa_id', autenticar, (req, res) => {
  const { caixa_id } = req.params;

  // Admin pode ver qualquer caixa
  if (req.user.tipo === 'admin') {
    db.all('SELECT * FROM niveis WHERE caixa_id = ? ORDER BY id DESC LIMIT 20', [caixa_id], (err, rows) => {
      if (err) return res.status(500).json({ erro: err.message });
      res.json(rows);
    });
  } else {
    // Cliente só pode ver suas próprias caixas
    db.get('SELECT usuario_id FROM caixas WHERE id = ?', [caixa_id], (err, caixa) => {
      if (err || !caixa) return res.status(404).json({ erro: 'Caixa não encontrada' });
      if (caixa.usuario_id !== req.user.id) {
        return res.status(403).json({ erro: 'Acesso negado a esta caixa' });
      }
      db.all('SELECT * FROM niveis WHERE caixa_id = ? ORDER BY id DESC LIMIT 20', [caixa_id], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
      });
    });
  }
});
 
// =======================
// 📅 Histórico diário do cliente
// =======================
app.get("/api/historico/:caixa_id", autenticar, (req, res) => {
  const { caixa_id } = req.params;
  db.all(
    `SELECT 
        DATE(data) AS dia,
        ROUND(AVG(caixa1),1) AS media_caixa1,
        ROUND(AVG(caixa2),1) AS media_caixa2,
        COUNT(*) AS leituras
     FROM niveis
     WHERE caixa_id = ?
     GROUP BY DATE(data)
     ORDER BY dia DESC LIMIT 30`,
    [caixa_id],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: err.message });
      res.json(rows);
    }
  );
});

// =======================
// 📊 Relatório por intervalo
// =======================
app.post("/api/relatorio", autenticar, (req, res) => {
  const { caixa_id, dataInicio, dataFim } = req.body;
  if (!caixa_id || !dataInicio || !dataFim)
    return res.status(400).json({ erro: "Campos obrigatórios ausentes" });

  db.all(
    `SELECT 
        data,
        caixa1,
        caixa2,
        bomba
     FROM niveis
     WHERE caixa_id = ?
       AND DATE(data) BETWEEN ? AND ?
     ORDER BY data DESC`,
    [caixa_id, dataInicio, dataFim],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: err.message });
      res.json(rows);
    }
  );
});
// =======================
// 💧 Controle e status da bomba (para ESP32)
// =======================

// Estado atual da bomba (variável em memória)
let estadoBomba = 0; // 0 = desligada, 1 = ligada

// 🔄 Retorna o status atual da bomba
app.get('/api/bomba/status', (req, res) => {
  res.json({ bomba: estadoBomba });
});

// 💡 Atualiza o estado da bomba (quando cliente/admin clica no botão)
app.post('/api/bomba', express.json(), (req, res) => {
  const { ligar } = req.body;
  estadoBomba = ligar ? 1 : 0;
  console.log(`💧 Bomba ${ligar ? 'ligada' : 'desligada'} pelo painel.`);
  res.json({ ok: true, bomba: estadoBomba });
});
// =======================
// 🔗 Associar uma caixa a um usuário
// =======================
app.put('/api/caixas/:id/associar', autenticar, (req, res) => {
  if (req.user.tipo !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });

  const { id } = req.params;
  const { usuario_id } = req.body;

  if (!usuario_id) return res.status(400).json({ erro: 'Usuário não informado' });

  db.run('UPDATE caixas SET usuario_id = ? WHERE id = ?', [usuario_id, id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: 'Caixa não encontrada' });
    res.json({ ok: true, mensagem: 'Caixa associada ao usuário com sucesso' });
  });
});



// =======================
// 🌐 Servir frontend
// =======================
app.use(express.static(__dirname));

// =======================
// 🚀 Inicialização
// =======================
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`✅ Servidor rodando em http://192.168.31.24:${PORT}`)
);
