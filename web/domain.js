/* 纯业务逻辑：同一份代码用于 App 和 Node 单元测试。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Shiguang = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CATEGORIES = ['校园卡', '雨伞', '耳机', '钥匙', '水杯', '书籍', '其他'];
  const USERS = { 'student-a': '甲同学', 'student-b': '乙同学', guest: '访客' };
  const LABELS = { title: '物品标题', place: '地点', description: '详细描述', contact: '联系方式' };
  const LIMITS = { title: 40, place: 50, description: 300, contact: 80 };
  const normalize = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
  function validate(input, now = Date.now()) {
    const errors = {};
    for (const key of Object.keys(LIMITS)) {
      if (typeof input[key] !== 'string' || !input[key].trim()) errors[key] = `请填写${LABELS[key]}`;
      else if (input[key].trim().length > LIMITS[key]) errors[key] = `${LABELS[key]}最多 ${LIMITS[key]} 字`;
    }
    if (!['lost', 'found'].includes(input.kind)) errors.kind = '请选择寻物或招领';
    if (!CATEGORIES.includes(input.category)) errors.category = '请选择物品分类';
    const time = typeof input.occurredAt === 'string' ? Date.parse(input.occurredAt) : NaN;
    if (!Number.isFinite(time)) errors.occurredAt = '请填写有效的发生时间';
    else if (time > now) errors.occurredAt = '发生时间不能晚于现在';
    return errors;
  }
  function createItem(input, userId, { now = Date.now(), id } = {}) {
    if (!USERS[userId] || userId === 'guest') throw new Error('请先切换到发布者身份');
    const errors = validate(input, now);
    if (Object.keys(errors).length) throw Object.assign(new Error(Object.values(errors)[0]), { errors });
    if (typeof id !== 'string' || !id) throw new Error('信息编号无效');
    return {
      id, kind: input.kind, category: input.category, occurredAt: input.occurredAt,
      title: input.title.trim(), place: input.place.trim(), description: input.description.trim(),
      contact: input.contact.trim(), postedAt: new Date(now).toISOString(), status: 'open', ownerId: userId
    };
  }
  function publish(state, input, options) {
    const item = createItem(input, state.currentUser, options);
    if (state.items.some(entry => entry.id === item.id)) throw new Error('信息编号重复，请重新发布');
    return { ...state, items: [item, ...state.items] };
  }
  function search(items, { q = '', kind = 'all', category = 'all', place = '', status = 'all' } = {}) {
    const words = normalize(q).split(/\s+/).filter(Boolean);
    return items.filter(item => {
      const text = normalize(`${item.title} ${item.category} ${item.place} ${item.description}`);
      return words.every(word => text.includes(word)) &&
        (kind === 'all' || item.kind === kind) &&
        (category === 'all' || item.category === category) &&
        (!normalize(place) || normalize(item.place).includes(normalize(place))) &&
        (status === 'all' || item.status === status);
    }).slice().sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt) || a.id.localeCompare(b.id));
  }
  function setStatus(state, id, status) {
    if (!['open', 'resolved'].includes(status)) throw new Error('处理状态无效');
    const item = state.items.find(entry => entry.id === id);
    if (!item) throw new Error('这条信息不存在');
    if (state.currentUser === 'guest' || item.ownerId !== state.currentUser) throw new Error('只有发布者能更新状态');
    return { ...state, items: state.items.map(entry => entry.id === id ? { ...entry, status } : entry) };
  }
  function switchUser(state, userId) {
    if (!USERS[userId]) throw new Error('身份无效');
    return { ...state, currentUser: userId };
  }
  function mine(state) { return search(state.items.filter(item => item.ownerId === state.currentUser)); }
  function statusLabel(item) { return item.status === 'resolved' ? (item.kind === 'found' ? '已归还' : '已找到') : (item.kind === 'found' ? '待认领' : '寻找中'); }
  function decodeState(raw, seed) {
    const fresh = () => ({ version: 1, currentUser: 'student-a', items: seed.map(item => ({ ...item })) });
    if (!raw) return fresh();
    let state;
    try { state = JSON.parse(raw); } catch { throw new Error('本地数据损坏，请保留数据并联系开发者'); }
    if (state?.version !== 1 || !USERS[state.currentUser] || !Array.isArray(state.items)) throw new Error('本地数据格式无法识别');
    const ids = new Set();
    for (const item of state.items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !['open','resolved'].includes(item.status) ||
          !['student-a','student-b','sample'].includes(item.ownerId) || !Number.isFinite(Date.parse(item.postedAt)) ||
          Object.keys(validate(item, Math.max(Date.now(), Date.parse(item.postedAt)))).length) throw new Error('本地信息校验失败');
      ids.add(item.id);
    }
    return state;
  }
  function commit(next, storage) {
    const result = storage.setItem('shiguang-app-state-v1', JSON.stringify(next));
    if (result === false) throw new Error('保存失败：请检查设备存储空间后重试');
    return next;
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
  return { CATEGORIES, USERS, validate, createItem, publish, search, setStatus, switchUser, mine, statusLabel, decodeState, commit, escapeHtml };
});
