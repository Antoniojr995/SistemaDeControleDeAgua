const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(bodyParser.json());

// Cria tabela se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS niveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    caixa1 REAL,
    caixa2 REAL,
    bomba INTEGER
  )
`);

// ✅ Endpoint para receber leituras do ESP32
app.post('/api/dados', (req, res) => {
  const { caixa1, caixa2, bomba } = req.body;

  if (typeof caixa1 !== 'number' || typeof caixa2 !== 'number') {
    return res.status(400).json({ error: 'Formato inválido' });
  }

  db.run(
    'INSERT INTO niveis (caixa1, caixa2, bomba) VALUES (?, ?, ?)',
    [caixa1, caixa2, bomba ? 1 : 0],
    (err) => {
      if (err) {
        console.error('Erro ao inserir dados:', err);
        return res.status(500).json({ error: 'Erro ao salvar no banco' });
      }
      res.json({ ok: true });
    }
  );
});

// ✅ Endpoint para obter última leitura
app.get('/api/dados/latest', (req, res) => {
  db.get('SELECT * FROM niveis ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Erro ao buscar dados:', err);
      return res.status(500).json({ error: 'Erro no banco' });
    }
    res.json(row || { caixa1: 0, caixa2: 0, bomba: 0 });
  });
});

// ✅ Endpoint para obter histórico (opcional)
app.get('/api/dados', (req, res) => {
  db.all('SELECT * FROM niveis ORDER BY id DESC LIMIT 500', (err, rows) => {
    if (err) {
      console.error('Erro ao buscar histórico:', err);
      return res.status(500).json({ error: 'Erro no banco' });
    }
    res.json(rows);
  });
});

// ✅ Endpoint para receber comando da bomba
app.post('/api/bomba', (req, res) => {
  const { ligar } = req.body;
  db.run(
    'INSERT INTO niveis (caixa1, caixa2, bomba) VALUES (?, ?, ?)',
    [0, 0, ligar ? 1 : 0],
    (err) => {
      if (err) {
        console.error('Erro ao inserir comando:', err);
        return res.status(500).json({ error: 'Erro no banco' });
      }
      res.json({ ok: true, bomba: ligar ? 1 : 0 });
    }
  );
});

// ✅ Endpoint para ESP32 checar estado atual da bomba
app.get('/api/bomba/status', (req, res) => {
  db.get(
    'SELECT bomba FROM niveis WHERE bomba IS NOT NULL ORDER BY id DESC LIMIT 1',
    (err, row) => {
      if (err) {
        console.error('Erro ao buscar status da bomba:', err);
        return res.status(500).json({ error: 'Erro no banco' });
      }
      res.json({ bomba: row ? row.bomba : 0 });
    }
  );
});

// ✅ Servir frontend (HTML/JS/CSS) se estiver na pasta ../frontend
app.use('/', express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API rodando na porta ${PORT}`);
});
