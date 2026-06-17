const FileSync = require('lowdb/adapters/FileSync');
const low = require('lowdb');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'db.json'));
const db = low(adapter);

// Estrutura inicial do banco
db.defaults({
  users: [],
  posts: [],
  categories: [
    { id: 'comunicados', nome: 'Comunicados', cor: '#2563eb' },
    { id: 'noticias', nome: 'Notícias', cor: '#16a34a' },
    { id: 'financeiro', nome: 'Financeiro', cor: '#ca8a04' },
    { id: 'eventos', nome: 'Eventos', cor: '#9333ea' },
    { id: 'documentos', nome: 'Documentos', cor: '#dc2626' },
  ]
}).write();

// Cria usuário admin padrão se não existir nenhum usuário
function ensureAdmin() {
  const users = db.get('users').value();
  if (users.length === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@uniodonto.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    db.get('users').push({
      id: 'admin-1',
      nome: 'Administrador',
      email,
      senha: hash,
      role: 'admin',
      criadoEm: new Date().toISOString()
    }).write();
    console.log('==============================================');
    console.log('Usuário admin criado automaticamente:');
    console.log('Email: ' + email);
    console.log('Senha: ' + password);
    console.log('IMPORTANTE: troque essa senha após o primeiro login!');
    console.log('==============================================');
  }
}

module.exports = { db, ensureAdmin };
