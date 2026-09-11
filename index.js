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
    // 1. Tabela de usuários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(50) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'usuario'
      )
    `);

    // Garante coluna 'tipo' se a tabela for antiga
    await pool.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'usuario'
    `);

    // 2. Tabela de caixas d'água (relacionada com usuários)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS caixas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    // 3. Tabela de leituras de nível de água
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leituras (
        id SERIAL PRIMARY KEY,
        nivel INTEGER NOT NULL,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tabela de chamados abertos pelos clientes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chamados (
        id SERIAL PRIMARY KEY,
        cliente_nome VARCHAR(100),
        assunto VARCHAR(100),
        mensagem TEXT,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Inserção/Garantia dos administradores
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

// Rota para criar caixa
app.post('/api/caixas', requererAutenticacao, async (req, res) => {
  const { nome, usuario_id } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome da caixa é obrigatório.' });

  try {
    await pool.query(
      'INSERT INTO caixas (nome, usuario_id) VALUES ($1, $2)',
      [nome, usuario_id || null]
    );
    res.status(201).json({ success: true, message: 'Caixa criada com sucesso!' });
  } catch (err) {
    console.error('Erro ao criar caixa:', err);
    res.status(500).json({ error: 'Erro ao criar caixa.' });
  }
});

// Rota para listar caixas d'água no backend
app.get('/api/caixas', requererAutenticacao, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        c.id, 
        c.nome, 
        u.usuario AS cliente_nome 
      FROM caixas c 
      LEFT JOIN usuarios u ON c.usuario_id = u.id 
      ORDER BY c.id DESC
    `;
    const result = await pool.query(queryText);
    
    // Retorna sempre o array com as caixas (ou lista vazia [])
    res.json(result.rows || []);
  } catch (err) {
    console.error('Erro na consulta de caixas:', err);
    // Retorna array vazio em caso de falha no banco para não quebrar o frontend
    res.json([]);
  }
});

// --- GERENCIAMENTO DE CAIXAS (ADMIN) ---

// Editar nome ou cliente de uma caixa
app.put('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { nome, usuario_id } = req.body;

  try {
    await pool.query(
      'UPDATE caixas SET nome = $1, usuario_id = $2 WHERE id = $3',
      [nome, usuario_id || null, id]
    );
    res.json({ success: true, message: 'Caixa atualizada com sucesso!' });
  } catch (err) {
    console.error('Erro ao atualizar caixa:', err);
    res.status(500).json({ error: 'Erro ao atualizar caixa.' });
  }
});

// Deletar caixa d'água
app.delete('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM caixas WHERE id = $1', [id]);
    res.json({ success: true, message: 'Caixa removida com sucesso!' });
  } catch (err) {
    console.error('Erro ao deletar caixa:', err);
    res.status(500).json({ error: 'Erro ao deletar caixa.' });
  }
});

// --- GERENCIAMENTO DE USUÁRIOS/CLIENTES ---

// Admin edita dados completos do cliente (Nome, Email/Usuário, Senha)
app.put('/api/admin/clientes/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { usuario, senha } = req.body;

  try {
    if (senha && senha.trim() !== '') {
      await pool.query('UPDATE usuarios SET usuario = $1, senha = $2 WHERE id = $3', [usuario, senha, id]);
    } else {
      await pool.query('UPDATE usuarios SET usuario = $1 WHERE id = $2', [usuario, id]);
    }
    res.json({ success: true, message: 'Cliente atualizado!' });
  } catch (err) {
    console.error('Erro ao editar cliente:', err);
    res.status(500).json({ error: 'Erro ao editar cliente.' });
  }
});

// Admin deleta um cliente
app.delete('/api/admin/clientes/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ success: true, message: 'Cliente removido!' });
  } catch (err) {
    console.error('Erro ao deletar cliente:', err);
    res.status(500).json({ error: 'Erro ao deletar cliente.' });
  }
});

// Cliente comum altera o próprio perfil
app.put('/api/perfil', requererAutenticacao, async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { usuario, senha } = req.body;

  try {
    if (senha && senha.trim() !== '') {
      await pool.query('UPDATE usuarios SET usuario = $1, senha = $2 WHERE id = $3', [usuario, senha, usuarioId]);
    } else {
      await pool.query('UPDATE usuarios SET usuario = $1 WHERE id = $2', [usuario, usuarioId]);
    }
    res.json({ success: true, message: 'Perfil atualizado!' });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});

// Rota para buscar apenas usuários/clientes cadastrados
app.get('/api/clientes', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, usuario FROM usuarios WHERE tipo = 'usuario' ORDER BY usuario ASC");
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// Rota para associar caixa a cliente
app.put('/api/caixas/:id/associar', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;

  try {
    await pool.query('UPDATE caixas SET usuario_id = $1 WHERE id = $2', [usuario_id, id]);
    res.json({ success: true, message: 'Caixa associada com sucesso!' });
  } catch (err) {
    console.error('Erro ao associar caixa:', err);
    res.status(500).json({ error: 'Erro ao associar caixa.' });
  }
});

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