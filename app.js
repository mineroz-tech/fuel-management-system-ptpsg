/* ============================================================
   Fuel Ops Dashboard — app logic
   ============================================================ */

const CAT_COLORS = ['#ff8a3d','#3da5d9','#4ade80','#fbbf24','#f87171','#a78bfa','#f472b6','#2dd4bf','#f59e0b','#60a5fa'];
function colorFor(i){ return CAT_COLORS[i % CAT_COLORS.length]; }

const state = {
  records: [],
  standard: {},
  filtered: [],
  page: 1,
  pageSize: 25,
  sortKey: 'date',
  sortDir: 'asc',
  effSortKey: 'liter',
  effSortDir: 'desc'
};

let charts = {};

/* ---------- helpers ---------- */
function fmtInt(n){ return Math.round(n).toLocaleString('id-ID'); }
function fmtNum(n, d=1){ return n==null ? '-' : n.toLocaleString('id-ID', {minimumFractionDigits:d, maximumFractionDigits:d}); }
function uniq(arr){ return [...new Set(arr)]; }

/* ============================================================
   LOAD DATA (embedded default, or from uploaded workbook)
   ============================================================ */
function loadData(records, standard){
  state.records = records;
  state.standard = standard;
  populateCategoryFilter();
  setDateBounds();
  applyFilters();
}

function populateCategoryFilter(){
  const sel = document.getElementById('fCategory');
  sel.innerHTML = '<option value="all">Semua Kategori</option>';
  const cats = uniq(state.records.map(r=>r.prefix)).sort();
  cats.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c;
    const model = state.standard[c] ? state.standard[c].model : c;
    opt.textContent = `${c} — ${model}`;
    sel.appendChild(opt);
  });
}

function setDateBounds(){
  const dates = state.records.map(r=>r.date).sort();
  if(!dates.length) return;
  const from = dates[0], to = dates[dates.length-1];
  document.getElementById('fDateFrom').value = from;
  document.getElementById('fDateTo').value = to;
  document.getElementById('fDateFrom').min = from;
  document.getElementById('fDateFrom').max = to;
  document.getElementById('fDateTo').min = from;
  document.getElementById('fDateTo').max = to;
  const fmt = d => new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  document.getElementById('periodLabel').textContent = `${fmt(from)} – ${fmt(to)}`;
}

/* ============================================================
   FILTERING
   ============================================================ */
function applyFilters(){
  const from = document.getElementById('fDateFrom').value;
  const to = document.getElementById('fDateTo').value;
  const shift = document.getElementById('fShift').value;
  const cat = document.getElementById('fCategory').value;
  const q = document.getElementById('fSearch').value.trim().toLowerCase();

  state.filtered = state.records.filter(r=>{
    if(from && r.date < from) return false;
    if(to && r.date > to) return false;
    if(shift !== 'all' && r.shift !== shift) return false;
    if(cat !== 'all' && r.prefix !== cat) return false;
    if(q){
      const hay = `${r.unit} ${r.type} ${r.driver} ${r.fuelTruck}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  state.page = 1;
  renderAll();
}

/* ============================================================
   RENDER: KPIs
   ============================================================ */
function sparklinePath(values, w=200, h=28){
  if(!values.length) return '';
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = (max-min) || 1;
  const step = w / Math.max(1, values.length-1);
  const pts = values.map((v,i)=> `${(i*step).toFixed(1)},${(h - ((v-min)/range)*h).toFixed(1)}`);
  return pts.join(' ');
}
function sparklineSVG(values, color){
  const pts = sparklinePath(values);
  const areaPts = `0,28 ${pts} 200,28`;
  return `<svg viewBox="0 0 200 28" preserveAspectRatio="none">
    <polyline points="${areaPts}" fill="${color}22" stroke="none"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function animateValue(el, from, to, duration=650, decimals=0){
  if(!el) return;
  const start = performance.now();
  const diff = to - from;
  function frame(now){
    const t = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-t, 3);
    const val = from + diff*eased;
    el.textContent = decimals ? fmtNum(val, decimals) : fmtInt(val);
    if(t < 1) requestAnimationFrame(frame);
    else el.textContent = decimals ? fmtNum(to, decimals) : fmtInt(to);
  }
  requestAnimationFrame(frame);
}

const KPI_ICONS = {
  fuel:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/></svg>',
  trend:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="14 6 21 6 21 13"/></svg>',
  box:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  gauge:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12l4-4"/><circle cx="12" cy="12" r="9"/><path d="M8 12a4 4 0 018 0"/></svg>',
  alert:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 18H2L12 3z"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 3 4-1 1 4 3 3-3 3-1 4-4-1-3 3-3-3-4 1-1-4-3-3 3-3 1-4 4 1 3-3z"/><polyline points="9 12 11 14 15 10"/></svg>'
};

function renderKPIs(){
  const data = state.filtered;
  const totalLiter = data.reduce((s,r)=>s+r.liter,0);
  const totalTx = data.length;
  const activeUnits = uniq(data.map(r=>r.unit)).length;
  const byDate = data.reduce((acc,r)=>{acc[r.date]=(acc[r.date]||0)+r.liter; return acc;},{});
  const dates = Object.keys(byDate).sort();
  const days = dates;
  const avgDaily = days.length ? totalLiter/days.length : 0;
  const dailySeries = dates.map(d=>byDate[d]);
  const maxDaily = Math.max(1, ...dailySeries, avgDaily*1.4);
  const gaugePct = totalLiter ? 100 : 0;

  // Status classification (over / normal / efficient) per category, applied per transaction
  const effRows = computeEfficiencyRows();
  const statusByPrefix = {};
  effRows.forEach(r=> statusByPrefix[r.prefix] = r.status);
  let overLiter=0, underLiter=0, lhmSum=0, lhmCount=0;
  data.forEach(r=>{
    const st = statusByPrefix[r.prefix] || 'normal';
    if(st==='over') overLiter += r.liter;
    else if(st==='under') underLiter += r.liter;
    if(r.ltrHM != null){ lhmSum += r.ltrHM; lhmCount++; }
  });
  const avgLHM = lhmCount ? lhmSum/lhmCount : 0;
  const overPct = totalLiter ? overLiter/totalLiter*100 : 0;
  const underPct = totalLiter ? underLiter/totalLiter*100 : 0;

  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = `
    <div class="kpi-card gauge-card">
      <div class="kpi-icon-row">
        <div class="kpi-icon-circle" style="background:var(--brand-blue-dim); color:var(--brand-blue);">${KPI_ICONS.fuel}</div>
        <div class="lbl">Total Fuel Issued</div>
      </div>
      <div class="val"><span class="num" id="kpiTotalLiter">0</span><span class="unit">Liter</span></div>
      <div class="gauge-wrap">
        <div class="gauge-track"><div class="gauge-fill" style="width:${gaugePct}%"></div></div>
        <div class="gauge-ticks"><span>0</span><span>${fmtInt(avgDaily)} L/hari rata-rata</span><span>${fmtInt(maxDaily)}</span></div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon-row">
        <div class="kpi-icon-circle" style="background:var(--good-dim); color:var(--good);">${KPI_ICONS.trend}</div>
        <div class="lbl">Average / Day</div>
      </div>
      <div class="val"><span class="num" id="kpiAvgDaily">0</span><span class="unit">Liter</span></div>
      <div class="delta">${days.length} hari tercatat</div>
      <div class="spark-wrap">${sparklineSVG(dailySeries, '#22c55e')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon-row">
        <div class="kpi-icon-circle" style="background:var(--accent-dim); color:var(--accent);">${KPI_ICONS.box}</div>
        <div class="lbl">Active Unit</div>
      </div>
      <div class="val"><span class="num" id="kpiActiveUnits">0</span><span class="unit">Unit</span></div>
      <div class="delta">unit unik terisi solar</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon-row">
        <div class="kpi-icon-circle" style="background:var(--purple-dim); color:var(--purple);">${KPI_ICONS.gauge}</div>
        <div class="lbl">Avg Actual L/HM</div>
      </div>
      <div class="val"><span class="num" id="kpiAvgLHM">0</span><span class="unit">L/HM</span></div>
      <div class="delta">rata-rata seluruh unit</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon-row">
        <div class="kpi-icon-circle" style="background:var(--bad-dim); color:var(--bad);">${KPI_ICONS.alert}</div>
        <div class="lbl">Over Consumption</div>
      </div>
      <div class="val"><span class="num" id="kpiOverLiter">0</span><span class="unit">L</span></div>
      <div class="delta" id="kpiOverPct">(${fmtNum(overPct,2)}%)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon-row">
        <div class="kpi-icon-circle" style="background:var(--good-dim); color:var(--good);">${KPI_ICONS.check}</div>
        <div class="lbl">Efficient</div>
      </div>
      <div class="val"><span class="num" id="kpiUnderLiter">0</span><span class="unit">L</span></div>
      <div class="delta" id="kpiUnderPct">(${fmtNum(underPct,2)}%)</div>
    </div>
  `;

  const prev = state.prevKpi || {};
  animateValue(document.getElementById('kpiTotalLiter'), prev.totalLiter||0, totalLiter);
  animateValue(document.getElementById('kpiAvgDaily'), prev.avgDaily||0, avgDaily);
  animateValue(document.getElementById('kpiActiveUnits'), prev.activeUnits||0, activeUnits);
  animateValue(document.getElementById('kpiAvgLHM'), prev.avgLHM||0, avgLHM, 650, 2);
  animateValue(document.getElementById('kpiOverLiter'), prev.overLiter||0, overLiter);
  animateValue(document.getElementById('kpiUnderLiter'), prev.underLiter||0, underLiter);
  document.getElementById('kpiOverPct').textContent = `(${fmtNum(overPct,2)}%)`;
  document.getElementById('kpiUnderPct').textContent = `(${fmtNum(underPct,2)}%)`;
  state.prevKpi = { totalLiter, avgDaily, activeUnits, avgLHM, overLiter, underLiter };
}

/* ============================================================
   RENDER: Charts
   ============================================================ */
function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }

function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function chartDefaults(){
  Chart.defaults.color = cssVar('--text-dim');
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
}
function gridColor(){ return cssVar('--border-soft'); }

function renderDailyChart(){
  const byDate = {};
  state.filtered.forEach(r=>{
    byDate[r.date] = byDate[r.date] || {Day:0, Night:0};
    byDate[r.date][r.shift] += r.liter;
  });
  const dates = Object.keys(byDate).sort();
  const dayVals = dates.map(d=>byDate[d].Day);
  const nightVals = dates.map(d=>byDate[d].Night);
  const totals = dates.map(d=>byDate[d].Day + byDate[d].Night);
  const labels = dates.map(d=>new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short'}));
  const maxTotal = Math.max(1, ...totals);

  destroyChart('daily');
  charts.daily = new Chart(document.getElementById('chartDaily'), {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Day', data:dayVals, backgroundColor:'#ff8a3d', borderRadius:3, stack:'s'},
      {label:'Night', data:nightVals, backgroundColor:'#3da5d9', borderRadius:3, stack:'s'}
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top:22 } },
      plugins:{
        legend:{display:false},
        tooltip:{
          mode:'index', intersect:false,
          callbacks:{
            footer: (items)=>{
              const i = items[0].dataIndex;
              return `Total: ${fmtInt(totals[i])} L`;
            }
          },
          footerFont:{ weight:'700' },
          footerColor: '#ff8a3d'
        }
      },
      scales:{
        x:{ grid:{display:false}, ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:14} },
        y:{ grid:{color:gridColor()}, ticks:{callback:v=>fmtInt(v)}, suggestedMax:maxTotal*1.16 }
      }
    },
    plugins:[{
      id:'dailyTotalLabels',
      afterDatasetsDraw(chart){
        const { ctx, scales:{x, y} } = chart;
        ctx.save();
        ctx.font = "600 10.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = cssVar('--text-dim');
        ctx.textAlign = 'center';
        totals.forEach((t, i)=>{
          const xPos = x.getPixelForValue(i);
          const yPos = y.getPixelForValue(t) - 8;
          ctx.fillText(fmtInt(t), xPos, yPos);
        });
        ctx.restore();
      }
    }]
  });
}

function renderShiftChart(){
  const byShift = {Day:0, Night:0};
  state.filtered.forEach(r=> byShift[r.shift] += r.liter);
  const total = byShift.Day + byShift.Night || 1;

  destroyChart('shift');
  charts.shift = new Chart(document.getElementById('chartShift'), {
    type:'doughnut',
    data:{ labels:['Day','Night'], datasets:[{ data:[byShift.Day, byShift.Night], backgroundColor:['#ff8a3d','#3da5d9'], borderWidth:0 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'70%', plugins:{legend:{display:false}} }
  });

  document.getElementById('legendShift').innerHTML = `
    <div class="legend-item"><span class="legend-dot" style="background:#ff8a3d"></span>Day — ${fmtInt(byShift.Day)} L (${fmtNum(byShift.Day/total*100)}%)</div>
    <div class="legend-item"><span class="legend-dot" style="background:#3da5d9"></span>Night — ${fmtInt(byShift.Night)} L (${fmtNum(byShift.Night/total*100)}%)</div>
  `;
}

function renderCategoryChart(){
  const byCat = {};
  state.filtered.forEach(r=>{ byCat[r.prefix] = (byCat[r.prefix]||0) + r.liter; });
  const sorted = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(([k])=> k);
  const vals = sorted.map(([,v])=>v);
  const colors = sorted.map((_,i)=>colorFor(i));

  destroyChart('category');
  charts.category = new Chart(document.getElementById('chartCategory'), {
    type:'bar',
    data:{ labels, datasets:[{ data:vals, backgroundColor:colors, borderRadius:4, barThickness:16 }]},
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`${fmtInt(c.parsed.x)} L`}} },
      scales:{ x:{ grid:{color:gridColor()}, ticks:{callback:v=>fmtInt(v)} }, y:{ grid:{display:false} } }
    }
  });
}

function renderTruckChart(){
  const byTruck = {};
  state.filtered.forEach(r=>{ byTruck[r.fuelTruck] = (byTruck[r.fuelTruck]||0) + r.liter; });
  const entries = Object.entries(byTruck).sort((a,b)=>b[1]-a[1]);
  const labels = entries.map(([k])=>k);
  const vals = entries.map(([,v])=>v);
  const total = vals.reduce((a,b)=>a+b,0) || 1;
  const colors = labels.map((_,i)=>colorFor(i+2));

  destroyChart('truck');
  charts.truck = new Chart(document.getElementById('chartTruck'), {
    type:'doughnut',
    data:{ labels, datasets:[{ data:vals, backgroundColor:colors, borderWidth:0 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{legend:{display:false}} }
  });

  document.getElementById('legendTruck').innerHTML = entries.map(([k,v],i)=>
    `<div class="legend-item"><span class="legend-dot" style="background:${colorFor(i+2)}"></span>${k} — ${fmtInt(v)} L (${fmtNum(v/total*100)}%)</div>`
  ).join('');
}

/* ============================================================
   RENDER: Efficiency table
   ============================================================ */
function computeEfficiencyRows(){
  const byCat = {};
  state.filtered.forEach(r=>{
    byCat[r.prefix] = byCat[r.prefix] || { liter:0, trips:0, ltrSum:0, ltrCount:0 };
    byCat[r.prefix].liter += r.liter;
    byCat[r.prefix].trips += 1;
    if(r.ltrHM != null){ byCat[r.prefix].ltrSum += r.ltrHM; byCat[r.prefix].ltrCount += 1; }
  });
  let rows = Object.entries(byCat).map(([prefix, v])=>{
    const std = state.standard[prefix];
    const stdVal = std ? std.standard_lhm : null;
    const model = std ? std.model : prefix;
    const actual = v.ltrCount ? v.ltrSum / v.ltrCount : null;
    const variance = (stdVal && actual != null) ? (actual - stdVal) / stdVal * 100 : null;
    let status = 'normal';
    if(variance != null){
      if(variance > 15) status = 'over';
      else if(variance < -15) status = 'under';
    }
    return { prefix, model, liter:v.liter, trips:v.trips, std:stdVal, actual, variance, status };
  });

  rows.sort((a,b)=>{
    let av = a[state.effSortKey], bv = b[state.effSortKey];
    if(av == null) av = -Infinity; if(bv == null) bv = -Infinity;
    if(typeof av === 'string') return state.effSortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return state.effSortDir==='asc' ? av-bv : bv-av;
  });
  return rows;
}

function renderEfficiencyTable(){
  const rows = computeEfficiencyRows();
  const maxLiter = Math.max(1, ...rows.map(r=>r.liter));
  const statusLabel = {over:'Di atas standar', under:'Di bawah standar', normal:'Sesuai standar'};

  document.getElementById('effTbody').innerHTML = rows.map(r=>`
    <tr>
      <td class="mono">${r.prefix}</td>
      <td>${r.model}</td>
      <td class="mono">
        <div class="bar-cell">
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${r.liter/maxLiter*100}%"></div></div>
          ${fmtInt(r.liter)}
        </div>
      </td>
      <td class="mono">${r.trips}</td>
      <td class="mono">${r.std!=null ? fmtNum(r.std,2) : '-'}</td>
      <td class="mono">${r.actual!=null ? fmtNum(r.actual,2) : '-'}</td>
      <td class="mono">${r.variance!=null ? (r.variance>0?'+':'')+fmtNum(r.variance,1)+'%' : '-'}</td>
      <td><span class="badge ${r.status}">${statusLabel[r.status]}</span></td>
    </tr>
  `).join('') || `<tr><td colspan="8" style="text-align:center; color:var(--text-faint); padding:20px;">Tidak ada data pada filter ini</td></tr>`;
}

/* ============================================================
   RENDER: Leaderboard (top boros / top efisien)
   ============================================================ */
function avatarColor(prefix){
  const cats = uniq(state.filtered.map(r=>r.prefix)).sort();
  const idx = cats.indexOf(prefix);
  return colorFor(idx < 0 ? 0 : idx);
}

function renderLeaderboard(){
  const rows = computeEfficiencyRows().filter(r=>r.variance != null && r.trips >= 3);

  const over = [...rows].sort((a,b)=>b.variance-a.variance).slice(0,5);
  const under = [...rows].sort((a,b)=>a.variance-b.variance).slice(0,5);

  const rowHTML = (r, i, isOver) => `
    <div class="lb-row">
      <div class="lb-rank">#${i+1}</div>
      <div class="lb-avatar" style="background:${avatarColor(r.prefix)}">${r.prefix.slice(0,2)}</div>
      <div class="lb-info">
        <div class="name">${r.model}</div>
        <div class="meta">${r.prefix} · ${r.trips}x isi · ${fmtInt(r.liter)} L</div>
      </div>
      <div class="lb-value">
        <div class="num ${isOver?'pos':'neg'}">${r.variance>0?'+':''}${fmtNum(r.variance,1)}%</div>
        <div class="sub">${fmtNum(r.actual,1)} vs ${fmtNum(r.std,1)} L/HM</div>
      </div>
    </div>`;

  document.getElementById('lbOver').innerHTML = over.length
    ? over.map((r,i)=>rowHTML(r,i,true)).join('')
    : `<div class="lb-empty">Tidak ada data cukup pada filter ini</div>`;
  document.getElementById('lbUnder').innerHTML = under.length
    ? under.map((r,i)=>rowHTML(r,i,false)).join('')
    : `<div class="lb-empty">Tidak ada data cukup pada filter ini</div>`;
}

/* ============================================================
   RENDER: Heatmap (weekday x hour)
   ============================================================ */
const WEEKDAY_ID = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function renderHeatmap(){
  const matrix = Array.from({length:7}, ()=>Array(24).fill(0));
  state.filtered.forEach(r=>{
    if(!r.time) return;
    const hour = parseInt(r.time.slice(0,2), 10);
    const wd = new Date(r.date+'T00:00:00').getDay();
    if(!isNaN(hour)) matrix[wd][hour] += r.liter;
  });

  const max = Math.max(1, ...matrix.flat());
  const order = [1,2,3,4,5,6,0]; // Sen..Min

  let html = `<div class="heatmap-grid">`;
  html += `<div class="hm-corner"></div>`;
  for(let h=0; h<24; h++) html += `<div class="hm-hour">${h}</div>`;

  order.forEach(wd=>{
    html += `<div class="hm-day">${WEEKDAY_ID[wd]}</div>`;
    for(let h=0; h<24; h++){
      const v = matrix[wd][h];
      const alpha = v ? 0.12 + (v/max)*0.85 : 0.05;
      html += `<div class="hm-cell" style="background:rgba(255,138,61,${alpha.toFixed(2)})" title="${WEEKDAY_ID[wd]} jam ${h}:00 — ${fmtInt(v)} L"></div>`;
    }
  });
  html += `</div>`;
  html += `
    <div class="heatmap-legend">
      <span>Sepi</span>
      <div class="scale">
        ${[0.1,0.3,0.5,0.7,0.9].map(a=>`<div style="background:rgba(255,138,61,${a})"></div>`).join('')}
      </div>
      <span>Sibuk</span>
    </div>`;

  document.getElementById('heatmapWrap').innerHTML = html;
}

/* ============================================================
   RENDER: Log table (paginated)
   ============================================================ */
function renderLogTable(){
  let rows = [...state.filtered];
  rows.sort((a,b)=>{
    let av = a[state.sortKey], bv = b[state.sortKey];
    if(av == null) av = ''; if(bv == null) bv = '';
    if(typeof av === 'string') return state.sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return state.sortDir==='asc' ? av-bv : bv-av;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page-1)*state.pageSize;
  const pageRows = rows.slice(start, start+state.pageSize);

  document.getElementById('logTbody').innerHTML = pageRows.map(r=>`
    <tr>
      <td class="mono">${r.date}</td>
      <td class="mono">${(r.time||'').slice(0,5)}</td>
      <td><span class="shift-pill ${r.shift==='Day'?'day':'night'}">${r.shift}</span></td>
      <td class="mono">${r.unit}</td>
      <td>${r.type||'-'}</td>
      <td class="mono">${fmtInt(r.liter)}</td>
      <td class="mono">${r.totalHM!=null ? fmtNum(r.totalHM,1) : '-'}</td>
      <td class="mono">${r.ltrHM!=null ? fmtNum(r.ltrHM,2) : '-'}</td>
      <td class="mono">${r.fuelTruck||'-'}</td>
      <td>${r.driver||'-'}</td>
    </tr>
  `).join('') || `<tr><td colspan="10" style="text-align:center; color:var(--text-faint); padding:20px;">Tidak ada data pada filter ini</td></tr>`;

  document.getElementById('logCount').textContent = `${fmtInt(total)} baris`;
  document.getElementById('pgInfo').textContent = `${state.page} / ${totalPages}`;
  document.getElementById('pgFirst').disabled = state.page<=1;
  document.getElementById('pgPrev').disabled = state.page<=1;
  document.getElementById('pgNext').disabled = state.page>=totalPages;
  document.getElementById('pgLast').disabled = state.page>=totalPages;
  state._totalPages = totalPages;
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderAll(){
  const steps = [renderKPIs, renderInsightsSection, renderDailyChart, renderShiftChart, renderCategoryChart, renderTruckChart, renderEfficiencyTable, renderLeaderboard, renderHeatmap, renderLogTable];
  for(const step of steps){
    try{ step(); }
    catch(err){ console.error(`renderAll: ${step.name} failed`, err); }
  }
}

/* ============================================================
   EVENTS
   ============================================================ */
['fDateFrom','fDateTo','fShift','fCategory'].forEach(id=>{
  document.getElementById(id).addEventListener('change', applyFilters);
});
document.getElementById('fSearch').addEventListener('input', ()=>{
  clearTimeout(window._searchDebounce);
  window._searchDebounce = setTimeout(applyFilters, 200);
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  document.getElementById('fShift').value = 'all';
  document.getElementById('fCategory').value = 'all';
  document.getElementById('fSearch').value = '';
  setDateBounds();
  applyFilters();
});

document.querySelectorAll('#logTable thead th').forEach(th=>{
  th.addEventListener('click', ()=>{
    const k = th.dataset.k;
    if(state.sortKey === k) state.sortDir = state.sortDir==='asc' ? 'desc' : 'asc';
    else { state.sortKey = k; state.sortDir = 'asc'; }
    renderLogTable();
  });
});
document.querySelectorAll('#effTable thead th').forEach(th=>{
  th.addEventListener('click', ()=>{
    const k = th.dataset.k;
    if(state.effSortKey === k) state.effSortDir = state.effSortDir==='asc' ? 'desc' : 'asc';
    else { state.effSortKey = k; state.effSortDir = 'desc'; }
    renderEfficiencyTable();
  });
});

document.getElementById('pgFirst').addEventListener('click', ()=>{ state.page=1; renderLogTable(); });
document.getElementById('pgPrev').addEventListener('click', ()=>{ state.page=Math.max(1,state.page-1); renderLogTable(); });
document.getElementById('pgNext').addEventListener('click', ()=>{ state.page=Math.min(state._totalPages,state.page+1); renderLogTable(); });
document.getElementById('pgLast').addEventListener('click', ()=>{ state.page=state._totalPages; renderLogTable(); });

/* ============================================================
   EXCEL UPLOAD — client-side parsing with SheetJS
   ============================================================ */
function showToast(msg, kind){
  const el = document.getElementById('uploadToast');
  el.style.display = 'flex';
  el.style.borderColor = kind==='error' ? 'var(--bad)' : (kind==='ok' ? 'var(--good)' : 'var(--accent)');
  el.innerHTML = msg;
}
function hideToast(){ document.getElementById('uploadToast').style.display = 'none'; }

document.getElementById('btnUpload').addEventListener('click', ()=> document.getElementById('fileUpload').click());

document.getElementById('fileUpload').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  showToast(`Membaca <b>${file.name}</b> ...`, 'info');
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, {type:'array', cellDates:true});
      const parsed = parseWorkbook(wb);
      if(!parsed.records.length){
        showToast(`File terbaca, tapi tidak ditemukan baris transaksi yang valid di sheet "Fuel Usage". Pastikan format sama seperti template asal.`, 'error');
        document.getElementById('statusDot').style.background = 'var(--bad)';
        document.getElementById('statusText').textContent = 'Gagal memuat';
        return;
      }
      const totalLiterUploaded = parsed.records.reduce((s,r)=>s+r.liter,0);
      loadData(parsed.records, parsed.standard);
      document.getElementById('statusDot').style.background = 'var(--good)';
      document.getElementById('statusText').textContent = 'Tervalidasi (upload)';
      showToast(`✅ Berhasil memuat <b>${parsed.records.length.toLocaleString('id-ID')}</b> transaksi dari <b>${file.name}</b>. Total: <b>${fmtInt(totalLiterUploaded)} L</b>.`, 'ok');
    }catch(err){
      console.error(err);
      showToast(`Gagal membaca file: ${err.message}`, 'error');
      document.getElementById('statusDot').style.background = 'var(--bad)';
      document.getElementById('statusText').textContent = 'Gagal memuat';
    }
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';
});

/* Fixed column layout matching the "Fuel Usage" sheet template
   (0-based indices, same structure as the source workbook). */
const COLS = {
  date:2, day:3, time:4, shift:5, unit:6, type:7,
  liter:9, hmBefore:10, hmAfter:11, totalHM:12,
  ltrHM:15, fuelTruck:16, prefix:27, driver:28
};

function findSheet(wb, mustInclude, mustExclude){
  const name = wb.SheetNames.find(n=>{
    const low = n.toLowerCase();
    const ok = mustInclude.every(k=>low.includes(k));
    const bad = (mustExclude||[]).some(k=>low.includes(k));
    return ok && !bad;
  });
  return name ? wb.Sheets[name] : null;
}

function excelTimeToHHMM(v){
  if(v instanceof Date){
    const h = String(v.getHours()).padStart(2,'0');
    const m = String(v.getMinutes()).padStart(2,'0');
    return `${h}:${m}:00`;
  }
  if(typeof v === 'number'){ // fraction of a day
    const totalMin = Math.round(v*24*60);
    const h = String(Math.floor(totalMin/60)).padStart(2,'0');
    const m = String(totalMin%60).padStart(2,'0');
    return `${h}:${m}:00`;
  }
  return v ? String(v) : null;
}

function toISODate(v){
  if(v instanceof Date && !isNaN(v)){
    const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseFuelUsageSheet(sheet){
  if(!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:true, defval:null});
  const records = [];
  const typeByPrefix = {};

  // pass 1: collect known type-unit names per prefix
  for(const row of rows){
    const iso = toISODate(row[COLS.date]);
    if(!iso) continue;
    const liter = row[COLS.liter];
    if(typeof liter !== 'number') continue;
    const prefix = row[COLS.prefix];
    const type = row[COLS.type];
    if(prefix && type && !typeByPrefix[prefix]) typeByPrefix[prefix] = type;
  }

  for(const row of rows){
    const iso = toISODate(row[COLS.date]);
    if(!iso) continue;
    const liter = row[COLS.liter];
    if(typeof liter !== 'number' || liter <= 0) continue;

    const shiftRaw = (row[COLS.shift] || '').toString();
    const shift = shiftRaw.toLowerCase().includes('night') ? 'Night' : 'Day';
    const prefix = row[COLS.prefix] || null;

    records.push({
      date: iso,
      day: row[COLS.day] || null,
      time: excelTimeToHHMM(row[COLS.time]),
      shift,
      unit: row[COLS.unit] || null,
      type: row[COLS.type] || (prefix ? typeByPrefix[prefix] : null) || null,
      prefix,
      liter: Math.round(liter),
      hmBefore: typeof row[COLS.hmBefore]==='number' ? row[COLS.hmBefore] : null,
      hmAfter: typeof row[COLS.hmAfter]==='number' ? row[COLS.hmAfter] : null,
      totalHM: typeof row[COLS.totalHM]==='number' ? row[COLS.totalHM] : null,
      ltrHM: typeof row[COLS.ltrHM]==='number' ? Math.round(row[COLS.ltrHM]*100)/100 : null,
      fuelTruck: row[COLS.fuelTruck] || null,
      driver: row[COLS.driver] || null,
    });
  }
  return records;
}

function parseStandardSheet(sheet){
  if(!sheet) return {};
  const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:true, defval:null});
  const standard = {};
  let headerRow = -1;
  for(let i=0;i<rows.length;i++){
    const c1 = (rows[i][1]||'').toString().toLowerCase();
    const c3 = (rows[i][3]||'').toString().toLowerCase();
    if(c1.includes('remark') && c3.includes('stndar')){ headerRow = i; break; }
  }
  if(headerRow === -1) return {};
  let blanks = 0;
  for(let i=headerRow+1; i<rows.length && blanks<2; i++){
    const prefix = rows[i][1], model = rows[i][2], std = rows[i][3];
    if(!prefix){ blanks++; continue; }
    blanks = 0;
    if(typeof std === 'number'){
      standard[prefix.toString().trim()] = { model: model ? model.toString().trim() : prefix, standard_lhm: std };
    }
  }
  return standard;
}

function parseWorkbook(wb){
  const usageSheet = findSheet(wb, ['fuel usage'], ['email']);
  const consSheet = findSheet(wb, ['fuel consumption'], ['email']);
  const records = parseFuelUsageSheet(usageSheet);
  const standard = parseStandardSheet(consSheet);
  return { records, standard };
}

/* ============================================================
   SIDEBAR NAVIGATION + SCROLL SPY
   ============================================================ */
const navLinks = document.querySelectorAll('.nav-link[data-target]');
navLinks.forEach(link=>{
  link.addEventListener('click', ()=>{
    const target = document.getElementById(link.dataset.target);
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
    closeSidebarMobile();
  });
});

const sections = [...navLinks].map(l=>document.getElementById(l.dataset.target)).filter(Boolean);
if('IntersectionObserver' in window && sections.length){
  const spy = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        navLinks.forEach(l=>l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[data-target="${entry.target.id}"]`);
        if(active) active.classList.add('active');
      }
    });
  }, { rootMargin:'-15% 0px -70% 0px', threshold:0 });
  sections.forEach(s=>spy.observe(s));
}

/* ============================================================
   MOBILE SIDEBAR TOGGLE
   ============================================================ */
const sidebarEl = document.getElementById('sidebar');
const backdropEl = document.getElementById('sidebarBackdrop');
function openSidebarMobile(){ sidebarEl.classList.add('open'); backdropEl.classList.add('open'); }
function closeSidebarMobile(){ sidebarEl.classList.remove('open'); backdropEl.classList.remove('open'); }
document.getElementById('sidebarToggle').addEventListener('click', openSidebarMobile);
backdropEl.addEventListener('click', closeSidebarMobile);

/* ============================================================
   DESKTOP SIDEBAR COLLAPSE / EXPAND
   ============================================================ */
const expandBtn = document.getElementById('sidebarExpandBtn');
function collapseSidebar(){
  sidebarEl.classList.add('collapsed');
  expandBtn.classList.add('show');
}
function expandSidebar(){
  sidebarEl.classList.remove('collapsed');
  expandBtn.classList.remove('show');
}
document.getElementById('sidebarCollapseBtn').addEventListener('click', collapseSidebar);
expandBtn.addEventListener('click', expandSidebar);

/* ============================================================
   THEME SWITCH (dark / light) — in-memory only, no storage
   ============================================================ */
function setTheme(mode){
  document.documentElement.dataset.theme = mode;
  document.getElementById('btnDark').classList.toggle('active', mode==='dark');
  document.getElementById('btnLight').classList.toggle('active', mode==='light');
  try{ chartDefaults(); }catch(err){ console.error(err); }
  renderAll();
  try{ renderStockSection(); }catch(err){ console.error(err); }
}
document.getElementById('btnDark').addEventListener('click', ()=>setTheme('dark'));
document.getElementById('btnLight').addEventListener('click', ()=>setTheme('light'));

/* Upload shortcut from sidebar */
document.getElementById('navUpload').addEventListener('click', ()=>{
  document.getElementById('fileUpload').click();
  closeSidebarMobile();
});

/* ============================================================
   EXPORT LAPORAN (PDF via print)
   ============================================================ */
document.getElementById('btnExport').addEventListener('click', ()=>{
  window.print();
});

/* ============================================================
   RENDER: Insight & Rekomendasi (rule-based)
   ============================================================ */
function generateInsights(){
  const insights = [];
  const data = state.filtered;
  if(!data.length) return insights;

  // 1. Unit paling boros / paling efisien
  const effRows = computeEfficiencyRows().filter(r=>r.variance!=null && r.trips>=3);
  if(effRows.length){
    const worst = [...effRows].sort((a,b)=>b.variance-a.variance)[0];
    if(worst.variance > 15){
      insights.push({type:'bad', icon:'🔧', title:`${worst.model} boros ${fmtNum(worst.variance,1)}%`,
        desc:`Konsumsi aktual ${fmtNum(worst.actual,1)} L/HM, di atas standar ${fmtNum(worst.std,1)} L/HM (${worst.trips}x pengisian, total ${fmtInt(worst.liter)} L).`,
        rec:`Cek kondisi mesin, filter udara/solar, dan pola operasi unit ${worst.prefix}.`});
    }
    const best = [...effRows].sort((a,b)=>a.variance-b.variance)[0];
    if(best.variance < -15){
      insights.push({type:'good', icon:'✅', title:`${best.model} paling efisien`,
        desc:`Konsumsi ${fmtNum(best.actual,1)} L/HM, ${fmtNum(Math.abs(best.variance),1)}% di bawah standar ${fmtNum(best.std,1)} L/HM.`,
        rec:'Bisa dijadikan acuan best practice perawatan/pengoperasian untuk kategori sejenis.'});
    }
  }

  // 2. Ketimpangan shift
  const byShift = {Day:0, Night:0};
  data.forEach(r=> byShift[r.shift]+=r.liter);
  const shiftTotal = byShift.Day+byShift.Night;
  if(shiftTotal){
    const dayPct = byShift.Day/shiftTotal*100;
    if(dayPct>70 || dayPct<30){
      insights.push({type:'info', icon:'🕐', title:'Distribusi shift tidak merata',
        desc:`Shift Day menyumbang ${fmtNum(dayPct,1)}% (${fmtInt(byShift.Day)} L) vs Night ${fmtNum(100-dayPct,1)}% (${fmtInt(byShift.Night)} L) dari total konsumsi.`,
        rec:'Cek apakah ini sesuai rencana operasi, atau ada unit yang idle di salah satu shift.'});
    }
  }

  // 3. Lonjakan konsumsi harian
  const byDate = {};
  data.forEach(r=> byDate[r.date]=(byDate[r.date]||0)+r.liter);
  const dateEntries = Object.entries(byDate).sort((a,b)=>b[1]-a[1]);
  if(dateEntries.length>1){
    const [peakDate, peakVal] = dateEntries[0];
    const avgVal = Object.values(byDate).reduce((a,b)=>a+b,0)/dateEntries.length;
    if(peakVal > avgVal*1.5){
      insights.push({type:'info', icon:'📈', title:'Lonjakan konsumsi terdeteksi',
        desc:`${new Date(peakDate+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long'})} tercatat ${fmtInt(peakVal)} L, ${fmtNum(peakVal/avgVal,1)}x rata-rata harian (${fmtInt(Math.round(avgVal))} L).`,
        rec:'Cross-check dengan jadwal operasi/produksi pada tanggal tersebut.'});
    }
  }

  // 4. Ketahanan stock
  const stockRows = getStockRows();
  let totalUsageActualStock = 0, totalUsagePlanStock = 0;
  if(stockRows.length){
    const last = stockRows[stockRows.length-1];
    const capacity = (typeof STOCK_DATA!=='undefined' && STOCK_DATA.meta.fuelStorage) || 20000;
    const currentStock = last.stockFisik!=null ? last.stockFisik : last.stockActual;
    const pct = capacity ? currentStock/capacity*100 : 0;
    totalUsageActualStock = stockRows.reduce((s,r)=>s+(r.usageActual||0),0);
    totalUsagePlanStock = stockRows.reduce((s,r)=>s+(r.usagePlan||0),0);
    const daysCounted = stockRows.filter(r=>r.usageActual!=null).length || 1;
    const avgDaily = totalUsageActualStock/daysCounted;
    const runway = avgDaily>0 ? currentStock/avgDaily : null;
    if(pct<40 || (runway!=null && runway<5)){
      insights.push({type:'bad', icon:'⛽', title:'Stock fuel menipis',
        desc:`Sisa stock ${fmtInt(currentStock)} L (${fmtNum(pct,1)}% kapasitas)${runway!=null?`, cukup untuk ± ${fmtNum(runway,1)} hari lagi`:''}.`,
        rec:'Segera jadwalkan order/refill fuel truck ke site sebelum stock kritis.'});
    }
  }

  // 5. Pemakaian vs plan keseluruhan
  if(totalUsagePlanStock){
    const diffPct = (totalUsageActualStock-totalUsagePlanStock)/totalUsagePlanStock*100;
    if(Math.abs(diffPct)>10){
      insights.push({type: diffPct>0?'warn':'good', icon: diffPct>0?'⚠️':'👍', title:`Pemakaian ${diffPct>0?'melebihi':'di bawah'} plan ${fmtNum(Math.abs(diffPct),1)}%`,
        desc:`Aktual ${fmtInt(totalUsageActualStock)} L vs Plan ${fmtInt(totalUsagePlanStock)} L pada periode berjalan.`,
        rec: diffPct>0 ? 'Evaluasi budget fuel bulanan atau cek unit dengan konsumsi di luar rencana.' : 'Efisiensi operasi cukup baik, pertahankan pola kerja saat ini.'});
    }
  }

  // 6. Ketimpangan beban fuel truck
  const byTruck = {};
  data.forEach(r=> byTruck[r.fuelTruck]=(byTruck[r.fuelTruck]||0)+r.liter);
  const truckEntries = Object.entries(byTruck).sort((a,b)=>b[1]-a[1]);
  if(truckEntries.length>=2){
    const [topTruck, topVal] = truckEntries[0];
    const totalTruck = truckEntries.reduce((s,[,v])=>s+v,0);
    const topPct = totalTruck ? topVal/totalTruck*100 : 0;
    if(topPct>65){
      insights.push({type:'info', icon:'🚛', title:'Beban fuel truck tidak seimbang',
        desc:`${topTruck} menanggung ${fmtNum(topPct,1)}% dari total distribusi (${fmtInt(topVal)} L).`,
        rec:'Pertimbangkan rotasi rute/jadwal supaya beban antar fuel truck lebih merata.'});
    }
  }

  return insights;
}

function renderInsightsSection(){
  const grid = document.getElementById('insightGrid');
  if(!grid) return;
  const insights = generateInsights();
  if(!insights.length){
    grid.innerHTML = `<div class="insight-empty">Tidak ada insight signifikan pada data/filter saat ini — semua metrik dalam batas normal. 👍</div>`;
    return;
  }
  grid.innerHTML = insights.map(ins=>`
    <div class="insight-card ${ins.type}">
      <div class="ic-head"><span class="ic-icon">${ins.icon}</span><span class="ic-title">${ins.title}</span></div>
      <div class="ic-desc">${ins.desc}</div>
      <div class="ic-rec">💡 ${ins.rec}</div>
    </div>
  `).join('');
}

/* ============================================================
   RENDER: Sisa Stock Fuel (Resume sheet)
   ============================================================ */
function stockCutoffDate(){
  // Only show days that actually have recorded fuel-usage transactions
  if(!state.records.length) return null;
  return state.records.map(r=>r.date).sort().slice(-1)[0];
}

function getStockRows(){
  if(typeof STOCK_DATA === 'undefined' || !STOCK_DATA.rows) return [];
  const cutoff = stockCutoffDate();
  return cutoff ? STOCK_DATA.rows.filter(r=>r.date <= cutoff) : STOCK_DATA.rows;
}

function fmtLiter(n){ return n==null ? '-' : `${fmtInt(n)} L`; }

function renderTank(pct, statusEl){
  const clamped = Math.max(0, Math.min(100, pct));
  const rect = document.getElementById('tankFillRect');
  const totalH = 190, y0 = 10;
  const h = totalH * (clamped/100);
  rect.setAttribute('y', (y0 + totalH - h).toFixed(1));
  rect.setAttribute('height', h.toFixed(1));
  document.getElementById('tankPct').textContent = `${fmtNum(clamped,0)}%`;

  let cls='ok', label='Stock Aman';
  if(clamped < 20){ cls='bad'; label='Stock Kritis'; }
  else if(clamped < 40){ cls='warn'; label='Stock Menipis'; }
  statusEl.className = `tank-badge ${cls}`;
  statusEl.textContent = label;
}

function renderStockSection(){
  const rows = getStockRows();
  if(!rows.length) return;

  const meta = STOCK_DATA.meta;
  const last = rows[rows.length-1];
  const capacity = meta.fuelStorage || 20000;
  const currentStock = last.stockFisik != null ? last.stockFisik : last.stockActual;
  const pct = capacity ? (currentStock/capacity*100) : 0;

  const totalOrder = rows.reduce((s,r)=> s + (r.order||0), 0);
  const totalUsageActual = rows.reduce((s,r)=> s + (r.usageActual||0), 0);
  const totalUsagePlan = rows.reduce((s,r)=> s + (r.usagePlan||0), 0);
  const daysCounted = rows.filter(r=>r.usageActual != null).length || 1;
  const avgDaily = totalUsageActual / daysCounted;
  const runwayDays = avgDaily > 0 ? currentStock / avgDaily : null;
  const vsPlanPct = totalUsagePlan ? ((totalUsageActual - totalUsagePlan)/totalUsagePlan*100) : null;

  document.getElementById('stockCurrent').textContent = fmtLiter(currentStock);
  document.getElementById('stockCapacity').textContent = fmtLiter(capacity);
  document.getElementById('stockRunway').textContent = runwayDays!=null ? `± ${fmtNum(runwayDays,1)} hari lagi` : '-';
  document.getElementById('stockOrder').textContent = fmtLiter(totalOrder);
  document.getElementById('stockUsageActual').textContent = fmtLiter(totalUsageActual);
  const lastOrderRow = [...rows].reverse().find(r=> (r.order||0) > 0);
  if(lastOrderRow){
    document.getElementById('stockLastOrder').textContent = fmtLiter(lastOrderRow.order);
    document.getElementById('stockLastOrderNote').textContent = new Date(lastOrderRow.date+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  } else {
    document.getElementById('stockLastOrder').textContent = '-';
    document.getElementById('stockLastOrderNote').textContent = 'belum ada refill tercatat';
  }
  document.getElementById('stockVsPlan').textContent = vsPlanPct!=null ? `${vsPlanPct>0?'+':''}${fmtNum(vsPlanPct,1)}%` : '-';
  document.getElementById('stockVsPlan').style.color = vsPlanPct>0 ? 'var(--bad)' : 'var(--good)';
  document.getElementById('stockVsPlanNote').textContent = `${fmtLiter(totalUsageActual)} aktual vs ${fmtLiter(totalUsagePlan)} plan`;

  renderTank(pct, document.getElementById('stockStatusBadge'));

  // --- Chart: Stock trend vs capacity ---
  const labels = rows.map(r=>new Date(r.date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short'}));
  const stockSeries = rows.map(r=> r.stockFisik != null ? r.stockFisik : r.stockActual);

  destroyChart('stockTrend');
  charts.stockTrend = new Chart(document.getElementById('chartStockTrend'), {
    type:'line',
    data:{ labels, datasets:[
      {
        label:'Stock at Site', data:stockSeries, borderColor:'#ff8a3d', backgroundColor:'#ff8a3d26',
        fill:true, tension:.3, pointRadius:2, pointBackgroundColor:'#ff8a3d', borderWidth:2
      },
      {
        label:'Kapasitas', data:labels.map(()=>capacity), borderColor:'#f8717188', borderDash:[6,4],
        pointRadius:0, borderWidth:1.4, fill:false
      }
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{mode:'index', intersect:false, callbacks:{label:c=> c.datasetIndex===0 ? `Stock: ${fmtInt(c.parsed.y)} L` : `Kapasitas: ${fmtInt(c.parsed.y)} L`}} },
      scales:{
        x:{ grid:{display:false}, ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:12} },
        y:{ grid:{color:gridColor()}, ticks:{callback:v=>fmtInt(v)}, suggestedMax:capacity*1.08 }
      }
    }
  });

  // --- Chart: Usage plan vs actual ---
  const planSeries = rows.map(r=>r.usagePlan||0);
  const actualSeries = rows.map(r=>r.usageActual||0);

  destroyChart('usagePlan');
  charts.usagePlan = new Chart(document.getElementById('chartUsagePlan'), {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Plan', data:planSeries, backgroundColor:'#3da5d955', borderColor:'#3da5d9', borderWidth:1.4, borderRadius:3},
      {label:'Actual', data:actualSeries, backgroundColor:'#ff8a3d', borderRadius:3}
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:true, labels:{boxWidth:10, boxHeight:10, usePointStyle:true, pointStyle:'rectRounded'}}, tooltip:{mode:'index', intersect:false} },
      scales:{
        x:{ grid:{display:false}, ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:12} },
        y:{ grid:{color:gridColor()}, ticks:{callback:v=>fmtInt(v)} }
      }
    }
  });

  // --- Table ---
  document.getElementById('stockTbody').innerHTML = rows.map(r=>`
    <tr>
      <td class="mono">${r.date}</td>
      <td>${r.day||'-'}</td>
      <td class="mono">${r.firstStock!=null?fmtInt(r.firstStock):'-'}</td>
      <td class="mono">${r.order?fmtInt(r.order):'-'}</td>
      <td class="mono">${r.inQty?fmtInt(r.inQty):'-'}</td>
      <td class="mono">${r.outQty?fmtInt(r.outQty):'-'}</td>
      <td class="mono">${r.gtoLuwe?fmtInt(r.gtoLuwe):'-'}</td>
      <td class="mono">${r.reject?fmtInt(r.reject):'-'}</td>
      <td class="mono">${r.usagePlan!=null?fmtInt(r.usagePlan):'-'}</td>
      <td class="mono">${r.usageActual!=null?fmtInt(r.usageActual):'-'}</td>
      <td class="mono">${r.stockPlan!=null?fmtInt(r.stockPlan):'-'}</td>
      <td class="mono">${r.stockActual!=null?fmtInt(r.stockActual):'-'}</td>
      <td class="mono">${r.stockFisik!=null?fmtInt(r.stockFisik):'-'}</td>
    </tr>
  `).join('');
}

/* ============================================================
   INIT
   ============================================================ */
try{ chartDefaults(); }catch(err){ console.error('chartDefaults failed', err); }
loadData(EMBEDDED_DATA.records, EMBEDDED_DATA.standard);
if(navLinks[0]) navLinks[0].classList.add('active');
try{ renderStockSection(); }catch(err){ console.error('renderStockSection failed', err); }
