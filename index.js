const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração da conexão com o PostgreSQL (Neon/Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middlewares para leitura de dados de requisição
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de Sessão para o Admin
app.use(session({
  secret: 'segredo-chaves-dashboard',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Servir arquivos de estilo, scripts e páginas da raiz do projeto
app.use(express.static(__dirname));

// Rota para garantir o carregamento do index.html no link principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rotas de páginas estáticas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir a página principal explicitamente na raiz e em /index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialização e Criação das Tabelas
async function initDb() {
  try {
    // Tabela de usuários/admin
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(50) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL
      )
    `);

    // Tabela de leituras de água
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leituras (
        id SERIAL PRIMARY KEY,
        nivel INTEGER NOT NULL,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserir usuário admin padrão com e-mail
    const userCheck = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', ['admin@teste.com']);
    if (userCheck.rows.length === 0) {
      await pool.query('INSERT INTO usuarios (usuario, senha) VALUES ($1, $2)', ['admin@teste.com', '123456']);
      console.log('Usuário admin criado (admin@teste.com / 123456)');
    }

    console.log('Banco de dados PostgreSQL verificado e pronto!');
  } catch (err) {
    console.error('Erro ao inicializar tabelas:', err);
  }
}

initDb();

// Middleware de Autenticação
function requererAutenticacao(req, res, next) {
  if (req.session && req.session.logado) {
    return next();
  }
  res.status(401).json({ error: 'Acesso negado. Faça login primeiro.' });
}

// Rotas de Autenticação

app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1 AND senha = $2',
      [usuario, senha]
    );

    if (result.rows.length > 0) {
      req.session.logado = true;
      req.session.usuario = usuario;
      return res.json({ success: true, message: 'Login efetuado com sucesso!' });
    } else {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout efetuado.' });
});

app.get('/api/usuario-atual', (req, res) => {
  if (req.session && req.session.logado) {
    res.json({ logado: true, usuario: req.session.usuario });
  } else {
    res.json({ logado: false });
  }
});

// Rotas Protegidas do Dashboard / Dados

app.post('/api/leitura', async (req, res) => {
  const { nivel } = req.body;
  if (nivel === undefined || nivel === null) {
    return res.status(400).json({ error: 'Nível inválido.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO leituras (nivel) VALUES ($1) RETURNING *',
      [nivel]
    );
    res.status(201).json({ success: true, dados: result.rows[0] });
  } catch (err) {
    console.error('Erro ao salvar leitura:', err);
    res.status(500).json({ error: 'Erro ao registrar leitura.' });
  }
});

app.get('/api/leituras', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leituras ORDER BY data_hora DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar leituras:', err);
    res.status(500).json({ error: 'Erro ao buscar dados do banco.' });
  }
});

app.get('/api/ultima-leitura', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leituras ORDER BY data_hora DESC LIMIT 1');
    res.json(result.rows[0] || { nivel: 0 });
  } catch (err) {
    console.error('Erro ao buscar última leitura:', err);
    res.status(500).json({ error: 'Erro no banco de dados.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});