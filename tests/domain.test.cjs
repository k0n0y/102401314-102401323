const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../web/domain.js');
const now = Date.parse('2026-10-07T12:00:00Z');
const input = () => ({ kind:'lost', category:'校园卡', title:'蓝色校园卡', place:'图书馆一楼', description:'蓝色卡套带有星星贴纸', contact:'图书馆服务台', occurredAt:'2026-10-07T10:00:00Z' });
const item = (id='one', user='student-a', override={}) => D.createItem({...input(),...override}, user, {now,id});
const state = () => ({version:1,currentUser:'student-a',items:[]});

test('U01 完整寻物信息默认进入寻找中', () => assert.equal(D.statusLabel(item()), '寻找中'));
test('U02 招领信息默认进入待认领', () => assert.equal(D.statusLabel(item('one','student-a',{kind:'found'})), '待认领'));
test('U03 四个文本字段缺失都被拒绝', () => {
  for (const key of ['title','place','description','contact']) assert.ok(D.validate({...input(),[key]:''},now)[key]);
});
test('U04 纯空格不能冒充有效内容', () => assert.ok(D.validate({...input(),title:' \t\n '},now).title));
test('U05 类别和信息类型限制为合法枚举', () => {
  assert.ok(D.validate({...input(),category:'不存在'},now).category);
  assert.ok(D.validate({...input(),kind:'unknown'},now).kind);
});
test('U06 时间为空、非法或未来都被拒绝', () => {
  for (const value of ['', 'bad-date', '2026-10-07T12:00:01Z']) assert.ok(D.validate({...input(),occurredAt:value},now).occurredAt);
});
test('U07 发生时间等于当前时间可以发布', () => assert.deepEqual(D.validate({...input(),occurredAt:new Date(now).toISOString()},now),{}));
test('U08 四个长度边界精确检查', () => {
  for (const [key, max] of Object.entries({title:40,place:50,description:300,contact:80})) {
    assert.equal(D.validate({...input(),[key]:'字'.repeat(max)},now)[key],undefined);
    assert.ok(D.validate({...input(),[key]:'字'.repeat(max+1)},now)[key]);
  }
});
test('U09 发布去掉首尾空格并保留原输入对象', () => {
  const draft={...input(),title:'  蓝色校园卡  '}; const result=D.createItem(draft,'student-a',{now,id:'id'});
  assert.equal(result.title,'蓝色校园卡'); assert.equal(draft.title,'  蓝色校园卡  ');
});
test('U10 未知身份与访客不能发布', () => {
  for (const user of ['guest','bad']) assert.throws(()=>D.createItem(input(),user,{now,id:'id'}),/身份/);
});
test('U11 搜索标题、描述、类别和地点', () => {
  for (const word of ['校园卡','星星','图书馆']) assert.equal(D.search([item()],{q:word}).length,1);
});
test('U12 搜索不区分大小写并折叠全角字符', () => assert.equal(D.search([item('id','student-a',{title:'USB 耳机'})],{q:'ｕｓｂ'}).length,1));
test('U13 多个关键词要求全部命中', () => {
  assert.equal(D.search([item()],{q:'校园卡 图书馆'}).length,1);
  assert.equal(D.search([item()],{q:'校园卡 操场'}).length,0);
});
test('U14 无结果与空输入都有确定行为', () => {
  assert.deepEqual(D.search([item()],{q:'不存在的词'}),[]);
  assert.equal(D.search([item()],{q:'  '}).length,1);
});
test('U15 类别、地点、类型与状态组合筛选', () => {
  const items=[item(),item('two','student-b',{kind:'found',category:'耳机',place:'体育馆'})];
  assert.equal(D.search(items,{kind:'lost',category:'校园卡',place:'图书馆',status:'open'}).length,1);
  assert.equal(D.search(items,{kind:'lost',category:'耳机'}).length,0);
});
test('U16 搜索排序不会修改原数组', () => {
  const old={...item('old'),postedAt:'2026-10-06T12:00:00Z'}; const items=[old,item('new')];
  assert.equal(D.search(items)[0].id,'new'); assert.equal(items[0].id,'old');
});
test('U17 发布者能标记已找到，原状态不可变', () => {
  const original={...state(),items:[item()]}; const changed=D.setStatus(original,'one','resolved');
  assert.equal(D.statusLabel(changed.items[0]),'已找到'); assert.equal(original.items[0].status,'open');
});
test('U18 招领归还与重新打开都使用正确状态文案', () => {
  const original={...state(),items:[item('one','student-a',{kind:'found'})]};
  const resolved=D.setStatus(original,'one','resolved'); assert.equal(D.statusLabel(resolved.items[0]),'已归还');
  assert.equal(D.statusLabel(D.setStatus(resolved,'one','open').items[0]),'待认领');
});
test('U19 其他使用者和访客不能更新他人状态', () => {
  for (const user of ['student-b','guest']) assert.throws(()=>D.setStatus({...state(),currentUser:user,items:[item()]},'one','resolved'),/只有发布者/);
});
test('U20 不存在信息或非法状态不能更新', () => {
  assert.throws(()=>D.setStatus(state(),'missing','resolved'),/不存在/);
  assert.throws(()=>D.setStatus(state(),'missing','invalid'),/无效/);
});
test('U21 我的发布仅包含当前身份记录', () => {
  const s={...state(),items:[item('a'),item('b','student-b')]};
  assert.deepEqual(D.mine(s).map(x=>x.id),['a']); assert.deepEqual(D.mine(D.switchUser(s,'student-b')).map(x=>x.id),['b']);
});
test('U22 切换身份不修改公共列表且拒绝未知身份', () => {
  const s={...state(),items:[item()]}; assert.equal(D.switchUser(s,'guest').items,s.items); assert.equal(s.currentUser,'student-a');
  assert.throws(()=>D.switchUser(s,'bad'),/无效/);
});
test('U23 新记录成功发布且拒绝重复编号', () => {
  const s=D.publish(state(),input(),{now,id:'one'}); assert.equal(s.items.length,1); assert.equal(state().items.length,0);
  assert.throws(()=>D.publish(s,input(),{now,id:'one'}),/重复/);
});
test('U24 本地存储序列化后可以恢复所有状态', () => {
  const s=D.setStatus({...state(),items:[item()]},'one','resolved'); assert.deepEqual(D.decodeState(JSON.stringify(s),[]),s);
});
test('U25 初次使用复制样例，避免修改种子数据', () => {
  const seed=[item()]; const s=D.decodeState('',seed); s.items[0].title='changed'; assert.equal(seed[0].title,'蓝色校园卡');
});
test('U26 损坏或未知版本的数据不会静默覆盖', () => {
  assert.throws(()=>D.decodeState('not-json',[]),/损坏/); assert.throws(()=>D.decodeState('{"version":9}',[]),/无法识别/);
});
test('U27 本地记录重复编号、字段或状态损坏会报错', () => {
  for (const items of [[item(),item()],[{...item(),status:'bad'}],[{...item(),ownerId:'bad'}],[{...item(),title:''}],[null]]) {
    assert.throws(()=>D.decodeState(JSON.stringify({...state(),items}),[]),/校验失败/);
  }
});
test('U28 保存异常与原生 false 都不能呈现成功', () => {
  assert.throws(()=>D.commit(state(),{setItem(){throw new Error('full');}}),/full/);
  assert.throws(()=>D.commit(state(),{setItem(){return false;}}),/保存失败/);
});
test('U29 保存成功使用固定键及完整 JSON', () => {
  let saved; const s=state(); assert.equal(D.commit(s,{setItem(key,value){saved=[key,value];}}),s);
  assert.equal(saved[0],'shiguang-app-state-v1'); assert.deepEqual(JSON.parse(saved[1]),s);
});
test('U30 HTML 标记和引号均作为文本处理', () => assert.equal(D.escapeHtml(`<img src=x onerror="x">&'`),'&lt;img src=x onerror=&quot;x&quot;&gt;&amp;&#39;'));
test('U31 无效信息编号和不合法发布字段不能绕过业务校验', () => {
  assert.throws(()=>D.createItem(input(),'student-a',{now,id:''}),/编号无效/);
  assert.throws(()=>D.createItem({...input(),title:''},'student-a',{now,id:'id'}),/请填写/);
});
