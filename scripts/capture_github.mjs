import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const profile=fs.mkdtempSync(path.join(root,'.verify-profile-github-'));
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket,send,id=0;const pending=new Map();
try{
  for(let i=0;i<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await delay(100);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  socket.addEventListener('message',({data})=>{const value=JSON.parse(data),p=pending.get(value.id);if(p){pending.delete(value.id);clearTimeout(p.timer);value.error?p.reject(new Error(JSON.stringify(value.error))):p.resolve(value.result);}});
  send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(new Error(method+' timeout'));},20000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  const url='https://github.com/k0n0y/102401314-102401323/commits/main/';
  await send('Page.navigate',{url});
  let valid=false;
  for(let i=0;i<80;i++){
    const result=await send('Runtime.evaluate',{expression:`document.body && document.body.textContent.includes('test: verify cross-client sync')`,returnByValue:true});
    if(result.result?.value){valid=true;break;}await delay(250);
  }
  if(!valid)throw new Error('Public GitHub commits page did not render expected actual commit');
  await delay(1500);
  const screenshot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});
  fs.writeFileSync(path.join(root,'docs/images/github-commits.png'),Buffer.from(screenshot.data,'base64'));
  fs.writeFileSync(path.join(root,'evidence/github-screenshot.json'),JSON.stringify({capturedAt:new Date().toISOString(),url,expectedCommitVisible:true,method:'headless Chrome screenshot of real public GitHub page'},null,2));
  console.log('Captured actual GitHub commits page');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
  try{await send?.('Browser.close');}catch{}socket?.close();child.kill();await delay(500);
  const target=path.resolve(profile);if(!target.startsWith(path.resolve(root)+path.sep)||!path.basename(target).startsWith('.verify-profile-github-'))throw new Error('Unsafe cleanup');
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}
}
