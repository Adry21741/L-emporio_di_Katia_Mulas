const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=n=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(n||0);
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const SHAPES={
 top:"M30 18L42 12Q50 20 58 12L70 18L90 38L78 48L70 42V105H30V42L22 48L10 38Z",
 jacket:"M28 16L42 10L50 24L58 10L72 16L92 40L80 52L72 46V108H28V46L20 52L8 40Z",
 trousers:"M32 10H68L74 112H56L50 40L44 112H26Z",
 dress:"M40 8H60L62 34L82 112H18L38 34Z",
 shoe:"M8 74Q8 58 24 56L42 58Q54 68 72 68Q94 70 94 86V92H8Z",
 bag:"M18 50H82L88 110H12Z M36 50Q36 22 50 22Q64 22 64 50H58Q58 30 50 30Q42 30 42 50Z"
};
const art=(t,c)=>{const d=SHAPES[t]||SHAPES.top;return `<svg viewBox="0 0 100 120" aria-hidden="true"><path d="${d}" fill="${esc(c||"#888")}"/><path d="${d}" fill="url(#sh)" stroke="rgba(0,0,0,.18)" stroke-width=".6" stroke-linejoin="round"/></svg>`};

let products=[],loaded=false,cat="Tutti",q="",sort="new",onlyWish=false;
let cart=ld("a24cart",[]),wish=ld("a24wish",[]),promo=ld("a24promo",false),orders=[];
let db=null,user=null,uid=null,isAdmin=false,cur=null,sz=null,doneId=null,authMode="login";

$("#stage").innerHTML=art("jacket","#5b4636")+art("dress","#a8574a")+art("shoe","#2f3a34");

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),2600)}

const productFromRow=p=>({id:p.id,name:p.name,cat:p.cat,type:p.type,price:Number(p.price),color:p.color,colorName:p.color_name,sizes:p.sizes,desc:p.description,isNew:p.is_new,createdAt:Date.parse(p.created_at)});
const orderFromRow=o=>({id:o.order_number,at:Date.parse(o.created_at),name:o.customer_name,email:o.customer_email,total:Number(o.total),promo:o.promo,items:o.items||[]});

async function syncAuth(nextUser){
  user=nextUser||null;uid=user?.id||null;isAdmin=false;orders=[];
  if(db&&uid){
    const admin=await db.from("admin_users").select("user_id").eq("user_id",uid).maybeSingle();
    isAdmin=!admin.error&&!!admin.data;
    if(isAdmin){const result=await db.from("orders").select("*").order("created_at",{ascending:false}).limit(100);if(!result.error)orders=(result.data||[]).map(orderFromRow)}
  }
  $("#bAdm").hidden=!isAdmin;$("#bAuth").textContent=uid?"Esci":"Accedi";
  if($("#adm").open)drawAdm();
}

async function loadProducts(){
  const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
  if(error)throw error;
  products=(data||[]).map(productFromRow);loaded=true;
  emptyMsg=isAdmin?"Il catalogo è vuoto: aggiungi i primi prodotti da Gestione.":"Il catalogo è in aggiornamento.";
  render();
}

function drawAuth(){
  const signup=authMode==="signup";
  $("#authb").innerHTML=`<h2>${signup?"Crea un account":"Accedi"}</h2><form id="authForm"><label class="lbl" for="authEmail">Email</label><input class="inp" id="authEmail" type="email" autocomplete="email" required><label class="lbl" for="authPassword">Password</label><input class="inp" id="authPassword" type="password" autocomplete="${signup?"new-password":"current-password"}" minlength="8" required><p class="msg" id="authMsg"></p><button class="btn" type="submit">${signup?"Registrati":"Accedi"}</button></form><button class="linkbtn" id="authToggle">${signup?"Hai già un account? Accedi":"Nuovo cliente? Crea un account"}</button>`;
}

function openAuth(){authMode="login";drawAuth();$("#auth").showModal()}

async function submitAuth(e){
  e.preventDefault();
  const email=$("#authEmail").value.trim(),password=$("#authPassword").value,msg=$("#authMsg");
  const result=authMode==="signup"?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});
  if(result.error){msg.textContent=result.error.message;return}
  if(authMode==="signup"&&!result.data.session){msg.textContent="Account creato. Controlla l’email per confermare l’accesso.";return}
  $("#auth").close();
  if(result.data.user)await syncAuth(result.data.user);
}

function list(){
  const f=products.filter(p=>(cat==="Tutti"||p.cat===cat)&&(!onlyWish||wish.includes(p.id))&&(!q||(p.name+" "+p.cat+" "+(p.colorName||"")).toLowerCase().includes(q)));
  const s={new:(a,b)=>(b.createdAt||0)-(a.createdAt||0),asc:(a,b)=>a.price-b.price,desc:(a,b)=>b.price-a.price}[sort];
  return f.sort(s);
}
function card(p,i){
  const on=wish.includes(p.id);
  return `<article class="card" style="--d:${Math.min(i||0,8)*70}ms"><button class="tile" data-open="${esc(p.id)}" aria-label="Dettagli di ${esc(p.name)}">${art(p.type,p.color)}${p.isNew?'<span class="badge">Novità</span>':""}</button><button class="heart${on?" on":""}" data-wish="${esc(p.id)}" aria-pressed="${on}" aria-label="Preferiti">${on?"♥":"♡"}</button><div class="meta"><div><h3>${esc(p.name)}</h3><p>${esc(p.cat)} · ${esc(p.colorName)}</p></div><b>${eur(p.price)}</b></div></article>`;
}
function render(){
  const cats=["Tutti",...new Set(products.map(p=>p.cat).filter(Boolean))];
  $("#chips").innerHTML=cats.map(c=>`<button class="chip${c===cat?" on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")+(onlyWish?'<button class="chip on" data-allwish>♥ Solo preferiti ✕</button>':"");
  const l=list();
  $("#count").textContent=loaded?`${l.length} ${l.length===1?"capo":"capi"}`:"";
  $("#grid").innerHTML=!loaded?'<div class="skel"></div>'.repeat(6):l.length?l.map(card).join(""):`<p class="empty">${products.length?"Nessun capo corrisponde alla ricerca.":esc(emptyMsg)}</p>`;
  $("#wc").textContent=wish.length;$("#cc").textContent=cart.reduce((a,i)=>a+i.qty,0);reveal();
}
let emptyMsg="Il catalogo si sta caricando…";
const io="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}}),{threshold:.1}):null;
function reveal(){document.querySelectorAll(".card:not(.in)").forEach(c=>io?io.observe(c):c.classList.add("in"))}

/* Scheda prodotto */
function openQV(id){cur=products.find(p=>p.id===id);if(!cur)return;sz=(cur.sizes||[]).length===1?cur.sizes[0]:null;drawQV();$("#qv").showModal()}
function drawQV(){
  const p=cur;
  $("#qvb").innerHTML=`<div class="qv"><div class="tile qa">${art(p.type,p.color)}</div><div class="qi"><p class="eyebrow">${esc(p.cat)}</p><h2>${esc(p.name)}</h2><p class="price">${eur(p.price)}</p><p class="desc">${esc(p.desc)}</p><p class="lbl">Colore: ${esc(p.colorName)}</p><p class="lbl">Taglia</p><div class="sizes">${(p.sizes||[]).map(s=>`<button class="sz${s===sz?" on":""}" data-size="${esc(s)}">${esc(s)}</button>`).join("")}</div><p class="msg" id="qvm"></p><button class="btn" id="addb">Aggiungi alla borsa</button></div></div>`;
}

/* Borsa */
const save=()=>{sv("a24cart",cart);sv("a24promo",promo)};
function addCart(p,s){const k=cart.find(i=>i.id===p.id&&i.size===s);if(k)k.qty++;else cart.push({id:p.id,size:s,qty:1});save()}
function openCart(){doneId=null;drawCart();$("#drawer").classList.add("open");$("#veil").classList.add("open");render()}
function closeCart(){$("#drawer").classList.remove("open");$("#veil").classList.remove("open")}
function calc(){
  const rows=cart.map(i=>({i,p:products.find(p=>p.id===i.id)})).filter(r=>r.p);
  const sub=rows.reduce((a,r)=>a+r.p.price*r.i.qty,0),disc=promo?sub*.1:0,after=sub-disc;
  const ship=!rows.length||after>=150?0:7.9;
  return{rows,sub,disc,after,ship,total:after+ship};
}
function drawCart(){
  const dl=$("#dl"),df=$("#df");
  if(doneId){dl.innerHTML=`<div class="done"><h3>Grazie per l’ordine!</h3><p class="lbl">Numero ordine <b>${esc(doneId)}</b>. Ti scriveremo non appena sarà confermato.</p></div>`;df.innerHTML='<button class="btn" data-close-cart>Continua gli acquisti</button>';return}
  const c=calc();
  dl.innerHTML=c.rows.length?c.rows.map(({i,p})=>`<div class="row"><div class="tile">${art(p.type,p.color)}</div><div><b>${esc(p.name)}</b><br><small>${esc(p.colorName)} · ${esc(i.size)}</small><br><span class="qty"><button data-qty="${esc(i.id)}|${esc(i.size)}|-1" aria-label="Meno">−</button>${i.qty}<button data-qty="${esc(i.id)}|${esc(i.size)}|1" aria-label="Più">+</button></span></div><div style="text-align:right">${eur(p.price*i.qty)}<br><button data-rm="${esc(i.id)}|${esc(i.size)}" class="lbl">Rimuovi</button></div></div>`).join(""):'<p class="empty">La borsa è vuota.</p>';
  const left=150-c.after;
  df.innerHTML=c.rows.length?`<div class="lbl" style="margin:0">${left>0?`Ancora ${eur(left)} per la spedizione gratuita`:"Hai la spedizione gratuita ✓"}</div><div class="bar2"><i style="width:${Math.min(100,c.after/150*100)}%"></i></div>
  <div style="display:flex;gap:8px"><input class="inp" id="pc" placeholder="Codice sconto" value="${promo?"ATELIER10":""}"><button class="btn ghost" id="pa" style="padding:10px 18px">Applica</button></div>
  <div class="tot"><span>Subtotale</span><span>${eur(c.sub)}</span></div>${c.disc?`<div class="tot"><span>Sconto 10%</span><span>−${eur(c.disc)}</span></div>`:""}<div class="tot"><span>Spedizione</span><span>${c.ship?eur(c.ship):"Gratuita"}</span></div><div class="tot big"><span>Totale</span><span>${eur(c.total)}</span></div>
  <input class="inp" id="on" placeholder="Nome e cognome" autocomplete="name"><input class="inp" id="oe" type="email" placeholder="Email" autocomplete="email"><p class="msg" id="om"></p><button class="btn" id="co">Conferma ordine</button>`:"";
}
async function checkout(){
  const name=$("#on").value.trim(),email=$("#oe").value.trim(),m=$("#om");
  if(!name||!/^\S+@\S+\.\S+$/.test(email)){m.textContent="Inserisci nome ed email validi.";return}
  if(!db||!uid){m.textContent="Accedi o crea un account per completare l’ordine.";openAuth();return}
  const c=calc();if(!c.rows.length)return;
  const order={id:"A24-"+Date.now().toString(36).toUpperCase(),at:Date.now(),name,email,total:Math.round(c.total*100)/100,promo:!!promo,items:c.rows.map(r=>({n:r.p.name,s:r.i.size,q:r.i.qty,p:r.p.price}))};
  $("#co").disabled=true;
  try{
    const {error}=await db.from("orders").insert({user_id:uid,order_number:order.id,customer_name:name,customer_email:email,total:order.total,promo:order.promo,items:order.items});
    if(error)throw error;
    cart=[];promo=false;save();doneId=order.id;drawCart();render();
  }catch(e){m.textContent="Ordine non registrato: il tuo accesso non permette di scrivere.";$("#co").disabled=false}
}

/* Gestione (solo editor/proprietario) */
function drawAdm(){
  const rev=orders.reduce((a,o)=>a+(o.total||0),0),last=[...orders].sort((a,b)=>b.at-a.at).slice(0,8);
  $("#admb").innerHTML=`<h2>Gestione negozio</h2><div class="stats"><div class="stat"><b>${products.length}</b>prodotti</div><div class="stat"><b>${orders.length}</b>ordini</div><div class="stat"><b>${eur(rev)}</b>incasso</div></div>
  <h4>Nuovo prodotto</h4><div class="frm"><input class="inp full" id="an" placeholder="Nome"><select class="inp" id="ac"><option>Uomo</option><option>Donna</option><option>Accessori</option></select><select class="inp" id="at"><option value="top">Maglia/Camicia</option><option value="jacket">Giacca</option><option value="trousers">Pantaloni</option><option value="dress">Abito</option><option value="shoe">Scarpe</option><option value="bag">Borsa</option></select><input class="inp" id="ap" type="number" min="0" step="0.5" placeholder="Prezzo €"><input class="inp" id="ak" type="color" value="#5b4636" aria-label="Colore"><input class="inp" id="aw" placeholder="Nome colore"><input class="inp" id="az" placeholder="Taglie (S,M,L)"><input class="inp full" id="ad" placeholder="Descrizione"></div><p class="msg" id="am"></p><button class="btn" id="aadd">Aggiungi al catalogo</button>
  <h4>Catalogo</h4>${products.map(p=>`<div class="ar"><span>${esc(p.name)} · ${eur(p.price)}</span><button data-del="${esc(p.id)}">Elimina</button></div>`).join("")||'<p class="lbl">Nessun prodotto.</p>'}
  <h4>Ultimi ordini</h4>${last.map(o=>`<div class="ar"><span>${esc(o.id)} · ${esc(o.name)}</span><span>${eur(o.total)}</span></div>`).join("")||'<p class="lbl">Ancora nessun ordine.</p>'}`;
}
async function addProduct(){
  const v=id=>$("#"+id).value.trim(),m=$("#am"),price=parseFloat(v("ap"));
  if(!v("an")||!(price>=0)||!v("az")){m.textContent="Compila nome, prezzo e taglie.";return}
  try{
    const {data,error}=await db.from("products").insert({name:v("an"),cat:v("ac"),type:v("at"),price,color:v("ak"),color_name:v("aw")||"—",sizes:v("az").split(",").map(s=>s.trim()).filter(Boolean),description:v("ad"),is_new:true}).select("*").single();
    if(error)throw error;
    products.unshift(productFromRow(data));render();drawAdm();
  }catch(e){m.textContent="Impossibile salvare: permessi insufficienti."}
}

/* Eventi */
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,[data-close]");if(!t)return;const d=t.dataset;
  if(d.open)openQV(d.open);
  else if(d.wish){wish=wish.includes(d.wish)?wish.filter(x=>x!==d.wish):[...wish,d.wish];sv("a24wish",wish);if(!wish.length)onlyWish=false;render()}
  else if(d.cat){cat=d.cat;render()}
  else if(t.hasAttribute("data-allwish")){onlyWish=false;render()}
  else if(d.size){sz=d.size;drawQV()}
  else if(t.id==="addb"){if(!sz){$("#qvm").textContent="Scegli una taglia.";return}addCart(cur,sz);$("#qv").close();openCart()}
  else if(t.hasAttribute("data-close"))t.closest("dialog").close();
  else if(t.hasAttribute("data-close-cart"))closeCart();
  else if(d.qty){const[id,s,n]=d.qty.split("|"),i=cart.find(x=>x.id===id&&x.size===s);if(i){i.qty+=+n;if(i.qty<1)cart=cart.filter(x=>x!==i)}save();drawCart();render()}
  else if(d.rm){const[id,s]=d.rm.split("|");cart=cart.filter(x=>!(x.id===id&&x.size===s));save();drawCart();render()}
  else if(t.id==="pa"){promo=$("#pc").value.trim().toUpperCase()==="ATELIER10";save();drawCart();if(!promo)$("#om").textContent="Codice non valido."}
  else if(t.id==="co")checkout();
  else if(t.id==="aadd")addProduct();
  else if(d.del){const {error}=await db.from("products").delete().eq("id",d.del);if(error)toast("Eliminazione non riuscita: verifica i permessi.");else{products=products.filter(p=>p.id!==d.del);render();drawAdm()}}
  else if(t.id==="bBag")openCart();
  else if(t.id==="bWish"){if(!wish.length){toast("Tocca ♡ su un capo per salvarlo");return}onlyWish=!onlyWish;render();$("#coll").scrollIntoView()}
  else if(t.id==="bAdm"){drawAdm();$("#adm").showModal()}
  else if(t.id==="bAuth"){if(uid)await db.auth.signOut();else openAuth()}
  else if(t.id==="authToggle"){authMode=authMode==="login"?"signup":"login";drawAuth()}
  else if(t.id==="cta")$("#coll").scrollIntoView();
});
$("#authb").addEventListener("submit",e=>{if(e.target.id==="authForm")submitAuth(e)});
$("#veil").addEventListener("click",closeCart);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCart()});
$("#q").addEventListener("input",e=>{q=e.target.value.trim().toLowerCase();render()});
$("#sort").addEventListener("change",e=>{sort=e.target.value;render()});
render();

/* Database */
async function startSupabase(){
  const url=window.ATELIER_SUPABASE_URL,key=window.ATELIER_SUPABASE_ANON_KEY;
  if(!url||!key){loaded=true;emptyMsg="Configura Supabase per caricare il catalogo.";render();return}
  if(!window.supabase?.createClient)throw new Error("Supabase JS non disponibile");
  db=window.supabase.createClient(url,key);
  db.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>syncAuth(session?.user),0));
  const {data,error}=await db.auth.getSession();if(error)throw error;
  await syncAuth(data.session?.user);
  await loadProducts();
  db.channel("public-products").on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>loadProducts().catch(()=>{})).subscribe();
}
startSupabase().catch(()=>{loaded=true;emptyMsg="Supabase non raggiungibile: controlla configurazione e schema.";render()});