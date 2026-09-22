require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

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
    // 1. Tabela de usuários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'usuario'
      )
    `);

    // 2. Tabela de caixas (suporta Caixa 1 e Caixa 2 para cada cliente)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS caixas (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        nome_caixa1 VARCHAR(100) DEFAULT 'Caixa 1',
        capacidade_caixa1 INTEGER DEFAULT 1000,
        altura_sensor1 INTEGER DEFAULT 100,
        nome_caixa2 VARCHAR(100) DEFAULT 'Caixa 2',
        capacidade_caixa2 INTEGER DEFAULT 1000,
        altura_sensor2 INTEGER DEFAULT 100
      )
    `);

    // Adiciona colunas novas caso a tabela 'caixas' já tenha sido criada anteriormente
    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS nome_caixa1 VARCHAR(100) DEFAULT 'Caixa 1';`);
    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS capacidade_caixa1 INTEGER DEFAULT 1000;`);
    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS altura_sensor1 INTEGER DEFAULT 100;`);
    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS nome_caixa2 VARCHAR(100) DEFAULT 'Caixa 2';`);
    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS capacidade_caixa2 INTEGER DEFAULT 1000;`);
    await pool.query(`ALTER TABLE caixas ADD COLUMN IF NOT EXISTS altura_sensor2 INTEGER DEFAULT 100;`);

    // 3. Tabela de leituras (registra os níveis das duas caixas no mesmo envio do ESP32)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leituras (
        id SERIAL PRIMARY KEY,
        caixa_id INTEGER REFERENCES caixas(id) ON DELETE CASCADE,
        nivel_caixa1 INTEGER DEFAULT 0,
        nivel_caixa2 INTEGER DEFAULT 0,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Adiciona colunas novas caso a tabela 'leituras' já tenha sido criada antes
    await pool.query(`ALTER TABLE leituras ADD COLUMN IF NOT EXISTS caixa_id INTEGER REFERENCES caixas(id) ON DELETE CASCADE;`);
    await pool.query(`ALTER TABLE leituras ADD COLUMN IF NOT EXISTS nivel_caixa1 INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE leituras ADD COLUMN IF NOT EXISTS nivel_caixa2 INTEGER DEFAULT 0;`);

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
    
    await pool.query(`ALTER TABLE chamados ADD COLUMN IF NOT EXISTS solucao TEXT;`);

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

    console.log('Banco de dados PostgreSQL verificado e ajustado para 2 caixas por cliente!');
  } catch (err) {
    console.error('Erro ao inicializar tabelas:', err);
  }
}

initDb();

// CONFIGURAÇÃO DE RECUPERAÇÃO DE SENHA (BREVO API HTTP)
const codigosRecuperacao = {};

async function enviarEmailBrevo(destino, codigo) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': process.env.EMAIL_PASS, // Sua chave v3 que começa com xkeysib-...
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: 'Suporte Nível de Água',
        email: process.env.EMAIL_USER
      },
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

// 1. SOLICITAR CÓDIGO DE RECUPERAÇÃO
app.post('/api/solicitar-codigo', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'E-mail não cadastrado no sistema.' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosRecuperacao[email] = {
      codigo,
      expiracao: Date.now() + 10 * 60 * 1000
    };

    await enviarEmailBrevo(email, codigo);
    console.log(`✅ Código enviado via API Brevo para ${email}`);
    res.json({ message: 'Código de verificação enviado com sucesso!' });
  } catch (error) {
    console.error('❌ ERRO NO ENVIO BREVO:', error.message);
    res.status(500).json({ error: 'Erro ao enviar o e-mail. Verifique a chave de API no Render.' });
  }
});

// 2. VALIDAR CÓDIGO
app.post('/api/validar-codigo', (req, res) => {
  const { email, codigo } = req.body;
  const dados = codigosRecuperacao[email];

  if (!dados) {
    return res.status(400).json({ erro: 'Nenhum código solicitado para este e-mail.' });
  }
  if (Date.now() > dados.expiracao) {
    delete codigosRecuperacao[email];
    return res.status(400).json({ erro: 'Código expirado. Solicite um novo.' });
  }
  if (dados.codigo !== codigo.trim()) {
    return res.status(400).json({ erro: 'Código incorreto.' });
  }

  res.json({ success: true, mensagem: 'Código verificado com sucesso!' });
});

// 3. REDEFINIR SENHA NO BANCO DE DADOS
app.post('/api/redefinir-senha', async (req, res) => {
  const { email, novaSenha } = req.body;
  const dados = codigosRecuperacao[email];

  if (!dados) {
    return res.status(400).json({ erro: 'Sessão expirada. Solicite o código novamente.' });
  }

  try {
    await pool.query('UPDATE usuarios SET senha = $1 WHERE usuario = $2', [novaSenha, email]);
    delete codigosRecuperacao[email];
    res.json({ success: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao redefinir a senha no banco.' });
  }
});

// GERENCIAMENTO DE CAIXAS
// CADASTRAR OU ATRIBUIR AS 2 CAIXAS A UM CLIENTE
app.post('/api/caixas', requererAutenticacao, async (req, res) => {
  // Extrai tanto os campos do formulário do Admin quanto os campos antigos de 2 caixas
  const { 
    usuario_id, 
    nome, 
    capacidade, 
    altura_sensor, 
    modelo,
    nome_caixa1, 
    capacidade_caixa1, 
    nome_caixa2, 
    capacidade_caixa2 
  } = req.body;

  try {
    // Trata os valores para garantir que nada vá como nulo/undefined
    const c1_nome = nome_caixa1 || nome || 'Caixa 1';
    const c1_cap = capacidade_caixa1 || capacidade || 1000;
    const c1_altura = altura_sensor || 100;
    const c2_nome = nome_caixa2 || 'Caixa 2';
    const c2_cap = capacidade_caixa2 || 1000;

    await pool.query(
      `INSERT INTO caixas (usuario_id, nome_caixa1, capacidade_caixa1, altura_sensor1, nome_caixa2, capacidade_caixa2) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        usuario_id || null, 
        c1_nome, 
        c1_cap, 
        c1_altura,
        c2_nome, 
        c2_cap
      ]
    );

    res.status(201).json({ success: true, message: 'Caixa cadastrada com sucesso!' });
  } catch (err) {
    console.error('Erro ao cadastrar caixa:', err);
    res.status(500).json({ error: 'Erro ao cadastrar caixas no banco de dados.' });
  }
});

// LISTAR CAIXAS E OS NÍVEIS ATUAIS DAS DUAS CAIXAS
app.get('/api/caixas', requererAutenticacao, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        c.id, 
        c.usuario_id, 
        u.usuario AS cliente_nome,
        c.nome_caixa1,
        c.capacidade_caixa1,
        c.nome_caixa2,
        c.capacidade_caixa2,
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
    console.error('Erro ao buscar caixas:', err);
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
      id: req.session.usuarioId,
      nome: req.session.usuario,
      email: req.session.usuario,
      usuario: req.session.usuario,
      tipo: req.session.tipo 
    });
  } else {
    res.json({ logado: false });
  }
});

// HISTÓRICO E RELATÓRIOS
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
  const { caixa_id, nivel_caixa1, nivel_caixa2 } = req.body;

  if (nivel_caixa1 === undefined || nivel_caixa2 === undefined) {
    return res.status(400).json({ error: 'Níveis da Caixa 1 e Caixa 2 são obrigatórios.' });
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
        c.id,
        c.nome_caixa1,
        c.capacidade_caixa1,
        c.altura_sensor1,
        c.nome_caixa2,
        c.capacidade_caixa2,
        c.altura_sensor2,
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

    // Transforma o registro em uma lista de cartões para o frontend ler sem quebrar
    const caixasParaFrontend = [];

    result.rows.forEach(row => {
      // Caixa 1
      if (row.nome_caixa1) {
        caixasParaFrontend.push({
          id: `${row.id}_1`,
          nome: row.nome_caixa1,
          capacidade: row.capacidade_caixa1,
          nivel: row.nivel_caixa1,
          ultima_leitura: row.ultima_leitura
        });
      }
      // Caixa 2
      if (row.nome_caixa2) {
        caixasParaFrontend.push({
          id: `${row.id}_2`,
          nome: row.nome_caixa2,
          capacidade: row.capacidade_caixa2,
          nivel: row.nivel_caixa2,
          ultima_leitura: row.ultima_leitura
        });
      }
    });

    // RETORNA UM ARRAY (LISTA)
    res.json(caixasParaFrontend);
  } catch (err) {
    console.error('Erro ao buscar minhas caixas:', err);
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