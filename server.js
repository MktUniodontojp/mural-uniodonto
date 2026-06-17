require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, ensureAdmin } = require('./db');
const { generateToken, authMiddleware, adminOnly } = require('./auth');

ensureAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(process.env.DATA_DIR || __dirname, 'uploads')));

// ---------- Configuração de upload de arquivos ----------
const dataDir = process.env.DATA_DIR || __dirname;
const uploadDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// =====================================================
// AUTENTICAÇÃO
// =====================================================

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios.' });

  const user = db.get('users').find({ email }).value();
  if (!user) return res.status(401).json({ erro: 'Credenciais inválidas.' });

  const ok = bcrypt.compareSync(senha, user.senha);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

  const token = generateToken(user);
  res.json({ token, usuario: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ usuario: req.user });
});

app.post('/api/trocar-senha', authMiddleware, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (!bcrypt.compareSync(senhaAtual, user.senha)) {
    return res.status(401).json({ erro: 'Senha atual incorreta.' });
  }
  const hash = bcrypt.hashSync(novaSenha, 10);
  db.get('users').find({ id: req.user.id }).assign({ senha: hash }).write();
  res.json({ ok: true });
});

// Admin pode criar outros usuários administradores (gestão de equipe)
app.post('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
  const { nome, email, senha, role } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Dados incompletos.' });
  if (db.get('users').find({ email }).value()) {
    return res.status(409).json({ erro: 'Email já cadastrado.' });
  }
  const novo = {
    id: uuidv4(),
    nome,
    email,
    senha: bcrypt.hashSync(senha, 10),
    role: role === 'admin' ? 'admin' : 'editor',
    criadoEm: new Date().toISOString()
  };
  db.get('users').push(novo).write();
  res.json({ ok: true, usuario: { id: novo.id, nome: novo.nome, email: novo.email, role: novo.role } });
});

app.get('/api/usuarios', authMiddleware, adminOnly, (req, res) => {
  const users = db.get('users').value().map(u => ({ id: u.id, nome: u.nome, email: u.email, role: u.role, criadoEm: u.criadoEm }));
  res.json(users);
});

app.delete('/api/usuarios/:id', authMiddleware, adminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ erro: 'Não é possível remover o próprio usuário logado.' });
  db.get('users').remove({ id: req.params.id }).write();
  res.json({ ok: true });
});

// =====================================================
// CATEGORIAS
// =====================================================

app.get('/api/categorias', (req, res) => {
  res.json(db.get('categories').value());
});

app.post('/api/categorias', authMiddleware, adminOnly, (req, res) => {
  const { nome, cor } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório.' });
  const id = nome.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (db.get('categories').find({ id }).value()) {
    return res.status(409).json({ erro: 'Categoria já existe.' });
  }
  const categoria = { id, nome, cor: cor || '#64748b' };
  db.get('categories').push(categoria).write();
  res.json(categoria);
});

app.delete('/api/categorias/:id', authMiddleware, adminOnly, (req, res) => {
  const emUso = db.get('posts').find({ categoria: req.params.id }).value();
  if (emUso) return res.status(400).json({ erro: 'Existem materiais usando esta categoria. Remova ou mude a categoria deles antes.' });
  db.get('categories').remove({ id: req.params.id }).write();
  res.json({ ok: true });
});

// =====================================================
// POSTS / MATERIAIS / NOTÍCIAS (timeline)
// =====================================================

// Lista pública (para os cooperados verem) - filtros opcionais: categoria, busca, status
app.get('/api/posts', (req, res) => {
  const { categoria, busca, status } = req.query;
  let posts = db.get('posts').value();

  // Público só vê publicados
  const isAuth = req.headers.authorization;
  if (!isAuth) {
    posts = posts.filter(p => p.status === 'publicado');
  } else if (status) {
    posts = posts.filter(p => p.status === status);
  }

  if (categoria) posts = posts.filter(p => p.categoria === categoria);
  if (busca) {
    const b = busca.toLowerCase();
    posts = posts.filter(p =>
      p.titulo.toLowerCase().includes(b) ||
      (p.resumo || '').toLowerCase().includes(b) ||
      (p.conteudo || '').toLowerCase().includes(b)
    );
  }

  posts = posts.sort((a, b) => new Date(b.dataPublicacao || b.criadoEm) - new Date(a.dataPublicacao || a.criadoEm));
  res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
  const post = db.get('posts').find({ id: req.params.id }).value();
  if (!post) return res.status(404).json({ erro: 'Não encontrado.' });
  if (post.status !== 'publicado' && !req.headers.authorization) {
    return res.status(404).json({ erro: 'Não encontrado.' });
  }
  res.json(post);
});

app.post('/api/posts', authMiddleware, upload.array('arquivos', 10), (req, res) => {
  const { titulo, resumo, conteudo, categoria, status, destaque, dataPublicacao } = req.body;
  if (!titulo || !categoria) return res.status(400).json({ erro: 'Título e categoria são obrigatórios.' });

  const arquivos = (req.files || []).map(f => ({
    nome: f.originalname,
    url: '/uploads/' + f.filename,
    tipo: f.mimetype
  }));

  const post = {
    id: uuidv4(),
    titulo,
    resumo: resumo || '',
    conteudo: conteudo || '',
    categoria,
    status: status === 'rascunho' ? 'rascunho' : 'publicado',
    destaque: destaque === 'true' || destaque === true,
    arquivos,
    autorId: req.user.id,
    autorNome: req.user.nome,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    dataPublicacao: dataPublicacao || new Date().toISOString()
  };
  db.get('posts').push(post).write();
  res.json(post);
});

app.put('/api/posts/:id', authMiddleware, upload.array('arquivos', 10), (req, res) => {
  const post = db.get('posts').find({ id: req.params.id }).value();
  if (!post) return res.status(404).json({ erro: 'Não encontrado.' });

  const { titulo, resumo, conteudo, categoria, status, destaque, dataPublicacao, arquivosRemover } = req.body;

  let arquivos = post.arquivos || [];
  if (arquivosRemover) {
    const remover = JSON.parse(arquivosRemover);
    arquivos = arquivos.filter(a => !remover.includes(a.url));
    remover.forEach(url => {
      const fp = path.join(dataDir, 'uploads', path.basename(url));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
  }
  const novos = (req.files || []).map(f => ({
    nome: f.originalname,
    url: '/uploads/' + f.filename,
    tipo: f.mimetype
  }));
  arquivos = arquivos.concat(novos);

  const atualizado = {
    ...post,
    titulo: titulo ?? post.titulo,
    resumo: resumo ?? post.resumo,
    conteudo: conteudo ?? post.conteudo,
    categoria: categoria ?? post.categoria,
    status: status ?? post.status,
    destaque: destaque !== undefined ? (destaque === 'true' || destaque === true) : post.destaque,
    dataPublicacao: dataPublicacao ?? post.dataPublicacao,
    arquivos,
    atualizadoEm: new Date().toISOString()
  };
  db.get('posts').find({ id: req.params.id }).assign(atualizado).write();
  res.json(atualizado);
});

app.delete('/api/posts/:id', authMiddleware, (req, res) => {
  const post = db.get('posts').find({ id: req.params.id }).value();
  if (!post) return res.status(404).json({ erro: 'Não encontrado.' });
  (post.arquivos || []).forEach(a => {
    const fp = path.join(dataDir, 'uploads', path.basename(a.url));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  db.get('posts').remove({ id: req.params.id }).write();
  res.json({ ok: true });
});

// =====================================================
// SPA fallback
// =====================================================
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ erro: 'Rota não encontrada.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
