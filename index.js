const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão PostgreSQL (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessão
app.use(session({
  secret: 'segredo-chaves-dashboard',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Servir arquivos estáticos (procura na raiz e na pasta public se existir)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Inicialização das Tabelas no Neon
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(50) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'usuario'
      )
    `);

    // Garante que a coluna 'tipo' existe caso a tabela tenha sido criada antes sem ela
    await pool.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'usuario'
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leituras (
        id SERIAL PRIMARY KEY,
        nivel INTEGER NOT NULL,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserção garantida definindo admin
    await pool.query(`
      INSERT INTO usuarios (usuario, senha, tipo) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (usuario) DO UPDATE SET tipo = 'admin'
    `, ['admin@teste.com', '123456', 'admin']);

    await pool.query(`
      INSERT INTO usuarios (usuario, senha, tipo) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (usuario) DO UPDATE SET tipo = 'admin'
    `, ['admin', '123456', 'admin']);

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

// Handler de Login (Salva o tipo do usuário na sessão)
async function tratarLogin(req, res) {
  const usuario = req.body.usuario || req.body.email || req.body.login;
  const senha = req.body.senha || req.body.password;

  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1 AND senha = $2',
      [usuario, senha]
    );

    if (result.rows.length > 0) {
      const userDados = result.rows[0];
      req.session.logado = true;
      req.session.usuario = userDados.usuario;
      req.session.tipo = userDados.tipo || 'usuario'; // Salva 'admin' ou 'usuario' na sessão

      // Se a requisição veio de um Form HTML tradicional
      if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
        return res.redirect('/painel.html');
      }

      return res.json({ 
        success: true, 
        message: 'Login efetuado com sucesso!',
        usuario: userDados.usuario,
        tipo: userDados.tipo || 'usuario'
      });
    } else {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
}

// Buscar lista de clientes
app.get('/api/clientes', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, usuario, tipo FROM usuarios WHERE tipo = 'usuario'");
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// Cadastrar novo cliente pelo painel
app.post('/api/cadastrar-cliente', requererAutenticacao, async (req, res) => {
  const { nome, email, senha } = req.body;
  const usuario = email || nome;

  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    await pool.query(
      "INSERT INTO usuarios (usuario, senha, tipo) VALUES ($1, $2, 'usuario')",
      [usuario, senha]
    );
    res.status(201).json({ success: true, message: 'Cliente cadastrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao cadastrar cliente:', err);
    res.status(500).json({ error: 'Erro ao cadastrar cliente no banco.' });
  }
});

// Aceita requisição tanto em /login quanto em /api/login
app.post('/login', tratarLogin);
app.post('/api/login', tratarLogin);

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout efetuado.' });
});

app.get('/api/usuario-atual', (req, res) => {
  if (req.session && req.session.logado) {
    res.json({ 
      logado: true, 
      usuario: req.session.usuario,
      tipo: req.session.tipo 
    });
  } else {
    res.json({ logado: false });
  }
});

// Rotas do ESP32 e Dashboard
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