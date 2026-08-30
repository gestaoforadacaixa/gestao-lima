import { useState, useEffect, useMemo, useCallback } from "react";

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
const MES_INICIO = "2026-09";
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
const hoje    = () => new Date().toISOString().slice(0,10);
const d2brl   = d => { const n=parseInt(d||"0",10); return `${Math.floor(n/100).toLocaleString("pt-BR")},${String(n%100).padStart(2,"0")}`; };
const d2float = d => parseInt(d||"0",10)/100;
const float2d = v => String(Math.round(v*100));
const soma    = arr => arr.filter(t=>!t.excluido && t.meio!=="Pluxe" && t.categoria!=="Aplicado" && t.data<=hoje()).reduce((s,t)=>s+t.valor,0);
const padN    = n => String(n).padStart(2,"0");
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
.fab{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#173C33,#2E6E5E);color:#F4F2ED;border:none;border-radius:50px;padding:15px 28px;font-size:14px;font-family:'Inter',sans-serif;font-weight:700;cursor:pointer;box-shadow:0 6px 24px #173C3345;z-index:90;display:flex;align-items:center;gap:8px;transition:all .2s;white-space:nowrap}
.fab-gold{background:linear-gradient(135deg,#A6822E,#C9A566);box-shadow:0 6px 24px #A6822E40}
.fab:hover{transform:translateX(-50%) translateY(-2px)} .fab:active{transform:translateX(-50%) scale(.98)}
.overlay{position:fixed;inset:0;background:#00000055;z-index:200;display:flex;align-items:flex-end}
.sheet{background:#fff;border-radius:24px 24px 0 0;padding:8px 20px 40px;width:100%;max-width:480px;margin:0 auto;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);max-height:94vh;overflow-y:auto}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
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
const emptyForm=()=>({descricao:"",valorDigits:"",categoria:"",meio:"",data:hoje(),obs:""});
const emptyFormReceita=()=>({descricao:"",valorDigits:"",data:hoje(),obs:""});
const INP=err=>({background:"#FAF9F6",border:`2px solid ${err?"#B4483C":"#E3DFD3"}`,borderRadius:10,color:"#173C33",padding:"13px 14px",fontSize:15,fontFamily:"'Inter',sans-serif",width:"100%",transition:"border .2s"});
const FL={fontSize:11,color:"#7A7466",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:7,display:"block",fontWeight:700,fontFamily:"'Inter',sans-serif"};
function FormBody({form,setForm,erro,setErro}) {
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
          {MEIOS.map(m=><option key={m} value={m}>{m}</option>)}
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
const INIT_STATE = Object.fromEntries(MESES.map(m=>[m.mes,[]]));
const INIT_RECEITAS = Object.fromEntries(MESES.map(m=>[m.mes,[]]));

export default function App() {
  const idxHoje = MESES.findIndex(m => m.mes === new Date().toISOString().slice(0,7));
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
    setAllItems(p => ({...p, [mesAtual.mes]: dAtual||[], ...(mesAnt ? {[mesAnt.mes]: dAnt||[]} : {})}));
    setAllReceitas(p => ({...p, [mesAtual.mes]: rAtual||[]}));
    setAplicadoTodos(aplicAll||[]);
    setLastSync(new Date());
    if (!silent) setLoading(false);
  }, [mesAtual.mes, mesAnt]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (showForm || showFormReceita || editItem || delItem || delReceita) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [load, showForm, showFormReceita, editItem, delItem, delReceita]);

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
  const totalReceita = useMemo(()=>receitas.reduce((s,r)=>s+r.valor,0),[receitas]);
  const saldo        = totalReceita - total;
  const maxDia     = useMemo(()=>{const d=items.map(t=>parseInt(t.data.slice(8,10)));return d.length?Math.max(...d):31;},[items]);
  const totalAnt   = useMemo(()=>soma(itemsAnt.filter(t=>parseInt(t.data.slice(8,10))<=maxDia)),[itemsAnt,maxDia]);
  const sorted     = useMemo(()=>[...items].sort((a,b)=>new Date(b.data)-new Date(a.data)),[items]);
  const sortedReceitas = useMemo(()=>[...receitas].sort((a,b)=>new Date(b.semana)-new Date(a.semana)),[receitas]);
  const totalAplicadoGeral = useMemo(()=>aplicadoTodos.reduce((s,t)=>s+t.valor,0),[aplicadoTodos]);
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
      recorrente: false, motivo_exclusao: "",
    };
    const res = await sbPost(item);
    setShowForm(false);
    if(res){ load(); showToast("✓ Lançamento registrado"); }
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
  const confirmarExclusaoReceita=async ()=>{
    const ok = await rcDelete(delReceita.id);
    setDelReceita(null);
    if(ok){ load(); showToast("Receita excluída"); }
  };

  const anyModal=showForm||showFormReceita||!!editItem||!!delItem||!!delReceita;
  const card={background:"#fff",borderRadius:14,padding:"4px 16px",boxShadow:"0 2px 8px #173C3310",marginBottom:12};
  const rowDiv=last=>({padding:"13px 0",borderBottom:last?"none":"1px solid #F0EEE6",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10});

  const LancRow=({t,last})=>(
    <div className={`row-item${t.excluido?" row-excluido":""}`} style={rowDiv(last)}>
      <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
        <div style={{width:4,height:t.excluido?16:40,background:t.excluido?"#ddd":CAT_CORES[t.categoria]||"#999",borderRadius:3,flexShrink:0}}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,color:t.excluido?"#aaa":"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textDecoration:t.excluido?"line-through":"none"}}>{t.descricao}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"#A39C8A",fontFamily:"'Inter',sans-serif"}}>{fmtDate(t.data)} · {t.categoria} · {t.meio}</span>
            {t.meio==="Pluxe"&&!t.excluido&&<span className="badge" style={{background:"#FBF3E4",color:"#8A6A1F",border:"1px solid #EAD9AE"}}>Pluxe · não conta</span>}
            {t.categoria==="Aplicado"&&!t.excluido&&<span className="badge" style={{background:"#EAF3EF",color:"#235448",border:"1px solid #BFDCD1"}}>Aplicado · não conta</span>}
            {t.data>hoje()&&!t.excluido&&<span className="badge" style={{background:"#FBECEA",color:"#8A3A30",border:"1px solid #EBBDB6"}}>Agendado · {fmtDate(t.data)}</span>}
          </div>
          {t.obs&&!t.excluido&&<div style={{fontSize:11,color:"#A39C8A",marginTop:1,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>{t.obs}</div>}
          {t.excluido&&<span className="badge" style={{background:"#FBECEA",color:"#B4483C",border:"1px solid #EBBDB6"}}>Valor excluído da soma de valores</span>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:800,color:t.excluido?"#bbb":"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(t.valor)}</div>
        {!t.excluido&&!isFechado&&(
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
    <div className="row-item" style={rowDiv(last)}>
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
        {!isFechado&&(
          <button className="icon-btn icon-btn-danger" onClick={()=>setDelReceita(r)} title="Excluir">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#F4F2ED",minHeight:"100vh",color:"#173C33",maxWidth:480,margin:"0 auto"}}>
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
        <nav style={{display:"flex",marginTop:2}}>
          {[["caixa","Caixa"],["inicio","Despesa"],["aplicado","Aplicado"],["categorias","Categorias"],["historico","Histórico"]].map(([v,l])=>(
            <button key={v} className="tab" onClick={()=>setView(v)}
              style={{flex:1,background:"none",border:"none",borderBottom:view===v?"2.5px solid #2E6E5E":"2.5px solid transparent",color:view===v?"#2E6E5E":"#A39C8A",padding:"10px 2px",fontSize:10.5,letterSpacing:"0.04em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:800,transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </nav>
      </div>

      <div style={{padding:"20px 16px 120px"}}>
        {view==="inicio"&&(
          <>
            <div style={{background:"#fff",borderRadius:16,padding:"24px 20px",marginBottom:14,boxShadow:"0 2px 12px #173C3310"}}>
              <div style={{fontSize:11,letterSpacing:"0.15em",color:"#A39C8A",textTransform:"uppercase",marginBottom:4,fontWeight:700}}>Total lançado — {mesAtual.label}</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
                <div style={{fontSize:40,fontWeight:800,color:"#173C33",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(total)}</div>
                {mesAnt&&totalAnt>0&&<Comparativo atual={total} anterior={totalAnt} isParcial={!isFechado}/>}
              </div>
              <div style={{fontSize:12,color:"#A39C8A",marginTop:8,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600}}>{contaveis.length} lançamentos ativos</div>
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
            <div style={{fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontWeight:700}}>Fluxo Semanal</div>
            <div style={{...card,padding:"8px 4px"}}>
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
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:20,marginBottom:10}}>
              <div style={{fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:700}}>Recebimentos do Mês</div>
              <div style={{fontSize:11,color:"#A39C8A",fontWeight:700}}>{receitas.length} entrada(s)</div>
            </div>
            <div style={card}>
              {sortedReceitas.length===0
                ?<div style={{padding:"24px 0",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:8}}>💰</div>
                  <div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhum recebimento neste mês.</div>
                  {!isFechado&&<div style={{color:"#A39C8A",fontSize:12,marginTop:4,fontFamily:"'Inter',sans-serif"}}>Toque em "Nova Receita" abaixo</div>}
                </div>
                :sortedReceitas.map((r,i)=><ReceitaRow key={r.id} r={r} last={i===sortedReceitas.length-1}/>)
              }
            </div>
          </>
        )}
        {view==="aplicado"&&(
          <>
            <div style={{background:"linear-gradient(135deg,#173C33,#2E6E5E)",borderRadius:16,padding:"26px 22px",marginBottom:14,boxShadow:"0 4px 20px #173C3325"}}>
              <div style={{fontSize:11,letterSpacing:"0.15em",color:"#C9A566",textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Montante Aplicado (acumulado)</div>
              <div style={{fontSize:36,fontWeight:800,color:"#F4F2ED",lineHeight:1,fontFamily:"'Fraunces',serif"}}>{fmt(totalAplicadoGeral)}</div>
              <div style={{fontSize:11,color:"#C9A566",marginTop:8,fontWeight:600}}>{aplicadoTodos.length} lançamento{aplicadoTodos.length===1?"":"s"} · soma de todos os meses</div>
            </div>
            <div style={{fontSize:10,color:"#A39C8A",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:10,fontWeight:700}}>Extrato de Aplicações</div>
            <div style={card}>
              {aplicadoOrd.length===0
                ?<div style={{padding:"24px 0",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🌱</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhuma aplicação registrada ainda.</div><div style={{color:"#A39C8A",fontSize:12,marginTop:4,fontFamily:"'Inter',sans-serif"}}>Lance uma despesa com categoria "Aplicado" pra começar a somar aqui.</div></div>
                :aplicadoOrd.map((t,i)=>(
                  <div key={t.id} style={rowDiv(i===aplicadoOrd.length-1)}>
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
            </div>
          </>
        )}
        {view==="categorias"&&(
          <>
            <div style={{fontSize:22,fontWeight:800,color:"#173C33",marginBottom:18,fontFamily:"'Fraunces',serif"}}>Por Categoria</div>
            {byCat.length===0
              ?<div style={{...card,padding:24,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📂</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhum lançamento neste mês.</div></div>
              :byCat.map(({cat,val})=>(
                <div key={cat} style={{...card,marginBottom:10}}>
                  <div style={{padding:"12px 0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:CAT_CORES[cat]||"#999",flexShrink:0}}/>
                        <span style={{fontSize:14,color:"#173C33",fontWeight:700,fontFamily:"'Inter',sans-serif"}}>{cat}</span>
                      </div>
                      <span style={{fontSize:14,fontWeight:800,color:"#173C33",fontFamily:"'Inter',sans-serif"}}>{fmt(val)}</span>
                    </div>
                    <Bar percent={total>0?(val/total)*100:0} color={CAT_CORES[cat]||"#999"}/>
                  </div>
                </div>
              ))
            }
          </>
        )}
        {view==="historico"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:22,fontWeight:800,color:"#173C33",fontFamily:"'Fraunces',serif"}}>Histórico</div>
              <div style={{fontSize:11,color:"#A39C8A",fontWeight:600,fontFamily:"'Inter',sans-serif"}}>{items.length} lançamentos</div>
            </div>
            <div style={card}>
              {sorted.length===0
                ?<div style={{padding:"24px 0",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>🗒️</div><div style={{color:"#A39C8A",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:700}}>Nenhum lançamento neste mês.</div></div>
                :sorted.map((t,i)=><LancRow key={t.id} t={t} last={i===sorted.length-1}/>)
              }
            </div>
          </>
        )}
      </div>

      {!anyModal&&!isFechado&&view!=="caixa"&&(
        <button className="fab" onClick={()=>{setForm(emptyForm());setErro({});setShowForm(true);}}>
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
            <div style={{fontSize:20,fontWeight:800,color:"#173C33",marginBottom:20,fontFamily:"'Fraunces',serif"}}>Novo Lançamento</div>
            <FormBody form={form} setForm={setForm} erro={erro} setErro={setErro}/>
            <div style={{height:16}}/>
            <button className="btn-primary" onClick={lancar}>Registrar Lançamento</button>
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
