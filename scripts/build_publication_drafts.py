"""生成两份博客园发布稿；只使用真实源码、日志和已确认成员信息。"""
from pathlib import Path
import json, subprocess, re, sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(__file__).resolve().parents[1]
docs = root / 'docs'
team = json.loads((docs/'team.json').read_text(encoding='utf-8'))
blog_homepages = {member['name']: member['blogHomepage'] for member in team['members']}
partner_fork = team['collaboration']['partnerFork']
partner_pr = team['collaboration']['partnerPullRequest']
collaboration_record = (docs/'结对协作记录.md').read_text(encoding='utf-8').split('\n', 1)[1].strip()
division = (docs/'分工安排.md').read_text(encoding='utf-8').split('\n', 1)[1].strip()
time_record = (docs/'PSP耗时记录.md').read_text(encoding='utf-8').split('\n', 1)[1].strip()
unit = json.loads((root/'evidence/unit-tests.json').read_text(encoding='utf-8'))
browser = json.loads((root/'evidence/browser-network-ui.json').read_text(encoding='utf-8'))
android = json.loads((root/'evidence/android-network-ui.json').read_text(encoding='utf-8'))
if unit['failed'] or not browser['passed'] or not android['passed']:
    raise RuntimeError('现有测试记录未通过，不能写成通过结果')
server = (root/'server/server.cjs').read_text(encoding='utf-8')
domain = (root/'web/domain.js').read_text(encoding='utf-8')
def extract(text, start, end):
    return text[text.index(start):text.index(end)].strip()
auth = extract(server, '  function auth(', '  async function body(')
search = extract(domain, '  function search(', '  function setStatus(')
psp = (docs/'PSP.md').read_text(encoding='utf-8')
psp_table = psp[psp.index('| PSP2.1'):psp.index('\n\n建议分工')]
history = subprocess.check_output(['git', 'log', '-10', '--format=%h %s'], cwd=root, encoding='utf-8').strip()
repo = 'https://github.com/k0n0y/102401314-102401323'
# 固定到已经公开且含全部图片的提交，后续文档提交不改变图片来源。
image_commit = '70a9203136043737e1056a8509965bb13b9580a8'
image_base = f'https://raw.githubusercontent.com/k0n0y/102401314-102401323/{image_commit}/docs/'

shared = f'''
## 一、结对分工

{division}

## 二、PSP 记录

下面保留初始阶段编码前记录的 325 分钟规划，并列出审核确认的个人实际投入，单位为分钟。个人实际采用回顾估计，原预估是助手实施规划，统计口径不同，不直接计算个人超时比例。父级为小计，合计只累加明细。

{psp_table}

复审共享需求后，编码前另记录了补充阶段规划：需求复审 15 分钟，接口与身份设计 20 分钟，实现 80 分钟，服务与独立客户端验证 35 分钟，APK 构建和安装验证 20 分钟，材料修订 25 分钟，合计 195 分钟。这部分与初始规划分开记录，原始记录见仓库 `docs/PSP.md`。

曾炜毅实际投入合计 1010 分钟，陈勇昊合计 1050 分钟，采用审核确认的回顾估计。具体工作内容及时间分析如下。

{time_record}

## 三、解题思路与设计实现

### 3.1 从原型落实到完整流程

校园寻物和招领信息常散落在群聊中。使用者既需要找到相关物品，也需要知道旧信息是否仍然有效。因此，程序围绕“发布—浏览或搜索—查看详情—联系发布者—更新状态”设计，保留上次拾光原型的首页卡片、薄荷绿配色和底部导航。

本次选择 Android App 形式，交付可安装 APK。首页集中呈现线索，搜索页按关键词和条件筛选，详情展示物品特征与联系方式，发布页完成字段校验，“我的发布”提供原发布者的状态操作。寻物完成显示“已找到”，招领完成显示“已归还”。联系通过发布者填写的方式在应用外进行，没有加入实名认证、地图、即时聊天或复杂管理后台。

### 3.2 共享数据与发布者身份

只把列表保存在手机里，其他安装实例无法读取。共享版增加一个轻量 Node 服务，正式记录统一保存在 SQLite；不同客户端连接同一服务后读取相同的公开列表。手机内只保存自己的发布者凭证、最近缓存和草稿。

每个安装实例自动获取随机发布者编号和凭证。服务存储凭证的 SHA-256 摘要，用凭证识别发布者，再检查记录归属。隐藏他人记录的按钮只是交互提示，真正的修改权限由服务核验。即使使用者直接请求接口、提交别人的 ownerId，也不能获得对方的更新权限。

### 3.3 模块划分

| 模块 | 作用 |
| --- | --- |
| `web/app.js` | 页面、路由、表单、确认弹窗、同步与缓存 |
| `web/domain.js` | 输入校验、关键词和组合搜索、状态文案，兼容旧数据的函数 |
| `web/network.js` | 请求封装、服务地址校验、原生请求回调 |
| `MainActivity.java` | 内置 WebView、后台网络线程、私有存储、剪贴板和返回键 |
| `server/server.cjs` | 共享接口、身份核验、重复提交处理和 SQLite 持久化 |

页面和图标随 APK 打包，网络请求由 Java 后台线程执行，避免把等待服务的操作放在界面线程上。程序使用 Android 系统 WebView，采用自有页面嵌入方式，参考 [Android 官方说明](https://developer.android.com/develop/ui/views/layout/webapps)。

## 四、关键流程、数据流与代码

### 4.1 发布和状态更新流程

发布先在页面校验必填项、长度、分类、类型和时间，再把本地时间转为带时区的 ISO 时间，携带凭证提交。服务再次校验并写入数据库，返回记录后才进入成功页。填写错误或服务不可达时保留输入并提示原因。

联系后，原发布者在“我的发布”或本人详情中确认状态变更。取消确认不会发送更新请求；确认后服务核验归属并更新单条记录。其他客户端可手动刷新，前台约每 5 秒自动同步。

![图1：发布与状态更新流程](images/flowchart.png)

### 4.2 数据流

客户端的表单和条件进入共享服务，服务读取或修改 SQLite，返回公开信息或错误。凭证只保存在各自设备，公开列表不会带出凭证；断网时设备读取最近缓存，写入操作不会假报成功。

![图2：多客户端共享数据流](images/dataflow.png)

### 4.3 关键代码：服务端核验发布者

以下代码直接来自 `server/server.cjs`。没有合法凭证时返回 401；匹配后得到的发布者编号来自数据库，而不是客户端指定的身份。

```javascript
{auth}
```

状态更新还检查记录归属：

```javascript
if (auth(req) !== row.owner_id) fail(403, '只有发布者能更新状态');
```

### 4.4 重试与并发处理

发布请求带有 requestKey，数据库设置 `(owner_id, request_key)` 唯一约束。相同请求号和相同内容的重试返回原记录；同编号对应不同内容时返回冲突，避免覆盖。每条记录独立写入，两个客户端的并发发布不会用整份旧列表互相覆盖。

```javascript
const existing = db.prepare(
  'SELECT payload,input_hash FROM items WHERE owner_id=? AND request_key=?'
).get(ownerId, input.requestKey);
if (existing) {{
  if (existing.input_hash !== inputHash)
    fail(409, '该发布请求已保存其他内容，请重新填写');
  return json(200, {{item: JSON.parse(existing.payload), replayed: true}});
}}
```

## 五、附加特点及成果展示

### 5.1 组合筛选

只有物品名称，往往难以区分相似线索。程序支持关键词、类型、类别、地点和处理状态同时筛选。关键词经过 Unicode 和大小写归一化，多词需要全部命中；服务和页面复用同一个搜索函数。

```javascript
{search}
```

![图3：独立客户端乙组合搜索甲的发布](images/browser-network/05-other-search.png)

### 5.2 一键复制联系方式

详情里的联系弹窗展示发布者提供的字段。安卓版本调用系统剪贴板，减少在两个应用之间手工抄写联系方式的步骤；使用者仍需要核对物品特征后自行联系。

```java
ClipboardManager clipboard =
    (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
clipboard.setPrimaryClip(ClipData.newPlainText("拾光联系方式", value));
```

![图4：独立客户端乙的联系弹窗](images/browser-network/06-other-contact.png)

### 5.3 草稿恢复、断网缓存与错误提示

发布页保存草稿，切换页面后能继续填写。服务不可达时仍可查看缓存，但发布失败会留在表单，状态更新失败保持原状态。网络恢复后可重试提交。

![图5：安装版断网发布错误及保留的表单](images/android-network/13-offline-publish.png)

### 5.4 确认更新与恢复进行中

更新前用弹窗确认，防止误触；原发布者可以把已完成记录恢复为进行中。最新状态会出现在其他客户端，减少已经找到或归还之后的重复询问。

![图6：安装版更新确认](images/android-network/08-confirm.png)

![图7：安装版标记已归还](images/android-network/09-resolved.png)

![图8：乙客户端自动同步已归还状态](images/browser-network/10-other-resolved.png)

### 5.5 实际 APK 发布界面

![图9：安装版发布界面](images/android-network/03-publish.png)

![图10：共享服务保存后显示发布成功](images/android-network/04-success.png)

以上安装版图片来自 Android 12 模拟器的实际 APK。标注“独立客户端乙”的图片来自另一套浏览器配置，不将它们描述成第二台实体手机。

## 六、目录组织和使用说明

### 6.1 目录结构

```text
102401314-102401323/
├─ apk/shiguang-1.1.0.apk       可安装的签名 App
├─ 启动共享服务.cmd              Windows 服务入口
├─ server/server.cjs           HTTP 接口与 SQLite
├─ android/app/src/main/       Activity、网络线程、存储、图标
├─ web/                       内置页面、样式、业务和网络模块
├─ tests/                     业务与服务测试
├─ scripts/                   构建、验证、图示及材料生成
├─ docs/                      博客、PSP、说明和图片
├─ evidence/                  实际日志和验证结果
└─ data/                      运行时数据库，不上传仓库
```

页面、共享业务、原生入口和服务分开组织。测试直接引用实际业务和服务，证据单独保留，便于复现。完整说明见 [README]({repo}/blob/main/README.md)。

### 6.2 运行服务和 APK

1. 电脑安装 Node.js 24，本项目实测 24.18.0。下载整个仓库，双击“启动共享服务.cmd”，或在项目目录运行 `npm start`。没有第三方 npm 依赖，无需 `npm install`。
2. 保持服务窗口运行。普通手机与服务电脑连接互通的局域网，在 App 连接设置填写窗口显示的电脑地址，例如 `http://192.168.1.5:8787`。例子中的 IP 需要替换，手机不能直接填 localhost。
3. 把 `apk/shiguang-1.1.0.apk` 传到 Android 8.0 以上设备或模拟器，按系统提示允许安装。最低版本来自 manifest 声明，实际安装验证环境是 Android 12 模拟器。
4. 本机 MuMu 模拟器可使用下面的 ADB 转发，再在 App 填写 `http://127.0.0.1:8787`：

```powershell
adb -s 127.0.0.1:16384 reverse tcp:8787 tcp:8787
```

其中 16384 是本机 MuMu 的 ADB 端口；其他模拟器应使用自己的设备序列号。ADB 端口转发使模拟器访问电脑服务，不依赖校园 Wi-Fi 能否直接访问电脑。

5. 用一个安卓模拟器和独立浏览器配置，或两个独立模拟器，验证“甲发布—乙搜索与详情—甲更新—乙同步”。浏览器可打开 `http://localhost:8787`，但正式交付形式仍是 APK。

### 6.3 数据和使用范围

共享服务默认保存到 `data/shiguang.sqlite`，停止服务后再备份整个 data 目录。清除 App 数据会失去该设备的修改凭证，公共记录仍保留在服务中；当前没有账号跨设备登录和凭证恢复。同服务用稳定 serverId 识别，地址变化后重新连接可以保留身份。

当前交付支持局域网或本机模拟器转发。代码可以部署到有持久磁盘的服务器并配置 HTTPS，但本次没有公网上线地址，也没有把云端部署写成已验证结果。App 只接受局域网 HTTP 地址，公网服务地址需要 HTTPS。

## 七、单元测试学习、白盒案例与结果

### 7.1 工具和简易教程

选用 [Node 内置 node:test](https://nodejs.org/api/test.html) 和 `node:assert/strict`。纯业务模块不依赖页面，服务模块能启动真实 HTTP 和临时 SQLite，因此测试不需要另做一套模拟业务实现。

学习顺序是：先确定输入和预期结果，再写断言，随后根据源代码条件补充反例，最后用覆盖率检查遗漏。在项目目录运行：

```powershell
npm test
npm run test:coverage
```

正常结束会显示 tests、pass 和 fail；失败时进程返回非零退出码。修改测试后可以直接重跑。覆盖率反映被执行的代码范围，不能代替对所有设备和场景的验证。

### 7.2 部分测试代码及被测行为

下面的代码来自服务测试。session、publish、call 是 `tests/server.test.cjs` 中的工厂，实际调用当前服务。它既检查他人不能修改，也检查拒绝后原状态没有变化。

```javascript
test('乙即使知道甲的信息编号也不能更新状态', async () => {{
  const a = await session(), b = await session();
  const {{body}} = await publish(a);
  const result = await call('/api/items/' + body.item.id + '/status',
    'PATCH', {{status: 'resolved', ownerId: a.ownerId}}, b.token);
  assert.equal(result.status, 403);
  assert.equal((await call('/api/items/' + body.item.id)).body.item.status, 'open');
}});
```

这覆盖了服务的 `auth(req) !== row.owner_id` 分支。直接调用接口可以检验真正的授权边界，避免只测试“页面有没有按钮”。

### 7.3 白盒与边界设计

| 典型情况 | 设计依据 | 预期 |
| --- | --- | --- |
| 完整寻物与招领 | 类型分支 | 初始 open，对应寻找中/待认领 |
| 空文本和纯空格 | 必填与 trim 分支 | 拒绝发布并指出字段 |
| 文本 max 与 max+1 | 长度边界 | 上限允许，超限拒绝 |
| 非法/未来/当前时间 | 时间比较 | 非法和未来拒绝，业务边界可验证 |
| 分类和类型不在枚举内 | 合法值分支 | 拒绝无效枚举 |
| 多词、全角、大小写、无结果 | 归一化及筛选条件 | 多词同时命中，无结果返回空列表 |
| 多个筛选条件冲突 | 条件组合 | 所有条件同时满足才匹配 |
| 无凭证/伪造凭证/本人凭证 | 授权分支 | 401或本人成功 |
| 他人凭证且伪造 ownerId | 记录归属分支 | 403，原状态不变 |
| 重复请求和内容冲突 | 唯一约束及摘要 | 返回原记录或409，不覆盖 |
| 并发发布、重启服务 | 独立写入与持久化 | 两条保留，重启仍能读取和授权 |
| 时区不同、UTF-8 分段 | 实际网络输入边界 | 同一时刻正确校验，中文不乱码 |

普通服务用例使用独立内存数据库；重启用例使用专门临时文件，避免污染正式记录。设计同时考虑使用者常见习惯，例如多词搜索、误触取消、反复提交及填写后切换页面。

### 7.4 实测结果与范围

| 验证内容 | 结果 |
| --- | --- |
| 业务、兼容与服务测试 | {unit['passed']}/{unit['tests']} 通过 |
| 两套独立浏览器配置的界面检查 | {len(browser['checks'])} 项通过 |
| 安装 APK 与独立客户端检查 | {len(android['checks'])} 项通过 |
| domain.js 行覆盖 | {unit['domainCoverage']['lines']}% |
| domain.js 分支覆盖 | {unit['domainCoverage']['branches']}% |
| domain.js 函数覆盖 | {unit['domainCoverage']['functions']}% |

55 个测试中，31 个是原业务与旧数据兼容回归，24 个针对共享接口及集成行为。旧版身份切换的兼容测试不作为联网授权证据；当前服务的权限由上述实际 HTTP 测试覆盖。domain.js 的覆盖率也不代表 Java 网络桥或整个 App 的覆盖率。

界面检查包括发布、搜索、详情和联系、越权拒绝、自动同步、取消更新、断网缓存、发布及更新失败、恢复重试、服务重启和 App 强停重开。APK 检查还验证了原生剪贴板及返回键。

日志在 `evidence/unit-tests.txt`、`browser-network-ui.json` 和 `android-network-ui.json`。本次使用 Android 12 模拟器与独立浏览器配置；没有两位成员实体手机试玩的确认，模拟器验收应如实标注。作业截图没有强制实体手机，这些本地结果也不等同于助教官方评分。

## 八、GitHub 签入记录

仓库按两人的学号命名，保留需求和预估、功能、修复、测试、材料等真实提交。最近记录如下，完整记录见 [GitHub commits]({repo}/commits/main/)。

```text
{history}
```

![图11：实际 GitHub 提交记录页](images/github-commits.png)

截图反映采集时的真实页面，后续提交以仓库记录为准。

| 结对协作记录 | 链接 |
| --- | --- |
| 主仓库 | [102401314-102401323]({repo}) |
| 另一成员真实 fork | [Cgg0024/102401314-102401323]({partner_fork}) |
| 有实际贡献的 Pull Request | [PR #1：补充运行结果]({partner_pr}) |

{collaboration_record}

## 九、遇到的问题、尝试与解决

### 9.1 共享范围不足

初始离线数据只能在一个安装实例中浏览，不能满足不同客户端集中查看线索的使用流程。复审后增加共享服务、SQLite 和设备凭证，保留缓存与草稿。APK与独立浏览器验证了甲发布乙读取、甲更新乙同步及他人修改被拒绝。这里的收获是先确认数据的共享范围，再判断页面上的“公共列表”是否真正实现了需求。

### 9.2 手机时间被服务误判为未来

首次 APK 联网验证时，模拟器与电脑时区不同，表单里的本地日期时间被服务按自己的时区解析，导致发布失败。客户端改为提交带时区 ISO 时间，服务拒绝没有时区的 API 输入；新增回归测试后安装检查通过。跨端传输时间不能只传看起来完整的日期字符串，还要明确同一时刻。

### 9.3 实体手机无法访问当前电脑服务

联调时，电脑服务已启动，用户反馈手机无法打开健康接口。检查确认电脑使用有线网卡，其他列出的地址属于虚拟网络。此次没有确认网络不可达的具体根因，也未把实体手机写成验收通过。随后使用 MuMu 与 ADB reverse 连接电脑 8787 服务，已确认模拟器健康接口返回 ok:true。共享功能的自动验证仍依据安装版与独立浏览器的实际记录。

### 9.4 Windows 中文目录与网络中文数据

Android 工具曾无法识别中文绝对资源路径，构建脚本改为相对参数后正常打包，并通过签名和安装检查。网络读取则把分段字节汇总后统一按 UTF-8 解码，新增中文跨段测试。问题已经修复；也说明文件编码、路径和传输边界要分别检验。

### 9.5 协作仓库与运行记录复审

协作材料整理时，先收到的 fork 链接指向个人主页仓库，不是本次按学号命名的作业仓库。随后改为核对 Cgg0024/102401314-102401323 的来源，再使用实际 PR 和提交记录确认协作，避免把无关仓库写成作业贡献。正确 fork 与 PR #1 已核验，链接见第八节。

队友通过 fork 提交 README 运行结果后，复审发现系统名称和构建号不一致。维护者在同一个 PR 中提交一行修正，再合并到主仓库，保留队友原来的提交与运行输出。问题已经解决；具体分工和尝试可由 e2f0ac2、b667b8d、3f85f54 三条记录追踪。

这项协作的改进经验是：先确认仓库和分支，再核对运行环境、命令与结果，最后合并。文档也需要复审；某项检查通过应对应它实际验证的范围。上述说明依据收到的链接和真实提交，未补写没有记录的口头讨论或成员亲自操作经历。
'''

for name, number, teammate in [('曾炜毅', '102401314', '陈勇昊'), ('陈勇昊', '102401323', '曾炜毅')]:
    intro = f'''# 2026秋软件工程第二次结对作业：拾光校园失物招领 App 的实现与测试

| 项目 | 内容 |
| --- | --- |
| 所属课程 | [软件工程与软件工程实践](https://edu.cnblogs.com/campus/fzu/2026-01SoftwareEngineeringandSoftwareEngineeringPractice/) |
| 作业要求 | [第二次结对作业之程序实现](https://edu.cnblogs.com/campus/fzu/2026-01SoftwareEngineeringandSoftwareEngineeringPractice/homework/16745) |
| 本文作者 | {name}（{number}） |
| 结对成员 | 曾炜毅（102401314）、陈勇昊（102401323） |
| 本人博客主页 | [{name}]({blog_homepages[name]}) |
| 队友博客主页 | [{teammate}]({blog_homepages[teammate]}) |
| 本次作业博客 | 本人及队友本次文章地址在各自发表后补充，当前未取得发表链接。 |
| 项目仓库 | [102401314-102401323]({repo}) |
| APK 下载 | [拾光共享版 1.1.0]({repo}/raw/refs/heads/main/apk/shiguang-1.1.0.apk) |
| 上次原型 | [拾光原型](https://k0n0y.github.io/campus-lost-found-prototype/) |

本次把上一份拾光原型实现为可安装的 Android App，并增加共享服务，让不同客户端集中查看寻物和招领信息。代码和测试采用 Codex 辅助实施，本文的程序结果依据真实源码、日志和模拟器截图。分工、个人总结和队友评价已审核确认，个人实际耗时采用回顾估计。
'''
    personal = '\n' + (docs/f'个人总结与队友评价_{name}.md').read_text(encoding='utf-8')
    text = intro + shared + personal
    target = docs/f'博客园发布稿_{name}.md'
    target.write_text(text, encoding='utf-8')
    if text.count('\n## ') != 10 or text.count('```') % 2:
        raise RuntimeError('章节或代码块校验失败：'+target.name)
    for value in re.findall(r'!\[[^\]]*\]\(([^)]+)\)', text):
        if not (docs/value).is_file(): raise RuntimeError('图片不存在：'+value)
    print(f'{target.name}: {len(text)} characters, 10 sections, 11 images')

    # 本地版本保留相对路径；复制版直接使用已公开的固定提交图片链接。
    copy_text = re.sub(r'(!\[[^\]]*\]\()([^)]*)(\))',
                       lambda m: m[1] + image_base + m[2] + m[3], text)
    (docs/f'博客园直接粘贴版_{name}.md').write_text(copy_text, encoding='utf-8')
    if len(re.findall(r'!\[[^\]]*\]\(https://', copy_text)) != 11:
        raise RuntimeError('复制版公开图片数量错误')
    if '【待填写' in copy_text or '【待核实' in copy_text:
        raise RuntimeError('复制版仍含正文占位标记')

guide = '''# 两份博客发布前补充与图片对照

直接复制正文文件：博客园直接粘贴版_曾炜毅.md、博客园直接粘贴版_陈勇昊.md。每份都有完整的十节正文，个人总结与队友评价已审核确认。博客园发布稿_*.md 是本地预览版本，使用相对图片路径。

## 已完成的正文内容

1. 两人的博客主页已填入；发表后补充本人和队友本次文章链接。
2. 两份正文已写出完整分工，并增加“已有证据对应的实际协作”表，不把任务安排全部写成实际完成。
3. 两人的实际投入已填入 PSP 表并同步正文：曾炜毅 1010 分钟、陈勇昊 1050 分钟，采用审核确认的回顾估计，明细见 PSP耗时记录.md；编码前原始实施规划分别保留。
4. 队友的 fork、README 贡献和 PR #1 已核对并填入稿件；维护者修正环境名称后已将 PR 合并到主仓库 main，合并记录见结对协作记录.md。
5. 实际协作问题、解决步骤和收获已补齐；两份队友评价、具体事例、建议和个人总结已经审核确认。

直接粘贴版已是完整正文。技术验证保持实际来源：Android 12 模拟器与独立浏览器，当前没有公网部署记录。本次文章地址在发表后取得，课程提交按成功页面确认。

## 图片链接与备用上传顺序

两份直接粘贴版已把下面 11 张图片替换为 GitHub 公开 raw 链接，固定到含全部图片的 70a9203 提交。无需逐张修改正文路径。自动链接核验记录见 evidence/publication-materials-check.json；博客园实际显示仍需要在预览页面确认。如果校园网打不开 GitHub 图片，按此顺序上传到博客园并替换地址。两份稿使用同一组技术截图。

| 顺序 | 文件（相对 docs） | 正文位置 | 来源 |
| --- | --- | --- | --- |
| 1 | images/flowchart.png | 4.1 图1：关键流程 | 基于实际代码绘制 |
| 2 | images/dataflow.png | 4.2 图2：数据流 | 基于实际代码绘制 |
| 3 | images/browser-network/05-other-search.png | 5.1 图3：组合搜索 | 独立浏览器乙 |
| 4 | images/browser-network/06-other-contact.png | 5.2 图4：联系弹窗 | 独立浏览器乙 |
| 5 | images/android-network/13-offline-publish.png | 5.3 图5：断网发布错误 | Android12安装版 |
| 6 | images/android-network/08-confirm.png | 5.4 图6：更新确认 | Android12安装版 |
| 7 | images/android-network/09-resolved.png | 5.4 图7：已归还 | Android12安装版 |
| 8 | images/browser-network/10-other-resolved.png | 5.4 图8：跨客户端同步 | 独立浏览器乙 |
| 9 | images/android-network/03-publish.png | 5.5 图9：发布界面 | Android12安装版 |
| 10 | images/android-network/04-success.png | 5.5 图10：发布成功 | Android12安装版 |
| 11 | images/github-commits.png | 第八节 图11：签入记录 | 真实GitHub页面采集 |

## 发布与班级提交

各自打开博客园 Markdown 编辑器，粘贴“直接粘贴版”的全部内容，预览核对 11 张图片、代码块、表格和 APK 下载。保存并发表后，取得两人的文章地址；分别编辑开头的“本次作业博客”一行，补入本人和队友文章链接，再按课程页面要求分别提交。

结对表应填写：曾炜毅 102401314、陈勇昊 102401323；主仓库 https://github.com/k0n0y/102401314-102401323；队友 fork https://github.com/Cgg0024/102401314-102401323；PR https://github.com/k0n0y/102401314-102401323/pull/1。其他字段按班级表格填写，不编造未取得的链接。

正文已审核完成；博客发表和课程提交仍需实际操作。正常截止按作业截图为 2026-10-10 23:59:59，具体时区与额外要求以课程平台和班级通知为准。
'''
(docs/'博客园发布前补充与图片对照.md').write_text(guide, encoding='utf-8')
