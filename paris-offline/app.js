'use strict';
// Hospedagem apenas da interface. Todo arquivo importado permanece no IndexedDB do dispositivo.
const STORE_DB='querido-paris-offline-v1';
const STORE_NAME='snapshots';
const STORE_KEY='current';
const MAX_SIZE=20*1024*1024;
const $=id=>document.getElementById(id);
let busy=false;
let current=null;
const intlDate=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});

function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(STORE_DB,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Falha ao abrir o armazenamento local'));
  });
}
async function transaction(method,value){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const tx=db.transaction(STORE_NAME,method==='get'?'readonly':'readwrite');
    const store=tx.objectStore(STORE_NAME);
    const req=method==='get'?store.get(STORE_KEY):method==='put'?store.put(value,STORE_KEY):store.delete(STORE_KEY);
    req.onsuccess=()=>{ if(method==='get')resolve(req.result||null); };
    req.onerror=()=>{ settled=true;reject(req.error||new Error('Falha na operação local')); };
    tx.oncomplete=()=>{ db.close();if(method!=='get'&&!settled)resolve(true); };
    tx.onerror=()=>{ db.close();if(!settled){settled=true;reject(tx.error||new Error('Falha na transação local'));} };
    tx.onabort=()=>{ db.close();if(!settled){settled=true;reject(tx.error||new Error('Operação local cancelada'));} };
  });
}
function dateText(iso){
  try{return intlDate.format(new Date(iso));}catch{return 'data não identificada';}
}
function networkStatus(){
  const online=navigator.onLine;
  $('connectionStatus').textContent=online?'Internet disponível':'Sem internet';
  $('connectionStatus').classList.toggle('offline',!online);
}
function showMessage(text,error=false){
  const node=$('message');
  node.hidden=!text;
  node.textContent=text||'';
  node.classList.toggle('error',error);
}
function setBusy(value){
  busy=value;
  $('importFile').disabled=value;
  $('viewButton').disabled=value||!current;
  $('deleteButton').disabled=value||!current;
}
function renderStatus(){
  const s=current;
  $('viewButton').disabled=busy||!s;
  $('deleteButton').disabled=busy||!s;
  $('snapshotStatus').className='status-label'+(s?' ready':'');
  $('snapshotStatus').textContent=s?'Disponível':'Sem cópia';
  if(!s){
    $('snapshotDescription').textContent='Nenhuma cópia armazenada. Selecione um arquivo HTML exportado pelo PARIS para começar.';
    return;
  }
  $('snapshotDescription').textContent='Importada em '+dateText(s.importedAt)+' · Arquivo: '+s.fileName+' · '+Math.max(1,Math.round(s.bytes/1024))+' KB. Não há atualização automática.';
}
async function digest(text){
  if(!crypto?.subtle)return null;
  const buf=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest('SHA-256',buf);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function validateExport(file,html){
  if(file.size<100||file.size>MAX_SIZE)throw Error('Arquivo inválido ou maior que 20 MB.');
  if(!/\.html?$/i.test(file.name))throw Error('Selecione o arquivo HTML gerado pelo botão Baixar offline do PARIS.');
  const parsed=new DOMParser().parseFromString(html,'text/html');
  const heading=parsed.querySelector('h2');
  const scripts=[...parsed.querySelectorAll('script')];
  if(!/^<!doctype html>/i.test(html.trimStart())||!heading||!/^PARIS\s*[·-]\s*Consulta offline/i.test(heading.textContent.trim())||scripts.length!==1||scripts[0].hasAttribute('src')||!scripts[0].textContent.includes('const d=')){
    throw Error('O arquivo não tem a estrutura de uma cópia offline válida do PARIS.');
  }
  if(parsed.querySelector('iframe,object,embed,link[rel="stylesheet"],script[src]'))throw Error('Arquivo contém recursos externos não permitidos.');
  return {snapshotTitle:heading.textContent.trim()};
}
function sanitizedHTML(html){
  // HTML importado recebe origem opaca (sandbox sem allow-same-origin), sem acesso ao PWA ou à rede.
  const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'";
  return html.replace(/<head([^>]*)>/i,(_,attrs)=>'<head'+attrs+'><meta http-equiv="Content-Security-Policy" content="'+policy+'">');
}
async function importSnapshot(file){
  if(busy)return;
  setBusy(true);
  showMessage('Lendo e validando o arquivo...');
  try{
    const html=await file.text();
    const metadata=validateExport(file,html);
    const sha256=await digest(html);
    const snapshot={html,sha256,fileName:file.name,bytes:file.size,importedAt:new Date().toISOString(),snapshotTitle:metadata.snapshotTitle,version:1};
    await transaction('put',snapshot);
    const saved=await transaction('get');
    if(!saved||saved.sha256!==sha256||saved.bytes!==snapshot.bytes)throw Error('Não foi possível confirmar a cópia gravada.');
    current=saved;
    renderStatus();
    showMessage('Cópia salva neste dispositivo. Agora você pode consultar sem internet. O arquivo HTML original continua no aplicativo Arquivos/Downloads; exclua-o lá se não quiser manter duas cópias.');
  }catch(error){
    showMessage('Não foi possível importar: '+(error?.message||String(error)),true);
  }finally{
    $('importFile').value='';
    setBusy(false);
    renderStatus();
  }
}
async function showViewer(){
  if(!current||busy)return;
  setBusy(true);
  try{
    if(current.sha256){
      const now=await digest(current.html);
      if(now!==current.sha256)throw Error('A cópia foi alterada e não passou na conferência de integridade.');
    }
    $('viewer').srcdoc=sanitizedHTML(current.html);
    $('viewerDate').textContent='Cópia importada em '+dateText(current.importedAt);
    $('mainContent').hidden=true;
    $('viewerPane').hidden=false;
    window.scrollTo(0,0);
  }catch(error){showMessage('Não foi possível abrir: '+(error?.message||String(error)),true);}
  finally{setBusy(false);}
}
function exitViewer(){
  $('viewer').srcdoc='';
  $('viewerPane').hidden=true;
  $('mainContent').hidden=false;
  window.scrollTo(0,0);
}
async function deleteSnapshot(){
  if(!current||busy)return;
  if(!confirm('Excluir a cópia deste aplicativo? A base online não será alterada.'))return;
  setBusy(true);
  try{
    await transaction('delete');
    if(await transaction('get'))throw Error('A exclusão não foi confirmada pelo armazenamento.');
    current=null;
    renderStatus();
    showMessage('Cópia excluída do aplicativo. Se o arquivo HTML original ainda estiver no aplicativo Arquivos/Downloads, exclua-o separadamente.');
  }catch(error){showMessage('Não foi possível excluir: '+(error?.message||String(error)),true);}
  finally{setBusy(false);renderStatus();}
}
async function start(){
  networkStatus();
  window.addEventListener('online',networkStatus);
  window.addEventListener('offline',networkStatus);
  $('importFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)void importSnapshot(file);});
  $('viewButton').addEventListener('click',()=>void showViewer());
  $('deleteButton').addEventListener('click',()=>void deleteSnapshot());
  $('backButton').addEventListener('click',exitViewer);
  try{
    current=await transaction('get');
    renderStatus();
  }catch(error){showMessage('Não foi possível acessar os dados locais: '+(error?.message||String(error)),true);renderStatus();}
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{
      showMessage('O navegador não ativou o cache do aplicativo. Pode ser necessário abrir esta página novamente com internet.',true);
    });
  }
}
void start();