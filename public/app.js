// ============================================================
// Mural Uniodonto — App SPA (vanilla JS, sem build step)
// ============================================================
const API = '';
const state = {
  token: localStorage.getItem('token') || null,
  usuario: JSON.parse(localStorage.getItem('usuario') || 'null'),
  categorias: [],
  posts: [],
  route: location.hash || '#/',
};

const root = document.getElementById('root');

// ---------- Helpers ----------
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function esc(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
}
function fmtDateShort(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
}
function groupKey(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
}
async function api(path, opts={}) {
  const headers = opts.headers || {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
  return data;
}
function logout(){
  state.token = null; state.usuario = null;
  localStorage.removeItem('token'); localStorage.removeItem('usuario');
  location.hash = '#/';
  render();
}
function setRoute(r){ location.hash = r; }
window.addEventListener('hashchange', () => { state.route = location.hash || '#/'; render(); });

const CORES = ['#2563eb','#16a34a','#ca8a04','#9333ea','#dc2626','#0891b2','#db2777','#65a30d','#1F4D44','#E0623F'];

// ============================================================
// CARREGAMENTO DE DADOS
// ============================================================
async function loadCategorias(){
  state.categorias = await api('/api/categorias');
}
async function loadPosts(filtros={}){
  const params = new URLSearchParams();
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.busca) params.set('busca', filtros.busca);
  if (filtros.status) params.set('status', filtros.status);
  state.posts = await api('/api/posts?' + params.toString());
}
function catInfo(id){
  return state.categorias.find(c=>c.id===id) || { nome:id, cor:'#64748b' };
}

// ============================================================
// COMPONENTES — PÚBLICO (TIMELINE)
// ============================================================
function PublicHeader(){
  const logged = !!state.token;
  return `
  <div class="topbar">
    <div class="brand">
      <div class="mark">U</div>
      <div class="name">Mural Uniodonto<small>Comunicação com cooperados</small></div>
    </div>
    <div class="nav-actions">
      ${logged
        ? `<a href="#/admin" class="btn ghost">Painel administrativo</a>`
        : `<a href="#/login" class="btn ghost">Acesso restrito</a>`
      }
    </div>
  </div>`;
}

function FilterBar(filtros){
  const chips = state.categorias.map(c => `
    <button class="chip ${filtros.categoria===c.id?'active':''}" data-cat="${c.id}">
      <span class="dot" style="background:${filtros.categoria===c.id?'#fff':c.cor}"></span>${esc(c.nome)}
    </button>`).join('');
  return `
  <div class="filterbar">
    <button class="chip ${!filtros.categoria?'active':''}" data-cat="">Todos os materiais</button>
    ${chips}
    <div class="search-box">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input id="busca-input" type="text" placeholder="Buscar materiais..." value="${esc(filtros.busca||'')}">
    </div>
  </div>`;
}

function attachIcon(tipo){
  if ((tipo||'').includes('pdf')) return '📄';
  if ((tipo||'').includes('image')) return '🖼️';
  if ((tipo||'').includes('sheet') || (tipo||'').includes('excel')) return '📊';
  if ((tipo||'').includes('word')) return '📝';
  return '📎';
}

function PostCard(post, isAdmin){
  const cat = catInfo(post.categoria);
  const files = (post.arquivos||[]).map(a => `
    <a class="attach" href="${a.url}" target="_blank" rel="noopener">${attachIcon(a.tipo)} ${esc(a.nome)}</a>
  `).join('');
  return `
  <div class="card ${post.destaque?'destaque':''}" data-id="${post.id}">
    <div class="card-top">
      <span class="tag" style="background:${cat.cor}22;color:${cat.cor}">● ${esc(cat.nome)}</span>
      ${isAdmin ? `
      <div class="card-actions">
        <button class="icon-btn" data-edit="${post.id}" title="Editar">✎</button>
        <button class="icon-btn" data-del="${post.id}" title="Excluir">🗑</button>
      </div>` : ''}
    </div>
    <h3>${esc(post.titulo)} ${post.status==='rascunho' ? '<span class="badge-rascunho">Rascunho</span>' : ''}</h3>
    ${post.resumo ? `<p class="resumo">${esc(post.resumo)}</p>` : ''}
    ${post.conteudo ? `<div class="conteudo-full" style="display:none;font-size:14.5px;line-height:1.7;color:var(--ink);margin-bottom:10px;white-space:pre-wrap;">${esc(post.conteudo)}</div>` : ''}
    ${post.conteudo ? `<button class="btn ghost small" data-toggle="${post.id}" style="margin-bottom:6px;">Ler mais</button>` : ''}
    ${files ? `<div class="attach-list">${files}</div>` : ''}
    <div class="card-meta">
      <span>📅 ${fmtDate(post.dataPublicacao || post.criadoEm)}</span>
      <span>✍️ ${esc(post.autorNome||'Equipe Uniodonto')}</span>
    </div>
  </div>`;
}

function Timeline(posts, isAdmin){
  if (posts.length === 0) {
    return `<div class="empty"><div class="mark-big">🗂️</div><p>Nenhum material encontrado para este filtro.</p></div>`;
  }
  const groups = {};
  posts.forEach(p => {
    const key = groupKey(p.dataPublicacao || p.criadoEm);
    groups[key] = groups[key] || [];
    groups[key].push(p);
  });
  return `<div class="timeline">${Object.entries(groups).map(([mes, items]) => `
    <div class="tl-group">
      <div class="tl-date">${esc(mes)}</div>
      ${items.map(p => PostCard(p, isAdmin)).join('')}
    </div>
  `).join('')}</div>`;
}

async function renderPublicTimeline(filtros={}){
  root.innerHTML = `<div class="page fade-in">${PublicHeader()}
    <div class="container">
      <div class="hero">
        <span class="eyebrow">Cooperativa Odontológica</span>
        <h1>Mural de comunicação com os cooperados</h1>
        <p>Acompanhe notícias, comunicados oficiais, materiais financeiros e documentos importantes da cooperativa, organizados por categoria e em ordem cronológica.</p>
      </div>
      <div id="filterbar-slot"></div>
      <div id="timeline-slot">Carregando...</div>
    </div>
  </div>`;

  await loadCategorias();
  await loadPosts(filtros);

  document.getElementById('filterbar-slot').innerHTML = FilterBar(filtros);
  document.getElementById('timeline-slot').innerHTML = Timeline(state.posts, false);

  document.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', () => {
      const novaCat = el.getAttribute('data-cat');
      renderPublicTimeline({ ...filtros, categoria: novaCat || undefined });
    });
  });
  const buscaInput = document.getElementById('busca-input');
  let buscaTimeout;
  buscaInput.addEventListener('input', () => {
    clearTimeout(buscaTimeout);
    buscaTimeout = setTimeout(() => {
      renderPublicTimeline({ ...filtros, busca: buscaInput.value || undefined });
    }, 350);
  });
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      const full = card.querySelector('.conteudo-full');
      const showing = full.style.display !== 'none';
      full.style.display = showing ? 'none' : 'block';
      btn.textContent = showing ? 'Ler mais' : 'Ler menos';
    });
  });
}

// ============================================================
// LOGIN
// ============================================================
function renderLogin(){
  root.innerHTML = `
  <div class="login-screen fade-in">
    <div class="login-card">
      <div class="mark">U</div>
      <h2>Acesso restrito</h2>
      <p class="sub">Entre com suas credenciais de administrador ou editor da cooperativa.</p>
      <div id="login-error"></div>
      <form id="login-form">
        <div class="field"><label>E-mail</label><input type="email" id="login-email" required autocomplete="username"></div>
        <div class="field"><label>Senha</label><input type="password" id="login-senha" required autocomplete="current-password"></div>
        <button class="btn" style="width:100%;justify-content:center;" type="submit" id="login-btn">Entrar</button>
      </form>
      <div class="hint-box">Esqueceu a senha ou precisa de um novo acesso? Contate outro administrador da cooperativa para cadastrar seu usuário no painel.</div>
      <p style="text-align:center;margin-top:18px;"><a href="#/" style="font-size:13px;color:var(--gray);">← Voltar ao mural público</a></p>
    </div>
  </div>`;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;
      const data = await api('/api/login', { method:'POST', body: JSON.stringify({ email, senha }) });
      state.token = data.token; state.usuario = data.usuario;
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      setRoute('#/admin');
    } catch (err) {
      document.getElementById('login-error').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });
}

// ============================================================
// ADMIN — SHELL
// ============================================================
function AdminSidebar(active){
  const links = [
    { id:'timeline', label:'📰 Materiais & Timeline', href:'#/admin' },
    { id:'categorias', label:'🏷️ Categorias', href:'#/admin/categorias' },
    { id:'usuarios', label:'👥 Usuários', href:'#/admin/usuarios' },
    { id:'conta', label:'⚙️ Minha conta', href:'#/admin/conta' },
  ];
  return `
  <div class="sidebar">
    <div class="brand"><div class="mark">U</div><div class="name">Mural Uniodonto<small>Painel admin</small></div></div>
    ${links.map(l => `<a class="side-link ${active===l.id?'active':''}" href="${l.href}">${l.label}</a>`).join('')}
    <a class="side-link" href="#/" target="_self">🌐 Ver mural público</a>
    <div class="sidebar-foot">
      <div class="who">${esc(state.usuario.nome)}</div>
      <div class="role">${state.usuario.role === 'admin' ? 'Administrador' : 'Editor'}</div>
      <button class="btn ghost small" style="margin-top:10px;width:100%;justify-content:center;color:#fff;border-color:rgba(255,255,255,.3);" id="logout-btn">Sair</button>
    </div>
  </div>`;
}

function requireAuth(){
  if (!state.token || !state.usuario) { setRoute('#/login'); return false; }
  return true;
}
function requireAdmin(){
  if (!requireAuth()) return false;
  if (state.usuario.role !== 'admin') {
    alert('Apenas administradores podem acessar esta seção.');
    setRoute('#/admin');
    return false;
  }
  return true;
}

function bindSidebar(){
  document.getElementById('logout-btn')?.addEventListener('click', logout);
}

// ============================================================
// ADMIN — TIMELINE / MATERIAIS (CRUD)
// ============================================================
async function renderAdminTimeline(filtros={}){
  if (!requireAuth()) return;
  root.innerHTML = `
  <div class="admin-shell fade-in">
    ${AdminSidebar('timeline')}
    <div class="admin-main">
      <div class="admin-header">
        <div><h1>Materiais & Timeline</h1><p>Crie notícias, comunicados e documentos para os cooperados. Tudo organizado por categoria e data.</p></div>
        <button class="btn coral" id="novo-post-btn">+ Novo material</button>
      </div>
      <div id="admin-filterbar"></div>
      <div id="admin-timeline-slot">Carregando...</div>
    </div>
  </div>`;
  bindSidebar();

  await loadCategorias();
  await loadPosts(filtros);

  document.getElementById('admin-filterbar').innerHTML = `
    <div class="filterbar">
      ${state.categorias.map(c => `<button class="chip ${filtros.categoria===c.id?'active':''}" data-cat="${c.id}"><span class="dot" style="background:${c.cor}"></span>${esc(c.nome)}</button>`).join('')}
      <button class="chip ${!filtros.categoria?'active':''}" data-cat="">Todas categorias</button>
      <button class="chip ${filtros.status==='publicado'?'active':''}" data-status="publicado">Publicados</button>
      <button class="chip ${filtros.status==='rascunho'?'active':''}" data-status="rascunho">Rascunhos</button>
    </div>`;
  document.getElementById('admin-timeline-slot').innerHTML = Timeline(state.posts, true);

  document.querySelectorAll('[data-cat]').forEach(el => el.addEventListener('click', () => renderAdminTimeline({ ...filtros, categoria: el.getAttribute('data-cat') || undefined })));
  document.querySelectorAll('[data-status]').forEach(el => el.addEventListener('click', () => {
    const s = el.getAttribute('data-status');
    renderAdminTimeline({ ...filtros, status: filtros.status===s ? undefined : s });
  }));
  document.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const card = btn.closest('.card');
    const full = card.querySelector('.conteudo-full');
    const showing = full.style.display !== 'none';
    full.style.display = showing ? 'none' : 'block';
    btn.textContent = showing ? 'Ler mais' : 'Ler menos';
  }));
  document.getElementById('novo-post-btn').addEventListener('click', () => openPostModal());
  document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
    const post = state.posts.find(p => p.id === btn.getAttribute('data-edit'));
    openPostModal(post);
  }));
  document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Excluir este material permanentemente?')) return;
    await api('/api/posts/' + btn.getAttribute('data-del'), { method:'DELETE' });
    renderAdminTimeline(filtros);
  }));
}

let pendingFiles = [];
let removedFiles = [];

function openPostModal(post=null){
  pendingFiles = [];
  removedFiles = [];
  const isEdit = !!post;
  const overlay = h(`<div class="modal-overlay"></div>`);
  overlay.innerHTML = `
  <div class="modal fade-in">
    <h2>${isEdit ? 'Editar material' : 'Novo material'}</h2>
    <p class="sub">${isEdit ? 'Atualize as informações deste item.' : 'Publique uma notícia, comunicado ou documento para os cooperados.'}</p>
    <div id="modal-error"></div>
    <form id="post-form">
      <div class="field"><label>Título</label><input type="text" id="f-titulo" value="${isEdit?esc(post.titulo):''}" required></div>
      <div class="field"><label>Resumo (aparece na listagem)</label><textarea id="f-resumo" rows="2">${isEdit?esc(post.resumo):''}</textarea></div>
      <div class="field"><label>Conteúdo completo</label><textarea id="f-conteudo" rows="6">${isEdit?esc(post.conteudo):''}</textarea></div>
      <div class="row2">
        <div class="field"><label>Categoria</label>
          <select id="f-categoria">${state.categorias.map(c=>`<option value="${c.id}" ${isEdit&&post.categoria===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Data de publicação</label><input type="date" id="f-data" value="${isEdit ? (post.dataPublicacao||post.criadoEm).slice(0,10) : new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="row2">
        <div class="toggle-row"><input type="checkbox" id="f-status" ${!isEdit || post.status==='publicado' ? 'checked' : ''}><label>Publicar agora (desmarque para salvar como rascunho)</label></div>
        <div class="toggle-row"><input type="checkbox" id="f-destaque" ${isEdit&&post.destaque?'checked':''}><label>Marcar como destaque</label></div>
      </div>
      <div class="field">
        <label>Arquivos / materiais (PDF, imagens, planilhas...)</label>
        <div class="file-drop" id="file-drop">Clique para selecionar arquivos ou arraste aqui</div>
        <input type="file" id="f-arquivos" multiple style="display:none;">
        <div class="file-chip-list" id="existing-files">
          ${isEdit ? (post.arquivos||[]).map(a => `<span class="file-chip" data-url="${a.url}">${attachIcon(a.tipo)} ${esc(a.nome)} <button data-remove-existing="${a.url}">×</button></span>`).join('') : ''}
        </div>
        <div class="file-chip-list" id="new-files"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="modal-cancel">Cancelar</button>
        <button type="submit" class="btn coral" id="modal-save">${isEdit ? 'Salvar alterações' : 'Publicar material'}</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const dropZone = overlay.querySelector('#file-drop');
  const fileInput = overlay.querySelector('#f-arquivos');
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    pendingFiles = pendingFiles.concat(Array.from(fileInput.files));
    renderNewFileChips(overlay);
  });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--teal)'; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    pendingFiles = pendingFiles.concat(Array.from(e.dataTransfer.files));
    renderNewFileChips(overlay);
  });
  overlay.querySelectorAll('[data-remove-existing]').forEach(btn => btn.addEventListener('click', () => {
    removedFiles.push(btn.getAttribute('data-remove-existing'));
    btn.closest('.file-chip').remove();
  }));

  overlay.querySelector('#post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = overlay.querySelector('#modal-save');
    saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span>';
    try {
      const fd = new FormData();
      fd.append('titulo', overlay.querySelector('#f-titulo').value);
      fd.append('resumo', overlay.querySelector('#f-resumo').value);
      fd.append('conteudo', overlay.querySelector('#f-conteudo').value);
      fd.append('categoria', overlay.querySelector('#f-categoria').value);
      fd.append('status', overlay.querySelector('#f-status').checked ? 'publicado' : 'rascunho');
      fd.append('destaque', overlay.querySelector('#f-destaque').checked);
      const dataVal = overlay.querySelector('#f-data').value;
      if (dataVal) fd.append('dataPublicacao', new Date(dataVal).toISOString());
      pendingFiles.forEach(f => fd.append('arquivos', f));
      if (isEdit && removedFiles.length) fd.append('arquivosRemover', JSON.stringify(removedFiles));

      if (isEdit) {
        await api('/api/posts/' + post.id, { method:'PUT', body: fd });
      } else {
        await api('/api/posts', { method:'POST', body: fd });
      }
      overlay.remove();
      renderAdminTimeline();
    } catch (err) {
      overlay.querySelector('#modal-error').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Salvar alterações' : 'Publicar material';
    }
  });
}
function renderNewFileChips(overlay){
  overlay.querySelector('#new-files').innerHTML = pendingFiles.map((f,i) => `<span class="file-chip">📎 ${esc(f.name)} <button data-remove-new="${i}">×</button></span>`).join('');
  overlay.querySelectorAll('[data-remove-new]').forEach(btn => btn.addEventListener('click', () => {
    pendingFiles.splice(Number(btn.getAttribute('data-remove-new')), 1);
    renderNewFileChips(overlay);
  }));
}

// ============================================================
// ADMIN — CATEGORIAS
// ============================================================
async function renderAdminCategorias(){
  if (!requireAdmin()) return;
  await loadCategorias();
  root.innerHTML = `
  <div class="admin-shell fade-in">
    ${AdminSidebar('categorias')}
    <div class="admin-main">
      <div class="admin-header">
        <div><h1>Categorias</h1><p>Organize os materiais em categorias temáticas para facilitar a navegação dos cooperados.</p></div>
        <button class="btn coral" id="nova-cat-btn">+ Nova categoria</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Categoria</th><th>Identificador</th><th style="width:80px;"></th></tr></thead>
          <tbody>
            ${state.categorias.map(c => `
              <tr>
                <td><span class="cat-tag-admin"><span class="cat-dot" style="background:${c.cor}"></span>${esc(c.nome)}</span></td>
                <td style="color:var(--gray);font-family:'IBM Plex Mono',monospace;font-size:12px;">${esc(c.id)}</td>
                <td><button class="icon-btn" data-del-cat="${c.id}" title="Excluir">🗑</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  bindSidebar();
  document.getElementById('nova-cat-btn').addEventListener('click', openCategoriaModal);
  document.querySelectorAll('[data-del-cat]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await api('/api/categorias/' + btn.getAttribute('data-del-cat'), { method:'DELETE' });
      renderAdminCategorias();
    } catch (err) { alert(err.message); }
  }));
}

function openCategoriaModal(){
  let corSelecionada = CORES[0];
  const overlay = h(`<div class="modal-overlay"></div>`);
  overlay.innerHTML = `
  <div class="modal fade-in">
    <h2>Nova categoria</h2>
    <p class="sub">Categorias ajudam os cooperados a encontrar o que procuram rapidamente.</p>
    <div id="modal-error"></div>
    <form id="cat-form">
      <div class="field"><label>Nome da categoria</label><input type="text" id="f-cat-nome" placeholder="Ex: Assembleias, Capacitação..." required></div>
      <div class="field"><label>Cor de identificação</label>
        <div class="color-swatches" id="color-swatches">
          ${CORES.map((c,i) => `<div class="swatch ${i===0?'selected':''}" style="background:${c}" data-color="${c}"></div>`).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="cat-cancel">Cancelar</button>
        <button type="submit" class="btn coral">Criar categoria</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cat-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll('.swatch').forEach(sw => sw.addEventListener('click', () => {
    overlay.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
    corSelecionada = sw.getAttribute('data-color');
  }));
  overlay.querySelector('#cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/categorias', { method:'POST', body: JSON.stringify({ nome: overlay.querySelector('#f-cat-nome').value, cor: corSelecionada }) });
      overlay.remove();
      renderAdminCategorias();
    } catch (err) {
      overlay.querySelector('#modal-error').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
    }
  });
}

// ============================================================
// ADMIN — USUÁRIOS
// ============================================================
async function renderAdminUsuarios(){
  if (!requireAdmin()) return;
  const usuarios = await api('/api/usuarios');
  root.innerHTML = `
  <div class="admin-shell fade-in">
    ${AdminSidebar('usuarios')}
    <div class="admin-main">
      <div class="admin-header">
        <div><h1>Usuários do painel</h1><p>Gerencie quem pode publicar materiais para os cooperados.</p></div>
        <button class="btn coral" id="novo-user-btn">+ Novo usuário</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th style="width:80px;"></th></tr></thead>
          <tbody>
            ${usuarios.map(u => `
              <tr>
                <td>${esc(u.nome)}</td>
                <td>${esc(u.email)}</td>
                <td><span class="status-pill ${u.role==='admin'?'publicado':'rascunho'}">${u.role==='admin'?'Administrador':'Editor'}</span></td>
                <td>${u.id !== state.usuario.id ? `<button class="icon-btn" data-del-user="${u.id}" title="Remover">🗑</button>` : '<span style="color:var(--gray);font-size:12px;">você</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  bindSidebar();
  document.getElementById('novo-user-btn').addEventListener('click', openUsuarioModal);
  document.querySelectorAll('[data-del-user]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Remover este usuário?')) return;
    await api('/api/usuarios/' + btn.getAttribute('data-del-user'), { method:'DELETE' });
    renderAdminUsuarios();
  }));
}

function openUsuarioModal(){
  const overlay = h(`<div class="modal-overlay"></div>`);
  overlay.innerHTML = `
  <div class="modal fade-in">
    <h2>Novo usuário</h2>
    <p class="sub">Editores podem criar e editar materiais. Administradores também gerenciam categorias e usuários.</p>
    <div id="modal-error"></div>
    <form id="user-form">
      <div class="field"><label>Nome</label><input type="text" id="f-user-nome" required></div>
      <div class="field"><label>E-mail</label><input type="email" id="f-user-email" required></div>
      <div class="field"><label>Senha provisória</label><input type="text" id="f-user-senha" required minlength="6"></div>
      <div class="field"><label>Função</label>
        <select id="f-user-role"><option value="editor">Editor</option><option value="admin">Administrador</option></select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="user-cancel">Cancelar</button>
        <button type="submit" class="btn coral">Criar usuário</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#user-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/usuarios', { method:'POST', body: JSON.stringify({
        nome: overlay.querySelector('#f-user-nome').value,
        email: overlay.querySelector('#f-user-email').value,
        senha: overlay.querySelector('#f-user-senha').value,
        role: overlay.querySelector('#f-user-role').value,
      })});
      overlay.remove();
      renderAdminUsuarios();
    } catch (err) {
      overlay.querySelector('#modal-error').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
    }
  });
}

// ============================================================
// ADMIN — MINHA CONTA
// ============================================================
function renderAdminConta(){
  if (!requireAuth()) return;
  root.innerHTML = `
  <div class="admin-shell fade-in">
    ${AdminSidebar('conta')}
    <div class="admin-main" style="max-width:480px;">
      <div class="admin-header"><div><h1>Minha conta</h1><p>Troque sua senha de acesso ao painel.</p></div></div>
      <div id="conta-msg"></div>
      <form id="senha-form">
        <div class="field"><label>Senha atual</label><input type="password" id="f-senha-atual" required></div>
        <div class="field"><label>Nova senha</label><input type="password" id="f-senha-nova" required minlength="6"></div>
        <button class="btn coral" type="submit">Atualizar senha</button>
      </form>
    </div>
  </div>`;
  bindSidebar();
  document.getElementById('senha-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/trocar-senha', { method:'POST', body: JSON.stringify({
        senhaAtual: document.getElementById('f-senha-atual').value,
        novaSenha: document.getElementById('f-senha-nova').value,
      })});
      document.getElementById('conta-msg').innerHTML = `<div class="success-msg">Senha atualizada com sucesso.</div>`;
      document.getElementById('senha-form').reset();
    } catch (err) {
      document.getElementById('conta-msg').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
    }
  });
}

// ============================================================
// ROUTER
// ============================================================
function render(){
  const r = state.route;
  if (r === '#/' || r === '') return renderPublicTimeline();
  if (r === '#/login') return renderLogin();
  if (r === '#/admin') return renderAdminTimeline();
  if (r === '#/admin/categorias') return renderAdminCategorias();
  if (r === '#/admin/usuarios') return renderAdminUsuarios();
  if (r === '#/admin/conta') return renderAdminConta();
  return renderPublicTimeline();
}

render();
