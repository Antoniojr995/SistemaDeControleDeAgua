const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'segredo-chaves-dashboard',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

function requererAutenticacao(req, res, next) {
  if (req.session && req.session.logado) {
    return next();
  }
  res.status(401).json({ error: 'Acesso negado. Faça login primeiro.' });
}

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS caixas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS leituras (
        id SERIAL PRIMARY KEY,
        nivel INTEGER NOT NULL,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chamados (
        id SERIAL PRIMARY KEY,
        cliente_nome VARCHAR(100),
        assunto VARCHAR(100),
        mensagem TEXT,
        solucao TEXT,
        status VARCHAR(20) DEFAULT 'Pendente',
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Adiciona a coluna solucao caso a tabela ja existisse sem ela
    await pool.query(`
      ALTER TABLE chamados ADD COLUMN IF NOT EXISTS solucao TEXT;
    `);

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

// GERENCIAMENTO DE CAIXAS
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
    res.status(500).json({ error: 'Erro ao criar caixa.' });
  }
});

app.get('/api/caixas', requererAutenticacao, async (req, res) => {
  try {
    const queryText = `
      SELECT c.id, c.nome, c.usuario_id, u.usuario AS cliente_nome 
      FROM caixas c 
      LEFT JOIN usuarios u ON c.usuario_id = u.id 
      ORDER BY c.id DESC
    `;
    const result = await pool.query(queryText);
    res.json(result.rows || []);
  } catch (err) {
    res.json([]);
  }
});

app.put('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { nome, usuario_id } = req.body;

  try {
    if (nome !== undefined && usuario_id !== undefined) {
      await pool.query('UPDATE caixas SET nome = $1, usuario_id = $2 WHERE id = $3', [nome, usuario_id || null, id]);
    } else if (nome !== undefined) {
      await pool.query('UPDATE caixas SET nome = $1 WHERE id = $2', [nome, id]);
    } else if (usuario_id !== undefined) {
      await pool.query('UPDATE caixas SET usuario_id = $1 WHERE id = $2', [usuario_id || null, id]);
    }
    res.json({ success: true, message: 'Caixa atualizada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar caixa.' });
  }
});

app.delete('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM caixas WHERE id = $1', [id]);
    res.json({ success: true, message: 'Caixa removida com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar caixa.' });
  }
});

app.put('/api/caixas/:id/associar', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;

  try {
    await pool.query('UPDATE caixas SET usuario_id = $1 WHERE id = $2', [usuario_id || null, id]);
    res.json({ success: true, message: 'Caixa associada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao associar caixa.' });
  }
});

// GERENCIAMENTO DE CLIENTES
app.get('/api/clientes', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, usuario, tipo FROM usuarios WHERE tipo = 'usuario' ORDER BY usuario ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

const criarClienteHandler = async (req, res) => {
  const { usuario, email, senha } = req.body;
  const nomeUsuario = email || usuario;

  if (!nomeUsuario || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    await pool.query(
      "INSERT INTO usuarios (usuario, senha, tipo) VALUES ($1, $2, 'usuario')",
      [nomeUsuario, senha]
    );
    res.status(201).json({ success: true, message: 'Cliente cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar cliente no banco.' });
  }
};

app.post('/api/cadastrar-cliente', requererAutenticacao, criarClienteHandler);
app.post('/api/usuarios', requererAutenticacao, criarClienteHandler);

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
    res.status(500).json({ error: 'Erro ao editar cliente.' });
  }
});

app.delete('/api/admin/clientes/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ success: true, message: 'Cliente removido!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar cliente.' });
  }
});

app.get("/api/admin/clientes/:id", requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    const clienteQuery = await pool.query("SELECT id, usuario FROM usuarios WHERE id = $1", [id]);
    if (clienteQuery.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const cliente = clienteQuery.rows[0];
    const caixasQuery = await pool.query("SELECT id, nome FROM caixas WHERE usuario_id = $1", [id]);
    
    // Busca historico de chamados do cliente pelo nome de usuario
    const chamadosQuery = await pool.query(
      "SELECT id, assunto, mensagem, solucao, status, TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as data_hora FROM chamados WHERE cliente_nome = $1 ORDER BY id DESC",
      [cliente.usuario]
    );

    res.json({
      cliente: cliente,
      caixas: caixasQuery.rows,
      chamados: chamadosQuery.rows
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar dados do cliente" });
  }
});

// ROTA DE COMPATIBILIDADE / ALIAS PARA O PAINEL DO CLIENTE
app.post('/api/alertas', requererAutenticacao, async (req, res) => {
  const { cliente_nome, assunto, mensagem, tipo_problema, descricao } = req.body;
  const usuarioLogado = req.session.usuario || cliente_nome || 'Cliente';
  const msgFinal = mensagem || descricao || 'Sem descrição informada';
  const assuntoFinal = assunto || tipo_problema || 'Outro';

  try {
    await pool.query(
      'INSERT INTO chamados (cliente_nome, assunto, mensagem, status) VALUES ($1, $2, $3, $4)',
      [usuarioLogado, assuntoFinal, msgFinal, 'Pendente']
    );
    res.status(201).json({ success: true, message: 'Alerta/Chamado aberto com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar alerta.' });
  }
});

app.put("/api/admin/clientes/:id/completo", requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { usuario, senha, caixa_id_remover, caixa_id_adicionar } = req.body;

  try {
    if (usuario) {
      if (senha && senha.trim() !== "") {
        await pool.query("UPDATE usuarios SET usuario = $1, senha = $2 WHERE id = $3", [usuario, senha, id]);
      } else {
        await pool.query("UPDATE usuarios SET usuario = $1 WHERE id = $2", [usuario, id]);
      }
    }

    if (caixa_id_remover) {
      await pool.query("UPDATE caixas SET usuario_id = NULL WHERE id = $1 AND usuario_id = $2", [caixa_id_remover, id]);
    }

    if (caixa_id_adicionar) {
      await pool.query("UPDATE caixas SET usuario_id = $1 WHERE id = $2", [id, caixa_id_adicionar]);
    }

    res.json({ success: true, message: "Ficha do cliente atualizada com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar ficha do cliente" });
  }
});

// GERENCIAMENTO DE CHAMADOS
app.get('/api/chamados', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, cliente_nome, assunto, mensagem, solucao, status, TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as data_hora FROM chamados ORDER BY id DESC"
    );
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar chamados no banco.' });
  }
});

app.post('/api/chamados', requererAutenticacao, async (req, res) => {
  const { cliente_nome, assunto, mensagem } = req.body;
  const usuarioLogado = req.session.usuario || cliente_nome || 'Cliente';

  if (!mensagem) {
    return res.status(400).json({ error: 'A mensagem do chamado é obrigatória.' });
  }

  try {
    await pool.query(
      'INSERT INTO chamados (cliente_nome, assunto, mensagem, status) VALUES ($1, $2, $3, $4)',
      [usuarioLogado, assunto || 'Outro', mensagem, 'Pendente']
    );
    res.status(201).json({ success: true, message: 'Chamado aberto com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar chamado.' });
  }
});

app.put('/api/chamados/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { status, solucao } = req.body;

  try {
    await pool.query(
      'UPDATE chamados SET status = $1, solucao = $2 WHERE id = $3', 
      [status || 'Concluído', solucao || '', id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/chamados/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM chamados WHERE id = $1', [id]);
    res.json({ success: true, message: 'Chamado finalizado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir chamado.' });
  }
});

// AUTENTICAÇÃO E SESSÃO
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
      req.session.usuarioId = userDados.id;
      req.session.usuario = userDados.usuario;
      req.session.tipo = userDados.tipo || 'usuario';

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
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
}

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

// 1. ROTA DE HISTÓRICO (Corrige o erro GET /api/historico/1)
app.get('/api/historico/:caixaId', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(data_hora, 'DD/MM/YYYY') as dia,
        ROUND(AVG(nivel)) as media_caixa1,
        0 as media_caixa2,
        COUNT(*) as leituras
      FROM leituras 
      GROUP BY TO_CHAR(data_hora, 'DD/MM/YYYY') 
      ORDER BY dia DESC LIMIT 30
    `);
    res.json(result.rows || []);
  } catch (err) {
    res.json([]);
  }
});

// 2. ROTA DE RELATÓRIO (Atende a geração de relatórios por período)
app.post('/api/relatorio', requererAutenticacao, async (req, res) => {
  const { dataInicio, dataFim } = req.body;
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as data,
        nivel as caixa1,
        0 as caixa2,
        false as bomba
      FROM leituras 
      WHERE data_hora::date BETWEEN $1 AND $2
      ORDER BY id DESC
    `, [dataInicio, dataFim]);
    res.json(result.rows || []);
  } catch (err) {
    res.json([]);
  }
});

// ROTA QUE ESTAVA FALTANDO PARA O PAINEL DO CLIENTE
app.get('/api/dados/latest', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leituras ORDER BY id DESC LIMIT 1');
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ nivel: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar última leitura.' });
  }
});

// LEITURAS ESP32
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
    res.status(500).json({ error: 'Erro ao registrar leitura.' });
  }
});

app.get('/api/minhas-caixas', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nome FROM caixas WHERE usuario_id = $1 ORDER BY id ASC',
      [req.session.usuarioId]
    );
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar suas caixas.' });
  }
});

app.get('/api/meus-chamados', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, assunto, mensagem, solucao, status, TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as data_hora FROM chamados WHERE cliente_nome = $1 ORDER BY id DESC",
      [req.session.usuario]
    );
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar chamados.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});