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
    return r.ok ? r.json() : [];
  } catch { return []; }
}
async function sbPost(body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/lancamentos`, { method: "POST", headers: H, body: JSON.stringify(body) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
async function sbPatch(id, body) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/lancamentos?id=eq.${id}`, { method: "PATCH", headers: { ...H, "Prefer": "return=minimal" }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}
async function rcGet(mes) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/receitas?cliente_id=eq.${CID}&mes=eq.${mes}&order=semana.desc`, { headers: H });
    return r.ok ? r.json() : [];
  } catch { return []; }
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
    return r.ok ? r.json() : [];
  } catch { return []; }
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
const soma    = arr => arr.filter(t=>!t.excluido && t.meio!=="Pluxe" && t.categoria!=="Aplicado" && t.data<=hoje()).reduce((s,t)=>s+t.valor,0);
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
const emptyForm=()=>({descricao:"",valorDigits:"",categoria:"",meio:"",data:hoje(),obs:"",recorrente:false,repeticoes:""});
const emptyFormReceita=()=>({descricao:"",valorDigits:"",data:hoje(),obs:""});
const INP=err=>({background:"#FAF9F6",border:`2px solid ${err?"#B4483C":"#E3DFD3"}`,borderRadius:10,color:"#173C33",padding:"13px 14px",fontSize:15,fontFamily:"'Inter',sans-serif",width:"100%",transition:"border .2s"});
const FL={fontSize:11,color:"#7A7466",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:7,display:"block",fontWeight:700,fontFamily:"'Inter',sans-serif"};
function FormBody({form,setForm,erro,setErro,permiteRecorrencia}) {
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
            📅 Data futura — essa despesa fica "agendada" e só entra no total a partir de {fmtDate(form.data)}.
          </div>
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
    return { l: a.ok ? await a.json() : [], r: b.ok ? await b.json() : [] };
  } catch { return { l: [], r: [] }; }
}
const somaV = a => a.reduce((s,x)=>s+x.valor,0);
const agCat = list => { const m={}; list.forEach(l=>{m[l.categoria]=(m[l.categoria]||0)+l.valor;}); return Object.entries(m).map(([cat,val])=>({cat,val,cor:CAT_CORES[cat]||"#999"})).sort((a,b)=>b.val-a.val); };
function Donut({ segs, size=124 }) {
  const r=28, cx=45, cy=45, circ=2*Math.PI*r;
  const total=segs.reduce((s,x)=>s+x.val,0);
  let off=0;
  return (
    <svg width={size} height={size} viewBox="0 0 90 90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E9E5D8" strokeWidth="10"/>
      {segs.map((sg,i)=>{
        const len=total>0?(sg.val/total)*circ:0;
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={sg.cor} strokeWidth="10"
          strokeDasharray={`${Math.max(len-1.5,0)} ${circ}`} strokeDashoffset={-off}
          style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>;
        off+=len; return el;
      })}
    </svg>
  );
}
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

  const contFn = l => l.meio!=="Pluxe" && l.categoria!=="Aplicado" && l.data<=hj;
  const lc = dados.cur.l.filter(contFn), lp = dados.prev.l.filter(contFn);
  const agend = dados.cur.l.filter(l=>l.meio!=="Pluxe"&&l.categoria!=="Aplicado"&&l.data>hj);
  const total=somaV(lc), totAnt=somaV(lp), temAnt=lp.length>0;
  const diff = totAnt>0 ? ((total-totAnt)/totAnt)*100 : null;
  const receita=somaV(dados.cur.r), saldo=receita-total;
  const apl = aplicadoTodos.filter(t=>t.mes>=ini&&t.mes<=fim);
  const aportes=somaV(apl.filter(t=>t.meio!=="Rendimento")), rend=somaV(apl.filter(t=>t.meio==="Rendimento"));
  const meses = Array.from({length:len},(_,i)=>mAdd(ini,i));
  const decorridos = Math.max(1, meses.filter(k=>k<=mesHoje).length);
  const linhas = meses.map(k=>{
    const d=somaV(lc.filter(l=>l.mes===k)), r=somaV(dados.cur.r.filter(x=>x.mes===k));
    const a=somaV(apl.filter(t=>t.mes===k&&t.meio!=="Rendimento"));
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
                  <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
                    <div style={{position:"relative"}}>
                      <Donut segs={cats}/>
                      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                        <div style={{fontSize:8,color:"#A39C8A",fontWeight:700,textTransform:"uppercase"}}>total</div>
                        <div style={{fontSize:fmt(total).length>12?8:9,fontWeight:800,color:"#173C33",fontFamily:"'Fraunces',serif",textAlign:"center",lineHeight:1.2,maxWidth:62}}>{fmt(total)}</div>
                      </div>
                    </div>
                  </div>
                  {linhasCat.map(({cat,val,cor},i)=>{
                    const v=variacao(cat,val);
                    return (
                      <div key={cat} style={{padding:"10px 0",borderTop:i?"1px solid #F0EEE6":"none",opacity:val===0?0.7:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:5}}>
                          <span style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                            <span style={{width:8,height:8,borderRadius:2,background:cor,flexShrink:0}}/>
                            <span style={{fontSize:13,fontWeight:700,color:"#173C33",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</span>
                          </span>
                          <span style={{display:"flex",alignItems:"baseline",gap:8,flexShrink:0}}>
                            <span style={{fontSize:13,fontWeight:800,color:"#173C33"}}>{fmt(val)}</span>
                            <span style={{fontSize:11,fontWeight:800,color:cor,minWidth:44,textAlign:"right"}}>{pc(val,total)}%</span>
                          </span>
                        </div>
                        <Bar percent={total>0?(val/total)*100:0} color={cor}/>
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
  const [formRend,setFormRend]             = useState({taxa:"",data:hoje()});
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

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    const [dAtual, dAnt, rAtual, aplicAll] = await Promise.all([
      sbGet(mesAtual.mes),
      mesAnt ? sbGet(mesAnt.mes) : Promise.resolve([]),
      rcGet(mesAtual.mes),
      fetchAplicadoAll(),
    ]);
    const semRend = a => (a||[]).filter(t=>t.meio!=="Rendimento");   // rendimento NUNCA é despesa: só aparece na aba Aplicado
    setAllItems(p => ({...p, [mesAtual.mes]: semRend(dAtual), ...(mesAnt ? {[mesAnt.mes]: semRend(dAnt)} : {})}));
    setAllReceitas(p => ({...p, [mesAtual.mes]: rAtual||[]}));
    setAplicadoTodos(aplicAll||[]);
    setLastSync(new Date());
    if (!silent) setLoading(false);
  }, [mesAtual.mes, mesAnt]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (showForm || showFormReceita || editItem || delItem || delReceita || editReceita || acaoItem || acaoReceita || ctx || showRend) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [load, showForm, showFormReceita, editItem, delItem, delReceita, editReceita, acaoItem, acaoReceita, ctx, showRend]);

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
  const contaveis  = useMemo(()=>ativos.filter(t=>t.meio!=="Pluxe" && t.categoria!=="Aplicado" && t.data<=hoje()),[ativos]);
  const total      = useMemo(()=>contaveis.reduce((s,t)=>s+t.valor,0),[contaveis]);
  const agendados  = useMemo(()=>ativos.filter(t=>t.meio!=="Pluxe" && t.categoria!=="Aplicado" && t.data>hoje()),[ativos]);
  const totalAgendado = useMemo(()=>agendados.reduce((s,t)=>s+t.valor,0),[agendados]);
  const totalProgramado = total + totalAgendado;
  const totalReceita = useMemo(()=>receitas.reduce((s,r)=>s+r.valor,0),[receitas]);
  const saldo        = totalReceita - total;
  const maxDia     = useMemo(()=>{const d=items.map(t=>parseInt(t.data.slice(8,10)));return d.length?Math.max(...d):31;},[items]);
  const totalAnt   = useMemo(()=>soma(itemsAnt.filter(t=>parseInt(t.data.slice(8,10))<=maxDia)),[itemsAnt,maxDia]);
  const sorted     = useMemo(()=>[...items].sort((a,b)=>new Date(b.data)-new Date(a.data)),[items]);
  const sortedReceitas = useMemo(()=>[...receitas].sort((a,b)=>new Date(b.semana)-new Date(a.semana)),[receitas]);
  const totalAplicadoGeral = useMemo(()=>aplicadoTodos.reduce((s,t)=>s+t.valor,0),[aplicadoTodos]);
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
    const base=aplicadoTodos.filter(t=>t.data<=dataStr && !(t.meio==="Rendimento"&&t.mes===dataStr.slice(0,7))).reduce((s,t)=>s+t.valor,0);
    const mensal=a>0?Math.pow(1+a/100,1/12)-1:0;
    return {a,base,mensal,valor:Math.round(base*mensal*100)/100};
  };
  const carteira = useMemo(()=>{
    const soma=a=>a.reduce((s,t)=>s+t.valor,0);
    const regs=aplicadoTodos.filter(t=>t.meio==="Rendimento");
    const aportes=soma(aplicadoTodos.filter(t=>t.meio!=="Rendimento")), rend=soma(regs);
    const porMes={};
    [...regs].sort((a,b)=>a.data.localeCompare(b.data)).forEach(r=>{
      if(!porMes[r.mes]){
        const base=soma(aplicadoTodos.filter(t=>t.data<=r.data && !(t.meio==="Rendimento"&&t.mes===r.mes)));
        porMes[r.mes]={valor:0,base};
      }
      porMes[r.mes].valor+=r.valor;
    });
    const ms=Object.keys(porMes).sort();
    const dif=(a,b)=>(parseInt(b.slice(0,4),10)-parseInt(a.slice(0,4),10))*12+(parseInt(b.slice(5),10)-parseInt(a.slice(5),10));
    let fator=1; const fatorAno={};
    ms.forEach(m=>{ if(porMes[m].base>0){ const f=1+porMes[m].valor/porMes[m].base; fator*=f; const y=m.slice(0,4); fatorAno[y]=(fatorAno[y]||1)*f; } });
    const n=ms.length?dif(ms[0],ms[ms.length-1])+1:0;
    const acum=(fator-1)*100;
    const aa=n>0?(Math.pow(fator,12/n)-1)*100:null;
    const todos=aplicadoTodos.map(t=>t.mes).sort();
    const meses=[]; if(todos.length){ let k=todos[0]; const fimK=todos[todos.length-1]; while(k<=fimK){ meses.push(k); k=mAdd(k,1);} }
    let ca=0, cr=0;
    const evo=meses.map(k=>{
      const a=soma(aplicadoTodos.filter(t=>t.mes===k&&t.meio!=="Rendimento")), r=soma(aplicadoTodos.filter(t=>t.mes===k&&t.meio==="Rendimento"));
      ca+=a; cr+=r; return {k,a,r,ca,cr,tot:ca+cr};
    });
    const anos=[...new Set(meses.map(k=>k.slice(0,4)))].map(y=>({
      y, a:soma(aplicadoTodos.filter(t=>t.mes.startsWith(y)&&t.meio!=="Rendimento")), r:soma(aplicadoTodos.filter(t=>t.mes.startsWith(y)&&t.meio==="Rendimento")),
      pct:fatorAno[y]?(fatorAno[y]-1)*100:null,
    }));
    return {aportes,rend,total:aportes+rend,n,acum,aa,desde:ms[0]||null,evo,anos,
      nAp:aplicadoTodos.filter(t=>t.meio!=="Rendimento").length,nRe:regs.length,temRend:regs.length>0&&n>0};
  },[aplicadoTodos]);
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
      recorrente: !!form.recorrente, motivo_exclusao: "",
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
        novas.push({...item, id: uid(), mes: dt.slice(0,7), data: dt});
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
    setForm({descricao:item.descricao,valorDigits:float2d(item.valor),categoria:item.categoria,meio:item.meio,data:item.data,obs:item.obs||""});
    setErro({});setEditItem(item);
  };
  const salvarEdicao=async ()=>{
    const e=validar(form);
    if(Object.keys(e).length){setErro(e);return;}
    const ok = await sbPatch(editItem.id, {
      descricao: form.descricao.trim(), valor: d2float(form.valorDigits),
      categoria: form.categoria, meio: form.meio, data: form.data,
      mes: form.data.slice(0,7), obs: form.obs,
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
      setShowRend(false);setShowPicker(false);
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[]);
  const programarDespesa=()=>{
    setPopProg(false);setProgMode(true);
    setForm({...emptyForm(),data:amanha()});setErro({});setShowForm(true);
  };
  const salvarRendimento=async ()=>{
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
    const ok = await sbPatch(t.id, { data: hoje(), mes: hoje().slice(0,7) });
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

  const anyModal=showForm||showFormReceita||!!editItem||!!delItem||!!delReceita||!!editReceita||popProg||!!acaoItem||!!acaoReceita||showRend;
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
          </div>
          {t.obs&&!t.excluido&&<div style={{fontSize:11,color:"#A39C8A",marginTop:1,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>{t.obs}</div>}
          {t.excluido&&<span className="badge" style={{background:"#FBECEA",color:"#B4483C",border:"1px solid #EBBDB6"}}>Valor excluído da soma de valores</span>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,fontWeight:800,color:t.excluido?"#bbb":"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(t.valor)}</div>
          {t.data>hoje()&&!t.excluido&&<div style={{fontSize:9.5,fontWeight:700,color:"#8A3A30",marginTop:2,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>Agendado · {fmtDate(t.data)}</div>}
        </div>
        {!limpo&&!t.excluido&&!isFechado&&t.data>hoje()&&(
          <button onClick={()=>provisionar(t)} title="Mover para executado" style={{background:"#EAF3EF",border:"1px solid #BFDCD1",color:"#235448",borderRadius:8,fontSize:10.5,fontWeight:700,padding:"5px 8px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Executar</button>
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
          {[["caixa","Caixa"],["inicio","Despesa"],["aplicado","Aplicado"],["categorias","Categorias"],["historico","Histórico"],["relatorio","Relatório"]].map(([v,l])=>(
            <button key={v} className="tab" onClick={()=>setView(v)}
              style={{flex:"1 0 auto",whiteSpace:"nowrap",background:"none",border:"none",borderBottom:view===v?"2.5px solid #2E6E5E":"2.5px solid transparent",color:view===v?"#2E6E5E":"#A39C8A",padding:"10px 5px",fontSize:10,letterSpacing:"0.02em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:800,transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </nav>
      </div>

      <div style={{padding:"20px 16px 120px"}}>
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
                  <div style={{fontSize:fmt(totalProgramado).length<=11?16:13,fontWeight:800,color:"#8A6A1F",lineHeight:1.1,fontFamily:"'Fraunces',serif"}}>{fmt(totalProgramado)}</div>
                  <div style={{fontSize:9.5,color:"#A39C8A",marginTop:6,fontWeight:600,lineHeight:1.35,fontFamily:"'Inter',sans-serif"}}>
                    {agendados.length>0?`inclui ${fmt(totalAgendado)} a entrar (${agendados.length})`:"nada agendado"}
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
                    <div style={{fontSize:11,color:"#C9A566",marginTop:4,fontWeight:600}}>acumulado {carteira.acum>=0?"+":""}{carteira.acum.toFixed(2).replace(".",",")}% em {carteira.n} {carteira.n===1?"mês":"meses"} · desde {MES_AB[parseInt(carteira.desde.slice(5),10)-1]}/{carteira.desde.slice(2,4)}</div>
                    <div style={{fontSize:11,color:"#F4F2ED",marginTop:3,fontWeight:600}}>Rendeu sozinho + {fmt(carteira.rend)} <span style={{color:"#C9A566",fontWeight:500}}>(já incluso no total)</span></div>
                  </>
                  :<div style={{fontSize:12,color:"#F4F2ED",marginTop:6,fontWeight:600,lineHeight:1.4}}>Registre o rendimento para acompanhar quanto a carteira cresce sozinha.</div>}
                {rendAberto&&(
                  <div style={{marginTop:12,borderTop:"1px solid #FFFFFF22",paddingTop:6}}>
                    <div style={{fontSize:9,letterSpacing:"0.1em",color:"#C9A566",textTransform:"uppercase",fontWeight:700,margin:"4px 0 2px"}}>Rendimentos cadastrados</div>
                    {aplicadoOrd.filter(t=>t.meio==="Rendimento").length===0
                      ?<div style={{fontSize:12,color:"#F4F2ED",padding:"8px 0",fontWeight:600}}>Nenhum rendimento cadastrado.</div>
                      :aplicadoOrd.filter(t=>t.meio==="Rendimento").map((t,i,arr)=>(
                        <div key={t.id} className="row-item" {...(!isFechado?lpProps("lanc",t):{})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<arr.length-1?"1px solid #FFFFFF18":"none",userSelect:"none",WebkitUserSelect:"none",WebkitTouchCallout:"none"}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:12,color:"#F4F2ED",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{fmtDate(t.data)} · {MESES_NOMES_FULL[parseInt(t.mes.slice(5,7),10)-1]}</div>
                            {t.obs&&<div style={{fontSize:10,color:"#C9A566",marginTop:2,fontWeight:600}}>{t.obs}</div>}
                          </div>
                          <div style={{fontSize:13,color:"#F4F2ED",fontWeight:800,fontFamily:"'Inter',sans-serif",flexShrink:0}}>+ {fmt(t.valor)}</div>
                        </div>
                      ))}
                    {!isFechado&&<button onClick={()=>{setFormRend({taxa:"",data:hoje()});setErroRend(null);setShowRend(true);}} style={{marginTop:10,background:"transparent",border:"1px solid #C9A56688",color:"#C9A566",borderRadius:8,fontSize:11,fontWeight:700,padding:"7px 12px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Registrar rendimento</button>}
                    {aplicadoOrd.some(t=>t.meio==="Rendimento")&&!isFechado&&<div style={{fontSize:9.5,color:"#C9A56699",marginTop:8}}>Clique com o botão direito (ou segure) num rendimento para editar ou excluir.</div>}
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
                        <div style={{fontSize:11,color:"#A39C8A",fontFamily:"'Inter',sans-serif",marginTop:2}}>{fmtDate(t.data)} · {MESES_NOMES_FULL[parseInt(t.mes.slice(5,7),10)-1]} {t.mes.slice(0,4)}</div>
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
              const isProg=t=>!t.excluido&&t.data>hoje();
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

      {!anyModal&&!isFechado&&view!=="caixa"&&view!=="relatorio"&&(
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
            <FormBody form={form} setForm={setForm} erro={erro} setErro={setErro} permiteRecorrencia/>
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
        const it=ctx.item, prog=ctx.kind==="lanc"&&it.data>hoje();
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
                {ic(<><polyline points="20 6 9 17 4 12"/></>)}<span>Mover para executado</span>
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
            <div style={{fontSize:11,color:"#A39C8A",marginBottom:18,fontFamily:"'Inter',sans-serif"}}>Informe a taxa anual. O app calcula o rendimento em reais sobre o montante aplicado.</div>
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
            <div style={{height:16}}/>
            <button className="btn-success" onClick={salvarRendimento}>Registrar Rendimento</button>
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
            {acaoItem.data>hoje()&&<button className="btn-success" onClick={()=>{const t=acaoItem;setAcaoItem(null);provisionar(t);}}>Mover para executado</button>}
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
            <FormBody form={form} setForm={setForm} erro={erro} setErro={setErro}/>
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
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}
