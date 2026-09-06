// Synthetic monthly snapshots; values and changes are derived, never randomized.
const snapshots = [
  ['2025-11',860000,240000,85000,150000,1200000,40000,40000],
  ['2025-12',910000,254000,96000,165000,1250000,50000,65000],
  ['2026-01',990000,270000,102000,190000,1370000,120000,145000],
  ['2026-02',1045000,282000,111000,205000,1460000,90000,105000],
  ['2026-03',1120000,299000,119000,210000,1580000,120000,125000],
  ['2026-04',1187000,310000,128500,255000,1676000,96000,141000],
  ['2026-05',1245000,322000,120000,300000,1721000,45000,90000],
].map(([month,equity,debt,crypto,cash,invested,contribution,netExternalFlow])=>({month,equity,debt,crypto,cash,invested,contribution,netExternalFlow,portfolio:equity+debt+crypto+cash}));
const $ = id=>document.getElementById(id);
const months = snapshots.map(s=>s.month);
// Additional history-only fixtures demonstrate a complete year without altering either chart.
const earlierHistory = [
  ['2025-01',670000,190000,70000,100000,940000,30000,40000],
  ['2025-02',700000,195000,75000,110000,980000,40000,50000],
  ['2025-03',680000,200000,60000,105000,1020000,40000,35000],
  ['2025-04',710000,205000,65000,115000,1050000,30000,40000],
  ['2025-05',735000,210000,68000,120000,1090000,40000,45000],
  ['2025-06',760000,215000,72000,125000,1120000,30000,35000],
  ['2025-07',740000,220000,65000,120000,1130000,10000,5000],
  ['2025-08',780000,225000,74000,130000,1150000,20000,30000],
  ['2025-09',810000,230000,78000,140000,1160000,10000,20000],
  ['2025-10',835000,235000,82000,145000,1160000,0,5000],
].map(([month,equity,debt,crypto,cash,invested,contribution,netExternalFlow])=>({month,equity,debt,crypto,cash,invested,contribution,netExternalFlow,portfolio:equity+debt+crypto+cash}));
const historySnapshots=[...earlierHistory,...snapshots];
const label = m=>new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN',{month:'short',year:'numeric',timeZone:'UTC'});
const state={masked:false,scenario:'populated',summary:6,charts:{portfolio:{range:'6M',start:1,end:6,selected:6},assets:{range:'6M',start:1,end:6,selected:6}}};
const money = v=>state.masked?'₹••••':`₹${Math.abs(v)>=10000000?(v/10000000).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'Cr':Math.abs(v)>=100000?(v/100000).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'L':Math.abs(v)>=1000?(v/1000).toFixed(1).replace(/\.0$/,'')+'K':v.toLocaleString('en-IN')}`;
const signed = v=>state.masked?'Hidden':`${v>0?'+':v<0?'-':''}${money(Math.abs(v))}`;
const pct = (v,p)=>state.masked?'Hidden':!p?'No baseline':`${v>=p?'+':''}${((v-p)/Math.abs(p)*100).toFixed(1)}%`;
const tone=v=>v<0?'negative':'positive';
const options=(from=0,to=6,selected=6)=>months.slice(from,to+1).map((m,i)=>`<option value="${i+from}" ${i+from===selected?'selected':''}>${label(m)}</option>`).join('');
function renderSummary(){
  const empty=state.scenario==='empty',s=snapshots[state.summary],prior=snapshots[state.summary-1],estimated=state.scenario==='estimated';
  $('month-summary').innerHTML=empty?`<div class="empty"><h3>Your first month starts here.</h3><p>When a month closes, CogVest creates a snapshot from your portfolio records. No monthly form to remember.</p><button id="empty-info">How snapshots work</button></div>`:`<div class="summary"><div class="month-select"><label for="summary-month">Month-end value</label><select id="summary-month" aria-label="Summary month">${options(0,6,state.summary)}</select></div><div class="total">${money(s.portfolio)}</div><div class="metrics"><div class="metric"><span>Market change</span><strong class="${tone(prior?s.portfolio-prior.portfolio-s.netExternalFlow:0)}">${prior?signed(s.portfolio-prior.portfolio-s.netExternalFlow):'No prior month'}</strong></div><div class="metric"><span>Monthly investment</span><strong>${money(s.contribution)}</strong></div></div><button class="status-line ${estimated?'estimated':''}" id="snapshot-status"><span>${estimated?'Some prices are estimated':'Snapshot recorded automatically'}</span><span>${estimated?'Review status':'Details'}</span></button></div>`;
  $('summary-month')?.addEventListener('change',e=>{state.summary=Number(e.target.value);renderSummary()});
  ($('snapshot-status')||$('empty-info'))?.addEventListener('click',()=>{
    $('status-body').innerHTML=`<p>${empty?'Snapshots are created automatically from stored records after each completed month.':estimated?'This preview illustrates estimated month-end prices. The app must keep provenance visible; a review is optional when you have better values.':'Stored month-end values are ready. No action is needed unless your underlying records need a correction.'}</p><p style="margin-top:18px">Design preview only. The existing separate correction flow is unchanged; this panel does not save or edit data.</p>`;$('status-details').showModal();
  });
  $('history-entry').hidden=empty;
}
function renderCharts(){
  $('charts').innerHTML=state.scenario==='empty'?'':Object.entries(state.charts).map(([key,c])=>{
    const s=snapshots[c.selected],p=c.selected>c.start?snapshots[c.selected-1]:null,isAsset=key==='assets';
    const series=isAsset?[['Equity','equity','#34c759'],['Debt','debt','#0a84ff'],['Crypto','crypto','#ffd60a']]:[['Portfolio','portfolio','#34c759'],['Invested','invested','#fff']];
    return `<section class="chart" aria-label="${isAsset?'Asset Momentum':'Portfolio Growth'}"><h3>${isAsset?'Asset Momentum':'Portfolio Growth'}</h3><p class="subline">${isAsset?'Equity, debt and crypto. Cash excluded.':'Portfolio value and invested capital.'}</p><div class="ranges" aria-label="${key} time range">${['3M','6M','1Y','All','Custom'].map(r=>`<button data-chart="${key}" data-range="${r}" aria-label="${key}: ${r}" aria-pressed="${c.range===r}">${r}</button>`).join('')}</div><div class="month-nav"><button data-chart="${key}" data-move="-1" aria-label="${key}: previous stored month" ${c.selected===c.start?'disabled':''}>‹</button><span aria-live="polite">${label(s.month)}</span><button data-chart="${key}" data-move="1" aria-label="${key}: next stored month" ${c.selected===c.end?'disabled':''}>›</button></div><div class="series-values ${isAsset?'assets':''}">${series.map(([name,id,color])=>`<div><small><b class="key ${id}" style="${id==='invested'?'':`background:${color}`}" aria-hidden="true"></b>${name}</small><strong>${money(s[id])}</strong>${isAsset?`<em class="${tone(p?s[id]-p[id]:0)}">${p?pct(s[id],p[id]):'No prior month'}</em>`:''}</div>`).join('')}</div><canvas data-key="${key}" role="img" aria-label="${isAsset?'Asset value':'Portfolio and invested'} trend from ${label(months[c.start])} through ${label(months[c.end])}; inspect stored figures using previous and next buttons"></canvas><p class="chart-note">${isAsset?`Changes compare with ${p?label(p.month):'no earlier month in this range'}.`:`${state.masked?'Performance hidden':pct(s.portfolio,s.invested)+' '+(s.portfolio>=s.invested?'ahead of':'below')+' invested capital.'}`}</p></section>`;
  }).join('');
  document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{
    const c=state.charts[b.dataset.chart],r=b.dataset.range;
    if(r==='Custom'){openRange(b.dataset.chart);return}
    c.range=r;c.end=6;c.start=r==='3M'?4:r==='6M'?1:0;c.selected=c.end;renderCharts();focusChart(b.dataset.chart,`[data-range="${r}"]`);
  });
  document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const key=b.dataset.chart,c=state.charts[key];c.selected=Math.max(c.start,Math.min(c.end,c.selected+Number(b.dataset.move)));renderCharts();focusChart(key,`[data-move="${b.dataset.move}"]`)});
  requestAnimationFrame(drawAll);
}
function focusChart(key,selector){
  const target=document.querySelector(`[data-chart="${key}"]${selector}`);
  if(target&&!target.disabled){target.focus({preventScroll:true});return}
  const month=target?.closest('.month-nav')?.querySelector('span');
  if(month){month.tabIndex=-1;month.focus({preventScroll:true})}
}
function drawAll(){
  document.querySelectorAll('canvas').forEach(canvas=>{
    const key=canvas.dataset.key,c=state.charts[key],data=snapshots.slice(c.start,c.end+1),asset=key==='assets',series=asset?[['equity','#34c759'],['debt','#0a84ff'],['crypto','#ffd60a']]:[['portfolio','#34c759'],['invested','#ffffff']];
    const scale=$('large-text').checked?1.3:1,w=canvas.clientWidth,h=184,dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const left=49*scale,right=17,top=14,bottom=29*scale,pw=w-left-right,ph=h-top-bottom,max=Math.max(...data.flatMap(s=>series.map(([id])=>s[id]))),mag=10**Math.floor(Math.log10(max||1)),ceil=(max/mag<=2?2:max/mag<=5?5:10)*mag;
    ctx.font=`${11*scale}px Segoe UI`;ctx.textBaseline='middle';ctx.lineWidth=1;
    for(let i=0;i<3;i++){const y=top+i*ph/2;ctx.strokeStyle='#424244';ctx.setLineDash(i===2?[]:[3,5]);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle='#98989d';ctx.textAlign='right';ctx.fillText(money(ceil*(1-i/2)),left-8,y)}
    const x=i=>left+8+i*(pw-16)/(data.length-1),y=v=>top+ph-v/ceil*ph;
    series.forEach(([id,color])=>{const points=data.map((s,i)=>[x(i),y(s[id])]);ctx.setLineDash([]);if(id!=='invested'){const grad=ctx.createLinearGradient(0,top,0,top+ph);grad.addColorStop(0,color+'25');grad.addColorStop(1,color+'00');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(points[0][0],top+ph);points.forEach(p=>ctx.lineTo(...p));ctx.lineTo(points.at(-1)[0],top+ph);ctx.closePath();ctx.fill()}
      ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(id==='invested'?[5,4]:[]);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.setLineDash([]);const p=points[c.selected-c.start];ctx.beginPath();ctx.fillStyle=color;ctx.arc(...p,4,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle='#98989d';ctx.textAlign='center';[...new Set([0,Math.floor((data.length-1)/2),data.length-1])].forEach(i=>ctx.fillText(label(data[i].month).split(' ')[0],x(i),h-11*scale));
  });
  $('height-note').textContent=`Proposed default reading surface: ${($('screen').scrollHeight/$('screen').clientHeight).toFixed(1)} viewports. Full monthly history remains off the main scroll.`;
}
function detailMarkup(index){
  const s=historySnapshots[index],p=historySnapshots[index-1];
  return `<div class="detail-total">${money(s.portfolio)}</div><p>${p?`${signed(s.portfolio-p.portfolio)} / ${pct(s.portfolio,p.portfolio)} vs ${label(p.month)}`:'First stored month. No comparison yet.'}</p><h3>What changed</h3>${['equity','debt','crypto','cash'].map(id=>`<div class="detail-row"><div>${id[0].toUpperCase()+id.slice(1)}<small>${state.masked?'Allocation hidden':(s[id]/s.portfolio*100).toFixed(1)+'% allocation'}</small></div><div>${money(s[id])}<small class="${tone(p?s[id]-p[id]:0)}">${p?`${pct(s[id],p[id])} · previous ${money(p[id])}`:'No prior month'}</small></div></div>`).join('')}<h3>Capital & cash flow</h3>${[['Invested capital',s.invested],['Monthly investment',s.contribution],['Net contribution',s.netExternalFlow],['Market change',p?s.portfolio-p.portfolio-s.netExternalFlow:null],['Salary',140000],['Expenses',70000]].map(([title,value])=>`<div class="detail-row"><span>${title}</span><strong>${value===null?'Unavailable':money(value)}</strong></div>`).join('')}<div class="detail-row"><span>Investment rate</span><strong>${state.masked?'Hidden':(s.contribution/140000*100).toFixed(1)+'%'}</strong></div><div class="detail-row"><span>Expense rate</span><strong>${state.masked?'Hidden':'50%'}</strong></div><p style="margin-top:18px">${state.scenario==='estimated'?'Estimated prices are included. Review only if you have better records.':'Stored monthly snapshot. No action required.'}</p>`;
}
let editingChart;
function renderHistory(){
  const year=$('history-year').value;
  const entries=historySnapshots.map((snapshot,index)=>({snapshot,index})).filter(({snapshot})=>snapshot.month.startsWith(year)).reverse();
  $('history-count').textContent=`${entries.length} stored months. Tap a month for its breakdown.`;
  $('detail-body').innerHTML=entries.map(({snapshot:s,index})=>{
    const p=historySnapshots[index-1];
    const previousMonth=new Date(`${s.month}-01T00:00:00Z`);
    previousMonth.setUTCMonth(previousMonth.getUTCMonth()-1);
    const consecutive=p?.month===previousMonth.toISOString().slice(0,7);
    const change=state.masked?'Hidden':consecutive?pct(s.portfolio,p.portfolio):'No prior';
    return `<button class="history-month" data-month="${s.month}" data-index="${index}" aria-label="View ${label(s.month)} details. Portfolio ${money(s.portfolio)}. ${change}${consecutive?' versus '+label(p.month):' month comparison'}"><span>${label(s.month).split(' ')[0]}</span><span>${money(s.portfolio)}</span><span class="${state.masked||!consecutive?'':tone(s.portfolio-p.portfolio)}">${change}</span><span class="history-chevron" aria-hidden="true">&#8250;</span></button>`;
  }).join('');
  document.querySelectorAll('.history-month').forEach(row=>row.onclick=()=>openMonthPage(row));
}
let historyScroll=0, historyOrigin=null;
function openMonthPage(row){
  historyScroll=$('details').scrollTop;
  historyOrigin=row;
  const index=Number(row.dataset.index);
  $('history-title').textContent=label(historySnapshots[index].month);
  $('month-page').innerHTML='<p class="history-explanation">Month-end portfolio value</p>'+detailMarkup(index);
  $('history-overview').hidden=true;
  $('month-page').hidden=false;
  $('history-back').hidden=false;
  $('details').scrollTop=0;
  $('history-back').focus({preventScroll:true});
}
function showHistoryOverview(){
  $('month-page').hidden=true;
  $('month-page').innerHTML='';
  $('history-overview').hidden=false;
  $('history-back').hidden=true;
  $('history-title').textContent='Monthly History';
  historyOrigin?.focus({preventScroll:true});
  $('details').scrollTop=historyScroll;
}
$('history-back').onclick=showHistoryOverview;
$('details').addEventListener('cancel',event=>{
  if(!$('month-page').hidden){event.preventDefault();showHistoryOverview()}
});
function openRange(key){editingChart=key;const c=state.charts[key];$('range-from').innerHTML=options(0,5,c.start);updateEnd(c.end);$('custom').showModal()}
function updateEnd(end=6){const start=Number($('range-from').value);$('range-to').innerHTML=options(start+1,6,Math.max(start+1,end))}
$('range-from').onchange=()=>updateEnd(Number($('range-to').value));
$('apply-range').onclick=()=>{const c=state.charts[editingChart];c.start=Number($('range-from').value);c.end=Number($('range-to').value);c.range='Custom';c.selected=c.end;$('custom').close();renderCharts();focusChart(editingChart,'[data-range="Custom"]')};
$('open-history').onclick=()=>{historyOrigin=null;historyScroll=0;showHistoryOverview();const years=[...new Set(historySnapshots.map(s=>s.month.slice(0,4)))].reverse();$('history-year').innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');renderHistory();$('details').showModal();$('details').scrollTop=0};$('history-year').onchange=renderHistory;
for(const [button,dialog] of [['close-details','details'],['close-custom','custom'],['close-status','status-details']])$(button).onclick=()=>$(dialog).close();
$('mask').onclick=()=>{state.masked=!state.masked;$('mask').setAttribute('aria-pressed',String(state.masked));$('mask').setAttribute('aria-label',state.masked?'Show financial values':'Hide financial values');renderSummary();renderCharts()};
$('scenario').onchange=e=>{state.scenario=e.target.value;renderSummary();renderCharts()};
$('large-text').onchange=e=>{document.documentElement.style.setProperty('--scale',e.target.checked?1.3:1);document.body.classList.toggle('large',e.target.checked);drawAll()};
new ResizeObserver(drawAll).observe($('screen'));
renderSummary();renderCharts();
