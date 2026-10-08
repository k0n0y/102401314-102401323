# 拾光 · 校园失物招领 Android App

基于上一份“拾光”交互原型完成的 Android 应用，成员：曾炜毅（102401314）、陈勇昊（102401323）。

## 安装与运行（助教无需编译）

1. 下载本仓库或交付压缩包，找到 **apk/shiguang-1.0.0.apk**。
2. 传到 Android 8.0 或以上设备，点击 APK，按系统提示允许该来源安装，完成后打开“拾光·校园失物招领”。也可在安卓模拟器拖入 APK 安装。
3. 初次使用无需登录，不需要服务器、网络、定位或存储权限。系统 Android WebView 建议更新到最新版本。
4. 首次显示带“示例”标识的虚构样例。点击底部“发布”填写寻物/招领；使用“搜索”按关键词、类型、类别、地点和处理状态筛选。
5. 点击卡片进入详情，点击“联系发布者”查看或复制联系方式，再在应用外联系。找回或归还后进入“我的”，确认更新状态。

**这是本设备离线版，不同设备不共享数据。** 在“我的”可以切换甲同学、乙同学、访客，演示同一设备内公共浏览与发布者权限。该切换不构成账号认证。发布者可更新自己的记录，其他身份只读；固定样例不能修改。

卸载或清除应用数据会丢失正式记录。APK 为作业测试签名包，启用 WebView 调试以复现自动检查，没有发布到应用商店。其他人在自己的电脑重新构建会使用新的本地签名；安装到已有相同包名的设备时，签名不同会导致不能覆盖安装。不要为解决覆盖问题直接卸载有重要数据的 App。

## 五分钟验收路径

1. 首页点击任意样例，检查名称、类型、地点、发生时间、描述、状态和联系方式。
2. 以默认甲同学身份发布一条招领信息（例：校园卡 / 图书馆一楼 / 过去时间 / 特征描述 / 图书馆服务台）。保存后显示发布成功，并可从搜索进入详情。
3. 搜索“校园卡”，选择招领、校园卡、图书馆、进行中，检查组合筛选；输入不存在的词检查空结果。
4. 在“我的发布”把该条信息更新为“已归还”，先取消一次，再确认一次。返回详情核对状态。
5. 在“我的”切换乙同学：搜索仍能看到甲的已归还信息，详情没有状态按钮，乙的“我的发布”不含甲的记录。
6. 切回甲同学，发布寻物并更新为“已找到”；完全关闭 App 后重开，检查记录与状态保留。
7. 用空表单、空格标题、未来时间检查拒绝发布；填写草稿后返回首页，再进发布页检查恢复。

## 目录说明

```text
apk/                         已签名 APK，助教直接安装
android/app/src/main/
  AndroidManifest.xml        App 入口、版本、兼容范围
  java/edu/fzu/shiguang/      WebView、持久存储、复制、返回键
  res/drawable/              原生矢量启动图标
web/
  index.html                 页面外壳及 SVG 图标
  styles.css                 原型延续的移动界面和响应式样式
  domain.js                  校验、发布、筛选、权限、持久化业务逻辑
  app.js                     页面渲染、路由、表单、确认、草稿
tests/domain.test.cjs        31 个 Node 单元测试
scripts/build_apk.py         官方 SDK 编译与 APK 签名验证
scripts/verify_ui.mjs        浏览器及安卓 WebView 交互验证
docs/                       需求、博客、PSP、图示、截图、提交清单
evidence/                   实测构建、单元测试、交互和 APK 哈希记录
package.json                测试命令，无 npm 运行依赖
```

正式信息使用 Android 应用私有 SharedPreferences 保存 JSON；所有状态写入先同步 commit 到磁盘，成功才刷新界面。草稿用 WebView 的本地存储，正式信息损坏时会报错而不是静默重置。

## 运行单元测试

安装 Node.js 22 或以上，在仓库目录运行以下命令，不需要 npm install：

```powershell
npm test
npm run test:coverage
```

初学者说明、白盒分支与边界设计见 [单元测试说明](docs/testing.md)。桌面检查共享页面可运行 `npm run test:ui`，需要 Chrome/Edge；这些检查不代替 APK 安装测试。

## 从源代码构建 APK

需要 Python 3.10+、JDK 17 和官方 Android SDK 平台 35 / Build Tools 35.0.0。构建不依赖第三方 Android 库或 Gradle。SDK 路径内部需能找到 android.jar、aapt2.exe、d8.bat、zipalign.exe、apksigner.bat。

```powershell
python scripts/build_apk.py --sdk C:\Android\Sdk --jdk C:\Java\jdk-17
```

或配置 ANDROID_HOME、JAVA_HOME 后运行 `npm run build:apk`。本机默认工具放在同级 tools/android-build 内，该工具目录不在交付包中；重新构建者需自行安装上述开发工具。编译会自动打包 web 目录，使用本地测试签名，产出同名 APK 并验证 v2/v3 签名。Android 源码使用系统 SDK，未附加未验证的 Android Studio/Gradle 工程。

如需核对校验值，查看 [APK 验证](evidence/apk-verification.json)。验证范围与当前测试结果见 [测试说明](docs/testing.md)，交付完成度和仍需本人完成的事项见 [提交清单](docs/submission-checklist.md)。

## 技术参考

采用 [Android 官方 WebView 文档](https://developer.android.com/develop/ui/views/layout/webapps) 中的嵌入自有页面方式，UI 与业务逻辑能复用上一份原型。Node 原生单元测试使用 [node:test](https://nodejs.org/api/test.html)。未调用 AIGC 图片服务，界面图标由内置 SVG 和 Android vector drawable 绘制。
