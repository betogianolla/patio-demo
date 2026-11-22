// Router and event wiring for the clickable prototype. No network calls: everything stays in this browser.
import * as R from './rules.js';
import * as S from './store.js';
import * as V from './views.js';

const app = document.getElementById('app');
let ui = { ok: '', err: '' };
let contractDraft = null;   // keeps what the user typed when the contract form is refused
let portalLast = null;

const parseHash = () => {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path.replace(/\/+$/, '') || '/', q: new URLSearchParams(query) };
};
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
const flash = (ok = '', err = '') => { ui = { ok, err }; };

function view(path, q) {
  const m = (re) => path.match(re);
  const ownerOnly = (fn) => (S.isOwner() ? fn() : '<div class="empty">Apenas o dono da loja pode ver esta página. Troque o perfil em “Ver como”.</div>');
  if (path === '/') return V.today();
  if (path === '/leads') return V.funnel(q);
  if (path === '/leads/novo') return V.newLead();
  let r;
  if ((r = m(/^\/lead\/(\d+)\/contrato$/))) { const html = V.contractForm(r[1], contractDraft || {}); return html; }
  if ((r = m(/^\/lead\/(\d+)$/))) return V.leadDetail(r[1]);
  if ((r = m(/^\/contrato\/(\d+)$/))) return V.contractView(r[1]);
  if (path === '/propostas') return V.proposals();
  if (path === '/estoque') return V.vehicles(q);
  if (path === '/vendas') return V.sales();
  if (path === '/ajustes') return ownerOnly(V.settings);
  if (path === '/ajustes/modelos') return ownerOnly(V.templatesPage);
  if ((r = m(/^\/ajustes\/modelos\/(novo|\d+)$/))) return ownerOnly(() => V.templateForm(r[1], q.get('sample') === '1'));
  if (path === '/portal') return V.portal();
  if (path === '/portal/enviado') return portalLast ? V.portalSent(portalLast.label, portalLast.leadId) : V.portal();
  return '<div class="empty">Página não encontrada.</div>';
}

let lastPath = null;
function render() {
  const { path, q } = parseHash();
  const html = view(path, q);
  if (html.startsWith('<body-portal>')) {
    document.body.className = 'portal';
    app.innerHTML = html.replace(/<\/?body-portal>/g, '');
  } else {
    document.body.className = '';
    app.innerHTML = V.shell(path, html, ui);
  }
  ui = { ok: '', err: '' };
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
  document.title = 'Pátio · demonstração clicável';
  syncStageFields();
}

function syncStageFields() {
  const select = document.getElementById('stage-select');
  if (!select) return;
  document.querySelectorAll('[data-for-stage]').forEach((el) => { el.hidden = el.getAttribute('data-for-stage') !== select.value; });
}

const money = (v) => (String(v || '').trim() ? R.parseBrl(v) : 0);
const must = (cents, label = 'Valor') => { if (cents === null) throw new S.RuleError(`${label} inválido: use apenas números, ex.: 45.900,00.`); return cents; };

const handlers = {
  filter(f) { const p = new URLSearchParams(); for (const k of ['stage', 'owner', 'source']) if (f.get(k)) p.set(k, f.get(k)); return `#/leads?${p}`; },
  createLead(f) {
    const { lead, created } = S.ingestLead({ source: f.get('source'), name: f.get('name'), phone: f.get('phone'), message: f.get('message') || '', vehicleId: f.get('vehicleId') || null });
    flash(created ? 'Lead criado.' : 'Já existia um lead aberto com este telefone: mensagem adicionada a ele.');
    return `#/lead/${lead.id}`;
  },
  stage(f, id) {
    const price = f.get('price') ? R.parseBrl(f.get('price')) : null;
    S.moveStage(id, f.get('stage'), { lostReason: f.get('lostReason') || '', priceCents: price });
    flash(`Etapa: ${R.STAGE_LABELS[f.get('stage')]}.`);
  },
  message(f, id) { S.sendMessage(id, f.get('body')); flash('Mensagem registrada (envio simulado: não há integração real com o WhatsApp).'); },
  note(f, id) { S.addNote(id, f.get('body')); flash('Anotação salva.'); },
  nextAction(f, id) {
    const when = f.get('when') ? new Date(f.get('when')).getTime() : null;
    if (when !== null && Number.isNaN(when)) throw new S.RuleError('Data e hora inválidas.');
    S.setNextAction(id, when, f.get('note')); flash(when ? 'Próxima ação salva.' : 'Próxima ação removida.');
  },
  vehicle(f, id) { S.linkVehicle(id, f.get('vehicleId') || null); flash('Veículo de interesse atualizado.'); },
  assign(f, id) { S.reassign(id, f.get('ownerId')); flash('Responsável alterado.'); },
  proposal(f, id) {
    const p = S.createProposal(id, { offered: must(money(f.get('offered'))) || null, down: must(money(f.get('down'))), trade: must(money(f.get('trade'))), tradeNote: f.get('tradeNote') || '', note: f.get('note') || '' });
    flash(p.status === 'PENDENTE' ? 'Pedido de menor preço enviado ao dono. Troque para o perfil do dono em “Ver como” para aprovar.' : 'Proposta registrada (dentro da sua alçada).');
  },
  decide(f, id, submitter) {
    const approve = submitter === 'approve';
    const price = f.get('price') && f.get('price').trim() ? must(R.parseBrl(f.get('price'))) : null;
    S.decideProposal(id, { approve, price, note: f.get('note') || '' });
    flash(approve ? 'Proposta aprovada.' : 'Proposta recusada.');
  },
  contract(f, id) {
    contractDraft = Object.fromEntries(f.entries());
    const c = S.issueContract(id, { templateId: f.get('templateId'), buyerName: f.get('buyerName'), buyerCpf: f.get('buyerCpf'), buyerRg: f.get('buyerRg'), buyerAddress: f.get('buyerAddress'),
      buyerPhone: f.get('buyerPhone'), buyerEmail: f.get('buyerEmail'), down: f.get('down'), trade: f.get('trade'), tradeNote: f.get('tradeNote'), paymentForm: f.get('paymentForm') });
    contractDraft = null; flash('Contrato gerado. Revise e imprima ou salve em PDF.');
    return `#/contrato/${c.id}`;
  },
  template(f, id) {
    const [t, warnings] = id === 'novo' ? S.createTemplate(f.get('name'), f.get('body')) : S.updateTemplate(id, f.get('name'), f.get('body'));
    flash((id === 'novo' ? 'Modelo salvo.' : 'Modelo atualizado. Contratos já emitidos não mudam.') + (warnings.length ? ' Atenção: ' + warnings.join(' · ') : ''));
    return `#/ajustes/modelos/${t.id}`;
  },
  deleteTemplate(f, id) { S.deleteTemplate(id); flash('Modelo excluído. Contratos já emitidos continuam disponíveis.'); return '#/ajustes/modelos'; },
  company(f) { S.saveCompany({ name: f.get('name') || '', cnpj: f.get('cnpj') || '', address: f.get('address') || '', city: f.get('city') || '', forum: f.get('forum') || '' }); flash('Dados da loja salvos.'); },
  sla(f) {
    const m = Number(f.get('minutes'));
    if (!(m >= 1 && m <= 240)) throw new S.RuleError('O prazo deve ficar entre 1 e 240 minutos.');
    S.state.store.slaMinutes = m; S.save(); flash('Prazo de primeira resposta atualizado.');
  },
  authority(f) {
    const v = Number(String(f.get('percent')).replace(',', '.'));
    if (Number.isNaN(v)) throw new S.RuleError('Informe um percentual, ex.: 3 ou 2,5.');
    if (!(v >= 0 && v <= 30)) throw new S.RuleError('O desconto sem aprovação deve ficar entre 0% e 30%.');
    S.state.store.authorityBps = Math.round(v * 100); S.save(); flash('Alçada de desconto atualizada.');
  },
  portalInterest(f, id) {
    const { lead } = S.ingestLead({ source: f.get('source'), name: f.get('name'), phone: f.get('phone'), message: f.get('message') || '', vehicleId: id });
    portalLast = { label: R.SOURCE_LABELS[f.get('source')], leadId: lead.id };
    return '#/portal/enviado';
  },
};

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  event.preventDefault();
  const action = form.dataset.action;
  try {
    const next = handlers[action](new FormData(form), form.dataset.id, event.submitter ? event.submitter.value : '');
    if (next) go(next); else render();
  } catch (error) {
    if (!(error instanceof S.RuleError)) throw error;
    flash('', error.message);
    const form_ = form.dataset.action;
    if (form_ === 'portalInterest') { document.querySelector('.portal-main').insertAdjacentHTML('afterbegin', `<div class="flash err" role="alert">${V.esc(error.message)}</div>`); window.scrollTo(0, 0); return; }
    render(); window.scrollTo(0, 0);
  }
});

document.addEventListener('click', (event) => {
  const t = event.target.closest('[data-template]');
  if (t) { const area = document.getElementById('message-body'); if (area) { area.value = t.getAttribute('data-template'); area.focus(); } return; }
  if (event.target.closest('[data-print]')) { window.print(); return; }
  if (event.target.closest('[data-click="reset"]')) { S.reset(); contractDraft = null; portalLast = null; flash('Demonstração reiniciada com os dados originais.'); go('#/'); }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-change="role"]')) { S.setUser(event.target.value); flash(`Agora você vê o sistema como ${S.me().name} (${S.isOwner() ? 'dono' : 'vendedor'}).`); render(); }
  if (event.target.id === 'stage-select') syncStageFields();
});

// Live hint on the proposal form: does this offer need the owner's approval?
document.addEventListener('input', (event) => {
  const offered = event.target.id === 'offered' ? event.target : null;
  if (!offered || offered.getAttribute('data-owner') !== '0') return;
  const hint = document.getElementById('offer-hint'), cents = R.parseBrl(offered.value), floor = Number(offered.getAttribute('data-floor'));
  if (cents === null || cents <= 0) { hint.hidden = true; return; }
  hint.hidden = false;
  hint.className = 'small chip ' + (R.needsApproval(Math.round(floor / (1 - S.state.store.authorityBps / 10000)), cents, S.state.store.authorityBps) ? 'today' : 'ok');
  hint.textContent = cents < floor ? 'Abaixo da sua alçada: vai como pedido de menor preço ao dono.' : 'Dentro da sua alçada: você fecha sozinho.';
});

window.addEventListener('hashchange', () => { contractDraft = location.hash.includes('/contrato') ? contractDraft : null; render(); });

// Keep the "minutes without reply" counters alive on the list screens (never while typing).
setInterval(() => {
  const { path } = parseHash();
  if (!['/', '/leads'].includes(path) || document.hidden) return;
  if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  render();
}, 30000);

S.load();
render();
window.__patio = { S, R };   // handy for the browser console and automated checks
