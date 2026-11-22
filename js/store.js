// In-browser "backend": state in localStorage + the same business actions as app/services.py.
import * as R from './rules.js';
import { seedState } from './data.js';

const KEY = 'patio-demo-v1';
export class RuleError extends Error {}
const rule = (message) => { throw new RuleError(message); };

export let state = null;

export function load() {
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  if (!state || state.version !== 1) reset();
  return state;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ } }
export function reset() { state = seedState(Date.now()); save(); }

export const now = () => Date.now();
export const user = (id) => state.users.find((u) => u.id === id);
export const me = () => user(state.currentUserId);
export const isOwner = () => me().role === 'OWNER';
export const lead = (id) => state.leads.find((l) => l.id === Number(id));
export const vehicle = (id) => state.vehicles.find((v) => v.id === Number(id));
export const vehicleTitle = (v) => (v ? `${v.make} ${v.model} ${v.version}`.replace(/\s+/g, ' ').trim() + ` ${v.year}` : '');
const nextId = (kind) => (state.seq[kind] += 1);
const log = (leadId, direction, channel, body, userId = null, status = '') =>
  state.messages.push({ id: nextId('message'), leadId, direction, channel, body, status, userId, at: now() });

export function setUser(id) { state.currentUserId = Number(id); save(); }

// --- leads ---------------------------------------------------------------------------------------
export function assignOwner() {
  for (const role of ['SELLER', 'OWNER']) {
    const people = state.users.filter((u) => u.role === role && u.active);
    if (!people.length) continue;
    const open = (u) => state.leads.filter((l) => l.ownerId === u.id && R.OPEN_STAGES.includes(l.stage)).length;
    return people.reduce((best, u) => (open(u) < open(best) || (open(u) === open(best) && u.id < best.id) ? u : best)).id;
  }
  return null;
}

export function ingestLead({ source, name, phone, message = '', vehicleId = null }) {
  if (!R.SOURCES.includes(source)) rule('Origem inválida.');
  const normalized = R.normalizePhone(phone);
  if (!normalized) rule('Telefone inválido.');
  const car = vehicleId ? vehicle(vehicleId) : null;
  const existing = [...state.leads].reverse().find((l) => l.phone === normalized && R.OPEN_STAGES.includes(l.stage));
  let target, created;
  if (existing) {
    target = existing; created = false;
    if (car && !target.vehicleId) target.vehicleId = car.id;
  } else {
    const t = now();
    target = { id: nextId('lead'), name: (name || '').trim().slice(0, 120) || 'Sem nome', phone: normalized, source, stage: 'NOVO', ownerId: assignOwner(),
      vehicleId: car ? car.id : null, nextActionAt: null, nextActionNote: '', firstResponseAt: null, lastActivityAt: t, lostReason: '', createdAt: t };
    state.leads.push(target); created = true;
  }
  if (message.trim()) { log(target.id, 'IN', source, message.trim().slice(0, 2000)); target.lastActivityAt = now(); }
  save();
  return { lead: target, created };
}

export function sendMessage(leadId, body) {
  const l = lead(leadId);
  if (!String(body || '').trim()) rule('Escreva a mensagem.');
  if (['VENDIDO', 'PERDIDO'].includes(l.stage)) rule('Lead encerrado: reabra pelo cadastro de um novo contato.');
  log(l.id, 'OUT', 'WHATSAPP', body.trim().slice(0, 2000), me().id, 'SIMULADO');
  if (!l.firstResponseAt) l.firstResponseAt = now();
  if (l.stage === 'NOVO') l.stage = 'CONTATO';
  l.lastActivityAt = now();
  save();
}
export function addNote(leadId, body) {
  const l = lead(leadId);
  if (!String(body || '').trim()) rule('Escreva a anotação.');
  log(l.id, 'NOTE', 'NOTA', body.trim().slice(0, 2000), me().id);
  l.lastActivityAt = now(); save();
}
export function setNextAction(leadId, when, note) {
  const l = lead(leadId);
  l.nextActionAt = when || null; l.nextActionNote = when ? String(note || '').trim().slice(0, 200) : ''; l.lastActivityAt = now(); save();
}
export function reassign(leadId, ownerId) {
  const owner = user(Number(ownerId));
  if (!owner || !owner.active) rule('Vendedor inválido.');
  lead(leadId).ownerId = owner.id; save();
}
export function linkVehicle(leadId, vehicleId) {
  if (vehicleId && !vehicle(vehicleId)) rule('Veículo inválido.');
  lead(leadId).vehicleId = vehicleId ? Number(vehicleId) : null; save();
}

// A seller may only close at/above the store authority or at/above an approved proposal for this lead and car.
function checkPriceAuthority(l, car, priceCents) {
  if (isOwner()) return;
  if (!R.needsApproval(car.price, priceCents, state.store.authorityBps)) return;
  const approved = state.proposals.some((p) => p.leadId === l.id && p.vehicleId === car.id && p.status === 'APROVADA' && p.approvedPrice <= priceCents);
  if (!approved) {
    const floor = R.lowestPriceWithoutApproval(car.price, state.store.authorityBps);
    rule(`Preço abaixo da sua alçada (mínimo sem aprovação: ${R.formatBrl(floor)}). Envie uma proposta e peça aprovação ao dono.`);
  }
}

export function moveStage(leadId, target, { lostReason = '', priceCents = null } = {}) {
  const l = lead(leadId);
  const error = R.validateTransition(l.stage, target, { hasVehicle: !!l.vehicleId, priceCents, lostReason });
  if (error) rule(error);
  if (target === 'VENDIDO') {
    const car = vehicle(l.vehicleId);
    if (!car || car.status === 'VENDIDO') rule('Este veículo já foi vendido ou não existe.');
    checkPriceAuthority(l, car, priceCents);
    state.sales.push({ id: nextId('sale'), leadId: l.id, vehicleId: car.id, price: priceCents, cost: car.cost, sellerId: l.ownerId || me().id, soldAt: now() });
    car.status = 'VENDIDO'; l.nextActionAt = null; l.nextActionNote = '';
  }
  if (target === 'PERDIDO') { l.lostReason = lostReason.trim().slice(0, 200); l.nextActionAt = null; l.nextActionNote = ''; }
  l.stage = target; l.lastActivityAt = now();
  log(l.id, 'NOTE', 'SISTEMA', `Etapa alterada para ${R.STAGE_LABELS[target]}.`, me().id);
  save();
}

// --- proposals -----------------------------------------------------------------------------------
export function createProposal(leadId, { offered, down = 0, trade = 0, tradeNote = '', note = '' }) {
  const l = lead(leadId);
  if (['VENDIDO', 'PERDIDO'].includes(l.stage)) rule('Lead encerrado: não é possível fazer proposta.');
  const car = vehicle(l.vehicleId);
  if (!car) rule('Vincule o veículo de interesse antes de fazer a proposta.');
  if (car.status === 'VENDIDO') rule('Este veículo já foi vendido.');
  const error = R.validateProposal(offered, down, trade);
  if (error) rule(error);
  const needs = !isOwner() && R.needsApproval(car.price, offered, state.store.authorityBps);
  const version = state.proposals.filter((p) => p.leadId === l.id).length + 1;
  const t = now();
  const p = { id: nextId('proposal'), leadId: l.id, vehicleId: car.id, version, asking: car.price, offered, down, trade, tradeNote: tradeNote.trim().slice(0, 200), note: note.trim().slice(0, 400),
    status: needs ? 'PENDENTE' : 'APROVADA', approvalRequired: needs, approvedPrice: needs ? null : offered, requestedBy: me().id, decidedBy: needs ? null : me().id, decisionNote: '', at: t };
  state.proposals.push(p);
  if (['NOVO', 'CONTATO', 'VISITA'].includes(l.stage)) l.stage = 'PROPOSTA';
  l.lastActivityAt = t;
  log(l.id, 'NOTE', 'SISTEMA', `Proposta v${version}: ${R.formatBrl(offered)} (${needs ? 'aguardando aprovação do dono' : 'dentro da alçada'}).`, me().id);
  save();
  return p;
}
export function decideProposal(id, { approve, price = null, note = '' }) {
  const p = state.proposals.find((x) => x.id === Number(id));
  if (!isOwner()) rule('Apenas o dono pode decidir.');
  if (p.status !== 'PENDENTE') rule('Esta proposta já foi decidida.');
  let text;
  if (approve) {
    const final = price || p.offered;
    if (final <= 0) rule('Informe um preço válido.');
    p.status = 'APROVADA'; p.approvedPrice = final;
    text = `Proposta v${p.version} aprovada por ${me().name}: ${R.formatBrl(final)}${final !== p.offered ? ' (contraproposta).' : '.'}`;
  } else {
    if (!note.trim()) rule('Informe o motivo da recusa.');
    p.status = 'RECUSADA';
    text = `Proposta v${p.version} recusada por ${me().name}: ${note.trim()}`;
  }
  p.decidedBy = me().id; p.decisionNote = note.trim().slice(0, 300);
  log(p.leadId, 'NOTE', 'SISTEMA', text, me().id);
  lead(p.leadId).lastActivityAt = now(); save();
}

// --- contract templates and contracts ------------------------------------------------------------
export const activeTemplates = () => state.templates.filter((t) => t.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
function checkTemplate(name, body, ignoreId = null) {
  name = String(name || '').trim(); body = String(body || '').replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
  if (!name) rule('Dê um nome ao modelo.');
  if (name.length > 80) rule('O nome do modelo pode ter até 80 caracteres.');
  if (!body.trim()) rule('Escreva o texto do modelo.');
  if (body.length > 50000) rule('O modelo pode ter até 50.000 caracteres.');
  if (activeTemplates().some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== ignoreId)) rule('Já existe um modelo com este nome.');
  return [name, body];
}
export function createTemplate(name, body) {
  if (activeTemplates().length >= R.MAX_TEMPLATES) rule(`Limite de ${R.MAX_TEMPLATES} modelos atingido. Exclua um para criar outro.`);
  [name, body] = checkTemplate(name, body);
  const t = { id: nextId('template'), name, body, active: true, updatedAt: now() };
  state.templates.push(t); save();
  return [t, R.templateWarnings(body)];
}
export function updateTemplate(id, name, body) {
  const t = state.templates.find((x) => x.id === Number(id));
  [name, body] = checkTemplate(name, body, t.id);
  t.name = name; t.body = body; t.updatedAt = now(); save();
  return [t, R.templateWarnings(body)];
}
export function deleteTemplate(id) { state.templates.find((x) => x.id === Number(id)).active = false; save(); }
export function saveCompany(data) {
  if (data.cnpj.trim() && !R.validCnpj(data.cnpj)) rule('CNPJ inválido.');
  Object.assign(state.store.legal, { name: data.name.trim(), cnpj: R.formatCnpj(data.cnpj), address: data.address.trim(), city: data.city.trim(), forum: data.forum.trim() });
  save();
}
export const saleOf = (leadId) => state.sales.find((s) => s.leadId === Number(leadId));
export const canSeeSale = (s) => isOwner() || s.sellerId === me().id;
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function issueContract(leadId, f) {
  const l = lead(leadId), s = saleOf(leadId);
  if (!s) rule('O contrato é gerado depois que a venda é registrada.');
  if (!canSeeSale(s)) rule('Apenas o vendedor da venda ou o dono podem gerar este contrato.');
  const tpl = state.templates.find((t) => t.id === Number(f.templateId) && t.active);
  if (!tpl) rule('Escolha um modelo de contrato (cadastre em Modelos de contrato).');
  if (!String(f.buyerName || '').trim()) rule('Informe o nome do comprador.');
  if (!R.validCpf(f.buyerCpf)) rule('CPF do comprador inválido.');
  const down = f.down ? R.parseBrl(f.down) : 0, trade = f.trade ? R.parseBrl(f.trade) : 0;
  if (down === null || trade === null) rule('Valor inválido: use apenas números, ex.: 10.000,00.');
  const balance = s.price - down - trade;
  if (balance < 0) rule('Entrada somada à troca não pode passar do valor da venda.');
  const car = vehicle(s.vehicleId), seller = user(s.sellerId) || me(), d = new Date(), L = state.store.legal;
  const values = {
    comprador_nome: f.buyerName.trim(), comprador_cpf: R.formatCpf(f.buyerCpf), comprador_rg: (f.buyerRg || '').trim(), comprador_endereco: (f.buyerAddress || '').trim(),
    comprador_telefone: (f.buyerPhone || '').trim(), comprador_email: (f.buyerEmail || '').trim(), loja_nome: L.name || state.store.name, loja_cnpj: L.cnpj, loja_endereco: L.address,
    cidade: L.city, foro: L.forum || L.city, veiculo: vehicleTitle(car), placa: car.plate, km: String(car.km).replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    valor: R.formatNumber(s.price), valor_extenso: R.brlInWords(s.price), entrada: R.formatNumber(down), troca: R.formatNumber(trade),
    troca_descricao: trade ? (f.tradeNote || '').trim() : 'não há', saldo: R.formatNumber(balance), forma_pagamento: (f.paymentForm || '').trim() || 'à vista',
    data: `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`, vendedor_nome: seller.name,
  };
  const version = state.contracts.filter((c) => c.saleId === s.id).length + 1;
  const c = { id: nextId('contract'), saleId: s.id, templateName: tpl.name, version, buyerName: values.comprador_nome, body: R.fillContract(tpl.body, values), at: now() };
  state.contracts.push(c); save();
  return c;
}

// --- read models ---------------------------------------------------------------------------------
export function dayEnd(t = now()) { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); }
export function leadRow(l, t = now()) {
  return { lead: l, waiting: R.minutesBetween(l.createdAt, l.firstResponseAt ?? t), breached: R.slaBreached(l.createdAt, l.firstResponseAt, t, state.store.slaMinutes),
    urgency: R.urgency(l.nextActionAt, t, dayEnd(t)), stale: R.isStale(l.lastActivityAt, t) };
}
export function openLeads({ owner = null, source = null } = {}) {
  return state.leads.filter((l) => R.OPEN_STAGES.includes(l.stage) && (!owner || l.ownerId === Number(owner)) && (!source || l.source === source)).map((l) => leadRow(l));
}
export function today() {
  const rows = openLeads({ owner: isOwner() ? null : me().id });
  const unanswered = rows.filter((r) => !r.lead.firstResponseAt).sort((a, b) => a.lead.createdAt - b.lead.createdAt);
  const answered = rows.filter((r) => r.lead.firstResponseAt);
  const due = answered.filter((r) => ['late', 'today'].includes(r.urgency)).sort((a, b) => a.lead.nextActionAt - b.lead.nextActionAt);
  const dueIds = new Set(due.map((r) => r.lead.id));
  const stale = answered.filter((r) => r.stale && !dueIds.has(r.lead.id)).sort((a, b) => a.lead.lastActivityAt - b.lead.lastActivityAt);
  return { unanswered, due, stale, openCount: rows.length };
}
export function kpis() {
  const t = now(), since7 = t - 7 * 86400000, since30 = t - 30 * 86400000;
  const created = state.leads.filter((l) => l.createdAt >= since7);
  const minutes = created.filter((l) => l.firstResponseAt).map((l) => R.minutesBetween(l.createdAt, l.firstResponseAt));
  const sales = state.sales.filter((s) => s.soldAt >= since30);
  return { leads7: created.length, avgMin: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
    withinSla: minutes.length ? Math.round((minutes.filter((m) => m <= state.store.slaMinutes).length * 100) / minutes.length) : null,
    sales30: sales.length, margin30: sales.reduce((a, s) => a + s.price - s.cost, 0) };
}
export const pendingProposals = () => state.proposals.filter((p) => p.status === 'PENDENTE');
export function vehicleRows() {
  return [...state.vehicles].reverse().map((v) => {
    const sale = state.sales.find((s) => s.vehicleId === v.id);
    const [m, pct] = sale ? R.margin(sale.price, sale.cost) : R.margin(v.price, v.cost);
    return { v, soldPrice: sale ? sale.price : null, margin: m, marginPct: pct, fipeGap: R.fipeGapPct(v.price, v.fipe) };
  });
}
