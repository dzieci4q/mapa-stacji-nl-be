const $=s=>document.querySelector(s);
let stations=[],filter='all',position=null,stopped=false,geoBusy=false;
let favs=new Set(JSON.parse(localStorage.getItem('stacje-fav-v1')||'[]'));
let coords=JSON.parse(localStorage.getItem('stacje-coords-v1')||'{}');
const list=$('#stationList');
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function country(c){return c==='Belgium'?'Belgia':c==='Netherlands'?'Holandia':'Kraj nieustalony';}
function km(a,b){const R=6371,rad=x=>x*Math.PI/180;let dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function distance(s){let c=coords[s.id];return position&&c?km(position,c):null;}
function render(){
 const q=$('#search').value.trim().toLocaleLowerCase('pl');
 let rows=stations.filter(s=>(`${s.name} ${s.address} ${country(s.country)}`).toLocaleLowerCase('pl').includes(q)&&(filter==='all'||(filter==='fav'?favs.has(s.id):s.country===filter)));
 if(position)rows.sort((a,b)=>{let da=distance(a),db=distance(b);return (da??Infinity)-(db??Infinity);});
 $('#resultCount').textContent=`${rows.length} stacji`;
 if(!rows.length){list.innerHTML='<div class="empty">Brak stacji dla tego wyszukiwania.</div>';return;}
 list.innerHTML=rows.map(s=>{let d=distance(s);let url=position?`https://www.google.com/maps/dir/?api=1&origin=${position.lat},${position.lon}&destination=${encodeURIComponent(s.name+', '+s.address)}&travelmode=driving`:s.mapsUrl;
 return `<article class="station"><div class="station-main"><div class="country ${s.country==='Belgium'?'be':''}">${esc(country(s.country))}</div><h3>${esc(s.name)}</h3><address>${esc(s.address)}</address>${d!==null?`<div class="distance">${d.toFixed(1)} km od Ciebie</div>`:''}</div><div class="actions"><a class="navigate" href="${esc(url)}" target="_blank" rel="noopener">↗ Nawiguj</a><button class="favorite ${favs.has(s.id)?'on':''}" data-fav="${s.id}">${favs.has(s.id)?'★ Zapisano':'☆ Ulubiona'}</button></div></article>`}).join('');
 list.querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',()=>{let id=Number(b.dataset.fav);favs.has(id)?favs.delete(id):favs.add(id);localStorage.setItem('stacje-fav-v1',JSON.stringify([...favs]));render();}));
}
function net(){let on=navigator.onLine;$('#netlabel').textContent=on?'Internet dostępny':'Offline — zapisane dane';$('#netdot').className='dot '+(on?'online':'offline');}
async function geocode(s){
 if(coords[s.id])return coords[s.id];
 const query=encodeURIComponent(s.address);
 const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`;
 const res=await fetch(url,{headers:{'Accept':'application/json'}});
 if(!res.ok)throw Error('Geokoder chwilowo niedostępny');
 const data=await res.json();
 if(data?.length){coords[s.id]={lat:Number(data[0].lat),lon:Number(data[0].lon)};localStorage.setItem('stacje-coords-v1',JSON.stringify(coords));return coords[s.id];}
 return null;
}
async function findNearby(){
 if(geoBusy)return;
 if(!navigator.geolocation){$('#gpsText').textContent='Ta przeglądarka nie udostępnia lokalizacji.';return;}
 $('#gpsBtn').disabled=true;$('#gpsTitle').textContent='Ustalanie pozycji…';$('#gpsText').textContent='Zezwól iPhone’owi na dostęp do lokalizacji.'; 
 navigator.geolocation.getCurrentPosition(async p=>{
  position={lat:p.coords.latitude,lon:p.coords.longitude};
  $('#gpsTitle').textContent='Lokalizacja ustalona';$('#gpsText').textContent=`GPS: ${position.lat.toFixed(4)}, ${position.lon.toFixed(4)} — sortuję stacje według odległości.`;
  render();
  if(!navigator.onLine){$('#gpsBtn').disabled=false;return;}
  geoBusy=true;stopped=false;$('#progressWrap').hidden=false;
  let todo=stations.filter(s=>!coords[s.id]);
  let done=0,fail=0;
  for(const s of todo){
   if(stopped)break;
   try{await geocode(s);}catch(e){fail++;if(fail>=3){$('#progressText').textContent='Usługa wyszukiwania chwilowo ograniczyła zapytania. Zapisano dotychczasowe wyniki.';break;}}
   done++;$('#progressText').textContent=`Zapisywanie współrzędnych: ${done}/${todo.length}`;
   $('#progressBar').style.width=`${todo.length?done/todo.length*100:100}%`;
   render();
   await new Promise(r=>setTimeout(r,1100)); // public geocoder rate-limit courtesy
  }
  $('#progressText').textContent=stopped?'Przerwano. Zapisane współrzędne zachowano.':`Gotowe. Współrzędne zapisane: ${Object.keys(coords).length}/${stations.length}.`;
  geoBusy=false;$('#gpsBtn').disabled=false;render();
 },e=>{
  $('#gpsTitle').textContent='Nie udało się pobrać lokalizacji';
  $('#gpsText').textContent=e.code===1?'Brak zgody. Włącz lokalizację w ustawieniach Safari dla tej witryny.':'Sprawdź usługi lokalizacji i spróbuj ponownie.';
  $('#gpsBtn').disabled=false;
 },{enableHighAccuracy:true,timeout:20000,maximumAge:60000});
}
$('#gpsBtn').addEventListener('click',findNearby);
$('#stopGeo').addEventListener('click',()=>{stopped=true;});
$('#search').addEventListener('input',render);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));$('#listTitle').textContent=filter==='all'?'Wszystkie stacje':filter==='fav'?'Ulubione':country(filter);render();}));
const dlg=$('#installDialog');$('#installInfo').addEventListener('click',()=>dlg.showModal());$('#closeInstall').addEventListener('click',()=>dlg.close());$('#closeInstall2').addEventListener('click',()=>dlg.close());
window.addEventListener('online',net);window.addEventListener('offline',net);
async function init(){net();try{const r=await fetch('./stations.json');if(!r.ok)throw Error();stations=await r.json();$('#allCount').textContent=stations.length;render();}catch(e){list.innerHTML='<div class="empty">Nie udało się wczytać listy. Otwórz aplikację online raz, aby zapisać dane.</div>';}}
init();
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
