// Screens. Every dynamic string goes through esc(): typed text is never interpreted as HTML.
import * as R from './rules.js';
import * as S from './store.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = R.formatBrl;
const local = (t, opts = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) => (t ? new Date(t).toLocaleString('pt-BR', opts).replace(',', '') : '—');
const inputLocal = (t) => { if (!t) return ''; const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const ago = (t) => { const m = R.minutesBetween(t, S.now()); return m < 1 ? 'agora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`; };
const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;
const empty = (text) => `<div class="empty">${esc(text)}</div>`;
const num = (cents) => (cents ? (cents / 100).toFixed(2).replace('.', ',') : '');

const ICONS = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', funnel: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>', car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 16v2M17 16v2"/><circle cx="8" cy="13" r=".8"/><circle cx="16" cy="13" r=".8"/>',
  doc: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

export function shell(path, inner, ui) {
  const u = S.me(), owner = S.isOwner();
  const link = (href, ic, label, on) => `<a href="#${href}" ${on ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`;
  const p = path;
  return `<div class="shell">
  <header class="topbar no-print"><a class="brand" href="#/"><span class="brand-mark" aria-hidden="true">P</span><span>Pátio</span></a>
    <div class="who"><div>${esc(S.state.store.name)}</div>
      <label class="role-pick">Ver como <select data-change="role" aria-label="Ver como">${S.state.users.map((x) => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${esc(x.name)} · ${x.role === 'OWNER' ? 'Dono' : 'Vendedor'}</option>`).join('')}</select></label></div></header>
  <nav class="nav no-print" aria-label="Principal">
    ${link('/', 'today', 'Hoje', p === '/')}${link('/leads', 'funnel', 'Funil', p === '/leads' || p.startsWith('/lead/'))}${link('/propostas', 'tag', 'Propostas', p === '/propostas')}
    ${link('/estoque', 'car', 'Estoque', p === '/estoque')}${link('/vendas', 'doc', 'Vendas', p === '/vendas' || p.startsWith('/contrato'))}${owner ? link('/ajustes', 'gear', 'Ajustes', p === '/ajustes' || p.startsWith('/modelo')) : ''}
  </nav>
  <main class="content" id="main">
    <div class="demo-banner no-print"><strong>Demonstração clicável.</strong> Tudo roda neste navegador, com dados fictícios. Troque o perfil em “Ver como” para ver o que cada um enxerga.
      <a href="#/portal">Abrir simulador de portal</a> · <button class="link-btn" data-click="reset" type="button">Reiniciar demonstração</button></div>
    ${ui.ok ? `<div class="flash ok" role="status">${esc(ui.ok)}</div>` : ''}${ui.err ? `<div class="flash err" role="alert">${esc(ui.err)}</div>` : ''}
    ${inner}
  </main></div>`;
}

function leadItem(row, mode) {
  const l = row.lead, car = S.vehicle(l.vehicleId), owner = S.user(l.ownerId);
  const level = mode === 'wait' ? (row.breached ? 'late' : 'today') : (row.urgency === 'late' ? 'late' : row.urgency === 'today' ? 'today' : 'ok');
  const meta = mode === 'wait' ? chip(row.breached ? 'late' : 'today', `${ago(l.createdAt)} sem resposta`)
    : mode === 'due' ? chip(level, row.urgency === 'late' ? 'Atrasado' : 'Hoje') : mode === 'stale' ? chip('', `Parado há ${ago(l.lastActivityAt)}`)
    : chip(level !== 'ok' ? level : '', owner ? owner.name.split(' ')[0] : 'Sem dono');
  return `<a class="item ${level}" href="#/lead/${l.id}"><span class="bar"></span><span><span class="t">${esc(l.name)}</span>
    <span class="s">${esc(R.formatPhone(l.phone))} · ${esc(R.SOURCE_LABELS[l.source])}${car ? ' · ' + esc(S.vehicleTitle(car)) : ''}</span>
    ${l.nextActionAt ? `<span class="s">Retorno: ${local(l.nextActionAt)}${l.nextActionNote ? ' — ' + esc(l.nextActionNote) : ''}</span>` : ''}</span><span class="meta">${meta}</span></a>`;
}
const list = (rows, mode, none) => `<div class="list">${rows.length ? rows.map((r) => leadItem(r, mode)).join('') : empty(none)}</div>`;

export function today() {
  const t = S.today(), k = S.kpis(), owner = S.isOwner(), pend = S.pendingProposals();
  return `<div class="page-head"><div><h1>Hoje</h1><p class="muted small">${owner ? 'Toda a loja' : 'Seus leads'} · ${t.openCount} lead${t.openCount === 1 ? '' : 's'} em aberto · prazo de resposta: ${S.state.store.slaMinutes} min</p></div><a class="btn primary" href="#/leads/novo">Novo lead</a></div>
  ${owner ? `<div class="kpis"><div class="kpi ${t.unanswered.length ? 'alert' : ''}"><div class="v">${t.unanswered.length}</div><div class="l">sem resposta agora</div></div>
    <div class="kpi"><div class="v">${k.avgMin !== null ? k.avgMin + ' min' : '—'}</div><div class="l">tempo médio da 1ª resposta (7 dias)</div></div>
    <div class="kpi"><div class="v">${k.withinSla !== null ? k.withinSla + '%' : '—'}</div><div class="l">respondidos dentro do prazo (7 dias)</div></div>
    <div class="kpi"><div class="v">${k.sales30}</div><div class="l"><a href="#/vendas">vendas em 30 dias</a> · margem ${brl(k.margin30)}</div></div></div>` : ''}
  ${owner && pend.length ? `<section class="section"><h2>Aprovações pendentes <span class="count">${pend.length}</span></h2><div class="list">${pend.map((p) => {
    const l = S.lead(p.leadId);
    return `<a class="item today" href="#/propostas"><span class="bar"></span><span><span class="t">${esc(l.name)} · ${esc(S.vehicleTitle(S.vehicle(p.vehicleId)))}</span><span class="s">Pedido de ${brl(p.offered)} (anunciado ${brl(p.asking)})</span></span><span class="meta">${chip('today', 'Decidir')}</span></a>`;
  }).join('')}</div></section>` : ''}
  <section class="section"><h2>Sem resposta <span class="count">${t.unanswered.length}</span></h2>${list(t.unanswered, 'wait', 'Nenhum lead esperando a primeira resposta. 🎯')}</section>
  <section class="section"><h2>Retornos de hoje e atrasados <span class="count">${t.due.length}</span></h2>${list(t.due, 'due', 'Nenhum retorno marcado para hoje.')}</section>
  <section class="section"><h2>Parados <span class="count">${t.stale.length}</span></h2><p class="muted small">Respondidos, mas sem nenhuma atividade há 3 dias ou mais.</p>${list(t.stale, 'stale', 'Nenhum lead parado.')}</section>`;
}

export function funnel(q) {
  const rows = S.openLeads({ owner: q.get('owner'), source: R.SOURCES.includes(q.get('source')) ? q.get('source') : null });
  const by = Object.fromEntries(R.OPEN_STAGES.map((s) => [s, rows.filter((r) => r.lead.stage === s)]));
  const active = R.OPEN_STAGES.includes(q.get('stage')) ? q.get('stage') : 'NOVO';
  const keep = (extra) => { const p = new URLSearchParams(); if (q.get('owner')) p.set('owner', q.get('owner')); if (q.get('source')) p.set('source', q.get('source')); Object.entries(extra).forEach(([k, v]) => p.set(k, v)); return p.toString(); };
  return `<div class="page-head"><div><h1>Funil</h1><p class="muted small">${rows.length} lead${rows.length === 1 ? '' : 's'} em aberto</p></div><div class="actions"><a class="btn" href="#/vendas">Vendas</a><a class="btn primary" href="#/leads/novo">Novo lead</a></div></div>
  <form class="filters row" data-action="filter"><div><label for="owner">Responsável</label><select id="owner" name="owner"><option value="">Todos</option>${S.state.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${q.get('owner') == u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
    <div><label for="source">Origem</label><select id="source" name="source"><option value="">Todas</option>${R.SOURCES.map((s) => `<option value="${s}" ${q.get('source') === s ? 'selected' : ''}>${R.SOURCE_LABELS[s]}</option>`).join('')}</select></div>
    <input type="hidden" name="stage" value="${active}"><div><button class="btn" type="submit">Filtrar</button></div></form>
  <nav class="tabs" aria-label="Etapas">${R.OPEN_STAGES.map((s) => `<a href="#/leads?${keep({ stage: s })}" ${s === active ? 'aria-current="true"' : ''}>${R.STAGE_LABELS[s]} <span class="count">${by[s].length}</span></a>`).join('')}</nav>
  <div class="board">${R.OPEN_STAGES.map((s) => `<section class="col ${s === active ? 'is-active' : ''}" aria-label="${R.STAGE_LABELS[s]}"><h2>${R.STAGE_LABELS[s]} <span class="count">${by[s].length}</span></h2>${list(by[s], 'owner', 'Vazio')}</section>`).join('')}</div>`;
}

export function newLead() {
  return `<div class="page-head"><h1>Novo lead</h1><a class="btn small" href="#/leads">← Funil</a></div>
  <form class="card" data-action="createLead"><label for="name">Nome</label><input id="name" name="name" maxlength="120" autocomplete="off">
    <label for="phone">Telefone (com DDD)</label><input id="phone" name="phone" type="tel" inputmode="tel" placeholder="(11) 98765-4321" required>
    <label for="source">Origem</label><select id="source" name="source">${R.SOURCES.map((s) => `<option value="${s}" ${s === 'LOJA' ? 'selected' : ''}>${R.SOURCE_LABELS[s]}</option>`).join('')}</select>
    <label for="vehicleId">Veículo de interesse</label><select id="vehicleId" name="vehicleId"><option value="">Nenhum</option>${S.state.vehicles.filter((v) => v.status !== 'VENDIDO').map((v) => `<option value="${v.id}">${esc(S.vehicleTitle(v))} · ${brl(v.price)}</option>`).join('')}</select>
    <label for="message">O que o cliente disse (opcional)</label><textarea id="message" name="message" maxlength="2000"></textarea>
    <p class="muted small">Se já existir um lead aberto com este telefone, a mensagem é adicionada a ele, sem criar duplicado.</p>
    <div class="actions"><button class="btn primary" type="submit">Criar lead</button></div></form>`;
}

export function leadDetail(id) {
  const l = S.lead(id);
  if (!l) return `<div class="empty">Lead não encontrado.</div>`;
  const car = S.vehicle(l.vehicleId), owner = S.isOwner(), closed = ['VENDIDO', 'PERDIDO'].includes(l.stage), sale = S.saleOf(l.id);
  const msgs = S.state.messages.filter((m) => m.leadId === l.id);
  const props = S.state.proposals.filter((p) => p.leadId === l.id).sort((a, b) => b.version - a.version);
  const order = ['NOVO', 'CONTATO', 'VISITA', 'PROPOSTA', 'VENDIDO'], idx = order.indexOf(l.stage);
  const floor = car ? R.lowestPriceWithoutApproval(car.price, S.state.store.authorityBps) : null;
  const cars = S.state.vehicles.filter((v) => v.status !== 'VENDIDO' || v.id === l.vehicleId);
  const pLabel = { APROVADA: 'Aprovada', PENDENTE: 'Aguardando dono', RECUSADA: 'Recusada' };
  const pCls = (p) => (p.status === 'APROVADA' ? 'ok' : p.status === 'PENDENTE' ? 'today' : 'late');
  const contracts = sale && S.canSeeSale(sale) ? S.state.contracts.filter((c) => c.saleId === sale.id).sort((a, b) => b.version - a.version) : [];
  return `<div class="page-head"><div><h1>${esc(l.name)}</h1><p class="muted small">${esc(R.formatPhone(l.phone))} · ${esc(R.SOURCE_LABELS[l.source])} · criado ${local(l.createdAt)}</p></div><a class="btn small" href="#/leads">← Funil</a></div>
  <div class="detail"><div class="stack">
  <section class="card" aria-label="Etapa"><div class="pipeline">${order.map((s, i) => `<span class="step ${s === l.stage ? 'current' : idx > i ? 'done' : ''}">${R.STAGE_LABELS[s]}</span>`).join('')}</div>
    ${l.stage === 'PERDIDO' ? `<p class="chip late">Perdido: ${esc(l.lostReason)}</p>` : ''}
    ${closed ? '' : `<form data-action="stage" data-id="${l.id}"><div class="row"><div><label for="stage-select">Mover para</label><select id="stage-select" name="stage">${R.STAGES.filter((s) => s !== l.stage).map((s) => `<option value="${s}">${R.STAGE_LABELS[s]}</option>`).join('')}</select></div>
      <div data-for-stage="PERDIDO"><label for="lost_reason">Motivo da perda</label><input id="lost_reason" name="lostReason" maxlength="200" placeholder="Ex.: comprou em outra loja"></div>
      <div data-for-stage="VENDIDO"><label for="price">Preço final (R$)</label><input id="price" name="price" inputmode="decimal" placeholder="45.900,00"></div>
      <div><button class="btn primary" type="submit">Mover</button></div></div><p class="muted small">Vendido exige veículo vinculado e preço final; perdido exige o motivo.</p></form>`}</section>
  ${l.stage === 'VENDIDO' && sale && S.canSeeSale(sale) ? `<section class="card" aria-label="Contrato"><h2>Contrato</h2><p class="muted small">Venda registrada por ${brl(sale.price)}. Gere o contrato a partir de um dos modelos da loja.</p>
    ${contracts.map((c) => `<a class="item ok" href="#/contrato/${c.id}"><span class="bar"></span><span><span class="t">Versão ${c.version} · ${esc(c.templateName)}</span><span class="s">${esc(c.buyerName)} · ${local(c.at)}</span></span><span class="meta">${chip('', 'Abrir')}</span></a>`).join('')}
    <div class="actions"><a class="btn primary" href="#/lead/${l.id}/contrato">${contracts.length ? 'Gerar nova versão' : 'Gerar contrato'}</a></div></section>` : ''}
  <section class="card" aria-label="Proposta"><h2>Proposta e desconto</h2>
    ${car ? `<p>${esc(S.vehicleTitle(car))} · anunciado <strong class="num">${brl(car.price)}</strong></p>${owner ? '' : `<p class="muted small">Você fecha sozinho até ${(S.state.store.authorityBps / 100).toFixed(1)}% de desconto (a partir de <strong class="num">${brl(floor)}</strong>). Abaixo disso, o pedido de menor preço vai para o dono aprovar.</p>`}` : `<p class="muted">Vincule o veículo de interesse (em “Detalhes”) para fazer uma proposta.</p>`}
    <div class="list">${props.length ? props.map((p) => `<div class="item ${pCls(p)}"><span class="bar"></span><span><span class="t">v${p.version} · ${brl(p.offered)} <span class="small muted">(${R.discountPct(p.asking, p.offered).toFixed(1)}% de desconto)</span></span>
      <span class="s">${p.down ? 'Entrada ' + brl(p.down) : ''}${p.trade ? ' · troca ' + brl(p.trade) + (p.tradeNote ? ' (' + esc(p.tradeNote) + ')' : '') : ''}${p.note ? ' · ' + esc(p.note) : ''}</span>
      ${p.status === 'APROVADA' && p.approvedPrice !== p.offered ? `<span class="s">Aprovada por <strong>${brl(p.approvedPrice)}</strong></span>` : ''}${p.decisionNote ? `<span class="s">${esc(p.decisionNote)}</span>` : ''}
      ${owner && car ? `<span class="s">Margem na oferta: ${brl(p.offered - car.cost)}</span>` : ''}</span><span class="meta">${chip(pCls(p), pLabel[p.status])}</span></div>`).join('') : empty('Nenhuma proposta ainda.')}</div>
    ${car && !closed ? `<form data-action="proposal" data-id="${l.id}"><div class="row"><div><label for="offered">Valor oferecido (R$)</label><input id="offered" name="offered" inputmode="decimal" required data-floor="${floor}" data-owner="${owner ? 1 : 0}" placeholder="${Math.round(car.price / 100)}"></div>
      <div><label for="down">Entrada (R$)</label><input id="down" name="down" inputmode="decimal"></div><div><label for="trade">Carro na troca (R$)</label><input id="trade" name="trade" inputmode="decimal"></div></div>
      <label for="tradeNote">Carro na troca (descrição)</label><input id="tradeNote" name="tradeNote" maxlength="200" placeholder="Ex.: Gol 2015 branco, 98 mil km">
      <label for="pnote">Observação / justificativa</label><input id="pnote" name="note" maxlength="400" placeholder="Ex.: cliente tem proposta de outra loja"><p id="offer-hint" class="small" hidden></p>
      <div class="actions"><button class="btn primary" type="submit">${owner ? 'Registrar proposta' : 'Enviar proposta / pedir menor preço'}</button></div></form>` : ''}</section>
  <section class="card" aria-label="Conversa"><h2>Conversa</h2><div class="chat">${msgs.length ? msgs.map((m) => `<div class="msg ${m.direction === 'OUT' ? 'out' : m.direction === 'NOTE' ? 'note' : ''}">${esc(m.body)}<span class="when">${local(m.at)} · ${m.direction === 'IN' ? 'Cliente' : m.direction === 'NOTE' ? 'Nota' : 'Você'}${m.status === 'SIMULADO' ? ' · envio simulado' : ''}</span></div>`).join('') : empty('Sem mensagens ainda.')}</div>
    ${closed ? '' : `<form data-action="message" data-id="${l.id}"><div class="tpl" aria-label="Modelos de mensagem">${Object.keys(R.TEMPLATES).map((k) => `<button class="btn small" type="button" data-template="${esc(R.renderMessageTemplate(k, l.name, car ? S.vehicleTitle(car) : null))}">${R.TEMPLATE_LABELS[k]}</button>`).join('')}</div>
      <label for="message-body">Mensagem</label><textarea id="message-body" name="body" maxlength="2000" required></textarea>
      <p class="muted small">Nesta demonstração o WhatsApp não é real: a mensagem é registrada no histórico como <strong>simulada</strong>.</p><div class="actions"><button class="btn primary" type="submit">Registrar resposta</button></div></form>
      <form data-action="note" data-id="${l.id}"><label for="note-body">Anotação interna</label><input id="note-body" name="body" maxlength="2000" placeholder="Ex.: cliente quer ver o carro no sábado"><div class="actions"><button class="btn small" type="submit">Salvar anotação</button></div></form>`}</section></div>
  <div class="stack"><section class="card" aria-label="Próxima ação"><h2>Próxima ação</h2>
    ${l.nextActionAt ? `<p>${chip(l.nextActionAt <= S.now() ? 'late' : 'today', local(l.nextActionAt))} ${esc(l.nextActionNote)}</p>` : '<p class="muted">Nenhuma marcada. Todo lead aberto deve ter uma.</p>'}
    ${closed ? '' : `<form data-action="nextAction" data-id="${l.id}"><label for="when">Quando</label><input id="when" name="when" type="datetime-local" value="${inputLocal(l.nextActionAt)}"><label for="nnote">O que fazer</label><input id="nnote" name="note" maxlength="200" value="${esc(l.nextActionNote)}" placeholder="Ligar, confirmar visita…"><div class="actions"><button class="btn small" type="submit">Salvar</button></div><p class="muted small">Deixe a data em branco para remover.</p></form>`}</section>
  <section class="card" aria-label="Detalhes"><h2>Detalhes</h2>
    <form data-action="vehicle" data-id="${l.id}"><label for="vehicleId">Veículo de interesse</label><select id="vehicleId" name="vehicleId" ${closed ? 'disabled' : ''}><option value="">Nenhum</option>${cars.map((v) => `<option value="${v.id}" ${l.vehicleId === v.id ? 'selected' : ''}>${esc(S.vehicleTitle(v))} · ${brl(v.price)}</option>`).join('')}</select>${closed ? '' : '<div class="actions"><button class="btn small" type="submit">Vincular</button></div>'}</form>
    <form data-action="assign" data-id="${l.id}"><label for="ownerId">Responsável</label><select id="ownerId" name="ownerId" ${closed ? 'disabled' : ''}>${S.state.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${l.ownerId === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>${closed ? '' : '<div class="actions"><button class="btn small" type="submit">Alterar</button></div>'}</form>
    <p class="muted small">Primeira resposta: ${l.firstResponseAt ? 'após ' + R.minutesBetween(l.createdAt, l.firstResponseAt) + ' min' : '<strong>ainda sem resposta</strong>'}</p></section></div></div>`;
}

export function proposals() {
  const owner = S.isOwner(), mine = (p) => owner || p.requestedBy === S.me().id;
  const pending = S.state.proposals.filter((p) => p.status === 'PENDENTE' && mine(p)), history = S.state.proposals.filter((p) => p.status !== 'PENDENTE' && mine(p)).sort((a, b) => b.at - a.at).slice(0, 30);
  return `<div class="page-head"><div><h1>Propostas</h1><p class="muted small">${owner ? 'Pedidos de menor preço aguardando você e histórico.' : 'Seus pedidos de menor preço e o histórico.'}</p></div></div>
  <section class="section"><h2>${owner ? 'Aguardando aprovação' : 'Aguardando o dono'} <span class="count">${pending.length}</span></h2><div class="list">${pending.length ? pending.map((p) => {
    const l = S.lead(p.leadId), car = S.vehicle(p.vehicleId), [m, pct] = R.margin(p.offered, car.cost);
    return `<div class="card stack"><div><h3><a href="#/lead/${l.id}">${esc(l.name)}</a> · ${esc(S.vehicleTitle(car))}</h3><p class="muted small">Proposta v${p.version} de ${esc(S.user(p.requestedBy).name)} · ${ago(p.at)} atrás</p></div>
      <p>Anunciado <strong class="num">${brl(p.asking)}</strong> → oferta <strong class="num">${brl(p.offered)}</strong> ${chip('today', R.discountPct(p.asking, p.offered).toFixed(1) + '% de desconto')}</p>
      ${p.down || p.trade ? `<p class="small muted">${p.down ? 'Entrada ' + brl(p.down) : ''}${p.trade ? (p.down ? ' · ' : '') + 'troca ' + brl(p.trade) + (p.tradeNote ? ' (' + esc(p.tradeNote) + ')' : '') : ''}</p>` : ''}${p.note ? `<p class="small">“${esc(p.note)}”</p>` : ''}
      ${owner ? `<p class="small">Custo ${brl(car.cost)} · ${chip(m < 0 ? 'late' : 'ok', 'margem ' + brl(m) + (pct !== null ? ` (${pct.toFixed(1)}%)` : ''))} ${m < 0 ? '<strong>abaixo do custo</strong>' : ''}</p>
      <form data-action="decide" data-id="${p.id}"><div class="row"><div><label for="price-${p.id}">Preço aprovado (R$) — deixe em branco para aprovar a oferta</label><input id="price-${p.id}" name="price" inputmode="decimal" placeholder="contraproposta opcional"></div>
        <div><label for="note-${p.id}">Observação (obrigatória para recusar)</label><input id="note-${p.id}" name="note" maxlength="300"></div></div>
        <div class="actions"><button class="btn primary" type="submit" name="decision" value="approve">Aprovar</button><button class="btn danger" type="submit" name="decision" value="reject">Recusar</button></div></form>` : ''}</div>`;
  }).join('') : empty('Nenhuma proposta aguardando decisão.')}</div></section>
  <section class="section"><h2>Histórico</h2><div class="list">${history.length ? history.map((p) => `<a class="item ${p.status === 'APROVADA' ? 'ok' : 'late'}" href="#/lead/${p.leadId}"><span class="bar"></span><span><span class="t">${esc(S.lead(p.leadId).name)} · ${esc(S.vehicleTitle(S.vehicle(p.vehicleId)))}</span>
    <span class="s">v${p.version} · oferta ${brl(p.offered)} (${R.discountPct(p.asking, p.offered).toFixed(1)}%)${p.approvedPrice && p.approvedPrice !== p.offered ? ' · aprovado por ' + brl(p.approvedPrice) : ''}${p.decisionNote ? ' · ' + esc(p.decisionNote) : ''}</span></span>
    <span class="meta">${chip(p.status === 'APROVADA' ? 'ok' : 'late', (p.status === 'APROVADA' ? 'Aprovada' : 'Recusada') + (p.approvalRequired ? '' : ' · na alçada'))}</span></a>`).join('') : empty('Sem histórico ainda.')}</div></section>`;
}

export function vehicles(q) {
  const owner = S.isOwner(), st = ['DISPONIVEL', 'RESERVADO', 'VENDIDO'].includes(q.get('status')) ? q.get('status') : null;
  const all = S.vehicleRows(), rows = st ? all.filter((r) => r.v.status === st) : all, inStock = all.filter((r) => r.v.status !== 'VENDIDO');
  const SL = { DISPONIVEL: 'Disponível', RESERVADO: 'Reservado', VENDIDO: 'Vendido' };
  return `<div class="page-head"><div><h1>Estoque</h1><p class="muted small">${inStock.length} em estoque · anunciado ${brl(inStock.reduce((a, r) => a + r.v.price, 0))}${owner ? ' · capital parado ' + brl(inStock.reduce((a, r) => a + r.v.cost, 0)) : ''}</p></div></div>
  <nav class="tabs always" aria-label="Situação"><a href="#/estoque" ${!st ? 'aria-current="true"' : ''}>Todos</a>${Object.keys(SL).map((s) => `<a href="#/estoque?status=${s}" ${st === s ? 'aria-current="true"' : ''}>${SL[s]}</a>`).join('')}</nav>
  <div class="cols">${rows.map((r) => { const v = r.v; return `<article class="card vehicle"><div class="top"><div><h3>${esc(S.vehicleTitle(v))}</h3><p class="muted small">${v.km.toLocaleString('pt-BR')} km · ${esc(v.plate)}</p></div>${chip(v.status === 'DISPONIVEL' ? 'ok' : v.status === 'RESERVADO' ? 'today' : '', SL[v.status])}</div>
    <div class="price num">${r.soldPrice !== null ? 'Vendido por ' + brl(r.soldPrice) : brl(v.price)}</div>
    ${v.fipe ? `<p class="small muted">FIPE ${brl(v.fipe)} ${r.fipeGap !== null ? chip(r.fipeGap > 5 ? 'late' : r.fipeGap <= 0 ? 'ok' : 'today', (r.fipeGap > 0 ? '+' : '') + r.fipeGap.toFixed(1) + '% vs FIPE') : ''}</p>` : ''}
    ${owner ? `<p class="small">Custo ${brl(v.cost)} · ${chip(r.margin < 0 ? 'late' : 'ok', 'margem ' + brl(r.margin) + (r.marginPct !== null ? ` (${r.marginPct.toFixed(1)}%)` : ''))}</p>` : ''}</article>`; }).join('') || empty('Nenhum veículo aqui.')}</div>`;
}

export function sales() {
  const rows = S.state.sales.filter((s) => S.canSeeSale(s)).sort((a, b) => b.soldAt - a.soldAt);
  return `<div class="page-head"><div><h1>Vendas</h1><p class="muted small">${S.isOwner() ? 'Todas as vendas da loja' : 'Suas vendas'} · ${rows.length} registrada${rows.length === 1 ? '' : 's'}</p></div><a class="btn small" href="#/leads">← Funil</a></div>
  <div class="list">${rows.length ? rows.map((s) => { const l = S.lead(s.leadId), n = S.state.contracts.filter((c) => c.saleId === s.id).length, [m, pct] = R.margin(s.price, s.cost);
    return `<a class="item ok" href="#/lead/${l.id}"><span class="bar"></span><span><span class="t">${esc(l.name)} · ${esc(S.vehicleTitle(S.vehicle(s.vehicleId)))}</span><span class="s">${local(s.soldAt)} · ${brl(s.price)}${S.isOwner() ? ' · margem ' + brl(m) + (pct !== null ? ` (${pct.toFixed(1)}%)` : '') : ''}</span></span><span class="meta">${chip(n ? 'ok' : 'today', n ? `${n} contrato${n === 1 ? '' : 's'}` : 'Sem contrato')}</span></a>`; }).join('') : empty('Nenhuma venda registrada ainda.')}</div>`;
}

export function contractForm(leadId, form = {}) {
  const l = S.lead(leadId), s = S.saleOf(leadId);
  if (!s) return `<div class="empty">O contrato é gerado depois que a venda é registrada.</div>`;
  if (!S.canSeeSale(s)) return `<div class="empty">Apenas o vendedor da venda ou o dono podem acessar este contrato.</div>`;
  const tpls = S.activeTemplates(), car = S.vehicle(s.vehicleId);
  const prop = S.state.proposals.filter((p) => p.leadId === l.id && p.vehicleId === s.vehicleId && p.status === 'APROVADA').sort((a, b) => b.version - a.version)[0];
  const f = { templateId: '', buyerName: l.name === 'Sem nome' ? '' : l.name, buyerCpf: '', buyerRg: '', buyerAddress: '', buyerPhone: R.formatPhone(l.phone), buyerEmail: '', down: prop ? num(prop.down) : '', trade: prop ? num(prop.trade) : '', tradeNote: prop ? prop.tradeNote : '', paymentForm: '', ...form };
  const issued = S.state.contracts.filter((c) => c.saleId === s.id).sort((a, b) => b.version - a.version);
  return `<div class="page-head"><div><h1>Gerar contrato</h1><p class="muted small">${esc(l.name)} · ${esc(S.vehicleTitle(car))} · venda de <strong class="num">${brl(s.price)}</strong></p></div><a class="btn small" href="#/lead/${l.id}">← Lead</a></div>
  ${tpls.length ? `<form class="card" data-action="contract" data-id="${l.id}"><label for="templateId">Modelo</label><select id="templateId" name="templateId">${tpls.map((t) => `<option value="${t.id}" ${String(f.templateId) === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <h2>Comprador</h2><label for="buyerName">Nome completo</label><input id="buyerName" name="buyerName" maxlength="160" value="${esc(f.buyerName)}" required>
    <div class="row"><div><label for="buyerCpf">CPF</label><input id="buyerCpf" name="buyerCpf" inputmode="numeric" placeholder="000.000.000-00" value="${esc(f.buyerCpf)}" required></div><div><label for="buyerRg">RG</label><input id="buyerRg" name="buyerRg" maxlength="30" value="${esc(f.buyerRg)}"></div></div>
    <label for="buyerAddress">Endereço</label><input id="buyerAddress" name="buyerAddress" maxlength="240" value="${esc(f.buyerAddress)}">
    <div class="row"><div><label for="buyerPhone">Telefone</label><input id="buyerPhone" name="buyerPhone" inputmode="tel" value="${esc(f.buyerPhone)}"></div><div><label for="buyerEmail">E-mail</label><input id="buyerEmail" name="buyerEmail" type="email" maxlength="200" value="${esc(f.buyerEmail)}"></div></div>
    <h2>Pagamento</h2><div class="row"><div><label for="down">Entrada (R$)</label><input id="down" name="down" inputmode="decimal" value="${esc(f.down)}"></div><div><label for="trade">Carro na troca (R$)</label><input id="trade" name="trade" inputmode="decimal" value="${esc(f.trade)}"></div></div>
    <label for="tradeNote">Carro na troca (descrição)</label><input id="tradeNote" name="tradeNote" maxlength="200" value="${esc(f.tradeNote)}">
    <label for="paymentForm">Forma de pagamento do saldo</label><input id="paymentForm" name="paymentForm" maxlength="200" placeholder="Ex.: à vista por Pix, financiamento em 48 parcelas" value="${esc(f.paymentForm)}">
    ${prop ? `<p class="muted small">Entrada e troca preenchidas pela proposta aprovada v${prop.version}; confira antes de gerar.</p>` : ''}<p class="muted small">Os dados do comprador ficam só neste navegador. Campos em branco saem como linha para preencher à mão.</p>
    <div class="actions"><button class="btn primary" type="submit">Gerar contrato</button></div></form>`
    : `<div class="card stack"><p>Você ainda não tem modelos de contrato.</p>${S.isOwner() ? '<div class="actions"><a class="btn primary" href="#/ajustes/modelos">Cadastrar modelo</a></div>' : '<p class="muted small">Peça ao dono para cadastrar um modelo.</p>'}</div>`}
  ${issued.length ? `<section class="section"><h2>Contratos já gerados</h2><div class="list">${issued.map((c) => `<a class="item ok" href="#/contrato/${c.id}"><span class="bar"></span><span><span class="t">Versão ${c.version} · ${esc(c.templateName)}</span><span class="s">${esc(c.buyerName)} · ${local(c.at)}</span></span><span class="meta">${chip('', 'Abrir')}</span></a>`).join('')}</div></section>` : ''}`;
}

export function contractView(id) {
  const c = S.state.contracts.find((x) => x.id === Number(id));
  if (!c) return empty('Contrato não encontrado.');
  const s = S.state.sales.find((x) => x.id === c.saleId);
  if (!S.canSeeSale(s)) return empty('Apenas o vendedor da venda ou o dono podem acessar este contrato.');
  return `<div class="page-head no-print"><div><h1>Contrato · versão ${c.version}</h1><p class="muted small">${esc(c.templateName)} · gerado em ${local(c.at)} · comprador ${esc(c.buyerName)}</p></div>
    <div class="actions"><button class="btn primary" type="button" data-print>Imprimir / salvar em PDF</button><a class="btn" href="#/lead/${s.leadId}/contrato">Gerar outra versão</a><a class="btn" href="#/lead/${s.leadId}">← Lead</a></div></div>
  <p class="chip today no-print">Revise o texto antes de assinar. Este sistema monta o documento a partir do seu modelo e não oferece garantia de validade jurídica.</p>
  <article class="contract-doc" aria-label="Contrato">${esc(c.body)}</article>`;
}

export function templatesPage() {
  const tpls = S.activeTemplates(), L = S.state.store.legal;
  return `<div class="page-head"><div><h1>Modelos de contrato</h1><p class="muted small">Cadastre o seu próprio texto: até ${R.MAX_TEMPLATES} modelos. ${tpls.length} de ${R.MAX_TEMPLATES} em uso.</p></div><a class="btn small" href="#/ajustes">← Ajustes</a></div>
  <div class="stack"><section class="card"><h2>Seus modelos</h2><div class="list">${tpls.length ? tpls.map((t) => `<a class="item ok" href="#/ajustes/modelos/${t.id}"><span class="bar"></span><span><span class="t">${esc(t.name)}</span><span class="s">${t.body.length} caracteres · atualizado ${local(t.updatedAt)}</span></span><span class="meta">${chip('', 'Editar')}</span></a>`).join('') : empty('Nenhum modelo ainda.')}</div>
    ${tpls.length < R.MAX_TEMPLATES ? `<div class="actions"><a class="btn primary" href="#/ajustes/modelos/novo">Novo modelo em branco</a><a class="btn" href="#/ajustes/modelos/novo?sample=1">Começar do modelo de exemplo</a></div>` : '<p class="muted small">Limite atingido: exclua um modelo para cadastrar outro.</p>'}
    <p class="muted small">O modelo de exemplo é um texto genérico, <strong>sem validade jurídica garantida</strong>: peça a um advogado para revisar o seu antes de usar com clientes.</p></section>
  <section class="card"><h2>Dados da loja para os contratos</h2><p class="muted small">Preenchem {loja_nome}, {loja_cnpj}, {loja_endereco}, {cidade} e {foro}. Campos vazios saem como linha em branco.</p>
    <form data-action="company"><label for="cname">Razão social</label><input id="cname" name="name" maxlength="160" value="${esc(L.name)}"><div class="row"><div><label for="cnpj">CNPJ</label><input id="cnpj" name="cnpj" inputmode="numeric" value="${esc(L.cnpj)}"></div>
      <div><label for="city">Cidade/UF</label><input id="city" name="city" maxlength="80" value="${esc(L.city)}"></div><div><label for="forum">Foro (comarca)</label><input id="forum" name="forum" maxlength="80" value="${esc(L.forum)}"></div></div>
      <label for="addr">Endereço</label><input id="addr" name="address" maxlength="240" value="${esc(L.address)}"><div class="actions"><button class="btn primary" type="submit">Salvar dados</button></div></form></section></div>`;
}

export function templateForm(id, sample) {
  const t = id === 'novo' ? null : S.state.templates.find((x) => x.id === Number(id) && x.active);
  if (id !== 'novo' && !t) return empty('Modelo não encontrado.');
  return `<div class="page-head"><h1>${t ? 'Editar modelo' : 'Novo modelo de contrato'}</h1><a class="btn small" href="#/ajustes/modelos">← Modelos</a></div>
  <div class="detail"><form class="card" data-action="template" data-id="${t ? t.id : 'novo'}"><label for="tname">Nome do modelo</label><input id="tname" name="name" maxlength="80" value="${esc(t ? t.name : sample ? 'Modelo de exemplo' : '')}" placeholder="Ex.: Venda à vista, Venda com troca, Financiado" required>
    <label for="tbody">Texto do contrato</label><textarea id="tbody" name="body" class="contract-editor" rows="24" required>${esc(t ? t.body : sample ? R.SAMPLE_TEMPLATE : '')}</textarea>
    ${sample ? '<p class="chip today">Texto de exemplo genérico: revise com um advogado e ajuste ao seu negócio antes de usar.</p>' : ''}
    <p class="muted small">Texto livre. Onde quiser um dado da venda, escreva o campo entre chaves (ao lado). Campos que você não usar simplesmente não aparecem; o que for desconhecido fica como você digitou.</p>
    <div class="actions"><button class="btn primary" type="submit">Salvar modelo</button></div></form>
    <div class="stack"><section class="card"><h2>Campos disponíveis</h2><dl class="fields">${Object.entries(R.CONTRACT_FIELDS).map(([k, v]) => `<dt><code>{${k}}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
    ${t ? `<section class="card"><h2>Excluir modelo</h2><p class="muted small">Contratos já emitidos com este modelo continuam disponíveis, exatamente como foram gerados.</p><form data-action="deleteTemplate" data-id="${t.id}"><div class="actions"><button class="btn danger" type="submit">Excluir este modelo</button></div></form></section>` : ''}</div></div>`;
}

export function settings() {
  const st = S.state.store;
  return `<div class="page-head"><h1>Ajustes</h1></div><div class="stack">
  <section class="card"><h2>Prazo de primeira resposta</h2><p class="muted small">Leads sem resposta além deste prazo ficam em vermelho no painel.</p><form data-action="sla" class="row"><div><label for="minutes">Minutos</label><input id="minutes" name="minutes" type="number" min="1" max="240" value="${st.slaMinutes}"></div><div><button class="btn primary" type="submit">Salvar</button></div></form></section>
  <section class="card"><h2>Alçada de desconto do vendedor</h2><p class="muted small">Desconto máximo que o vendedor pode dar sozinho sobre o preço anunciado. Abaixo disso, ele pede o menor preço e você aprova ou recusa.</p>
    <form data-action="authority" class="row"><div><label for="percent">Desconto sem aprovação (%)</label><input id="percent" name="percent" inputmode="decimal" value="${(st.authorityBps / 100).toFixed(1).replace('.', ',')}"></div><div><button class="btn primary" type="submit">Salvar</button></div></form></section>
  <section class="card"><h2>Contratos</h2><p class="muted small">Cadastre até 10 modelos de contrato com o seu texto e os dados da loja.</p><div class="actions"><a class="btn primary" href="#/ajustes/modelos">Modelos de contrato</a></div></section>
  <section class="card"><h2>Equipe</h2><div class="list">${S.state.users.map((u) => `<div class="item ok"><span class="bar"></span><span><span class="t">${esc(u.name)}</span><span class="s">${u.role === 'OWNER' ? 'Dono' : 'Vendedor'}</span></span></div>`).join('')}</div><p class="muted small">Na versão completa o dono adiciona e desativa vendedores aqui.</p></section>
  <section class="card"><h2>Entrada de leads</h2><p class="muted small">Na versão completa, portais e WhatsApp enviam os leads para um endereço seu. Aqui você pode ver o efeito no <a href="#/portal">simulador de portal</a>.</p></section></div>`;
}

// --- portal simulator (fictional brand) -----------------------------------------------------------
export function portal(error = '') {
  const cars = S.state.vehicles.filter((v) => v.status === 'DISPONIVEL').slice(0, 12);
  const SRC = ['WEBMOTORS', 'OLX', 'ICARROS', 'SITE'];
  return `<body-portal><header class="portal-head"><span class="portal-logo">Auto<strong>Portal</strong></span><span class="portal-tag">SIMULAÇÃO</span></header>
  <main class="portal-main"><div class="portal-banner"><strong>Isto não é um portal real.</strong> É uma simulação para você ver como o interesse de um cliente chega ao Pátio: escolha um carro, envie a mensagem e depois <a href="#/">volte ao Pátio</a> para ver o lead em “Sem resposta”.</div>
  ${error ? `<div class="flash err" role="alert">${esc(error)}</div>` : ''}<h1>Seminovos em destaque — ${esc(S.state.store.name)}</h1>
  <div class="portal-grid">${cars.map((c) => `<article class="portal-card"><div class="portal-photo" aria-hidden="true">${esc(c.make[0])}</div><h2>${esc(S.vehicleTitle(c))}</h2><p class="muted small">${c.km.toLocaleString('pt-BR')} km</p><p class="portal-price">${brl(c.price)}</p>
    <details><summary class="btn primary">Tenho interesse</summary><form data-action="portalInterest" data-id="${c.id}"><label for="pn-${c.id}">Seu nome</label><input id="pn-${c.id}" name="name" maxlength="120" required>
      <label for="pp-${c.id}">Telefone (com DDD)</label><input id="pp-${c.id}" name="phone" type="tel" inputmode="tel" placeholder="(11) 98765-4321" required>
      <label for="pm-${c.id}">Mensagem</label><textarea id="pm-${c.id}" name="message" maxlength="500">Olá, tenho interesse neste veículo. Ainda está disponível?</textarea>
      <label for="ps-${c.id}">Simular que o anúncio estava em</label><select id="ps-${c.id}" name="source">${SRC.map((s) => `<option value="${s}">${R.SOURCE_LABELS[s]}</option>`).join('')}</select>
      <div class="actions"><button class="btn primary" type="submit">Enviar mensagem ao anunciante</button></div></form></details></article>`).join('')}</div></main></body-portal>`;
}
export function portalSent(sourceLabel, leadId) {
  return `<body-portal><main class="center-card"><div class="card stack"><h1>Mensagem enviada ✔</h1>
  <p>Na vida real, o cliente pararia aqui. Mas o lead já chegou ao Pátio com a origem <strong>${esc(sourceLabel)}</strong>, o veículo de interesse e a conversa.</p>
  <ol class="steps"><li>Abra o Pátio: em <strong>Hoje → Sem resposta</strong> o lead aparece com o relógio do prazo de 5 minutos correndo.</li><li>Abra o lead, use um modelo de mensagem e responda: o tempo da primeira resposta é registrado.</li><li>Troque “Ver como” entre dono e vendedor para ver o que muda.</li></ol>
  <div class="actions"><a class="btn primary" href="#/lead/${leadId}">Ver o lead no Pátio</a><a class="btn" href="#/">Ir para Hoje</a><a class="btn" href="#/portal">Enviar outra mensagem</a></div></div></main></body-portal>`;
}
