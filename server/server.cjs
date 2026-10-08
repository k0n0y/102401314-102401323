'use strict';
const http = require('node:http');
const {DatabaseSync} = require('node:sqlite');
const {randomUUID, randomBytes, createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../web/domain.js');
const hash = value => createHash('sha256').update(value).digest('hex');
function createServer({dbPath = path.join(__dirname, '../data/shiguang.sqlite')} = {}) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), {recursive:true});
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS publishers(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, request_key TEXT NOT NULL, input_hash TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(owner_id,request_key));`);
  db.prepare('INSERT OR IGNORE INTO metadata VALUES(?,?)').run('server-id',randomUUID());
  const serverId=db.prepare('SELECT value FROM metadata WHERE key=?').get('server-id').value;
  function fail(status, message, errors) { throw Object.assign(new Error(message), {status, errors}); }
  function auth(req) {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
    const user = token && db.prepare('SELECT id FROM publishers WHERE token_hash=?').get(hash(token));
    if (!user) fail(401, '发布者凭证无效，请重新连接服务');
    return user.id;
  }
  async function body(req) {
    const chunks=[];let size=0;for await (const chunk of req){size+=chunk.length;if(size>16384)fail(413,'请求内容过长');chunks.push(chunk);}
    const raw=Buffer.concat(chunks).toString('utf8');
    try { const parsed=JSON.parse(raw || '{}'); if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw Error(); return parsed; }
    catch { fail(400, '请求必须是 JSON 对象'); }
  }
  const server = http.createServer(async (req,res) => {
    const json = (status,value) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value)); };
    if (req.method==='OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Access-Control-Allow-Private-Network':'true'});res.end();return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method==='GET' && url.pathname==='/api/health') return json(200,{ok:true,version:'1.1.0',serverId});
      if (req.method==='POST' && url.pathname==='/api/sessions') {
        const token=randomBytes(32).toString('hex'),ownerId=randomUUID();
        db.prepare('INSERT INTO publishers VALUES(?,?)').run(ownerId,hash(token));
        return json(201,{token,ownerId});
      }
      if (req.method==='GET' && url.pathname==='/api/me') return json(200,{ownerId:auth(req)});
      if (req.method==='GET' && url.pathname==='/api/items') {
        const items=db.prepare('SELECT payload FROM items').all().map(row=>JSON.parse(row.payload));
        return json(200,{items:D.search(items,Object.fromEntries(url.searchParams)),syncedAt:new Date().toISOString()});
      }
      if (req.method==='POST' && url.pathname==='/api/items') {
        const ownerId=auth(req), input=await body(req), errors=D.validate(input);
        if (Object.keys(errors).length) fail(400,Object.values(errors)[0],errors);
        if (!/T.*(Z|[+-]\d{2}:\d{2})$/.test(input.occurredAt)) fail(400,'发生时间必须包含时区');
        if (!/^[a-zA-Z0-9-]{8,80}$/.test(input.requestKey||'')) fail(400,'发布请求编号无效');
        const clean={};for (const key of ['kind','category','title','place','description','contact','occurredAt']) clean[key]=input[key].trim();
        const inputHash=hash(JSON.stringify(clean));
        const existing=db.prepare('SELECT payload,input_hash FROM items WHERE owner_id=? AND request_key=?').get(ownerId,input.requestKey);
        if (existing) { if (existing.input_hash!==inputHash) fail(409,'该发布请求已保存其他内容，请重新填写');return json(200,{item:JSON.parse(existing.payload),replayed:true}); }
        const item={...clean,id:randomUUID(),ownerId,status:'open',postedAt:new Date().toISOString()};
        db.prepare('INSERT INTO items VALUES(?,?,?,?,?)').run(item.id,ownerId,input.requestKey,inputHash,JSON.stringify(item));
        return json(201,{item});
      }
      const match=/^\/api\/items\/([a-f0-9-]{36})(\/status)?$/.exec(url.pathname);
      if (match && ['GET','PATCH'].includes(req.method)) {
        const row=db.prepare('SELECT payload,owner_id FROM items WHERE id=?').get(match[1]);
        if (!row) fail(404,'这条信息不存在');
        const item=JSON.parse(row.payload);
        if (req.method==='GET' && !match[2]) return json(200,{item});
        if (req.method==='PATCH' && match[2]) {
          if (auth(req)!==row.owner_id) fail(403,'只有发布者能更新状态');
          const input=await body(req);if (!['open','resolved'].includes(input.status)) fail(400,'处理状态无效');
          item.status=input.status;
          db.prepare('UPDATE items SET payload=? WHERE id=?').run(JSON.stringify(item),item.id);
          return json(200,{item});
        }
      }
      if (url.pathname.startsWith('/api/')) fail(404,'接口不存在');
      if (req.method!=='GET') fail(405,'请求方法不支持');
      const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if (!['index.html','styles.css','domain.js','network.js','app.js','favicon.svg'].includes(file)) fail(404,'文件不存在');
      const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';
      res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(__dirname,'../web',file)));
    } catch(error) { if (!res.headersSent) json(error.status||500,{error:error.status?error.message:'服务暂时无法处理，请重试',...(error.errors?{errors:error.errors}:{})}); else res.end(); }
  });
  server.on('close',()=>db.close());
  return server;
}
module.exports={createServer};
if(require.main===module) {
  const port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0';
  const server=createServer(process.env.DB_PATH?{dbPath:process.env.DB_PATH}:{});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
  server.listen(port,host,()=>{
    console.log(`拾光共享服务已启动。电脑预览：http://localhost:${port}`);
    for(const entries of Object.values(require('node:os').networkInterfaces())) for(const ip of entries||[]) if(ip.family==='IPv4'&&!ip.internal) console.log(`同一局域网手机服务地址：http://${ip.address}:${port}`);
    console.log('保持此窗口运行。数据保存在 data/shiguang.sqlite，请定期备份。');
  });
}
