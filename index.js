require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs'); // CORREÇÃO 1: Import do bcrypt

const app = express();
const PORT = process.env.PORT || 3000;

// CONEXÃO COM O BANCO DE DADOS
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
    // 1. Tabela de usuários (CORREÇÃO 3: Adicionados email e telefone)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(100),
        telefone VARCHAR(20),
        senha VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'usuario'
      )
    `);

    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(100);`);
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);`);

    // 2. Tabela de caixas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS caixas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome_caixa1 VARCHAR(100) DEFAULT 'Caixa 1',
        capacidade_caixa1 INTEGER DEFAULT 1000,
        altura_sensor1 INTEGER DEFAULT 100,
        nome_caixa2 VARCHAR(100) DEFAULT 'Caixa 2',
        capacidade_caixa2 INTEGER DEFAULT 1000,
        altura_sensor2 INTEGER DEFAULT 100,
        status_bomba INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS parametros (
        id SERIAL PRIMARY KEY,
        categoria VARCHAR(100),
        descricao VARCHAR(255),
        valor VARCHAR(100),
        observacoes TEXT
      )
    `);

    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS status_bomba INTEGER DEFAULT 0;`);

    // 3. Tabela de leituras
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leituras (
        id SERIAL PRIMARY KEY,
        caixa_id INTEGER REFERENCES caixas(id) ON DELETE CASCADE,
        nivel_caixa1 INTEGER DEFAULT 0,
        nivel_caixa2 INTEGER DEFAULT 0,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Tabela de chamados
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

    // 5. Admins padrão
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

    console.log('Banco de dados PostgreSQL verificado e ajustado!');
  } catch (err) {
    console.error('Erro ao inicializar tabelas:', err);
  }
}

initDb();

// RECUPERAÇÃO DE SENHA (BREVO API)
const codigosRecuperacao = {};

async function enviarEmailBrevo(destino, codigo) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.EMAIL_PASS,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Suporte Nível de Água', email: process.env.EMAIL_USER },
      to: [{ email: destino }],
      subject: 'Código de Recuperação de Senha',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; background: #031229; color: #fff; padding: 20px; border-radius: 8px;">
          <h2 style="color: #0088ff;">Recuperação de Senha</h2>
          <p>Seu código de verificação é:</p>
          <h1 style="color: #0099ff; letter-spacing: 5px;">${codigo}</h1>
          <p>Este código expira em 10 minutos.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Falha ao enviar e-mail via API Brevo');
  }

  return await response.json();
}

app.post('/api/solicitar-codigo', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });

  try {
    const userResult = await pool.query('SELECT * FROM usuarios WHERE usuario = $1 OR email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'E-mail não cadastrado no sistema.' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosRecuperacao[email] = { codigo, expiracao: Date.now() + 10 * 60 * 1000 };

    await enviarEmailBrevo(email, codigo);
    res.json({ message: 'Código de verificação enviado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao enviar o e-mail.' });
  }
});

app.post('/api/validar-codigo', (req, res) => {
  const { email, codigo } = req.body;
  const dados = codigosRecuperacao[email];

  if (!dados) return res.status(400).json({ erro: 'Nenhum código solicitado para este e-mail.' });
  if (Date.now() > dados.expiracao) {
    delete codigosRecuperacao[email];
    return res.status(400).json({ erro: 'Código expirado. Solicite um novo.' });
  }
  if (dados.codigo !== codigo.trim()) return res.status(400).json({ erro: 'Código incorreto.' });

  res.json({ success: true, mensagem: 'Código verificado com sucesso!' });
});

app.post('/api/redefinir-senha', async (req, res) => {
  const { email, novaSenha } = req.body;
  const dados = codigosRecuperacao[email];

  if (!dados) return res.status(400).json({ erro: 'Sessão expirada.' });

  try {
    await pool.query('UPDATE usuarios SET senha = $1 WHERE usuario = $2 OR email = $2', [novaSenha, email]);
    delete codigosRecuperacao[email];
    res.json({ success: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao redefinir a senha no banco.' });
  }
});

// GERENCIAMENTO DE CAIXAS
app.post('/api/caixas', requererAutenticacao, async (req, res) => {
  const { 
    usuario_id, nome, capacidade, altura_sensor, 
    nome_caixa1, capacidade_caixa1, altura_sensor1,
    nome_caixa2, capacidade_caixa2, altura_sensor2
  } = req.body;

  try {
    const c1_nome = nome_caixa1 || nome || 'Caixa 1';
    const c1_cap = capacidade_caixa1 || capacidade || 1000;
    const c1_altura = altura_sensor1 || altura_sensor || 100;

    const c2_nome = nome_caixa2 || 'Caixa 2';
    const c2_cap = capacidade_caixa2 || 500;
    const c2_altura = altura_sensor2 || 100;

    await pool.query(
      `INSERT INTO caixas 
       (usuario_id, nome_caixa1, capacidade_caixa1, altura_sensor1, nome_caixa2, capacidade_caixa2, altura_sensor2) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuario_id || null, c1_nome, c1_cap, c1_altura, c2_nome, c2_cap, c2_altura]
    );

    res.status(201).json({ success: true, message: 'Caixas cadastradas com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar caixas no banco de dados.' });
  }
});

app.get('/api/caixas', requererAutenticacao, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        c.id, c.usuario_id, u.usuario AS cliente_nome,
        c.nome_caixa1, c.capacidade_caixa1,
        c.nome_caixa2, c.capacidade_caixa2,
        COALESCE(l.nivel_caixa1, 0) AS nivel_caixa1,
        COALESCE(l.nivel_caixa2, 0) AS nivel_caixa2,
        l.data_hora AS ultima_leitura
      FROM caixas c 
      LEFT JOIN usuarios u ON c.usuario_id = u.id 
      LEFT JOIN LATERAL (
        SELECT nivel_caixa1, nivel_caixa2, data_hora 
        FROM leituras 
        WHERE caixa_id = c.id 
        ORDER BY id DESC LIMIT 1
      ) l ON true
      ORDER BY c.id DESC
    `;
    const result = await pool.query(queryText);
    res.json(result.rows || []);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM caixas WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Caixa não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar detalhes da caixa.' });
  }
});

app.put('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { usuario_id, nome_caixa1, capacidade_caixa1, altura_sensor1, nome_caixa2, capacidade_caixa2, altura_sensor2 } = req.body;

  try {
    await pool.query(
      `UPDATE caixas SET 
        usuario_id = COALESCE($1, usuario_id),
        nome_caixa1 = COALESCE($2, nome_caixa1),
        capacidade_caixa1 = COALESCE($3, capacidade_caixa1),
        altura_sensor1 = COALESCE($4, altura_sensor1),
        nome_caixa2 = COALESCE($5, nome_caixa2),
        capacidade_caixa2 = COALESCE($6, capacidade_caixa2),
        altura_sensor2 = COALESCE($7, altura_sensor2)
       WHERE id = $8`,
      [usuario_id !== undefined ? usuario_id : null, nome_caixa1, capacidade_caixa1, altura_sensor1, nome_caixa2, capacidade_caixa2, altura_sensor2, id]
    );
    res.json({ success: true, message: 'Registro de caixas atualizado!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar caixa no banco.' });
  }
});

app.delete('/api/caixas/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM caixas WHERE id = $1', [id]);
    res.json({ success: true, message: 'Caixa removida!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar caixa.' });
  }
});

app.put('/api/caixas/:id/associar', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;
  try {
    await pool.query('UPDATE caixas SET usuario_id = $1 WHERE id = $2', [usuario_id || null, id]);
    res.json({ success: true, message: 'Caixa associada!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao associar caixa.' });
  }
});

// GERENCIAMENTO DE CLIENTES
app.get('/api/clientes', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, usuario, email, telefone, tipo FROM usuarios WHERE tipo = 'usuario' ORDER BY usuario ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

const criarClienteHandler = async (req, res) => {
  const { usuario, email, senha } = req.body;
  const nomeUsuario = usuario || email;

  if (!nomeUsuario || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    await pool.query("INSERT INTO usuarios (usuario, email, senha, tipo) VALUES ($1, $2, $3, 'usuario')", [nomeUsuario, email || nomeUsuario, senha]);
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
    const clienteQuery = await pool.query("SELECT id, usuario, email, telefone FROM usuarios WHERE id = $1", [id]);
    if (clienteQuery.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const cliente = clienteQuery.rows[0];
    const caixasQuery = await pool.query("SELECT id, nome_caixa1 FROM caixas WHERE usuario_id = $1", [id]);
    const chamadosQuery = await pool.query(
      "SELECT id, assunto, mensagem, solucao, status, TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as data_hora FROM chamados WHERE cliente_nome = $1 ORDER BY id DESC",
      [cliente.usuario]
    );

    res.json({ cliente, caixas: caixasQuery.rows, chamados: chamadosQuery.rows });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar dados do cliente" });
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

  if (!mensagem) return res.status(400).json({ error: 'A mensagem é obrigatória.' });

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
    await pool.query('UPDATE chamados SET status = $1, solucao = $2 WHERE id = $3', [status || 'Concluído', solucao || '', id]);
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

  if (!usuario || !senha) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE usuario = $1 OR email = $1', [usuario]);

    if (result.rows.length > 0) {
      const userDados = result.rows[0];

      // Suporte para senhas hash e texto limpo
      let senhaCorreta = userDados.senha === senha;
      if (!senhaCorreta && userDados.senha.startsWith('$2')) {
        senhaCorreta = await bcrypt.compare(senha, userDados.senha);
      }

      if (senhaCorreta) {
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
      }
    }
    
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
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

app.get('/api/usuario-atual', async (req, res) => {
  if (req.session && req.session.logado) {
    try {
      const userRes = await pool.query('SELECT usuario, email, telefone FROM usuarios WHERE id = $1', [req.session.usuarioId]);
      const userDados = userRes.rows[0] || {};

      res.json({ 
        logado: true, 
        id: req.session.usuarioId,
        nome: userDados.usuario || req.session.usuario,
        usuario: userDados.usuario || req.session.usuario,
        email: userDados.email || req.session.usuario,
        telefone: userDados.telefone || '',
        tipo: req.session.tipo 
      });
    } catch (e) {
      res.json({ 
        logado: true, 
        id: req.session.usuarioId,
        nome: req.session.usuario,
        usuario: req.session.usuario,
        tipo: req.session.tipo 
      });
    }
  } else {
    res.json({ logado: false });
  }
});

// HISTÓRICO E RELATÓRIOS
app.get('/api/historico/:caixaId', requererAutenticacao, async (req, res) => {
  const { caixaId } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as dia,
        ROUND(AVG(nivel_caixa1)) as media_caixa1,
        ROUND(AVG(nivel_caixa2)) as media_caixa2,
        data_hora as data_registro
      FROM leituras 
      WHERE caixa_id = $1
      GROUP BY TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI'), data_hora
      ORDER BY data_hora DESC LIMIT 30
    `, [caixaId]);
    res.json(result.rows || []);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/relatorio', requererAutenticacao, async (req, res) => {
  const { caixa_id, dataInicio, dataFim } = req.body;
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(data_hora, 'DD/MM/YYYY HH24:MI') as data,
        nivel_caixa1 as caixa1,
        nivel_caixa2 as caixa2
      FROM leituras 
      WHERE caixa_id = $1 AND data_hora::date BETWEEN $2 AND $3
      ORDER BY id DESC
    `, [caixa_id || 1, dataInicio, dataFim]);
    res.json(result.rows || []);
  } catch (err) {
    res.json([]);
  }
});

// DADOS EM TEMPO REAL PARA O DASHBOARD DO CLIENTE
app.get('/api/dados/latest', requererAutenticacao, async (req, res) => {
  try {
    const usuarioId = req.session.usuarioId;

    const resCaixas = await pool.query(
      'SELECT id, nome_caixa1, nome_caixa2, capacidade_caixa1, capacidade_caixa2, status_bomba FROM caixas WHERE usuario_id = $1 LIMIT 1',
      [usuarioId]
    );

    if (resCaixas.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma caixa encontrada para este usuário.' });
    }

    const caixas = resCaixas.rows[0];

    const resLeitura = await pool.query(
      'SELECT nivel_caixa1, nivel_caixa2, data_hora FROM leituras WHERE caixa_id = $1 ORDER BY id DESC LIMIT 1',
      [caixas.id]
    );

    const ultimaLeitura = resLeitura.rows[0] || { nivel_caixa1: 0, nivel_caixa2: 0 };

    res.json({
      nome_caixa1: caixas.nome_caixa1 || 'Caixa 1',
      nome_caixa2: caixas.nome_caixa2 || 'Caixa 2',
      caixa1: Number(ultimaLeitura.nivel_caixa1 || 0),
      caixa2: Number(ultimaLeitura.nivel_caixa2 || 0),
      capacidade_caixa1: Number(caixas.capacidade_caixa1 || 1000),
      capacidade_caixa2: Number(caixas.capacidade_caixa2 || 1000),
      bomba: caixas.status_bomba || 0,
      data_hora: ultimaLeitura.data_hora || new Date()
    });

  } catch (err) {
    console.error('Erro ao buscar última leitura:', err);
    res.status(500).json({ error: 'Erro ao buscar última leitura.' });
  }
});

// ACIONAMENTO DA BOMBA VIA DASHBOARD
app.post('/api/bomba', requererAutenticacao, async (req, res) => {
  const { ligar } = req.body;
  const statusNum = ligar ? 1 : 0;
  try {
    await pool.query('UPDATE caixas SET status_bomba = $1 WHERE usuario_id = $2', [statusNum, req.session.usuarioId]);
    res.json({ success: true, status: statusNum });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar estado da bomba.' });
  }
});

// LEITURAS ESP32
app.post('/api/leitura', async (req, res) => {
  const { caixa_id, nivel_caixa1, nivel_caixa2 } = req.body;

  if (nivel_caixa1 === undefined || nivel_caixa2 === undefined) {
    return res.status(400).json({ error: 'Níveis das Caixas 1 e 2 são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO leituras (caixa_id, nivel_caixa1, nivel_caixa2) VALUES ($1, $2, $3) RETURNING *',
      [caixa_id || 1, nivel_caixa1, nivel_caixa2]
    );
    res.status(201).json({ success: true, dados: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar leitura das caixas.' });
  }
});

app.get('/api/minhas-caixas', requererAutenticacao, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        c.id, c.nome_caixa1, c.capacidade_caixa1, c.altura_sensor1,
        c.nome_caixa2, c.capacidade_caixa2, c.altura_sensor2,
        COALESCE(l.nivel_caixa1, 0) AS nivel_caixa1,
        COALESCE(l.nivel_caixa2, 0) AS nivel_caixa2,
        l.data_hora AS ultima_leitura
      FROM caixas c
      LEFT JOIN LATERAL (
        SELECT nivel_caixa1, nivel_caixa2, data_hora 
        FROM leituras 
        WHERE caixa_id = c.id 
        ORDER BY id DESC LIMIT 1
      ) l ON true
      WHERE c.usuario_id = $1
      ORDER BY c.id ASC
    `;

    const result = await pool.query(queryText, [req.session.usuarioId]);
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

// ROTAS DE PARÂMETROS
app.get('/api/parametros', requererAutenticacao, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parametros ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar parâmetros.' });
  }
});

app.post('/api/parametros', requererAutenticacao, async (req, res) => {
  const { categoria, descricao, valor, observacoes } = req.body;
  try {
    await pool.query(
      'INSERT INTO parametros (categoria, descricao, valor, observacoes) VALUES ($1, $2, $3, $4)',
      [categoria, descricao, valor, observacoes]
    );
    res.status(201).json({ success: true, message: 'Cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao guardar no banco.' });
  }
});

app.delete('/api/parametros/:id', requererAutenticacao, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM parametros WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover parâmetro.' });
  }
});

// Atualizar Perfil (CORREÇÃO 2: Acesso correto a req.session.usuarioId)
app.put('/api/perfil', requererAutenticacao, async (req, res) => {
  const { usuario, email, telefone } = req.body;
  const userId = req.session.usuarioId;

  try {
    await pool.query(
      'UPDATE usuarios SET usuario = $1, email = $2, telefone = $3 WHERE id = $4',
      [usuario, email, telefone, userId]
    );
    req.session.usuario = usuario;
    
    res.json({ success: true, message: 'Perfil atualizado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});

// Alterar Senha (CORREÇÃO 2: Acesso correto a req.session.usuarioId)
app.put('/api/alterar-senha', requererAutenticacao, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const userId = req.session.usuarioId;

  try {
    const userRes = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Utilizador não encontrado.' });

    const senhaNoBanco = userRes.rows[0].senha;
    let senhaValida = senhaNoBanco === senhaAtual;

    if (!senhaValida && senhaNoBanco.startsWith('$2')) {
      senhaValida = await bcrypt.compare(senhaAtual, senhaNoBanco);
    }

    if (!senhaValida) return res.status(400).json({ error: 'Palavra-passe atual incorreta.' });

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [novaSenhaHash, userId]);

    res.json({ success: true, message: 'Palavra-passe atualizada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar palavra-passe.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});