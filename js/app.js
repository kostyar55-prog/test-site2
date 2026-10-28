const key='sk_5uch_v2';let state;try{state=JSON.parse(localStorage.getItem(key))}catch(e){};if(!state)state={end:'2026-12-31',start:'2026-10-27',controller:'',manager:'',foreman:'',records:[],people:[],questions:[],bonusRate:10};
if(!state.projectName)state.projectName='5 участок — технологическое оборудование';
if(Array.isArray(state.estimateGroups)&&state.estimateGroups.length)G=state.estimateGroups;
if(!Array.isArray(state.people))state.people=[];const save=()=>{try{state.updatedAt=Date.now();localStorage.setItem(key,JSON.stringify(state));if(window.SKSync)SKSync.schedule();return true}catch(err){alert('Данные изменены, но браузер не разрешил сохранить их на диск. Для надежного сохранения откройте файл в Chrome или используйте экспорт JSON.');return false}};const money=n=>Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';const num=n=>Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2});const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const fmtDate=s=>s?dateRU(s):'не задан';const sum=(a,f)=>a.reduce((v,x)=>v+f(x),0);const done=i=>sum(state.records.filter(x=>x.group===i&&x.status==='approved'),x=>Number(x.agreedQty ?? x.qty));const submitted=i=>sum(state.records.filter(x=>x.group===i&&x.status==='pending'),x=>x.qty);let totalCost=sum(G,x=>x.cost);let totalLabor=sum(G,x=>x.labor);let totalMachine=sum(G,x=>x.machine);const progress=()=>sum(G,(g,i)=>g.cost*Math.min(1,done(i)/g.qty))/totalCost;const hours=()=>sum(G,(g,i)=>g.labor*Math.min(1,done(i)/g.qty));const dateDays=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);let tab='dashboard';
const tabs=[['dashboard','Сводка'],['works','Работы'],['daily','Прораб'],['control','Контроль'],['staff','Бригада и ФОТ'],['manager','Руководитель'],['sources','Смета']];
function show(t){tab=t;render()};
function dateToISO(v){
  v=String(v||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m=v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if(!m) return v;
  const d=m[1].padStart(2,'0'), mo=m[2].padStart(2,'0');
  return `${m[3]}-${mo}-${d}`;
}
function dateRU(v){
  v=String(v||'').trim();
  const iso=dateToISO(v);
  const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}
function validRUDate(v){
  const iso=dateToISO(v);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y,m,d]=iso.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d;
}

function render(){document.getElementById('projectHeaderName').textContent=state.projectName||'Объект без названия';document.title='СтройКонтроль — '+(state.projectName||'Объект');document.getElementById('nav').innerHTML=tabs.map(([id,n])=>`<button class="${tab===id?'active':''}" onclick="show('${id}')">${n}</button>`).join('');document.getElementById('app').innerHTML=({dashboard:dashboard,works:works,daily:daily,control:control,staff:staff,manager:manager,sources:sources}[tab])()};

function dashboard(){
 const today=new Date().toISOString().slice(0,10);
 const start=dateToISO(state.start),end=dateToISO(state.end);
 const validDates=validRUDate(start)&&validRUDate(end)&&end>=start;
 const totalDays=validDates?workdays(start,end):0;
 const elapsed=validDates?workdays(start,today<end?today:end):0;
 const remaining=validDates?workdays(today>end?end:today,end):0;
 const planShare=totalDays?Math.min(1,elapsed/totalDays):0;
 const earned=hours();
 const approved=state.records.filter(r=>r.status==='approved');
 const allReports=state.records.filter(r=>r.status==='approved'||r.status==='pending'||r.status==='rejected');
 // The daily form submits one record per work type, with the SAME team and shift.
 // Count a shift once per submission batch, not once for every work item.
 const shifts=new Map();
 for(const r of allReports){
  const k=r.reportId||`${r.date}|${r.foreman}|${r.created||r.id}`;
  if(!shifts.has(k))shifts.set(k,{date:r.date,h:Number(r.people||0)*Number(r.shift||0)});
 }
 const actual=[...shifts.values()].reduce((n,x)=>n+x.h,0);
 const efficiency=actual>0?earned/actual:null;
 const prod=totalLabor?earned/totalLabor:0;
 const financial=progress();
 const needed=remaining>0?Math.max(0,totalLabor-earned)/remaining:null;
 const elapsedWork=Math.max(1,elapsed);
 const rate=earned/elapsedWork;
 const forecastDays=rate>0?Math.ceil(Math.max(0,totalLabor-earned)/rate):null;
 const delay=forecastDays===null?null:forecastDays-remaining;
 const payroll=sum(state.people,x=>Number(x.salary||0));
 const pipe=G[0],pipeDone=Math.min(pipe.qty,done(0));
 const pipePlan=totalDays?pipe.qty/totalDays:0;
 const pipeActual=elapsed>0?pipeDone/elapsed:0;
 const status=!validDates?'Не заданы корректные сроки':earned<=0?'Пока нет подтвержденной выработки':remaining===0?(prod>=1?'Объект завершен':'Срок истек, есть остаток работ'):rate>=totalLabor/Math.max(1,totalDays)?'Темп выше или равен необходимому':'Текущий темп ниже необходимого';
 const statusColor=earned>0&&rate>=totalLabor/Math.max(1,totalDays)?'good':'warn';
 const bonusReady=efficiency!==null&&earned>0&&validDates;
 const bonusLabel=!bonusReady?'Недостаточно данных для решения':efficiency>=1&&delay!==null&&delay<=0?'Есть основания рассмотреть премию':'Премия требует дополнительной оценки';
 return `<div class="card"><h2>Панель директора — успеваем ли к ${h(fmtDate(end))}?</h2><h2 class="${statusColor}">${h(status)}</h2><p>Срок: ${h(fmtDate(start))} — ${h(fmtDate(end))}. Рабочих дней по плану: <b>${totalDays}</b>, прошло: <b>${elapsed}</b>, осталось: <b>${remaining}</b>.</p><p class="muted">План предварительно распределен равномерно по будням. Без графика по этапам сравнение показывает ориентир, а не точное отставание от ППР.</p></div>
 <div class="metrics">
 <div class="metric">Производственная готовность<strong>${num(prod*100)}%</strong><small>По нормативным часам подтвержденных объемов</small><div class="bar"><i style="width:${Math.min(100,prod*100)}%"></i></div></div>
 <div class="metric">Финансовая готовность<strong>${num(financial*100)}%</strong><small>По сметной стоимости подтвержденных объемов</small></div>
 <div class="metric">Плановая готовность к сегодня<strong>${num(planShare*100)}%</strong><small>По условному линейному графику</small></div>
 <div class="metric">Нормативно заработано<strong>${num(earned)} ч</strong><small>Из ${num(totalLabor)} чел.-ч по смете</small></div>
 <div class="metric">Фактические трудозатраты<strong>${num(actual)} ч</strong><small>Указанные прорабом часы, включая заявки на проверке</small></div>
 <div class="metric">Коэффициент выработки<strong class="${efficiency!==null&&efficiency>=1?'good':'warn'}">${efficiency===null?'—':num(efficiency)}</strong><small>Подтвержденные нормативные часы ÷ все заявленные часы</small></div>
 </div>
 <div class="card"><h2>Наглядный контроль темпа</h2>
 <div class="metrics">
 <div class="metric">Необходимо по объекту<strong>${totalDays?num(totalLabor/totalDays):'—'} норм. чел.-ч/день</strong></div>
 <div class="metric">Фактический темп<strong>${elapsed?num(rate):'—'} норм. чел.-ч/раб. день</strong></div>
 <div class="metric">Нужно с сегодняшнего дня<strong>${needed===null?'Срок истек':num(needed)+' норм. чел.-ч/день'}</strong></div>
 <div class="metric">Прогноз срока<strong>${forecastDays===null?'Недостаточно данных':delay>0?'Опоздание ~'+delay+' раб. дн.':delay<0?'Опережение ~'+Math.abs(delay)+' раб. дн.':'В срок'}</strong></div>
 </div>
 <h3>Монтаж трубопровода — понятный пример</h3>
 <p>Всего по смете: <b>${num(pipe.qty)} м</b>. Контролем принято: <b>${num(pipeDone)} м</b> (${num(pipeDone/pipe.qty*100)}%).</p>
 <p>Чтобы успеть по условному равномерному графику, нужно в среднем <b>${num(pipePlan)} м за рабочий день</b>. Средний подтвержденный темп за прошедшие рабочие дни: <b>${elapsed?num(pipeActual)+' м/день':'пока нет данных'}</b>.</p>
 <p class="${pipeActual>=pipePlan&&elapsed>0?'good':'warn'}">${elapsed>0?(pipeActual>=pipePlan?'По трубопроводу идем с опережением условного графика.':'По трубопроводу темп ниже условного графика.'):'Пока нет рабочих дней для оценки темпа.'}</p>
 <p class="muted">Для точного расчета нужно задать сроки отдельно по трубопроводу, опорам, испытаниям и остальным этапам. Средняя выработка по всему периоду может искажаться, если монтаж трубы запланирован не с первого дня.</p>
 </div>
 <div class="card"><h2>Решение о премировании</h2><h3 class="${bonusReady&&efficiency>=1&&delay!==null&&delay<=0?'good':'warn'}">${bonusLabel}</h3>
 <p>Производительность: <b>${efficiency===null?'Нет данных':num(efficiency)}</b> (ориентир ≥ 1). Сроки: <b>${delay===null?'нет прогноза':delay<=0?'успеваем по текущему темпу':'прогнозируемое отставание'}</b>.</p>
 <p>Фонд окладов: <b>${money(payroll)}</b>. Автоматическую сумму премии пока не начисляем: сначала нужно согласовать формулу, учет качества и правила распределения премии между сотрудниками.</p>
 <p class="muted">Важно: отработанные часы сейчас вводятся на весь дневной отчет. Если за один день отправить несколько отдельных отчетов с одной и той же бригадой, часы могут задвоиться. В следующем этапе добавим единый табель.</p></div>`;
}
function actualHoursByGroup(){
 const result=G.map(()=>0), batches=new Map();
 for(const r of state.records){
  if(!Number.isInteger(Number(r.group))||!G[Number(r.group)])continue;
  const key=r.reportId||String(r.id||r.created||`${r.date}-${r.foreman}-${r.group}`);
  if(!batches.has(key))batches.set(key,[]);
  batches.get(key).push(r);
 }
 for(const rows of batches.values()){
  const first=rows[0],shift=Number(first.people||0)*Number(first.shift||0);
  if(!(shift>0))continue;
  const weights=rows.map(r=>{
   const g=G[Number(r.group)];
   return g.qty>0?Math.max(0,Number(r.qty||0))*g.labor/g.qty:0;
  });
  const total=weights.reduce((a,b)=>a+b,0);
  rows.forEach((r,i)=>{result[Number(r.group)]+=shift*(total>0?weights[i]/total:1/rows.length)});
 }
 return result;
}
function works(){return `<div class="card"><h2>Укрупненные производственные этапы</h2><p class="muted">Фасонные части и арматура учтены внутри связанных этапов. «Норм. чел.-ч» — трудоемкость полного сметного объема. «Факт чел.-ч» — часы, заявленные прорабом; при нескольких работах в одном отчете часы бригады распределяются между этапами пропорционально нормативной трудоемкости заявленных объемов. Это расчетное распределение, а не раздельный табель.</p><div class="scroll"><table><thead><tr><th>Этап</th><th>Ед.</th><th>План</th><th>Подтверждено</th><th>Ожидает</th><th>Готовность</th><th>Сметная стоимость</th><th>Норм. чел.-ч</th><th>Факт чел.-ч</th></tr></thead><tbody>${G.map((g,i)=>`<tr><td>${h(g.title)}</td><td>${h(g.unit)}</td><td>${num(g.qty)}</td><td>${num(done(i))}</td><td>${num(submitted(i))}</td><td>${num(done(i)/g.qty*100)}%</td><td>${money(g.cost)}</td><td>${num(g.labor)}</td><td>${num(actualHoursByGroup()[i])}</td></tr>`).join('')}</tbody></table></div></div>`}
function workdays(a,b){if(!a||!b||b<a)return 0;let n=0,d=new Date(a+'T12:00:00'),end=new Date(b+'T12:00:00');for(;d<=end;d.setDate(d.getDate()+1)){let w=d.getDay();if(w!==0&&w!==6)n++;}return n}
function stagePlan(i,day){let g=G[i],a=state.start,b=state.end;if(!a||!b||b<a)return 0;let total=workdays(a,b),passed=workdays(a,day<b?day:b);return total?g.qty*Math.min(1,passed/total):0}
function daily(){let foreman=state.people.find(x=>x.role==='Прораб');let date=new Date().toISOString().slice(0,10);return `<div class="card"><h2>Ежедневный отчет прораба</h2><p><b>Назначенный прораб:</b> ${foreman?h(foreman.name):'<span class="warn">Не назначен. Руководителю нужно добавить сотрудника с должностью «Прораб».</span>'}</p><p class="muted">Плановый объем на дату — ориентир при равномерном распределении каждого этапа по рабочим дням. Для точного графика позже зададим даты начала и окончания этапов.</p><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-bottom:15px"><label>Дата выполнения <span style="display:flex;align-items:center;gap:6px"><input id="dailyDate" type="text" readonly aria-label="Выбранная дата, день месяц год" value="${dateRU(date)}" onclick="openDailyCalendar()" style="width:132px;cursor:pointer"><button type="button" aria-label="Открыть календарь" title="Выбрать дату" onclick="openDailyCalendar()" style="padding:8px 11px">📅</button><input id="dailyDatePicker" type="date" value="${date}" aria-label="Календарь выбора даты" onchange="chooseDailyDate(this.value)" style="width:1px;min-width:1px;opacity:0;padding:0;border:0;position:absolute;pointer-events:none"></span></label><label>Человек в бригаде<input id="dailyPeople" type="number" min="1" step="1" value="${Math.max(1,state.people.filter(p=>p.role!=='Прораб').length)}"></label><label>Часов на человека<input id="dailyShift" type="number" min="0.5" max="24" step="0.5" value="8"></label></div><div id="dailyNotice" class="muted" style="margin-bottom:10px"></div><div class="scroll"><table><thead><tr><th>Вид работ</th><th>Ед.</th><th>Сметный объем</th><th>План к дате</th><th>Подтверждено</th><th>Ожидает контроля</th><th>Остаток к заявке</th><th>Факт за день</th></tr></thead><tbody>${G.map((g,i)=>`<tr><td>${h(g.title)}</td><td>${h(g.unit)}</td><td>${num(g.qty)}</td><td id="plan${i}">${num(stagePlan(i,dateToISO(date)))}</td><td>${num(done(i))}</td><td>${num(submitted(i))}</td><td>${num(Math.max(0,g.qty-done(i)-submitted(i)))}</td><td><input aria-label="Объем ${h(g.title)}" id="dailyQty${i}" type="number" min="0" step="any" style="width:115px" placeholder="0"></td></tr>`).join('')}</tbody></table></div><label style="margin:12px 0">Комментарий к отчету<textarea id="dailyComment" rows="2" placeholder="Участок, замечания"></textarea></label><button type="button" onclick="submitDaily()">Отправить заполненные объемы на контроль</button></div>${recordsTable('История заявок',state.records.slice().reverse())}`}
function openDailyCalendar(){
 const picker=document.getElementById('dailyDatePicker');
 if(!picker)return;
 try{if(typeof picker.showPicker==='function'){picker.showPicker();return}}catch(e){}
 picker.style.pointerEvents='auto';picker.style.opacity='1';picker.style.width='160px';picker.style.position='static';picker.focus();picker.click();
}
function chooseDailyDate(iso){
 if(!iso)return;
 document.getElementById('dailyDate').value=dateRU(iso);
 const picker=document.getElementById('dailyDatePicker');
 picker.style.pointerEvents='none';picker.style.opacity='0';picker.style.width='1px';picker.style.position='absolute';
 refreshDailyPlan();
}
function refreshDailyPlan(){let d=dateToISO(document.getElementById('dailyDate').value);G.forEach((g,i)=>{let e=document.getElementById('plan'+i);if(e)e.textContent=num(stagePlan(i,d))})}
function submitDaily(){let msg=document.getElementById('dailyNotice');function say(t){msg.textContent=t;msg.style.color='#a14b13'}try{let foreman=state.people.find(x=>x.role==='Прораб');if(!foreman){say('Сначала руководитель должен назначить прораба во вкладке «Бригада и ФОТ».');return}let dateInput=document.getElementById('dailyDate').value; if(!validRUDate(dateInput)){say('Введите дату в формате ДД/ММ/ГГГГ');return} let date=dateToISO(dateInput),people=Number(document.getElementById('dailyPeople').value),shift=Number(document.getElementById('dailyShift').value),comment=document.getElementById('dailyComment').value;if(!date||!Number.isInteger(people)||people<1||!(shift>0&&shift<=24)){say('Проверьте дату, численность и продолжительность смены.');return}let rows=[];for(let i=0;i<G.length;i++){let raw=document.getElementById('dailyQty'+i).value.trim();if(!raw)continue;let q=Number(raw.replace(',','.'));if(!Number.isFinite(q)||q<0){say('Некорректный объем: '+G[i].title);return}if(q===0)continue;if(q+done(i)+submitted(i)>G[i].qty+0.000001){say('Превышен остаток по этапу: '+G[i].title);return}rows.push({date,foreman:foreman.name,group:i,qty:q,people,shift,comment,status:'pending',id:Date.now()+i+Math.random(),created:new Date().toISOString()})}if(!rows.length){say('Заполните фактический объем хотя бы по одной работе.');return}const reportId='day-'+Date.now()+'-'+Math.random().toString(36).slice(2);rows.forEach(r=>r.reportId=reportId);state.records.push(...rows);save();render();let e=document.getElementById('dailyNotice');if(e){e.textContent='Отправлено на контроль: '+rows.length+' позиций.';e.style.color='#16724d'}}catch(e){say('Ошибка: '+e.message)}}
function recordsTable(title,records,actions=false){
 return `<div class="card"><h2>${title}</h2><div id="controlNotice" role="status" style="margin:8px 0;color:#176b4a"></div><div class="scroll"><table><thead><tr><th>Дата / прораб</th><th>Работа</th><th>Заявлено</th><th>Согласовано контролем</th><th>Бригада</th><th>Статус</th><th>Причина / примечание</th>${actions?'<th>Решение</th>':''}</tr></thead><tbody>${records.map(r=>{
 const idx=state.records.indexOf(r),pending=r.status==='pending';
 return `<tr><td>${h(dateRU(r.date))}<br>${h(r.foreman)}</td><td>${h(G[r.group]?.title)}</td><td>${num(r.qty)} ${h(G[r.group]?.unit)}</td><td>${actions&&pending?`<input aria-label="Согласованный объем" id="agree${idx}" type="number" min="0" max="${r.qty}" step="any" value="${r.qty}" style="width:105px">`:(r.status==='approved'?num(r.agreedQty??r.qty):'0')+' '+h(G[r.group]?.unit)}</td><td>${num(r.people)} чел. × ${num(r.shift)} ч</td><td>${r.status==='approved'?'✅ Согласовано':r.status==='rejected'?'❌ Отклонено':'⏳ Ожидает'}${r.reviewer?'<br>'+h(r.reviewer):''}</td><td>${h(r.comment)}${r.reason?'<br><b>'+h(r.reason)+'</b>':''}${actions&&pending?`<textarea id="reason${idx}" rows="2" placeholder="Причина корректировки или отклонения" style="width:180px"></textarea>`:''}</td>${actions?`<td>${pending?`<button type="button" onclick="decide(${idx},true)">Согласовать</button> <button type="button" class="danger" onclick="decide(${idx},false)">Отклонить</button>`:'—'}</td>`:''}</tr>`}).join('')}</tbody></table></div></div>`
}
function control(){return `<div class="card"><h2>Контроль выполнения</h2><label>ФИО контролера<input id="reviewer" oninput="state.controller=this.value" value="${h(state.controller)}" placeholder="Фамилия Имя Отчество"></label><p class="muted">Укажите согласованный объем по каждой заявке. Если он меньше заявленного, обязательно поясните расхождение. Отклонение требует причины и засчитывает 0. Действия работают без всплывающих окон.</p></div>${recordsTable('Заявки на проверку',state.records.slice().reverse(),true)}`}
function decide(index,approve){
 const notice=document.getElementById('controlNotice');
 const tell=t=>{if(notice){notice.textContent=t;notice.style.color='#a14b13'}else alert(t)};
 try{
  const reviewer=(document.getElementById('reviewer')?.value||state.controller||'').trim();
  if(!reviewer){tell('Укажите ФИО контролера.');return}
  const r=state.records[index];
  if(!r||r.status!=='pending'){tell('Заявка уже обработана или не найдена.');return}
  const raw=document.getElementById('agree'+index)?.value?.trim().replace(',','.');
  const qty=Number(raw);
  const reason=(document.getElementById('reason'+index)?.value||'').trim();
  if(approve&&(raw===''||!Number.isFinite(qty)||qty<=0||qty>Number(r.qty))){tell('Согласованный объем должен быть больше нуля и не превышать заявленный.');return}
  if((!approve||(qty<Number(r.qty)))&&!reason){tell('Для отклонения или уменьшения объема укажите причину в строке заявки.');return}
  state.controller=reviewer;
  r.status=approve?'approved':'rejected';
  r.agreedQty=approve?qty:0;
  r.reviewer=reviewer;
  r.reviewed=new Date().toISOString();
  r.reason=reason;
  const saved=save();render();
  const after=document.getElementById('controlNotice');
  if(after){after.textContent=(approve?'Согласовано '+num(qty)+' '+G[r.group].unit+'.':'Заявка отклонена, засчитано 0.')+(saved?' Данные сохранены.':' Не удалось сохранить данные.');after.style.color='#16724d'}
 }catch(err){tell('Ошибка: '+String(err.message||err))}
}
function staff(){return `<div class="card"><h2>Состав бригады и оклады</h2><p class="muted">Руководитель назначает прораба, добавляя его в состав сотрудников с должностью «Прораб». Его ФИО автоматически используется в ежедневных отчетах.</p><p id="staffNotice" hidden style="background:#e5f6ed;color:#11633c;padding:10px;border-radius:8px"></p><div id="staffForm" style="display:flex;flex-wrap:wrap;gap:12px;align-items:end"><label>ФИО<input id="staffName" required name="name" placeholder="ФИО сотрудника"></label><label>Должность<select id="staffRole" name="role"><option>Прораб</option><option>Монтажник</option><option>Сварщик</option><option>Машинист</option><option>Другой специалист</option></select></label><label>Месячный оклад, ₽<input id="staffSalary" required name="salary" type="number" min="0" step="0.01"></label><button type="button" id="addStaffButton" onclick="addPerson()">Добавить сотрудника</button></div><div class="scroll"><table><tr><th>ФИО</th><th>Должность</th><th>Оклад</th><th></th></tr>${state.people.map((p,i)=>`<tr><td>${h(p.name)}</td><td>${h(p.role)}</td><td>${money(p.salary)}</td><td><button class="danger" type="button" data-delete-person="${i}">Удалить</button></td></tr>`).join('')}</table></div><p><b>Месячный ФОТ: ${money(sum(state.people,x=>+x.salary))}</b></p><p class="muted">Оклады — месячные, фактический ФОТ за период пока не рассчитывается. При вводе ежедневного отчета прораб отдельно указывает фактическое количество людей и часы.</p></div>`}
function addPerson(){
 const notice=document.getElementById('staffNotice');
 function message(txt,ok){if(notice){notice.textContent=txt;notice.hidden=false;notice.style.background=ok?'#e5f6ed':'#fff0e6';notice.style.color=ok?'#11633c':'#8c3c12';}else alert(txt);}
 try {
  const name=document.getElementById('staffName').value.trim();
  const role=document.getElementById('staffRole').value;
  const salaryText=document.getElementById('staffSalary').value.trim().replace(',','.');
  const salary=Number(salaryText);
  if(!name){message('Укажите ФИО сотрудника.',false);return;}
  if(salaryText===''||!Number.isFinite(salary)||salary<0){message('Укажите корректный оклад (можно 0).',false);return;}
  if(!Array.isArray(state.people))state.people=[];
  state.people.push({name,role,salary});
  const saved=save();
  render();
  const after=document.getElementById('staffNotice');
  if(after){after.textContent=saved?'Сотрудник «'+name+'» добавлен и сохранён.':'Сотрудник добавлен, но браузер запретил сохранение. Сделайте резервную копию.';after.hidden=false;}
 } catch(err) {message('Ошибка добавления: '+String(err&&err.message||err),false);}
}
// Two-step inline deletion avoids browser-blocked confirm dialogs.
document.addEventListener('click',function(event){
 const button=event.target.closest('[data-delete-person]');
 if(!button)return;
 event.preventDefault();
 const index=Number(button.getAttribute('data-delete-person'));
 if(!Number.isInteger(index)||index<0||index>=state.people.length)return;
 if(button.dataset.armed!=='yes'){
  document.querySelectorAll('[data-delete-person]').forEach(b=>{b.dataset.armed='no';b.textContent='Удалить';});
  button.dataset.armed='yes';
  button.textContent='Подтвердить удаление';
  const notice=document.getElementById('staffNotice');
  if(notice){notice.hidden=false;notice.textContent='Для удаления «'+state.people[index].name+'» нажмите красную кнопку еще раз.';}
  return;
 }
 try{
  const removed=state.people.splice(index,1)[0];
  const saved=save();render();
  const notice=document.getElementById('staffNotice');
  if(notice){notice.hidden=false;notice.textContent='Сотрудник «'+removed.name+'» удалён. ФОТ пересчитан.'+(saved?'':' Внимание: изменения не сохранились на диск.');}
 }catch(err){alert('Ошибка удаления: '+String(err.message||err));}
});
function managerMain(){return `<div class="card"><h2>Параметры объекта</h2><form onsubmit="settings(event)"><label>Дата начала<input name="start" type="text" inputmode="numeric" placeholder="ДД/ММ/ГГГГ" required value="${h(dateRU(state.start))}"></label><label>Срок завершения<input name="end" type="text" inputmode="numeric" placeholder="ДД/ММ/ГГГГ" required value="${h(dateRU(state.end))}"></label><label>ФИО руководителя<input name="manager" value="${h(state.manager)}"></label><label>Коэффициент премирования, %<input name="bonusRate" type="number" min="0" max="100" step="1" value="${state.bonusRate}"></label><button>Сохранить</button></form></div><div class="card"><h2>Вопросы и уточнения</h2><form onsubmit="addQuestion(event)"><label>Вопрос прорабу или контролеру<textarea required name="text" rows="2"></textarea></label><button>Добавить вопрос</button></form>${state.questions.slice().reverse().map(x=>`<p class="pill">${h(x.date)} · ${h(x.author)}: ${h(x.text)}</p>`).join('')}<p class="muted">Вопросы пока сохраняются как журнал; уведомления и ответы пользователей появятся в многопользовательской версии.</p></div><div class="card"><h2>Резервная копия</h2><button onclick="exportData()">Скачать данные JSON</button> <label>Восстановить из JSON<input type="file" accept=".json,application/json" onchange="importData(event)"></label></div>`}
function settings(e){e.preventDefault();let d=Object.fromEntries(new FormData(e.target));if(!validRUDate(d.start)||!validRUDate(d.end)){alert('Введите даты в формате ДД/ММ/ГГГГ');return}d.start=dateToISO(d.start);d.end=dateToISO(d.end);if(d.end<d.start){alert('Срок окончания раньше начала');return}Object.assign(state,d);save();render()}function addQuestion(e){e.preventDefault();state.questions.push({text:e.target.text.value,author:state.manager||'Руководитель проекта',date:new Date().toLocaleString('ru-RU')});save();render()}function exportData(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='StroyKontrol-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}async function importData(e){try{let d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.records)||!Array.isArray(d.people))throw Error('Неверный формат');if(confirm('Заменить текущие данные резервной копией?')){state=d;state.estimateEpoch=Date.now();save();render()}}catch(x){alert('Не удалось загрузить файл: '+x.message)}}
function sources(){
return `<div class="card"><h2>Объект и новая смета</h2>
<p class="muted">Название объекта задается вручную, независимо от названия файла сметы.</p>
<div id="projectRenameForm"><label>Название объекта / проекта<input name="projectName" required maxlength="120" value="${h(state.projectName)}" placeholder="Например: Наружные сети ВК — корпус 2"></label><button type="button" onclick="renameProject()">Сохранить название</button><div id="renameResult" role="status" style="margin-top:10px"></div></div>
<hr><h3>Загрузить новую смету</h3>
<p>Поддерживаются Excel (.xlsx, .xls) и CSV. Для Excel нужен интернет при первом открытии: загружается модуль чтения таблиц. Если файл не распознан, можно сохранить из Excel как CSV UTF-8.</p>
<p class="muted">Для корректного импорта нужна таблица с колонками «Наименование», «Ед.», «Количество», «Стоимость», «Чел.-ч» (или «Трудозатраты»). Необязательная колонка «Этап» объединяет сметные строки в производственные этапы. Сложные сметы ФСНБ/ГРАНД-Смета с многострочными шапками могут потребовать подготовки таблицы.</p>
<label>Файл сметы<input type="file" id="newEstimateFile" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
<button type="button" onclick="loadNewEstimate()">Загрузить и проверить</button>
<div id="estimateImportMessage" class="muted" role="status"></div>
<p class="muted"><b>Внимание:</b> при применении новой сметы предыдущие объемы и заявки по старой смете будут очищены. Перед заменой программа предложит скачать резервную копию.</p>
</div>
<div class="card"><h2 id="currentEstimateTitle">Текущая смета: ${h(state.projectName)}</h2>
<p>Стоимость: <b>${money(totalCost)}</b>. Трудоемкость рабочих: <b>${num(totalLabor)} чел.-ч</b>, машинистов: <b>${num(totalMachine)} чел.-ч</b>.</p>
${G.map(g=>`<details><summary><b>${h(g.title)}</b> — ${num(g.qty)} ${h(g.unit)} · ${money(g.cost)} · ${num(g.labor)} чел.-ч</summary><div class="scroll"><table><tr><th>Расценка</th><th>Наименование</th><th>Кол-во</th><th>Стоимость</th><th>Рабочие, чел.-ч</th><th>Машинисты, чел.-ч</th></tr>${(g.sources||[]).map(x=>`<tr><td>${h(x.code)}</td><td>${h(x.name)}</td><td>${num(x.qty)} ${h(x.unit)}</td><td>${money(x.cost)}</td><td>${num(x.labor)}</td><td>${num(x.machine)}</td></tr>`).join('')}</table></div></details>`).join('')}</div>`;
}
function renameProject(){
 const field=document.querySelector('#projectRenameForm input[name="projectName"]');
 const n=field?field.value.trim():'';
 const msg=document.getElementById('renameResult');
 if(!n){if(msg)msg.textContent='Введите название объекта';return;}
 state.projectName=n;
 let saved=false;
 try{state.updatedAt=Date.now();localStorage.setItem(key,JSON.stringify(state));saved=true;if(window.SKSync)SKSync.schedule();}
 catch(err){if(msg)msg.textContent='Ошибка сохранения: '+err.message;}
 const header=document.getElementById('projectHeaderName');
 if(header)header.textContent=n;
 document.title='СтройКонтроль — '+n;
 if(msg){msg.style.color=saved?'#157347':'#b91c1c';msg.textContent=saved?'✓ Сохранено: '+n:'Название изменено в шапке, но не сохранено в браузере.';}
 const title=document.querySelector('#currentEstimateTitle');if(title)title.textContent='Текущая смета: '+n;
}
function parseCSV(txt){
 const first=txt.replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'';
 const delimiter=[';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const out=[],line=[];let q=false,cell='';
 for(let i=0;i<txt.length;i++){const c=txt[i];
  if(c==='"'){if(q&&txt[i+1]==='"'){cell+='"';i++;}else q=!q;}
  else if(c===delimiter&&!q){line.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&txt[i+1]==='\n')i++;line.push(cell);if(line.some(x=>x.trim()))out.push(line.slice());line.length=0;cell='';}
  else cell+=c;
 }
 line.push(cell);if(line.some(x=>x.trim()))out.push(line);return out;
}
function asNumber(v){if(typeof v==='number')return Number.isFinite(v)?v:0;let t=String(v??'').replace(/\s|\u00a0/g,'').replace(',','.').replace(/[₽]/g,'');let n=Number(t);return Number.isFinite(n)?n:0;}
function extractGroups(rows){
 const head=rows.findIndex(r=>r.some(c=>/наименован|вид работ|работы|этап|позици/i.test(String(c))));
 if(head<0)throw Error('Не найдена строка заголовков. Добавьте колонки «Наименование», «Ед.», «Количество», «Стоимость», «Чел.-ч».');
 const cols=rows[head].map(x=>String(x).trim().toLowerCase().replace(/ё/g,'е'));
 const ix=(...terms)=>cols.findIndex(x=>terms.some(t=>x.includes(t)));
 const name=ix('наименование','вид работ','работы','позиция'), unit=ix('ед.','единица'), qty=ix('количество','кол-во','объем','объём'), cost=ix('стоимость','сумма','итого'), labor=ix('чел.-ч','чел/ч','трудозатрат','трудоемк'), machine=ix('машинист'), stage=ix('этап','группа'), code=ix('обоснование','расценка','шифр');
 if(name<0||qty<0||cost<0||labor<0)throw Error('Нужны колонки «Наименование», «Количество», «Стоимость» и «Чел.-ч».');
 const groups=new Map();let count=0;
 for(const r of rows.slice(head+1)){
  const title=String(r[name]||'').trim(),q=asNumber(r[qty]);if(!title||q<=0||/^(итого|всего|накладные|сметная прибыль)/i.test(title))continue;
  const u=unit>=0?String(r[unit]||'шт').trim():'шт',c=asNumber(r[cost]),l=asNumber(r[labor]),m=machine>=0?asNumber(r[machine]):0;
  const groupName=stage>=0?String(r[stage]||'').trim():'';const label=groupName||title;
  const key=label+'|'+u;
  if(!groups.has(key))groups.set(key,{title:label,unit:u,qty:0,cost:0,labor:0,machine:0,sources:[]});
  const g=groups.get(key);g.qty+=q;g.cost+=c;g.labor+=l;g.machine+=m;
  g.sources.push({code:code>=0?String(r[code]||''):'',name:title,unit:u,qty:q,cost:c,labor:l,machine:m});count++;
 }
 if(!count)throw Error('В таблице не найдены строки с положительным количеством.');
 if(groups.size>150)throw Error('Получилось '+groups.size+' отдельных видов работ. Добавьте колонку «Этап» для укрупнения — программа должна оставаться компактной.');
 return {groups:[...groups.values()],count};
}
function loadExcelLibrary(){
 if(window.XLSX)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const el=document.createElement('script');el.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  el.onload=()=>window.XLSX?resolve():reject(Error('Модуль Excel не загрузился'));
  el.onerror=()=>reject(Error('Не удалось загрузить модуль Excel. Проверьте интернет или сохраните файл как CSV UTF-8.'));
  document.head.appendChild(el);
 });
}
async function loadNewEstimate(){
 const msg=document.getElementById('estimateImportMessage'),f=document.getElementById('newEstimateFile').files[0];
 if(!f){msg.textContent='Сначала выберите файл.';return;}
 msg.textContent='Читаем файл…';
 try{
  let rows;
  if(/\.csv$/i.test(f.name))rows=parseCSV(await f.text());
  else if(/\.(xlsx|xls)$/i.test(f.name)){await loadExcelLibrary();const book=XLSX.read(await f.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:''});}
  else throw Error('Выберите файл Excel или CSV.');
  const result=extractGroups(rows);
  msg.textContent=`Найдено ${result.count} строк, сформировано ${result.groups.length} этапов. Стоимость: ${money(sum(result.groups,x=>x.cost))}.`;
  if(!confirm(`Новая смета: ${result.count} строк, ${result.groups.length} этапов.\n\nЗаменить текущую смету? Старые заявки будут очищены. Сначала сохраните резервную копию.`))return;
  exportData();
  if(!confirm('Резервная копия скачана (проверьте папку загрузок). Продолжить замену сметы и очистку заявок?'))return;
  G=result.groups;totalCost=sum(G,x=>x.cost);totalLabor=sum(G,x=>x.labor);totalMachine=sum(G,x=>x.machine);state.estimateGroups=result.groups;state.records=[];state.estimateEpoch=Date.now();save();render();
 }catch(err){msg.textContent='Ошибка: '+String(err.message||err);}
}
function manager(){return managerMain()+(typeof syncCard==='function'?syncCard():'')}
try{render()}catch(err){document.getElementById('app').innerHTML='<div class="card" style="color:#a12">Ошибка запуска: '+String(err.message||err)+'</div>';} 
