import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const android=process.argv.includes('--android');
const captureDir=path.join(root, android?'docs/images/android-network':'docs/images/browser-network');
fs.mkdirSync(captureDir,{recursive:true});
const adb=process.env.ADB_PATH;
const report={mode:android?'Android WebView on installed APK':'Chromium shared UI',startedAt:new Date().toISOString(),checks:[],consoleErrors:[]};
let child,profile,cdp;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class Cdp {
  constructor(socket) {
    this.socket=socket;this.id=0;this.pending=new Map();
    socket.addEventListener('message',({data})=>{
      const value=JSON.parse(data);
      if(value.method==='Runtime.exceptionThrown') report.consoleErrors.push(value.params.exceptionDetails.text);
      if(value.method==='Log.entryAdded' && value.params.entry.level==='error') report.consoleErrors.push((value.params.entry.url||'')+' '+value.params.entry.text);
      if(!value.id)return;
      const p=this.pending.get(value.id);if(!p)return;
      clearTimeout(p.timer);this.pending.delete(value.id);
      value.error?p.reject(new Error(JSON.stringify(value.error))):p.resolve(value.result);
    });
  }
  send(method,params={}) {
    return new Promise((resolve,reject)=>{
      const id=++this.id;
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);
      this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  async eval(expression) {
    const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
    return r.result?.value;
  }
}
async function wait(expression,label) {
  for(let i=0;i<100;i++){if(await cdp.eval(expression))return;await delay(100);}
  throw new Error('UI timeout: '+label);
}
async function check(expression,label) {
  if(!await cdp.eval(expression))throw new Error('FAILED: '+label);
  report.checks.push(label); console.log('PASS '+label);
}
async function shot(name) {
  await delay(300);
  if(android && adb && cdp===first) fs.writeFileSync(path.join(captureDir,name),execFileSync(adb,['exec-out','screencap','-p'],{maxBuffer:15*1024*1024,windowsHide:true}));
  else {const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(path.join(captureDir,name),Buffer.from(r.data,'base64'));}
}
async function nav(route) {await cdp.eval(`location.hash=${JSON.stringify(route)}`);await delay(220);}
async function connect(port) {
  let targets;
  for(let i=0;i<50;i++){
    try{targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.some(x=>x.type==='page'))break;}catch{}
    await delay(200);
  }
  const target=targets?.find(x=>x.type==='page');if(!target)throw new Error('No WebView / browser page');
  const socket=new WebSocket(target.webSocketDebuggerUrl.replace(/localhost:\d+|127\.0\.0\.1:\d+/,`127.0.0.1:${port}`));
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  cdp=new Cdp(socket);await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');
}
async function fill(kind,title) {
  await cdp.eval(`(()=>{
    const form=document.querySelector('#publish-form');
    const date=new Date(Date.now()-3600000);
    const values={kind:${JSON.stringify(kind)},title:${JSON.stringify(title)},category:'校园卡',place:'图书馆一楼',occurredAt:new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16),description:'蓝色卡套，带星星贴纸。请说明物品特征后领取。',contact:'测试联系方式：图书馆服务台'};
    for(const[name,value]of Object.entries(values)){const field=form.elements.namedItem(name);field.value=value;if(field.dispatchEvent)field.dispatchEvent(new Event('input',{bubbles:true}));}
  })()`);
}
const {createServer}=await import('../server/server.cjs').then(x=>x.default);
let service,other,first;
const browserChildren=[],profiles=[],connections=[];
const apiPort=18787;
const apiBase='http://127.0.0.1:'+apiPort;
async function openBrowser(){
  const browser=[process.env.BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(fs.existsSync);
  const dir=fs.mkdtempSync(path.join(root,'.verify-profile-'));profiles.push(dir);
  const proc=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:'ignore',windowsHide:true});browserChildren.push(proc);
  for(let i=0;i<100&&!fs.existsSync(path.join(dir,'DevToolsActivePort'));i++)await delay(100);
  const port=Number(fs.readFileSync(path.join(dir,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
  await connect(port);connections.push(cdp);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cdp.send('Page.navigate',{url:apiBase});await wait(`document.querySelector('#sync-text')?.textContent.includes('已连接')`,'auto connect');
  return cdp;
}
async function owner(){return cdp.eval(`JSON.parse(window.AndroidStore?AndroidStore.readNetwork():localStorage.getItem('shiguang-network-v2')).profiles[${JSON.stringify(apiBase)}].session.ownerId`);}
async function refreshUi(){await cdp.eval(`document.querySelector('[data-action="refresh"]').click()`);await wait(`document.querySelector('#sync-text')?.textContent.includes('已连接')`,'sync');await delay(350);}
async function closeService(){service.closeAllConnections();await new Promise(r=>service.close(r));}
async function startService(){service=createServer({dbPath:path.join(root,'build',android?'android-network-test.sqlite':'browser-network-test.sqlite')});await new Promise(r=>service.listen(apiPort,'0.0.0.0',r));}
try{
  const dbFile=path.join(root,'build',android?'android-network-test.sqlite':'browser-network-test.sqlite');
  for(const suffix of ['','-wal','-shm'])if(fs.existsSync(dbFile+suffix))fs.unlinkSync(dbFile+suffix);
  await startService();
  if(android){
    execFileSync(adb,['connect','127.0.0.1:16384'],{windowsHide:true});
    execFileSync(adb,['install','-r',path.join(root,'apk/shiguang-1.1.0.apk')],{windowsHide:true});
    execFileSync(adb,['reverse','tcp:'+apiPort,'tcp:'+apiPort],{windowsHide:true});
    execFileSync(adb,['shell','am','force-stop','edu.fzu.shiguang'],{windowsHide:true});
    execFileSync(adb,['shell','am','start','-n','edu.fzu.shiguang/.MainActivity'],{windowsHide:true});await delay(1200);
    const pid=execFileSync(adb,['shell','pidof','edu.fzu.shiguang'],{encoding:'utf8',windowsHide:true}).trim();
    execFileSync(adb,['forward','tcp:9299','localabstract:webview_devtools_remote_'+pid],{windowsHide:true});
    await connect(9299);first=cdp;connections.push(cdp);await wait(`!!document.querySelector('.page-main')`,'native launch');
    await nav('#/settings');await shot('01-settings.png');
    // 测试专用端口的数据库每次重新创建，移除该端口失效的旧测试凭证，不影响用户服务地址。
    await cdp.eval(`(()=>{const data=JSON.parse(AndroidStore.readNetwork()||'{"version":2,"base":"","profiles":{}}');delete data.profiles[${JSON.stringify(apiBase)}];AndroidStore.saveNetwork(JSON.stringify(data));})()`);
    await cdp.send('Page.reload');await wait(`!!document.querySelector('.page-main')`,'reload before connect');await nav('#/settings');
    await cdp.eval(`document.querySelector('#server-address').value=${JSON.stringify(apiBase)};document.querySelector('#connect-form').requestSubmit()`);
    await wait(`location.hash==='#/home' && document.querySelector('#sync-text').textContent.includes('已连接')`,'native connects');
    await check(`!!AndroidStore.request && document.body.classList.contains('android')`,'安装版使用后台网络桥连接共享服务');
  } else {await openBrowser();}
  first=cdp;const ownerA=await owner();
  await shot('02-home.png');
  await nav('#/publish');await shot('03-publish.png');
  await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);
  await check(`!document.querySelector('#form-error').hidden`,'空表单仍能阻止发布');
  await fill('found','共享测试：蓝色校园卡');
  await nav('#/home');await nav('#/publish');await check(`document.querySelector('#title').value==='共享测试：蓝色校园卡'`,'联网版保留草稿');
  await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);await wait(`location.hash.startsWith('#/success/')`,'server saved');
  const foundId=await cdp.eval(`location.hash.split('/')[2]`);
  await check(`document.querySelector('.success-wrap').textContent.includes('共享服务保存')`,'服务确认后才展示发布成功');await shot('04-success.png');
  other=await openBrowser();const ownerB=await owner();
  await check(`${JSON.stringify(ownerA)}!==${JSON.stringify(ownerB)}`,'独立客户端拥有不同发布者身份');
  await nav('#/search?q='+encodeURIComponent('校园卡')+'&category='+encodeURIComponent('校园卡')+'&place='+encodeURIComponent('图书馆')+'&kind=found&status=open');
  await check(`document.querySelectorAll('.results-list .item-card').length===1`,'乙客户端组合搜索可找到甲的新信息');await shot('05-other-search.png');
  await nav('#/detail/'+foundId);
  await check(`document.querySelector('.detail-body h1').textContent.includes('蓝色校园卡')&&!document.querySelector('[data-action="toggle-status"]')`,'乙能查看甲的详情但没有更新按钮');
  await cdp.eval(`document.querySelector('[data-action="contact"]').click()`);
  await check(`document.querySelector('.contact-value').textContent==='测试联系方式：图书馆服务台'`,'跨客户端详情显示发布者提供的联系方式');await shot('06-other-contact.png');
  await cdp.eval(`document.querySelector('[data-action="close-dialog"]').click()`);
  await nav('#/mine');await check(`!document.querySelector('.mine-card')`,'乙的我的发布不含甲的记录');
  const denied=await cdp.eval(`(async()=>{const data=JSON.parse(localStorage.getItem('shiguang-network-v2'));try{await ShiguangNet.request(${JSON.stringify(apiBase)},'/api/items/${foundId}/status','PATCH',{status:'resolved'},data.profiles[${JSON.stringify(apiBase)}].session.token);return 200;}catch(error){return error.status;}})()`);
  await check(`${denied}===403`,'乙直接调用更新接口仍被服务拒绝');
  await nav('#/detail/'+foundId);
  cdp=first;await nav('#/mine');await shot('07-mine.png');
  await cdp.eval(`document.querySelector('[data-action="toggle-status"]').click()`);await shot('08-confirm.png');
  await cdp.eval(`document.querySelector('[data-action="close-dialog"]').click()`);await check(`document.querySelector('.mine-card').textContent.includes('待认领')`,'取消确认不会更新共享状态');
  await cdp.eval(`document.querySelector('[data-action="toggle-status"]').click();document.querySelector('[data-action="confirm-status"]').click()`);
  await wait(`document.querySelector('.mine-card').textContent.includes('已归还')`,'update status');await shot('09-resolved.png');
  cdp=other;await wait(`document.querySelector('.detail-head')?.textContent.includes('已归还')`,'remote automatic status sync');
  await check(`document.querySelector('.detail-head').textContent.includes('已归还')`,'乙自动同步后看到甲更新为已归还');await shot('10-other-resolved.png');
  await nav('#/search?q=XYZ不存在');await check(`!!document.querySelector('.empty-state')`,'联网版搜索无结果提示可用');await shot('11-empty.png');
  cdp=first;await nav('#/detail/'+foundId);
  if(android){
    await cdp.eval(`document.querySelector('[data-action="contact"]').click();document.querySelector('[data-action="copy-contact"]').click()`);
    await check(`document.querySelector('#toast').textContent==='联系方式已复制'`,'联网 APK 原生复制联系方式成功');
    execFileSync(adb,['shell','input','keyevent','4'],{windowsHide:true});await wait(`!document.querySelector('.dialog-backdrop')`,'native back dialog');
    await check(`location.hash.startsWith('#/detail/')`,'原生返回键优先关闭弹窗');
  }
  await closeService();await cdp.eval(`document.querySelector('[data-action="refresh"]').click()`);
  await wait(`document.querySelector('#sync-text').textContent.includes('未连接')`,'offline notice');
  await check(`document.querySelector('.detail-head').textContent.includes('已归还')`,'服务中断后仍能查看最近缓存');await shot('12-offline-cache.png');
  await cdp.eval(`document.querySelector('[data-action="toggle-status"]').click();document.querySelector('[data-action="confirm-status"]').click()`);
  await wait(`document.querySelector('#toast').textContent.includes('未连接')`,'offline status error');
  await check(`document.querySelector('.detail-head').textContent.includes('已归还')&&!!document.querySelector('.dialog-backdrop')`,'断网更新失败不改变显示状态');
  await cdp.eval(`document.querySelector('[data-action="close-dialog"]').click()`);
  await nav('#/publish');await fill('lost','断网不会假成功');await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);
  await wait(`!document.querySelector('#form-error').hidden`,'offline rejects');
  await check(`location.hash==='#/publish'&&document.querySelector('#form-error').textContent.includes('未连接')`,'断网发布显示错误并保留表单');await shot('13-offline-publish.png');
  await startService();
  await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);await wait(`location.hash.startsWith('#/success/')`,'retry publish');
  const lostId=await cdp.eval(`location.hash.split('/')[2]`);await nav('#/detail/'+lostId);
  await cdp.eval(`document.querySelector('[data-action="toggle-status"]').click();document.querySelector('[data-action="confirm-status"]').click()`);
  await wait(`document.querySelector('.detail-head').textContent.includes('已找到')`,'lost resolved');
  await check(`document.querySelector('.detail-head').textContent.includes('已找到')`,'恢复服务后重试发布并标记已找到');
  await closeService();await startService();
  cdp=other;await nav('#/search');await refreshUi();await check(`document.querySelectorAll('.item-card').length===2`,'共享服务重启后两条记录仍可读取');
  cdp=first;
  if(android){
    await cdp.socket.close();execFileSync(adb,['shell','am','force-stop','edu.fzu.shiguang'],{windowsHide:true});execFileSync(adb,['shell','am','start','-n','edu.fzu.shiguang/.MainActivity'],{windowsHide:true});await delay(1300);
    const pid=execFileSync(adb,['shell','pidof','edu.fzu.shiguang'],{encoding:'utf8',windowsHide:true}).trim();execFileSync(adb,['forward','tcp:9299','localabstract:webview_devtools_remote_'+pid],{windowsHide:true});await connect(9299);connections.push(cdp);
    await wait(`document.querySelector('#sync-text')?.textContent.includes('已连接')`,'relaunch sync');await nav('#/mine');
    await check(`document.querySelectorAll('.mine-card').length===2`,'APK 强制停止重开后发布者身份和我的记录保留');await shot('14-relaunch.png');
    report.androidVersion=execFileSync(adb,['shell','getprop','ro.build.version.release'],{encoding:'utf8',windowsHide:true}).trim();
  }else{
    await cdp.send('Page.reload');await wait(`document.querySelector('#sync-text')?.textContent.includes('已连接')`,'browser reload');await nav('#/mine');await check(`document.querySelectorAll('.mine-card').length===2`,'客户端重新加载后身份和记录保留');
    await nav('#/settings');await cdp.eval(`document.querySelector('#server-address').value='http://localhost:${apiPort}';document.querySelector('#connect-form').requestSubmit()`);
    await wait(`location.hash==='#/home'`,'service alias connects');await nav('#/mine');
    await check(`document.querySelectorAll('.mine-card').length===2`,'更换同一服务地址后发布者身份保留');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:true});
    for(const route of ['#/home','#/search','#/publish','#/mine','#/settings']){await nav(route);await check(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.page-main').scrollWidth<=innerWidth`,'320px 界面无横向溢出 '+route);}
  }
  // 主动断网测试预期会产生 net::ERR_CONNECTION_REFUSED；它们与页面异常分开记录。
  report.expectedNetworkErrors=report.consoleErrors.filter(x=>x.includes('ERR_CONNECTION_REFUSED'));
  report.consoleErrors=report.consoleErrors.filter(x=>!x.includes('ERR_CONNECTION_REFUSED')&&!x.includes('403 (Forbidden)'));
  if(report.consoleErrors.length)throw Error('Unexpected console errors: '+report.consoleErrors.join('; '));
  report.passed=true;report.finishedAt=new Date().toISOString();report.clientA=ownerA;report.clientB=ownerB;report.items=[foundId,lostId];report.screenshots=fs.readdirSync(captureDir).filter(x=>x.endsWith('.png'));
  console.log('PASS '+report.checks.length+' network UI checks');
}catch(error){report.passed=false;report.error=error.stack;console.error(error);process.exitCode=1;}
finally{
  fs.writeFileSync(path.join(root,'evidence',android?'android-network-ui.json':'browser-network-ui.json'),JSON.stringify(report,null,2));
  for(const conn of connections){try{await conn.send('Browser.close');}catch{}conn.socket.close();}
  for(const child of browserChildren)child.kill();
  if(service?.listening)await closeService();
  await delay(400);
  for(const dir of profiles){if(!path.resolve(dir).startsWith(path.resolve(root)+path.sep)||!path.basename(dir).startsWith('.verify-profile-'))throw Error('Unsafe profile cleanup');try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}}
}
