import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);let session=null,offset=0,seen=new Set(),timer=null,filterTimer=null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ui(){ $('login').hidden=!!session;$('dashboard').hidden=!session;$('logout').hidden=!session; if(session) load(true);else clearInterval(timer); }
async function load(reset=false){if(!session)return; if(reset){offset=0;seen=new Set();$('updates').replaceChildren();} $('status').textContent='Loading…';
 let q=db.from('updates').select('id,title,url,summary,detected_at,published_at,category,priority,score,reason,source_id', {count:'exact'}).order('detected_at',{ascending:false}).range(offset,offset+19);
 if($('category').value)q=q.eq('category',$('category').value);if($('priority').value)q=q.eq('priority',$('priority').value);
 const term=$('search').value.trim();if(term)q=q.or(`title.ilike.%${term.replace(/[%(),]/g,'')}%,summary.ilike.%${term.replace(/[%(),]/g,'')}%`);
 const {data,error,count}=await q;if(error){$('status').textContent=error.message;return;}
 const rows=data||[];offset+=rows.length;$('more').hidden=offset>=(count||0);$('status').textContent=`${count||0} matching updates`;
 const ids=rows.map(r=>r.id);const {data:saved}=ids.length?await db.from('saved_updates').select('update_id,status').in('update_id',ids):{data:[]};const statuses=new Map((saved||[]).map(x=>[x.update_id,x.status]));
 for(const r of rows){if(seen.has(r.id))continue;seen.add(r.id);const item=document.createElement('article');item.className='item';
 item.innerHTML=`<div class="meta"><span class="tag ${escape(r.priority)}">${escape(r.priority)}</span><span>${escape(r.category.toUpperCase())}</span><span>Score ${r.score}/100</span><span>Detected ${new Date(r.detected_at).toLocaleString()}</span></div><h3><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">${escape(r.title)}</a></h3><p>${escape(r.summary.slice(0,350))}</p><p class="reason">${escape(r.reason)}</p><div class="actions"><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">Official source ↗</a><select aria-label="Review status"><option value="">Set status</option>${['saved','testing','implemented','dismissed'].map(s=>`<option value="${s}" ${statuses.get(r.id)===s?'selected':''}>${s}</option>`).join('')}</select></div>`;
 item.querySelector('select').addEventListener('change',async e=>{const v=e.target.value;if(!v)return;const {error}=await db.from('saved_updates').upsert({user_id:session.user.id,update_id:r.id,status:v});if(error)alert(error.message);});$('updates').append(item);}
 if(reset){const {count:all}=await db.from('updates').select('id',{count:'exact',head:true});const {count:crit}=await db.from('updates').select('id',{count:'exact',head:true}).eq('priority','critical');$('total').textContent=all??0;$('critical').textContent=crit??0;$('latest').textContent=rows[0]?new Date(rows[0].detected_at).toLocaleDateString():'—';}
}
async function checkCritical(){if(!session||Notification.permission!=='granted')return;const {data}=await db.from('updates').select('id,title,url,detected_at').eq('priority','critical').gte('detected_at',new Date(Date.now()-20*60*1000).toISOString()).order('detected_at',{ascending:false}).limit(15);for(const r of data||[]){const key='radar-alert-'+r.id;if(localStorage.getItem(key))continue;localStorage.setItem(key,'1');const n=new Notification('Digital Growth Radar: Critical',{body:r.title,tag:r.id});n.onclick=()=>window.open(r.url,'_blank','noopener');}}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('authMessage').textContent='Signing in…';const {error}=await db.auth.signInWithPassword({email:$('email').value,password:$('password').value});$('authMessage').textContent=error?.message||'';};
$('logout').onclick=()=>db.auth.signOut();$('refresh').onclick=()=>load(true);$('more').onclick=()=>load();
for(const id of ['category','priority'])$(id).onchange=()=>load(true);$('search').oninput=()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>load(true),350)};
$('enableNotifications').onclick=async()=>{if(!('Notification' in window))return alert('Notifications unavailable in this browser');const p=await Notification.requestPermission();$('status').textContent=p==='granted'?'Notifications enabled while this dashboard is open.':'Notification permission not granted.';if(p==='granted')checkCritical();};
db.auth.onAuthStateChange((_event,s)=>{session=s;ui();if(s){clearInterval(timer);timer=setInterval(()=>{checkCritical();load(true)},60_000);checkCritical();}});
