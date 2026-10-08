# 拾光 · 校园失物招领 Android App（共享版1.1.0）

曾炜毅（102401314）、陈勇昊（102401323）软件工程第二次结对作业。基于上次拾光原型，实现发布、公共浏览、搜索、详情、联系及“已找到/已归还”状态更新。

**不同设备连接同一个共享服务，就能共享信息和最新状态。** 正式记录保存在服务端 SQLite，设备仅保存发布者凭证、缓存和草稿。本项目提供可安装 APK 和轻量服务源码，尚未部署公网。

## 助教运行：启动服务、安装APK、连接同一地址

1. 在电脑安装 [Node.js24](https://nodejs.org/en/download)，实测版本24.18.0。下载并解压整个项目，双击根目录 **启动共享服务.cmd**，或在项目目录运行 `npm start`。没有第三方npm依赖，无需npm install。
2. 保持窗口运行，记下显示的局域网服务地址，例如 `http://192.168.1.5:8787`。电脑浏览器可打开 `http://localhost:8787` 检查页面。
3. 把 **apk/shiguang-1.1.0.apk** 传到 Android8.0以上手机，允许该来源安装；两台手机与服务电脑加入同一局域网。
4. 打开 App，在“连接设置”填写第2步地址，点击“连接并同步”。第二台手机填写同一地址。手机不要填写localhost或127.0.0.1，它们指向手机自身。
5. 初始公共列表为空。甲发布信息，乙搜索查看；甲标记“已找到/已归还”，乙点击刷新或等待约5秒自动同步。只有原发布设备能够更新状态。

若系统提示Node防火墙访问，允许在专用网络访问。连接失败时，先用手机浏览器打开 `服务地址/api/health`，正常返回ok:true；检查服务是否运行、电脑IP、同一局域网及防火墙。校园Wi-Fi若隔离设备，可让手机和电脑加入同一热点。无需关闭整个防火墙。

APK内置页面和图标，网络调用由原生后台线程执行。HTTP仅用于局域网，公网地址须HTTPS。无需定位、存储、相机或通讯录权限。课程测试签名包启用WebView调试；最低Android8为声明，实际安装检查为Android12模拟器。

## 五分钟验收

1. 甲发布校园卡招领，填写类别、过去时间、地点、描述、联系方式。服务保存后才显示发布成功。
2. 乙按关键词、类型、类别、地点、处理状态组合搜索，查看详情并复制联系方式。甲的信息不在乙的“我的发布”，乙没有状态按钮。
3. 甲先取消一次状态确认，再标记“已归还”；乙查看自动同步后的状态。
4. 甲发布寻物并标记“已找到”，完全关闭重开App检查身份与记录保留。
5. 关闭服务，缓存可读，发布/更新失败；重启服务可重试。检查空字段、空格、未来时间、无结果、草稿恢复。

## 身份、持久化与旧版升级

每台安装实例自动获取随机发布者编号和凭证，服务保存凭证SHA-256摘要，用Bearer凭证核验记录归属。已移除旧版甲/乙/访客切换，不允许靠选择身份修改他人数据。这里是简单设备身份，不是实名认证或完整账号体系。

清除手机应用数据会丢失本人的修改凭证，但公共记录仍在服务中；本版没有账号恢复，请保留原发布设备数据。服务有稳定serverId，同服务更换地址后可保留设备身份。备份前先Ctrl+C停止服务，再复制整个data目录；该目录和个人凭证不上传GitHub、不放入ZIP。

同签名1.1.0可以覆盖安装1.0.0。旧离线JSON保留在独立旧存储，不会自动把示例或旧信息上传；真实旧信息应核实后重新发布。旧APK不再是交付入口，历史版本仍在Git及原离线包中。其他电脑重构会生成自己的签名，不能直接覆盖不同签名的安装包。

相同发布请求号重试返回原记录，避免重复发布；并发发布使用独立数据库行，避免整份列表互相覆盖；手机发生时间提交带时区的ISO值。

## 目录

```text
apk/shiguang-1.1.0.apk          可直接安装的共享版APK
启动共享服务.cmd                Windows一键启动服务
server/server.cjs              HTTP接口、凭证、SQLite
web/domain.js                  校验、筛选、旧数据兼容函数
web/network.js                 请求、服务地址、原生回调
web/app.js                     页面、连接、同步、缓存、发布和状态
web/index.html / styles.css    内置移动界面与SVG图标
android/app/src/main/          原生网络线程、存储、返回键
tests/domain.test.cjs          31个业务与兼容测试
tests/server.test.cjs          24个API及集成测试
scripts/                      构建、测试、材料与交付核验
docs/                         博客稿、PSP、截图、说明
evidence/                     实测日志与APK校验
data/                         运行时数据库（不提交）
```

旧docs/images/android、browser及evidence/android-ui.json、browser-ui.json属于1.0历史记录。**本次共享验证以带network的目录和报告为准。**

## 测试和源码构建

安装Node24后，在项目目录运行：

```powershell
npm test
npm run test:coverage
npm run test:ui
```

UI验证需要Chrome/Edge，采用两套独立浏览器配置。白盒案例与证据见 [docs/testing.md](docs/testing.md)。

重新构建APK需要Python3.10+、JDK17、官方Android SDK平台35及Build Tools35.0.0，不依赖Gradle：

```powershell
python scripts/build_apk.py --sdk C:\Android\Sdk --jdk C:\Java\jdk-17
```

或设置ANDROID_HOME、JAVA_HOME运行npm run build:apk。编译打包web资源并验证v2/v3签名；直接安装现成APK无需这些开发工具。

## 公网与仍需本人完成的事项

作业未明确要求公网托管，局域网共享服务可复现要求的完整流程。若要不同网络长期访问，可在有持久磁盘的服务器运行相同服务，加域名和HTTPS反向代理，再在App填写HTTPS根地址。见 [docs/server-deployment.md](docs/server-deployment.md)。当前没有已上线的公网URL。

两人的博客链接、PSP实际耗时、真实分工、另一成员fork/PR、实体手机人工体验和班级提交仍需本人完成，详见 [docs/submission-checklist.md](docs/submission-checklist.md)。
