
/* TENTATE MAS — app.js (web-final r18) */
const state = { config:null, products:[], cart:{}, quiz:null, promo:null };
const CART_KEY = 'tm_cart_v1';
const fmt = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });
const qs = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>[...r.querySelectorAll(s)];

function loadCart(){ try{ const raw=localStorage.getItem(CART_KEY); if(raw) state.cart = JSON.parse(raw); }catch(e){} }
function saveCart(){ localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); updateCartBadge(); }

async function bootstrap(){
  if (location.protocol === 'file:') {
    const el = document.querySelector('#catalog-error');
    if (el) {
      el.hidden = false;
      el.textContent = 'Estás abriendo el archivo directamente (file://). Para ver el catálogo, subilo a GitHub Pages o abrí un servidor local.';
    }
  }
  try{
    const [cfg, prods, quiz] = await Promise.all([
      fetch('data/config.json').then(r=>r.json()),
      fetch('data/products.json').then(r=>r.json()),
      fetch('data/tentate-magico.json').then(r=>r.json())
    ]);
    state.config = cfg; state.products = prods; state.quiz = quiz;
    loadCart(); updateCartBadge();
    hydrateUI();
  }catch(err){
    console.error('Error cargando datos:', err);
    const el = document.querySelector('#catalog-error');
    if (el) {
      el.hidden = false;
      el.textContent = 'No pudimos cargar /data/*.json. Verificá que estés usando un servidor (GitHub Pages o localhost).';
    }
  }
}

function hydrateUI(){
  const waNum = state.config?.whatsapp_number;
  if (waNum){ const url = `https://wa.me/${waNum}`; const a = qs('#wa-float'); if(a) a.href=url; const f = qs('#footer-wa'); if(f) f.href=url; }
  qs('#footer-horarios') && (qs('#footer-horarios').textContent = state.config?.mensajes?.horarios || '');
  qs('#envio-note') && (qs('#envio-note').textContent = state.config?.envio?.texto || '');
  qs('#year') && (qs('#year').textContent = new Date().getFullYear());
  const pago = qs('#c-pago');
  if (pago) (state.config?.formas_pago || []).forEach(opt=>{ const o=document.createElement('option'); o.value=opt; o.textContent=opt; pago.appendChild(o); });
  qs('#checkout-disclaimer') && (qs('#checkout-disclaimer').textContent = state.config?.mensajes?.disclaimer || '');
  buildAccordion();
  bindEvents();
}

function groupByCategory(list){ const m=new Map(); list.forEach(p=>{ if(!m.has(p.categoria)) m.set(p.categoria, []); m.get(p.categoria).push(p); }); return m; }
function filteredProducts(){
  const term=(qs('#search')?.value||'').trim().toLowerCase();
  const sort=qs('#sort')?.value||'ventas';
  let arr=state.products.filter(p => p.nombre.toLowerCase().includes(term) || p.descripcion.toLowerCase().includes(term));
  if (sort==='price-asc') arr.sort((a,b)=>a.precio-b.precio);
  if (sort==='price-desc') arr.sort((a,b)=>b.precio-a.precio);
  if (sort==='ventas') arr.sort((a,b)=>b.ventas-a.ventas);
  return arr;
}
function slugify(str){ return (str||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

function buildAccordion(){
  const acc=qs('#accordion'); if(!acc) return; acc.innerHTML='';
  const groups=groupByCategory(filteredProducts());
  if ([...groups.values()].every(a=>a.length===0)){ acc.innerHTML='<div class="muted" style="padding:12px">No encontramos productos con ese filtro.</div>'; return; }
  for (const [cat, items] of groups){
    if(!items.length) continue;
    const catId=slugify(cat);
    const item=document.createElement('section'); item.className='acc-item';
    const head=document.createElement('button'); head.type='button'; head.className='acc-head'; head.setAttribute('aria-controls',`acc-body-${catId}`); head.setAttribute('aria-expanded','false');
    head.innerHTML=`<h3>${cat}</h3><span class="count">${items.length}</span><span class="chev">⌄</span>`;
    const body=document.createElement('div'); body.className='acc-body'; body.id=`acc-body-${catId}`;
    const grid=document.createElement('div'); grid.className='grid-products'; items.forEach(p=> grid.appendChild(cardNode(p))); body.appendChild(grid);
    head.addEventListener('click', ()=>{
      const isOpen=item.classList.contains('open');
      qsa('.acc-item.open',acc).forEach(x=>{ x.classList.remove('open'); qs('.acc-head',x)?.setAttribute('aria-expanded','false'); });
      if(!isOpen){ item.classList.add('open'); head.setAttribute('aria-expanded','true'); if (window.innerWidth < 700) setTimeout(()=>body.scrollIntoView({behavior:'smooth', block:'start'}),50); }
    });
    item.appendChild(head); item.appendChild(body); acc.appendChild(item);
  }
  const visibles=qsa('.acc-item',acc); if(visibles.length===1){ const u=visibles[0]; u.classList.add('open'); qs('.acc-head',u)?.setAttribute('aria-expanded','true'); }
}

function cardNode(p){
  const el=document.createElement('article'); el.className='card';
  el.innerHTML=`
    <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
    <div class="content">
      <h4>${p.nombre}</h4>
      <div class="price">${fmt.format(p.precio)}</div>
      <div class="controls-row">
        <button class="btn btn-outline quick" aria-label="Ver ${p.nombre}">Ver</button>
        <button class="btn add" aria-label="Agregar ${p.nombre}">Agregar</button>
      </div>
    </div>`;
  el.addEventListener('click', (e)=>{ if(e.target.closest('.quick')) openQuick(p); if(e.target.closest('.add')) openQuick(p); });
  return el;
}

function openQuick(p){
  document.body.classList.add('modal-open');
  const m=qs('#modal-quick'); m.classList.add('open');
  qs('#quick-title').textContent=p.nombre; qs('#quick-img').src=p.imagen; qs('#quick-desc').textContent=p.descripcion; qs('#quick-qty').value=1;
  const wrap=qs('#opt-wrap'); wrap.innerHTML='';
  (p.options||[]).forEach(group=>{
    const fs=document.createElement('fieldset'); fs.className='opt-group'; const lg=document.createElement('legend'); lg.textContent=group.label||'Opciones'; fs.appendChild(lg);
    group.choices.forEach((ch,idx)=>{
      const id=`opt-${group.id}-${ch.id}`; const row=document.createElement('div'); row.className='opt-choice';
      const inpt=document.createElement('input'); inpt.id=id; if(group.type==='single'){ inpt.type='radio'; inpt.name=group.id; inpt.required=!!group.required; if(idx===0) inpt.checked=true; } else { inpt.type='checkbox'; inpt.name=group.id; }
      inpt.value=ch.id; inpt.dataset.delta=Number(ch.delta||0);
      const lab=document.createElement('label'); lab.setAttribute('for',id); lab.innerHTML=`<span>${ch.label}</span>`;
      const more=document.createElement('span'); more.textContent=(Number(ch.delta)||0)?`+ ${fmt.format(Number(ch.delta))}`:'';
      row.appendChild(lab); row.appendChild(more); row.appendChild(inpt); fs.appendChild(row);
    }); wrap.appendChild(fs);
  });
  const updatePrice=()=>{
    let price=p.precio;
    (p.options||[]).forEach(g=>{
      if(g.type==='single'){
        const sel=qs(`input[name="${g.id}"]:checked`,wrap); if(sel) price+=Number(sel.dataset.delta||0);
      } else {
        const boxes=qsa(`input[name="${g.id}"]:checked`,wrap);
        if(g.max && boxes.length>g.max){ boxes[boxes.length-1].checked=false; }
        qsa(`input[name="${g.id}"]:checked`,wrap).forEach(ch=> price+=Number(ch.dataset.delta||0));
      }
    });
    const qty=Number(qs('#quick-qty').value)||1;
    qs('#quick-price').textContent=fmt.format(price*qty);
    return price;
  };
  wrap.addEventListener('change', updatePrice); qs('#quick-qty').addEventListener('input', updatePrice); updatePrice();
  qsa('[data-act="inc"]', m).forEach(b=> b.onclick=()=>{ const i=qs('#quick-qty'); i.value=Math.min(Number(i.value||1)+1,50); updatePrice(); });
  qsa('[data-act="dec"]', m).forEach(b=> b.onclick=()=>{ const i=qs('#quick-qty'); i.value=Math.max(Number(i.value||1)-1,1); updatePrice(); });
  qs('#quick-add').onclick=()=>{
    const unit=updatePrice(); const qty=Number(qs('#quick-qty').value)||1; const opts=[];
    (p.options||[]).forEach(g=>{
      if(g.type==='single'){
        const sel=qs(`input[name="${g.id}"]:checked`,wrap); if(sel){ const label=qs(`label[for="${sel.id}"]`).innerText; opts.push({g:g.label,v:label}); }
      } else {
        const boxes=qsa(`input[name="${g.id}"]:checked`,wrap);
        if(boxes.length){ const values=boxes.map(b=>qs(`label[for="${b.id}"]`).innerText).join(', '); opts.push({g:g.label,v:values}); }
      }
    });
    addToCart(p, qty, unit, opts);
    m.classList.remove('open'); document.body.classList.remove('modal-open');
  };
  qsa('[data-close-modal]', m).forEach(b=> b.onclick=()=>{ m.classList.remove('open'); document.body.classList.remove('modal-open'); });
}

function addToCart(p, qty, priceUnit, opts){
  const key=p.id+'|'+(opts||[]).map(o=>o.g+':'+o.v).join(';');
  if(!state.cart[key]) state.cart[key]={ id:p.id, nombre:p.nombre, imagen:p.imagen, qty:0, price:priceUnit, opts:opts||[] };
  state.cart[key].qty=Math.min(state.cart[key].qty+qty,50);
  saveCart(); renderCart(); openCart();
}

function renderCart(){
  const list=qs('#cart-items'); if(!list) return; list.innerHTML='';
  Object.entries(state.cart).forEach(([key,item])=>{
    const row=document.createElement('div'); row.className='cart-item';
    row.innerHTML=`
      <img src="${item.imagen}" alt="${item.nombre}">
      <div>
        <div class="name">${item.nombre}</div>
        <div class="opts">${(item.opts||[]).map(o=>`${o.g}: ${o.v}`).join(' • ')}</div>
        <div class="qty"><button data-act="dec">–</button><strong>${item.qty}</strong><button data-act="inc">+</button></div>
      </div>
      <div><div>${fmt.format(item.price*item.qty)}</div><button class="remove">✕</button></div>`;
    row.addEventListener('click',(e)=>{
      if(e.target.matches('[data-act="inc"]')){ item.qty=Math.min(item.qty+1,50); saveCart(); renderCart(); }
      if(e.target.matches('[data-act="dec"]')){ item.qty=Math.max(item.qty-1,1); saveCart(); renderCart(); }
      if(e.target.matches('.remove')){ delete state.cart[key]; saveCart(); renderCart(); }
    });
    list.appendChild(row);
  });

  // Upsell (hasta 3 productos rápidos no presentes en el carrito)
  const sum = qs('.summary');
  const prevUpsell = qs('.upsell', sum); if(prevUpsell) prevUpsell.remove();
  const pool = state.products.filter(p=>p.upsell);
  const chosen = [];
  for (const p of pool.sort(()=>Math.random()-0.5)) {
    const already = Object.values(state.cart).some(i=>i.id===p.id);
    if (!already) { chosen.push(p); if (chosen.length>=3) break; }
  }
  if (chosen.length) {
    const ups = document.createElement('div'); ups.className='upsell';
    ups.innerHTML = '<h5>¿Querés sumarle algo más?</h5><div class="upsell-list"></div>';
    const ul = ups.querySelector('.upsell-list');
    chosen.forEach(p=>{
      const it = document.createElement('div'); it.className='upsell-item';
      it.innerHTML = `<img src="${p.imagen}" alt="${p.nombre}"><div><div class="name">${p.nombre}</div><div class="muted">${fmt.format(p.precio)}</div></div><button class="btn btn-outline">+ Agregar</button>`;
      it.querySelector('button').addEventListener('click', ()=> openQuick(p));
      ul.appendChild(it);
    });
    sum.insertBefore(ups, sum.firstChild);
  }

  // Totales + descuento del Tentate Mágico
  const subtotal = Object.values(state.cart).reduce((a,b)=> a + b.price*b.qty, 0);
  const envio = state.config?.envio?.monto ? Number(state.config.envio.monto) : 0;
  let descuento = 0;
  if (state.promo?.active) descuento = Math.round((subtotal * state.promo.percent)/100);

  qs('#sum-subtotal').textContent = fmt.format(subtotal);
  qs('#sum-envio').textContent = fmt.format(envio);

  let discRow = qs('#sum-descuento');
  if (state.promo?.active) {
    if (!discRow) {
      discRow = document.createElement('div'); discRow.className='row'; discRow.id='sum-descuento';
      discRow.innerHTML = `<span>Descuento ${state.promo.name} (-${state.promo.percent}%)</span><span>${fmt.format(-descuento)}</span>`;
      sum.insertBefore(discRow, qs('.total', sum));
    } else {
      discRow.lastElementChild.textContent = fmt.format(-descuento);
    }
  } else if (discRow) {
    discRow.remove();
  }

  qs('#sum-total').textContent = fmt.format(subtotal + envio - descuento);
}

function updateCartBadge(){ const n=Object.values(state.cart).reduce((a,b)=>a+b.qty,0); const b=qs('#cart-badge'); if(b) b.textContent = n>0? String(n): '0'; }
function openCart(){ const d=qs('#drawer'); d.classList.add('open'); d.setAttribute('aria-hidden','false'); renderCart(); }
function closeCart(){ const d=qs('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); }

// Quiz
let quizState = { step:0, scores:{} };
function startQuiz(){ quizState={step:0,scores:{}}; document.body.classList.add('modal-open'); const m=qs('#modal-quiz'); m.classList.add('open'); renderQuizStep(); }
function closeQuiz(){ qs('#modal-quiz').classList.remove('open'); document.body.classList.remove('modal-open'); }
function renderQuizStep(){
  const qcfg=state.quiz; const step=quizState.step; const cont=qs('#quiz-body'); cont.innerHTML='';
  if (step < qcfg.questions.length){
    const q=qcfg.questions[step];
    if (q.image) {
      const fig=document.createElement('div'); fig.className='quiz-figure';
      fig.innerHTML = `<img src="${q.image}" alt="">`; cont.appendChild(fig);
    }
    const h=document.createElement('div'); h.innerHTML=`<h3 style="margin:12px 0 8px">${q.text}</h3>`; cont.appendChild(h);
    q.options.forEach(opt=>{
      const btn=document.createElement('button'); btn.className='btn btn-outline'; btn.style.margin='6px 6px 0 0'; btn.textContent=opt.label;
      btn.onclick=()=>{ Object.entries(opt.weights||{}).forEach(([cat,w])=>{ quizState.scores[cat]=(quizState.scores[cat]||0)+Number(w||0); }); quizState.step++; renderQuizStep(); };
      cont.appendChild(btn);
    });
    return;
  }
  const entries=Object.entries(quizState.scores).sort((a,b)=>b[1]-a[1]);
  const bestCat=entries.length? entries[0][0] : null;
  let rec=null; if(bestCat){ const pool=state.products.filter(p=>p.categoria===bestCat); rec=pool[Math.floor(Math.random()*pool.length)]; } else { rec=state.products[Math.floor(Math.random()*state.products.length)]; }
  const pct=state.quiz.discount_percent||5; state.promo={ name: state.quiz.name, percent: pct, active: true };
  const box=document.createElement('div'); box.innerHTML=`
    <p>✨ El <strong>${state.quiz.name}</strong> dice que hoy te toca:</p>
    <div class="upsell-item" style="margin:8px 0 10px">
      <img src="${rec.imagen}" alt="${rec.nombre}">
      <div><div class="name">${rec.nombre}</div><div class="muted">${fmt.format(rec.precio)}</div></div>
      <button id="quiz-add" class="btn">Agregar</button>
    </div>
    <p class="inline-note">¡Tenés <strong>${pct}% de descuento</strong> aplicado al total por usar el ${state.quiz.name}! 🎉</p>`;
  cont.appendChild(box); qs('#quiz-add', cont).onclick=()=>{ openQuick(rec); closeQuiz(); }; renderCart();
}
function onTentateMagicoClick(){ startQuiz(); }

// Events & Checkout
function bindEvents(){
  qs('#sort')?.addEventListener('change', buildAccordion);
  qs('#search')?.addEventListener('input', buildAccordion);
  qs('#open-cart')?.addEventListener('click', openCart);
  qs('#close-cart')?.addEventListener('click', closeCart);
  qs('#checkout')?.addEventListener('click', ()=>{ if(Object.keys(state.cart).length===0){ alert('Tu carrito está vacío.'); return; } openCheckout(); });
  qs('#clear-cart')?.addEventListener('click', ()=>{ if(confirm('¿Vaciar el carrito?')){ state.cart={}; saveCart(); renderCart(); } });
  qsa('[data-close-checkout]').forEach(b=> b.onclick=closeCheckout);
  qs('#c-pago')?.addEventListener('change', onPagoChange);
  qs('#confirm-order')?.addEventListener('click', confirmOrder);
  qs('#btn-quiz')?.addEventListener('click', onTentateMagicoClick);
}
function onPagoChange(){ const sel=(qs('#c-pago')?.value||'').toLowerCase(); const info=qs('#pago-info'); const dp=state.config?.datos_pago||{}; let txt=''; if(sel.includes('transfer')) txt=dp.transferencia||''; if(sel.includes('mercado')) txt=dp.mercado_pago||''; if(info){ if(txt){ info.textContent=txt; info.hidden=false; } else { info.hidden=true; } } }
function openCheckout(){ document.body.classList.add('modal-open'); const m=qs('#modal-checkout'); m.classList.add('open'); const pago=qs('#c-pago'); if(pago && pago.options.length){ pago.value=pago.options[0].value; onPagoChange(); } }
function closeCheckout(){ qs('#modal-checkout').classList.remove('open'); document.body.classList.remove('modal-open'); }
function confirmOrder(e){
  e.preventDefault();
  const nombre=qs('#c-nombre').value.trim(); const dire=qs('#c-dire').value.trim(); const tel=qs('#c-tel').value.trim(); const pago=qs('#c-pago').value;
  if(!nombre || !dire || !tel || !pago){ alert('Completá todos los campos del formulario.'); return; }
  if(!/[0-9\s()+-]{8,}/.test(tel)){ alert('Ingresá un teléfono válido.'); return; }
  const lines=[]; lines.push('Pedido TENTATE MAS'); lines.push('------------------');
  Object.values(state.cart).forEach(it=>{ const opts=(it.opts||[]).map(o=>`${o.g}: ${o.v}`).join(' | '); lines.push(`• ${it.nombre}${opts?` (${opts})`:''} x${it.qty} — ${fmt.format(it.price*it.qty)}`); });
  const subtotal=Object.values(state.cart).reduce((a,b)=> a + b.price*b.qty, 0);
  const envio=state.config?.envio?.monto ? Number(state.config.envio.monto) : 0;
  let descuento=0; if (state.promo?.active) descuento=Math.round((subtotal*state.promo.percent)/100);
  lines.push(`TOTAL: ${fmt.format(subtotal + envio - descuento)}`);
  if (state.promo?.active) lines.push(`(Incluye ${state.promo.percent}% off por ${state.promo.name})`);
  lines.push(''); lines.push('Cliente:'); lines.push(`Nombre: ${nombre}`); lines.push(`Dirección: ${dire}`); lines.push(`Tel: ${tel}`); lines.push(`Pago: ${pago}`);
  const msg=lines.join('\n'); const num=state.config.whatsapp_number || ''; const url=`https://wa.me/${num}?text=${encodeURIComponent(msg)}`; window.open(url,'_blank'); closeCheckout();
}

window.addEventListener('DOMContentLoaded', bootstrap);
