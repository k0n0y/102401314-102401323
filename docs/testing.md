# 共享版测试说明

采用[Node官方node:test](https://nodejs.org/api/test.html)、node:assert/strict和[node:sqlite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)，实测Node24.18.0，无第三方npm依赖。

## 初学者教程

1. 安装Node24，在项目目录运行npm test。
2. 先确定输入和输出，对实际函数/API写assert断言；再观察if条件补充失败路径。
3. 按白盒分支和边界值设计：空文本/空格、长度max和max+1、时间非法/未来、本人/别人/无凭证。
4. npm run test:coverage检查执行范围；覆盖率不能证明所有情形，也不衡量Java桥或视觉布局。

| 分支 | 用例 |
| --- | --- |
| 输入、文本、枚举、时间和搜索 | 原业务测试，服务再次校验，绕过表单也失败 |
| 凭证缺失/伪造、本人/其他人 | 401或403，知道信息编号及伪造ownerId仍无法越权 |
| 新请求/相同重试/同号内容变化 | 201、200返回原记录、409拒绝覆盖 |
| 不同发布者/并发发布 | 相同请求号也独立保存，并发两条都存在 |
| 状态/记录非法 | 合法open/resolved成功，非法400，不存在404 |
| 重启、跨时区、中文网络分段 | SQLite持久，ISO含时区，UTF8分段后内容保持 |
| 服务中断及恢复 | 缓存可读、发布/更新不假成功、保留草稿后重试 |

共55个测试：domain.test.cjs的31个包含旧数据兼容测试，其中旧身份切换只用于1.0回归，不作为联网权限证据；server.test.cjs的24个直接启动HTTP服务和SQLite检查共享及授权。

以下代码来自接口测试，session/publish/call为该文件定义的测试工厂：

```javascript
const a = await session(), b = await session();
const {body} = await publish(a);
const result = await call('/api/items/' + body.item.id + '/status',
  'PATCH', {status: 'resolved', ownerId: a.ownerId}, b.token);
assert.equal(result.status, 403);
```

普通用例用独立内存数据库；重启测试用专门临时目录，不写正式data。测试断言本人的成功、别人的拒绝，以及失败后数据未变。

## 独立客户端和APK验证

npm run test:ui使用两套独立Chrome/Edge配置。甲发布，乙搜索详情和联系，API越权403；甲更新后乙自动同步。停止服务验证缓存及发布/更新失败，重启恢复，检查凭证保留和320px布局。

APK验证使用Android12模拟器+一套独立浏览器，通过ADB反向转发18787连接测试服务。验证真实后台网络线程、剪贴板、返回键和强停重开。此证据不是两台实体手机或校园Wi-Fi互通的人工验证。

```powershell
$env:ADB_PATH = 'C:\Android\Sdk\platform-tools\adb.exe'
node scripts/verify_network_ui.mjs --android
```

脚本模拟器地址127.0.0.1:16384对应本机MuMu；其他设备修改选择逻辑。使用专用测试设备，测试服务端口和数据库与正式8787隔离。

## 证据范围

- evidence/unit-tests.txt、unit-tests.json：实际55个测试及覆盖率。
- evidence/browser-network-ui.json：两套浏览器的交互检查。
- evidence/android-network-ui.json：APK和独立浏览器的共享检查。
- evidence/apk-verification.json：本次APK哈希及签名。
- docs/images/android-network：01–04、07–09、12–14为ADB原生截图，05/06/10/11为乙的独立浏览器截图，不能称为第二台手机。
- docs/images/browser-network：两套浏览器截图。

主动断网产生的错误单列expectedNetworkErrors，其他页面异常导致测试失败。旧android-ui/browser-ui报告属于历史1.0离线版。

尚待本人实测：两台实体手机、实际局域网、不同厂商/安卓版本；公网部署参考未上线验证。测试通过不等同于官方评分。
