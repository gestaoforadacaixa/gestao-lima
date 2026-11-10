import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://oltwaosdzgvbbvermilk.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sdHdhb3Nkemd2YmJ2ZXJtaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDU3MjksImV4cCI6MjA5NDEyMTcyOX0.WbDR65w6eywTgLc4Lwii_63RrJwKPN9oj1DsgjxeFBo";
const CID = "lima";
const H = {
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Prefer": "return=representation",
};
async function sbGet(mes) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/lancamentos?cliente_id=eq.${CID}&mes=eq.${mes}&order=data.desc`, { headers: H });
    return r.ok ? r.json() : null;   // null = falhou (a tela mantém o que já tinha)
  } catch { return null; }
}
// `programado` (conta a pagar) e `meta_id` (vínculo com meta) são opcionais: se a coluna ainda não existir no banco, o lançamento é salvo igual, sem ela.
const semProg = ({programado, meta_id, ...resto}) => resto;
async function sbPost(body) {
  try {
    let r = await fetch(`${SUPA_URL}/rest/v1/lancamentos`, { method: "POST", headers: H, body: JSON.stringify(body) });
    if (r.status>=400 && r.status<500 && ("programado" in body || "meta_id" in body)) r = await fetch(`${SUPA_URL}/rest/v1/lancamentos`, { method: "POST", headers: H, body: JSON.stringify(semProg(body)) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
async function sbPatch(id, body) {
  try {
    const u = `${SUPA_URL}/rest/v1/lancamentos?id=eq.${id}`;
    let r = await fetch(u, { method: "PATCH", headers: { ...H, "Prefer": "return=minimal" }, body: JSON.stringify(body) });
    if (r.status>=400 && r.status<500 && ("programado" in body || "meta_id" in body)) r = await fetch(u, { method: "PATCH", headers: { ...H, "Prefer": "return=minimal" }, body: JSON.stringify(semProg(body)) });
    return r.ok;
  } catch { return false; }
}
async function rcGet(mes) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/receitas?cliente_id=eq.${CID}&mes=eq.${mes}&order=semana.desc`, { headers: H });
    return r.ok ? r.json() : null;   // null = falhou (a tela mantém o que já tinha)
  } catch { return null; }
}
async function rcPost(body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/receitas`, { method: "POST", headers: H, body: JSON.stringify(body) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
async function rcPatch(id, body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/receitas?id=eq.${id}`, { method: "PATCH", headers: { ...H, "Prefer": "return=minimal" }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}
async function rcDelete(id) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/receitas?id=eq.${id}`, { method: "DELETE", headers: H });
    return r.ok;
  } catch { return false; }
}
async function fetchCategorias() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/categorias?cliente_id=eq.${CID}&order=nome.asc`, { headers: H });
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function fetchAplicadoAll() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/lancamentos?cliente_id=eq.${CID}&categoria=eq.Aplicado&excluido=eq.false&order=data.desc`, { headers: H });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
// ─── Tabelas novas (metas) ─────────────────────────────────────────────────────
// Se a tabela ainda não existir no banco, a busca volta vazia e o resto do app segue normal.
async function tbGet(tabela, q="") {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${tabela}?cliente_id=eq.${CID}${q?"&"+q:""}`, { headers: H });
    if (r.status>=400 && r.status<500) return [];   // tabela ainda não existe: segue vazio
    return r.ok ? r.json() : null;                   // erro de servidor/rede: mantém o que já tinha
  } catch { return null; }
}
async function tbPost(tabela, body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${tabela}`, { method: "POST", headers: H, body: JSON.stringify(body) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
async function tbPatch(tabela, id, body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${tabela}?id=eq.${id}`, { method: "PATCH", headers: { ...H, "Prefer": "return=minimal" }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}
const uid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now());

// Fallback mínimo — só usado se a busca de categorias falhar ou vier vazia
// (você cadastra as categorias reais pelo Painel do Mentor)
let CATEGORIAS = ["Outros"];
const CAT_CORES = { "Outros": "#8792A8" };

const MEIOS = ["Crédito","Débito","Dinheiro","Pix","Transferência","Pluxe"];
const MESES_NOMES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MES_INICIO = "2026-08";
const FECHADOS = [];
function gerarMeses(){
  const [ay,am] = MES_INICIO.split("-").map(Number);
  const hoje = new Date();
  let ly = hoje.getFullYear() + 2, lm = hoje.getMonth()+1;
  const arr=[];
  let y=ay, m=am;
  while(y<ly || (y===ly && m<=lm)){
    const key=`${y}-${String(m).padStart(2,"0")}`;
    arr.push({ label:`${MESES_NOMES_FULL[m-1]} ${y}`, mes:key, fechado:FECHADOS.includes(key) });
    m++; if(m>12){ m=1; y++; }
  }
  return arr;
}
const MESES = gerarMeses();

const fmt     = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtDate = d => { const[,m,day]=d.split("-"); return `${day}/${m}`; };
const dLocal  = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const hoje    = () => dLocal(new Date());
const amanha  = () => { const d=new Date(); d.setDate(d.getDate()+1); return dLocal(d); };
const d2brl   = d => { const n=parseInt(d||"0",10); return `${Math.floor(n/100).toLocaleString("pt-BR")},${String(n%100).padStart(2,"0")}`; };
const d2float = d => parseInt(d||"0",10)/100;
const float2d = v => String(Math.round(v*100));
const soma    = arr => arr.filter(t=>!t.excluido && t.meio!=="Pluxe" && t.categoria!=="Aplicado" && !agendada(t,hoje())).reduce((s,t)=>s+t.valor,0);
const padN    = n => String(n).padStart(2,"0");
const addMesesData = (dataStr, n) => {
  const [y,m,d] = dataStr.split("-").map(Number);
  const tot = (m-1)+n;
  const ny = y + Math.floor(tot/12);
  const nm = (tot%12)+1;
  const ult = new Date(ny, nm, 0).getDate();
  return `${ny}-${padN(nm)}-${padN(Math.min(d,ult))}`;
};
const semanasDoMes = mesKey => {
  const [ano,mes] = mesKey.split("-").map(Number);
  const ultDia = new Date(ano, mes, 0).getDate();
  return [
    { ini:1,  fim:Math.min(7,ultDia),  label:"Sem 1" },
    { ini:8,  fim:Math.min(14,ultDia), label:"Sem 2" },
    { ini:15, fim:Math.min(21,ultDia), label:"Sem 3" },
    { ini:22, fim:Math.min(28,ultDia), label:"Sem 4" },
    ...(ultDia>28 ? [{ ini:29, fim:ultDia, label:"Sem 5" }] : []),
  ];
};

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0} html,body{background:#F4F2ED}
input,select,textarea{-webkit-appearance:none;appearance:none}
input:focus,select:focus,textarea:focus{outline:none;border-color:#2E6E5E!important;box-shadow:0 0 0 3px #2E6E5E20}
.tab:hover{color:#173C33!important}
.btn-primary{background:#173C33;color:#F4F2ED;border:none;border-radius:12px;padding:16px;font-size:15px;font-family:'Inter',sans-serif;font-weight:700;cursor:pointer;width:100%;transition:all .2s}
.btn-primary:hover{background:#0F2921}
.btn-success{background:#2E6E5E;color:#fff;border:none;border-radius:12px;padding:16px;font-size:15px;font-family:'Inter',sans-serif;font-weight:700;cursor:pointer;width:100%;transition:all .2s}
.btn-success:hover{background:#235448}
.btn-ghost{background:none;border:2px solid #E3DFD3;border-radius:12px;padding:14px;font-size:14px;font-family:'Inter',sans-serif;font-weight:600;cursor:pointer;width:100%;color:#7A7466;transition:all .2s;margin-top:10px}
.btn-ghost:hover{border-color:#aaa;color:#333}
.btn-danger{background:none;border:2px solid #B4483C;border-radius:12px;padding:14px;font-size:14px;font-family:'Inter',sans-serif;font-weight:600;cursor:pointer;width:100%;color:#B4483C;transition:all .2s;margin-top:10px}
.btn-danger:hover{background:#B4483C;color:#fff}
.app-wrap{max-width:480px}
.kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media (min-width:900px){.kpi-grid{grid-template-columns:repeat(6,1fr);gap:8px}.app-wrap.wide{max-width:1240px}}
.navtabs{scrollbar-width:none}.navtabs::-webkit-scrollbar{display:none}
html,body{background:#F4F2ED}
@media (min-width:900px){.app-wrap{max-width:900px}.sheet{max-width:520px}}
.fab{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#173C33,#2E6E5E);color:#F4F2ED;border:none;border-radius:50px;padding:15px 28px;font-size:14px;font-family:'Inter',sans-serif;font-weight:700;cursor:pointer;box-shadow:0 6px 24px #173C3345;z-index:90;display:flex;align-items:center;gap:8px;transition:all .2s;white-space:nowrap}
.fab-gold{background:linear-gradient(135deg,#A6822E,#C9A566);box-shadow:0 6px 24px #A6822E40}
.fab:hover{transform:translateX(-50%) translateY(-2px)} .fab:active{transform:translateX(-50%) scale(.98)}
.ctx-item{display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;color:#F3F3F3;font-size:13px;font-family:'Inter',sans-serif;padding:9px 12px;border-radius:6px;cursor:default;text-align:left}.ctx-item:hover{background:#FFFFFF14}.ctx-item.ctx-red{color:#FF9A92}
.overlay{position:fixed;inset:0;background:#00000055;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
.sheet{background:#fff;border-radius:20px;padding:22px 20px 20px;width:100%;max-width:440px;margin:0 auto;animation:popIn .2s ease-out;max-height:88vh;overflow-y:auto;box-shadow:0 12px 40px #00000040}
.sheet .handle{display:none}
@keyframes popIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
.overlay-top{position:fixed;inset:0;background:#00000055;z-index:200;display:flex;align-items:flex-start;padding-top:120px}
.handle{width:40px;height:4px;background:#e8e8e8;border-radius:2px;margin:12px auto 20px}
.row-item{transition:background .12s;border-radius:8px} .row-item:active{background:#F4F2ED}
.row-excluido{opacity:.4}
.badge{display:inline-flex;align-items:center;border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700;font-family:'Inter',sans-serif;margin-top:3px}
.icon-btn{background:none;border:2px solid #E3DFD3;border-radius:8px;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;color:#7A7466}
.icon-btn:hover{border-color:#2E6E5E;color:#2E6E5E}
.icon-btn-danger:hover{border-color:#B4483C;color:#B4483C}
.arrow-btn{background:none;border:2px solid #E3DFD3;border-radius:8px;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#7A7466;transition:all .2s;flex-shrink:0}
.arrow-btn:hover:not(:disabled){border-color:#2E6E5E;color:#2E6E5E} .arrow-btn:disabled{opacity:.3;cursor:not-allowed}
.mes-btn{background:none;border:2px solid #E3DFD3;border-radius:10px;padding:8px 16px;cursor:pointer;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;color:#173C33;display:flex;align-items:center;gap:8px;transition:border .2s}
.mes-btn:hover{border-color:#2E6E5E}
.month-picker{position:absolute;top:110%;left:50%;transform:translateX(-50%);background:#fff;border-radius:16px;padding:20px;box-shadow:0 8px 32px #00000022;z-index:300;width:280px;animation:fadeIn .15s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.mc{border:none;border-radius:8px;padding:10px 4px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;color:#333;background:none;width:100%}
.mc:hover:not(.mc-dis){background:#F4F2ED} .mc-act{background:#173C33!important;color:#fff!important} .mc-dis{opacity:.3;cursor:not-allowed}
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#173C33;color:#fff;padding:12px 24px;border-radius:50px;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;z-index:500;white-space:nowrap;animation:toastIn .25s ease;pointer-events:none}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.metas-grid{display:grid;grid-template-columns:1fr;gap:0 12px}
.meta-form{display:grid;grid-template-columns:1fr;gap:18px}
@media (min-width:900px){.metas-grid{grid-template-columns:1fr 1fr}.meta-form{grid-template-columns:1.3fr 1fr;align-items:start}.meta-form>div:last-child{position:sticky;top:180px}}
::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#2E6E5E;border-radius:2px}`;

function Logo({size=48}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="limaGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F2DFA8"/>
          <stop offset="45%" stopColor="#D4AF6A"/>
          <stop offset="100%" stopColor="#A9803A"/>
        </linearGradient>
        <linearGradient id="limaNavy" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#0A1628"/>
          <stop offset="55%" stopColor="#0D2036"/>
          <stop offset="100%" stopColor="#0F3A4A"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#limaNavy)"/>
      <path d="M50 17.5 L75 50 L50 82.5 L25 50 Z" fill="none" stroke="url(#limaGold)" strokeWidth="1.3"/>
      <path d="M50 25 L68 50 L50 75 L32 50 Z" fill="none" stroke="url(#limaGold)" strokeWidth="0.6"/>
      <line x1="36" y1="50" x2="64" y2="50" stroke="url(#limaGold)" strokeWidth="1"/>
      <circle cx="36" cy="50" r="1.6" fill="url(#limaGold)"/>
      <circle cx="64" cy="50" r="1.6" fill="url(#limaGold)"/>
      <text x="50" y="46" textAnchor="middle" fontFamily="Georgia,serif" fontSize="13.5" fontWeight="700" fill="url(#limaGold)">L</text>
      <text x="50" y="61.5" textAnchor="middle" fontFamily="Georgia,serif" fontSize="13.5" fontWeight="700" fill="url(#limaGold)">P</text>
    </svg>
  );
}
function Bar({percent,color="#2E6E5E"}) {
  return (
    <div style={{background:"#E9E5D8",borderRadius:4,height:6,width:"100%",overflow:"hidden"}}>
      <div style={{width:`${Math.min(Math.max(percent,0),100)}%`,background:color,height:"100%",borderRadius:4}}/>
    </div>
  );
}
function Comparativo({atual,anterior,isParcial,inverterCores}) {
  if(!anterior) return null;
  const diff=((atual-anterior)/anterior)*100;
  const baixo=diff<0;
  const bom = inverterCores ? !baixo : baixo;
  const cor=bom?"#2E6E5E":"#B4483C";
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:bom?"#EAF3EF":"#FBECEA",border:`1px solid ${cor}30`,borderRadius:8,padding:"4px 10px",marginTop:8}}>
      <span style={{fontSize:14,color:cor,fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{baixo?"▼":"▲"} {Math.abs(diff).toFixed(1)}%</span>
      <span style={{fontSize:10,color:"#7A7466",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:700}}>{isParcial?"vs mesmo período ant.":"vs mês anterior"}</span>
    </div>
  );
}
function MonthPicker({mesAtual,onSelect,onClose}) {
  const [anoView,setAnoView]=useState(parseInt(mesAtual.slice(0,4)));
  const disp=MESES.map(m=>m.mes);
  const anosDisp=[...new Set(disp.map(k=>parseInt(k.slice(0,4))))];
  const podeAnt=anosDisp.includes(anoView-1);
  const podeProx=anosDisp.includes(anoView+1);
  const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return (
    <>
      <div style={{position:"fixed",inset:0,zIndex:299}} onClick={onClose}/>
      <div className="month-picker">
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:14}}>
          <button className="arrow-btn" style={{width:26,height:26}} disabled={!podeAnt} onClick={()=>setAnoView(a=>a-1)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{fontSize:15,fontFamily:"'Inter',sans-serif",fontWeight:800,color:"#173C33"}}>{anoView}</div>
          <button className="arrow-btn" style={{width:26,height:26}} disabled={!podeProx} onClick={()=>setAnoView(a=>a+1)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {MESES_ABREV.map((nome,i)=>{
            const key=`${anoView}-${padN(i+1)}`;
            const isAct=key===mesAtual;
            const isDis=!disp.includes(key);
            return <button key={key} className={`mc${isAct?" mc-act":""}${isDis?" mc-dis":""}`} disabled={isDis} onClick={()=>{if(!isDis){onSelect(key);onClose();}}}>{nome}</button>;
          })}
        </div>
      </div>
    </>
  );
}
const emptyForm=()=>({descricao:"",valorDigits:"",categoria:"",meio:"",data:hoje(),obs:"",recorrente:false,repeticoes:"",meta_id:""});
const emptyFormReceita=()=>({descricao:"",valorDigits:"",data:hoje(),obs:""});
const INP=err=>({background:"#FAF9F6",border:`2px solid ${err?"#B4483C":"#E3DFD3"}`,borderRadius:10,color:"#173C33",padding:"13px 14px",fontSize:15,fontFamily:"'Inter',sans-serif",width:"100%",transition:"border .2s"});
const FL={fontSize:11,color:"#7A7466",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:7,display:"block",fontWeight:700,fontFamily:"'Inter',sans-serif"};
function FormBody({form,setForm,erro,setErro,permiteRecorrencia,metasVinc=[]}) {
  const Err=({k})=>erro[k]?<div style={{fontSize:11,color:"#B4483C",marginTop:4,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{erro[k]}</div>:null;
  return (
    <>
      <div style={{marginBottom:16}}>
        <label style={FL}>Descrição *</label>
        <input style={INP(erro.descricao)} placeholder="Ex: Manutenção — Imóvel Centro" value={form.descricao}
          onChange={e=>{setForm(f=>({...f,descricao:e.target.value}));setErro(r=>({...r,descricao:null}));}}/>
        <Err k="descricao"/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={FL}>Valor *</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#7A7466",fontFamily:"'Inter',sans-serif",fontWeight:700}}>R$</span>
          <input style={{...INP(erro.valor),paddingLeft:40,fontSize:20,fontWeight:800}} placeholder="0,00"
            value={form.valorDigits?d2brl(form.valorDigits):""} inputMode="numeric"
            onChange={e=>{setForm(f=>({...f,valorDigits:e.target.value.replace(/\D/g,"")}));setErro(r=>({...r,valor:null}));}}/>
        </div>
        <Err k="valor"/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={FL}>Categoria *</label>
        <select style={INP(erro.categoria)} value={form.categoria}
          onChange={e=>{setForm(f=>({...f,categoria:e.target.value}));setErro(r=>({...r,categoria:null}));}}>
          <option value="">Selecione...</option>
          {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <Err k="categoria"/>
        {CATEGORIAS.length<=1 && <div style={{fontSize:11,color:"#A6822E",marginTop:6,fontFamily:"'Inter',sans-serif"}}>Nenhuma categoria cadastrada ainda — peça pro seu mentor cadastrar pelo Painel.</div>}
        {form.categoria==="Aplicado"&&(
          <div style={{background:"#EAF3EF",border:"1px solid #BFDCD1",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:11.5,color:"#235448",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>
            ℹ️ Aplicado é só controle — esse valor não soma no total de despesas nem no Caixa.
          </div>
        )}
      </div>
      {metasVinc.length>0&&(
        <div style={{marginBottom:16}}>
          <label style={FL}>Vincular a uma meta (opcional)</label>
          <select style={INP(false)} value={form.meta_id||""} onChange={e=>setForm(f=>({...f,meta_id:e.target.value}))}>
            <option value="">Sem vínculo</option>
            {metasVinc.map(m=><option key={m.id} value={m.id}>{(BENS[m.unidade]||BENS.outro).icone} {m.nome}</option>)}
          </select>
          {form.meta_id&&<div style={{background:"#EAF3EF",border:"1px solid #BFDCD1",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:11.5,color:"#235448",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>
            🏠 Esta despesa conta como parcela paga da meta{form.data>hoje()?" assim que for executada":""}. Continua somando normalmente nas despesas.
          </div>}
        </div>
      )}
      <div style={{marginBottom:16}}>
        <label style={FL}>Meio de Pagamento *</label>
        <select style={INP(erro.meio)} value={form.meio}
          onChange={e=>{setForm(f=>({...f,meio:e.target.value}));setErro(r=>({...r,meio:null}));}}>
          <option value="">Selecione...</option>
          {(!form.meio||MEIOS.includes(form.meio)?MEIOS:[...MEIOS,form.meio]).map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <Err k="meio"/>
        {form.meio==="Pluxe"&&(
          <div style={{background:"#FBF3E4",border:"1px solid #EAD9AE",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:11.5,color:"#8A6A1F",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>
            ℹ️ Pluxe é só controle — esse valor não soma no total de despesas nem no Caixa.
          </div>
        )}
      </div>
      <div style={{marginBottom:16}}>
        <label style={FL}>Data *</label>
        <input type="date" style={INP(erro.data)} value={form.data}
          onChange={e=>{setForm(f=>({...f,data:e.target.value}));setErro(r=>({...r,data:null}));}}/>
        <Err k="data"/>
        {form.data>hoje()&&(
          <div style={{background:"#FBECEA",border:"1px solid #EBBDB6",borderRadius:10,padding:"10px 12px",marginTop:8,fontSize:11.5,color:"#8A3A30",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>
            📅 Data futura — essa despesa fica "agendada" e só entra no total quando você usar Executar (a data chegar não executa sozinha).
          </div>
        )}
        {form.data<=hoje()&&(
          <label style={{display:"flex",alignItems:"center",gap:8,marginTop:8,fontSize:12,fontWeight:700,color:"#4A4A4A",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
            <input type="checkbox" checked={!!form.pagar} onChange={e=>setForm(f=>({...f,pagar:e.target.checked}))}/>
            Ainda não paguei (conta a pagar, executo manualmente)
          </label>
        )}
      </div>
      <div style={{marginBottom:8}}>
        <label style={FL}>Observação</label>
        <textarea style={{...INP(false),minHeight:72,resize:"none",fontSize:14}} placeholder="Detalhes, referência, etc."
          value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}/>
      </div>
      {permiteRecorrencia&&(
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderTop:"2px solid #F0EEE6",marginTop:8}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#173C33",fontFamily:"'Inter',sans-serif"}}>Despesa Recorrente</div>
              <div style={{fontSize:11,color:"#A39C8A",marginTop:2,fontFamily:"'Inter',sans-serif"}}>Repete automaticamente nos próximos meses</div>
            </div>
            <div style={{width:44,height:24,borderRadius:12,cursor:"pointer",background:form.recorrente?"#2E6E5E":"#ddd",display:"flex",alignItems:"center",padding:2,transition:"background .2s",flexShrink:0}}
              onClick={()=>{setForm(f=>({...f,recorrente:!f.recorrente}));setErro(r=>({...r,repeticoes:null}));}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px #0003",transition:"transform .2s",transform:form.recorrente?"translateX(20px)":"translateX(0)"}}/>
            </div>
          </div>
          {form.recorrente&&(
            <div style={{background:"#EAF3EF",border:"1.5px solid #BFDCD1",borderRadius:12,padding:16,marginTop:4}}>
              <label style={FL}>Repetir por quantos meses? *</label>
              <input type="number" inputMode="numeric" min="1" max="60" style={{...INP(erro.repeticoes),width:"50%"}} placeholder="Ex: 6"
                value={form.repeticoes}
                onChange={e=>{setForm(f=>({...f,repeticoes:e.target.value.replace(/\D/g,"").slice(0,2)}));setErro(r=>({...r,repeticoes:null}));}}/>
              <Err k="repeticoes"/>
              {parseInt(form.repeticoes)>=1&&form.data&&(
                <div style={{fontSize:11.5,color:"#235448",fontWeight:600,marginTop:10,fontFamily:"'Inter',sans-serif"}}>
                  🔁 Além deste, será lançado nos próximos {parseInt(form.repeticoes)} mês{parseInt(form.repeticoes)>1?"es":""} — último em {addMesesData(form.data,parseInt(form.repeticoes)).slice(5,7)}/{addMesesData(form.data,parseInt(form.repeticoes)).slice(0,4)}, sempre no dia {form.data.slice(8,10)} (ou no último dia do mês, se for menor).
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
function FormBodyReceita({form,setForm,erro,setErro}) {
  const Err=({k})=>erro[k]?<div style={{fontSize:11,color:"#B4483C",marginTop:4,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{erro[k]}</div>:null;
  return (
    <>
      <div style={{marginBottom:16}}>
        <label style={FL}>Descrição *</label>
        <input style={INP(erro.descricao)} placeholder="Ex: Aluguel recebido — Imóvel Centro" value={form.descricao}
          onChange={e=>{setForm(f=>({...f,descricao:e.target.value}));setErro(r=>({...r,descricao:null}));}}/>
        <Err k="descricao"/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={FL}>Valor Recebido *</label>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#7A7466",fontFamily:"'Inter',sans-serif",fontWeight:700}}>R$</span>
          <input style={{...INP(erro.valor),paddingLeft:40,fontSize:22,fontWeight:800,color:"#2E6E5E"}} placeholder="0,00"
            value={form.valorDigits?d2brl(form.valorDigits):""} inputMode="numeric"
            onChange={e=>{setForm(f=>({...f,valorDigits:e.target.value.replace(/\D/g,"")}));setErro(r=>({...r,valor:null}));}}/>
        </div>
        <Err k="valor"/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={FL}>Data *</label>
        <input type="date" style={INP(erro.data)} value={form.data}
          onChange={e=>{setForm(f=>({...f,data:e.target.value}));setErro(r=>({...r,data:null}));}}/>
        <Err k="data"/>
      </div>
      <div style={{marginBottom:8}}>
        <label style={FL}>Observação</label>
        <textarea style={{...INP(false),minHeight:64,resize:"none",fontSize:14}} placeholder="Opcional — origem, etc."
          value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}/>
      </div>
    </>
  );
}
// ─── RELATÓRIO (Dashboard + Relatório do Painel do Mentor, com visão por período) ──
const isRend = t => String(t.meio||"").startsWith("Rendimento");   // "Rendimento" (soma ao montante) ou "Rendimento incluso" (já está no montante)
const isInc  = t => t.meio === "Rendimento incluso";
const f2 = d => d.split("-").reverse().join("/");
const MES_AB = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PERIODOS = [["mes","Mês",1],["tri","Trimestre",3],["sem","Semestre",6],["ano","Ano",12]];
const mAdd = (key, n) => { const [y,m]=key.split("-").map(Number); const t=y*12+(m-1)+n; return `${Math.floor(t/12)}-${String(t%12+1).padStart(2,"0")}`; };
function rangeDe(tipo, mesKey) {
  const len = {mes:1,tri:3,sem:6,ano:12}[tipo];
  const [y,m] = mesKey.split("-").map(Number);
  const ini = `${y}-${String(Math.floor((m-1)/len)*len+1).padStart(2,"0")}`;
  return { ini, fim: mAdd(ini,len-1), len };
}
function labelPeriodo(tipo, ini, len) {
  const [y,m] = ini.split("-").map(Number);
  const ab = i => ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][(m-1+i)%12];
  if (tipo==="mes") return `${MESES_NOMES_FULL[m-1]} ${y}`;
  if (tipo==="tri") return `${Math.floor((m-1)/3)+1}º trimestre ${y} · ${ab(0)}–${ab(len-1)}`;
  if (tipo==="sem") return `${Math.floor((m-1)/6)+1}º semestre ${y} · ${ab(0)}–${ab(len-1)}`;
  return `Ano ${y}`;
}
async function fetchRange(ini, fim) {
  try {
    const [a,b] = await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/lancamentos?cliente_id=eq.${CID}&mes=gte.${ini}&mes=lte.${fim}&excluido=eq.false&order=data.desc`, { headers: H }),
      fetch(`${SUPA_URL}/rest/v1/receitas?cliente_id=eq.${CID}&mes=gte.${ini}&mes=lte.${fim}&order=semana.desc`, { headers: H }),
    ]);
    return { l: a.ok ? await a.json() : [], r: b.ok ? await b.json() : [], falhou: !a.ok || !b.ok };
  } catch { return { l: [], r: [], falhou: true }; }
}
const somaV = a => a.reduce((s,x)=>s+x.valor,0);
const agCat = list => { const m={}; list.forEach(l=>{m[l.categoria]=(m[l.categoria]||0)+l.valor;}); return Object.entries(m).map(([cat,val])=>({cat,val,cor:CAT_CORES[cat]||"#999"})).sort((a,b)=>b.val-a.val); };
function Relatorio({ mesKey, goPeriodo, aplicadoTodos }) {
  const [tipo,setTipo]   = useState("mes");
  const [dados,setDados] = useState(null);
  const [ab,setAb]       = useState({pan:false,dist:false,det:false});
  const [catAb,setCatAb] = useState({});
  const { ini, fim, len } = rangeDe(tipo, mesKey);
  useEffect(()=>{
    let ativo=true; setDados(null);
    Promise.all([fetchRange(ini,fim), fetchRange(mAdd(ini,-len), mAdd(ini,-1))])
      .then(([cur,prev])=>{ if(ativo) setDados({cur,prev}); });
    return ()=>{ ativo=false; };
  },[ini,fim,len]);

  const card={background:"#fff",borderRadius:14,padding:"4px 16px",boxShadow:"0 2px 8px #173C3310",marginBottom:12};
  const hj=hoje(), mesHoje=hj.slice(0,7);
  const primeiro = MESES[0].mes, ultimo = MESES[MESES.length-1].mes;
  const podeAnt = mAdd(ini,-1) >= primeiro, podeProx = mAdd(fim,1) <= ultimo;
  const navBtn = (dir,ok,txt)=>(
    <button onClick={()=>ok&&goPeriodo(dir*len)} disabled={!ok} style={{width:38,height:38,borderRadius:10,border:"2px solid #E3DFD3",background:"#fff",color:ok?"#173C33":"#CFCBBE",fontSize:18,cursor:ok?"pointer":"default",fontFamily:"'Inter',sans-serif"}}>{txt}</button>
  );
  const Sec = ({k,titulo,children}) => (
    <div style={{marginBottom:6}}>
      <div role="button" onClick={()=>setAb(a=>({...a,[k]:!a[k]}))} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",margin:"16px 0 10px",fontWeight:700,cursor:"pointer",userSelect:"none"}}>
        <span>{titulo}</span>
        <span style={{display:"inline-block",transform:ab[k]?"rotate(90deg)":"none",transition:"transform .15s",fontSize:9}}>▶</span>
      </div>
      {ab[k]&&children}
    </div>
  );
  const header = (
    <>
      <div style={{display:"flex",gap:4,background:"#fff",borderRadius:10,padding:4,boxShadow:"0 2px 8px #173C3310",marginBottom:12}}>
        {PERIODOS.map(([k,l])=>(
          <button key={k} onClick={()=>setTipo(k)} style={{flex:1,border:"none",borderRadius:8,padding:"9px 2px",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",background:tipo===k?"#173C33":"transparent",color:tipo===k?"#fff":"#A39C8A"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:14}}>
        {navBtn(-1,podeAnt,"‹")}
        <div style={{fontSize:16,fontWeight:800,color:"#173C33",fontFamily:"'Fraunces',serif",textAlign:"center"}}>{labelPeriodo(tipo,ini,len)}</div>
        {navBtn(1,podeProx,"›")}
      </div>
    </>
  );
  if (!dados) return <>{header}<div style={{...card,padding:24,textAlign:"center",color:"#A39C8A",fontSize:14,fontWeight:700}}>Carregando…</div></>;

  const contFn = l => l.meio!=="Pluxe" && l.categoria!=="Aplicado" && !agendada(l,hj);
  const lc = dados.cur.l.filter(contFn), lp = dados.prev.l.filter(contFn);
  const agend = dados.cur.l.filter(l=>l.meio!=="Pluxe"&&l.categoria!=="Aplicado"&&agendada(l,hj));
  const total=somaV(lc), totAnt=somaV(lp), temAnt=lp.length>0;
  const diff = totAnt>0 ? ((total-totAnt)/totAnt)*100 : null;
  const receita=somaV(dados.cur.r), saldo=receita-total;
  const apl = aplicadoTodos.filter(t=>t.mes>=ini&&t.mes<=fim);
  const aportes=somaV(apl.filter(t=>!isRend(t)))-somaV(apl.filter(isInc)), rend=somaV(apl.filter(isRend));
  const meses = Array.from({length:len},(_,i)=>mAdd(ini,i));
  const decorridos = Math.max(1, meses.filter(k=>k<=mesHoje).length);
  const linhas = meses.map(k=>{
    const d=somaV(lc.filter(l=>l.mes===k)), r=somaV(dados.cur.r.filter(x=>x.mes===k));
    const a=somaV(apl.filter(t=>t.mes===k&&!isRend(t)))-somaV(apl.filter(t=>t.mes===k&&isInc(t)));
    return {k,d,r,s:r-d,a};
  });
  const maxD = Math.max(1,...linhas.map(x=>x.d));
  const cats = agCat(lc);
  const prevMap = {}; agCat(lp).forEach(({cat,val})=>{prevMap[cat]=val;});
  const zeraram = Object.keys(prevMap).filter(k=>!cats.some(x=>x.cat===k)).sort((a,b)=>prevMap[b]-prevMap[a]).map(cat=>({cat,val:0,cor:CAT_CORES[cat]||"#999"}));
  const linhasCat=[...cats,...zeraram];
  const rotAnt = len===1?"mês anterior":"período anterior";
  const variacao=(cat,val)=>{
    if(!temAnt) return null;
    const ant=prevMap[cat]||0;
    if(ant===0) return val>0?{txt:`novo — sem lançamento no ${rotAnt}`,cor:"#A6822E"}:null;
    if(val===ant) return {txt:`= igual ao ${rotAnt}`,cor:"#A39C8A"};
    const d=((val-ant)/ant)*100, subiu=d>0;
    return {txt:`${subiu?"▲ +":"▼ "}${d.toFixed(1)}% vs ${rotAnt} · ant. ${fmt(ant)}`,cor:subiu?"#B4483C":"#2E6E5E"};
  };
  const pc=(a,b)=>b>0?((a/b)*100).toFixed(1):"0.0";
  const vazio = total===0 && receita===0 && aportes===0 && agend.length===0;
  const kpis = [
    {l:"Saldo (receita − despesa)",v:fmt(saldo),sub:saldo>=0?"positivo":"negativo",cor:saldo>=0?"#173C33":"#B4483C"},
    {l:`vs ${rotAnt}`,v:diff!=null?`${diff>0?"+":""}${diff.toFixed(1)}%`:"—",sub:diff!=null?(diff<0?"↓ reduziu":"↑ aumentou"):"sem comparativo",cor:diff!=null?(diff<0?"#2E6E5E":"#B4483C"):"#A39C8A"},
    {l:"Receita",v:fmt(receita),sub:`${dados.cur.r.length} entrada(s)`,cor:"#2E6E5E"},
    {l:"Despesa",v:fmt(total),sub:`${lc.length} lançamentos${len>1?` · média ${fmt(total/decorridos)}/mês`:""}`,cor:"#173C33"},
    {l:"Aplicado no período",v:fmt(aportes),sub:rend>0?`+ ${fmt(rend)} de rendimento`:"sem rendimento",cor:"#235448"},
    {l:"A executar (programado)",v:fmt(somaV(agend)),sub:`${agend.length} conta(s)`,cor:"#8A6A1F"},
  ];
  return (
    <>
      {header}
      {vazio
        ?<div style={{...card,padding:24,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📭</div><div style={{color:"#A39C8A",fontSize:14,fontWeight:700}}>Nenhum lançamento neste período.</div></div>
        :<>
          <div className="kpi-grid" style={{marginBottom:6}}>
            {kpis.map((k,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:14,padding:"14px",boxShadow:"0 2px 8px #173C3310"}}>
                <div style={{fontSize:9,color:"#A39C8A",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:700,marginBottom:5,lineHeight:1.3}}>{k.l}</div>
                <div style={{fontSize:k.v.length>12?14:16,fontWeight:800,color:k.cor,fontFamily:"'Fraunces',serif",lineHeight:1.1}}>{k.v}</div>
                <div style={{fontSize:10,color:"#A39C8A",marginTop:5,fontWeight:600,lineHeight:1.3}}>{k.sub}</div>
              </div>
            ))}
          </div>
          {len>1&&<Sec k="pan" titulo="Panorama mês a mês">
            <div style={{...card,padding:"8px 16px 12px"}}>
              {linhas.map((x,i)=>(
                <div key={x.k} style={{padding:"10px 0",borderBottom:i<linhas.length-1?"1px solid #F0EEE6":"none",opacity:x.k>mesHoje&&x.d===0&&x.r===0?0.45:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:x.k===mesKey?800:700,color:"#173C33"}}>{MESES_NOMES_FULL[parseInt(x.k.slice(5),10)-1]}{x.k===mesKey?" ·":""}{x.k===mesKey&&<span style={{fontSize:10,color:"#A39C8A",fontWeight:600}}> selecionado</span>}</span>
                    <span style={{fontSize:13,fontWeight:800,color:"#173C33"}}>{fmt(x.d)}</span>
                  </div>
                  <Bar percent={(x.d/maxD)*100} color={x.k===mesKey?"#2E6E5E":"#9DBFB4"}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,fontWeight:600}}>
                    <span style={{color:"#2E6E5E"}}>Receita {fmt(x.r)}</span>
                    <span style={{color:x.s>=0?"#173C33":"#B4483C"}}>Saldo {fmt(x.s)}</span>
                    <span style={{color:"#235448"}}>Aplic. {fmt(x.a)}</span>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"2px solid #E3DFD3",marginTop:2,fontSize:12,fontWeight:800,color:"#173C33"}}>
                <span>Total do período</span><span>{fmt(total)}</span>
              </div>
            </div>
          </Sec>}
          <Sec k="dist" titulo="Distribuição por categoria">
            <div style={{...card,padding:"18px 16px"}}>
              {total===0
                ?<div style={{textAlign:"center",color:"#A39C8A",fontSize:13,fontWeight:700}}>Sem despesas no período.</div>
                :<>
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10,marginBottom:12}}>
                      <div>
                        <div style={{fontSize:10,color:"#A39C8A",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Total do período</div>
                        <div style={{fontSize:26,fontWeight:800,color:"#173C33",lineHeight:1.1}}>{fmt(total)}</div>
                      </div>
                      <div style={{textAlign:"right",fontSize:11,color:"#A39C8A",fontWeight:700,lineHeight:1.5}}>
                        <div>{cats.length} categoria{cats.length===1?"":"s"}</div>
                        {cats[0]&&<div>Maior: <span style={{color:"#173C33"}}>{cats[0].cat} · {pc(cats[0].val,total)}%</span></div>}
                        {cats.length>=3&&<div>Top 3 = <span style={{color:"#173C33"}}>{pc(cats[0].val+cats[1].val+cats[2].val,total)}%</span></div>}
                      </div>
                    </div>
                    <div style={{display:"flex",height:14,borderRadius:7,overflow:"hidden",gap:2,background:"#F0EEE6"}}>
                      {cats.map(c=><div key={c.cat} title={`${c.cat}: ${fmt(c.val)}`} style={{flex:c.val,background:c.cor,minWidth:2}}/>)}
                    </div>
                  </div>
                  {linhasCat.map(({cat,val,cor},i)=>{
                    const v=variacao(cat,val);
                    return (
                      <div key={cat} style={{padding:"12px 0",borderTop:i?"1px solid #F0EEE6":"none",opacity:val===0?0.7:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:5}}>
                          <span style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:22,height:22,borderRadius:7,background:cor,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{val===0?"–":i+1}</span>
                            <span style={{fontSize:14,fontWeight:700,color:"#173C33",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</span>
                          </span>
                          <span style={{display:"flex",alignItems:"baseline",gap:8,flexShrink:0}}>
                            <span style={{fontSize:15,fontWeight:800,color:"#173C33"}}>{fmt(val)}</span>
                            <span style={{fontSize:11,fontWeight:800,color:cor,minWidth:44,textAlign:"right"}}>{pc(val,total)}%</span>
                          </span>
                        </div>
                        <div style={{background:"#F0EEE6",borderRadius:6,height:10,width:"100%",overflow:"hidden"}}><div style={{width:`${total>0?(val/total)*100:0}%`,background:cor,height:"100%",borderRadius:6}}/></div>
                        {v&&<div style={{fontSize:10,fontWeight:700,color:v.cor,marginTop:5}}>{v.txt}</div>}
                      </div>
                    );
                  })}
                </>}
            </div>
          </Sec>
          <Sec k="det" titulo="Detalhamento por categoria">
            {cats.length===0
              ?<div style={{...card,padding:20,textAlign:"center",color:"#A39C8A",fontSize:13,fontWeight:700}}>Sem lançamentos.</div>
              :cats.map(({cat,val,cor})=>{
                const itens=lc.filter(l=>l.categoria===cat).sort((a,b)=>b.data.localeCompare(a.data));
                const open=!!catAb[cat];
                return (
                  <div key={cat} style={{...card,padding:0,overflow:"hidden",marginBottom:8}}>
                    <div onClick={()=>setCatAb(p=>({...p,[cat]:!p[cat]}))} style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:4,alignSelf:"stretch",background:cor,borderRadius:2}}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:13,fontWeight:700,color:"#173C33"}}>{cat}</span>
                          <span style={{fontSize:13,fontWeight:800,color:"#173C33"}}>{fmt(val)}</span>
                        </div>
                        <Bar percent={total>0?(val/total)*100:0} color={cor}/>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"#A39C8A",fontWeight:600}}>
                          <span>{itens.length} item(ns)</span><span>{pc(val,total)}%</span>
                        </div>
                      </div>
                      <span style={{color:"#A39C8A",fontSize:12,transition:"transform .2s",transform:open?"rotate(180deg)":"none"}}>▾</span>
                    </div>
                    {open&&(
                      <div style={{borderTop:"1px solid #F0EEE6",background:"#FAF9F6"}}>
                        {itens.map((it,i)=>(
                          <div key={it.id} style={{padding:"10px 16px 10px 30px",borderBottom:i<itens.length-1?"1px solid #F0EEE6":"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                            <div style={{minWidth:0,flex:1}}>
                              <div style={{fontSize:12,fontWeight:600,color:"#173C33",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.descricao}</div>
                              <div style={{fontSize:10,color:"#A39C8A",marginTop:2}}>{fmtDate(it.data)} · {it.meio}</div>
                              {it.obs&&<div style={{fontSize:10,color:"#A39C8A",fontStyle:"italic",marginTop:1}}>{it.obs}</div>}
                            </div>
                            <div style={{fontSize:13,fontWeight:800,color:"#173C33",flexShrink:0}}>{fmt(it.valor)}</div>
                          </div>
                        ))}
                        <div style={{padding:"9px 16px 9px 30px",background:`${cor}14`,display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:11,fontWeight:800,color:"#173C33",letterSpacing:"0.06em",textTransform:"uppercase"}}>Subtotal</span>
                          <span style={{fontSize:13,fontWeight:800,color:"#173C33"}}>{fmt(val)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </Sec>
        </>}
    </>
  );
}

// ─── METAS E ALERTAS ────────────────────────────────────────────────────────
const addDias = (s, n) => { const [y,m,d]=s.split("-").map(Number); const x=new Date(y,m-1,d+n); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; };
const diasEntre = (a, b) => { const [y1,m1,d1]=a.split("-").map(Number), [y2,m2,d2]=b.split("-").map(Number); return Math.round((new Date(y2,m2-1,d2)-new Date(y1,m1-1,d1))/86400000); };
const dataRec = r => r.data_de || r.semana;
// Mesma regra do Caixa do Lima: conta tudo que não é Pluxe nem Aplicado (Liquidação de Fatura conta)
const despesaConta = l => !l.excluido && l.meio!=="Pluxe" && l.categoria!=="Aplicado";
const VIS = { fundo:"#EAF3EF", cor:"#2E6E5E", nome:"Lima Patrimonial" };
// Saldo registrado (receitas − despesas) num intervalo de datas
function saldoPeriodo(g, de, ate) {
  const dentro = d => d && (!de || d>=de) && d<=ate;
  const rec  = g.r.filter(r=>dentro(dataRec(r))).reduce((s,r)=>s+r.valor,0);
  const desp = g.l.filter(l=>despesaConta(l)&&dentro(l.data)).reduce((s,l)=>s+l.valor,0);
  return rec - desp;
}
// Montante aplicado hoje (mesma conta da aba Aplicado: aportes + rendimento; "Rendimento incluso" já está dentro)
const montanteAplicado = g => (g.ap||[]).filter(t=>!isInc(t)).reduce((s,t)=>s+t.valor,0);
const GRUPOS_META = {
  financeira: { nome:"Financeira", icone:"💰", desc:"Valores em R$: receita, sobra, patrimônio aplicado, limite de gasto ou um valor livre." },
  objetiva:   { nome:"Objetiva",   icone:"🎯", desc:"Conquistas e hábitos: contar, cumprir etapas, marcar os dias no calendário." },
};
const TIPOS_META = {
  faturamento: { grupo:"financeira", nome:"Receita mensal",     icone:"📈", desc:"Receita recebida no mês até chegar no alvo. Renova todo mês.", auto:true, mensal:true },
  acumular:    { grupo:"financeira", nome:"Sobra de caixa",     icone:"🏦", desc:"Soma o que sobra (receita − despesa) desde a data de início.", auto:true },
  aplicado:    { grupo:"financeira", nome:"Patrimônio aplicado",icone:"🌱", desc:"Acompanha o montante da aba Aplicado até chegar no alvo.", auto:true },
  patrimonio:  { grupo:"financeira", nome:"Quitar patrimônio", icone:"🏠", desc:"Quitar um veículo ou imóvel parcelado. Cada despesa vinculada à meta conta como parcela paga.", auto:true },
  limite:      { grupo:"financeira", nome:"Limite de gasto",    icone:"🛡️", desc:"Gastar no máximo o limite no mês (total ou de uma categoria). Renova todo mês.", auto:true, mensal:true },
  valor:       { grupo:"financeira", nome:"Valor livre",        icone:"💵", desc:"Você informa quanto já tem (ex.: juntar para a reforma).", auto:false },
  objetiva:    { grupo:"objetiva",   nome:"Objetiva",           icone:"🎯", desc:"", auto:false },
};
const BENS = { veiculo:{nome:"Veículo",icone:"🚗"}, imovel:{nome:"Imóvel",icone:"🏠"}, outro:{nome:"Outro bem",icone:"🏷️"} };
// Conta a pagar = programada e ainda não executada
const pendConta = (l, hj) => despesaConta(l) && (l.programado===true || (l.programado==null && l.data>hj));
const MIGRADOS = new Set();
// Despesa fica "agendada" até ser executada MANUALMENTE: a data chegar não executa sozinha.
const agendada = (l, hj) => l.data>hj || l.programado===true;
// Medidores da meta objetiva — dá para usar mais de um na mesma meta
const MEDIDORES = {
  quantidade: { nome:"Quantidade", icone:"🔢", desc:"Contar até um número (ex.: 100 assinantes)." },
  etapas:     { nome:"Etapas",     icone:"✅", desc:"Checklist: cada etapa concluída avança." },
  calendario: { nome:"Calendário", icone:"📅", desc:"Marcar no calendário cada dia cumprido (ex.: postar todo dia)." },
};
const tipoMeta = t => (t==="quantidade"||t==="etapas"||t==="objetiva") ? "objetiva" : t==="manual" ? "valor" : (TIPOS_META[t] ? t : "valor");
const lerJson = (v, padrao) => { let e=v; if(typeof e==="string"){ try{ e=JSON.parse(e); }catch{ e=padrao; } } return e ?? padrao; };
const lerEtapas = m => { const e=lerJson(m.etapas, []); return Array.isArray(e)?e:[]; };
const lerCheckins = m => { const e=lerJson(m.checkins, []); return Array.isArray(e)?[...new Set(e)].sort():[]; };
const medidoresDe = m => { const md=lerJson(m.medidores, null); if(Array.isArray(md)&&md.length) return md.filter(k=>MEDIDORES[k]); return (m.tipo==="quantidade"||m.tipo==="etapas") ? [m.tipo] : []; };
// Quantidade por período: acumulado (total) ou renovada todo dia / semana / mês
const QTD_PER = { total:"Acumulado", dia:"Por dia", semana:"Por semana", mes:"Por mês" };
const qtdPer = m => QTD_PER[m.qtd_per] ? m.qtd_per : "total";
const lerLog = m => { const e=lerJson(m.qtd_log, {}); return e && typeof e==="object" && !Array.isArray(e) ? e : {}; };
const iniPeriodo = (per, d) => { if(per==="mes") return d.slice(0,7)+"-01"; if(per==="semana"){ const [y,mo,dd]=d.split("-").map(Number); const w=new Date(y,mo-1,dd).getDay(); return addDias(d, -((w+6)%7)); } return d; };
const qiVazio = { nome:"", alvo:"", atual:"", unidade:"", per:"total", fonte:"" };
// Uma meta pode ter várias atividades com quantidade (ex.: 100 flexões por dia + 2 copos de água por dia)
const qtdItens = m => {
  const a = lerJson(m.qtd_itens, []);
  if (Array.isArray(a) && a.length) return a.filter(x=>x&&typeof x==="object");
  const alvo = Number(m.valor_alvo)||0;
  return alvo>0 && medidoresDe(m).includes("quantidade") ? [{ id:"legacy", nome:"", alvo, atual:Number(m.valor_atual)||0, unidade:m.unidade||"", per:qtdPer(m), log:lerLog(m) }] : [];
};
// Quantas parcelas já venceram (antes de hoje) para um financiamento que começou em `ini`
const decorridas = (ini, np) => { if(!ini||!(np>0)) return 0; let n=0; for(let i=0;i<np;i++) if(addMesesData(ini,i)<hoje()) n++; return n; };
const itensDoForm = f => { const q=f.qi, rasc = parseInt(q.alvo)>0 ? [{ id:"rasc", nome:q.nome.trim(), alvo:parseInt(q.alvo), atual:q.per==="total"?(parseInt(q.atual)||0):0, unidade:q.unidade.trim(), per:q.per, fonte:q.per==="total"?q.fonte:"", log:{} }] : []; return [...f.qtdItens, ...rasc]; };
function progItemQtd(it, todos=[]) {
  const per = QTD_PER[it.per] ? it.per : "total", alvo = Number(it.alvo)||0, hj = hoje();
  const n = v => Math.round(v).toLocaleString("pt-BR"), un = it.unidade ? " "+it.unidade : "";
  let atual, rot="", extra="";
  let auto = false;
  const src = per==="total" && it.fonte ? todos.find(x=>x.id===it.fonte) : null;
  if (per==="total" && src) {   // soma automática: tudo que foi marcado na atividade de origem (ex.: flexões por dia)
    auto = true;
    atual = (Number(it.atual)||0) + Object.values(src.log||{}).reduce((s,v)=>s+(Number(v)||0),0);
    extra = `🔗 soma automática de ${src.nome||"outra atividade"}`;
  }
  else if (per==="total") atual = Number(it.atual)||0;
  else {
    const log = it.log && typeof it.log==="object" ? it.log : {}, ini = iniPeriodo(per,hj);
    atual = Object.entries(log).filter(([d])=>d>=ini&&d<=hj).reduce((s,[,v])=>s+(Number(v)||0),0);
    const grupos = {}; Object.entries(log).forEach(([d,v])=>{ const c=iniPeriodo(per,d); grupos[c]=(grupos[c]||0)+(Number(v)||0); });
    const bat = Object.values(grupos).filter(v=>alvo>0&&v>=alvo).length, u = {dia:["dia","dias"],semana:["semana","semanas"],mes:["mês","meses"]}[per];
    rot = {dia:"hoje",semana:"nesta semana",mes:"neste mês"}[per];
    extra = `${QTD_PER[per]} · ${bat} ${bat===1?u[0]:u[1]} com a meta batida`;
  }
  return { id:it.id, nome:it.nome||"", per, auto, recorr:per!=="total", atual, alvo, pct: alvo>0?atual/alvo:0,
    txt:`${n(atual)} de ${n(alvo)}${un}${rot?" "+rot:""}`, falta: alvo>atual?`${it.nome?it.nome+": ":""}faltam ${n(alvo-atual)}${un}${rot?" "+rot:""}`:"", extra };
}
const fmtQtd = (m, v) => `${Math.round(v).toLocaleString("pt-BR")}${m.unidade?" "+m.unidade:""}`;
const fmtMeta = (m, v) => tipoMeta(m.tipo)==="objetiva" ? `${Math.round(v)}%` : fmt(v);
const fracMes = () => { const h=hoje(), [y,m,d]=h.split("-").map(Number); return d/new Date(y,m,0).getDate(); };
// Calendário: quantos dias marcados são necessários entre o início e o prazo
function alvoCalendario(m) {
  const ini = m.data_inicio || (m.criado_em||"").slice(0,10) || hoje();
  if (!m.prazo || m.prazo<ini) return 0;
  const dias = diasEntre(ini, m.prazo) + 1;
  if (m.cal_freq==="periodo") return Math.min(dias, Math.max(1, Number(m.cal_vezes)||1));
  return m.cal_freq==="semana" ? Math.max(1, Math.ceil(dias/7*(Number(m.cal_vezes)||1))) : dias;
}
// Sequência de dias seguidos marcados, contando de hoje (ou de ontem, se hoje ainda não foi marcado)
function sequencia(lista) {
  const s=new Set(lista); let d=hoje(); if(!s.has(d)) d=addDias(d,-1);
  let n=0; while(s.has(d)){ n++; d=addDias(d,-1); } return n;
}
// Progresso de cada medidor da meta objetiva
function progMedidores(m) {
  return medidoresDe(m).map(k=>{
    if (k==="quantidade") {
      const arr = qtdItens(m), its = arr.map(it=>progItemQtd(it,arr)), pct = its.length ? its.reduce((s,x)=>s+Math.min(1,x.pct),0)/its.length : 0, bat = its.filter(x=>x.pct>=1).length;
      return { k, itens:its, recorr:its.some(x=>x.recorr), atual:bat, alvo:its.length, pct,
        txt: its.length===1 ? `${its[0].nome?its[0].nome+": ":""}${its[0].txt}` : `${its.length} atividades · ${bat} no alvo`,
        falta: its.map(x=>x.falta).filter(Boolean).join(" · ") };
    }
    if (k==="etapas") { const e=lerEtapas(m), alvo=e.length, atual=e.filter(x=>x.ok).length;
      return { k, atual, alvo, pct: alvo>0?atual/alvo:0, txt:`${atual} de ${alvo} etapas`, falta: alvo>atual?`falta${alvo-atual>1?"m":""} ${alvo-atual} etapa${alvo-atual>1?"s":""}`:"" }; }
    const ini = m.data_inicio || (m.criado_em||"").slice(0,10) || hoje();
    const ck = lerCheckins(m).filter(d=>d>=ini && (!m.prazo||d<=m.prazo)), alvo=alvoCalendario(m), atual=ck.length;
    return { k, atual, alvo, pct: alvo>0?atual/alvo:0, txt:`${atual} de ${alvo} dias marcados`, falta: alvo>atual?`faltam ${alvo-atual} dias${m.cal_freq==="periodo"&&m.prazo&&m.prazo>=hoje()?` · restam ${diasEntre(hoje(),m.prazo)+1} no prazo`:""}`:"", seq: sequencia(ck), hojeOk: ck.includes(hoje()) };
  });
}
function progMeta(mt, g) {
  const hj=hoje(), mh=hj.slice(0,7), tipo=tipoMeta(mt.tipo), T=TIPOS_META[tipo];
  const [yy,mm]=mh.split("-").map(Number), fimMes=`${mh}-${String(new Date(yy,mm,0).getDate()).padStart(2,"0")}`;
  let alvo=Number(mt.valor_alvo)||0, atual=0, detalhe="", meds=null, patr=null;
  if (tipo==="faturamento") {
    atual = g.r.filter(r=>(dataRec(r)||"").slice(0,7)===mh).reduce((s,r)=>s+r.valor,0);
    detalhe = "recebido neste mês";
  } else if (tipo==="acumular") {
    atual = (Number(mt.valor_inicial)||0) + saldoPeriodo(g, mt.data_inicio||null, hj);
    detalhe = `sobra de caixa desde ${mt.data_inicio?fmtDate(mt.data_inicio):"o início"}`;
  } else if (tipo==="aplicado") {
    atual = montanteAplicado(g);
    detalhe = "montante aplicado hoje";
  } else if (tipo==="patrimonio") {
    const np = Number(mt.parcelas)||0, ent = Number(mt.valor_inicial)||0, antes = Math.min(np, Math.max(0, Number(mt.parc_pagas)||0));
    const parcEst = np>0 ? Math.max(0, alvo-ent)/np : 0;
    const pg = g.l.filter(l=>l.meta_id===mt.id && despesaConta(l) && !agendada(l,hj));
    atual = ent + antes*parcEst + pg.reduce((s,l)=>s+l.valor,0);
    const pagasTot = Math.min(np||Infinity, antes + pg.length);
    let esperado = 0;
    if (np>0 && mt.data_inicio) for (let i=0;i<np;i++) if (addMesesData(mt.data_inicio,i)<=hj) esperado++;
    patr = { np, pagas:pagasTot, restam:Math.max(0,np-pagasTot), esperado, ent, antes };
    detalhe = `${pagasTot}${np?` de ${np}`:""} parcela${pagasTot===1?"":"s"} paga${pagasTot===1?"":"s"}${ent>0?` · entrada ${fmt(ent)}`:""}`;
  } else if (tipo==="limite") {
    atual = g.l.filter(l=>despesaConta(l)&&l.mes===mh&&!agendada(l,hj)&&(!mt.categoria||l.categoria===mt.categoria)).reduce((s,l)=>s+l.valor,0);
    detalhe = mt.categoria ? `gasto em ${mt.categoria} neste mês` : "despesa total deste mês";
  } else if (tipo==="objetiva") {
    meds = progMedidores(mt);
    const media = meds.length ? meds.reduce((s,x)=>s+Math.min(1,x.pct),0)/meds.length : 0;
    atual = Math.round(media*100); alvo = 100;
    detalhe = meds.map(x=>x.txt).join(" · ");
  } else {
    atual = Number(mt.valor_atual)||0; detalhe = "atualizado por você";
  }
  const pct = alvo>0 ? atual/alvo : 0;
  const fim = T.mensal ? fimMes : (mt.prazo||null);
  const diasRest = fim ? diasEntre(hj, fim) : null;
  const falta = Math.max(0, alvo-atual), diasCont = Math.max(1, (diasRest??0)+1);
  let dica = "";
  if (tipo==="faturamento") dica = falta>0 ? `Faltam ${fmt(falta)} · ${fmt(falta/diasCont)} por dia até o fim do mês` : "Alvo do mês batido!";
  else if (tipo==="limite") dica = atual<=alvo ? `Pode gastar ${fmt((alvo-atual)/diasCont)} por dia até o fim do mês` : `${fmt(atual-alvo)} acima do limite`;
  else if (tipo==="patrimonio") dica = falta>0 && patr.restam>0 ? `Faltam ${fmt(falta)} · ${patr.restam} parcela${patr.restam>1?"s":""} de cerca de ${fmt(falta/patr.restam)}` : falta>0 ? `Faltam ${fmt(falta)}` : "Patrimônio quitado! 🎉";
  else if (falta>0 && (tipo==="acumular"||tipo==="aplicado"||tipo==="valor")) dica = diasRest>0 ? `Faltam ${fmt(falta)} · cerca de ${fmt(falta/Math.max(1,diasRest/30))} por mês` : `Faltam ${fmt(falta)}`;
  else if (tipo==="objetiva" && meds) { const f=meds.map(x=>x.falta).filter(Boolean); dica = f.length ? f.join(" · ").replace(/^./,x=>x.toUpperCase()) : ""; }
  const realizada = !!mt.concluida_em || ((tipo==="acumular"||tipo==="aplicado"||tipo==="patrimonio") && alvo>0 && pct>=1) || (tipo==="patrimonio" && patr.np>0 && patr.pagas>=patr.np);
  const OK={cor:"#2E6E5E",fundo:"#EAF3EF",nivel:0}, AT={cor:"#A6822E",fundo:"#FBF3E4",nivel:1}, CR={cor:"#B4483C",fundo:"#FBECEA",nivel:2};
  let status;
  if (realizada) status = {...OK, txt:"realizada"};
  else if (tipo==="limite") status = pct>1 ? {...CR,txt:"estourou"} : pct>fracMes()+0.1 ? {...AT,txt:"gastando rápido"} : {...OK,txt:"dentro do limite"};
  else if (tipo==="faturamento" && pct>=1) status = {...OK, txt:"batida no mês"};
  else if (pct>=1) status = {...OK, txt: meds&&meds.some(x=>x.recorr) ? "meta do período batida" : "alvo atingido"};
  else if (tipo==="patrimonio" && patr.esperado-patr.pagas>=1) { const at=patr.esperado-patr.pagas; status = at>=2 ? {...CR,txt:`${at} parcelas em aberto`} : {...AT,txt:"1 parcela em aberto"}; }
  else if (tipo==="patrimonio") status = {...OK, txt:"em dia"};
  else if (diasRest!=null && diasRest<0) status = {...CR, txt:"atrasada"};
  else {
    let esperado = null;
    const ini = mt.data_inicio || (mt.criado_em||"").slice(0,10);
    if (tipo==="faturamento") esperado = fracMes();
    else if (meds&&meds.some(x=>x.recorr)) esperado = null;
    else if (mt.prazo && ini && mt.prazo>ini) esperado = Math.min(1, Math.max(0, diasEntre(ini,hj)/diasEntre(ini,mt.prazo)));
    status = esperado!=null && pct < esperado-0.15 ? {...AT,txt:"abaixo do ritmo"} : {...OK,txt:"no ritmo"};
  }
  return { tipo, atual, alvo, pct, status, detalhe, dica, diasRest, mensal:!!T.mensal, realizada, meds, patr, recorr: !!(meds&&meds.some(x=>x.recorr)) };
}
// Central de alertas
function gerarAlertas(g, metas) {
  const hj=hoje(), mh=hj.slice(0,7), out=[];
  // Conta a pagar = lançamento programado que ainda não foi movido para executado.
  // Ao executar (ou editar para uma data passada, ou excluir), ela sai dos alertas sozinha.
  const pend = l => pendConta(l,hj);
  const soma = a => a.reduce((s,l)=>s+l.valor,0);
  const lista = (a,n,f) => a.slice(0,n).map(f).join(", ")+(a.length>n?"…":"");
  const plural = (n,s,p) => n>1?p:s;
  // 0) Atrasadas (venceram e não foram executadas)
  const atras = g.l.filter(l=>pend(l)&&l.data<hj).sort((a,b)=>a.data.localeCompare(b.data));
  if (atras.length) out.push({ nivel:2, key:"atr:"+atras.map(l=>l.id).join(","), ids:atras.map(l=>l.id), titulo:`${atras.length} ${plural(atras.length,"conta atrasada","contas atrasadas")}`,
    motivo: lista(atras,4,l=>`${l.descricao} (${fmtDate(l.data)})`), impacto:`${fmt(soma(atras))} vencido e ainda não executado`,
    acao:"Pague e use “Executar” no Histórico. Se já pagou, use Executar para sair daqui." });
  // 1) Vencem hoje
  const hojeL = g.l.filter(l=>pend(l)&&l.data===hj);
  if (hojeL.length) out.push({ nivel:2, key:"hoje:"+hojeL.map(l=>l.id).join(","), ids:hojeL.map(l=>l.id), hoje:true, qtd:hojeL.length, titulo:`${hojeL.length} ${plural(hojeL.length,"conta","contas")} para pagar hoje`,
    motivo: lista(hojeL,4,l=>`${l.descricao} (${fmt(l.valor)})`), total: soma(hojeL), impacto:`${fmt(soma(hojeL))} vencendo hoje`,
    acao:"Pague hoje e use Executar — o alerta some sozinho." });
  // 2) Próximos 3 dias
  const vence = g.l.filter(l=>pend(l)&&l.data>hj&&l.data<=addDias(hj,3)).sort((a,b)=>a.data.localeCompare(b.data));
  if (vence.length) out.push({ nivel:1, key:"venc:"+vence.map(l=>l.id).join(","), ids:vence.map(l=>l.id), titulo:`${vence.length} ${plural(vence.length,"conta vencendo","contas vencendo")} nos próximos 3 dias`,
    motivo: lista(vence,3,l=>`${l.descricao} (${fmtDate(l.data)})`),
    impacto:`${fmt(soma(vence))} saindo do caixa`, acao:"Confira se há saldo e execute no dia certo." });
  // 2b) Programado para o resto do mês: caixa cobre?
  const resto = g.l.filter(l=>pend(l)&&l.mes===mh&&l.data>hj).reduce((s,l)=>s+l.valor,0);
  const saldoHoje = g.r.filter(r=>(dataRec(r)||"").slice(0,7)===mh&&dataRec(r)<=hj).reduce((s,r)=>s+r.valor,0)
                  - g.l.filter(l=>despesaConta(l)&&l.mes===mh&&l.data<=hj&&!pend(l)).reduce((s,l)=>s+l.valor,0);
  if (resto>0 && saldoHoje-resto<0) out.push({ nivel:2, key:"saldoprog:"+mh, titulo:"Contas programadas passam do saldo do mês",
    motivo:`Saldo atual ${fmt(saldoHoje)} e ${fmt(resto)} ainda programados até o fim do mês.`, impacto:`Faltam ${fmt(resto-saldoHoje)} para cobrir.`,
    acao:"Reveja os gastos programados ou antecipe uma receita." });
  // 2) Despesa do mês já passou da receita
  const recMes = g.r.filter(r=>(dataRec(r)||"").slice(0,7)===mh).reduce((s,r)=>s+r.valor,0);
  const despMes = g.l.filter(l=>despesaConta(l)&&l.mes===mh&&l.data<=hj&&!pend(l)).reduce((s,l)=>s+l.valor,0);
  if (recMes>0 && despMes>recMes) out.push({ nivel:2, key:"despmes:"+mh, titulo:"Despesa do mês passou da receita",
    motivo:`Despesas ${fmt(despMes)} contra receitas ${fmt(recMes)} neste mês.`, impacto:`Saldo do mês em ${fmt(recMes-despMes)}.`,
    acao:"Segure gastos não essenciais até o próximo recebimento." });
  // 3) Gasto acima do mesmo período do mês anterior (a partir do dia 7)
  const dia = parseInt(hj.slice(8,10),10);
  if (dia>=7) {
    const ma = mAdd(mh,-1);
    const ate = (l,mk)=> l.mes===mk && parseInt(l.data.slice(8,10),10)<=dia && l.data<=hj || (l.mes===mk && mk<mh && parseInt(l.data.slice(8,10),10)<=dia);
    const atual = g.l.filter(l=>despesaConta(l)&&!pend(l)&&ate(l,mh)).reduce((s,l)=>s+l.valor,0);
    const ant   = g.l.filter(l=>despesaConta(l)&&ate(l,ma)).reduce((s,l)=>s+l.valor,0);
    if (ant>0 && atual>ant*1.2) out.push({ nivel: atual>ant*1.5?2:1, key:"comp:"+mh, titulo:`Gasto ${(((atual-ant)/ant)*100).toFixed(0)}% acima do mês passado`,
      motivo:`Até o dia ${dia}: ${fmt(atual)} agora contra ${fmt(ant)} no mês anterior.`, impacto:`Diferença de ${fmt(atual-ant)} a mais.`,
      acao:"Veja em Categorias onde o gasto subiu." });
  }
  // 4) Metas atrasadas ou fora do ritmo
  metas.filter(m=>!m.excluido).forEach(m=>{
    const p = progMeta(m, g);
    if (p.status.nivel>0) out.push({ nivel:p.status.nivel, key:"meta:"+m.id+":"+p.status.txt, titulo:`Meta "${m.nome}": ${p.status.txt}`,
      motivo:`${fmtMeta(m,p.atual)} de ${fmtMeta(m,p.alvo)} (${(p.pct*100).toFixed(0)}%) — ${p.detalhe}.`,
      impacto: m.tipo==="limite"?"Despesa acima do planejado.":"Objetivo pode não ser atingido no prazo.",
      acao: m.tipo==="limite"?"Reduza os gastos ligados a essa meta.":m.tipo==="patrimonio"?"Pague a parcela e vincule a despesa a esta meta ao lançar.":"Reveja o plano ou ajuste o prazo da meta." });
  });
  return out.sort((a,b)=>b.nivel-a.nivel);
}
function Modal({onClose, children}) {
  return (
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="sheet"><div className="handle"/>{children}</div>
    </div>
  );
}
const ErrTxt = ({msg}) => msg ? <div style={{fontSize:11,color:"#B4483C",marginTop:4,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{msg}</div> : null;
function CampoValor({label, digits, onChange, err, cor="#173C33"}) {
  return (
    <div style={{marginBottom:16}}>
      <label style={FL}>{label}</label>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#7A7466",fontWeight:700}}>R$</span>
        <input style={{...INP(err),paddingLeft:40,fontSize:20,fontWeight:800,color:cor}} placeholder="0,00" inputMode="numeric"
          value={digits?d2brl(digits):""} onChange={e=>onChange(e.target.value.replace(/\D/g,""))}/>
      </div>
      <ErrTxt msg={err}/>
    </div>
  );
}
function Chips({opcoes, valor, onChange}) {
  return (
    <div style={{display:"flex",gap:4,background:"#EDEAE0",borderRadius:10,padding:4,marginBottom:16,flexWrap:"wrap"}}>
      {opcoes.map(([k,l,cor])=>(
        <button key={k} type="button" onClick={()=>onChange(k)}
          style={{flex:"1 1 0",minWidth:70,border:"none",borderRadius:8,padding:"9px 6px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:12.5,fontWeight:700,background:valor===k?(cor||"#173C33"):"transparent",color:valor===k?"#fff":"#666"}}>{l}</button>
      ))}
    </div>
  );
}
function Anel({pct, cor, size=88, centro}) {
  const r=36, circ=2*Math.PI*r, p=Math.max(0,Math.min(pct,1));
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="#F0EEE6" strokeWidth="9"/>
        <circle cx="45" cy="45" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${p*circ} ${circ}`} style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%",transition:"stroke-dasharray .6s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        {centro || <><div style={{fontSize:19,fontWeight:800,color:"#173C33",lineHeight:1}}>{Math.round(pct*100)}%</div></>}
      </div>
    </div>
  );
}
const MARCOS = [[0.25,"🥉","25%"],[0.5,"🥈","50%"],[0.75,"🥇","75%"],[1,"🏆","100%"]];
function Medalhas({pct}) {
  return (
    <div style={{display:"flex",gap:6}}>
      {MARCOS.map(([v,ic,l])=>{ const on=pct>=v; return (
        <div key={l} title={l} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 2px",borderRadius:10,background:on?"#FBF3E4":"#F4F2ED",border:`1px solid ${on?"#EAD9AE":"#F0EEE6"}`}}>
          <span style={{fontSize:18,filter:on?"none":"grayscale(1)",opacity:on?1:0.35}}>{ic}</span>
          <span style={{fontSize:9.5,fontWeight:800,color:on?"#8A6A1F":"#BBBBBB"}}>{l}</span>
        </div>
      );})}
    </div>
  );
}
function Prazo({p, m}) {
  let txt, cor="#7A7466", fundo="#EDEAE0";
  if (p.mensal) { txt = p.diasRest===0 ? "renova amanhã" : `renova em ${p.diasRest+1} dias`; }
  else if (p.diasRest==null) txt = "sem prazo";
  else if (p.diasRest<0) { txt = `atrasada há ${-p.diasRest} dia${p.diasRest===-1?"":"s"}`; cor="#B4483C"; fundo="#FBECEA"; }
  else if (p.diasRest===0) { txt = "vence hoje"; cor="#B4483C"; fundo="#FBECEA"; }
  else { txt = `faltam ${p.diasRest} dia${p.diasRest===1?"":"s"}`; if (p.diasRest<=7) { cor="#8A6A1F"; fundo="#FBF3E4"; } }
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:fundo,color:cor,borderRadius:20,padding:"3px 9px",fontSize:10.5,fontWeight:800,whiteSpace:"nowrap"}}>⏳ {txt}{!p.mensal&&m.prazo?` · ${f2(m.prazo)}`:""}</span>;
}
function MiniCalendario({m, onDia}) {
  const hj=hoje(), ini=m.data_inicio||(m.criado_em||"").slice(0,10)||hj, fimMeta=m.prazo||hj;
  const marcados = new Set(lerCheckins(m));
  const modoMes = false;   // só a semana (sem o mapa do mês inteiro)
  const clamp = d => d<ini?ini:d>fimMeta?fimMeta:d;
  const [ref,setRef] = useState(clamp(hj));            // um dia da semana exibida
  const mesV = ref.slice(0,7);
  const [y,mo] = mesV.split("-").map(Number), nDias=new Date(y,mo,0).getDate(), pad=new Date(y,mo-1,1).getDay();
  const dow = new Date(...ref.split("-").map((v,i)=>i===1?v-1:+v)).getDay(), semIni = addDias(ref,-dow);
  const podeAnt = modoMes ? mAdd(mesV,-1)>=ini.slice(0,7) : addDias(semIni,-1)>=ini;
  const podeProx = modoMes ? mAdd(mesV,1)<=fimMeta.slice(0,7) : addDias(semIni,7)<=fimMeta;
  const ir = dir => setRef(r => modoMes ? clamp(`${mAdd(r.slice(0,7),dir)}-01`<ini?ini:`${mAdd(r.slice(0,7),dir)}-01`) : addDias(r,7*dir));
  const cel = modoMes
    ? [...Array(pad).fill(null), ...Array.from({length:nDias},(_,i)=>`${mesV}-${String(i+1).padStart(2,"0")}`)]
    : Array.from({length:7},(_,i)=>addDias(semIni,i));
  const rotulo = modoMes ? `${MESES_NOMES_FULL[mo-1]} ${y}` : `${fmtDate(cel[0])} – ${fmtDate(cel[6])}`;
  const nb = (ok,dir,txt)=><button onClick={()=>ok&&ir(dir)} disabled={!ok} style={{background:"none",border:"none",fontSize:16,color:ok?"#173C33":"#DDD",cursor:ok?"pointer":"default",padding:"0 8px"}}>{txt}</button>;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        {nb(podeAnt,-1,"‹")}<span style={{fontSize:12,fontWeight:800,color:"#173C33"}}>{rotulo}</span>{nb(podeProx,1,"›")}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:3}}>
        {["D","S","T","Q","Q","S","S"].map((d,i)=><div key={i} style={{fontSize:9,fontWeight:800,color:"#A39C8A",textAlign:"center"}}>{d}</div>)}
        {cel.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dentro = d>=ini && d<=fimMeta, passado = d<=hj, ok = marcados.has(d), clicavel = dentro && passado && !!onDia;
          return (
            <button key={i} onClick={()=>clicavel&&onDia(m,d)} disabled={!clicavel}
              style={{aspectRatio:modoMes?"1":"auto",height:modoMes?"auto":34,borderRadius:8,border:d===hj?"2px solid #173C33":"1px solid "+(ok?"#2E6E5E":"#F0EEE6"),
                background:ok?"#2E6E5E":dentro?(passado?"#FAF9F6":"#fff"):"#F4F2ED",color:ok?"#fff":dentro?"#173C33":"#CCCCCC",
                fontSize:11,fontWeight:800,cursor:clicavel?"pointer":"default",padding:0,fontFamily:"'Inter',sans-serif",opacity:dentro?1:0.5}}>
              {ok?"✓":parseInt(d.slice(8),10)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function BlocoMedidor({m, x, onQtd, onEtapa, onDia}) {
  const M = MEDIDORES[x.k], cor = x.pct>=1 ? "#2E6E5E" : "#2E6E5E";
  return (
    <div style={{border:"1px solid #F0EEE6",borderRadius:12,padding:"10px 12px",marginTop:10}}>
      {x.k!=="quantidade"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
          <span style={{fontSize:12.5,fontWeight:800,color:"#173C33",display:"inline-flex",alignItems:"center",gap:8}}>{M.icone} {M.nome}
          </span>
          <span style={{fontSize:11.5,fontWeight:800,color:x.pct>=1?"#235448":"#666"}}>{x.txt} · {Math.round(Math.min(1,x.pct)*100)}%</span>
        </div>
        <Bar percent={x.pct*100} color={cor}/>
      </>}
      {x.k==="quantidade"&&x.itens.map((it,ix)=>(
        <div key={it.id} style={{marginTop:ix>0?12:0,borderTop:ix>0?"1px solid #F0EEE6":"none",paddingTop:ix>0?12:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:6}}>
            <span style={{fontSize:12.5,fontWeight:800,color:"#173C33"}}>🔢 {it.nome||"Atividade"}</span>
            <span style={{fontSize:11.5,fontWeight:800,color:it.pct>=1?"#235448":"#666"}}>{it.txt} · {Math.round(Math.min(1,it.pct)*100)}%</span>
          </div>
          <Bar percent={it.pct*100} color={cor}/>
          {it.extra&&<div style={{fontSize:11,fontWeight:700,color:"#A39C8A",marginTop:6}}>{it.auto?"":"🔁 "}{it.extra}</div>}
          {onQtd&&!it.auto&&<div style={{display:"flex",gap:8,marginTop:8}}>
            {[-1,1,5,10,50].map(d=>(
              <button key={d} onClick={()=>onQtd(m,d,it.id)} style={{flex:1,border:`2px solid ${d>0?"#2E6E5E":"#E3DFD3"}`,background:d>0?"#EAF3EF":"#fff",color:d>0?"#235448":"#666",borderRadius:10,padding:"8px 4px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{d>0?`+ ${d}`:`− ${Math.abs(d)}`}</button>
            ))}
          </div>}
        </div>
      ))}
      {x.k==="etapas"&&(
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
          {lerEtapas(m).map((e,i)=>(
            <button key={i} onClick={()=>onEtapa&&onEtapa(m,i)} style={{display:"flex",alignItems:"center",gap:10,background:e.ok?"#EAF3EF":"#FAF9F6",border:`1px solid ${e.ok?"#BFDCD1":"#F0EEE6"}`,borderRadius:10,padding:"8px 10px",cursor:onEtapa?"pointer":"default",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
              <span style={{width:20,height:20,borderRadius:6,border:`2px solid ${e.ok?"#2E6E5E":"#CCCCCC"}`,background:e.ok?"#2E6E5E":"#fff",color:"#fff",fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{e.ok?"✓":""}</span>
              <span style={{fontSize:13,fontWeight:700,color:e.ok?"#235448":"#173C33",textDecoration:e.ok?"line-through":"none"}}>{e.t}</span>
            </button>
          ))}
        </div>
      )}
      {x.k==="calendario"&&(
        <div style={{marginTop:10}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <span style={{flex:1,display:"inline-flex",alignItems:"center",gap:6,background:x.seq>0?"#FFF1E6":"#F4F2ED",borderRadius:10,padding:"8px 10px",fontSize:12,fontWeight:800,color:x.seq>0?"#C2410C":"#999"}}>
              🔥 {x.seq} dia{x.seq===1?"":"s"} seguido{x.seq===1?"":"s"}
            </span>
            {onDia&&m.prazo&&hoje()<=m.prazo&&hoje()>=(m.data_inicio||"")&&(
              <button onClick={()=>onDia(m,hoje())} style={{flex:1,border:"none",borderRadius:10,padding:"9px 10px",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif",
                background:x.hojeOk?"#EAF3EF":"#2E6E5E",color:x.hojeOk?"#235448":"#fff"}}>{x.hojeOk?"✓ Hoje feito":"Marcar hoje"}</button>
            )}
          </div>
          <MiniCalendario m={m} onDia={onDia}/>
        </div>
      )}
    </div>
  );
}
function CardMeta({m, p, onClick, onQtd, onEtapa, onDia}) {
  const T = TIPOS_META[p.tipo], v = VIS, limite = p.tipo==="limite", obj = p.tipo==="objetiva";
  const corAnel = limite ? p.status.cor : p.pct>=1 ? "#2E6E5E" : p.status.nivel===2 ? "#B4483C" : p.status.nivel===1 ? "#A6822E" : "#2E6E5E";
  const meds = p.meds || [];
  const icone = obj ? (meds.length===1 ? MEDIDORES[meds[0].k].icone : "🎯") : p.tipo==="patrimonio" ? (BENS[m.unidade]||BENS.outro).icone : T.icone;
  const subtitulo = obj ? (meds.length ? meds.map(x=>MEDIDORES[x.k].nome).join(" + ") : "sem medidor") : T.nome;
  return (
    <div onClick={onClick} style={{background:"#fff",borderRadius:16,padding:"16px",boxShadow:"0 2px 10px #173C3312",marginBottom:12,cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12}}>
        <span style={{width:38,height:38,borderRadius:12,background:v.fundo,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{icone}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,color:"#173C33",lineHeight:1.25}}>{m.nome}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
            <span style={{fontSize:10.5,color:"#A39C8A",fontWeight:700}}>{GRUPOS_META[T.grupo].nome} · {subtitulo}</span>
          </div>
        </div>
        <span className="badge" style={{marginTop:0,background:p.status.fundo,color:p.status.cor,border:`1px solid ${p.status.cor}33`,whiteSpace:"nowrap"}}>{p.status.txt}</span>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <Anel pct={p.pct} cor={corAnel} centro={limite?<><div style={{fontSize:17,fontWeight:800,color:"#173C33",lineHeight:1}}>{Math.round(p.pct*100)}%</div><div style={{fontSize:8.5,color:"#A39C8A",fontWeight:700,marginTop:2}}>usado</div></>:null}/>
        <div style={{flex:1,minWidth:0}}>
          {obj
            ?<>
              <div style={{fontSize:10,color:"#A39C8A",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Progresso geral</div>
              <div style={{fontSize:21,fontWeight:800,color:"#173C33",lineHeight:1.15}}>{Math.round(p.pct*100)}%</div>
              <div style={{fontSize:12,fontWeight:700,color:"#A39C8A",marginTop:2}}>{meds.length>1?`média de ${meds.length} medidores`:meds[0]?meds[0].txt:""}</div>
            </>
            :<>
              <div style={{fontSize:10,color:"#A39C8A",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>{limite?"Gasto":"Atual"}</div>
              <div style={{fontSize:21,fontWeight:800,color:"#173C33",lineHeight:1.15}}>{fmtMeta(m,p.atual)}</div>
              <div style={{fontSize:12,fontWeight:700,color:"#A39C8A",marginTop:2}}>{limite?"limite":"alvo"} {fmtMeta(m,p.alvo)}{p.patr&&p.patr.np>0?` · ${p.patr.pagas}/${p.patr.np} parcelas`:""}</div>
            </>}
          <div style={{marginTop:8}}><Prazo p={p} m={m}/></div>
        </div>
      </div>
      {p.dica&&<div style={{fontSize:11.5,fontWeight:700,color:p.pct>=1&&!limite?"#235448":limite&&p.pct>1?"#B4483C":"#444",background:"#F7F5F0",borderRadius:10,padding:"8px 10px",marginTop:12}}>{p.dica}</div>}
      {obj&&<div onClick={e=>e.stopPropagation()} style={{cursor:"default"}}>{meds.map(x=><BlocoMedidor key={x.k} m={m} x={x} onQtd={onQtd} onEtapa={onEtapa} onDia={onDia}/>)}</div>}
      {!limite&&<div style={{marginTop:12}}><Medalhas pct={p.pct}/></div>}
    </div>
  );
}
function CardRealizada({m, p, onClick}) {
  const T = TIPOS_META[p.tipo];
  const quando = m.concluida_em || null;
  const antes = quando && m.prazo ? diasEntre(quando, m.prazo) : null;
  const tipoTxt = p.tipo==="objetiva" ? `🎯 ${(p.meds||[]).map(x=>MEDIDORES[x.k].nome).join(" + ")}` : `${T.icone} ${T.nome} · ${fmtMeta(m,p.alvo)}`;
  return (
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:12,background:"linear-gradient(135deg,#FFFDF5,#FBF3E4)",border:"1.5px solid #EAD9AE",borderRadius:16,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
      <span style={{fontSize:30}}>🏆</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14.5,fontWeight:800,color:"#173C33"}}>{m.nome}</div>
        <div style={{fontSize:11,color:"#8A6A1F",fontWeight:700,marginTop:3}}>{tipoTxt}</div>
        <div style={{fontSize:10.5,color:"#A39C8A",fontWeight:600,marginTop:3}}>
          {quando?`Concluída em ${f2(quando)}`:"Alvo atingido"}{antes!=null&&antes>0?` · ${antes} dia${antes>1?"s":""} antes do prazo 🔥`:""}
        </div>
      </div>
    </div>
  );
}
function PainelAlertas({alertas, onClose, onIgnorar, onExecutei, nIgnorados, onRestaurar}) {
  const NIV = [{t:"Info",c:"#2F65AC",f:"#EEF3FB"},{t:"Atenção",c:"#A6822E",f:"#FBF3E4"},{t:"Crítico",c:"#B4483C",f:"#FBECEA"}];
  const crit = alertas.some(a=>a.nivel===2);
  return (
    <Modal onClose={onClose}>
      <div style={{fontSize:18,fontWeight:800,color:"#173C33",marginBottom:2,fontFamily:"'Fraunces',serif"}}>Alertas</div>
      <div style={{background:alertas.length?(crit?"#FBECEA":"#FBF3E4"):"#EAF3EF",borderRadius:12,padding:"10px 12px",margin:"10px 0 14px"}}>
        <div style={{fontSize:18,fontWeight:800,color:alertas.length?(crit?"#B4483C":"#A6822E"):"#2E6E5E"}}>{alertas.length?`${alertas.length} alerta${alertas.length>1?"s":""}`:"tudo ok ✅"}</div>
        {!alertas.length&&<div style={{fontSize:12,color:"#235448",fontWeight:700,marginTop:2}}>Nada pendente agora.</div>}
      </div>
      {alertas.map((a,i)=>{ const n=NIV[a.nivel]; return (
        <div key={i} style={{background:n.f,border:`1px solid ${n.c}33`,borderLeft:`4px solid ${n.c}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",gap:6,alignItems:"flex-start",marginBottom:6,flexWrap:"wrap"}}>
            <span className="badge" style={{marginTop:1,background:n.c,color:"#fff",border:"none"}}>{n.t}</span>
            <span style={{fontSize:13,fontWeight:800,color:"#173C33",lineHeight:1.3,flexBasis:"100%"}}>{a.titulo}</span>
          </div>
          <div style={{fontSize:11.5,color:"#444",lineHeight:1.45}}><b>Motivo:</b> {a.motivo}</div>
          <div style={{fontSize:11.5,color:"#444",lineHeight:1.45}}><b>Impacto:</b> {a.impacto}</div>
          <div style={{fontSize:11.5,color:n.c,lineHeight:1.45,fontWeight:700,marginTop:2}}>→ {a.acao}</div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            {a.ids&&<button onClick={()=>onExecutei(a)} style={{flex:1,border:"none",background:"#2E6E5E",color:"#fff",borderRadius:9,padding:"8px 6px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✓ Já executei</button>}
            <button onClick={()=>onIgnorar(a)} style={{flex:1,border:`1.5px solid ${n.c}55`,background:"#fff",color:"#7A7466",borderRadius:9,padding:"8px 6px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Tirar alerta</button>
          </div>
        </div>
      );})}
      {nIgnorados>0&&<button onClick={onRestaurar} style={{display:"block",margin:"4px auto 10px",background:"none",border:"none",color:"#2E6E5E",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Mostrar de novo os alertas retirados ({nIgnorados})</button>}
      <button className="btn-ghost" onClick={onClose}>Fechar</button>
    </Modal>
  );
}

const INIT_STATE = Object.fromEntries(MESES.map(m=>[m.mes,[]]));
const INIT_RECEITAS = Object.fromEntries(MESES.map(m=>[m.mes,[]]));

export default function App() {
  const idxHoje = MESES.findIndex(m => m.mes === hoje().slice(0,7));
  const [mesIdx,setMesIdx]                 = useState(idxHoje >= 0 ? idxHoje : 0);
  const [allItems,setAllItems]             = useState(INIT_STATE);
  const [allReceitas,setAllReceitas]       = useState(INIT_RECEITAS);
  const [loading,setLoading]               = useState(true);
  const [lastSync,setLastSync]             = useState(null);
  const [,forceCatUpdate]                  = useState(0);
  const [aplicadoTodos,setAplicadoTodos]   = useState([]);
  const [glob,setGlob]                     = useState({ l:[], r:[], ap:[] });
  const [metas,setMetas]                   = useState([]);
  const [formMeta,setFormMeta]             = useState(null);
  const [metaTab,setMetaTab]               = useState("andamento");   // andamento | realizadas | nova
  const [delGen,setDelGen]                 = useState(null);
  const [acaoGen,setAcaoGen]               = useState(null);
  const [showAlertas,setShowAlertas]       = useState(false);
  const [erroGen,setErroGen]               = useState({});
  const [view,setView]                     = useState("caixa");
  const [showPicker,setShowPicker]         = useState(false);
  const [showForm,setShowForm]             = useState(false);
  const [showFormReceita,setShowFormReceita]=useState(false);
  const [editItem,setEditItem]             = useState(null);
  const [delItem,setDelItem]               = useState(null);
  const [delReceita,setDelReceita]         = useState(null);
  const [editReceita,setEditReceita]       = useState(null);
  const [catAberta,setCatAberta]           = useState(null);
  const [busca,setBusca]                   = useState("");
  const [histTab,setHistTab]               = useState("exec");
  const [popProg,setPopProg]               = useState(false);
  const [acaoItem,setAcaoItem]             = useState(null);
  const [acaoReceita,setAcaoReceita]       = useState(null);
  const [ctx,setCtx]                       = useState(null);
  const [progMode,setProgMode]             = useState(false);
  const [recAberto,setRecAberto]           = useState(false);
  const [extAberto,setExtAberto]           = useState(false);
  const [showRend,setShowRend]             = useState(false);
  const [formRend,setFormRend]             = useState({modo:"valor",valorDigits:"",taxa:"",data:hoje(),de:hoje(),ate:hoje()});
  const [erroRend,setErroRend]             = useState(null);
  const lastTouch = useRef(0);
  const abertoEm = useRef(0);
  const pressTimer = useRef(null);
  const [fluxoAberto,setFluxoAberto]       = useState(false);
  const [evoAberto,setEvoAberto]           = useState(false);
  const [rendAberto,setRendAberto]       = useState(false);
  const [motivoExc,setMotivoExc]           = useState("");
  const [motivoErr,setMotivoErr]           = useState(false);
  const [form,setForm]                     = useState(emptyForm());
  const [formReceita,setFormReceita]       = useState(emptyFormReceita());
  const [erro,setErro]                     = useState({});
  const [erroReceita,setErroReceita]       = useState({});
  const [toast,setToast]                   = useState(null);
  const mesAtual  = MESES[mesIdx];
  const mesAnt    = mesIdx>0?MESES[mesIdx-1]:null;
  const isFechado = mesAtual.fechado;
  const items     = allItems[mesAtual.mes]||[];
  const itemsAnt  = mesAnt?(allItems[mesAnt.mes]||[]):[];
  const receitas  = allReceitas[mesAtual.mes]||[];

  const loadGlobal = useCallback(async () => {
    const [g, mt, ap] = await Promise.all([
      fetchRange(MES_INICIO, mAdd(hoje().slice(0,7), 3)),
      tbGet("metas", "order=criado_em.asc"),
      fetchAplicadoAll(),
    ]);
    // Contas antigas (sem a marca "programado") com data futura: grava a marca para que não virem executadas sozinhas no dia.
    if (!g.falhou) (g.l||[]).filter(l=>l.programado===null && l.data>hoje() && !l.excluido && !MIGRADOS.has(l.id)).forEach(l=>{ MIGRADOS.add(l.id); l.programado=true; sbPatch(l.id,{programado:true}); });
    if (!g.falhou && ap) setGlob({ l:g.l, r:g.r, ap });
    if (mt) setMetas(mt.filter(x=>!x.excluido));
  }, []);
  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    const [dAtual, dAnt, rAtual, aplicAll] = await Promise.all([
      sbGet(mesAtual.mes),
      mesAnt ? sbGet(mesAnt.mes) : Promise.resolve([]),
      rcGet(mesAtual.mes),
      fetchAplicadoAll(),
    ]);
    const semRend = a => (a||[]).filter(t=>!isRend(t));   // rendimento NUNCA é despesa: só aparece na aba Aplicado
    setAllItems(p => ({...p, ...(dAtual ? {[mesAtual.mes]: semRend(dAtual)} : {}), ...(mesAnt && dAnt ? {[mesAnt.mes]: semRend(dAnt)} : {})}));
    if (rAtual) setAllReceitas(p => ({...p, [mesAtual.mes]: rAtual}));
    if (aplicAll) setAplicadoTodos(aplicAll);
    if (dAtual && rAtual) setLastSync(new Date());
    if (!silent) { setLoading(false); loadGlobal(); }
  }, [mesAtual.mes, mesAnt, loadGlobal]);

  const modalNovo = !!delGen || !!acaoGen || showAlertas;
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (showForm || showFormReceita || editItem || delItem || delReceita || editReceita || acaoItem || acaoReceita || ctx || showRend || modalNovo) return;
    const t = setInterval(() => load(true), 5000);
    const tg = setInterval(() => loadGlobal(), 30000);
    return () => { clearInterval(t); clearInterval(tg); };
  }, [load, loadGlobal, showForm, showFormReceita, editItem, delItem, delReceita, editReceita, acaoItem, acaoReceita, ctx, showRend, modalNovo]);

  useEffect(() => {
    fetchCategorias().then(res => {
      if (res && res.length > 0) {
        CATEGORIAS = res.map(r => r.nome);
        res.forEach(r => { CAT_CORES[r.nome] = r.cor; });
        forceCatUpdate(v => v + 1);
      }
    });
  }, []);

  const ativos     = useMemo(()=>items.filter(t=>!t.excluido),[items]);
  const contaveis  = useMemo(()=>ativos.filter(t=>t.meio!=="Pluxe" && t.categoria!=="Aplicado" && !agendada(t,hoje())),[ativos]);
  const total      = useMemo(()=>contaveis.reduce((s,t)=>s+t.valor,0),[contaveis]);
  const agendados  = useMemo(()=>ativos.filter(t=>t.meio!=="Pluxe" && t.categoria!=="Aplicado" && agendada(t,hoje())),[ativos]);
  const totalAgendado = useMemo(()=>agendados.reduce((s,t)=>s+t.valor,0),[agendados]);
  const totalReceita = useMemo(()=>receitas.reduce((s,r)=>s+r.valor,0),[receitas]);
  const saldo        = totalReceita - total;
  const maxDia     = useMemo(()=>{const d=items.map(t=>parseInt(t.data.slice(8,10)));return d.length?Math.max(...d):31;},[items]);
  const totalAnt   = useMemo(()=>soma(itemsAnt.filter(t=>parseInt(t.data.slice(8,10))<=maxDia)),[itemsAnt,maxDia]);
  const sorted     = useMemo(()=>[...items].sort((a,b)=>new Date(b.data)-new Date(a.data)),[items]);
  const sortedReceitas = useMemo(()=>[...receitas].sort((a,b)=>new Date(b.semana)-new Date(a.semana)),[receitas]);
  const [ignorados,setIgnorados] = useState(()=>{ try{ const a=JSON.parse(localStorage.getItem("lima_alertas_ignorados")||"[]"); return Array.isArray(a)?a:[]; }catch{ return []; } });
  const salvaIgn = lista => { const l=lista.slice(-200); setIgnorados(l); try{ localStorage.setItem("lima_alertas_ignorados", JSON.stringify(l)); }catch{} };
  const alertas   = useMemo(()=>gerarAlertas(glob, metas).filter(a=>!ignorados.includes(a.key)),[glob,metas,ignorados]);
  const nivelAlerta = alertas.reduce((m,a)=>Math.max(m,a.nivel),0);
  const totalAplicadoGeral = useMemo(()=>aplicadoTodos.filter(t=>!isInc(t)).reduce((s,t)=>s+t.valor,0),[aplicadoTodos]);
  const rendInfo = useMemo(()=>{
    const m=mesAtual.mes;
    const rend=aplicadoTodos.filter(t=>t.meio==="Rendimento"&&t.mes===m).reduce((s,t)=>s+t.valor,0);
    const base=aplicadoTodos.filter(t=>t.mes<m).reduce((s,t)=>s+t.valor,0);
    const regs=aplicadoTodos.filter(t=>t.meio==="Rendimento"&&t.mes===m).sort((a,b)=>b.data.localeCompare(a.data));
    const pct=base>0?(rend/base)*100:0;
    let aa=null;
    if(regs.length){
      const mt=(regs[0].obs||"").match(/([\d]+(?:,\d+)?)% a\.a\./);
      aa=mt?parseFloat(mt[1].replace(",",".")):(base>0&&rend>0?(Math.pow(1+rend/base,12)-1)*100:null);
    }
    return {rend,base,pct,aa,tem:regs.length>0};
  },[aplicadoTodos,mesAtual.mes]);
  const taxaNum = v => { const n=parseFloat(String(v).replace(",",".")); return isFinite(n)?n:0; };
  const calcRend = (taxaStr,dataStr) => {
    const a=taxaNum(taxaStr);
    const base=aplicadoTodos.filter(t=>!isInc(t) && t.data<=dataStr && !(t.meio==="Rendimento"&&t.mes===dataStr.slice(0,7))).reduce((s,t)=>s+t.valor,0);
    const mensal=a>0?Math.pow(1+a/100,1/12)-1:0;
    return {a,base,mensal,valor:Math.round(base*mensal*100)/100};
  };
  const carteira = useMemo(()=>{
    const soma=a=>a.reduce((s,t)=>s+t.valor,0);
    const regs=aplicadoTodos.filter(isRend);
    const principal=aplicadoTodos.filter(t=>!isRend(t));
    const rendTop=soma(aplicadoTodos.filter(t=>t.meio==="Rendimento")), rendInc=soma(aplicadoTodos.filter(isInc));
    const aportes=soma(principal)-rendInc, rend=rendTop+rendInc, total=soma(principal)+rendTop;
    const porMes={};
    [...regs].sort((a,b)=>a.data.localeCompare(b.data)).forEach(r=>{
      if(!porMes[r.mes]){
        const base=soma(aplicadoTodos.filter(t=>!isInc(t) && t.data<=r.data && !(t.meio==="Rendimento"&&t.mes===r.mes)));
        porMes[r.mes]={valor:0,base,dias:0};
      }
      porMes[r.mes].valor+=r.valor;
      if(isInc(r)){
        const mt=(r.obs||"").match(/(\d{2})\/(\d{2})\/(\d{4})–(\d{2})\/(\d{2})\/(\d{4})/);
        const d=mt?Math.round((new Date(+mt[6],+mt[5]-1,+mt[4])-new Date(+mt[3],+mt[2]-1,+mt[1]))/86400000)+1:30.4375;
        porMes[r.mes].dias+=d;
      }
    });
    const ms=Object.keys(porMes).sort();
    let fator=1, expo=0; const fatorAno={};
    ms.forEach(m=>{
      const x=porMes[m];
      expo+=x.dias>0?x.dias/30.4375:1;
      if(x.base>0){ const f=1+x.valor/x.base; fator*=f; const y=m.slice(0,4); fatorAno[y]=(fatorAno[y]||1)*f; }
    });
    const n=ms.length?Math.max(expo,0.01):0;
    const acum=(fator-1)*100;
    const aa=n>0?(Math.pow(fator,12/n)-1)*100:null;
    const todos=aplicadoTodos.map(t=>t.mes).sort();
    const meses=[]; if(todos.length){ let k=todos[0]; const fimK=todos[todos.length-1]; while(k<=fimK){ meses.push(k); k=mAdd(k,1);} }
    let ca=0, cr=0;
    const evo=meses.map(k=>{
      const dm=aplicadoTodos.filter(t=>t.mes===k);
      const a=soma(dm.filter(t=>!isRend(t)))-soma(dm.filter(isInc)), r=soma(dm.filter(isRend));
      ca+=a; cr+=r; return {k,a,r,ca,cr,tot:ca+cr};
    });
    const anos=[...new Set(meses.map(k=>k.slice(0,4)))].map(y=>{
      const dy=aplicadoTodos.filter(t=>t.mes.startsWith(y));
      return {y, a:soma(dy.filter(t=>!isRend(t)))-soma(dy.filter(isInc)), r:soma(dy.filter(isRend)), pct:fatorAno[y]?(fatorAno[y]-1)*100:null};
    });
    return {aportes,rend,total,n,acum,aa,desde:ms[0]||null,evo,anos,
      nAp:principal.length,nRe:regs.length,temRend:regs.length>0&&n>0};
  },[aplicadoTodos]);
  const novoFormRend = () => {
    const prim=aplicadoTodos.filter(t=>!isRend(t)).map(t=>t.data).sort()[0];
    return {modo:"valor",valorDigits:"",taxa:"",data:hoje(),de:prim||hoje().slice(0,8)+"01",ate:hoje()};
  };
  // Distribui um rendimento total (já incluso no montante) mês a mês, com taxa mensal constante
  const distribuir = (V,de,ate) => {
    if(!(V>0)) return {ok:false,err:"Informe o valor que rendeu"};
    if(!de||!ate||de>ate) return {ok:false,err:"Período inválido (confira as datas)"};
    const pad=n=>String(n).padStart(2,"0");
    const segs=[]; let k=de.slice(0,7); const kEnd=ate.slice(0,7);
    while(k<=kEnd){
      const [y,m]=k.split("-").map(Number); const dim=new Date(y,m,0).getDate();
      const d1=k===de.slice(0,7)?parseInt(de.slice(8,10),10):1, d2=k===kEnd?parseInt(ate.slice(8,10),10):dim;
      const fim=`${k}-${pad(d2)}`;
      const base=aplicadoTodos.filter(t=>!isRend(t)&&t.data<=fim).reduce((s,t)=>s+t.valor,0);
      segs.push({k,ini:`${k}-${pad(d1)}`,fim,frac:(d2-d1+1)/dim,base});
      k=mAdd(k,1);
    }
    const f=r=>segs.reduce((s,x)=>s+x.base*(Math.pow(1+r,x.frac)-1),0);
    if(!segs.some(x=>x.base>0)) return {ok:false,err:"Não há aplicação registrada nesse período"};
    if(f(1)<V) return {ok:false,err:"Valor alto demais para o montante do período"};
    let lo=0,hi=1; for(let it=0;it<80;it++){ const mid=(lo+hi)/2; if(f(mid)<V) lo=mid; else hi=mid; }
    const r=(lo+hi)/2;
    segs.forEach(x=>{ x.valor=Math.round(x.base*(Math.pow(1+r,x.frac)-1)*100)/100; });
    const comValor=segs.filter(x=>x.valor>0);
    if(!comValor.length) return {ok:false,err:"Rendimento calculado é zero"};
    const dif=Math.round((V-comValor.reduce((s,x)=>s+x.valor,0))*100)/100;
    comValor[comValor.length-1].valor=Math.round((comValor[comValor.length-1].valor+dif)*100)/100;
    const meses=segs.reduce((s,x)=>s+x.frac,0);
    return {ok:true,r,segs:comValor,aa:(Math.pow(1+r,12)-1)*100,meses};
  };
  const aplicadoOrd = useMemo(()=>[...aplicadoTodos].sort((a,b)=>new Date(b.data)-new Date(a.data)),[aplicadoTodos]);
  const byCat      = useMemo(()=>{
    const m={};
    contaveis.forEach(t=>{m[t.categoria]=(m[t.categoria]||0)+t.valor;});
    return Object.entries(m).map(([cat,val])=>({cat,val})).sort((a,b)=>b.val-a.val);
  },[contaveis]);
  const fluxoSemanal = useMemo(()=>{
    const semanas = semanasDoMes(mesAtual.mes);
    return semanas.map(sem=>{
      const rec = receitas.filter(r=>{
        const d=parseInt(r.semana.slice(8,10));
        return d>=sem.ini && d<=sem.fim;
      }).reduce((s,r)=>s+r.valor,0);
      const desp = contaveis.filter(t=>{
        const d=parseInt(t.data.slice(8,10));
        return d>=sem.ini && d<=sem.fim;
      }).reduce((s,t)=>s+t.valor,0);
      return {...sem, receita:rec, despesa:desp, saldo:rec-desp};
    });
  },[receitas,contaveis,mesAtual.mes]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};
  const goMes=dir=>{setMesIdx(i=>i+dir);setShowPicker(false);};

  const validar=f=>{
    const e={};
    if(!f.descricao.trim())                            e.descricao    ="Campo obrigatório";
    if(!f.valorDigits||parseInt(f.valorDigits)===0)    e.valor        ="Campo obrigatório";
    if(!f.categoria)                                   e.categoria    ="Selecione uma categoria";
    if(!f.meio)                                        e.meio         ="Selecione o meio de pagamento";
    if(!f.data)                                        e.data         ="Campo obrigatório";
    if(f.recorrente){
      const n=parseInt(f.repeticoes,10);
      if(!n||n<1||n>60)                                e.repeticoes   ="Informe de 1 a 60 meses";
    }
    return e;
  };
  const validarReceita=f=>{
    const e={};
    if(!f.descricao.trim())                            e.descricao ="Campo obrigatório";
    if(!f.valorDigits||parseInt(f.valorDigits)===0)    e.valor     ="Campo obrigatório";
    if(!f.data)                                        e.data      ="Campo obrigatório";
    return e;
  };
  const lancar=async ()=>{
    const e=validar(form);
    if(Object.keys(e).length){setErro(e);return;}
    const valor = d2float(form.valorDigits);
    const item = {
      id: uid(), cliente_id: CID, mes: form.data.slice(0,7), centro: "empresa",
      categoria: form.categoria, descricao: form.descricao.trim(), valor,
      meio: form.meio, data: form.data, obs: form.obs, excluido: false,
      recorrente: !!form.recorrente, motivo_exclusao: "", programado: form.data>hoje() || !!form.pagar, meta_id: form.meta_id||null,
    };
    const res = await sbPost(item);
    setShowForm(false);
    if(!res) return;
    let extras = 0;
    if(form.recorrente){
      const n = parseInt(form.repeticoes,10);
      const novas = [];
      for(let i=1;i<=n;i++){
        const dt = addMesesData(form.data, i);
        novas.push({...item, id: uid(), mes: dt.slice(0,7), data: dt, programado: dt>hoje()});
      }
      const resultados = await Promise.all(novas.map(x=>sbPost(x)));
      extras = resultados.filter(Boolean).length;
    }
    load();
    showToast(form.recorrente ? `✓ Registrado + ${extras} recorrência${extras===1?"":"s"}` : "✓ Lançamento registrado");
  };
  const lancarReceita=async ()=>{
    const e=validarReceita(formReceita);
    if(Object.keys(e).length){setErroReceita(e);return;}
    const payload={
      id: uid(), cliente_id: CID, mes: formReceita.data.slice(0,7), semana: formReceita.data,
      valor: d2float(formReceita.valorDigits), descricao: formReceita.descricao.trim(),
      obs: formReceita.obs, data_lancamento: hoje(),
    };
    const res = await rcPost(payload);
    setShowFormReceita(false);
    if(res){ load(); showToast("✓ Receita registrada"); }
  };
  const openEdit=item=>{
    setForm({descricao:item.descricao,valorDigits:float2d(item.valor),categoria:item.categoria,meio:item.meio,data:item.data,obs:item.obs||"",meta_id:item.meta_id||"",pagar:item.programado===true&&item.data<=hoje()});
    setErro({});setEditItem(item);
  };
  const salvarEdicao=async ()=>{
    const e=validar(form);
    if(Object.keys(e).length){setErro(e);return;}
    const ok = await sbPatch(editItem.id, {
      descricao: form.descricao.trim(), valor: d2float(form.valorDigits),
      categoria: form.categoria, meio: form.meio, data: form.data,
      mes: form.data.slice(0,7), obs: form.obs,
      programado: form.data>hoje() || !!form.pagar, meta_id: form.meta_id||null,
    });
    setEditItem(null);
    if(ok){ load(); showToast("✓ Lançamento atualizado"); }
  };
  const confirmarExclusao=async ()=>{
    if(!motivoExc.trim()){setMotivoErr(true);return;}
    const ok = await sbPatch(delItem.id, { excluido: true, motivo_exclusao: motivoExc.trim() });
    setDelItem(null);setMotivoExc("");setMotivoErr(false);
    if(ok){ load(); showToast("Lançamento excluído"); }
  };
  useEffect(()=>{
    const h=e=>{
      if(e.key!=="Escape") return;
      setShowForm(false);setShowFormReceita(false);setEditItem(null);setDelItem(null);setMotivoExc("");setMotivoErr(false);
      setDelReceita(null);setEditReceita(null);setAcaoItem(null);setAcaoReceita(null);setPopProg(false);setCtx(null);
      setShowRend(false);setShowPicker(false);setDelGen(null);setAcaoGen(null);setShowAlertas(false);
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[]);
  const programarDespesa=()=>{
    setPopProg(false);setProgMode(true);
    setForm({...emptyForm(),data:amanha()});setErro({});setShowForm(true);
  };
  const salvarRendimento=async ()=>{
    if(formRend.modo==="valor"){
      const V=d2float(formRend.valorDigits||"0");
      const d=distribuir(V,formRend.de,formRend.ate);
      if(!d.ok){setErroRend(d.err);return;}
      const pctm=((Math.pow(1+d.r,1)-1)*100).toFixed(2).replace(".",",");
      const novos=d.segs.map(x=>({
        id: uid(), cliente_id: CID, mes: x.k, centro: "empresa", categoria: "Aplicado", descricao: "Rendimento CDB",
        valor: x.valor, meio: "Rendimento incluso", data: x.fim,
        obs: `Distribuído: ${pctm}% a.m. sobre ${fmt(x.base)} · ${f2(x.ini)}–${f2(x.fim)}`,
        excluido: false, recorrente: false, motivo_exclusao: "",
      }));
      const meses=new Set(novos.map(x=>x.mes));
      const antigos=aplicadoTodos.filter(t=>isInc(t)&&meses.has(t.mes));
      const res=await Promise.all(novos.map(x=>sbPost(x)));
      if(res.some(r=>!r)){setErroRend("Falha ao salvar parte dos meses. Verifique em Aplicado antes de tentar de novo.");load();return;}
      await Promise.all(antigos.map(t=>sbPatch(t.id,{excluido:true,motivo_exclusao:"Substituído por nova distribuição"})));
      setShowRend(false); load();
      showToast(`✓ Rendimento distribuído em ${novos.length} ${novos.length===1?"mês":"meses"}`);
      return;
    }
    if(!formRend.data){setErroRend("Informe a data");return;}
    const c=calcRend(formRend.taxa,formRend.data);
    if(c.a<=0||c.a>100){setErroRend("Informe a taxa anual (ex: 11,5)");return;}
    if(c.base<=0){setErroRend("Não há montante aplicado até essa data");return;}
    if(c.valor<=0){setErroRend("Rendimento calculado é zero");return;}
    const res=await sbPost({
      id: uid(), cliente_id: CID, mes: formRend.data.slice(0,7), centro: "empresa", categoria: "Aplicado",
      descricao: "Rendimento CDB", valor: c.valor, meio: "Rendimento", data: formRend.data,
      obs: `${c.a.toFixed(2).replace(".",",")}% a.a. sobre ${fmt(c.base)}`, excluido: false, recorrente: false, motivo_exclusao: "",
    });
    setShowRend(false);
    if(res){ load(); showToast("✓ Rendimento registrado"); }
  };
  const provisionar=async t=>{
    const ok = await sbPatch(t.id, { data: hoje(), mes: hoje().slice(0,7), programado: false });
    if(ok){ load(); showToast("✓ Movido para executado"); }
  };
  const openEditReceita=r=>{
    setFormReceita({descricao:r.descricao||"",valorDigits:float2d(r.valor),data:r.semana||"",obs:r.obs||""});
    setErroReceita({});setEditReceita(r);
  };
  const salvarEdicaoReceita=async ()=>{
    const e=validarReceita(formReceita);
    if(Object.keys(e).length){setErroReceita(e);return;}
    const ok = await rcPatch(editReceita.id, {
      descricao: formReceita.descricao.trim(), valor: d2float(formReceita.valorDigits),
      semana: formReceita.data, mes: formReceita.data.slice(0,7), obs: formReceita.obs,
    });
    setEditReceita(null);
    if(ok){ load(); showToast("✓ Receita atualizada"); }
  };
  const normTxt=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const confirmarExclusaoReceita=async ()=>{
    const ok = await rcDelete(delReceita.id);
    setDelReceita(null);
    if(ok){ load(); showToast("Receita excluída"); }
  };

  // ─── Metas ───
  const baseMeta = grupo => ({ grupo, tipo: grupo==="financeira"?"faturamento":"objetiva", medidores: grupo==="objetiva"?["quantidade"]:[],
    nome:"", descricao:"", centro:"pessoal", categoria:"", unidade:"",
    iniDigits:"", alvoDigits:"", atualDigits:"", parcelas:"", parcPagas:"", qtdItens:[], qi:{...qiVazio}, etapas:[], novaEtapa:"", cal_freq:"diario", cal_vezes:"3", data_inicio:hoje(), prazo:"" });
  const novaMeta = grupo => { setErroGen({}); setFormMeta({ f: baseMeta(grupo) }); };
  const editarMeta = m => {
    const t=tipoMeta(m.tipo), g=TIPOS_META[t].grupo, n=x=>Number(x)||0, md=medidoresDe(m);
    setErroGen({}); setMetaTab("nova");
    setFormMeta({ item:m, f:{ ...baseMeta(g), tipo:t, medidores: g==="objetiva"?(md.length?md:["quantidade"]):[], nome:m.nome||"", descricao:m.descricao||"", centro:"pessoal", categoria:m.categoria||"", unidade:m.unidade||"",
      iniDigits:n(m.valor_inicial)?float2d(n(m.valor_inicial)):"", alvoDigits:g==="financeira"&&n(m.valor_alvo)?float2d(n(m.valor_alvo)):"", atualDigits:t==="valor"&&n(m.valor_atual)?float2d(n(m.valor_atual)):"",
      parcelas:m.parcelas?String(m.parcelas):"", parcPagas:m.parc_pagas!=null?String(m.parc_pagas):"", qtdItens: md.includes("quantidade") ? qtdItens(m).map(it=>({...it,id:it.id==="legacy"?uid():it.id})) : [], etapas:lerEtapas(m),
      cal_freq:m.cal_freq||"diario", cal_vezes:String(m.cal_vezes||3), data_inicio:m.data_inicio||hoje(), prazo:m.prazo||"" } });
  };
  const salvarMeta = async () => {
    const f=formMeta.f, T=TIPOS_META[f.tipo], e={}, obj=f.tipo==="objetiva", md=obj?f.medidores:[];
    if(!f.nome.trim()) e.nome="Dê um nome para a meta";
    if(T.grupo==="financeira" && (!f.alvoDigits||parseInt(f.alvoDigits)===0)) e.alvo="Informe o valor";
    if(obj && md.length===0) e.medidores="Escolha pelo menos um medidor";
    if(md.includes("quantidade") && itensDoForm(f).length===0) e.alvoQtd="Informe o alvo e toque em Adicionar";
    if(md.includes("etapas") && f.etapas.length===0) e.etapas="Adicione pelo menos uma etapa";
    if(md.includes("calendario") && f.cal_freq==="semana" && !(parseInt(f.cal_vezes)>=1&&parseInt(f.cal_vezes)<=7)) e.cal_vezes="De 1 a 7 vezes";
    if(md.includes("calendario") && f.cal_freq==="periodo"){ const nd=(f.data_inicio&&f.prazo&&f.prazo>=f.data_inicio)?diasEntre(f.data_inicio,f.prazo)+1:0;
      if(!(parseInt(f.cal_vezes)>=1)) e.cal_vezes="Informe quantos dias"; else if(nd&&parseInt(f.cal_vezes)>nd) e.cal_vezes=`O período tem só ${nd} dias`; }
    const pat = f.tipo==="patrimonio";
    if(pat && f.parcPagas!=="" && parseInt(f.parcPagas)>parseInt(f.parcelas)) e.parcPagas="Não pode passar do total de parcelas";
    if(pat && !(parseInt(f.parcelas)>=1 && parseInt(f.parcelas)<=480)) e.parcelas="Informe as parcelas (1 a 480)";
    if(pat && d2float(f.iniDigits)>=d2float(f.alvoDigits) && d2float(f.alvoDigits)>0) e.ini="A entrada deve ser menor que o valor do patrimônio";
    if(pat && !f.data_inicio) e.data_inicio="Informe o vencimento da 1ª parcela";
    if(!T.mensal && !pat && !f.prazo) e.prazo="Defina um prazo";
    if((f.tipo==="acumular"||md.includes("calendario")) && !f.data_inicio) e.data_inicio="Informe o início";
    if(!pat && f.prazo && f.data_inicio && f.prazo<f.data_inicio) e.prazo="O prazo deve ser depois do início";
    if(Object.keys(e).length){ setErroGen(e); return; }
    const ed = formMeta.item;
    const body = { nome:f.nome.trim(), descricao:f.descricao.trim(), grupo:T.grupo, tipo:f.tipo, centro:"pessoal",
      categoria: f.tipo==="limite"&&f.categoria ? f.categoria : null, unidade: pat ? (BENS[f.unidade]?f.unidade:"veiculo") : null,
      parcelas: pat ? parseInt(f.parcelas,10) : null,
      parc_pagas: pat ? Math.min(parseInt(f.parcelas,10)||0, f.parcPagas!=="" ? (parseInt(f.parcPagas,10)||0) : decorridas(f.data_inicio, parseInt(f.parcelas,10)||0)) : null,
      valor_inicial: (f.tipo==="acumular"||pat) ? d2float(f.iniDigits) : 0,
      valor_alvo: T.grupo==="financeira" ? d2float(f.alvoDigits) : 0,
      valor_atual: f.tipo==="valor" ? d2float(f.atualDigits) : 0,
      medidores: obj ? md : null, qtd_itens: md.includes("quantidade") ? itensDoForm(f).map(it=>({...it,id:it.id==="rasc"?uid():it.id})) : null, qtd_per: null, qtd_log: null,
      etapas: md.includes("etapas") ? f.etapas.map(x=>({t:x.t,ok:!!x.ok})) : null,
      cal_freq: md.includes("calendario") ? f.cal_freq : null, cal_vezes: md.includes("calendario")&&(f.cal_freq==="semana"||f.cal_freq==="periodo") ? parseInt(f.cal_vezes,10) : null,
      data_inicio: T.mensal ? null : (f.data_inicio||null), prazo: T.mensal ? null : pat ? addMesesData(f.data_inicio, parseInt(f.parcelas,10)-1) : (f.prazo||null) };
    if (!ed && md.includes("calendario")) body.checkins = [];
    // Já salva como realizada se tudo estiver em 100%
    const prov = progMeta({ ...(ed||{}), ...body, checkins: ed ? ed.checkins : [], criado_em: ed?.criado_em || new Date().toISOString() }, glob);
    if (!T.auto && prov.pct>=1 && !(ed&&ed.concluida_em)) body.concluida_em = hoje();
    const ok = ed ? await tbPatch("metas", ed.id, body)
                  : !!(await tbPost("metas", { ...body, id:uid(), cliente_id:CID, excluido:false, motivo_exclusao:"", concluida_em: body.concluida_em||null, criado_em:new Date().toISOString() }));
    if(ok){ setFormMeta(null); setMetaTab("andamento"); loadGlobal(); showToast(ed?"✓ Meta atualizada":"🎯 Meta criada — bora!"); }
    else showToast("⚠ Não salvou — rode o SQL das metas (sql-metas-colunas.sql e sql-patrimonio.sql)");
  };
  // Atualização rápida no próprio cartão (otimista: muda na tela e grava em seguida)
  const patchMetaLocal = async (m, body, msgFeita) => {
    const novo = { ...m, ...body };
    setMetas(ms => ms.map(x => x.id===m.id ? novo : x));
    const ok = await tbPatch("metas", m.id, body);
    if(!ok){ setMetas(ms => ms.map(x => x.id===m.id ? m : x)); showToast("⚠ Não salvou"); return; }
    const depois = progMeta(novo, glob);
    if(!m.concluida_em && !depois.mensal && !depois.recorr && depois.pct>=1){
      await tbPatch("metas", m.id, { concluida_em: hoje() });
      setMetas(ms => ms.map(x => x.id===m.id ? { ...novo, concluida_em: hoje() } : x));
      showToast("🏆 Meta realizada! Parabéns!");
    } else if (msgFeita) showToast(msgFeita);
  };
  const ajustarQtd = (m, d, id) => {
    const arr = lerJson(m.qtd_itens, []);
    if (Array.isArray(arr) && arr.length) {
      const hj = hoje(), it = arr.find(x=>x.id===id) || arr[0];
      const it2 = (QTD_PER[it.per]&&it.per!=="total")
        ? { ...it, log:{ ...(it.log||{}), [hj]: Math.max(0,(Number(it.log&&it.log[hj])||0)+d) } }
        : { ...it, atual: Math.max(0,(Number(it.atual)||0)+d) };
      const antes = progItemQtd(it,arr).pct, depois = progItemQtd(it2,arr).pct;
      patchMetaLocal(m, { qtd_itens: arr.map(x=>x===it?it2:x) }, antes<1&&depois>=1 ? "✅ Meta batida!" : null);
      return;
    }
    // metas antigas (uma quantidade só, nos campos antigos)
    if (qtdPer(m)==="total") { const v = Math.max(0, (Number(m.valor_atual)||0) + d); patchMetaLocal(m, { valor_atual: v }); return; }
    const l=lerLog(m), hj=hoje(), v=Math.max(0,(Number(l[hj])||0)+d), antes=progMeta(m,glob).pct;
    const novo={...m, qtd_log:{...l,[hj]:v}}, depois=progMeta(novo,glob).pct;
    patchMetaLocal(m, { qtd_log:{...l,[hj]:v} }, antes<1&&depois>=1 ? "✅ Meta do período batida!" : null);
  };
  const alternarDia = (m, d) => { const l=lerCheckins(m), tem=l.includes(d), nova = tem ? l.filter(x=>x!==d) : [...l, d].sort();
    patchMetaLocal(m, { checkins: nova }, tem ? null : (d===hoje() ? `🔥 Dia marcado! ${sequencia([...nova].filter(x=>x<=hoje()))} seguido(s)` : "✓ Dia marcado")); };
  const alternarEtapa = (m, i) => { const e = lerEtapas(m).map((x,k)=> k===i ? { ...x, ok:!x.ok } : x); patchMetaLocal(m, { etapas: e }, e[i].ok ? "✓ Etapa concluída" : null); };
  const concluirMeta = async m => { if(await tbPatch("metas", m.id, { concluida_em: hoje() })){ loadGlobal(); setMetaTab("realizadas"); showToast("🏆 Meta realizada! Parabéns!"); } };
  const reabrirMeta  = async m => { if(await tbPatch("metas", m.id, { concluida_em: null })){ loadGlobal(); setMetaTab("andamento"); showToast("Meta reaberta"); } };

  const confirmarDelGen = async () => {
    if(!motivoExc.trim()){ setMotivoErr(true); return; }
    const ok = await tbPatch("metas", delGen.item.id, { excluido:true, motivo_exclusao:motivoExc.trim() });
    setDelGen(null); setMotivoExc(""); setMotivoErr(false);
    if(ok){ loadGlobal(); showToast("Meta excluída"); }
  };

  const anyModal=showForm||showFormReceita||!!editItem||!!delItem||!!delReceita||!!editReceita||popProg||!!acaoItem||!!acaoReceita||showRend||modalNovo;
  const card={background:"#fff",borderRadius:14,padding:"4px 16px",boxShadow:"0 2px 8px #173C3310",marginBottom:12};
  const rowDiv=last=>({padding:"13px 0",borderBottom:last?"none":"1px solid #F0EEE6",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10});

  const abrirAcao=t=>{abertoEm.current=Date.now();setAcaoItem(t);};
  const abrirAcaoR=r=>{abertoEm.current=Date.now();setAcaoReceita(r);};
  const lpProps=(kind,x)=>({
    onContextMenu:e=>{
      e.preventDefault();clearTimeout(pressTimer.current);
      if(Date.now()-lastTouch.current<1500) return;
      setCtx({x:e.clientX,y:e.clientY,kind,item:x});
    },
    onTouchStart:()=>{lastTouch.current=Date.now();clearTimeout(pressTimer.current);pressTimer.current=setTimeout(()=>(kind==="lanc"?abrirAcao:abrirAcaoR)(x),500);},
    onTouchEnd:()=>clearTimeout(pressTimer.current),
    onTouchMove:()=>clearTimeout(pressTimer.current),
    onTouchCancel:()=>clearTimeout(pressTimer.current),
  });
  const LancRow=({t,last,limpo})=>(
    <div className={`row-item${t.excluido?" row-excluido":""}`}
      style={limpo&&!t.excluido&&!isFechado?{...rowDiv(last),userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"}:rowDiv(last)}
      {...(limpo&&!t.excluido&&!isFechado?lpProps("lanc",t):{})}>
      <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
        <div style={{width:4,height:t.excluido?16:40,background:t.excluido?"#ddd":CAT_CORES[t.categoria]||"#999",borderRadius:3,flexShrink:0}}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,color:t.excluido?"#aaa":"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textDecoration:t.excluido?"line-through":"none"}}>{t.descricao}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"#A39C8A",fontFamily:"'Inter',sans-serif"}}>{fmtDate(t.data)} · {t.categoria} · {t.meio}</span>
            {t.meio==="Pluxe"&&!t.excluido&&<span className="badge" style={{background:"#FBF3E4",color:"#8A6A1F",border:"1px solid #EAD9AE"}}>Pluxe · não conta</span>}
            {t.categoria==="Aplicado"&&!t.excluido&&<span className="badge" style={{background:"#EAF3EF",color:"#235448",border:"1px solid #BFDCD1"}}>Aplicado · não conta</span>}
            {t.meta_id&&!t.excluido&&(()=>{ const mm=metas.find(x=>x.id===t.meta_id); return mm?<span className="badge" style={{background:"#EAF3EF",color:"#235448",border:"1px solid #BFDCD1"}}>{(BENS[mm.unidade]||BENS.outro).icone} {mm.nome}</span>:null; })()}
          </div>
          {t.obs&&!t.excluido&&<div style={{fontSize:11,color:"#A39C8A",marginTop:1,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>{t.obs}</div>}
          {t.excluido&&<span className="badge" style={{background:"#FBECEA",color:"#B4483C",border:"1px solid #EBBDB6"}}>Valor excluído da soma de valores</span>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,fontWeight:800,color:t.excluido?"#bbb":"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(t.valor)}</div>
          {agendada(t,hoje())&&!t.excluido&&<div style={{fontSize:9.5,fontWeight:700,color:"#8A3A30",marginTop:2,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>{t.data>hoje()?"Agendado":"A pagar · venceu"} · {fmtDate(t.data)}</div>}
        </div>
        {!limpo&&!t.excluido&&!isFechado&&agendada(t,hoje())&&(
          <button onClick={()=>provisionar(t)} title="Executar" style={{background:"#EAF3EF",border:"1px solid #BFDCD1",color:"#235448",borderRadius:8,fontSize:10.5,fontWeight:700,padding:"5px 8px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Executar</button>
        )}
        {!limpo&&!t.excluido&&!isFechado&&(
          <button className="icon-btn" onClick={()=>openEdit(t)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
  const ReceitaRow=({r,last})=>(
    <div className="row-item" style={!isFechado?{...rowDiv(last),userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"}:rowDiv(last)} {...(!isFechado?lpProps("rec",r):{})}>
      <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
        <div style={{width:4,height:40,background:"#2E6E5E",borderRadius:3,flexShrink:0}}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,color:"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.descricao}</div>
          <div style={{fontSize:11,color:"#A39C8A",fontFamily:"'Inter',sans-serif",marginTop:2}}>{fmtDate(r.semana)}</div>
          {r.obs&&<div style={{fontSize:11,color:"#A39C8A",marginTop:1,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>{r.obs}</div>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:800,color:"#2E6E5E",fontFamily:"'Inter',sans-serif"}}>{fmt(r.valor)}</div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#F4F2ED",minHeight:"100vh",color:"#173C33",margin:"0 auto"}} className={`app-wrap${view==="relatorio"?" wide":""}`}>
      <style>{CSS}</style>
      <div style={{background:"#fff",borderBottom:"1px solid #E3DFD3",padding:"12px 20px 0",position:"sticky",top:0,zIndex:50,boxShadow:"0 2px 12px #173C3310"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <Logo size={46}/>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:800,color:"#173C33",lineHeight:1.1,fontFamily:"'Fraunces',serif"}}>Lima Patrimonial</div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"#A39C8A",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:600}}>Gestão Financeira Pessoal</span>
              {lastSync && (
                <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#EAF3EF",border:"1px solid #2E6E5E33",borderRadius:16,padding:"2px 8px",fontSize:9,color:"#2E6E5E",fontWeight:700,letterSpacing:"0.04em"}}>
                  <span style={{width:5,height:5,background:"#2E6E5E",borderRadius:"50%"}}/>
                  {loading ? "Sync" : "Online"}
                </span>
              )}
            </div>
          </div>
          <button onClick={()=>setShowAlertas(true)} title="Alertas"
            style={{position:"relative",width:40,height:40,borderRadius:"50%",border:"2px solid #E3DFD3",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#173C33"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            {alertas.length>0&&<span style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,borderRadius:9,padding:"0 4px",background:nivelAlerta>=2?"#B4483C":"#A6822E",color:"#fff",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>{alertas.length}</span>}
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,paddingBottom:6,position:"relative"}}>
          <button className="arrow-btn" disabled={mesIdx===0} onClick={()=>goMes(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{position:"relative"}}>
            <button className="mes-btn" onClick={()=>setShowPicker(o=>!o)}>
              {mesAtual.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2E6E5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showPicker&&<MonthPicker mesAtual={mesAtual.mes} onSelect={k=>{const i=MESES.findIndex(m=>m.mes===k);if(i>=0)setMesIdx(i);}} onClose={()=>setShowPicker(false)}/>}
          </div>
          <button className="arrow-btn" disabled={mesIdx===MESES.length-1} onClick={()=>goMes(1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <div style={{position:"absolute",right:0,display:"flex",gap:4}}>
            {isFechado&&<span className="badge" style={{background:"#F2F1EC",color:"#7A7466",border:"1px solid #E3DFD3"}}>Fechado</span>}
            {!isFechado&&items.length>0&&<span className="badge" style={{background:"#FBF3E4",color:"#A6822E",border:"1px solid #EAD9AE"}}>Parcial</span>}
          </div>
        </div>
        <nav className="navtabs" style={{display:"flex",marginTop:2,overflowX:"auto"}}>
          {[["caixa","Caixa"],["inicio","Despesa"],["aplicado","Aplicado"],["categorias","Categorias"],["metas","Metas"],["historico","Histórico"],["relatorio","Relatório"]].map(([v,l])=>(
            <button key={v} className="tab" onClick={()=>setView(v)}
              style={{flex:"1 0 auto",whiteSpace:"nowrap",background:"none",border:"none",borderBottom:view===v?"2.5px solid #2E6E5E":"2.5px solid transparent",color:view===v?"#2E6E5E":"#A39C8A",padding:"10px 5px",fontSize:10,letterSpacing:"0.02em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:800,transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </nav>
      </div>

      <div style={{padding:"20px 16px 120px"}}>
        {(()=>{ const hs=alertas.filter(x=>x.hoje); if(!hs.length) return null;
          const n=hs.reduce((t,a)=>t+a.qtd,0), tot=hs.reduce((t,a)=>t+a.total,0);
          return (
          <div role="button" onClick={()=>setShowAlertas(true)} style={{display:"flex",alignItems:"center",gap:10,background:"#FBECEA",border:"1.5px solid #B4483C",borderRadius:12,padding:"11px 14px",marginBottom:14,cursor:"pointer"}}>
            <span style={{fontSize:18}}>⏰</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:"#8A3A30"}}>{n} conta{n>1?"s":""} para pagar hoje · {fmt(tot)}</div>
              {hs.map((a,i)=>(
                <div key={i} style={{fontSize:11,color:"#8A3A30",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.motivo}</div>
              ))}
            </div>
            <span style={{color:"#8A3A30",fontSize:16}}>›</span>
          </div>
        );})()}
        {view==="inicio"&&(
          <>
            <div style={{background:"#fff",borderRadius:16,padding:"24px 20px",marginBottom:14,boxShadow:"0 2px 12px #173C3310"}}>
              <div style={{display:"grid",gridTemplateColumns:"7fr 3fr",gap:14,alignItems:"start"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:11,letterSpacing:"0.15em",color:"#A39C8A",textTransform:"uppercase",marginBottom:4,fontWeight:700}}>Total lançado — {mesAtual.label}</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
                    <div style={{fontSize:fmt(total).length<=11?40:fmt(total).length<=13?34:28,fontWeight:800,color:"#173C33",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(total)}</div>
                    {mesAnt&&totalAnt>0&&<Comparativo atual={total} anterior={totalAnt} isParcial={!isFechado}/>}
                  </div>
                  <div style={{fontSize:12,color:"#A39C8A",marginTop:8,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600}}>{contaveis.length} lançamentos ativos</div>
                </div>
                <div role="button" onClick={()=>setPopProg(true)} style={{minWidth:0,borderLeft:"1px solid #F0EEE6",paddingLeft:12,cursor:"pointer"}}>
                  <div style={{fontSize:9,letterSpacing:"0.1em",color:"#A39C8A",textTransform:"uppercase",marginBottom:6,fontWeight:700,lineHeight:1.3}}>Gastos programados ›</div>
                  <div style={{fontSize:fmt(totalAgendado).length<=11?16:13,fontWeight:800,color:"#8A6A1F",lineHeight:1.1,fontFamily:"'Fraunces',serif"}}>{fmt(totalAgendado)}</div>
                  <div style={{fontSize:9.5,color:"#A39C8A",marginTop:6,fontWeight:600,lineHeight:1.35,fontFamily:"'Inter',sans-serif"}}>
                    {agendados.length>0?`${agendados.length} a executar · já executado fica em Total lançado`:"nada a executar"}
                  </div>
                </div>
              </div>
            </div>
            <div style={{fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontWeight:700}}>Despesas por Categoria</div>
            <div style={card}>
              {byCat.length===0
                ?<div style={{padding:"24px 0",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhum lançamento ainda.</div></div>
                :byCat.map(({cat,val},i)=>(
                  <div key={cat} style={{padding:"12px 0",borderBottom:i===byCat.length-1?"none":"1px solid #F0EEE6"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:CAT_CORES[cat]||"#999",flexShrink:0}}/>
                        <span style={{fontSize:14,color:"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{cat}</span>
                      </div>
                      <span style={{fontSize:14,fontWeight:800,color:"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(val)}</span>
                    </div>
                    <Bar percent={total>0?(val/total)*100:0} color={CAT_CORES[cat]||"#999"}/>
                    <div style={{fontSize:10,color:"#A39C8A",marginTop:4,fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                      {total>0?((val/total)*100).toFixed(1):0}% do total · {contaveis.filter(t=>t.categoria===cat).length} lançamentos
                    </div>
                  </div>
                ))
              }
            </div>
          </>
        )}
        {view==="caixa"&&(
          <>
            <div style={{background:"#fff",borderRadius:16,padding:"20px",marginBottom:14,boxShadow:"0 2px 12px #173C3310"}}>
              <div style={{fontSize:11,letterSpacing:"0.15em",color:"#A39C8A",textTransform:"uppercase",marginBottom:12,fontWeight:700}}>Fluxo de Caixa — {mesAtual.label}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <div style={{background:"#EAF3EF",borderRadius:12,padding:"14px",border:"1px solid #BFDCD1"}}>
                  <div style={{fontSize:9,letterSpacing:"0.15em",color:"#235448",textTransform:"uppercase",fontWeight:800,marginBottom:4}}>Receita</div>
                  <div style={{fontSize:22,fontWeight:800,color:"#235448",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(totalReceita)}</div>
                  <div style={{fontSize:10,color:"#7A7466",marginTop:4,fontWeight:600}}>{receitas.length} entrada(s)</div>
                </div>
                <div style={{background:"#FBECEA",borderRadius:12,padding:"14px",border:"1px solid #EBBDB6"}}>
                  <div style={{fontSize:9,letterSpacing:"0.15em",color:"#8A3A30",textTransform:"uppercase",fontWeight:800,marginBottom:4}}>Despesa</div>
                  <div style={{fontSize:22,fontWeight:800,color:"#8A3A30",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(total)}</div>
                  <div style={{fontSize:10,color:"#7A7466",marginTop:4,fontWeight:600}}>{contaveis.length} saída(s)</div>
                </div>
              </div>
              <div style={{background:saldo>=0?"#EAF3EF":"#FBF3E4",borderRadius:12,padding:"16px 18px",border:`2px solid ${saldo>=0?"#2E6E5E":"#A6822E"}`}}>
                <div style={{fontSize:10,letterSpacing:"0.15em",color:saldo>=0?"#2E6E5E":"#8A6A1F",textTransform:"uppercase",fontWeight:800,marginBottom:4}}>Saldo do Mês</div>
                <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                  <div style={{fontSize:28,fontWeight:800,color:saldo>=0?"#2E6E5E":"#8A6A1F",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(saldo)}</div>
                  <div style={{fontSize:11,color:"#7A7466",fontWeight:700}}>{saldo>=0?"positivo":"negativo"}</div>
                </div>
              </div>
            </div>
            <div role="button" onClick={()=>setFluxoAberto(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontWeight:700,cursor:"pointer",userSelect:"none"}}>
              <span>Fluxo Semanal</span>
              <span style={{display:"inline-block",transform:fluxoAberto?"rotate(90deg)":"none",transition:"transform .15s",fontSize:9}}>▶</span>
            </div>
            {fluxoAberto&&<div style={{...card,padding:"8px 4px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr 1fr",gap:6,padding:"8px 10px",borderBottom:"1px solid #F0EEE6"}}>
                <div style={{fontSize:9,color:"#7A7466",fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase"}}>Semana</div>
                <div style={{fontSize:9,color:"#235448",fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",textAlign:"right"}}>Receita</div>
                <div style={{fontSize:9,color:"#8A3A30",fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",textAlign:"right"}}>Despesa</div>
                <div style={{fontSize:9,color:"#173C33",fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",textAlign:"right"}}>Saldo</div>
              </div>
              {fluxoSemanal.map((sem,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr 1fr",gap:6,padding:"10px 10px",borderBottom:i===fluxoSemanal.length-1?"none":"1px solid #FAF9F6",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,color:"#173C33",fontWeight:800}}>{sem.label}</div>
                    <div style={{fontSize:10,color:"#A39C8A",fontWeight:600,marginTop:1}}>dia {sem.ini}–{sem.fim}</div>
                  </div>
                  <div style={{fontSize:12,color:sem.receita>0?"#235448":"#E3DFD3",fontWeight:800,textAlign:"right"}}>{fmt(sem.receita)}</div>
                  <div style={{fontSize:12,color:sem.despesa>0?"#8A3A30":"#E3DFD3",fontWeight:800,textAlign:"right"}}>{fmt(sem.despesa)}</div>
                  <div style={{fontSize:12,color:sem.saldo===0?"#E3DFD3":(sem.saldo>0?"#173C33":"#A6822E"),fontWeight:900,textAlign:"right"}}>{fmt(sem.saldo)}</div>
                </div>
              ))}
            </div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:20,marginBottom:10}}>
              <div role="button" onClick={()=>setRecAberto(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:700,cursor:"pointer",userSelect:"none"}}>
                <span>Recebimentos do Mês</span>
                <span style={{display:"inline-block",transform:recAberto?"rotate(90deg)":"none",transition:"transform .15s",fontSize:9}}>▶</span>
              </div>
              <div style={{fontSize:11,color:"#A39C8A",fontWeight:700}}>{receitas.length} entrada(s)</div>
            </div>
            {recAberto&&<div style={card}>
              {sortedReceitas.length===0
                ?<div style={{padding:"24px 0",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:8}}>💰</div>
                  <div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhum recebimento neste mês.</div>
                  {!isFechado&&<div style={{color:"#A39C8A",fontSize:12,marginTop:4,fontFamily:"'Inter',sans-serif"}}>Toque em "Nova Receita" abaixo</div>}
                </div>
                :sortedReceitas.map((r,i)=><ReceitaRow key={r.id} r={r} last={i===sortedReceitas.length-1}/>)
              }
            </div>}
          </>
        )}
        {view==="aplicado"&&(
          <>
            <div style={{background:"linear-gradient(135deg,#173C33,#2E6E5E)",borderRadius:16,padding:"26px 22px",marginBottom:14,boxShadow:"0 4px 20px #173C3325"}}>
              <div style={{fontSize:11,letterSpacing:"0.15em",color:"#C9A566",textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Montante Aplicado</div>
              <div style={{fontSize:36,fontWeight:800,color:"#F4F2ED",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(totalAplicadoGeral)}</div>
              <div style={{fontSize:11,color:"#C9A566",marginTop:8,fontWeight:600}}>{carteira.nAp} aporte{carteira.nAp===1?"":"s"} · {carteira.nRe} rendimento{carteira.nRe===1?"":"s"}</div>
              <div style={{background:"#FFFFFF14",borderRadius:10,padding:"10px 12px",marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <span style={{fontSize:9,letterSpacing:"0.1em",color:"#C9A566",textTransform:"uppercase",fontWeight:700}}>Seu dinheiro</span>
                <span style={{fontSize:15,color:"#F4F2ED",fontWeight:800,fontFamily:"'Inter',sans-serif"}}>{fmt(carteira.aportes)}</span>
              </div>
              <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid #FFFFFF22"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div style={{fontSize:10,letterSpacing:"0.12em",color:"#C9A566",textTransform:"uppercase",fontWeight:700}}>Rentabilidade da carteira</div>
                  <button onClick={()=>setRendAberto(v=>!v)} style={{background:"transparent",border:"1px solid #C9A56688",color:"#C9A566",borderRadius:8,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"5px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{rendAberto?"Minimizar":"Expandir"}</button>
                </div>
                {carteira.temRend
                  ?<>
                    <div style={{fontSize:28,color:"#F4F2ED",fontWeight:800,marginTop:4,fontFamily:"'Fraunces',serif",lineHeight:1.1}}>{carteira.aa.toFixed(2).replace(".",",")}% <span style={{fontSize:13,color:"#C9A566",fontFamily:"'Inter',sans-serif",fontWeight:700}}>ao ano</span></div>
                    <div style={{fontSize:11,color:"#C9A566",marginTop:4,fontWeight:600}}>acumulado {carteira.acum>=0?"+":""}{carteira.acum.toFixed(2).replace(".",",")}% em {(Math.round(carteira.n*10)/10).toString().replace(".",",")} {Math.round(carteira.n*10)/10===1?"mês":"meses"} · desde {MES_AB[parseInt(carteira.desde.slice(5),10)-1]}/{carteira.desde.slice(2,4)}</div>
                    <div style={{fontSize:11,color:"#F4F2ED",marginTop:3,fontWeight:600}}>Rendeu sozinho + {fmt(carteira.rend)} <span style={{color:"#C9A566",fontWeight:500}}>(já incluso no total)</span></div>
                  </>
                  :<div style={{fontSize:12,color:"#F4F2ED",marginTop:6,fontWeight:600,lineHeight:1.4}}>Registre o rendimento para acompanhar quanto a carteira cresce sozinha.</div>}
                {rendAberto&&(
                  <div style={{marginTop:12,borderTop:"1px solid #FFFFFF22",paddingTop:6}}>
                    <div style={{fontSize:9,letterSpacing:"0.1em",color:"#C9A566",textTransform:"uppercase",fontWeight:700,margin:"4px 0 2px"}}>Rendimentos cadastrados</div>
                    {aplicadoOrd.filter(isRend).length===0
                      ?<div style={{fontSize:12,color:"#F4F2ED",padding:"8px 0",fontWeight:600}}>Nenhum rendimento cadastrado.</div>
                      :aplicadoOrd.filter(isRend).map((t,i,arr)=>(
                        <div key={t.id} className="row-item" {...(!isFechado?lpProps("lanc",t):{})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<arr.length-1?"1px solid #FFFFFF18":"none",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:12,color:"#F4F2ED",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{fmtDate(t.data)} · {MESES_NOMES_FULL[parseInt(t.mes.slice(5,7),10)-1]}</div>
                            {t.obs&&<div style={{fontSize:10,color:"#C9A566",marginTop:2,fontWeight:600}}>{t.obs}</div>}
                          </div>
                          <div style={{fontSize:13,color:"#F4F2ED",fontWeight:800,fontFamily:"'Inter',sans-serif",flexShrink:0}}>+ {fmt(t.valor)}</div>
                        </div>
                      ))}
                    {!isFechado&&<button onClick={()=>{setFormRend(novoFormRend());setErroRend(null);setShowRend(true);}} style={{marginTop:10,background:"transparent",border:"1px solid #C9A56688",color:"#C9A566",borderRadius:8,fontSize:11,fontWeight:700,padding:"7px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Registrar rendimento</button>}
                    {aplicadoOrd.some(isRend)&&!isFechado&&<div style={{fontSize:9.5,color:"#C9A56699",marginTop:8}}>Clique com o botão direito (ou segure) num rendimento para editar ou excluir.</div>}
                  </div>
                )}
              </div>
            </div>
            <div role="button" onClick={()=>setEvoAberto(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontWeight:700,cursor:"pointer",userSelect:"none"}}>
              <span>Evolução da carteira</span>
              <span style={{display:"inline-block",transform:evoAberto?"rotate(90deg)":"none",transition:"transform .15s",fontSize:9}}>▶</span>
            </div>
            {evoAberto&&<div style={{...card,padding:"12px 16px 14px"}}>
              {carteira.anos.map(a=>(
                <div key={a.y} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"8px 0",borderBottom:"1px solid #F0EEE6",fontFamily:"'Inter',sans-serif"}}>
                  <span style={{fontSize:13,fontWeight:800,color:"#173C33"}}>{a.y}</span>
                  <span style={{fontSize:11,color:"#7A7466",fontWeight:600}}>aportado {fmt(a.a)} · rendeu <b style={{color:"#235448"}}>+ {fmt(a.r)}</b>{a.pct!=null?<b style={{color:"#8A6A1F"}}> · {a.pct.toFixed(2).replace(".",",")}% no ano</b>:null}</span>
                </div>
              ))}
              {(()=>{const mx=Math.max(1,...carteira.evo.map(x=>x.tot)); return carteira.evo.map(x=>(
                <div key={x.k} style={{padding:"10px 0 4px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontFamily:"'Inter',sans-serif",marginBottom:5}}>
                    <span style={{fontWeight:700,color:"#173C33"}}>{MES_AB[parseInt(x.k.slice(5),10)-1]}/{x.k.slice(2,4)}</span>
                    <span style={{fontWeight:800,color:"#173C33"}}>{fmt(x.tot)}</span>
                  </div>
                  <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",background:"#E9E5D8",width:`${(x.tot/mx)*100}%`,minWidth:4}}>
                    <div style={{flex:x.ca,background:"#2E6E5E"}}/>
                    <div style={{flex:Math.max(x.cr,0),background:"#C9A566"}}/>
                  </div>
                  <div style={{fontSize:10,color:"#A39C8A",marginTop:3,fontWeight:600,fontFamily:"'Inter',sans-serif"}}>aportes {fmt(x.ca)} · rendimento acumulado {fmt(x.cr)}</div>
                </div>
              ));})()}
              <div style={{display:"flex",gap:14,marginTop:10,fontSize:10,color:"#7A7466",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>
                <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"#2E6E5E",marginRight:5}}/>seu dinheiro</span>
                <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:"#C9A566",marginRight:5}}/>rendeu sozinho</span>
              </div>
            </div>}
            <div role="button" onClick={()=>setExtAberto(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontWeight:700,cursor:"pointer",userSelect:"none"}}>
              <span>Extrato de Aplicações</span>
              <span style={{display:"inline-block",transform:extAberto?"rotate(90deg)":"none",transition:"transform .15s",fontSize:9}}>▶</span>
            </div>
            {extAberto&&<div style={card}>
              {aplicadoOrd.length===0
                ?<div style={{padding:"24px 0",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🌱</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhuma aplicação registrada ainda.</div><div style={{color:"#A39C8A",fontSize:12,marginTop:4,fontFamily:"'Inter',sans-serif"}}>Lance uma despesa com categoria "Aplicado" pra começar a somar aqui.</div></div>
                :aplicadoOrd.map((t,i)=>(
                  <div key={t.id} className="row-item" style={!isFechado?{...rowDiv(i===aplicadoOrd.length-1),userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"}:rowDiv(i===aplicadoOrd.length-1)} {...(!isFechado?lpProps("lanc",t):{})}>
                    <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
                      <div style={{width:4,height:40,background:"#2E6E5E",borderRadius:3,flexShrink:0}}/>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14,color:"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.descricao}</div>
                        <div style={{fontSize:11,color:"#A39C8A",fontFamily:"'Inter',sans-serif",marginTop:2}}>{fmtDate(t.data)} · {MESES_NOMES_FULL[parseInt(t.mes.slice(5,7),10)-1]} {t.mes.slice(0,4)}{isInc(t)?" · já incluso no montante":""}</div>
                        {t.obs&&<div style={{fontSize:11,color:"#A39C8A",marginTop:1,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>{t.obs}</div>}
                      </div>
                    </div>
                    <div style={{fontSize:15,fontWeight:800,color:"#2E6E5E",fontFamily:"'Inter',sans-serif",flexShrink:0}}>{fmt(t.valor)}</div>
                  </div>
                ))
              }
            </div>}
          </>
        )}
        {view==="categorias"&&(
          <>
            <div style={{fontSize:22,fontWeight:800,color:"#173C33",marginBottom:18,fontFamily:"'Fraunces',serif"}}>Por Categoria</div>
            {byCat.length===0
              ?<div style={{...card,padding:24,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📂</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhum lançamento neste mês.</div></div>
              :byCat.map(({cat,val})=>{
                const aberta=catAberta===cat;
                const lancs=aberta?contaveis.filter(t=>t.categoria===cat).sort((a,b)=>new Date(b.data)-new Date(a.data)):[];
                return (
                <div key={cat} style={{...card,marginBottom:10}}>
                  <div style={{padding:"12px 0",cursor:"pointer"}} onClick={()=>setCatAberta(aberta?null:cat)}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:CAT_CORES[cat]||"#999",flexShrink:0}}/>
                        <span style={{fontSize:14,color:"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{cat}</span>
                        <span style={{fontSize:11,color:"#A39C8A",display:"inline-block",transform:aberta?"rotate(90deg)":"none",transition:"transform .15s"}}>▶</span>
                      </div>
                      <span style={{fontSize:14,fontWeight:800,color:"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(val)}</span>
                    </div>
                    <Bar percent={total>0?(val/total)*100:0} color={CAT_CORES[cat]||"#999"}/>
                  </div>
                  {aberta&&(
                    <div style={{borderTop:"1px solid #F0EEE6"}}>
                      <div style={{fontSize:11,color:"#A39C8A",padding:"8px 0 0",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>{lancs.length} lançamento{lancs.length===1?"":"s"}</div>
                      {lancs.map((t,i)=><LancRow key={t.id} t={t} last={i===lancs.length-1} limpo/>)}
                    </div>
                  )}
                </div>
                );
              })
            }
          </>
        )}
        {view==="metas"&&(()=>{
          const todas = metas.map(m=>({m,p:progMeta(m,glob)}));
          const andamento = todas.filter(x=>!x.p.realizada).sort((a,b)=>b.p.status.nivel-a.p.status.nivel||b.p.pct-a.p.pct);
          const realizadas = todas.filter(x=>x.p.realizada).sort((a,b)=>String(b.m.concluida_em||"").localeCompare(String(a.m.concluida_em||"")));
          const medalhas = todas.reduce((s,x)=>s+MARCOS.filter(([v])=>x.p.tipo!=="limite"&&x.p.pct>=v).length,0);
          const media = andamento.filter(x=>x.p.tipo!=="limite").length ? andamento.filter(x=>x.p.tipo!=="limite").reduce((s,x)=>s+Math.min(1,x.p.pct),0)/andamento.filter(x=>x.p.tipo!=="limite").length : 0;
          const abas = [["andamento",`Em andamento (${andamento.length})`],["realizadas",`Realizadas (${realizadas.length})`],["nova","+ Nova meta"]];
          return (<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
              <div style={{fontSize:22,fontWeight:800,color:"#173C33"}}>Metas</div>
            </div>
            <div style={{display:"flex",gap:4,background:"#fff",borderRadius:12,padding:4,boxShadow:"0 2px 8px #173C3310",marginBottom:14}}>
              {abas.map(([k,l])=>(
                <button key={k} onClick={()=>{ if(k==="nova"&&metaTab!=="nova"){ setFormMeta(null); setErroGen({}); } setMetaTab(k); }}
                  style={{flex:1,border:"none",borderRadius:9,padding:"10px 4px",fontSize:12.5,fontWeight:800,fontFamily:"'Inter',sans-serif",cursor:"pointer",whiteSpace:"nowrap",
                    background:metaTab===k?(k==="nova"?"#2E6E5E":"#173C33"):"transparent",color:metaTab===k?"#fff":k==="nova"?"#2E6E5E":"#A39C8A"}}>{l}</button>
              ))}
            </div>

            {metaTab==="andamento"&&<>
              {todas.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}}>
                  {[["🎯",andamento.length,"em andamento"],["🏆",realizadas.length,"realizadas"],["🏅",medalhas,"medalhas"]].map(([ic,n,l])=>(
                    <div key={l} style={{background:"#fff",borderRadius:14,padding:"10px 8px",textAlign:"center",boxShadow:"0 2px 8px #173C3310"}}>
                      <div style={{fontSize:18}}>{ic}</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#173C33",lineHeight:1.1}}>{n}</div>
                      <div style={{fontSize:9.5,color:"#A39C8A",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
              {andamento.length>0&&media>0&&(
                <div style={{background:"#fff",borderRadius:14,padding:"10px 14px",boxShadow:"0 2px 8px #173C3310",marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:800,color:"#173C33",marginBottom:6}}><span>Progresso geral</span><span>{Math.round(media*100)}%</span></div>
                  <Bar percent={media*100} color="#2E6E5E"/>
                </div>
              )}
              {andamento.length===0
                ?<div style={{...card,padding:24,textAlign:"center"}}>
                  <div style={{fontSize:34,marginBottom:8}}>🎯</div>
                  <div style={{color:"#173C33",fontSize:14,fontWeight:800}}>Nenhuma meta em andamento</div>
                  <div style={{color:"#A39C8A",fontSize:12,marginTop:4,marginBottom:14}}>Crie uma meta financeira ou objetiva e acompanhe o avanço aqui.</div>
                  <button onClick={()=>{setFormMeta(null);setMetaTab("nova");}} style={{background:"#2E6E5E",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Nova meta</button>
                </div>
                :<div className="metas-grid">{andamento.map(({m,p})=><CardMeta key={m.id} m={m} p={p} onClick={()=>setAcaoGen({kind:"meta",item:m})} onQtd={ajustarQtd} onEtapa={alternarEtapa} onDia={alternarDia}/>)}</div>}
            </>}

            {metaTab==="realizadas"&&(realizadas.length===0
              ?<div style={{...card,padding:24,textAlign:"center"}}>
                <div style={{fontSize:34,marginBottom:8}}>🏆</div>
                <div style={{color:"#173C33",fontSize:14,fontWeight:800}}>Nenhuma meta realizada ainda</div>
                <div style={{color:"#A39C8A",fontSize:12,marginTop:4}}>Quando uma meta chega a 100%, ela vem para cá com o troféu.</div>
              </div>
              :realizadas.map(({m,p})=><CardRealizada key={m.id} m={m} p={p} onClick={()=>setAcaoGen({kind:"meta",item:m})}/>))}

            {metaTab==="nova"&&(!formMeta
              ? <>
                  <div style={{fontSize:11,color:"#A39C8A",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:800,marginBottom:10}}>1. Tipo de meta</div>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:10}}>
                    {Object.entries(GRUPOS_META).map(([k,g])=>(
                      <button key={k} onClick={()=>novaMeta(k)} style={{background:"#fff",border:"2px solid #F0EEE6",borderRadius:16,padding:"18px 14px",textAlign:"left",cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 2px 8px #173C3310"}}>
                        <div style={{fontSize:30,marginBottom:8}}>{g.icone}</div>
                        <div style={{fontSize:16,fontWeight:800,color:"#173C33"}}>{g.nome}</div>
                        <div style={{fontSize:11.5,color:"#A39C8A",fontWeight:600,marginTop:4,lineHeight:1.4}}>{g.desc}</div>
                      </button>
                    ))}
                  </div>
                </>
              : (()=>{
                const f=formMeta.f, T=TIPOS_META[f.tipo], ed=formMeta.item;
                const up=(k,v)=>{ setFormMeta(x=>({...x,f:{...x.f,[k]:v}})); setErroGen(e=>({...e,[k.replace("Digits","")]:null,[k]:null})); };
                const addEtapa=()=>{ const t=f.novaEtapa.trim(); if(!t) return; setFormMeta(x=>({...x,f:{...x.f,etapas:[...x.f.etapas,{t,ok:false}],novaEtapa:""}})); setErroGen(e=>({...e,etapas:null})); };
                const tiposDoGrupo = Object.entries(TIPOS_META).filter(([,t])=>t.grupo==="financeira");
                const obj = f.tipo==="objetiva", md = obj ? f.medidores : [], pat = f.tipo==="patrimonio", bem = BENS[f.unidade]?f.unidade:"veiculo";
                const alternarMedidor = k => { setFormMeta(x=>{ const l=x.f.medidores; return {...x,f:{...x.f,medidores: l.includes(k)?l.filter(y=>y!==k):[...l,k]}}; }); setErroGen(e=>({...e,medidores:null})); };
                const previa = (()=>{ const mt={ id:ed?ed.id:"previa", parcelas:parseInt(f.parcelas)||0, parc_pagas: f.parcPagas!=="" ? (parseInt(f.parcPagas)||0) : decorridas(f.data_inicio, parseInt(f.parcelas)||0), nome:f.nome||"Nome da meta", tipo:f.tipo, centro:"pessoal", categoria:f.categoria||null, unidade:f.tipo==="patrimonio"?bem:f.unidade, medidores:md,
                  valor_inicial:d2float(f.iniDigits), valor_alvo: T.grupo==="financeira"?d2float(f.alvoDigits):0,
                  valor_atual: f.tipo==="valor"?d2float(f.atualDigits):0, qtd_itens: md.includes("quantidade") ? itensDoForm(f) : null, etapas:f.etapas, checkins: ed ? ed.checkins : [],
                  cal_freq:f.cal_freq, cal_vezes:parseInt(f.cal_vezes)||1, data_inicio:f.data_inicio, prazo:f.tipo==="patrimonio"&&parseInt(f.parcelas)>0&&f.data_inicio?addMesesData(f.data_inicio,parseInt(f.parcelas)-1):f.prazo, criado_em:hoje() };
                  return { mt, p: progMeta(mt, glob) }; })();
                const diasCal = f.prazo&&f.data_inicio&&f.prazo>=f.data_inicio ? alvoCalendario({data_inicio:f.data_inicio,prazo:f.prazo,cal_freq:f.cal_freq,cal_vezes:parseInt(f.cal_vezes)||1}) : 0;
                const Sec=({n,t})=><div style={{fontSize:11,color:"#A39C8A",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:800,margin:"18px 0 10px"}}>{n}. {t}</div>;
                return (
                  <div className="meta-form">
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <div style={{fontSize:18,fontWeight:800,color:"#173C33"}}>{ed?"Editar meta":`Nova meta ${GRUPOS_META[f.grupo].nome.toLowerCase()}`} {GRUPOS_META[f.grupo].icone}</div>
                        {!ed&&<button onClick={()=>setFormMeta(null)} style={{background:"none",border:"none",color:"#2E6E5E",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>trocar tipo</button>}
                      </div>
                      <Sec n={1} t={obj?"Como medir · pode escolher mais de um":"O que medir"}/>
                      {obj
                        ?<>
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {Object.entries(MEDIDORES).map(([k,M])=>{ const on=md.includes(k); return (
                              <button key={k} onClick={()=>alternarMedidor(k)} style={{display:"flex",alignItems:"center",gap:12,textAlign:"left",background:on?"#173C33":"#fff",color:on?"#fff":"#173C33",border:`2px solid ${on?"#173C33":"#F0EEE6"}`,borderRadius:12,padding:"10px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                                <span style={{width:22,height:22,borderRadius:6,border:`2px solid ${on?"#fff":"#CCCCCC"}`,background:on?"#2E6E5E":"#fff",color:"#fff",fontSize:13,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on?"✓":""}</span>
                                <span style={{flex:1}}>
                                  <span style={{display:"block",fontSize:13.5,fontWeight:800}}>{M.icone} {M.nome}</span>
                                  <span style={{display:"block",fontSize:11,fontWeight:600,opacity:0.75,marginTop:2}}>{M.desc}</span>
                                </span>
                              </button>
                            );})}
                          </div>
                          <ErrTxt msg={erroGen.medidores}/>
                          {md.length>1&&<div style={{fontSize:11.5,color:"#7A7466",fontWeight:600,marginTop:8}}>O progresso geral é a média dos {md.length} medidores.</div>}
                        </>
                        :<>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
                            {tiposDoGrupo.map(([k,t])=>(
                              <button key={k} onClick={()=>up("tipo",k)} style={{textAlign:"left",background:f.tipo===k?"#173C33":"#fff",color:f.tipo===k?"#fff":"#173C33",border:`2px solid ${f.tipo===k?"#173C33":"#F0EEE6"}`,borderRadius:12,padding:"10px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                                <div style={{fontSize:13,fontWeight:800}}>{t.icone} {t.nome}</div>
                              </button>
                            ))}
                          </div>
                          <div style={{fontSize:11.5,color:"#7A7466",fontWeight:600,marginTop:8,lineHeight:1.45}}>{T.desc}{T.auto?" Calculada sozinha pelos lançamentos.":""}</div>
                        </>}

                      <Sec n={2} t="Identificação"/>
                      <div style={{marginBottom:14}}>
                        <label style={FL}>Nome da meta *</label>
                        <input style={INP(erroGen.nome)} value={f.nome} onChange={e=>up("nome",e.target.value)}
                          placeholder={{patrimonio:"Ex: Quitar o financiamento do carro",faturamento:"Ex: Receita de R$ 15 mil no mês",acumular:"Ex: Sobrar R$ 2 mil por mês",aplicado:"Ex: Chegar a R$ 50 mil aplicados",limite:"Ex: Restaurantes até R$ 800",valor:"Ex: Juntar para a viagem",objetiva:"Ex: Ler 20 minutos por dia"}[f.tipo]}/>
                        <ErrTxt msg={erroGen.nome}/>
                      </div>

                      <Sec n={3} t={obj?"Detalhes de cada medidor":"Alvo"}/>
                      {obj&&md.length===0&&<div style={{fontSize:12,color:"#A39C8A",fontWeight:600,marginBottom:14}}>Escolha um medidor no passo 1.</div>}
                      {f.tipo==="limite"&&(
                        <div style={{marginBottom:14}}>
                          <label style={FL}>Categoria</label>
                          <select style={INP(false)} value={f.categoria} onChange={e=>up("categoria",e.target.value)}>
                            <option value="">Todas as despesas</option>
                            {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      {pat&&(
                        <div style={{marginBottom:14}}>
                          <label style={FL}>O que vai quitar</label>
                          <Chips opcoes={Object.entries(BENS).map(([k,b])=>[k,`${b.icone} ${b.nome}`])} valor={bem} onChange={v=>up("unidade",v)}/>
                        </div>
                      )}
                      {T.grupo==="financeira"&&<CampoValor label={pat?"Valor do patrimônio *":f.tipo==="faturamento"?"Receita desejada no mês *":f.tipo==="limite"?"Limite de gasto no mês *":"Valor-alvo *"} digits={f.alvoDigits} onChange={v=>up("alvoDigits",v)} err={erroGen.alvo}/>}
                      {(f.tipo==="acumular"||pat)&&<CampoValor label={pat?"Entrada / já quitado (opcional)":"Já guardado antes do início"} digits={f.iniDigits} onChange={v=>up("iniDigits",v)} err={erroGen.ini}/>}
                      {pat&&(
                        <div style={{marginBottom:14}}>
                          <label style={FL}>Quantidade de parcelas *</label>
                          <input inputMode="numeric" style={{...INP(erroGen.parcelas),width:"50%"}} placeholder="48" value={f.parcelas} onChange={e=>up("parcelas",e.target.value.replace(/\D/g,"").slice(0,3))}/>
                          <ErrTxt msg={erroGen.parcelas}/>
                          {parseInt(f.parcelas)>0&&d2float(f.alvoDigits)>d2float(f.iniDigits)&&<div style={{fontSize:11.5,color:"#235448",fontWeight:700,background:"#EAF3EF",borderRadius:10,padding:"9px 12px",marginTop:8}}>
                            Parcela estimada: {fmt((d2float(f.alvoDigits)-d2float(f.iniDigits))/parseInt(f.parcelas))} (sem juros). Ao lançar cada parcela como despesa, vincule à meta.
                          </div>}
                        </div>
                      )}
                      {f.tipo==="valor"&&<CampoValor label="Quanto já tem hoje" digits={f.atualDigits} onChange={v=>up("atualDigits",v)} cor="#235448"/>}
                      {md.includes("quantidade")&&<div style={{fontSize:12.5,fontWeight:800,color:"#173C33",marginBottom:8}}>🔢 Quantidade · uma ou mais atividades</div>}
                      {md.includes("quantidade")&&(()=>{
                        const q=f.qi, upQi=(k,v)=>{ setFormMeta(x=>({...x,f:{...x.f,qi:{...x.f.qi,[k]:v}}})); setErroGen(e=>({...e,alvoQtd:null,medidores:null})); };
                        const addQi=()=>{ if(!(parseInt(q.alvo)>0)){ setErroGen(e=>({...e,alvoQtd:"Informe o alvo antes de adicionar"})); return; }
                          setFormMeta(x=>({...x,f:{...x.f,qtdItens:[...x.f.qtdItens,{id:uid(),nome:q.nome.trim(),alvo:parseInt(q.alvo),atual:q.per==="total"?(parseInt(q.atual)||0):0,unidade:q.unidade.trim(),per:q.per,fonte:q.per==="total"?q.fonte:"",log:{}}],qi:{...qiVazio,per:q.per}}}));
                          setErroGen(e=>({...e,alvoQtd:null})); };
                        return (
                        <div style={{marginBottom:14}}>
                          {f.qtdItens.map((it,i)=>(
                            <div key={it.id||i} style={{display:"flex",alignItems:"center",gap:8,background:"#EAF3EF",border:"1px solid #BFDCD1",borderRadius:10,padding:"8px 10px",marginBottom:6}}>
                              <span style={{flex:1,fontSize:13,fontWeight:700,color:"#173C33"}}>{it.nome||"Atividade"} · {it.alvo}{it.unidade?" "+it.unidade:""} <span style={{color:"#7A7466",fontWeight:600}}>({QTD_PER[it.per]||"Acumulado"}{it.fonte?" · 🔗 automático":""})</span></span>
                              <button onClick={()=>setFormMeta(x=>({...x,f:{...x.f,qtdItens:x.f.qtdItens.filter((_,k)=>k!==i)}}))} style={{background:"none",border:"none",color:"#B4483C",fontSize:18,cursor:"pointer",lineHeight:1}} aria-label="Remover atividade">×</button>
                            </div>
                          ))}
                          <div style={{background:"#FAF9F6",border:"1px solid #F0EEE6",borderRadius:12,padding:12}}>
                            <label style={FL}>Atividade</label>
                            <input style={{...INP(false),marginBottom:12}} placeholder="Ex: Flexões, Copos de água" value={q.nome} onChange={e=>upQi("nome",e.target.value.slice(0,40))}/>
                            <label style={FL}>Como contar</label>
                            <Chips opcoes={Object.entries(QTD_PER)} valor={q.per} onChange={v=>upQi("per",v)}/>
                            <div style={{fontSize:11.5,color:"#7A7466",fontWeight:600,margin:"-8px 0 10px",lineHeight:1.45}}>{{total:"Soma tudo até chegar no alvo (ex.: 100 assinantes).",dia:"Renova todo dia (ex.: 100 flexões por dia).",semana:"Renova toda semana, de segunda a domingo.",mes:"Renova todo mês."}[q.per]}</div>
                            {q.per==="total"&&f.qtdItens.some(x=>x.per!=="total")&&(
                              <div style={{marginBottom:12}}>
                                <label style={FL}>Somar automaticamente de</label>
                                <select style={INP(false)} value={q.fonte} onChange={e=>upQi("fonte",e.target.value)}>
                                  <option value="">Não — contar à mão</option>
                                  {f.qtdItens.filter(x=>x.per!=="total").map(x=><option key={x.id} value={x.id}>{x.nome||"Atividade"} ({QTD_PER[x.per]})</option>)}
                                </select>
                                {q.fonte&&<div style={{fontSize:11.5,color:"#235448",fontWeight:700,marginTop:6}}>Tudo que você marcar nessa atividade entra neste total sozinho.</div>}
                              </div>
                            )}
                            <div style={{display:"grid",gridTemplateColumns:q.per==="total"?"minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)":"minmax(0,1fr) minmax(0,1.2fr)",gap:8}}>
                              <div><label style={FL}>{q.per==="total"?"Alvo *":`Alvo ${{dia:"por dia",semana:"por semana",mes:"por mês"}[q.per]} *`}</label><input inputMode="numeric" style={INP(erroGen.alvoQtd)} placeholder="100" value={q.alvo} onChange={e=>upQi("alvo",e.target.value.replace(/\D/g,"").slice(0,7))}/></div>
                              {q.per==="total"&&<div><label style={FL}>Atual</label><input inputMode="numeric" style={INP(false)} placeholder="0" value={q.atual} onChange={e=>upQi("atual",e.target.value.replace(/\D/g,"").slice(0,7))}/></div>}
                              <div><label style={FL}>Unidade</label><input style={INP(false)} placeholder={q.per==="total"?"assinantes":"repetições"} value={q.unidade} onChange={e=>upQi("unidade",e.target.value.slice(0,20))}/></div>
                            </div>
                            <ErrTxt msg={erroGen.alvoQtd}/>
                            <button onClick={addQi} style={{width:"100%",marginTop:10,border:"2px solid #2E6E5E",background:"#EAF3EF",color:"#235448",borderRadius:10,padding:"10px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Adicionar atividade</button>
                          </div>
                        </div>);
                      })()}
                      {md.includes("etapas")&&<div style={{fontSize:12.5,fontWeight:800,color:"#173C33",marginBottom:8}}>✅ Etapas</div>}
                      {md.includes("etapas")&&(
                        <div style={{marginBottom:14}}>
                          {f.etapas.map((e,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#FAF9F6",border:"1px solid #F0EEE6",borderRadius:10,padding:"8px 10px",marginBottom:6}}>
                              <span style={{fontSize:11,fontWeight:800,color:"#A39C8A",width:18}}>{i+1}.</span>
                              <span style={{flex:1,fontSize:13,fontWeight:700,color:"#173C33"}}>{e.t}</span>
                              <button onClick={()=>setFormMeta(x=>({...x,f:{...x.f,etapas:x.f.etapas.filter((_,k)=>k!==i)}}))} style={{background:"none",border:"none",color:"#B4483C",fontSize:18,cursor:"pointer",lineHeight:1}} aria-label="Remover etapa">×</button>
                            </div>
                          ))}
                          <div style={{display:"flex",gap:8}}>
                            <input style={{...INP(erroGen.etapas),flex:1}} placeholder={f.etapas.length?"Próxima etapa":"Ex: Fazer 3 orçamentos"} value={f.novaEtapa}
                              onChange={e=>up("novaEtapa",e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addEtapa();}}}/>
                            <button onClick={addEtapa} style={{background:"#173C33",color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontSize:20,fontWeight:800,cursor:"pointer"}}>+</button>
                          </div>
                          <ErrTxt msg={erroGen.etapas}/>
                        </div>
                      )}

                      {md.includes("calendario")&&(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:12.5,fontWeight:800,color:"#173C33",marginBottom:8}}>📅 Calendário</div>
                          <label style={FL}>Frequência</label>
                          <Chips opcoes={[["diario","Todos os dias"],["semana","Vezes por semana"],["periodo","Dias no período"]]} valor={f.cal_freq} onChange={v=>up("cal_freq",v)}/>
                          {f.cal_freq==="semana"&&(
                            <div style={{display:"flex",alignItems:"center",gap:10,margin:"-6px 0 10px"}}>
                              <input inputMode="numeric" style={{...INP(erroGen.cal_vezes),width:80,textAlign:"center",fontWeight:800}} value={f.cal_vezes} onChange={e=>up("cal_vezes",e.target.value.replace(/\D/g,"").slice(0,1))}/>
                              <span style={{fontSize:13,fontWeight:700,color:"#444"}}>vezes por semana</span>
                            </div>
                          )}
                          {f.cal_freq==="periodo"&&(()=>{
                            const ini=f.data_inicio&&f.data_inicio>hoje()?f.data_inicio:hoje(), restam=f.prazo&&f.prazo>=ini?diasEntre(ini,f.prazo)+1:0, n=parseInt(f.cal_vezes)||0;
                            return (
                            <div style={{margin:"-6px 0 10px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={{fontSize:13,fontWeight:700,color:"#444"}}>Cumprir em</span>
                                <input inputMode="numeric" style={{...INP(erroGen.cal_vezes),width:90,textAlign:"center",fontWeight:800}} value={f.cal_vezes} onChange={e=>up("cal_vezes",e.target.value.replace(/\D/g,"").slice(0,3))}/>
                                <span style={{fontSize:13,fontWeight:700,color:"#444"}}>dias, quando quiser</span>
                              </div>
                              {restam>0&&n>0&&<div style={{fontSize:11.5,color:"#7A7466",fontWeight:700,marginTop:8}}>Restam {restam} dia{restam>1?"s":""} até o prazo · você precisa marcar {Math.min(n,restam)} (≈ {(Math.min(n,restam)/restam*7).toFixed(1).replace(".",",")} por semana).</div>}
                            </div>);
                          })()}
                          <ErrTxt msg={erroGen.cal_vezes}/>
                          <div style={{fontSize:11.5,color:"#235448",fontWeight:700,background:"#EAF3EF",borderRadius:10,padding:"9px 12px"}}>
                            {diasCal>0 ? `Meta: marcar ${diasCal} dia${diasCal>1?"s":""} entre ${fmtDate(f.data_inicio)} e ${fmtDate(f.prazo)}. Cada dia marcado avança a meta e conta para a sequência 🔥.` : "Defina o início e o prazo abaixo para calcular quantos dias marcar."}
                          </div>
                        </div>
                      )}

                      <Sec n={4} t="Prazo"/>
                      {T.mensal
                        ?<div style={{fontSize:12,color:"#7A7466",fontWeight:600,background:"#F4F2ED",borderRadius:10,padding:"10px 12px"}}>🔁 Meta mensal: começa no dia 1 e renova todo mês sozinha.</div>
                        :pat
                        ?(()=>{ const np=parseInt(f.parcelas)||0, dec=decorridas(f.data_inicio,np), pagasV=Math.min(np, f.parcPagas!==""?(parseInt(f.parcPagas)||0):dec), fim=np>0&&f.data_inicio?addMesesData(f.data_inicio,np-1):null; return (
                        <div>
                          <label style={FL}>Quando iniciou · vencimento da 1ª parcela *</label>
                          <input type="date" style={INP(erroGen.data_inicio)} value={f.data_inicio} onChange={e=>up("data_inicio",e.target.value)}/><ErrTxt msg={erroGen.data_inicio}/>
                          {np>0&&f.data_inicio&&<>
                            <div style={{marginTop:14}}>
                              <label style={FL}>Parcelas já pagas</label>
                              <input inputMode="numeric" style={{...INP(erroGen.parcPagas),width:"50%"}} placeholder={String(dec)} value={f.parcPagas} onChange={e=>up("parcPagas",e.target.value.replace(/\D/g,"").slice(0,3))}/>
                              <ErrTxt msg={erroGen.parcPagas}/>
                              <div style={{fontSize:11,color:"#A39C8A",fontWeight:600,marginTop:6}}>Em branco: usa as {dec} parcela{dec===1?"":"s"} que já venceram até hoje. As próximas você vincula ao lançar a despesa.</div>
                            </div>
                            <div style={{fontSize:12,color:"#235448",fontWeight:700,background:"#EAF3EF",borderRadius:10,padding:"10px 12px",marginTop:12,lineHeight:1.55}}>
                              📅 Encerra em <b>{fmtDate(fim)}/{fim.slice(0,4)}</b><br/>
                              ✅ {pagasV} paga{pagasV===1?"":"s"} · ⏳ faltam <b>{Math.max(0,np-pagasV)}</b> parcela{np-pagasV===1?"":"s"}{np-pagasV>0&&d2float(f.alvoDigits)>d2float(f.iniDigits)?` de cerca de ${fmt((d2float(f.alvoDigits)-d2float(f.iniDigits))/np)}`:""}
                            </div>
                          </>}
                        </div>);})()
                        :<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:10}}>
                          <div><label style={FL}>Início{f.tipo==="acumular"||md.includes("calendario")?" *":""}</label><input type="date" style={INP(erroGen.data_inicio)} value={f.data_inicio} onChange={e=>up("data_inicio",e.target.value)}/><ErrTxt msg={erroGen.data_inicio}/></div>
                          <div><label style={FL}>Prazo *</label><input type="date" style={INP(erroGen.prazo)} min={f.data_inicio||undefined} value={f.prazo} onChange={e=>up("prazo",e.target.value)}/><ErrTxt msg={erroGen.prazo}/></div>
                        </div>}

                      <Sec n={5} t="Por que essa meta importa (opcional)"/>
                      <textarea style={{...INP(false),minHeight:60,resize:"none",fontSize:14}} placeholder="Ex: ter 6 meses de despesas guardados até dezembro" value={f.descricao} onChange={e=>up("descricao",e.target.value)}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#A39C8A",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:800,margin:"4px 0 10px"}}>Prévia</div>
                      <CardMeta m={previa.mt} p={previa.p}/>
                      <button className="btn-primary" onClick={salvarMeta}>{ed?"Salvar alterações":"Criar meta"}</button>
                      <button className="btn-ghost" onClick={()=>{setFormMeta(null);setMetaTab("andamento");}}>Cancelar</button>
                    </div>
                  </div>
                );
              })())}
          </>);
        })()}
        {view==="relatorio"&&<Relatorio mesKey={mesAtual.mes} aplicadoTodos={aplicadoTodos} goPeriodo={n=>setMesIdx(i=>Math.max(0,Math.min(MESES.length-1,i+n)))}/>}
        {view==="historico"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:22,fontWeight:800,color:"#173C33",fontFamily:"'Fraunces',serif"}}>Histórico</div>
              <div style={{fontSize:11,color:"#A39C8A",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>{items.length} lançamentos</div>
            </div>
            <div style={{position:"relative",marginBottom:12}}>
              <input type="text" placeholder="Pesquisar descrição (ex: nubank)" value={busca} onChange={e=>setBusca(e.target.value)}
                style={{width:"100%",background:"#fff",border:"2px solid #E3DFD3",borderRadius:10,color:"#173C33",padding:"12px 38px 12px 14px",fontSize:14,fontFamily:"'Inter',sans-serif"}}/>
              {busca&&<button onClick={()=>setBusca("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",fontSize:18,color:"#A39C8A",cursor:"pointer",padding:4}}>×</button>}
            </div>
            {(()=>{
              const termos=normTxt(busca).split(/\s+/).filter(Boolean);
              const isProg=t=>!t.excluido&&agendada(t,hoje());
              const base=sorted.filter(t=>histTab==="prog"?isProg(t):!isProg(t));
              const nProg=sorted.filter(isProg).length;
              const lista=termos.length?base.filter(t=>{const h=normTxt(t.descricao);return termos.every(x=>h.includes(x));}):base;
              return (
                <>
                  <div style={{display:"flex",gap:6,marginBottom:12,background:"#fff",borderRadius:10,padding:4,boxShadow:"0 2px 8px #173C3310"}}>
                    {[["exec","Executados",sorted.length-nProg],["prog","Programados",nProg]].map(([k,l,n])=>(
                      <button key={k} onClick={()=>setHistTab(k)} style={{flex:1,border:"none",borderRadius:8,padding:"9px 6px",fontSize:12.5,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",background:histTab===k?"#173C33":"transparent",color:histTab===k?"#fff":"#A39C8A"}}>{l} ({n})</button>
                    ))}
                  </div>
                  {termos.length>0&&<div style={{fontSize:11,color:"#A39C8A",marginBottom:8,fontWeight:600,fontFamily:"'Inter',sans-serif"}}>{lista.length} resultado{lista.length===1?"":"s"} · Total {fmt(lista.filter(t=>!t.excluido).reduce((a,t)=>a+t.valor,0))}</div>}
                  <div style={card}>
                    {lista.length===0
                      ?<div style={{padding:"24px 0",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🗒️</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>{termos.length?"Nenhum resultado para a pesquisa.":(histTab==="prog"?"Nenhum lançamento programado.":"Nenhum lançamento neste mês.")}</div></div>
                      :lista.map((t,i)=><LancRow key={t.id} t={t} last={i===lista.length-1} limpo/>)
                    }
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>

      {!anyModal&&!isFechado&&view!=="caixa"&&view!=="relatorio"&&view!=="metas"&&(
        <button className="fab" onClick={()=>{setProgMode(false);setForm(emptyForm());setErro({});setShowForm(true);}}>
          <span style={{fontSize:20,lineHeight:1}}>+</span> Novo Lançamento
        </button>
      )}
      {!anyModal&&!isFechado&&view==="caixa"&&(
        <button className="fab fab-gold" onClick={()=>{setFormReceita(emptyFormReceita());setErroReceita({});setShowFormReceita(true);}}>
          <span style={{fontSize:20,lineHeight:1}}>+</span> Nova Receita
        </button>
      )}
      {showForm&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:20,fontWeight:800,color:"#173C33",marginBottom:20,fontFamily:"'Fraunces',serif"}}>{progMode?"Programar Despesa":"Novo Lançamento"}</div>
            <FormBody form={form} setForm={setForm} erro={erro} setErro={setErro} permiteRecorrencia metasVinc={metas.filter(m=>tipoMeta(m.tipo)==="patrimonio"&&(!m.concluida_em||m.id===form.meta_id))}/>
            <div style={{height:16}}/>
            <button className="btn-primary" onClick={lancar}>{progMode?"Programar":"Registrar Lançamento"}</button>
            <button className="btn-ghost" onClick={()=>setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {showFormReceita&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowFormReceita(false);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:20,fontWeight:800,color:"#235448",marginBottom:4,fontFamily:"'Fraunces',serif"}}>Nova Receita</div>
            <div style={{fontSize:11,color:"#A39C8A",marginBottom:18,fontFamily:"'Inter',sans-serif"}}>Registro de recebimento em caixa</div>
            <FormBodyReceita form={formReceita} setForm={setFormReceita} erro={erroReceita} setErro={setErroReceita}/>
            <div style={{height:16}}/>
            <button className="btn-success" onClick={lancarReceita}>Registrar Receita</button>
            <button className="btn-ghost" onClick={()=>setShowFormReceita(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {ctx&&(()=>{
        const it=ctx.item, prog=ctx.kind==="lanc"&&agendada(it,hoje());
        const W=230, Hh=ctx.kind==="lanc"?(prog?170:130):130;
        const left=Math.max(8,Math.min(ctx.x,window.innerWidth-W-8)), top=Math.max(8,Math.min(ctx.y,window.innerHeight-Hh-8));
        const ic=(d)=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
        const fecha=()=>setCtx(null);
        return (
          <div style={{position:"fixed",inset:0,zIndex:300}} onClick={fecha} onContextMenu={e=>{e.preventDefault();fecha();}} onWheel={fecha}>
            <div onClick={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation();}}
              style={{position:"absolute",left,top,width:W,background:"rgba(40,42,44,0.97)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:"1px solid #FFFFFF1F",borderRadius:10,padding:6,boxShadow:"0 10px 30px #00000066"}}>
              <div style={{padding:"6px 12px 8px",borderBottom:"1px solid #FFFFFF1A",marginBottom:4}}>
                <div style={{fontSize:12,color:"#fff",fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.descricao}</div>
                <div style={{fontSize:11,color:"#A9ADB1",fontFamily:"'Inter',sans-serif"}}>{fmt(it.valor)}</div>
              </div>
              <button className="ctx-item" onClick={()=>{fecha();ctx.kind==="lanc"?openEdit(it):openEditReceita(it);}}>
                {ic(<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>)}<span>Editar</span>
              </button>
              {prog&&<button className="ctx-item" onClick={()=>{fecha();provisionar(it);}}>
                {ic(<><polyline points="20 6 9 17 4 12"/></>)}<span>Executar</span>
              </button>}
              <div style={{height:1,background:"#FFFFFF1A",margin:"4px 2px"}}/>
              <button className="ctx-item ctx-red" onClick={()=>{fecha();ctx.kind==="lanc"?setDelItem(it):setDelReceita(it);}}>
                {ic(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>)}<span>Excluir</span>
              </button>
            </div>
          </div>
        );
      })()}
      {showRend&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowRend(false);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:20,fontWeight:800,color:"#173C33",marginBottom:4,fontFamily:"'Fraunces',serif"}}>Rendimento CDB</div>
            <div style={{display:"flex",gap:4,background:"#F4F2ED",borderRadius:10,padding:4,margin:"12px 0 16px"}}>
              {[["valor","Valor que rendeu (R$)"],["taxa","Taxa anual (%)"]].map(([k,l])=>(
                <button key={k} onClick={()=>{setFormRend(f=>({...f,modo:k}));setErroRend(null);}} style={{flex:1,border:"none",borderRadius:8,padding:"9px 4px",fontSize:11.5,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",background:formRend.modo===k?"#173C33":"transparent",color:formRend.modo===k?"#fff":"#7A7466"}}>{l}</button>
              ))}
            </div>
            {formRend.modo==="valor"
              ?<>
                <div style={{fontSize:11,color:"#A39C8A",marginBottom:14,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>Esse valor <b>já está dentro</b> do montante aplicado. O app só separa quanto disso foi rendimento e distribui mês a mês.</div>
                <div style={{marginBottom:14}}>
                  <label style={FL}>Quanto rendeu no período *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#7A7466",fontFamily:"'Inter',sans-serif",fontWeight:700}}>R$</span>
                    <input style={{...INP(erroRend),paddingLeft:40,fontSize:22,fontWeight:800,color:"#2E6E5E"}} placeholder="0,00" inputMode="numeric"
                      value={formRend.valorDigits?d2brl(formRend.valorDigits):""} onChange={e=>{setFormRend(f=>({...f,valorDigits:e.target.value.replace(/\D/g,"")}));setErroRend(null);}}/>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div><label style={FL}>De *</label><input type="date" style={INP(false)} value={formRend.de} onChange={e=>{setFormRend(f=>({...f,de:e.target.value}));setErroRend(null);}}/></div>
                  <div><label style={FL}>Até *</label><input type="date" style={INP(false)} value={formRend.ate} onChange={e=>{setFormRend(f=>({...f,ate:e.target.value}));setErroRend(null);}}/></div>
                </div>
                {(()=>{
                  const V=d2float(formRend.valorDigits||"0");
                  if(!(V>0)) return null;
                  const d=distribuir(V,formRend.de,formRend.ate);
                  if(!d.ok) return null;
                  const ja=aplicadoTodos.filter(t=>isInc(t)&&d.segs.some(x=>x.k===t.mes)).length;
                  return (
                    <div style={{marginTop:14,background:"#F4F2ED",borderRadius:10,padding:"12px 14px",fontFamily:"'Inter',sans-serif"}}>
                      <div style={{fontSize:10,color:"#7A7466",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Distribuição</div>
                      {d.segs.map(x=>(
                        <div key={x.k} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",color:"#173C33"}}>
                          <span style={{fontWeight:600}}>{MES_AB[parseInt(x.k.slice(5),10)-1]}/{x.k.slice(2,4)} <span style={{color:"#A39C8A",fontWeight:500}}>({f2(x.ini).slice(0,5)}–{f2(x.fim).slice(0,5)})</span></span>
                          <b>+ {fmt(x.valor)}</b>
                        </div>
                      ))}
                      <div style={{borderTop:"1px solid #E3DFD3",marginTop:6,paddingTop:6,fontSize:11,color:"#7A7466",fontWeight:600}}>≈ {((d.r)*100).toFixed(2).replace(".",",")}% a.m. · {d.aa.toFixed(2).replace(".",",")}% a.a. (taxa constante)</div>
                      {ja>0&&<div style={{fontSize:10.5,color:"#8A6A1F",marginTop:4,fontWeight:600}}>Substitui {ja} rendimento{ja===1?"":"s"} já cadastrado{ja===1?"":"s"} nesses meses.</div>}
                    </div>
                  );
                })()}
                {erroRend&&<div style={{fontSize:11,color:"#B4483C",marginTop:8,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{erroRend}</div>}
              </>
              :<>
                <div style={{fontSize:11,color:"#A39C8A",marginBottom:14,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>Informe a taxa anual. O app calcula o rendimento em reais e <b>soma</b> ao montante aplicado.</div>
                <div style={{marginBottom:16}}>
                  <label style={FL}>Taxa anual (% a.a.) *</label>
                  <div style={{position:"relative"}}>
                    <input style={{...INP(erroRend),paddingRight:60,fontSize:22,fontWeight:800,color:"#2E6E5E"}} placeholder="0,00" inputMode="decimal"
                      value={formRend.taxa} onChange={e=>{setFormRend(f=>({...f,taxa:e.target.value.replace(/[^\d.,]/g,"")}));setErroRend(null);}}/>
                    <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#7A7466",fontFamily:"'Inter',sans-serif",fontWeight:700}}>% a.a.</span>
                  </div>
                  {erroRend&&<div style={{fontSize:11,color:"#B4483C",marginTop:4,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{erroRend}</div>}
                </div>
                <div style={{marginBottom:8}}>
                  <label style={FL}>Data *</label>
                  <input type="date" style={INP(false)} value={formRend.data} onChange={e=>setFormRend(f=>({...f,data:e.target.value}))}/>
                </div>
                {(()=>{
                  const c=calcRend(formRend.taxa,formRend.data||hoje());
                  return c.a>0&&c.base>0?(
                    <div style={{marginTop:14,background:"#F4F2ED",borderRadius:10,padding:"12px 14px",fontFamily:"'Inter',sans-serif"}}>
                      <div style={{fontSize:11,color:"#7A7466",fontWeight:600}}>Montante base: {fmt(c.base)}</div>
                      <div style={{fontSize:11,color:"#7A7466",fontWeight:600,marginTop:2}}>Equivalente mensal: {(c.mensal*100).toFixed(3).replace(".",",")}% a.m.</div>
                      <div style={{fontSize:15,color:"#235448",fontWeight:800,marginTop:6}}>Rendimento do mês: + {fmt(c.valor)}</div>
                    </div>
                  ):null;
                })()}
              </>}
            <div style={{height:16}}/>
            <button className="btn-success" onClick={salvarRendimento}>{formRend.modo==="valor"?"Distribuir rendimento":"Registrar Rendimento"}</button>
            <button className="btn-ghost" onClick={()=>setShowRend(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {acaoReceita&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget&&Date.now()-abertoEm.current>400)setAcaoReceita(null);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:15,fontWeight:800,color:"#173C33",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acaoReceita.descricao}</div>
            <div style={{fontSize:12,color:"#A39C8A",marginBottom:16,fontFamily:"'Inter',sans-serif"}}>{fmt(acaoReceita.valor)} · {fmtDate(acaoReceita.semana)}</div>
            <button className="btn-primary" onClick={()=>{const r=acaoReceita;setAcaoReceita(null);openEditReceita(r);}}>Editar</button>
            <button className="btn-danger" onClick={()=>{const r=acaoReceita;setAcaoReceita(null);setDelReceita(r);}}>Excluir</button>
            <button className="btn-ghost" onClick={()=>setAcaoReceita(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {acaoItem&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget&&Date.now()-abertoEm.current>400)setAcaoItem(null);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:15,fontWeight:800,color:"#173C33",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acaoItem.descricao}</div>
            <div style={{fontSize:12,color:"#A39C8A",marginBottom:16,fontFamily:"'Inter',sans-serif"}}>{fmt(acaoItem.valor)} · {fmtDate(acaoItem.data)}</div>
            <button className="btn-primary" onClick={()=>{const t=acaoItem;setAcaoItem(null);openEdit(t);}}>Editar</button>
            {agendada(acaoItem,hoje())&&<button className="btn-success" onClick={()=>{const t=acaoItem;setAcaoItem(null);provisionar(t);}}>Executar</button>}
            <button className="btn-danger" onClick={()=>{const t=acaoItem;setAcaoItem(null);setDelItem(t);}}>Excluir</button>
            <button className="btn-ghost" onClick={()=>setAcaoItem(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {popProg&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setPopProg(false);}}>
          <div className="sheet" style={{maxHeight:"70vh",overflowY:"auto"}}>
            <div className="handle"/>
            <div style={{fontSize:17,fontWeight:800,color:"#173C33",marginBottom:2,fontFamily:"'Fraunces',serif"}}>Executar</div>
            <div style={{fontSize:11,color:"#A39C8A",marginBottom:10,fontFamily:"'Inter',sans-serif"}}>{agendados.length} conta{agendados.length===1?"":"s"} · {fmt(totalAgendado)}</div>
            {!isFechado&&<button onClick={programarDespesa} style={{width:"100%",background:"#F4F2ED",border:"1px dashed #C9A566",color:"#8A6A1F",borderRadius:10,fontSize:12.5,fontWeight:700,padding:"10px",marginBottom:6,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Programar despesa</button>}
            {agendados.length===0
              ?<div style={{padding:"16px 0",textAlign:"center",color:"#A39C8A",fontSize:13,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nada programado neste mês.</div>
              :[...agendados].sort((a,b)=>new Date(a.data)-new Date(b.data)).map((t,i)=>(
                <div key={t.id} style={{...rowDiv(i===agendados.length-1),padding:"10px 0"}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#173C33",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Inter',sans-serif"}}>{t.descricao}</div>
                    <div style={{fontSize:11,color:"#A39C8A",fontFamily:"'Inter',sans-serif"}}>{fmtDate(t.data)} · {t.categoria}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <span style={{fontSize:13,fontWeight:800,color:"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(t.valor)}</span>
                    {!isFechado&&<button onClick={()=>provisionar(t)} style={{background:"none",border:"1px solid #BFDCD1",color:"#2E6E5E",borderRadius:8,fontSize:10.5,fontWeight:700,padding:"4px 8px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>executar</button>}
                  </div>
                </div>
              ))
            }
            <button className="btn-ghost" onClick={()=>setPopProg(false)}>Fechar</button>
          </div>
        </div>
      )}
      {editReceita&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setEditReceita(null);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:20,fontWeight:800,color:"#235448",marginBottom:4,fontFamily:"'Fraunces',serif"}}>Editar Receita</div>
            <div style={{fontSize:11,color:"#A39C8A",marginBottom:18,fontFamily:"'Inter',sans-serif"}}>{fmtDate(editReceita.semana)}</div>
            <FormBodyReceita form={formReceita} setForm={setFormReceita} erro={erroReceita} setErro={setErroReceita}/>
            <div style={{height:16}}/>
            <button className="btn-success" onClick={salvarEdicaoReceita}>Salvar Alterações</button>
            <button className="btn-danger" onClick={()=>{setDelReceita(editReceita);setEditReceita(null);}}>Excluir Receita</button>
            <button className="btn-ghost" onClick={()=>setEditReceita(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {editItem&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setEditItem(null);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:20,fontWeight:800,color:"#173C33",marginBottom:4,fontFamily:"'Fraunces',serif"}}>Editar Lançamento</div>
            <div style={{fontSize:11,color:"#A39C8A",marginBottom:18,fontFamily:"'Inter',sans-serif"}}>#{editItem.id} · {fmtDate(editItem.data)}</div>
            <FormBody form={form} setForm={setForm} erro={erro} setErro={setErro} metasVinc={metas.filter(m=>tipoMeta(m.tipo)==="patrimonio"&&(!m.concluida_em||m.id===form.meta_id))}/>
            <div style={{height:16}}/>
            <button className="btn-primary" onClick={salvarEdicao}>Salvar Alterações</button>
            <button className="btn-danger" onClick={()=>{setDelItem(editItem);setEditItem(null);}}>Excluir Lançamento</button>
            <button className="btn-ghost" onClick={()=>setEditItem(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {delItem&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setDelItem(null);setMotivoExc("");setMotivoErr(false);}}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:18,fontWeight:800,color:"#B4483C",marginBottom:6,fontFamily:"'Fraunces',serif"}}>Excluir Lançamento</div>
            <div style={{fontSize:14,color:"#173C33",marginBottom:2,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{delItem.descricao}</div>
            <div style={{fontSize:13,color:"#A39C8A",marginBottom:20,fontFamily:"'Inter',sans-serif"}}>{fmt(delItem.valor)} · {fmtDate(delItem.data)}</div>
            <div style={{background:"#FBECEA",border:"1px solid #EBBDB633",borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:13,color:"#B4483C",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
              Valor excluído da soma de valores.
            </div>
            <label style={FL}>Motivo da Exclusão *</label>
            <textarea placeholder="Descreva o motivo..." value={motivoExc} onChange={e=>{setMotivoExc(e.target.value);setMotivoErr(false);}}
              style={{background:"#FAF9F6",border:`2px solid ${motivoErr?"#B4483C":"#E3DFD3"}`,borderRadius:10,color:"#173C33",padding:"13px 14px",fontSize:14,fontFamily:"'Inter',sans-serif",width:"100%",minHeight:90,resize:"none"}}/>
            {motivoErr&&<div style={{fontSize:11,color:"#B4483C",marginTop:4,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>Informe o motivo da exclusão</div>}
            <div style={{height:16}}/>
            <button className="btn-primary" style={{background:"#B4483C"}} onClick={confirmarExclusao}>Confirmar Exclusão</button>
            <button className="btn-ghost" onClick={()=>{setDelItem(null);setMotivoExc("");setMotivoErr(false);}}>Cancelar</button>
          </div>
        </div>
      )}
      {delReceita&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setDelReceita(null);}}>
          <div className="sheet">
            <div className="handle"/>
            <div style={{fontSize:18,fontWeight:800,color:"#B4483C",marginBottom:6,fontFamily:"'Fraunces',serif"}}>Excluir Receita</div>
            <div style={{fontSize:14,color:"#173C33",marginBottom:2,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{delReceita.descricao}</div>
            <div style={{fontSize:13,color:"#A39C8A",marginBottom:20,fontFamily:"'Inter',sans-serif"}}>{fmt(delReceita.valor)} · {fmtDate(delReceita.semana)}</div>
            <div style={{background:"#FBECEA",border:"1px solid #EBBDB633",borderRadius:10,padding:"12px 14px",marginBottom:20,fontSize:13,color:"#B4483C",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>
              Este recebimento será removido do fluxo de caixa.
            </div>
            <button className="btn-primary" style={{background:"#B4483C"}} onClick={confirmarExclusaoReceita}>Confirmar Exclusão</button>
            <button className="btn-ghost" onClick={()=>setDelReceita(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {acaoGen&&(()=>{
        const item=acaoGen.item, fecha=()=>setAcaoGen(null);
        const p = progMeta(item, glob);
        return (
          <Modal onClose={fecha}>
            <div style={{fontSize:15,fontWeight:800,color:"#173C33",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.nome}</div>
            <div style={{fontSize:12,color:"#A39C8A",marginBottom:16}}>{`${fmtMeta(item,p.atual)} de ${fmtMeta(item,p.alvo)} · ${(p.pct*100).toFixed(0)}% · ${p.status.txt}`}</div>
            {item.descricao&&<div style={{fontSize:12,color:"#444",background:"#F4F2ED",borderRadius:10,padding:"10px 12px",marginBottom:12,lineHeight:1.45}}>{item.descricao}</div>}
            <button className="btn-primary" onClick={()=>{fecha(); editarMeta(item);}}>{["valor","manual"].includes(item.tipo)?"Atualizar progresso / editar":"Editar"}</button>
            {!p.realizada&&!p.mensal&&<button className="btn-success" style={{marginTop:10}} onClick={()=>{fecha();concluirMeta(item);}}>🏆 Marcar como realizada</button>}
            {item.concluida_em&&<button className="btn-ghost" onClick={()=>{fecha();reabrirMeta(item);}}>Reabrir meta</button>}
            <button className="btn-danger" onClick={()=>{fecha();setMotivoExc("");setMotivoErr(false);setDelGen({kind:"meta",item});}}>Excluir</button>
            <button className="btn-ghost" onClick={fecha}>Cancelar</button>
          </Modal>
        );
      })()}
      {delGen&&(
        <Modal onClose={()=>{setDelGen(null);setMotivoExc("");setMotivoErr(false);}}>
          <div style={{fontSize:18,fontWeight:800,color:"#B4483C",marginBottom:6}}>Excluir meta</div>
          <div style={{fontSize:14,color:"#173C33",marginBottom:2,fontWeight:700}}>{delGen.item.nome}</div>
          <div style={{fontSize:13,color:"#A39C8A",marginBottom:16}}>{`Alvo ${fmtMeta(delGen.item,Number(delGen.item.valor_alvo)||0)}`}</div>
          <label style={FL}>Motivo da Exclusão *</label>
          <textarea placeholder="Descreva o motivo..." value={motivoExc} onChange={e=>{setMotivoExc(e.target.value);setMotivoErr(false);}}
            style={{background:"#FAF9F6",border:`2px solid ${motivoErr?"#B4483C":"#E3DFD3"}`,borderRadius:10,color:"#173C33",padding:"13px 14px",fontSize:14,fontFamily:"'Inter',sans-serif",width:"100%",minHeight:90,resize:"none"}}/>
          <ErrTxt msg={motivoErr?"Informe o motivo da exclusão":null}/>
          <div style={{height:16}}/>
          <button className="btn-primary" style={{background:"#B4483C"}} onClick={confirmarDelGen}>Confirmar Exclusão</button>
          <button className="btn-ghost" onClick={()=>{setDelGen(null);setMotivoExc("");setMotivoErr(false);}}>Cancelar</button>
        </Modal>
      )}
      {showAlertas&&<PainelAlertas alertas={alertas} onClose={()=>setShowAlertas(false)}
        onIgnorar={a=>{ salvaIgn([...ignorados,a.key]); showToast("Alerta retirado"); }}
        onExecutei={async a=>{
          const hj=hoje(), alvo=glob.l.filter(l=>a.ids.includes(l.id));
          const res=await Promise.all(alvo.map(l=>sbPatch(l.id, l.data>hj ? {data:hj,mes:hj.slice(0,7),programado:false} : {programado:false})));
          salvaIgn([...ignorados,a.key]);   // garante que sai do painel mesmo que o banco ainda não tenha a coluna nova
          if(res.every(Boolean)){ load(); showToast("✓ Marcado como executado"); } else showToast("⚠ Não salvou no banco");
        }}
        nIgnorados={ignorados.length} onRestaurar={()=>salvaIgn([])}/>}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}
