// Синхронизация данных с GitHub: состояние приложения хранится в файле data/state.json в репозитории.
// Чтение работает у всех (публичный репозиторий), запись — по персональному токену, который
// хранится только в localStorage браузера и никогда не попадает в репозиторий.
(function(){
  const CFG_KEY='sk_sync_cfg', DIRTY_KEY='sk_sync_dirty';
  const loadCfg=()=>{try{return JSON.parse(localStorage.getItem(CFG_KEY))||{}}catch(e){return {}}};
  function cfg(){
    const c=loadCfg(), host=location.hostname;
    const auto=/\.github\.io$/i.test(host)?{owner:host.split('.')[0],repo:location.pathname.split('/')[1]||''}:{owner:'',repo:''};
    return {owner:c.owner||auto.owner,repo:c.repo||auto.repo,branch:c.branch||'main',path:c.path||'data/state.json',token:c.token||''};
  }
  const ready=()=>{const c=cfg();return !!(c.owner&&c.repo)};
  const canWrite=()=>!!(ready()&&cfg().token);
  let busy=false,again=false,timer=null,lastSha=null,lastOk='',statusText='';

  function setStatus(t,kind){
    statusText=t;
    const col=kind==='err'?'#b74646':kind==='ok'?'#16724d':'#62758b';
    for(const id of ['syncFoot','syncCardStatus']){const el=document.getElementById(id);if(el){el.textContent=t;el.style.color=col}}
  }
  const hhmm=()=>new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});

  function b64enc(str){const b=new TextEncoder().encode(str);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)}
  function b64dec(b64){const bin=atob(b64.replace(/\s/g,''));const b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return new TextDecoder().decode(b)}

  function headers(c,extra){const h=Object.assign({'Accept':'application/vnd.github+json'},extra||{});if(c.token)h['Authorization']='Bearer '+c.token;return h}
  const api=c=>`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;

  async function ghGet(c){
    const url=api(c)+'?ref='+encodeURIComponent(c.branch)+'&_='+Date.now();
    const r=await fetch(url,{headers:headers(c),cache:'no-store'});
    if(r.status===404)return null;
    if(!r.ok)throw new Error(await errText(r));
    const j=await r.json();
    let text;
    if(j.content&&j.encoding==='base64')text=b64dec(j.content);
    else{const rr=await fetch(url,{headers:headers(c,{'Accept':'application/vnd.github.raw+json'}),cache:'no-store'});if(!rr.ok)throw new Error(await errText(rr));text=await rr.text()}
    return {sha:j.sha,state:text.trim()?JSON.parse(text):null};
  }
  async function errText(r){let m='';try{m=(await r.json()).message}catch(e){}
    if(r.status===401)return 'Токен неверный или истёк (401)';
    if(r.status===403)return 'Нет доступа или превышен лимит запросов (403)'+(m?': '+m:'');
    if(r.status===404)return 'Репозиторий/ветка не найдены или у токена нет доступа (404)';
    return 'Ошибка GitHub '+r.status+(m?': '+m:'')}

  const keyOf=r=>r.id!=null?String(r.id):[r.created,r.date,r.group,r.foreman].join('|');
  const rank=r=>(r.reviewed?Date.parse(r.reviewed)||1:0);
  function merge(local,remote){
    if(!remote)return local;
    const lu=local.updatedAt||0,ru=remote.updatedAt||0;
    const base=ru>lu?remote:local, other=ru>lu?local:remote;
    const out=JSON.parse(JSON.stringify(base));
    if(!Array.isArray(out.records))out.records=[];
    if(!Array.isArray(out.people))out.people=[];
    if(!Array.isArray(out.questions))out.questions=[];
    if((base.estimateEpoch||0)===(other.estimateEpoch||0)){
      const map=new Map(out.records.map(r=>[keyOf(r),r]));
      for(const r of (other.records||[])){const k=keyOf(r),cur=map.get(k);
        if(!cur){out.records.push(JSON.parse(JSON.stringify(r)));map.set(k,r)}
        else if(rank(r)>rank(cur)){Object.keys(cur).forEach(x=>delete cur[x]);Object.assign(cur,JSON.parse(JSON.stringify(r)))}}
      const qs=new Set(out.questions.map(q=>q.text+'|'+q.date));
      for(const q of (other.questions||[]))if(!qs.has(q.text+'|'+q.date))out.questions.push(q);
    }
    out.updatedAt=Math.max(lu,ru);
    return out;
  }

  function typing(){const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='button')}
  function apply(ns,silent){
    const before=JSON.stringify(state);
    if(JSON.stringify(ns)===before)return false;
    state=ns;
    try{localStorage.setItem(key,JSON.stringify(state))}catch(e){}
    if(Array.isArray(state.estimateGroups)&&state.estimateGroups.length){G=state.estimateGroups;totalCost=sum(G,x=>x.cost);totalLabor=sum(G,x=>x.labor);totalMachine=sum(G,x=>x.machine)}
    if(!silent){const go=()=>{try{render()}catch(e){}};if(typing())setTimeout(()=>{typing()?setTimeout(go,4000):go()},1500);else go()}
    return true;
  }

  async function put(c,st,sha){
    const body={message:'Данные СтройКонтроль: '+new Date().toISOString().slice(0,16).replace('T',' '),content:b64enc(JSON.stringify(st,null,1)),branch:c.branch};
    if(sha)body.sha=sha;
    const r=await fetch(api(c),{method:'PUT',headers:headers(c,{'Content-Type':'application/json'}),body:JSON.stringify(body)});
    if(r.status===409||r.status===422)return {conflict:true};
    if(!r.ok)throw new Error(await errText(r));
    return {sha:(await r.json()).content.sha};
  }

  // Основная операция: подтянуть, слить, при необходимости отправить.
  async function sync(opts){
    opts=opts||{};
    if(!ready()){return}
    if(busy){again=true;return}
    busy=true;
    try{
      const c=cfg();
      setStatus('Синхронизация…');
      for(let attempt=0;attempt<3;attempt++){
        const remote=await ghGet(c);
        const merged=merge(state,remote&&remote.state);
        const changedLocal=apply(merged,false);
        const remoteStr=remote&&remote.state?JSON.stringify(remote.state):'';
        const needPush=localStorage.getItem(DIRTY_KEY)==='1'||opts.force||!remote||(remote.state&&JSON.stringify(merged)!==remoteStr);
        if(!needPush||!canWrite()){
          lastSha=remote&&remote.sha;
          if(needPush&&!canWrite()&&localStorage.getItem(DIRTY_KEY)==='1')setStatus('Изменения только на этом устройстве: укажите токен в разделе «Руководитель»','err');
          else {lastOk=hhmm();setStatus((changedLocal?'Загружены данные из GitHub':'Данные актуальны')+' · '+lastOk,'ok')}
          break;
        }
        const res=await put(c,merged,remote&&remote.sha);
        if(res.conflict){continue}
        lastSha=res.sha;localStorage.removeItem(DIRTY_KEY);lastOk=hhmm();
        setStatus('✓ Сохранено в GitHub · '+lastOk,'ok');
        break;
      }
    }catch(e){
      setStatus('Не синхронизировано: '+(e.message||e)+(localStorage.getItem(DIRTY_KEY)==='1'?' (изменения сохранены локально и будут отправлены позже)':''),'err');
    }finally{
      busy=false;
      if(again){again=false;schedule()}
    }
  }

  function schedule(){
    localStorage.setItem(DIRTY_KEY,'1');
    if(!ready())return;
    if(!canWrite()){setStatus('Изменения только на этом устройстве: укажите токен в разделе «Руководитель»','err');return}
    setStatus('Есть несохранённые изменения…');
    clearTimeout(timer);timer=setTimeout(()=>sync(),2500);
  }

  // ---- интерфейс (вкладка «Руководитель») ----
  function syncCard(){
    const c=cfg(),raw=loadCfg();
    const f=(id,label,val,type,ph)=>`<label>${label}<input id="${id}" type="${type||'text'}" value="${h(val)}" placeholder="${h(ph||'')}" autocomplete="off"></label>`;
    return `<div class="card"><h2>Синхронизация с GitHub</h2>
<p class="muted">Все изменения сохраняются в файл <b>${h(c.path)}</b> репозитория и накапливаются (каждое сохранение — отдельный коммит, историю можно посмотреть и откатить на GitHub). Заявки с разных телефонов объединяются.</p>
<form onsubmit="event.preventDefault();SKSync.saveCfg()">
${f('syncOwner','Владелец (логин GitHub)',c.owner,'text','user')}${f('syncRepo','Репозиторий',c.repo,'text','stroykontrol')}${f('syncBranch','Ветка',c.branch)}${f('syncPath','Файл данных',c.path)}
${f('syncToken','Токен GitHub (для записи)',raw.token||'','password','github_pat_…')}
<button>Сохранить настройки</button></form>
<p><button type="button" class="outline" onclick="SKSync.pull()">Загрузить из GitHub</button> <button type="button" class="outline" onclick="SKSync.push()">Отправить сейчас</button></p>
<p id="syncCardStatus" class="muted" role="status">${h(statusText||(ready()?'Готово к работе':'Укажите владельца и репозиторий'))}</p>
<details><summary>Как получить токен</summary>
<ol class="muted"><li>GitHub → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
<li>Repository access: <b>Only select repositories</b> → выберите этот репозиторий.</li>
<li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
<li>Скопируйте токен и вставьте выше. Он хранится только в браузере этого устройства.</li></ol>
<p class="warn">Токен даёт право записи в репозиторий — выдавайте его только доверенным людям. Читать данные может любой, у кого есть доступ к репозиторию (в публичном репозитории — все).</p></details></div>`;
  }
  function saveCfg(){
    const v=id=>(document.getElementById(id)?.value||'').trim();
    const c={owner:v('syncOwner'),repo:v('syncRepo'),branch:v('syncBranch')||'main',path:(v('syncPath')||'data/state.json').replace(/^\/+/,''),token:v('syncToken')};
    localStorage.setItem(CFG_KEY,JSON.stringify(c));
    setStatus('Настройки сохранены');
    sync({force:canWrite()});
  }
  const pull=()=>sync();
  const push=()=>{localStorage.setItem(DIRTY_KEY,'1');return sync({force:true})};

  window.SKSync={schedule,sync,pull,push,saveCfg,merge,_cfg:cfg};
  window.syncCard=syncCard;

  function init(){
    const foot=document.querySelector('.foot');
    if(foot)foot.insertAdjacentHTML('beforeend','<div id="syncFoot" style="margin-top:6px"></div>');
    if(ready()){setStatus('Подключение к GitHub…');sync()}
    else setStatus('Синхронизация с GitHub не настроена (вкладка «Руководитель»)');
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ready()&&!typing())sync()});
    setInterval(()=>{if(ready()&&!typing()&&!document.hidden)sync()},canWrite()?60000:180000);
  }
  init();
})();
