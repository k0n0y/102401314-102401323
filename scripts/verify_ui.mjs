import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const android=process.argv.includes('--android');
const captureDir=path.join(root, android?'docs/images/android':'docs/images/browser');
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
  if(android && adb) fs.writeFileSync(path.join(captureDir,name),execFileSync(adb,['exec-out','screencap','-p'],{maxBuffer:15*1024*1024,windowsHide:true}));
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
try {
  let port;
  if(android)port=Number(process.env.CDP_PORT||9299);
  else {
    const browser=[process.env.BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(fs.existsSync);
    if(!browser)throw new Error('Install Chrome or set BROWSER_PATH');
    profile=fs.mkdtempSync(path.join(root,'.verify-profile-'));
    child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
    for(let i=0;i<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await delay(100);
    port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]);
  }
  await connect(port);
  if(!android){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await cdp.send('Page.navigate',{url:pathToFileURL(path.join(root,'web/index.html')).href});
  }
  await nav('#/home');
  await wait(`!!document.querySelector('.hero')`,'home');
  await check(`document.querySelectorAll('.item-card').length>=4`,'首页展示寻物和招领样例');
  if(android)await check(`!!window.AndroidStore && document.body.classList.contains('android')`,'安装 APK 加载原生存储桥和全屏界面');
  await shot('01-home.png');
  await cdp.eval(`document.querySelector('.item-card').click()`);await delay(200);
  await check(`!!document.querySelector('.detail-body h1')`,'点击卡片能查看详情');
  await shot('02-detail.png');
  const contactId=await cdp.eval(`document.querySelector('[data-action="contact"]').dataset.id`);
  const expectedContact=await cdp.eval(`JSON.parse(window.AndroidStore ? AndroidStore.read() : localStorage.getItem('shiguang-app-state-v1')).items.find(item=>item.id===${JSON.stringify(contactId)}).contact`);
  await cdp.eval(`document.querySelector('[data-action="contact"]').click()`);
  await check(`document.querySelector('.contact-value').textContent===${JSON.stringify(expectedContact)}`,'详情显示发布者提供的联系方式');
  if(android){await cdp.eval(`document.querySelector('[data-action="copy-contact"]').click()`);await check(`document.querySelector('#toast').textContent==='联系方式已复制'`,'安卓剪贴板复制成功');}
  await shot('03-contact.png');await cdp.eval(`document.querySelector('[data-action="close-dialog"]').click()`);
  await nav('#/publish');await shot('04-publish.png');
  await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);
  await check(`location.hash==='#/publish' && !document.querySelector('#form-error').hidden`,'空表单给出错误并阻止发布');
  await shot('05-validation.png');
  await fill('found','   ');await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);
  await check(`document.querySelector('#form-error').textContent.includes('标题')`,'纯空格标题被拒绝');
  await fill('found','测试：蓝色校园卡');
  await cdp.eval(`(()=>{const field=document.querySelector('#occurredAt');const date=new Date(Date.now()+3600000);field.value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#publish-form').requestSubmit();})()`);
  await check(`document.querySelector('#form-error').textContent.includes('晚于现在')`,'未来发生时间被拒绝');
  await fill('found','测试：蓝色校园卡');await nav('#/home');await nav('#/publish');
  await check(`document.querySelector('#title').value==='测试：蓝色校园卡'`,'离开页面后发布草稿仍保留');
  await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);await wait(`location.hash.startsWith('#/success/')`,'publish success');
  const foundId=await cdp.eval(`location.hash.split('/')[2]`);
  await check(`document.querySelector('.success-card').textContent.includes('测试：蓝色校园卡')`,'招领信息保存后呈现成功');
  await shot('06-success.png');
  await nav('#/search?q='+encodeURIComponent('校园卡')+'&category='+encodeURIComponent('校园卡')+'&place='+encodeURIComponent('图书馆')+'&kind=found&status=open');
  await check(`document.querySelectorAll('.results-list .item-card').length===1`,'关键词、类别、地点、类型、状态组合筛选命中新记录');
  await shot('07-filters.png');
  await nav('#/search?q='+encodeURIComponent('不存在的物品XYZ'));
  await check(`document.querySelector('.empty-state h2').textContent.includes('没有找到')`,'搜索无结果显示空状态');await shot('08-empty.png');
  await nav('#/mine');
  await cdp.eval(`document.querySelector('[data-action="toggle-status"][data-id="${foundId}"]').click()`);
  await shot('09-confirm.png');await cdp.eval(`document.querySelector('[data-action="close-dialog"]').click()`);
  await check(`document.querySelector('.mine-card').textContent.includes('待认领')`,'取消确认不会修改状态');
  await cdp.eval(`document.querySelector('[data-action="toggle-status"][data-id="${foundId}"]').click();document.querySelector('[data-action="confirm-status"]').click()`);
  await check(`document.querySelector('.mine-card').textContent.includes('已归还')`,'发布者可将招领标记为已归还');await shot('10-resolved.png');
  await nav('#/detail/'+foundId);
  await check(`document.querySelector('.detail-head').textContent.includes('已归还')`,'详情和我的发布状态一致');
  await nav('#/mine');await cdp.eval(`const select=document.querySelector('#user-select');select.value='student-b';select.dispatchEvent(new Event('change',{bubbles:true}));`);
  await check(`!document.querySelector('.mine-card')`,'其他使用者的我的发布不包含甲的记录');
  await nav('#/detail/'+foundId);
  await check(`document.querySelector('.detail-head').textContent.includes('已归还') && !document.querySelector('[data-action="toggle-status"]')`,'其他使用者可查看最新状态但不能修改');await shot('11-other-user.png');
  await nav('#/mine');await cdp.eval(`document.querySelector('#user-select').value='guest';document.querySelector('#user-select').dispatchEvent(new Event('change',{bubbles:true}));`);
  await nav('#/publish');await fill('lost','测试访客不能发布');await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);
  await check(`location.hash==='#/publish' && document.querySelector('#form-error').textContent.includes('身份')`,'访客不能发布');
  await nav('#/mine');await cdp.eval(`document.querySelector('#user-select').value='student-a';document.querySelector('#user-select').dispatchEvent(new Event('change',{bubbles:true}));`);
  await nav('#/publish');await fill('lost','测试：寻找校园卡');await cdp.eval(`document.querySelector('#publish-form').requestSubmit()`);await wait(`location.hash.startsWith('#/success/')`,'lost success');
  const lostId=await cdp.eval(`location.hash.split('/')[2]`);await nav('#/detail/'+lostId);
  await cdp.eval(`document.querySelector('[data-action="toggle-status"]').click();document.querySelector('[data-action="confirm-status"]').click()`);
  await check(`document.querySelector('.detail-head').textContent.includes('已找到')`,'寻物信息可更新为已找到');
  await cdp.eval(`document.querySelector('[data-action="toggle-status"]').click();document.querySelector('[data-action="confirm-status"]').click()`);
  await check(`document.querySelector('.detail-head').textContent.includes('寻找中')`,'误操作后可恢复进行中');
  await cdp.send('Page.reload');await wait(`!!document.querySelector('.detail-body')`,'reload');
  await check(`document.querySelector('.detail-head').textContent.includes('寻找中')`,'刷新后正式数据与状态仍存在');
  await nav('#/mine');await shot('12-mine.png');
  if(android && adb){
    report.androidVersion=execFileSync(adb,['shell','getprop','ro.build.version.release'],{encoding:'utf8',windowsHide:true}).trim();
    await cdp.socket.close();
    execFileSync(adb,['shell','am','force-stop','edu.fzu.shiguang'],{windowsHide:true});
    execFileSync(adb,['shell','am','start','-n','edu.fzu.shiguang/.MainActivity'],{windowsHide:true});
    await delay(1500);
    const sockets=execFileSync(adb,['shell','cat','/proc/net/unix'],{encoding:'utf8',windowsHide:true});
    const socketName=sockets.match(/@webview_devtools_remote_\d+/)?.[0].slice(1);
    if(!socketName)throw new Error('WebView socket missing after relaunch');
    execFileSync(adb,['forward','tcp:9299','localabstract:'+socketName],{windowsHide:true});
    await connect(9299);await wait(`!!document.querySelector('.hero')`,'relaunch home');
    await nav('#/detail/'+foundId);await check(`document.querySelector('.detail-head').textContent.includes('已归还')`,'强制停止并重新打开 APK 后招领状态持久保存');
    await shot('13-relaunch.png');
    await nav('#/mine');
  }
  if(!android){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:true});
    for(const route of ['#/home','#/search','#/publish','#/mine']){await nav(route);await check(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('.page-main').scrollWidth<=innerWidth`,'320px 窄屏不溢出 '+route);}
    await nav('#/search?q=%E0%A4%A');await check(`!!document.querySelector('#search-form')`,'畸形路由参数不会导致白屏');
    await nav('#/detail/%E0%A4%A');await check(`document.querySelector('.empty-state').textContent.includes('未找到')`,'畸形详情编号显示错误提示');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await nav('#/home');
  }
  if(report.consoleErrors.length)throw new Error('Console errors: '+report.consoleErrors.join('; '));
  report.passed=true;report.finishedAt=new Date().toISOString();report.screenshots=fs.readdirSync(captureDir).filter(x=>x.endsWith('.png'));
  console.log(`PASS ${report.checks.length} checks`);
}catch(error){report.passed=false;report.error=error.stack;console.error(error);process.exitCode=1;}
finally{
  fs.writeFileSync(path.join(root,'evidence',android?'android-ui.json':'browser-ui.json'),JSON.stringify(report,null,2));
  if(!android){try{await cdp?.send('Browser.close');}catch{}child?.kill();}
  cdp?.socket.close();
  if(profile){await delay(500);const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(root)+path.sep)||!path.basename(profile).startsWith('.verify-profile-'))throw new Error('Unsafe cleanup target');try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}}
}
