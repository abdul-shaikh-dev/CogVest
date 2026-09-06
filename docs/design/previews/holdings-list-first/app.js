const $ = (id) => document.getElementById(id);
const base = [
  { id:'hdfc', name:'HDFC Bank', category:'Equity', kind:'stock', sector:'Financial Services', invested:164235, value:182850, quantity:100, source:'Live' },
  { id:'nifty', name:'Nifty 50 ETF', category:'Equity', kind:'stock', sector:'Index fund', invested:44220, value:50665, quantity:200, source:'Live' },
  { id:'gold', name:'Sovereign Gold Bond', category:'Debt', kind:'debt', sector:'Government bond', invested:52950, value:57110, quantity:10, source:'Manual' },
  { id:'btc', name:'Bitcoin', category:'Crypto', kind:'crypto', sector:'Coin', invested:150000, value:139040, quantity:.02, source:'Live' },
];
const state = { filter:'all', tab:'market', expanded:null, masked:false };
const money = (value) => state.masked ? '₹••••' : value === null ? 'Pending' : value >= 100000 ? `₹${(value/100000).toFixed(2)}L` : `₹${(value/1000).toFixed(1)}K`;
const pct = (value) => state.masked ? 'Hidden' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = (kind) => `<svg class="asset-icon ${kind}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${kind === 'debt' ? '<path d="M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7Z"/>' : kind === 'crypto' ? '<circle cx="12" cy="12" r="9"/><path d="M9 6v12m3-12v12M8 8h6a2 2 0 0 1 0 4H8m0 0h7a2 2 0 0 1 0 4H8"/>' : '<path d="m3 17 6-6 4 3 8-9m-6 0h6v6"/>'}</svg>`;

function holdings() {
  const scenario = $('scenario').value;
  if (scenario === 'empty' || scenario === 'ppf') return [];
  if (scenario === 'many') return Array.from({length:30}, (_,i) => ({...base[i%4], id:`asset-${i}`, name:`${base[i%4].name}${i<4?'':` · ${Math.floor(i/4)+1}`}`}));
  return base.map((item,i) => ({...item, value:scenario === 'pending' && i===0 ? null:item.value}));
}
function hasPpf() { return $('scenario').value === 'ppf' || $('with-ppf').checked; }
function openSheet(title, html) {
  $('sheet-title').textContent = title;
  $('sheet-content').innerHTML = html;
  if (!$('sheet').open) $('sheet').showModal();
  $('sheet').scrollTop = 0;
  $('close-sheet').focus();
}
function destination(title) {
  openSheet(title, `<p class="sheet-copy">This action opens the existing ${escapeHtml(title.toLowerCase())} flow in the app. This preview demonstrates its location, not data entry or saving.</p><button class="secondary" data-action="add">Back to Add options</button>`);
}
function addMenu() {
  openSheet('Add to your portfolio', ['Add one holding','Set up multiple holdings','Import holdings CSV','Import transactions','Add PPF account'].map(label=>`<button class="menu-action" data-destination="${label}">${label}</button>`).join(''));
}
function quoteDetails() {
  const pending = holdings().some(item=>item.value===null);
  openSheet('Valuation details', `<p class="sheet-copy">${pending ? 'HDFC Bank has no current price. Invested amounts are retained; current totals and allocation remain unavailable until it is priced.' : 'Prices shown are illustrative. Each expanded holding retains its Live or Manual source. Manual prices are not represented as failed quotes.'}</p><p class="sheet-copy">In the app, pull to refresh and the existing refresh action remain available. No provider request is made here.</p><button class="secondary" data-destination="Refresh prices">Refresh prices</button>`);
}
function showInsights() {
  const rows = holdings();
  if (!rows.length) return;
  const pending = rows.some(row=>row.value===null);
  const total = rows.reduce((sum,row)=>sum+(row.value??0),0);
  const dominant = pending ? null : [...rows].sort((a,b)=>b.value-a.value)[0];
  const best = [...rows].filter(row=>row.value!==null).sort((a,b)=>(b.value/b.invested)-(a.value/a.invested))[0];
  const categories = ['Equity','Debt','Crypto'].map((label,index)=>({label,color:['var(--green)','var(--blue)','var(--amber)'][index],share:rows.filter(row=>row.category===label).reduce((sum,row)=>sum+(row.value??0),0)/total*100}));
  const topThree = [...rows].sort((a,b)=>(b.value??0)-(a.value??0)).slice(0,3).reduce((sum,row)=>sum+(row.value??0),0)/total*100;
  openSheet('Portfolio insights', `<p class="sheet-copy">Market holdings only. PPF and cash are separate. No duplicate portfolio total.</p>
    <div class="insight-row"><span>Dominant position</span><strong>${dominant ? escapeHtml(dominant.name):'Awaiting valuation'}</strong><p class="sheet-copy">${dominant ? `${state.masked?'Hidden':(dominant.value/total*100).toFixed(1)+'%'} of market holdings`:'Allocation is unavailable while a price is missing.'}</p></div>
    ${best && best.id!==dominant?.id ? `<div class="insight-row"><span>Best return · priced holdings</span><strong>${escapeHtml(best.name)} ${pct((best.value/best.invested-1)*100)}</strong></div>`:''}
    <div class="insight-row"><span>Asset mix</span>${pending ? '<p class="sheet-copy">Available when every holding has a price.</p>':state.masked?'<p>Hidden</p>':`<div class="mix">${categories.map(item=>`<i style="width:${item.share}%;background:${item.color}"></i>`).join('')}</div>${categories.map(item=>`<p class="sheet-copy">${item.label} ${item.share.toFixed(1)}%</p>`).join('')}<p class="sheet-copy">Top 3 holdings: ${topThree.toFixed(1)}% of market value</p>`}</div>`);
}
function holdingCard(item, total, pending) {
  const expanded = state.expanded===item.id;
  const delta = item.value===null ? null : (item.value/item.invested-1)*100;
  return `<article class="holding">
    <button class="holding-toggle" data-holding="${item.id}" aria-expanded="${expanded}" aria-controls="detail-${item.id}">
      <div class="holding-top">${icon(item.kind)}<div class="identity"><span class="name">${escapeHtml(item.name)}</span><span class="classification">${item.category} · ${item.sector}</span></div><div class="value"><strong>${money(item.value)}</strong>${delta===null?'':`<span class="return ${delta>=0?'positive':'negative'}">${pct(delta)}</span>`}</div><span class="chevron" aria-hidden="true">${expanded?'⌃':'⌄'}</span></div>
      <div class="meta"><span>Invested ${money(item.invested)}</span><span>${pending?'Allocation unavailable':state.masked?'Allocation hidden':`Alloc. ${(item.value/total*100).toFixed(1)}%`}</span></div>
    </button>
    <div id="detail-${item.id}" class="holding-details" ${expanded?'':'hidden'}>
      <div class="detail-grid"><div><span>Quantity</span><strong>${state.masked?'Hidden':item.quantity}</strong></div><div><span>Average cost</span><strong>${money(item.invested/item.quantity)}</strong></div><div><span>Current price</span><strong>${money(item.value===null?null:item.value/item.quantity)}</strong></div><div><span>P&L</span><strong>${item.value===null?'Unavailable':state.masked?'Hidden':`${item.value>=item.invested?'+':'−'}${money(Math.abs(item.value-item.invested))}`}</strong></div></div>
      <p class="source">${item.value===null?'Current price unavailable':`${item.source} price · illustrative source`}</p>
      <button class="secondary" data-destination="Holding records">View records</button><button class="secondary" data-destination="Sell or redeem">Sell / redeem</button>
    </div>
  </article>`;
}
function render() {
  const rows=holdings(), ppf=hasPpf(), pending=rows.some(row=>row.value===null);
  if (!ppf) state.tab='market';
  if (!rows.length && ppf) state.tab='ppf';
  $('subtitle').textContent=`${rows.length} market ${rows.length===1?'position':'positions'}${ppf?' · 1 PPF account':''}`;
  $('account-tabs').innerHTML=ppf&&rows.length ? ['market','ppf'].map(tab=>`<button data-tab="${tab}" aria-pressed="${state.tab===tab}">${tab==='market'?`Market ${rows.length}`:'PPF 1'}</button>`).join(''):'';
  $('search').parentElement.hidden=state.tab==='ppf'||rows.length===0;
  const manualCount=rows.filter(row=>row.source==='Manual').length;
  $('context').innerHTML=state.tab==='market'&&pending ? '<div class="notice"><strong>1 valuation pending</strong><p>Invested amounts are available. Current totals and allocation are incomplete.</p><button data-action="quotes">Valuation details</button></div>' : rows.length&&state.tab==='market' ? `<div class="context-line"><span>Prices updated 2m ago · ${manualCount} Manual</span><button data-action="quotes">Details</button></div>`:'';
  if($('resume').checked) $('context').innerHTML+='<div class="context-line"><span>Portfolio setup in progress</span><button data-action="resume">Resume setup</button></div>';
  const filters=[['all','All'],['winners','Winners'],['losers','Losers'],['high','High allocation']];
  $('filters').innerHTML=rows.length&&state.tab==='market'?filters.map(([key,label])=>`<button data-filter="${key}" aria-pressed="${state.filter===key}">${label}</button>`).join(''):'';
  $('insights').hidden=!rows.length||state.tab!=='market'||$('minimal').checked;
  const total=rows.reduce((sum,row)=>sum+(row.value??0),0);
  const query=$('search').value.toLowerCase().trim();
  const visible=rows.filter(row=>`${row.name} ${row.category} ${row.sector}`.toLowerCase().includes(query)).filter(row=>state.filter==='all'||state.filter==='winners'&&row.value!==null&&row.value>=row.invested||state.filter==='losers'&&row.value!==null&&row.value<row.invested||state.filter==='high'&&!pending&&row.value/total>=.1);
  if(state.tab==='ppf') {
    $('results').innerHTML=`<p class="result-count">PPF accounts</p><article class="holding"><button class="holding-toggle" data-destination="PPF account"><div class="holding-top">${icon('debt')}<div class="identity"><span class="name">My PPF</span><span class="classification">SBI · confirmed balance</span></div><div class="value"><strong>${money(350000)}</strong></div></div><div class="meta"><span>This FY ${money(50000)} contributed</span><span>View account ›</span></div></button></article><button class="secondary" data-destination="Add PPF account">Add PPF account</button>${!rows.length?'<button class="secondary" data-action="add">Add market holdings</button>':''}`;
  } else if(!rows.length) {
    $('results').innerHTML='<div class="empty"><h3>Your portfolio starts here.</h3><p>Bring your existing holdings into one place. Start with several, or add one at a time.</p><button class="primary" data-destination="Set up multiple holdings">Set up your portfolio</button><button class="secondary" data-destination="Add one holding">Add one holding</button></div>';
  } else {
    $('results').innerHTML=visible.length ? visible.map(row=>holdingCard(row,total,pending)).join('') : '<div class="empty"><h3>No matching holdings</h3><p>Try another name or clear the filters.</p><button class="secondary" data-action="clear">Clear search and filters</button></div>';
  }
}
$('add').onclick=addMenu;
$('more').onclick=()=>openSheet('Holdings options', `<button class="menu-action" data-action="mask">${state.masked?'Show':'Hide'} values</button><button class="menu-action" data-action="quotes">Valuation details</button><button class="menu-action" data-destination="Manage assets">Manage assets</button><button class="menu-action" data-destination="Transactions">Transactions</button>${!hasPpf()?'<button class="menu-action" data-destination="Add PPF account">Add PPF account</button>':''}`);
$('insights').onclick=showInsights;
$('close-sheet').onclick=()=>$('sheet').close();
$('search').oninput=render;
document.addEventListener('click',event=>{
  const button=event.target.closest('button'); if(!button) return;
  if(button.dataset.destination) return destination(button.dataset.destination);
  if(button.dataset.holding) { state.expanded=state.expanded===button.dataset.holding?null:button.dataset.holding; render(); document.querySelector(`[data-holding="${button.dataset.holding}"]`).focus({preventScroll:true}); }
  if(button.dataset.filter) { state.filter=button.dataset.filter; render(); document.querySelector(`[data-filter="${state.filter}"]`).focus({preventScroll:true}); }
  if(button.dataset.tab) { state.tab=button.dataset.tab; render(); document.querySelector(`[data-tab="${state.tab}"]`)?.focus({preventScroll:true}); }
  const action=button.dataset.action;
  if(action==='add') addMenu();
  if(action==='quotes') quoteDetails();
  if(action==='resume') destination('Continue portfolio setup');
  if(action==='mask') {state.masked=!state.masked; $('sheet').close(); render();}
  if(action==='clear') {state.filter='all'; $('search').value=''; render(); $('search').focus();}
});
['scenario','with-ppf','resume','large-text','narrow','minimal'].forEach(id=>$(id).addEventListener('change',()=>{
  document.querySelector('.phone').classList.toggle('enlarged',$('large-text').checked);
  document.querySelector('.phone').classList.toggle('narrow',$('narrow').checked);
  document.querySelector('.phone').classList.toggle('minimal',$('minimal').checked);
  if(id==='scenario') {state.tab=$('scenario').value==='ppf'?'ppf':'market';state.expanded=null;state.filter='all';$('search').value='';}
  render();
}));
render();
