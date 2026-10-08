/* 正式数据由共享服务确认。本机只保存凭证、缓存和草稿。 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShiguangNet=api;})(globalThis,function(root){
  'use strict';
  const pending=new Map();let sequence=0;
  function normalizeBase(raw) {
    const url=new URL(raw);
    if (url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)) throw Error('请填写 http 或 https 服务地址，不要带账号或查询参数');
    if(url.protocol==='http:'&&!/^(localhost|127\.0\.0\.1|10\.(\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(url.hostname))throw Error('公网服务请使用 HTTPS；HTTP 仅用于局域网');
    if(url.pathname!=='/' && url.pathname!=='')throw Error('请填写服务根地址，例如 http://192.168.1.5:8787');
    return url.origin;
  }
  function complete(id,result) { const p=pending.get(String(id));if(!p)return;pending.delete(String(id));clearTimeout(p.timer);p.resolve(result); }
  async function request(base,path,method='GET',body,token) {
    let response;
    if(root.AndroidStore?.request) {
      response=await new Promise((resolve,reject)=>{
        const id=String(++sequence),timer=setTimeout(()=>{pending.delete(id);reject(Error('服务连接超时，请检查地址和网络后重试'));},15000);
        pending.set(id,{resolve,timer});
        root.AndroidStore.request(id,base,path,method,body?JSON.stringify(body):'',token||'');
      });
      if(response.error)throw Error(response.error);
      response={status:response.status,text:response.text};
    } else {
      try { const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000),cache:'no-store'});response={status:r.status,text:await r.text()}; }
      catch {throw Error('未连接共享服务，请检查服务地址、网络和服务是否启动');}
    }
    let data;try{data=JSON.parse(response.text);}catch{throw Error('服务响应异常，请确认填写的是拾光服务地址');}
    if(response.status<200||response.status>=300)throw Object.assign(Error(data.error||'服务请求失败'),{status:response.status,errors:data.errors});
    return data;
  }
  return {normalizeBase,request,complete};
});
