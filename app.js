/* Diário de Bordo v2 — app da família (PWA). Sem dependências externas. */
(() => {
  'use strict';

  const C = window.BORDO_CONFIG || {};
  const VERSAO = '2.0.0';
  const K = { token: 'bordo.token', user: 'bordo.user', dados: 'bordo.dados2', fila: 'bordo.fila2', tema: 'bordo.tema' };

  // =========================================================== utilidades
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const nf2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const nf0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const brl = v => nf2.format(v || 0);
  const brl0 = v => nf0.format(Math.round(v || 0));
  const pct = v => isFinite(v) ? (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%' : '—';
  const compacto = v => { const a = Math.abs(v); return a >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: a >= 10000 ? 0 : 1 }) + ' mil' : Math.round(v).toLocaleString('pt-BR'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ymDe = (y, m) => y * 12 + (m - 1);
  const ymY = ym => Math.floor(ym / 12);
  const ymM = ym => (ym % 12) + 1;
  const ymStr = ym => ymY(ym) + '-' + String(ymM(ym)).padStart(2, '0');
  const ymDeStr = s => ymDe(+s.slice(0, 4), +s.slice(5, 7));
  const ymLabel = ym => MESES[ymM(ym) - 1] + ' ' + ymY(ym);
  const ymCurto = ym => MES3[ymM(ym) - 1] + '/' + String(ymY(ym)).slice(2);
  const mesNome = ym => MESES[ymM(ym) - 1].toLowerCase();
  const pad = n => String(n).padStart(2, '0');
  const isoDe = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const isoHoje = () => isoDe(new Date());
  const isoOntem = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDe(d); };
  const hojeYm = () => { const d = new Date(); return ymDe(d.getFullYear(), d.getMonth() + 1); };
  const diaHoje = () => new Date().getDate();
  const diasNoMes = ym => new Date(ymY(ym), ymM(ym), 0).getDate();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const soma = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const parseValor = s => {
    s = String(s || '').trim().replace(/\s|R\$/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s); return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };
  const fmtValorInput = v => v ? String(v.toFixed(2)).replace('.', ',') : '';
  const dataLonga = iso => { const [y, m, d] = iso.split('-').map(Number); return d + ' ' + MES3[m - 1] + ' ' + y; };

  // =========================================================== estado
  const state = {
    token: store.get(K.token, null), user: store.get(K.user, null),
    dados: store.get(K.dados, null), fila: store.get(K.fila, []),
    tela: 'inicio', ym: hojeYm(), carregando: false, offline: false, salvando: false,
    busca: '', filtro: 'todos', tabela12: false, loginUser: null, loginErro: '',
    cartaoSel: null, cartaoYm: null, cartaoForm: null, form: null, voltarPara: null
  };
  state.form = novoForm();

  function novoForm(base) {
    return Object.assign({ id: null, tipo: 'D', valor: '', data: isoHoje(), cat: '', desc: '', resp: respPadrao(),
      forma: 'PIX', n: 1, modoValor: 'total', cartao: '', fx: '', fxManual: false }, base || {});
  }
  function respPadrao() {
    const r = (state && state.dados && state.dados.responsaveis) || ['Vlad', 'Mariana', 'Calvin', 'Família'];
    return state && state.user && r.indexOf(state.user) >= 0 ? state.user : r[0];
  }
  function aplicarTema() {
    const t = store.get(K.tema, 'auto');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // =========================================================== API
  async function api(acao, extra) {
    if (C.API_URL === 'DEMO') return demoApi(acao, extra || {});
    if (!C.API_URL || /COLE_AQUI/.test(C.API_URL)) throw new Error('Falta configurar a API_URL no arquivo config.js.');
    let res;
    try { res = await fetch(C.API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ acao, token: state.token }, extra || {})) }); }
    catch (_) { throw Object.assign(new Error('Sem conexão.'), { rede: true }); }
    let j;
    try { j = await res.json(); }
    catch (_) { throw new Error('O servidor não respondeu como esperado. Confira se a implantação do Apps Script está como "Qualquer pessoa".'); }
    if (!j.ok) throw Object.assign(new Error(j.erro || 'Erro inesperado.'), { auth: !!j.auth });
    return j;
  }

  async function carregar(silencioso) {
    if (state.carregando || !state.token) return;
    state.carregando = true; atualizarTopo();
    try {
      const j = await api('dados');
      state.dados = { lanc: j.lanc, cartoes: j.cartoes, categorias: j.categorias, formas: j.formas, responsaveis: j.responsaveis, atualizadoEm: j.atualizadoEm };
      store.set(K.dados, state.dados);
      state.offline = false;
    } catch (e) {
      if (e.auth) { sair(true); return; }
      if (e.rede) { state.offline = true; if (!silencioso) toast('Sem conexão. Mostrando os últimos dados salvos.'); }
      else toast(e.message);
    } finally { state.carregando = false; }
    render();
    sincronizarFila();
  }

  async function sincronizarFila() {
    if (!state.fila.length || state.sincronizando || !state.token) return;
    state.sincronizando = true;
    let enviados = 0;
    try {
      while (state.fila.length) {
        try { await api('salvar', { item: state.fila[0] }); enviados++; }
        catch (e) {
          if (e.rede) break;
          if (e.auth) { sair(true); return; }
          toast('Um lançamento pendente foi recusado: ' + e.message);
        }
        state.fila.shift(); store.set(K.fila, state.fila);
      }
    } finally { state.sincronizando = false; }
    if (enviados) { toast(enviados === 1 ? '1 lançamento sincronizado.' : enviados + ' lançamentos sincronizados.'); carregar(true); }
  }

  function sair(expirou) {
    if (!expirou && state.token) api('sair').catch(() => {});
    state.token = null; store.del(K.token);
    state.loginErro = expirou ? 'Sua sessão expirou. Entre de novo.' : '';
    render();
  }

  // =========================================================== modelo
  const NAT_ORDEM = ['Essencial', 'Estilo de vida', 'Dívidas e juros', 'Poupança'];
  const NAT_COR = { 'Essencial': 'var(--n1)', 'Estilo de vida': 'var(--n2)', 'Dívidas e juros': 'var(--n3)', 'Poupança': 'var(--n4)' };
  const GRUPO_ICONE = { Receitas: '💰', Moradia: '🏠', 'Alimentação': '🛒', Transporte: '🚗', 'Saúde': '❤️', 'Educação': '🎓', 'Família': '👨‍👩‍👦', Lazer: '🎉', Viagens: '✈️', Compras: '🛍️', Financeiro: '💳', Investimentos: '📈', Outros: '📦' };

  function mapaCats() {
    const m = new Map();
    ((state.dados && state.dados.categorias) || []).forEach(c => m.set(c.c, c));
    return m;
  }
  const cartoes = () => (state.dados && state.dados.cartoes) || [];
  const cartaoPorNome = nome => cartoes().find(c => c.nome === nome);
  const ehParcelavel = f => f === 'Crédito' || f === 'Empréstimo';

  /** Mês da fatura em que uma compra no crédito cai, a partir do fechamento/vencimento do cartão. */
  function faturaDe(card, iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const base = ymDe(y, m);
    if (!card || !card.fech) return base;
    const fechYm = base + (d >= card.fech ? 1 : 0);
    const vencDepois = card.venc ? card.venc <= card.fech : card.fech > 20;
    return fechYm + (vencDepois ? 1 : 0);
  }
  /** Próxima fatura a vencer de um cartão (mês). */
  function faturaAtual(card) {
    const h = hojeYm();
    if (!card || !card.venc) return h;
    return diaHoje() <= card.venc ? h : h + 1;
  }

  let cacheMov = { chave: null, lista: [] };
  function movimentos() {
    const d = state.dados;
    if (!d) return [];
    const chave = d.atualizadoEm + '|' + d.lanc.length + '|' + state.fila.length + '|' + (d.versaoLocal || 0);
    if (cacheMov.chave === chave) return cacheMov.lista;
    const cats = mapaCats();
    const out = [];
    const expandir = (x, extra) => {
      const cat = cats.get(x.c);
      const n = Math.max(1, x.n || 1);
      const baseYm = x.f === 'Crédito' && x.fx ? ymDeStr(x.fx) : ymDeStr(x.d);
      const dia = +x.d.slice(8, 10);
      for (let i = 0; i < n; i++) {
        const ym = baseYm + i;
        const iso = i === 0 && !(x.f === 'Crédito' && x.fx && ymDeStr(x.fx) !== ymDeStr(x.d))
          ? x.d : ymStr(ym) + '-' + pad(Math.min(dia, diasNoMes(ym)));
        out.push(Object.assign({
          id: (x.id || x.cid) + '#' + i, lid: x.id, ref: x, ym, iso, i, n,
          cat: x.c || 'Sem categoria', grupo: cat ? cat.g : 'Sem grupo', icone: cat ? cat.i : '❓',
          tipo: cat ? cat.t : (x.t === 'R' ? 'R' : 'D'), nat: cat ? cat.nat : 'Estilo de vida', semCat: !cat,
          desc: x.ds, resp: x.p, forma: x.f, cartao: x.f === 'Crédito' ? x.k : '', valor: x.v / n,
          parcela: n > 1 ? (i + 1) + '/' + n : ''
        }, extra));
      }
    };
    d.lanc.forEach(x => expandir(x, {}));
    state.fila.forEach(q => expandir(Object.assign({}, q, { t: '' }), { pend: true }));
    cacheMov = { chave, lista: out };
    return out;
  }

  function somar(o, k, v) { o[k] = (o[k] || 0) + v; }
  function resumoMes(movs, ym) {
    const r = { rec: 0, desp: 0, grupos: {}, cats: {}, nats: {}, resp: {}, formas: {}, qtdCat: {}, n: 0, semCat: 0, pequenas: 0, pequenasV: 0 };
    movs.forEach(m => {
      if (m.ym !== ym) return;
      r.n++;
      if (m.semCat) r.semCat++;
      if (m.tipo === 'R') { r.rec += m.valor; return; }
      r.desp += m.valor;
      somar(r.grupos, m.grupo, m.valor); somar(r.cats, m.cat, m.valor); somar(r.nats, m.nat, m.valor);
      somar(r.resp, m.resp || 'Não informado', m.valor); somar(r.formas, m.forma || 'Não informado', m.valor);
      somar(r.qtdCat, m.cat, 1);
      if (m.nat === 'Estilo de vida' && m.n === 1 && m.valor <= 40) { r.pequenas++; r.pequenasV += m.valor; }
    });
    r.saldo = r.rec - r.desp;
    r.taxa = r.rec > 0 ? r.saldo / r.rec : NaN;
    return r;
  }

  function statusCartao(card) {
    const movs = movimentos().filter(m => m.cartao === card.nome && m.tipo === 'D');
    const atual = faturaAtual(card);
    const fat = ym => soma(movs.filter(m => m.ym === ym), m => m.valor);
    const usado = soma(movs.filter(m => m.ym >= atual), m => m.valor);
    return { atual, fat, usado, livre: card.limite ? card.limite - usado : null, uso: card.limite ? usado / card.limite : null, movs };
  }

  // =========================================================== dicas
  function gerarDicas(ym) {
    const movs = movimentos();
    const cats = mapaCats();
    const r = resumoMes(movs, ym);
    const ehAtual = ym === hojeYm();
    const proj = ehAtual && diaHoje() >= 5 ? diasNoMes(ym) / diaHoje() : 1;
    const anteriores = [1, 2, 3].map(k => resumoMes(movs, ym - k)).filter(x => x.n > 0);
    const mediaCat = c => anteriores.length ? soma(anteriores, x => x.cats[c] || 0) / anteriores.length : 0;
    const recMedia = (() => { const xs = [r].concat(anteriores).filter(x => x.rec > 0); return xs.length ? soma(xs, x => x.rec) / xs.length : 0; })();
    const dicas = [];
    const add = (nivel, icone, titulo, texto, peso) => dicas.push({ nivel, icone, titulo, texto, peso: peso || 0 });
    const fatores = [];
    let nota = 100;
    const pen = (pts, txt) => { nota -= pts; fatores.push({ pts, txt }); };
    const desp = r.desp, rec = r.rec;

    // 1. saldo
    if (rec > 0) {
      if (r.taxa < 0) {
        const topL = Object.entries(r.cats).filter(([c]) => (cats.get(c) || {}).nat === 'Estilo de vida' && c !== 'Outros gastos').sort((a, b) => b[1] - a[1])[0];
        add('alerta', '🚨', 'Mês no vermelho', 'As despesas passaram as receitas em ' + brl(-r.saldo) + '.' + (topL ? ' O primeiro lugar para cortar é ' + topL[0] + ' (' + brl0(topL[1]) + ').' : ''), 100);
        pen(30, 'Despesas maiores que receitas');
      } else if (r.taxa < 0.1) {
        add('atencao', '🪫', 'Sobrou pouco', 'Só ' + pct(r.taxa) + ' da receita sobrou. O ideal é guardar 20%: seriam ' + brl0(rec * 0.2) + ' neste mês.', 70);
        pen(18, 'Poupança abaixo de 10%');
      } else if (r.taxa < 0.2) {
        add('dica', '🎯', 'Quase lá', 'Vocês guardaram ' + pct(r.taxa) + '. Faltam ' + brl0(rec * 0.2 - r.saldo) + ' para chegar nos 20% recomendados.', 30);
        pen(8, 'Poupança entre 10% e 20%');
      } else {
        add('parabens', '🐓', 'Isso é Galo!', 'Vocês guardaram ' + pct(r.taxa) + ' da receita (' + brl0(r.saldo) + '). Acima dos 20% recomendados. Agora é fazer esse dinheiro render.', 20);
      }
    } else if (desp > 0 && ym <= hojeYm()) {
      add('dica', '📝', 'Faltam as receitas', 'Não há receitas lançadas em ' + mesNome(ym) + ', então saldo e dicas ficam incompletos.', 60);
      pen(10, 'Receitas do mês não lançadas');
    }

    // 2. picos e quedas por categoria (estilo de vida)
    const variacoes = Object.keys(r.cats).map(c => {
      const cur = r.cats[c] * ((cats.get(c) || {}).nat === 'Estilo de vida' ? proj : 1);
      const med = mediaCat(c);
      return { c, cur, med, dif: cur - med };
    }).filter(x => x.med >= 100);
    variacoes.filter(x => x.cur >= x.med * 1.3 && x.dif >= 80).sort((a, b) => b.dif - a.dif).slice(0, 3).forEach(x =>
      add('atencao', (cats.get(x.c) || {}).i || '📈', x.c + ' subiu ' + pct(x.cur / x.med - 1),
        (ehAtual && proj > 1 ? 'No ritmo atual, fecha o mês em ' : 'Foram ') + brl0(x.cur) + ', contra média de ' + brl0(x.med) + ' nos meses anteriores. ' +
        ((cats.get(x.c) || {}).nat === 'Estilo de vida' ? 'Dá para segurar.' : 'Vale entender o motivo.'), 60 + Math.min(30, x.dif / 50)));
    const queda = variacoes.filter(x => (cats.get(x.c) || {}).nat === 'Estilo de vida' && x.cur <= x.med * 0.75 && -x.dif >= 100).sort((a, b) => a.dif - b.dif)[0];
    if (queda && !ehAtual) add('parabens', '👏', 'Menos ' + queda.c, 'Gastaram ' + brl0(-queda.dif) + ' a menos que a média em ' + queda.c + '. Bom trabalho.', 15);

    // 3. delivery x mercado
    const rest = r.cats['Restaurante e delivery'] || 0, merc = r.cats['Mercado'] || 0, qRest = r.qtdCat['Restaurante e delivery'] || 0;
    if (rest > 300 && rest > merc * 0.6) {
      const ticket = qRest ? rest / qRest : 60;
      add('dica', '🍳', 'Delivery x mercado', 'Para cada R$ 10 no mercado foram ' + brl(merc ? rest / merc * 10 : rest) + ' em restaurante e delivery. Trocar 2 pedidos por semana por comida em casa libera cerca de ' + brl0(ticket * 8 * 0.6) + ' por mês.', 50);
    }
    // 4. efeito cafezinho
    if (r.pequenas >= 15) add('dica', '☕', 'Efeito cafezinho', r.pequenas + ' compras pequenas (até R$ 40) somaram ' + brl0(r.pequenasV) + ' no mês. Em um ano, isso vira ' + brl0(r.pequenasV * 12) + '.', 40);
    // 5. assinaturas
    const assin = (r.cats['Streaming'] || 0) + (r.cats['Assinaturas'] || 0) + (r.cats['Games'] || 0);
    if (assin >= 80) add('dica', '🔄', 'Assinaturas: ' + brl0(assin * 12) + ' por ano', 'Streaming, assinaturas e games somaram ' + brl0(assin) + ' no mês. Revisem o que ninguém usou nos últimos 30 dias.', 35);
    // 6. juros e tarifas
    const juros = (r.cats['Juros, tarifas e outros'] || 0) + (r.cats['Anuidade de cartão'] || 0);
    if (juros > 0) { add('alerta', '🔥', 'Dinheiro jogado fora', brl(juros) + ' em juros, tarifas e anuidade. Peça isenção da anuidade (a maioria dos bancos negocia) e evite atraso e rotativo.', 80); pen(10, 'Pagando juros ou tarifas'); }
    // 7. peso das dívidas
    const dividas = (r.cats['Empréstimos'] || 0) + (r.cats['Financiamentos'] || 0);
    if (recMedia > 0 && dividas / recMedia > 0.15) {
      add('alerta', '🏦', 'Dívidas pesando', pct(dividas / recMedia) + ' da receita foi para empréstimos e financiamentos (' + brl0(dividas) + '). Priorizem quitar os de juros mais altos e evitem novos parcelamentos até baixar de 15%.', 85);
      pen(12, 'Empréstimos acima de 15% da receita');
    }
    // 8. comprometimento futuro
    const parcProx = soma(movs.filter(m => m.ym === hojeYm() + 1 && m.n > 1 && m.tipo === 'D'), m => m.valor);
    if (recMedia > 0 && parcProx / recMedia > 0.2) {
      const grave = parcProx / recMedia > 0.3;
      add(grave ? 'alerta' : 'atencao', '📅', MESES[ymM(hojeYm() + 1) - 1] + ' já começa comprometido', brl0(parcProx) + ' em parcelas já contratadas, ' + pct(parcProx / recMedia) + ' da receita média. ' + (grave ? 'Segurem novas compras parceladas.' : 'Atenção antes de parcelar mais.'), grave ? 90 : 65);
      pen(grave ? 15 : 8, 'Parcelas futuras acima de ' + (grave ? '30%' : '20%') + ' da receita');
    }
    // 9. limite dos cartões
    let pior = 0;
    cartoes().filter(c => c.ativo && c.limite).forEach(c => {
      const s = statusCartao(c);
      pior = Math.max(pior, s.uso);
      if (s.uso >= 0.6) add(s.uso >= 0.8 ? 'alerta' : 'atencao', '💳', c.nome + ' com ' + pct(s.uso) + ' do limite', brl0(s.usado) + ' comprometidos de ' + brl0(c.limite) + '. Sobram ' + brl0(s.livre) + '. ' + (s.uso >= 0.8 ? 'Evitem usar este cartão até baixar.' : 'Prefiram outro cartão ou PIX por enquanto.'), s.uso >= 0.8 ? 75 : 55);
    });
    if (pior >= 0.8) pen(10, 'Cartão acima de 80% do limite'); else if (pior >= 0.6) pen(5, 'Cartão acima de 60% do limite');
    // 10. parcelinhas
    const noventa = new Date(); noventa.setDate(noventa.getDate() - 90);
    const lim = isoDe(noventa);
    const parcelinhas = ((state.dados && state.dados.lanc) || []).filter(x => x.f === 'Crédito' && x.n > 1 && x.v / x.n < 50 && x.d >= lim);
    if (parcelinhas.length >= 3) add('dica', '🧩', 'Muitas parcelinhas', parcelinhas.length + ' compras parceladas com parcela abaixo de R$ 50 nos últimos 90 dias, somando ' + brl0(soma(parcelinhas, x => x.v / x.n)) + ' por mês. Para valores pequenos, à vista evita a bola de neve.', 45);
    // 11. melhor dia de compra
    const comFech = cartoes().filter(c => c.ativo && c.fech);
    if (comFech.length) add('dica', '🗓️', 'Melhor dia para comprar', comFech.map(c => c.nome + ': a partir do dia ' + c.fech).join(' · ') + '. Comprando a partir do fechamento, o pagamento só vence cerca de 40 dias depois.', 20);
    else if (cartoes().some(c => c.ativo)) add('dica', '⚙️', 'Complete os cartões', 'Cadastre o dia de fechamento e vencimento dos cartões (aba Cartões). Assim o app prevê em qual fatura cada compra cai.', 25);
    // 12. formas de pagamento
    const credito = r.formas['Crédito'] || 0, dinheiro = r.formas['Dinheiro'] || 0;
    if (desp > 0 && credito / desp > 0.7 && pior >= 0.5) add('dica', '🔁', 'Crédito demais no dia a dia', pct(credito / desp) + ' das despesas foram no crédito. Para o miúdo (mercado, lanche, Uber), PIX ou débito ajuda a ver o dinheiro saindo na hora.', 40);
    if (desp > 0 && dinheiro / desp > 0.15) add('dica', '💵', 'Dinheiro vivo some', pct(dinheiro / desp) + ' das despesas foram em dinheiro (' + brl0(dinheiro) + '). Lancem na hora ou prefiram PIX, que deixa rastro.', 30);
    // 13. reserva
    const poupou = soma([r].concat(anteriores), x => x.nats['Poupança'] || 0);
    const essencialMed = soma([r].concat(anteriores), x => x.nats['Essencial'] || 0) / (anteriores.length + 1);
    if (poupou === 0 && r.saldo > 100) { add('dica', '🛟', 'Comece a reserva de emergência', 'Sobraram ' + brl0(r.saldo) + '. Separem metade (' + brl0(r.saldo / 2) + ') e lancem em Investimentos > Reserva de emergência. Meta: 6 meses de gastos essenciais, cerca de ' + brl0(essencialMed * 6) + '.', 55); pen(5, 'Sem aportes em reserva/investimentos'); }
    else if (poupou === 0) pen(5, 'Sem aportes em reserva/investimentos');
    else if ((r.nats['Poupança'] || 0) > 0) add('parabens', '📈', 'Aporte feito', brl0(r.nats['Poupança']) + ' foram para reserva e investimentos neste mês.', 10);
    // 14. 50/30/20
    if (rec > 0) {
      const ess = (r.nats['Essencial'] || 0) / rec, est = (r.nats['Estilo de vida'] || 0) / rec;
      if (ess > 0.6) { add('atencao', '🏠', 'Custo essencial alto', 'Os gastos essenciais levam ' + pct(ess) + ' da receita (o recomendado é até 50%). Renegociar contas fixas (internet, plano, seguro) costuma render mais que cortar lazer.', 50); pen(6, 'Essenciais acima de 60% da receita'); }
      if (est > 0.35) {
        const topL = Object.entries(r.cats).filter(([c]) => (cats.get(c) || {}).nat === 'Estilo de vida' && c !== 'Outros gastos').sort((a, b) => b[1] - a[1])[0];
        add('atencao', '⚖️', 'Estilo de vida acima de 30%', 'Lazer, delivery e compras somaram ' + pct(est) + ' da receita.' + (topL ? ' Cortando 15% de ' + topL[0] + ', sobram ' + brl0(topL[1] * 0.15) + ' por mês (' + brl0(topL[1] * 0.15 * 12) + ' no ano) para a reserva.' : ''), 55);
      }
    }
    // 15. "outros gastos"
    const outros = r.cats['Outros gastos'] || 0;
    if (desp > 0 && outros / desp > 0.1) { add('dica', '🏷️', 'Muita coisa em "Outros gastos"', brl0(outros) + ' (' + pct(outros / desp) + ' das despesas) sem categoria definida. Categorizar melhor ajuda o app a achar onde economizar.', 35); pen(4, '"Outros gastos" acima de 10%'); }
    // 16. metas por categoria
    ((state.dados && state.dados.categorias) || []).filter(c => c.meta > 0 && r.cats[c.c]).forEach(c => {
      const v = r.cats[c.c];
      if (v >= c.meta) add('alerta', c.i, 'Meta de ' + c.c + ' estourada', brl0(v) + ' de ' + brl0(c.meta) + ' (' + pct(v / c.meta) + ').', 88);
      else if (v >= c.meta * 0.8) add('atencao', c.i, c.c + ' perto da meta', brl0(v) + ' de ' + brl0(c.meta) + '. Restam ' + brl0(c.meta - v) + ' até o fim do mês.', 62);
    });
    // 17. esquecimento
    if (ehAtual) {
      const ult = ((state.dados && state.dados.lanc) || []).reduce((m, x) => x.d > m && x.d <= isoHoje() ? x.d : m, '');
      if (ult) {
        const dias = Math.round((new Date(isoHoje()) - new Date(ult)) / 864e5);
        if (dias >= 4) add('dica', '⏰', 'Faz ' + dias + ' dias sem lançamento', 'O último foi em ' + dataLonga(ult) + '. Lançar na hora (leva 10 segundos) é o que mantém o painel confiável.', 58);
      }
    }
    // 18. fatura que vem
    const prox = hojeYm() + 1;
    const fatProx = soma(movs.filter(m => m.cartao && m.ym === prox && m.tipo === 'D'), m => m.valor);
    const fatMed = soma([0, 1, 2].map(k => soma(movs.filter(m => m.cartao && m.ym === hojeYm() - k && m.tipo === 'D'), m => m.valor))) / 3;
    if (fatProx > 300 && fatMed > 0 && fatProx > fatMed * 1.25) add('atencao', '📬', 'Faturas de ' + MES3[ymM(prox) - 1] + ' vêm mais altas', brl0(fatProx) + ' já previstos, contra média de ' + brl0(fatMed) + '. Reservem esse valor desde já.', 60);
    // sem categoria
    if (r.semCat) add('dica', '❓', 'Categoria desconhecida', r.semCat + ' lançamento(s) com categoria que não existe na aba Categorias.', 30);

    nota = Math.max(0, Math.min(100, Math.round(nota)));
    const rotulo = nota >= 85 ? 'Céu de brigadeiro' : nota >= 70 ? 'Voo de cruzeiro' : nota >= 50 ? 'Turbulência leve' : nota >= 30 ? 'Turbulência forte' : 'Arremeter!';
    const ordem = { alerta: 0, atencao: 1, dica: 2, parabens: 3 };
    dicas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || b.peso - a.peso);
    return { nota, rotulo, fatores, dicas, temDados: r.n > 0 };
  }

  // =========================================================== ícones
  const I = {
    plane: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M6.5 15.2 25.5 7.5l-4.7 17-5.3-4.6-3.7 3.2.4-5.3 9.6-8.5-11.1 7.1z" fill="var(--bg)"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
    left: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>'
  };
  const NIVEL = { alerta: ['Alerta', '⛔'], atencao: ['Atenção', '⚠️'], dica: ['Dica', '💡'], parabens: ['Parabéns', '✅'] };

  // =========================================================== renderização
  const $app = document.getElementById('app');
  function render() {
    if (!state.token) { $app.innerHTML = telaLogin(); return; }
    if (!state.dados) { $app.innerHTML = '<div class="boot"><div><div class="spinner" style="margin:0 auto"></div><p class="muted" style="margin-top:14px">Carregando a planilha…</p></div></div>'; return; }
    const telas = { inicio: telaInicio, cartoes: telaCartoes, lancar: telaLancar, historico: telaHistorico, dicas: telaDicas, cartaoForm: telaCartaoForm };
    $app.innerHTML = topo() + (telas[state.tela] || telaInicio)() + tabbar();
    if (state.tela === 'inicio') desenharGrafico12();
  }
  function irPara(tela) { state.tela = tela; render(); window.scrollTo(0, 0); }

  function topo() {
    const pend = state.fila.length;
    return '<header class="top"><div class="brand">' + I.plane + '<span>Diário de Bordo</span></div><div class="grow"></div>' +
      '<button class="icon-btn' + (state.carregando ? ' spin' : '') + '" id="btn-refresh" data-a="refresh" aria-label="Atualizar">' + I.refresh + (pend || state.offline ? '<span class="dot"></span>' : '') + '</button>' +
      '<button class="icon-btn" data-a="menu" aria-label="Menu">' + I.gear + '</button></header>';
  }
  function atualizarTopo() { const b = document.getElementById('btn-refresh'); if (b) b.classList.toggle('spin', state.carregando); }

  function navMes() {
    const atual = state.ym === hojeYm();
    return '<div class="month-nav"><button data-a="mes" data-v="-1" aria-label="Mês anterior">' + I.left + '</button>' +
      '<div class="label">' + ymLabel(state.ym) + '<small>' + (atual ? 'mês atual' : '<span data-a="mes-hoje" class="u">voltar para hoje</span>') + '</small></div>' +
      '<button data-a="mes" data-v="1" aria-label="Próximo mês">' + I.right + '</button></div>';
  }

  function tabbar() {
    const t = state.tela === 'cartaoForm' ? 'cartoes' : state.tela;
    const tab = (id, ic, nome) => '<button class="tab" data-a="tela" data-v="' + id + '"' + (t === id ? ' aria-current="page"' : '') + '>' + ic + nome + '</button>';
    return '<nav class="tabbar" aria-label="Navegação"><div class="in five">' + tab('inicio', I.home, 'Início') + tab('cartoes', I.card, 'Cartões') +
      '<button class="tab add" data-a="novo"' + (t === 'lancar' ? ' aria-current="page"' : '') + ' aria-label="Lançar"><span class="plus">' + I.plus + '</span></button>' +
      tab('historico', I.list, 'Histórico') + tab('dicas', I.bulb, 'Dicas') + '</div></nav>';
  }

  // ------------------------------------------------------------ login
  function telaLogin() {
    const us = C.USUARIOS || ['Vlad', 'Mariana'];
    const sel = state.loginUser;
    return '<div class="login"><div class="logo">' + I.plane + '<h1>Diário de Bordo</h1><p>As finanças da casa, num lugar só.</p></div>' +
      '<div class="field"><span class="lbl">Quem está entrando?</span><div class="who">' +
      us.map(u => '<button data-a="login-user" data-v="' + esc(u) + '" aria-pressed="' + (sel === u) + '">' + esc(u) + '</button>').join('') + '</div></div>' +
      '<form class="field" data-form="login"><label for="pin">PIN</label>' +
      '<input id="pin" class="input pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="8" placeholder="••••" required>' +
      '<div class="err">' + esc(state.loginErro) + '</div><button class="btn" type="submit"' + (sel ? '' : ' disabled') + '>Entrar</button></form></div>';
  }
  async function entrar(pin) {
    const btn = $app.querySelector('form[data-form="login"] button');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
    try {
      const j = await api('login', { usuario: state.loginUser, pin });
      state.token = j.token; state.user = j.usuario;
      store.set(K.token, j.token); store.set(K.user, j.usuario);
      state.loginErro = ''; state.form = novoForm();
      render(); carregar();
    } catch (e) {
      state.loginErro = e.rede ? 'Sem conexão com a internet.' : e.message;
      render(); const p = document.getElementById('pin'); if (p) p.focus();
    }
  }

  // ------------------------------------------------------------ início
  function telaInicio() {
    const movs = movimentos(), ym = state.ym;
    const r = resumoMes(movs, ym), ant = resumoMes(movs, ym - 1);
    let h = navMes();
    if (!r.n) {
      return h + '<div class="card"><div class="empty">Nada lançado em ' + mesNome(ym) + ' ainda.<br><br><button class="btn" style="max-width:240px" data-a="novo">Fazer o primeiro lançamento</button></div></div>' +
        cardFaturasResumo(movs) + cardDoze(movs);
    }
    const neg = r.saldo < 0;
    const delta = (a, b) => b ? (a - b) / b : NaN;
    const seta = v => !isFinite(v) ? '&nbsp;' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + pct(Math.abs(v)) + ' vs ' + MES3[ymM(ym - 1) - 1];
    h += '<section class="card hero"><div class="eyebrow">Saldo de ' + mesNome(ym) + '</div>' +
      '<div class="big num' + (neg ? ' neg' : '') + '">' + (neg ? '− ' : '') + brl(Math.abs(r.saldo)) + '</div>' +
      '<div class="note">' + (r.rec <= 0 ? 'Sem receitas lançadas neste mês.' : neg ? '▼ As despesas passaram as receitas.' : 'Vocês guardaram ' + pct(r.taxa) + ' da receita.') + '</div>' +
      '<div class="split"><div class="stat"><div class="k"><i style="background:var(--rec)"></i>Receitas</div><div class="v num">' + brl(r.rec) + '</div><div class="d">' + seta(delta(r.rec, ant.rec)) + '</div></div>' +
      '<div class="stat"><div class="k"><i style="background:var(--desp)"></i>Despesas</div><div class="v num">' + brl(r.desp) + '</div><div class="d">' + seta(delta(r.desp, ant.desp)) + '</div></div></div></section>';

    // dicas em destaque
    const D = gerarDicas(ym);
    const top = D.dicas.filter(x => x.nivel !== 'parabens').slice(0, 2);
    const elogio = D.dicas.find(x => x.nivel === 'parabens');
    const mostrar = top.length ? top : (elogio ? [elogio] : []);
    h += '<section class="card"><div class="card-head"><h2>Copiloto</h2><button class="link-btn" data-a="tela" data-v="dicas">ver tudo (' + D.dicas.length + ')</button></div>' +
      '<div class="score-row"><div class="score" style="--p:' + D.nota + '"><span class="num">' + D.nota + '</span></div><div><b>' + D.rotulo + '</b><div class="tiny">Nota de saúde financeira de ' + mesNome(ym) + '</div></div></div>' +
      (mostrar.length ? '<div class="tips">' + mostrar.map(cartaoDica).join('') + '</div>' : '') + '</section>';

    // natureza
    const nats = NAT_ORDEM.map(n => [n, r.nats[n] || 0]).filter(x => x[1] > 0);
    if (nats.length) {
      h += '<section class="card"><h2>Perfil dos gastos</h2><p class="sub">Regra 50/30/20: até 50% essencial, 30% estilo de vida, 20% guardado</p>' +
        '<div class="stack" role="img" aria-label="Divisão das despesas por natureza">' + nats.map(([n, v]) => '<span style="flex:' + v + ';background:' + NAT_COR[n] + '" title="' + esc(n) + '"></span>').join('') + '</div>' +
        '<div class="stack-legend">' + nats.map(([n, v]) => '<div><i style="background:' + NAT_COR[n] + '"></i><span>' + esc(n) + '</span><b class="num">' + brl0(v) + '</b><em>' + (r.rec ? pct(v / r.rec) + ' da receita' : pct(v / r.desp)) + '</em></div>').join('') + '</div></section>';
    }

    const grupos = Object.entries(r.grupos).sort((a, b) => b[1] - a[1]);
    h += '<section class="card"><h2>Para onde foi o dinheiro</h2><p class="sub">Despesas por grupo em ' + mesNome(ym) + '. Compras no crédito entram no mês da fatura.</p>' +
      barras(grupos.map(([g, v]) => [(GRUPO_ICONE[g] || '•') + ' ' + g, v]), r.desp) + '</section>';

    const cats = mapaCats();
    const lista = Object.entries(r.cats).sort((a, b) => b[1] - a[1]);
    const topC = lista.slice(0, 8).map(([c, v]) => { const k = cats.get(c) || {}; return [(k.i || '•') + ' ' + c, v, k.meta]; });
    if (lista.length > 8) topC.push(['Outras ' + (lista.length - 8), soma(lista.slice(8), x => x[1])]);
    h += '<section class="card"><h2>Maiores categorias</h2><p class="sub">Inclui as parcelas que caem neste mês</p>' + barras(topC, r.desp) + '</section>';

    h += cardDoze(movs) + cardFaturasResumo(movs) + cardCompromissos(movs);
    h += '<div class="two-col"><section class="card"><h2>Por responsável</h2><p class="sub">Despesas do mês</p>' + barras(Object.entries(r.resp).sort((a, b) => b[1] - a[1]), r.desp) + '</section>' +
      '<section class="card"><h2>Por forma de pagamento</h2><p class="sub">Despesas do mês</p>' + barras(Object.entries(r.formas).sort((a, b) => b[1] - a[1]), r.desp) + '</section></div>';
    return h;
  }

  function cartaoDica(d) {
    const [nome, simb] = NIVEL[d.nivel];
    return '<div class="tip-card ' + d.nivel + '"><div class="tip-ic" aria-hidden="true">' + d.icone + '</div><div class="tip-body">' +
      '<div class="tip-tag"><span aria-hidden="true">' + simb + '</span>' + nome + '</div><div class="tip-t">' + esc(d.titulo) + '</div><div class="tip-x">' + esc(d.texto) + '</div></div></div>';
  }

  function barras(pares, total, cls) {
    if (!pares.length) return '<div class="empty">Nada por aqui.</div>';
    const max = Math.max.apply(null, pares.map(p => p[1])) || 1;
    return '<div class="hbars">' + pares.map(([nome, v, meta]) => {
      const sobre = meta && v > meta;
      return '<div class="hbar"><div class="row"><span class="name">' + esc(nome) + (meta ? '<span class="meta-tag' + (sobre ? ' over' : '') + '">meta ' + brl0(meta) + '</span>' : '') + '</span>' +
        '<span class="val num">' + brl(v) + '<span>' + (total ? pct(v / total) : '') + '</span></span></div>' +
        '<div class="track"><div class="fill' + (cls === 'rec' ? ' rec' : '') + '" style="width:' + Math.max(0.5, v / max * 100).toFixed(1) + '%"></div></div></div>';
    }).join('') + '</div>';
  }

  function serie12(movs) {
    const ini = state.ym - 11, s = [];
    for (let i = 0; i < 12; i++) s.push({ ym: ini + i, rec: 0, desp: 0 });
    movs.forEach(m => { const i = m.ym - ini; if (i < 0 || i > 11) return; if (m.tipo === 'R') s[i].rec += m.valor; else s[i].desp += m.valor; });
    return s;
  }
  function cardDoze(movs) {
    const s = serie12(movs), tem = s.some(x => x.rec || x.desp);
    let h = '<section class="card"><div class="card-head"><h2>Últimos 12 meses</h2>' + (tem ? '<button class="link-btn" data-a="tabela12">' + (state.tabela12 ? 'ver gráfico' : 'ver tabela') + '</button>' : '') + '</div>' +
      '<p class="sub">Receitas e despesas até ' + ymCurto(state.ym) + '. Toque nas barras para ver os valores.</p>';
    if (!tem) return h + '<div class="empty">Sem dados no período.</div></section>';
    if (state.tabela12) {
      h += '<div class="scroll-x"><table class="tbl num"><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr></thead><tbody>' +
        s.slice().reverse().map(x => '<tr><td>' + ymCurto(x.ym) + '</td><td>' + brl0(x.rec) + '</td><td>' + brl0(x.desp) + '</td><td>' + brl0(x.rec - x.desp) + '</td></tr>').join('') + '</tbody></table></div>';
    } else {
      h += '<div class="legend"><span><i style="background:var(--rec)"></i>Receitas</span><span><i style="background:var(--desp)"></i>Despesas</span></div>' +
        '<div class="chart-wrap" id="chart12" role="img" aria-label="Receitas e despesas dos últimos 12 meses"></div>';
    }
    return h + '</section>';
  }
  function barraPath(x, w, yTop, yBase) {
    const r = Math.min(4, w / 2, Math.abs(yBase - yTop));
    if (yTop < yBase) return 'M' + x + ',' + yBase + 'V' + (yTop + r) + 'Q' + x + ',' + yTop + ' ' + (x + r) + ',' + yTop + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + yTop + ' ' + (x + w) + ',' + (yTop + r) + 'V' + yBase + 'Z';
    return 'M' + x + ',' + yBase + 'V' + (yTop - r) + 'Q' + x + ',' + yTop + ' ' + (x + r) + ',' + yTop + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + yTop + ' ' + (x + w) + ',' + (yTop - r) + 'V' + yBase + 'Z';
  }
  function escala(amp) {
    if (amp <= 0) return 1000;
    const bruto = amp / 4, p = Math.pow(10, Math.floor(Math.log10(bruto))), n = bruto / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function desenharGrafico12() {
    const el = document.getElementById('chart12');
    if (!el) return;
    const s = serie12(movimentos());
    const W = Math.max(280, el.clientWidth), H = 190, padL = 44, padR = 4, padT = 8, padB = 24;
    const vals = s.flatMap(x => [x.rec, x.desp]);
    const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
    const passo = escala(maxV - minV);
    const top = Math.ceil(maxV / passo) * passo || passo, bot = Math.floor(minV / passo) * passo;
    const y = v => padT + (top - v) / (top - bot) * (H - padT - padB);
    const slot = (W - padL - padR) / 12, bw = Math.max(3, Math.min(14, (slot - 6) / 2));
    let g = '<g class="grid">';
    for (let v = bot; v <= top + 1e-6; v += passo) g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text x="' + (padL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + (v === 0 ? '0' : compacto(v)) + '</text>';
    g += '</g>';
    let bands = '', bars = '', labs = '';
    const pulo = W < 360 ? 2 : 1;
    s.forEach((x, i) => {
      const cx = padL + slot * i + slot / 2, y0 = y(0);
      bands += '<rect class="band" data-i="' + i + '" x="' + (padL + slot * i).toFixed(1) + '" y="' + padT + '" width="' + slot.toFixed(1) + '" height="' + (H - padT - padB) + '" rx="6"/>';
      if (x.rec) bars += '<path d="' + barraPath(cx - bw - 1, bw, y(x.rec), y0) + '" fill="var(--rec)"/>';
      if (x.desp) bars += '<path d="' + barraPath(cx + 1, bw, y(x.desp), y0) + '" fill="var(--desp)"/>';
      const sel = x.ym === state.ym;
      if ((11 - i) % pulo === 0 || sel) labs += '<text class="xlab' + (sel ? ' sel' : '') + '" x="' + cx.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + MES3[ymM(x.ym) - 1] + '</text>';
    });
    const zero = '<line class="zero" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '">' + g + bands + bars + zero + labs + '</svg><div class="tip hidden"></div>';
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    const idx = cx => { const rect = svg.getBoundingClientRect(); return Math.floor(((cx - rect.left) * (W / rect.width) - padL) / slot); };
    const mostrar = cx => {
      const i = idx(cx), rect = svg.getBoundingClientRect();
      el.querySelectorAll('.band').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
      if (i < 0 || i > 11) { tip.classList.add('hidden'); return; }
      const x = s[i], saldo = x.rec - x.desp;
      tip.innerHTML = '<b>' + MESES[ymM(x.ym) - 1] + ' ' + ymY(x.ym) + '</b><div class="r"><span><i style="background:var(--rec)"></i>Receitas</span><span class="num">' + brl0(x.rec) + '</span></div>' +
        '<div class="r"><span><i style="background:var(--desp)"></i>Despesas</span><span class="num">' + brl0(x.desp) + '</span></div><div class="r"><span>Saldo</span><span class="num">' + (saldo < 0 ? '− ' : '') + brl0(Math.abs(saldo)) + '</span></div>';
      tip.classList.remove('hidden');
      const px = (padL + slot * i + slot / 2) * (rect.width / W), tw = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(px, tw / 2), rect.width - tw / 2) + 'px'; tip.style.top = '-6px';
    };
    svg.addEventListener('pointermove', e => mostrar(e.clientX));
    svg.addEventListener('pointerdown', e => mostrar(e.clientX));
    svg.addEventListener('pointerleave', () => { tip.classList.add('hidden'); el.querySelectorAll('.band').forEach(b => b.classList.remove('on')); });
    svg.addEventListener('dblclick', e => { const i = idx(e.clientX); if (i >= 0 && i < 12) { state.ym = s[i].ym; render(); } });
  }

  function cardFaturasResumo(movs) {
    const ini = hojeYm(), meses = [0, 1, 2, 3, 4, 5].map(k => ini + k);
    const tot = meses.map(ym => soma(movs.filter(m => m.cartao && m.ym === ym && m.tipo === 'D'), m => m.valor));
    if (!tot.some(Boolean)) return '';
    const max = Math.max(...tot) || 1;
    return '<section class="card"><div class="card-head"><h2>Faturas dos próximos meses</h2><button class="link-btn" data-a="tela" data-v="cartoes">por cartão</button></div>' +
      '<p class="sub">Soma de todos os cartões, pelo mês de vencimento</p><div class="mini-cols">' +
      meses.map((ym, i) => '<div class="mc"><span class="num">' + compacto(tot[i]) + '</span><div class="mc-bar"><i style="height:' + Math.max(3, tot[i] / max * 100).toFixed(0) + '%"></i></div><small>' + MES3[ymM(ym) - 1] + '</small></div>').join('') + '</div></section>';
  }

  function cardCompromissos(movs) {
    const agora = hojeYm();
    let total = 0, ultimo = 0, proxMes = 0;
    const ativos = new Set();
    movs.forEach(m => {
      if (m.n < 2 || m.ym <= agora || m.tipo === 'R') return;
      total += m.valor; ativos.add(m.lid || m.ref.cid);
      if (m.ym > ultimo) ultimo = m.ym;
      if (m.ym === agora + 1) proxMes += m.valor;
    });
    return '<div class="kpis"><div class="kpi"><div class="k">Parcelas a vencer</div><div class="v num">' + brl0(total) + '</div><div class="d">a partir de ' + ymCurto(agora + 1) + '</div></div>' +
      '<div class="kpi"><div class="k">Só em ' + MES3[ymM(agora + 1) - 1] + '</div><div class="v num">' + brl0(proxMes) + '</div><div class="d">em parcelas</div></div>' +
      '<div class="kpi"><div class="k">Parcelamentos ativos</div><div class="v num">' + ativos.size + '</div><div class="d">com parcela futura</div></div>' +
      '<div class="kpi"><div class="k">Última parcela</div><div class="v num">' + (ultimo ? ymCurto(ultimo) : '—') + '</div><div class="d">quando zera tudo</div></div></div>';
  }

  // ------------------------------------------------------------ cartões
  function corTexto(hex) {
    const n = parseInt((hex || '#333333').slice(1), 16);
    const l = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    return l > 0.62 ? '#141414' : '#ffffff';
  }
  function tileCartao(c, grande) {
    const s = statusCartao(c), fg = corTexto(c.cor);
    const fat = s.fat(s.atual);
    return '<button class="cc' + (grande ? ' big' : '') + (c.ativo ? '' : ' off') + '" data-a="' + (grande ? 'cartao-editar' : 'cartao-abrir') + '" data-v="' + esc(c.id) + '" style="--cc:' + esc(c.cor) + ';--cf:' + fg + '">' +
      '<div class="cc-top"><span class="cc-name">' + esc(c.nome) + '</span><span class="cc-band">' + esc(c.bandeira || '') + '</span></div>' +
      '<div class="cc-sub">' + esc([c.banco, c.titular].filter(Boolean).join(' · ')) + (c.ativo ? '' : ' · inativo') + '</div>' +
      '<div class="cc-mid"><small>Fatura de ' + MES3[ymM(s.atual) - 1] + (c.venc ? ' · vence dia ' + c.venc : '') + '</small><b class="num">' + brl(fat) + '</b></div>' +
      (c.limite ? '<div class="cc-lim"><div class="cc-track"><i style="width:' + Math.min(100, s.uso * 100).toFixed(0) + '%"></i></div><div class="cc-lim-t num"><span>' + pct(s.uso) + ' usado</span><span>livre ' + brl0(s.livre) + '</span></div></div>'
        : '<div class="cc-lim-t"><span>' + (grande ? 'Toque para cadastrar limite, fechamento e vencimento' : 'Limite não cadastrado') + '</span></div>') +
      '</button>';
  }

  function telaCartoes() {
    if (state.cartaoSel) return telaCartaoDetalhe();
    const todos = cartoes(), ativos = todos.filter(c => c.ativo), inativos = todos.filter(c => !c.ativo);
    const st = ativos.map(statusCartao);
    const totFat = soma(st, s => s.fat(hojeYm())), limTot = soma(ativos, c => c.limite || 0), livre = soma(st.filter(s => s.livre !== null), s => s.livre);
    let h = '<div class="page-head"><h1>Cartões</h1><button class="btn sm" data-a="cartao-novo">+ Cartão</button></div>';
    if (!todos.length) return h + '<div class="card"><div class="empty">Nenhum cartão cadastrado.<br><br><button class="btn" style="max-width:240px" data-a="cartao-novo">Cadastrar o primeiro</button></div></div>';
    h += '<div class="kpis"><div class="kpi"><div class="k">Faturas de ' + mesNome(hojeYm()) + '</div><div class="v num">' + brl0(totFat) + '</div><div class="d">todos os cartões</div></div>' +
      '<div class="kpi"><div class="k">Limite livre</div><div class="v num">' + (limTot ? brl0(livre) : '—') + '</div><div class="d">' + (limTot ? 'de ' + brl0(limTot) : 'cadastre os limites') + '</div></div></div>';
    h += '<div class="cc-list">' + ativos.map(c => tileCartao(c)).join('') + '</div>';
    if (inativos.length) h += '<div class="day">Inativos</div><div class="cc-list">' + inativos.map(c => tileCartao(c)).join('') + '</div>';
    return h;
  }

  function telaCartaoDetalhe() {
    const c = cartoes().find(x => x.id === state.cartaoSel);
    if (!c) { state.cartaoSel = null; return telaCartoes(); }
    const s = statusCartao(c);
    if (state.cartaoYm == null) state.cartaoYm = s.atual;
    const ini = Math.min(s.atual - 2, state.cartaoYm), meses = [];
    for (let k = 0; k < 14; k++) meses.push(ini + k);
    const vals = meses.map(s.fat), max = Math.max(...vals) || 1;
    const itens = s.movs.filter(m => m.ym === state.cartaoYm).sort((a, b) => b.valor - a.valor);
    let h = '<div class="page-head"><button class="icon-btn" data-a="cartao-voltar" aria-label="Voltar">' + I.back + '</button><h1>' + esc(c.nome) + '</h1></div>' +
      tileCartao(c, true);
    h += '<section class="card"><h2>Faturas</h2><p class="sub">Toque num mês para ver o que entra nele</p><div class="fat-cols">' +
      meses.map((ym, i) => '<button class="fc' + (ym === state.cartaoYm ? ' sel' : '') + (ym < s.atual ? ' past' : '') + '" data-a="cartao-mes" data-v="' + ym + '"><span class="num">' + (vals[i] ? compacto(vals[i]) : '–') + '</span><div class="mc-bar"><i style="height:' + Math.max(vals[i] ? 4 : 0, vals[i] / max * 100).toFixed(0) + '%"></i></div><small>' + MES3[ymM(ym) - 1] + '</small></button>').join('') + '</div></section>';
    h += '<section class="card"><div class="card-head"><h2>Fatura de ' + mesNome(state.cartaoYm) + ' ' + ymY(state.cartaoYm) + '</h2><b class="num">' + brl(s.fat(state.cartaoYm)) + '</b></div>' +
      '<p class="sub">' + itens.length + ' itens' + (c.venc ? ' · vence em ' + pad(c.venc) + '/' + pad(ymM(state.cartaoYm)) : '') + '</p>' +
      (itens.length ? '<div class="list flat">' + itens.map(itemLista).join('') + '</div>' : '<div class="empty">Nada nesta fatura.</div>') + '</section>';
    h += '<div class="actions-row"><button class="btn" data-a="novo-cartao" data-v="' + esc(c.nome) + '">Lançar neste cartão</button><button class="btn ghost" data-a="cartao-editar" data-v="' + esc(c.id) + '">Editar cartão</button></div>';
    return h;
  }

  const BANCOS = ['Nubank', 'Itaú', 'Mercado Pago', 'Inter', 'C6', 'Santander', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Pan', 'Renner', 'PicPay', 'XP', 'BTG', 'Outro'];
  const CORES = ['#820AD1', '#EC7000', '#00A6E0', '#FF7A00', '#1F1F1F', '#EC0000', '#CC092F', '#F8D117', '#005CA9', '#0B5AD9', '#C8102E', '#11C76F', '#0B2240', '#2E7D32', '#6D4C41', '#455A64'];
  const COR_BANCO = { 'Nubank': '#820AD1', 'Itaú': '#EC7000', 'Mercado Pago': '#00A6E0', 'Inter': '#FF7A00', 'C6': '#1F1F1F', 'Santander': '#EC0000', 'Bradesco': '#CC092F', 'Banco do Brasil': '#F8D117', 'Caixa': '#005CA9', 'Pan': '#0B5AD9', 'Renner': '#C8102E', 'PicPay': '#11C76F', 'XP': '#111111', 'BTG': '#0B2240' };

  function telaCartaoForm() {
    const f = state.cartaoForm;
    const prev = Object.assign({ ativo: true }, f, { limite: parseValor(f.limiteTxt), fech: +f.fech || 0, venc: +f.venc || 0 });
    const chip = (campo, v, txt) => '<button type="button" class="chip" data-a="cf" data-k="' + campo + '" data-v="' + esc(v) + '" aria-pressed="' + (String(f[campo]) === String(v)) + '">' + esc(txt || v) + '</button>';
    let h = '<div class="page-head"><button class="icon-btn" data-a="cartao-cancelar" aria-label="Voltar">' + I.back + '</button><h1>' + (f.id ? 'Editar cartão' : 'Novo cartão') + '</h1></div>' +
      '<div class="cc-preview" id="cc-preview">' + tileCartao(Object.assign({ nome: f.nome || 'Apelido do cartão', cor: f.cor || '#333333' }, prev), false).replace('data-a="cartao-abrir"', 'tabindex="-1"') + '</div>' +
      '<form class="form" data-form="cartao" novalidate>' +
      '<div class="field"><label for="cf-nome">Apelido</label><input id="cf-nome" class="input" data-cf="nome" maxlength="40" placeholder="Ex.: Nubank Mari" value="' + esc(f.nome) + '"></div>' +
      '<div class="field"><span class="lbl">Banco</span><div class="chips">' + BANCOS.map(b => chip('banco', b)).join('') + '</div></div>' +
      '<div class="row2"><div class="field"><span class="lbl">Titular</span><div class="chips">' + chip('titular', 'Vlad') + chip('titular', 'Mariana') + '</div></div>' +
      '<div class="field"><label for="cf-lim">Limite total</label><input id="cf-lim" class="input" data-cf="limiteTxt" inputmode="decimal" placeholder="R$ 0,00" value="' + esc(f.limiteTxt) + '"></div></div>' +
      '<div class="row2"><div class="field"><label for="cf-fech">Dia do fechamento</label><input id="cf-fech" class="input" data-cf="fech" inputmode="numeric" maxlength="2" placeholder="Ex.: 3" value="' + esc(f.fech || '') + '"></div>' +
      '<div class="field"><label for="cf-venc">Dia do vencimento</label><input id="cf-venc" class="input" data-cf="venc" inputmode="numeric" maxlength="2" placeholder="Ex.: 10" value="' + esc(f.venc || '') + '"></div></div>' +
      '<p class="tiny" style="margin:-6px 2px 0">Com fechamento e vencimento, o app calcula sozinho em qual fatura cada compra cai.</p>' +
      '<div class="field"><span class="lbl">Bandeira</span><div class="chips">' + ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'].map(b => chip('bandeira', b)).join('') + '</div></div>' +
      '<div class="field"><span class="lbl">Cor</span><div class="swatches">' + CORES.map(cor => '<button type="button" class="sw" data-a="cf" data-k="cor" data-v="' + cor + '" aria-pressed="' + (f.cor === cor) + '" style="background:' + cor + '" aria-label="Cor ' + cor + '"></button>').join('') + '</div></div>' +
      '<div class="field"><label for="cf-obs">Observações</label><input id="cf-obs" class="input" data-cf="obs" maxlength="200" placeholder="Ex.: anuidade isenta, cashback 1%" value="' + esc(f.obs) + '"></div>' +
      (f.id ? '<label class="switch"><input type="checkbox" data-cf="ativo"' + (f.ativo !== false ? ' checked' : '') + '><span>Cartão ativo</span></label>' : '') +
      '<button class="btn" type="submit"' + (state.salvando ? ' disabled' : '') + '>' + (state.salvando ? 'Salvando…' : 'Salvar cartão') + '</button>' +
      (f.id ? '<button class="btn ghost" type="button" data-a="cartao-excluir">Excluir cartão</button>' : '') + '</form>';
    return h;
  }
  function atualizarPreviewCartao() {
    const el = document.getElementById('cc-preview'); if (!el) return;
    const f = state.cartaoForm;
    el.innerHTML = tileCartao(Object.assign({ ativo: true }, f, { nome: f.nome || 'Apelido do cartão', cor: f.cor || '#333333', limite: parseValor(f.limiteTxt), fech: +f.fech || 0, venc: +f.venc || 0 }), false).replace('data-a="cartao-abrir"', 'tabindex="-1"');
  }
  async function salvarCartao() {
    const f = state.cartaoForm;
    if (!f.nome.trim()) return toast('Dê um apelido ao cartão.');
    const fech = +f.fech, venc = +f.venc;
    if ((f.fech && !(fech >= 1 && fech <= 31)) || (f.venc && !(venc >= 1 && venc <= 31))) return toast('Fechamento e vencimento são dias de 1 a 31.');
    const cartao = { id: f.id || undefined, nome: f.nome.trim(), banco: f.banco, titular: f.titular, bandeira: f.bandeira, limite: parseValor(f.limiteTxt), fech: fech || '', venc: venc || '', cor: f.cor, ativo: f.ativo !== false, obs: f.obs };
    state.salvando = true; render();
    try {
      const j = await api('salvarCartao', { cartao });
      toast('Cartão salvo ✓');
      state.cartaoSel = j.id; state.cartaoYm = null; state.tela = 'cartoes';
      await carregar(true);
    } catch (e) { toast(e.rede ? 'Sem conexão. Tente de novo quando a internet voltar.' : e.message); }
    finally { state.salvando = false; render(); }
  }
  async function excluirCartao(btn) {
    if (btn.dataset.ok !== '1') { btn.dataset.ok = '1'; btn.className = 'btn danger'; btn.textContent = 'Confirmar exclusão'; return; }
    try {
      const j = await api('excluirCartao', { id: state.cartaoForm.id });
      toast(j.arquivado ? 'Cartão com histórico: foi marcado como inativo.' : 'Cartão excluído.');
      state.cartaoSel = null; state.tela = 'cartoes';
      await carregar(true);
    } catch (e) { toast(e.rede ? 'Sem conexão.' : e.message); }
  }
  function abrirFormCartao(id) {
    const c = cartoes().find(x => x.id === id);
    state.cartaoForm = c ? { id: c.id, nome: c.nome, banco: c.banco, titular: c.titular, bandeira: c.bandeira, limiteTxt: c.limite ? fmtValorInput(c.limite) : '', fech: c.fech || '', venc: c.venc || '', cor: c.cor, ativo: c.ativo, obs: c.obs || '' }
      : { id: null, nome: '', banco: '', titular: state.user === 'Mariana' ? 'Mariana' : 'Vlad', bandeira: '', limiteTxt: '', fech: '', venc: '', cor: '#1F1F1F', ativo: true, obs: '' };
    irPara('cartaoForm');
  }

  // ------------------------------------------------------------ lançar
  function catsDoTipo(tipo) { return ((state.dados && state.dados.categorias) || []).filter(c => c.t === tipo); }
  function maisUsadas(tipo, n) {
    const lim = new Date(); lim.setDate(lim.getDate() - 120);
    const l = isoDe(lim), cont = {};
    const valid = new Set(catsDoTipo(tipo).map(c => c.c));
    ((state.dados && state.dados.lanc) || []).forEach(x => { if (x.d >= l && valid.has(x.c)) cont[x.c] = (cont[x.c] || 0) + (x.por === state.user ? 2 : 1); });
    const ord = Object.keys(cont).sort((a, b) => cont[b] - cont[a]);
    catsDoTipo(tipo).forEach(c => { if (ord.indexOf(c.c) < 0) ord.push(c.c); });
    return ord.slice(0, n);
  }
  function recalcFatura() {
    const f = state.form;
    if (f.forma !== 'Crédito' || f.fxManual) return;
    f.fx = ymStr(faturaDe(cartaoPorNome(f.cartao), f.data || isoHoje()));
  }

  function telaLancar() {
    const f = state.form, d = state.dados, cats = mapaCats();
    const receita = f.tipo === 'R';
    const formas = (d.formas || []).filter(x => !receita || !ehParcelavel(x));
    const parc = !receita && ehParcelavel(f.forma);
    const n = parc ? Math.max(1, parseInt(f.n, 10) || 1) : 1;
    const valorNum = parseValor(f.valor);
    const total = parc && n > 1 && f.modoValor === 'parcela' ? valorNum * n : valorNum;
    const catSel = cats.get(f.cat);
    const ativos = cartoes().filter(c => c.ativo);
    const card = cartaoPorNome(f.cartao);

    let h = '<form class="form" data-form="lancar" novalidate>' +
      (f.id ? '<div class="page-head"><button class="icon-btn" type="button" data-a="cancelar-edicao" aria-label="Voltar">' + I.back + '</button><h1>Editar lançamento</h1></div>' : '') +
      '<div class="seg" role="group" aria-label="Tipo"><button type="button" data-a="tipo" data-v="D" aria-pressed="' + !receita + '">Despesa</button><button type="button" data-a="tipo" data-v="R" aria-pressed="' + receita + '">Receita</button></div>' +
      '<div class="amount"><label for="f-valor">' + (parc && n > 1 && f.modoValor === 'parcela' ? 'Valor de cada parcela' : 'Valor') + '</label>' +
      '<div class="wrap"><span class="cur">R$</span><input id="f-valor" data-f="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.valor) + '"></div></div>';

    // categoria
    h += '<div class="field"><span class="lbl">Categoria</span>';
    if (catSel) h += '<button type="button" class="cat-pick sel" data-a="picker"><span class="ci">' + catSel.i + '</span><span><b>' + esc(catSel.c) + '</b><small>' + esc(catSel.g) + '</small></span><span class="chg">trocar</span></button>';
    else h += '<div class="chips">' + maisUsadas(f.tipo, 7).map(c => { const k = cats.get(c) || {}; return '<button type="button" class="chip" data-a="cat" data-v="' + esc(c) + '">' + (k.i || '') + ' ' + esc(c) + '</button>'; }).join('') +
      '<button type="button" class="chip strong" data-a="picker">Todas as categorias…</button></div>';
    h += '</div>';

    h += '<div class="field"><label for="f-desc">Descrição <span class="opt">(opcional)</span></label><input id="f-desc" class="input" data-f="desc" maxlength="80" list="dl-desc" autocomplete="off" placeholder="' + (receita ? 'Ex.: Salário novembro' : 'Ex.: Mercado da semana') + '" value="' + esc(f.desc) + '">' +
      '<datalist id="dl-desc">' + sugestoesDesc(f.cat).map(s => '<option value="' + esc(s) + '">').join('') + '</datalist></div>';

    // data
    const hoje = isoHoje(), ontem = isoOntem();
    h += '<div class="field"><span class="lbl">' + (f.forma === 'Crédito' ? 'Data da compra' : 'Data') + '</span><div class="date-row">' +
      '<button type="button" class="chip" data-a="data" data-v="' + hoje + '" aria-pressed="' + (f.data === hoje) + '">Hoje</button>' +
      '<button type="button" class="chip" data-a="data" data-v="' + ontem + '" aria-pressed="' + (f.data === ontem) + '">Ontem</button>' +
      '<input class="input" type="date" data-f="data" value="' + esc(f.data) + '" aria-label="Escolher data"></div></div>';

    // forma
    h += '<div class="field"><span class="lbl">' + (receita ? 'Recebido via' : 'Forma de pagamento') + '</span><div class="chips">' +
      formas.map(x => '<button type="button" class="chip" data-a="forma" data-v="' + esc(x) + '" aria-pressed="' + (x === f.forma) + '">' + esc(x) + '</button>').join('') + '</div></div>';

    if (!receita && f.forma === 'Crédito') {
      h += '<div class="field"><span class="lbl">Cartão</span>' + (ativos.length
        ? '<div class="chips">' + ativos.map(c => '<button type="button" class="chip" data-a="cartao" data-v="' + esc(c.nome) + '" aria-pressed="' + (c.nome === f.cartao) + '"><i class="dotc" style="background:' + esc(c.cor) + '"></i>' + esc(c.nome) + '</button>').join('') + '</div>'
        : '<button type="button" class="chip strong" data-a="cartao-novo">+ Cadastrar um cartão</button>') + '</div>';
    }
    if (parc) {
      h += '<div class="field"><span class="lbl">Parcelas</span><div class="chips">' + [1, 2, 3, 4, 5, 6, 10, 12].map(k => '<button type="button" class="chip num" data-a="n" data-v="' + k + '" aria-pressed="' + (n === k) + '">' + (k === 1 ? 'À vista' : k + 'x') + '</button>').join('') +
        '<div class="stepper mini"><button type="button" data-a="n-menos" aria-label="Menos">−</button><input data-f="n" inputmode="numeric" value="' + n + '" aria-label="Parcelas"><button type="button" data-a="n-mais" aria-label="Mais">+</button></div></div></div>';
      if (n > 1) h += '<div class="seg"><button type="button" data-a="modo" data-v="total" aria-pressed="' + (f.modoValor === 'total') + '">Valor total</button><button type="button" data-a="modo" data-v="parcela" aria-pressed="' + (f.modoValor === 'parcela') + '">Valor da parcela</button></div>';
    }
    if (!receita && f.forma === 'Crédito' && f.cartao) {
      const fx = f.fx ? ymDeStr(f.fx) : faturaDe(card, f.data || hoje);
      h += '<div class="fatura-box"><div><small>Entra na fatura de</small><b>' + MESES[ymM(fx) - 1] + ' ' + ymY(fx) + '</b>' +
        '<span class="tiny">' + (card && card.fech ? (card.venc ? 'vence dia ' + card.venc : 'fecha dia ' + card.fech) + (f.fxManual ? ' · ajustado à mão' : ' · calculado pelo fechamento') : 'cadastre o fechamento do cartão para calcular sozinho') + '</span></div>' +
        '<div class="fx-btns"><button type="button" data-a="fx" data-v="-1" aria-label="Fatura anterior">' + I.left + '</button><button type="button" data-a="fx" data-v="1" aria-label="Próxima fatura">' + I.right + '</button></div></div>';
    }
    if (parc && n > 1) h += '<div class="preview" id="preview">' + textoPreview(total, n, f) + '</div>';

    h += '<div class="field"><span class="lbl">Responsável</span><div class="chips">' +
      (d.responsaveis || []).map(x => '<button type="button" class="chip" data-a="resp" data-v="' + esc(x) + '" aria-pressed="' + (x === f.resp) + '">' + esc(x) + '</button>').join('') + '</div></div>';

    h += '<button class="btn" type="submit"' + (state.salvando ? ' disabled' : '') + '>' + (state.salvando ? 'Salvando…' : f.id ? 'Salvar alterações' : 'Lançar') + '</button>' +
      (f.id ? '<button class="btn ghost" type="button" data-a="cancelar-edicao">Cancelar</button>' : '') + '</form>';
    return h;
  }

  function sugestoesDesc(cat) {
    const cont = {};
    ((state.dados && state.dados.lanc) || []).forEach(x => { if ((!cat || x.c === cat) && x.ds) cont[x.ds] = (cont[x.ds] || 0) + 1; });
    return Object.keys(cont).sort((a, b) => cont[b] - cont[a]).slice(0, 12);
  }
  function textoPreview(total, n, f) {
    if (!(total > 0)) return 'Informe o valor para ver as parcelas.';
    const base = f.forma === 'Crédito' ? (f.fx ? ymDeStr(f.fx) : faturaDe(cartaoPorNome(f.cartao), f.data || isoHoje())) : ymDeStr(f.data || isoHoje());
    return '<b>' + n + 'x de ' + brl(total / n) + '</b> · total ' + brl(total) + '<br>de ' + ymCurto(base) + ' a ' + ymCurto(base + n - 1) + (f.forma === 'Crédito' ? ', nas faturas do cartão.' : '.');
  }

  async function salvarLancamento() {
    const f = state.form, receita = f.tipo === 'R';
    const parc = !receita && ehParcelavel(f.forma);
    const n = parc ? Math.max(1, Math.min(72, parseInt(f.n, 10) || 1)) : 1;
    const v = parseValor(f.valor);
    const total = parc && n > 1 && f.modoValor === 'parcela' ? Math.round(v * n * 100) / 100 : v;
    if (!(total > 0)) return toast('Informe o valor.');
    if (!f.cat) return toast('Escolha a categoria.');
    if (!f.data) return toast('Informe a data.');
    if (!receita && f.forma === 'Crédito' && !f.cartao && cartoes().some(c => c.ativo)) return toast('Escolha o cartão.');
    const credito = !receita && f.forma === 'Crédito';
    const item = { cid: uid(), id: f.id || undefined, d: f.data, c: f.cat, ds: f.desc.trim(), v: total, f: f.forma, n,
      k: credito ? f.cartao : '', fx: credito ? (f.fx || ymStr(faturaDe(cartaoPorNome(f.cartao), f.data))) : '', p: f.resp };
    state.salvando = true; render();
    try {
      await api('salvar', { item });
      const mesBase = credito ? ymDeStr(item.fx) : ymDeStr(item.d);
      const ondeCai = mesBase !== hojeYm() ? ' · ' + (n > 1 ? '1ª parcela em ' : 'entra em ') + ymCurto(mesBase) : '';
      toast((f.id ? 'Alterações salvas ✓' : (n > 1 ? 'Lançado em ' + n + 'x ✓' : 'Lançado ✓')) + ondeCai);
      const editando = !!f.id;
      reiniciarForm();
      await carregar(true);
      if (editando) { state.tela = state.voltarPara || 'historico'; render(); }
    } catch (e) {
      if (e.rede && !f.id) {
        state.fila.push(item); store.set(K.fila, state.fila);
        toast('Sem conexão. Guardado no aparelho; sobe sozinho quando a internet voltar.');
        reiniciarForm();
      } else if (e.auth) sair(true);
      else toast(e.rede ? 'Editar precisa de internet. Tente de novo.' : e.message);
    } finally { state.salvando = false; render(); }
  }
  function reiniciarForm() {
    const f = state.form;
    state.form = novoForm(f.id ? {} : { tipo: f.tipo, data: f.data, resp: f.resp, forma: f.forma, cartao: f.cartao });
    if (state.form.forma === 'Crédito') recalcFatura();
  }
  function editarLancamento(lid, duplicar) {
    const x = ((state.dados && state.dados.lanc) || []).find(l => l.id === lid);
    if (!x) return;
    const cat = mapaCats().get(x.c);
    state.form = novoForm({ id: duplicar ? null : x.id, tipo: cat ? cat.t : x.t, valor: fmtValorInput(x.v), data: duplicar ? isoHoje() : x.d, cat: x.c, desc: x.ds || '',
      resp: x.p || respPadrao(), forma: x.f || 'PIX', n: x.n || 1, modoValor: 'total', cartao: x.k || '', fx: duplicar ? '' : (x.fx || ''), fxManual: !duplicar && !!x.fx });
    if (duplicar) recalcFatura();
    state.voltarPara = state.tela;
    fecharSheet(); irPara('lancar');
  }

  // ------------------------------------------------------------ histórico
  function itemLista(m) {
    const sub = [m.desc, m.resp, m.forma === 'Crédito' && m.cartao ? m.cartao : m.forma].filter(Boolean).join(' · ');
    return '<button class="item" data-a="detalhe" data-v="' + esc(m.id) + '"><span class="ic" aria-hidden="true">' + m.icone + '</span>' +
      '<span class="mid"><span class="t">' + esc(m.cat) + (m.parcela ? '<span class="tag">' + m.parcela + '</span>' : '') + (m.pend ? '<span class="tag wait">pendente</span>' : '') + '</span><span class="s">' + esc(sub || '—') + '</span></span>' +
      '<span class="v num' + (m.tipo === 'R' ? ' rec' : '') + '">' + (m.tipo === 'R' ? '+' : '') + brl(m.valor) + '</span></button>';
  }
  function telaHistorico() {
    const q = state.busca.trim().toLowerCase();
    const movs = movimentos().filter(m => m.ym === state.ym).filter(m => {
      if (state.filtro === 'desp' && m.tipo !== 'D') return false;
      if (state.filtro === 'rec' && m.tipo !== 'R') return false;
      if (state.filtro === 'credito' && m.forma !== 'Crédito') return false;
      if (state.filtro === 'parc' && !m.parcela) return false;
      if (state.filtro === 'meus' && m.ref.por !== state.user) return false;
      if (state.filtro === 'pend' && !m.pend) return false;
      if (!q) return true;
      return [m.cat, m.desc, m.resp, m.forma, m.cartao, m.grupo].some(s => String(s || '').toLowerCase().indexOf(q) >= 0) || m.valor.toFixed(2).replace('.', ',').indexOf(q) >= 0;
    }).sort((a, b) => b.iso.localeCompare(a.iso) || b.valor - a.valor);
    const rec = soma(movs.filter(m => m.tipo === 'R'), m => m.valor), desp = soma(movs.filter(m => m.tipo === 'D'), m => m.valor);
    const chip = (v, t) => '<button class="chip" data-a="filtro" data-v="' + v + '" aria-pressed="' + (state.filtro === v) + '">' + t + '</button>';
    let h = navMes() + '<div class="search">' + I.search + '<input class="input" type="search" data-f="busca" placeholder="Buscar descrição, categoria, valor…" value="' + esc(state.busca) + '" aria-label="Buscar"></div>' +
      '<div class="filters">' + chip('todos', 'Todos') + chip('desp', 'Despesas') + chip('rec', 'Receitas') + chip('credito', 'Crédito') + chip('parc', 'Parcelas') + chip('meus', 'Lançados por mim') + (state.fila.length ? chip('pend', 'Pendentes (' + state.fila.length + ')') : '') + '</div>';
    if (!movs.length) return h + '<div class="card"><div class="empty">Nenhum registro encontrado.</div></div>';
    h += '<div class="totals-bar num"><span>' + movs.length + ' registros</span><span>+' + brl(rec) + ' · −' + brl(desp) + '</span></div>';
    let dia = '';
    movs.forEach(m => {
      if (m.iso !== dia) {
        if (dia) h += '</div>';
        dia = m.iso;
        const [y, mo, d] = m.iso.split('-').map(Number);
        h += '<div class="day">' + DIAS[new Date(y, mo - 1, d).getDay()] + ', ' + d + ' ' + MES3[mo - 1] + '</div><div class="list">';
      }
      h += itemLista(m);
    });
    return h + '</div>';
  }

  // ------------------------------------------------------------ dicas
  function telaDicas() {
    const D = gerarDicas(state.ym);
    let h = navMes();
    if (!D.temDados) return h + '<div class="card"><div class="empty">Sem lançamentos em ' + mesNome(state.ym) + ' para analisar.</div></div>';
    h += '<section class="card"><div class="score-row big"><div class="score" style="--p:' + D.nota + '"><span class="num">' + D.nota + '</span></div><div><div class="tiny">Nota de saúde financeira</div><b class="score-l">' + D.rotulo + '</b></div></div>' +
      (D.fatores.length ? '<div class="fatores">' + D.fatores.map(x => '<div><span>' + esc(x.txt) + '</span><b class="num">−' + x.pts + '</b></div>').join('') + '</div>' : '<p class="tiny">Nenhum ponto descontado neste mês. Mantenham assim.</p>') + '</section>';
    const grupos = [['alerta', 'Puxões de orelha'], ['atencao', 'Fique de olho'], ['dica', 'Sugestões'], ['parabens', 'Mandaram bem']];
    grupos.forEach(([nv, titulo]) => {
      const xs = D.dicas.filter(x => x.nivel === nv);
      if (xs.length) h += '<div class="day">' + titulo + '</div><div class="tips">' + xs.map(cartaoDica).join('') + '</div>';
    });
    h += '<p class="tiny" style="text-align:center;margin:18px 8px">As dicas são calculadas no próprio aparelho a partir dos lançamentos. Nada sai daqui.</p>';
    return h;
  }

  // =========================================================== folhas (bottom sheets)
  const $sheet = document.getElementById('sheet-root');
  let sheetCtx = null;
  function abrirSheet(html, ctx) {
    sheetCtx = ctx || null;
    $sheet.innerHTML = '<div class="scrim" data-a="fechar"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
  }
  function fecharSheet() { $sheet.innerHTML = ''; sheetCtx = null; }

  function abrirDetalhe(id) {
    const m = movimentos().find(x => x.id === id);
    if (!m) return;
    const x = m.ref;
    const kv = (k, v) => v ? '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>' : '';
    const acoes = m.pend ? '<button class="btn ghost" data-a="excluir">Remover da fila</button>'
      : '<div class="actions-row"><button class="btn" data-a="editar" data-v="' + esc(m.lid) + '">Editar</button><button class="btn ghost" data-a="duplicar" data-v="' + esc(m.lid) + '">Lançar de novo</button></div>' +
        '<button class="btn ghost" data-a="excluir">' + (m.n > 1 ? 'Excluir a compra inteira (' + m.n + 'x)' : 'Excluir') + '</button>';
    abrirSheet('<div class="det-head"><span class="ic">' + m.icone + '</span><div><h3>' + esc(m.cat) + '</h3><div class="tiny">' + esc(m.grupo) + ' · ' + esc(m.nat) + (m.pend ? ' · aguardando sincronizar' : '') + '</div></div></div>' +
      '<div class="big num">' + (m.tipo === 'R' ? '+' : '') + brl(m.valor) + (m.n > 1 ? '<small> parcela ' + m.parcela + '</small>' : '') + '</div>' +
      '<dl class="kv">' + kv('Data da compra', dataLonga(x.d)) + kv('Descrição', x.ds) + kv('Responsável', x.p) + kv('Pagamento', x.f) + kv('Cartão', m.cartao) +
      (m.forma === 'Crédito' ? kv('Fatura', MESES[ymM(m.ym) - 1] + ' ' + ymY(m.ym)) : '') +
      (m.n > 1 ? kv('Valor total', brl(x.v) + ' em ' + m.n + 'x') + kv('Última parcela', ymCurto(m.ym - m.i + m.n - 1)) : '') +
      kv('Lançado por', x.por) + '</dl><div class="actions">' + acoes + '<button class="btn ghost" data-a="fechar">Fechar</button></div>', { mov: m });
  }

  async function excluirAtual(btn) {
    const m = sheetCtx && sheetCtx.mov;
    if (!m) return;
    if (m.pend) { state.fila = state.fila.filter(q => q.cid !== m.ref.cid); store.set(K.fila, state.fila); fecharSheet(); toast('Removido da fila.'); render(); return; }
    if (!sheetCtx.confirmar) { sheetCtx.confirmar = true; btn.className = 'btn danger'; btn.textContent = m.n > 1 ? 'Confirmar: apagar as ' + m.n + ' parcelas' : 'Confirmar exclusão'; return; }
    btn.disabled = true; btn.textContent = 'Excluindo…';
    try { await api('excluir', { id: m.lid }); fecharSheet(); toast('Excluído.'); await carregar(true); }
    catch (e) {
      if (e.auth) { fecharSheet(); sair(true); return; }
      toast(e.rede ? 'Sem conexão. Tente quando a internet voltar.' : e.message);
      btn.disabled = false; btn.className = 'btn ghost'; btn.textContent = 'Tentar de novo'; sheetCtx.confirmar = false;
    }
  }

  function abrirPicker() {
    const tipo = state.form.tipo, cats = catsDoTipo(tipo);
    const grupos = {};
    cats.forEach(c => (grupos[c.g] = grupos[c.g] || []).push(c));
    const html = '<h3>Escolha a categoria</h3><div class="search" style="margin-top:12px">' + I.search + '<input class="input" type="search" id="picker-q" placeholder="Buscar categoria…" autocomplete="off"></div>' +
      '<div id="picker-list">' + Object.entries(grupos).map(([g, cs]) => '<div class="pk-g" data-g="' + esc(g) + '"><div class="day">' + (GRUPO_ICONE[g] || '') + ' ' + esc(g) + '</div><div class="pk-grid">' +
        cs.map(c => '<button class="pk" data-a="cat" data-v="' + esc(c.c) + '" data-busca="' + esc((c.c + ' ' + g).toLowerCase()) + '"><span>' + c.i + '</span>' + esc(c.c) + '</button>').join('') + '</div></div>').join('') + '</div>' +
      '<div class="actions" style="margin-top:16px"><button class="btn ghost" data-a="nova-cat">+ Criar categoria</button><button class="btn ghost" data-a="fechar">Fechar</button></div>';
    abrirSheet(html, { picker: true });
  }

  function abrirNovaCategoria() {
    const tipo = state.form.tipo;
    const grupos = [...new Set(catsDoTipo(tipo).map(c => c.g))];
    abrirSheet('<h3>Nova categoria</h3><form class="form" data-form="novacat" style="margin-top:12px">' +
      '<div class="field"><label for="nc-nome">Nome</label><input id="nc-nome" class="input" maxlength="40" placeholder="Ex.: Sócio torcedor" required></div>' +
      '<div class="row2"><div class="field"><label for="nc-ic">Emoji</label><input id="nc-ic" class="input" maxlength="4" placeholder="🐓"></div>' +
      '<div class="field"><label for="nc-g">Grupo</label><select id="nc-g" class="input">' + grupos.map(g => '<option>' + esc(g) + '</option>').join('') + '</select></div></div>' +
      (tipo === 'D' ? '<div class="field"><label for="nc-nat">Natureza (usada nas dicas)</label><select id="nc-nat" class="input"><option>Essencial</option><option selected>Estilo de vida</option><option>Dívidas e juros</option><option>Poupança</option></select></div>' : '') +
      '<button class="btn" type="submit">Criar e usar</button><button class="btn ghost" type="button" data-a="fechar">Cancelar</button></form>');
    setTimeout(() => { const i = document.getElementById('nc-nome'); if (i) i.focus(); }, 50);
  }
  async function criarCategoria(form) {
    const nome = form.querySelector('#nc-nome').value.trim();
    if (!nome) return toast('Dê um nome.');
    const categoria = { c: nome, i: form.querySelector('#nc-ic').value.trim() || '•', g: form.querySelector('#nc-g').value, t: state.form.tipo, nat: (form.querySelector('#nc-nat') || {}).value };
    try {
      await api('novaCategoria', { categoria });
      state.dados.categorias.push({ g: categoria.g, c: nome, i: categoria.i, t: categoria.t, nat: categoria.t === 'R' ? 'Receita' : categoria.nat, meta: 0 });
      state.dados.versaoLocal = (state.dados.versaoLocal || 0) + 1;
      store.set(K.dados, state.dados);
      state.form.cat = nome; fecharSheet(); render(); toast('Categoria criada ✓');
    } catch (e) { toast(e.rede ? 'Criar categoria precisa de internet.' : e.message); }
  }

  function abrirMenu() {
    const t = store.get(K.tema, 'auto');
    const quando = state.dados && state.dados.atualizadoEm ? new Date(state.dados.atualizadoEm) : null;
    const tema = (v, n) => '<button class="chip" data-a="tema" data-v="' + v + '" aria-pressed="' + (t === v) + '">' + n + '</button>';
    abrirSheet('<h3>Olá, ' + esc(state.user || '') + '</h3><div class="tiny">' + (quando ? 'Dados de ' + quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '') + (state.offline ? ' · offline' : '') + '</div>' +
      '<dl class="kv"><dt>Pendentes no aparelho</dt><dd>' + state.fila.length + '</dd><dt>Lançamentos</dt><dd>' + (state.dados ? state.dados.lanc.length : 0) + '</dd>' +
      '<dt>Cartões</dt><dd>' + cartoes().length + '</dd><dt>Categorias</dt><dd>' + ((state.dados && state.dados.categorias.length) || 0) + '</dd><dt>Versão</dt><dd>' + VERSAO + '</dd></dl>' +
      '<div class="field" style="margin-bottom:18px"><span class="lbl">Tema</span><div class="chips">' + tema('auto', 'Automático') + tema('light', 'Claro') + tema('dark', 'Escuro') + '</div></div>' +
      '<div class="actions">' + (state.fila.length ? '<button class="btn ghost" data-a="sync">Sincronizar pendentes agora</button>' : '') +
      (C.PLANILHA_URL ? '<a class="btn ghost linkbtn" href="' + esc(C.PLANILHA_URL) + '" target="_blank" rel="noopener">Abrir a planilha</a>' : '') +
      '<button class="btn ghost" data-a="sair">Sair deste aparelho</button><button class="btn" data-a="fechar">Fechar</button></div>');
  }

  // =========================================================== toast
  const $toast = document.getElementById('toast');
  let toastT = null;
  function toast(msg) { $toast.textContent = msg; $toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('on'), 3200); }

  // =========================================================== eventos
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a, v = el.dataset.v, f = state.form;
    switch (a) {
      case 'tela': state.cartaoSel = null; irPara(v); break;
      case 'novo': if (state.form.id) state.form = novoForm(); if (state.form.forma === 'Crédito') recalcFatura(); irPara('lancar'); break;
      case 'mes': state.ym += +v; render(); break;
      case 'mes-hoje': state.ym = hojeYm(); render(); break;
      case 'refresh': carregar(); break;
      case 'menu': abrirMenu(); break;
      case 'fechar': fecharSheet(); break;
      case 'tabela12': state.tabela12 = !state.tabela12; render(); break;
      case 'login-user': state.loginUser = v; state.loginErro = ''; render(); { const p = document.getElementById('pin'); if (p) p.focus(); } break;
      // formulário de lançamento
      case 'tipo': f.tipo = v; f.cat = ''; if (v === 'R' && ehParcelavel(f.forma)) f.forma = 'PIX'; render(); break;
      case 'cat': f.cat = v; fecharSheet(); render(); break;
      case 'picker': abrirPicker(); break;
      case 'nova-cat': abrirNovaCategoria(); break;
      case 'data': f.data = v; recalcFatura(); render(); break;
      case 'forma': f.forma = v; if (!ehParcelavel(v)) f.n = 1; if (v === 'Crédito') { if (!f.cartao) { const at = cartoes().filter(c => c.ativo); if (at.length === 1) f.cartao = at[0].nome; } f.fxManual = false; recalcFatura(); } render(); break;
      case 'cartao': f.cartao = v; f.fxManual = false; recalcFatura(); render(); break;
      case 'fx': { const base = f.fx ? ymDeStr(f.fx) : faturaDe(cartaoPorNome(f.cartao), f.data); f.fx = ymStr(base + +v); f.fxManual = true; render(); break; }
      case 'n': f.n = +v; render(); break;
      case 'n-menos': f.n = Math.max(1, (parseInt(f.n, 10) || 1) - 1); render(); break;
      case 'n-mais': f.n = Math.min(72, (parseInt(f.n, 10) || 1) + 1); render(); break;
      case 'modo': f.modoValor = v; render(); break;
      case 'resp': f.resp = v; render(); break;
      case 'cancelar-edicao': state.form = novoForm(); irPara(state.voltarPara || 'historico'); break;
      // histórico
      case 'filtro': state.filtro = v; render(); break;
      case 'detalhe': abrirDetalhe(v); break;
      case 'editar': editarLancamento(v, false); break;
      case 'duplicar': editarLancamento(v, true); break;
      case 'excluir': excluirAtual(el); break;
      // cartões
      case 'cartao-abrir': state.cartaoSel = v; state.cartaoYm = null; render(); window.scrollTo(0, 0); break;
      case 'cartao-voltar': state.cartaoSel = null; render(); break;
      case 'cartao-mes': state.cartaoYm = +v; render(); break;
      case 'cartao-novo': abrirFormCartao(null); break;
      case 'cartao-editar': abrirFormCartao(v); break;
      case 'cartao-cancelar': state.tela = 'cartoes'; render(); break;
      case 'cartao-excluir': excluirCartao(el); break;
      case 'novo-cartao': state.form = novoForm({ forma: 'Crédito', cartao: v }); recalcFatura(); irPara('lancar'); break;
      case 'cf': {
        const k = el.dataset.k, cf = state.cartaoForm;
        cf[k] = cf[k] === v && k !== 'cor' ? '' : v;
        if (k === 'banco' && COR_BANCO[v] && (!cf.cor || cf.cor === '#1F1F1F' || CORES.indexOf(cf.cor) >= 0)) cf.cor = COR_BANCO[v];
        if (k === 'banco' && !cf.nome && v !== 'Outro') cf.nome = v + (cf.titular ? ' ' + (cf.titular === 'Mariana' ? 'Mari' : cf.titular) : '');
        const y = window.scrollY; render(); window.scrollTo(0, y); break;
      }
      // menu
      case 'tema': store.set(K.tema, v); aplicarTema(); abrirMenu(); break;
      case 'sync': fecharSheet(); sincronizarFila(); break;
      case 'sair': fecharSheet(); sair(false); break;
    }
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'picker-q') {
      const q = el.value.trim().toLowerCase();
      document.querySelectorAll('#picker-list .pk').forEach(b => b.classList.toggle('hidden', !!q && b.dataset.busca.indexOf(q) < 0));
      document.querySelectorAll('#picker-list .pk-g').forEach(g => g.classList.toggle('hidden', !g.querySelector('.pk:not(.hidden)')));
      return;
    }
    if (el.dataset.cf) { state.cartaoForm[el.dataset.cf] = el.type === 'checkbox' ? el.checked : el.value; atualizarPreviewCartao(); return; }
    const k = el.dataset.f;
    if (!k) return;
    if (k === 'busca') {
      state.busca = el.value; const pos = el.selectionStart; render();
      const novo = $app.querySelector('[data-f="busca"]'); if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (_) {} }
      return;
    }
    state.form[k] = el.value;
    if (k === 'data') { recalcFatura(); render(); return; }
    if (k === 'valor' || k === 'n') {
      const p = document.getElementById('preview');
      if (p) { const fm = state.form, n = Math.max(1, parseInt(fm.n, 10) || 1), v = parseValor(fm.valor); p.innerHTML = textoPreview(fm.modoValor === 'parcela' ? v * n : v, n, fm); }
    }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.f === 'n') { state.form.n = Math.max(1, Math.min(72, parseInt(el.value, 10) || 1)); render(); }
    if (el.dataset.cf === 'ativo') state.cartaoForm.ativo = el.checked;
  });
  document.addEventListener('submit', e => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const tipo = form.dataset.form;
    if (tipo === 'login') {
      const pin = document.getElementById('pin').value.trim();
      if (!state.loginUser) { state.loginErro = 'Escolha quem está entrando.'; render(); return; }
      if (!/^\d{4,8}$/.test(pin)) { state.loginErro = 'O PIN tem de 4 a 8 números.'; render(); return; }
      entrar(pin);
    } else if (tipo === 'lancar') { if (!state.salvando) salvarLancamento(); }
    else if (tipo === 'cartao') { if (!state.salvando) salvarCartao(); }
    else if (tipo === 'novacat') criarCategoria(form);
  });

  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (state.tela === 'inicio') desenharGrafico12(); }, 150); });
  window.addEventListener('online', () => { state.offline = false; sincronizarFila(); carregar(true); });
  window.addEventListener('offline', () => { state.offline = true; render(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.token) return;
    const t = state.dados && state.dados.atualizadoEm ? Date.parse(state.dados.atualizadoEm) : 0;
    if (Date.now() - t > 60000) carregar(true);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharSheet(); });

  // =========================================================== modo demonstração (testes locais)
  let demo = null;
  async function demoApi(acao, x) {
    if (!demo) demo = await (await fetch('demo-data.json')).json();
    await new Promise(r => setTimeout(r, 120));
    const ok = o => Object.assign({ ok: true }, o);
    if (acao === 'login') return ok({ token: 'demo', usuario: x.usuario });
    if (acao === 'dados') return ok(Object.assign({}, demo, { atualizadoEm: new Date().toISOString() }));
    if (acao === 'salvar') {
      const it = x.item, cat = demo.categorias.find(c => c.c === it.c);
      const reg = { id: it.id || 'L' + uid(), d: it.d, t: cat ? cat.t : 'D', c: it.c, ds: it.ds, v: it.v, f: it.f, n: it.n || 1, k: it.k || '', fx: it.fx || '', p: it.p, por: state.user };
      const i = demo.lanc.findIndex(l => l.id === it.id);
      if (i >= 0) { reg.por = demo.lanc[i].por; demo.lanc[i] = reg; } else demo.lanc.push(reg);
      return ok({ id: reg.id });
    }
    if (acao === 'excluir') { demo.lanc = demo.lanc.filter(l => l.id !== x.id); return ok({}); }
    if (acao === 'salvarCartao') {
      const c = Object.assign({}, x.cartao, { limite: +x.cartao.limite || 0, fech: +x.cartao.fech || 0, venc: +x.cartao.venc || 0 });
      if (c.id) { const old = demo.cartoes.find(k => k.id === c.id); demo.lanc.forEach(l => { if (l.k === old.nome) l.k = c.nome; }); Object.assign(old, c); }
      else { c.id = 'C' + uid(); demo.cartoes.push(c); }
      return ok({ id: c.id });
    }
    if (acao === 'excluirCartao') { const c = demo.cartoes.find(k => k.id === x.id); c.ativo = false; return ok({ arquivado: true }); }
    if (acao === 'novaCategoria') { demo.categorias.push({ g: x.categoria.g, c: x.categoria.c, i: x.categoria.i, t: x.categoria.t, nat: x.categoria.nat || 'Receita', meta: 0 }); return ok({}); }
    return ok({});
  }

  // =========================================================== início
  aplicarTema();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
  if (state.token) carregar(!!state.dados);
})();
