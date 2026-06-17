const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'chave_padrao_insegura_troque_no_env';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nome: user.nome },
    SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token não fornecido.' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  }
  next();
}

module.exports = { generateToken, authMiddleware, adminOnly, SECRET };
