# 单元测试与实际 APK 验证

## 为什么使用 node:test

业务模块 `web/domain.js` 不引用 DOM、安卓控件或网络。同一文件既在 App 中执行，也可以由 Node 直接加载；因此无需重新实现一个专供测试的模型。采用 [Node 官方 node:test](https://nodejs.org/api/test.html) 和 `node:assert/strict`，避免安装测试框架，把测试失败作为进程非零退出码。

学习步骤：先辨认函数的输入、输出与可能抛出的错误；给正常输入写断言；再依据 if 分支、合法枚举、长度上限与权限条件添加反例；最后用覆盖率找到遗漏。覆盖率只说明代码被执行过，不代表所有输入组合已经验证。

## 初学者运行方法

1. 安装 Node 22 或以上，打开项目目录中的终端。
2. 运行 `npm test`。不需要 `npm install`。
3. 观察 tests、pass、fail；新增用例放入 `tests/domain.test.cjs`。
4. 运行 `npm run test:coverage` 查看业务模块覆盖率。这个命令只衡量 domain.js，不包括 Java 原生桥和视觉质量。

示例：

```javascript
test('其他使用者不能修改状态', () => {
  const s = { version: 1, currentUser: 'student-b', items: [甲的记录] };
  assert.throws(() => D.setStatus(s, 甲的记录.id, 'resolved'), /只有发布者/);
});
```

上面是教学缩写。实际可执行代码见 U19，不使用未定义的“甲的记录”变量。

## 白盒测试设计

以函数条件分支设计用例，同时使用等价类与边界值。长度分别测试 max 和 max+1；时间分别测试非法值、过去、等于当前、晚一秒；权限分别测试本人、其他身份、访客。固定 `now` 与编号，避免测试结果受时钟和随机数影响。发布和状态修改使用新对象，检查原数组未被意外改变。

| 用例 | 业务函数 | 测试内容 |
| --- | --- | --- |
| U01–U02 | createItem / statusLabel | 两种信息类型及默认状态 |
| U03–U05 | validate | 必填、空白、分类和类型枚举 |
| U06–U07 | validate | 时间非法、未来、等于当前 |
| U08–U10 | validate / createItem | 四项长度边界、去空白、身份限制 |
| U11–U16 | search | 字段命中、大小写全角、多词、空结果、组合条件、排序不可变 |
| U17–U20 | setStatus | 找到/归还/恢复、非本人拒绝、非法状态与不存在记录 |
| U21–U23 | mine / switchUser / publish | 我的记录隔离、切换、重复编号 |
| U24–U27 | decodeState | 保存恢复、种子隔离、损坏或未知版本、重复/非法记录 |
| U28–U29 | commit | 存储抛错、返回 false、正常写入；不把失败当成功 |
| U30–U31 | escapeHtml / createItem | HTML 作为文本、无效编号与业务入口校验 |

共 31 个顶层测试，部分用例循环覆盖多个边界。正文要求至少 5 个、附录要求至少 10 个，采用更严格的要求。

## 实测结果的读取位置

- `evidence/unit-tests.txt`：真实 Node 输出与覆盖率。
- `evidence/unit-tests.json`：测试数、通过数、Node 版本、domain.js 覆盖率。
- `evidence/browser-ui.json`：Chrome/Edge 的共享 UI 检查，仅是浏览器测试。
- `evidence/android-ui.json`：安装后的 Android 12 模拟器 WebView 检查；包括原生复制、关闭后重开保存。
- `evidence/apk-verification.json`：实际 APK 的哈希、大小与签名验证。
- `docs/images/android/`：`adb exec-out screencap -p` 获取的安装版截图，不是设计稿，也不是同学人工试玩记录。

当前结果由上述文件生成，博客中须以最终报告的 `passed` 和 `checks.length` 为准。测试用例产生的记录只在本次测试设备中；新安装 APK 不携带测试设备的私有数据。

## 交互检查复现

桌面运行 `npm run test:ui`，需要 Chrome 或 Edge，也可设置 BROWSER_PATH。脚本打开独立临时浏览器配置，只清理自己创建的 `.verify-profile-*` 目录。

安卓检查需安装本 APK、启用 USB 调试，并设置 `ADB_PATH`。启动 App 后，将 `/proc/net/unix` 中该进程的 `webview_devtools_remote_<pid>` 转发到本机 9299，运行：

```powershell
$env:ADB_PATH = 'C:\Android\Sdk\platform-tools\adb.exe'
adb forward tcp:9299 localabstract:webview_devtools_remote_应用进程编号
node scripts/verify_ui.mjs --android
```

脚本会发布虚构测试信息、切换本设备身份并更新测试记录，因此请使用专用测试设备或新安装实例。不要在存有重要真实信息的设备上运行全套交互测试。完整重跑前应使用一个干净的本 App 测试实例；不会要求清理设备中的其他 App。

## 尚未验证

尚无本人手机的安装与人工试玩确认；最低兼容 Android 8.0 为 manifest 声明，没有逐个 Android 版本和厂商机型实测。未验证跨设备联网共享，因为本版没有该功能。单元测试、模拟器通过均不等同于助教评分通过。
