/* 拾光 Android App：交互界面与本机持久化，业务逻辑位于 domain.js。 */
(() => {
  "use strict";

  const D = window.Shiguang;
  if (window.AndroidStore) document.body.classList.add('android');
  const STORAGE_KEY = "shiguang-app-state-v1";
  const CATEGORY_ICONS = { "校园卡": "id", "雨伞": "umbrella", "耳机": "headphones", "钥匙": "keys", "水杯": "bottle", "其他": "box" };
  const DEMO_ITEMS = [
    {
      id: "demo-card", kind: "lost", category: "校园卡", title: "寻找一张蓝色校园卡",
      description: "卡面是蓝色的，可能落在教学楼 B 区一层自习室。若有同学拾到，请通过下方线索联系我，非常感谢！",
      place: "教学楼 B 区", occurredAt: "2026-09-23T18:10", postedAt: "2026-09-23T19:05",
      contact: "演示联系方式：教学楼服务台留言", status: "open", ownerId: "sample"
    },
    {
      id: "demo-umbrella", kind: "found", category: "雨伞", title: "食堂门口拾到一把黑色雨伞",
      description: "黑色折叠伞，伞柄有一条浅灰色挂绳。已暂放在食堂一楼服务台，可描述细节后领取。",
      place: "一号食堂门口", occurredAt: "2026-09-23T12:20", postedAt: "2026-09-23T13:10",
      contact: "演示联系方式：一号食堂服务台", status: "open", ownerId: "sample"
    },
    {
      id: "demo-headphones", kind: "lost", category: "耳机", title: "找一副白色无线耳机",
      description: "白色耳机盒，外壳贴有小星星贴纸。周二晚可能遗落在图书馆三楼。拾到的同学请联系，谢谢。",
      place: "图书馆三楼", occurredAt: "2026-09-22T20:30", postedAt: "2026-09-23T09:24",
      contact: "演示联系方式：图书馆前台留言", status: "open", ownerId: "sample"
    },
    {
      id: "demo-keys", kind: "found", category: "钥匙", title: "操场看台拾到一串钥匙",
      description: "共三把钥匙，挂着一枚绿色小挂件。物品已交给体育馆值班室，领取时请说明挂件样式。",
      place: "东区操场看台", occurredAt: "2026-09-22T17:40", postedAt: "2026-09-22T18:15",
      contact: "演示联系方式：体育馆值班室", status: "open", ownerId: "sample"
    },
    {
      id: "demo-bottle", kind: "found", category: "水杯", title: "找到一只浅绿色保温杯",
      description: "浅绿色金属保温杯，杯身有卡通贴纸。暂放在图书馆失物招领处。",
      place: "图书馆二楼", occurredAt: "2026-09-21T15:20", postedAt: "2026-09-21T16:00",
      contact: "演示联系方式：图书馆失物招领处", status: "resolved", ownerId: "sample"
    }
  ];

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const storage = window.AndroidStore ? {
    getItem: () => AndroidStore.read(),
    setItem: (_key, value) => AndroidStore.save(value)
  } : localStorage;
  let state;
  try {
    state = D.decodeState(storage.getItem(STORAGE_KEY), DEMO_ITEMS);
    D.commit(state, storage);
  } catch (error) {
    app.innerHTML = '<main class="page-pad"><h1>无法读取本地数据</h1><p>' + D.escapeHtml(error.message) + '</p><p>请保留应用数据，检查存储空间并重启 App。不要清除数据。</p></main>';
    return;
  }
  function applyState(next) {
    try { state = D.commit(next, storage); return true; }
    catch (error) { showToast(error.message || '保存失败，请重试'); return false; }
  }
  function myItems() { return D.mine(state); }
  let activeDialogTrigger = null;
  let toastTimer = null;

  function icon(name, className = "") {
    return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  }

  const escapeHtml = D.escapeHtml;
  function allItems() { return D.search(state.items); }
  function findItem(id) { return state.items.find(item => item.id === id); }
  function kindLabel(kind) { return kind === 'found' ? '招领' : '寻物'; }
  const statusLabel = D.statusLabel;

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间待确认";
    return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }

  function categoryArt(item, large = false) {
    const symbol = CATEGORY_ICONS[item.category] || "box";
    return `<span class="${large ? "detail-visual" : "item-art"} art-${symbol}" aria-hidden="true">${icon(symbol)}</span>`;
  }

  function itemCard(item, from = "home") {
    const desc = escapeHtml(item.description);
    const path = `#/detail/${encodeURIComponent(item.id)}?from=${encodeURIComponent(from)}`;
    return `<a class="item-card" href="${path}" aria-label="查看${escapeHtml(item.title)}的详情">
      ${categoryArt(item)}
      <span class="item-body">
        <span class="item-top"><span class="item-title">${escapeHtml(item.title)}${item.ownerId === "sample" ? " · 示例" : ""}</span><span class="item-type ${item.kind === "found" ? "found" : ""}">${kindLabel(item.kind)}</span></span>
        <span class="item-desc">${desc}</span>
        <span class="item-bottom"><span>${icon("pin")}${escapeHtml(item.place)}</span><span>${item.status === "resolved" ? `<span class="resolved-stamp">${icon("check")}${statusLabel(item)}</span>` : escapeHtml(formatDate(item.postedAt))}</span></span>
      </span>
    </a>`;
  }

  function nav(active) {
    const entries = [
      ["home", "首页", "home", "#/home"],
      ["search", "搜索", "search", "#/search"],
      ["publish", "发布", "plus", "#/publish"],
      ["mine", "我的", "user", "#/mine"]
    ];
    return `<nav class="bottom-nav" aria-label="主要导航">${entries.map(([key, label, symbol, href]) =>
      `<a class="nav-link ${active === key ? "active" : ""} ${key === "publish" ? "nav-publish" : ""}" href="${href}" ${active === key ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`
    ).join("")}</nav>`;
  }

  function topbar() {
    return `<header class="topbar"><a class="brand" href="#/home" aria-label="拾光，返回首页"><span class="brand-mark">拾</span>拾光</a><span class="campus-pill">${icon("pin")}校园失物招领</span></header>`;
  }

  function subbar(label, href) {
    return `<header class="subbar"><a class="back-button" href="${href}" aria-label="返回">${icon("arrow-left")}</a><strong>${label}</strong><span class="eyebrow-mini">拾光 · 校园</span></header>`;
  }

  function shell(header, main, active) {
    return `${header}<main id="main-content" class="page-main" tabindex="-1">${main}</main>${nav(active)}`;
  }

  function renderHome() {
    const latest = allItems().filter((item) => item.status === "open").slice(0, 4);
    const main = `<div class="page-pad">
      <section class="hero" aria-label="拾光介绍">
        <span class="hero-kicker">${icon("sparkle")}小物件，也值得被认真寻找</span>
        <h1 id="page-title">丢失的东西，<br>我们一起找回来。</h1>
        <p>让寻物与招领信息回到同一个地方，每一条线索都更容易被看见。</p>
        <a class="hero-action" href="#/publish">立即发布信息 ${icon("arrow-right")}</a>
        <span class="hero-doodle" aria-hidden="true">${icon("search")}</span>
      </section>
      <a class="search-shortcut" href="#/search">${icon("search")}<span>搜一搜物品名称、地点或关键词</span></a>
      <div class="quick-grid" aria-label="快速筛选">
        <a class="quick-card lost" href="#/search?kind=lost"><strong>我丢了东西</strong><small>看看大家正在寻找什么</small><span class="quick-icon">${icon("search")}</span></a>
        <a class="quick-card found" href="#/search?kind=found"><strong>我捡到东西</strong><small>帮失主找到回家的路</small><span class="quick-icon">${icon("check")}</span></a>
      </div>
      <div class="section-heading"><h2>最新线索</h2><a class="inline-link" href="#/search">查看全部 ${icon("chevron-right")}</a></div>
      <div class="item-list">${latest.map((item) => itemCard(item, "home")).join("")}</div>
      <div class="notice">${icon("sparkle")}<span>离线版：当前设备共享信息。带“示例”标识的是虚构样例。</span></div>
    </div>`;
    return shell(topbar(), main, "home");
  }

  function renderSearch(params) {
    const query = params.get("q") || "";
    const kind = ["lost", "found"].includes(params.get("kind")) ? params.get("kind") : "all";
    const category = D.CATEGORIES.includes(params.get('category')) ? params.get('category') : 'all';
    const place = params.get('place') || '';
    const status = ['open', 'resolved'].includes(params.get('status')) ? params.get('status') : 'all';
    const results = D.search(state.items, { q: query, kind, category, place, status });
    const tabs = [["all", "全部"], ["lost", "寻物"], ["found", "招领"]];
    const empty = `<div class="empty-state"><span class="empty-icon">${icon("search")}</span><h2>暂时没有找到相关信息</h2><p>试试更短的关键词，或切换“全部”查看其他线索。</p><a class="button secondary" href="#/search">清除筛选</a></div>`;
    const main = `<div class="search-panel"><h1 class="screen-title" id="page-title">搜索线索</h1><p class="screen-subtitle">一个关键词，让有用的线索更快浮现。</p>
      <form class="search-form" id="search-form" role="search">${icon("search")}<input id="search-input" type="search" name="q" value="${escapeHtml(query)}" placeholder="例如：校园卡、图书馆" aria-label="输入物品名称或地点" autocomplete="off" /><button type="submit">搜索</button></form>
      <div class="filter-grid">
        <label>类别<select class="text-field" id="filter-category"><option value="all">全部类别</option>${D.CATEGORIES.map(value => `<option ${category === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>状态<select class="text-field" id="filter-status"><option value="all">全部状态</option><option value="open" ${status === 'open' ? 'selected' : ''}>进行中</option><option value="resolved" ${status === 'resolved' ? 'selected' : ''}>已完成</option></select></label>
        <label class="filter-place">地点<input class="text-field" id="filter-place" maxlength="50" value="${escapeHtml(place)}" placeholder="如：图书馆" /><button type="button" class="inline-link" data-action="apply-filter">应用筛选</button></label>
      </div>
      <div class="tabs" role="group" aria-label="信息类型筛选">${tabs.map(([key, label]) => `<button type="button" class="tab ${kind === key ? "active" : ""}" data-action="filter" data-kind="${key}" aria-pressed="${kind === key}">${label}</button>`).join("")}</div>
    </div>
    <div class="result-heading" aria-live="polite"><strong>${query ? `“${escapeHtml(query)}”的搜索结果` : "全部信息"}</strong><span>共 ${results.length} 条</span></div>
    ${results.length ? `<div class="results-list item-list">${results.map((item) => itemCard(item, "search")).join("")}</div>` : empty}`;
    return shell(topbar(), main, "search");
  }

  function localDateTimeNow() {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function renderPublish() {
    const main = `<div class="form-intro"><h1 class="screen-title" id="page-title">发布一条线索</h1><p class="screen-subtitle">写清物品特征和地点，帮助彼此更快找到对方。</p></div>
      <form class="publish-form" id="publish-form" novalidate>
        <div class="field-group"><span class="field-legend" id="kind-label">信息类型 <span class="required" aria-label="必填">*</span></span><div class="segmented" role="radiogroup" aria-labelledby="kind-label">
          <label class="segment-option"><input type="radio" name="kind" value="lost" checked required /> 寻物 · 我丢了</label>
          <label class="segment-option"><input type="radio" name="kind" value="found" required /> 招领 · 我捡到</label>
        </div></div>
        <div class="field-group"><label for="title">物品标题 <span class="required" aria-label="必填">*</span></label><input class="text-field" id="title" name="title" required maxlength="40" placeholder="例如：寻找一张蓝色校园卡" /></div>
        <div class="field-group"><label for="category">物品分类 <span class="required" aria-label="必填">*</span></label><select class="text-field" id="category" name="category" required><option value="">请选择分类</option><option>校园卡</option><option>雨伞</option><option>耳机</option><option>钥匙</option><option>水杯</option><option>书籍</option><option>其他</option></select></div>
        <div class="field-row"><div class="field-group"><label for="occurredAt">丢失 / 拾获时间 <span class="required" aria-label="必填">*</span></label><input class="text-field" id="occurredAt" name="occurredAt" type="datetime-local" max="${localDateTimeNow()}" required /></div>
        <div class="field-group"><label for="place">地点 <span class="required" aria-label="必填">*</span></label><input class="text-field" id="place" name="place" required maxlength="50" placeholder="例如：图书馆三楼" /></div></div>
        <div class="field-group"><label for="description">详细描述 <span class="required" aria-label="必填">*</span></label><textarea class="text-field" id="description" name="description" required maxlength="300" placeholder="写下颜色、外观、明显特征及补充线索"></textarea><p class="field-hint">描述越具体，失主和拾获者越容易确认。</p></div>
        <div class="field-group"><label for="contact">联系方式 <span class="required" aria-label="必填">*</span></label><input class="text-field" id="contact" name="contact" required maxlength="80" placeholder="例如：微信号、服务台位置" /><p class="field-hint">详情页会展示此内容；请勿填写敏感隐私。</p></div>
        <div class="form-note">${icon("sparkle")}<span>联系方式会向本机使用者展示，请勿填写完整证件号。内容保存在当前设备，不跨设备同步。</span></div>
        <p class="form-error" id="form-error" role="alert" hidden></p><div class="form-actions"><button class="button full" type="submit">确认发布 ${icon("arrow-right")}</button></div>
      </form>`;
    return shell(topbar(), main, "publish");
  }

  function renderSuccess(id) {
    const item = findItem(id);
    const card = item ? `<div class="success-card"><small>${kindLabel(item.kind)}信息 · ${statusLabel(item)}</small><strong>${escapeHtml(item.title)}</strong></div>` : "";
    const main = `<div class="success-wrap"><span class="success-icon">${icon("check")}</span><h1 id="page-title">发布成功！</h1><p>这条${item ? kindLabel(item.kind) : ""}信息已保存到当前设备的列表。可以继续查看详情，或回首页浏览其他线索。</p>${card}
      <div class="success-actions">${item ? `<a class="button full" href="#/detail/${encodeURIComponent(item.id)}?from=success">查看发布详情 ${icon("arrow-right")}</a>` : ""}<a class="button secondary full" href="#/home">返回首页</a></div></div>`;
    return shell(subbar("发布完成", "#/home"), main, "publish");
  }

  function renderDetail(id, params) {
    const item = findItem(id);
    const from = ["home", "search", "mine", "success"].includes(params.get("from")) ? params.get("from") : "home";
    const back = from === "success" ? "#/mine" : `#/${from}`;
    if (!item) {
      return shell(subbar("信息详情", back), `<div class="empty-state"><span class="empty-icon">${icon("box")}</span><h1 id="page-title">这条信息未找到</h1><p>请返回列表确认。这条记录可能已经不存在。</p><a class="button secondary" href="#/home">返回首页</a></div>`, from);
    }
    const owned = item.ownerId === state.currentUser && state.currentUser !== "guest";
    const main = `${categoryArt(item, true)}<article class="detail-body">
      <div class="detail-head"><span class="item-type ${item.kind === "found" ? "found" : ""}">${kindLabel(item.kind)}</span><span class="resolved-stamp">${item.status === "resolved" ? icon("check") : icon("clock")}${statusLabel(item)}</span></div>
      <h1 id="page-title">${escapeHtml(item.title)}</h1>
      <div class="detail-meta"><span>${icon("pin")}${escapeHtml(item.place)}</span><span>${icon("clock")}发布于 ${escapeHtml(formatDate(item.postedAt))}</span></div>
      <section class="detail-section"><h2>物品描述</h2><p>${escapeHtml(item.description)}</p></section>
      <section class="detail-section"><h2>信息概况</h2><div class="detail-facts">
        <div class="detail-fact"><span>物品分类</span><span>${escapeHtml(item.category)}</span></div>
        <div class="detail-fact"><span>发生时间</span><span>${escapeHtml(formatDate(item.occurredAt))}</span></div>
        <div class="detail-fact"><span>发生地点</span><span>${escapeHtml(item.place)}</span></div>
        <div class="detail-fact"><span>当前状态</span><span>${statusLabel(item)}</span></div>
      </div></section>
      <div class="detail-contact">${icon("message")}<span>请先核对物品特征，通过发布者填写的联系方式联系。找回或归还后，由发布者更新状态。</span></div>
      <div class="detail-actions"><button type="button" class="button full" data-action="contact" data-id="${escapeHtml(item.id)}">联系发布者 ${icon("arrow-right")}</button>
      ${owned ? `<button type="button" class="button secondary full" data-action="toggle-status" data-id="${escapeHtml(item.id)}">${item.status === "resolved" ? "重新标记为未完成" : `标记为${item.kind === "found" ? "已归还" : "已找到"}`}</button>` : ""}</div>
    </article>`;
    return shell(subbar("信息详情", back), main, from);
  }

  function renderMine() {
    const userItems = myItems();
    const cards = userItems.length ? `<div class="item-list">${userItems.map(item => `<article class="mine-card"><a class="mine-card-head" href="#/detail/${encodeURIComponent(item.id)}?from=mine">${categoryArt(item)}<span><strong>${escapeHtml(item.title)}</strong><small>${kindLabel(item.kind)} · ${statusLabel(item)}</small></span></a><div class="mine-actions"><a class="button ghost" href="#/detail/${encodeURIComponent(item.id)}?from=mine">查看详情</a><button type="button" class="button secondary" data-action="toggle-status" data-id="${escapeHtml(item.id)}">${item.status === 'resolved' ? '恢复进行中' : `标记${item.kind === 'found' ? '已归还' : '已找到'}`}</button></div></article>`).join('')}</div>` : `<div class="empty-state mine-empty"><span class="empty-icon">${icon('box')}</span><h2>还没有发布记录</h2><p>发布的信息会保存在这里，由你更新处理状态。</p><a class="button secondary" href="#/publish">去发布信息</a></div>`;
    return shell(topbar(), `<div class="page-pad"><h1 class="screen-title" id="page-title">我的发布</h1><p class="screen-subtitle">找到物品后，及时告诉正在寻找的人。</p><div class="mine-banner"><span class="mine-avatar">${icon('user')}</span><strong>${D.USERS[state.currentUser]}，你好</strong><p>当前为设备内身份，用于区分发布者，无需注册。</p><label>切换使用者 <select class="text-field" id="user-select">${Object.entries(D.USERS).map(([id,label]) => `<option value="${id}" ${state.currentUser === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="section-heading"><h2>我发布的信息</h2><span>${userItems.length} 条</span></div>${cards}<div class="notice"><span>信息存于当前设备；卸载或清除应用数据会丢失记录。本版不跨设备同步，身份切换不是账号认证。</span></div></div>`, 'mine');
  }

  function safeDecode(value) { try { return decodeURIComponent(value); } catch { return ''; } }

  function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [rawPath, query = ""] = hash.split("?");
    const pieces = rawPath.split("/").filter(Boolean);
    return { page: pieces[0] || "home", id: safeDecode(pieces[1] || ""), params: new URLSearchParams(query) };
  }

  function render({ focus = false } = {}) {
    const route = parseRoute();
    let html;
    switch (route.page) {
      case "search": html = renderSearch(route.params); break;
      case "publish": html = renderPublish(); break;
      case "success": html = renderSuccess(route.id); break;
      case "detail": html = renderDetail(route.id, route.params); break;
      case "mine": html = renderMine(); break;
      default: html = renderHome(); break;
    }
    app.innerHTML = html;
    if (route.page === 'publish') restoreDraft();
    document.title = `${({ home: "首页", search: "搜索", publish: "发布信息", success: "发布成功", detail: "信息详情", mine: "我的发布" })[route.page] || "首页"} · 拾光校园失物招领`;
    const main = app.querySelector(".page-main");
    if (focus) main.focus({ preventScroll: true });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
  }

  function showContact(item, trigger) {
    activeDialogTrigger = trigger;
    const overlay = document.createElement("div");
    overlay.className = "dialog-backdrop";
    overlay.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-desc"><div class="dialog-top"><h2 id="dialog-title">联系发布者</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭弹窗">${icon("close")}</button></div><p id="dialog-desc">请先核对物品特征，再按发布者提供的方式联系。</p><div class="contact-value">${escapeHtml(item.contact)}</div><button type="button" class="button full" data-action="copy-contact" data-id="${escapeHtml(item.id)}">一键复制联系方式</button></section>`;
    app.append(overlay);
    overlay.querySelector(".icon-button").focus();
  }

  function closeContact() {
    app.querySelector(".dialog-backdrop")?.remove();
    activeDialogTrigger?.focus();
    activeDialogTrigger = null;
  }

  function searchRoute(kindOverride) {
    const params = new URLSearchParams();
    const fields = { q: '#search-input', category: '#filter-category', status: '#filter-status', place: '#filter-place' };
    for (const [key, selector] of Object.entries(fields)) {
      const value = app.querySelector(selector)?.value.trim() || '';
      if (value && value !== 'all') params.set(key, value);
    }
    const kind = kindOverride || parseRoute().params.get('kind') || 'all';
    if (kind !== 'all') params.set('kind', kind);
    const next = '#/search' + (params.size ? '?' + params : '');
    if (location.hash === next) render(); else location.hash = next;
  }
  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem('draft-' + state.currentUser) || '{}');
      const form = app.querySelector('#publish-form');
      if (!form) return;
      for (const [name, value] of Object.entries(draft)) {
        const field = form.elements.namedItem(name);
        if (field && typeof value === 'string') field.value = value;
      }
    } catch { /* 草稿可丢弃，不覆盖正式信息 */ }
  }
  app.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'search-form') { event.preventDefault(); searchRoute(); return; }
    if (form.id !== 'publish-form') return;
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form));
    const errors = D.validate(input);
    const errorBox = app.querySelector('#form-error');
    if (Object.keys(errors).length) {
      errorBox.hidden = false;
      errorBox.textContent = Object.values(errors)[0];
      const first = form.elements.namedItem(Object.keys(errors)[0]);
      if (first?.focus) { first.focus(); first.scrollIntoView({ block: 'center' }); }
      showToast(errorBox.textContent);
      return;
    }
    try {
      const id = 'post-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
      const next = D.publish(state, input, { id });
      if (!applyState(next)) return;
      try { localStorage.removeItem('draft-' + state.currentUser); } catch {}
      location.hash = '#/success/' + encodeURIComponent(id);
    } catch (error) { errorBox.hidden = false; errorBox.textContent = error.message; showToast(error.message); }
  });

  app.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
      event.target.setCustomValidity('');
      const form = event.target.closest('#publish-form');
      if (form) {
        try { localStorage.setItem('draft-' + state.currentUser, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {}
        app.querySelector('#form-error').hidden = true;
      }
    }
  });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      if (event.target.classList.contains("dialog-backdrop")) closeContact();
      return;
    }
    const action = target.dataset.action;
    if (action === 'filter' || action === 'apply-filter') {
      searchRoute(action === 'filter' ? target.dataset.kind : undefined);
    } else if (action === "contact") {
      const item = findItem(target.dataset.id);
      if (item) showContact(item, target);
    } else if (action === "close-dialog") {
      closeContact();
    } else if (action === 'copy-contact') {
      const item = findItem(target.dataset.id);
      if (!item) return;
      if (window.AndroidStore) {
        showToast(AndroidStore.copy(item.contact) ? '联系方式已复制' : '复制失败，可长按联系方式复制');
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(item.contact).then(() => showToast('联系方式已复制')).catch(() => showToast('复制失败，可选中文字复制'));
      } else showToast('请长按或选中上方联系方式复制');
    } else if (action === 'toggle-status') {
      const item = findItem(target.dataset.id);
      if (!item || item.ownerId !== state.currentUser || state.currentUser === 'guest') return;
      const nextStatus = item.status === 'resolved' ? 'open' : 'resolved';
      const label = statusLabel({ ...item, status: nextStatus });
      activeDialogTrigger = target;
      const overlay = document.createElement('div');
      overlay.className = 'dialog-backdrop';
      overlay.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-top"><h2 id="dialog-title">确认更新为“${label}”？</h2></div><p>“${escapeHtml(item.title)}”的列表和详情状态都会更新。</p><div class="confirm-buttons"><button class="button secondary" data-action="close-dialog">暂不更新</button><button class="button" data-action="confirm-status" data-id="${escapeHtml(item.id)}" data-status="${nextStatus}">确认更新</button></div></section>`;
      app.append(overlay); overlay.querySelector('button').focus();
    } else if (action === 'confirm-status') {
      try {
        const next = D.setStatus(state, target.dataset.id, target.dataset.status);
        if (!applyState(next)) return;
        const label = statusLabel(next.items.find(item => item.id === target.dataset.id));
        render(); showToast('状态已更新为“' + label + '”');
      } catch (error) { showToast(error.message); }
    }
  });
  app.addEventListener('change', event => {
    if (event.target.id === 'user-select') {
      if (applyState(D.switchUser(state, event.target.value))) { render(); showToast('已切换设备内身份'); }
    } else if (['filter-category','filter-status'].includes(event.target.id)) searchRoute();
  });
  window.appBack = function () {
    if (app.querySelector('.dialog-backdrop')) { closeContact(); return true; }
    if (parseRoute().page !== 'home') { location.hash = '#/home'; return true; }
    return false;
  };

  document.addEventListener("keydown", (event) => {
    const dialog = app.querySelector('[role="dialog"]');
    if (!dialog) return;
    if (event.key === "Escape") { closeContact(); return; }
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll("button")];
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
      event.preventDefault();
      controls[0]?.focus();
    }
  });

  window.addEventListener("hashchange", () => render({ focus: true }));
  if (!location.hash) location.hash = "#/home";
  render();
})();
