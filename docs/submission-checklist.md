# 提交前最后核对

## 已在本地完成

- [x] 实际签名 Android APK，包名 edu.fzu.shiguang，版本 1.1.0。
- [x] 发布、浏览、搜索、详情、联系线索与复制、发布者状态更新闭环。
- [x] 55 个业务/API/集成测试，按附录采用白盒分支与边界设计。
- [x] 24 项独立浏览器检查、21 项 Android 12 APK与独立客户端检查，实际日志保留。
- [x] 共享服务、SQLite持久数据、独立发布者凭证、跨客户端同步、断网缓存和失败处理。
- [x] README写明电脑启动服务、手机同一局域网配置、双设备验收；公网配置只作为参考，未宣称已部署。
- [x] 按学号创建 GitHub 仓库并上传代码和 APK；真实 GitHub 提交页截图已保存。
- [x] 安装版截图、流程图、数据流图、README、目录说明、使用说明、测试教程。
- [x] 两人博客技术稿和 PSP 记录模板；未伪造个人实际时间。

## 必须由成员真实完成

- [ ] 成员实际操作1.1.0验收并记录环境、安卓版本、网络和问题。可以使用安卓模拟器；作业截图没有强制要求实体手机，模拟器记录应如实注明环境。
- [x] 根据现有模块拟定分工安排并填入两份博客，详见分工安排.md。
- [ ] 两人核实实际参与和对应记录，填写各自 PSP 实际耗时及偏差原因。
- [x] 两人的博客主页已按本人提供的链接填入两份稿件。
- [ ] 发表后补齐两人的本次博客文章链接。
- [ ] 另一名成员用自己的 GitHub 账号 fork 按学号命名的仓库，完成一项真实改进，并提交 Pull Request。不得用同一账号或虚假提交冒充结对。
- [x] 已截取真实公开 GitHub 提交记录页面，见 images/github-commits.png。另一成员 PR 证据仍需补齐。
- [ ] 本人确认个人总结、结对困难和队友评价，删除草稿内所有待确认标记。
- [ ] 每人分别发布并提交博客，确认班级作业页面显示提交成功。
- [ ] 2026-10-10 23:59:59 之前填写班级群结对表及项目 GitHub 地址，检查班级群额外通知。

## 截图上传顺序

博客稿内图示占位与文件对应如下。博客园 Markdown 编辑器上传后，替换为自动生成的图片地址；如果直接用 GitHub raw 图片，发布前检查手机和校园网能打开。

| 顺序 | 文件（相对 docs/） | 博客位置 |
| --- | --- | --- |
| 1 | images/flowchart.png | 第四节“关键流程图” |
| 2 | images/dataflow.png | 第四节“数据流图” |
| 3 | images/android-network/03-publish.png | 第五节APK发布界面 |
| 4 | images/android-network/04-success.png | 第五节共享服务保存成功 |
| 5 | images/android-network/08-confirm.png | 第五节状态确认 |
| 6 | images/android-network/09-resolved.png | 第五节APK已归还 |
| 7 | images/browser-network/05-other-search.png | 第五节独立客户端乙搜索（浏览器截图） |
| 8 | images/browser-network/10-other-resolved.png | 第五节乙自动同步状态（浏览器截图） |
| 9 | images/android-network/12-offline-cache.png | 第五节APK断网缓存 |
| 10 | images/android-network/13-offline-publish.png | 第五节APK断网发布失败 |
| 11 | images/github-commits.png | 第八节代码签入记录 |

其他安装版截图可用于连接设置、联系与强停重开。截图中127.0.0.1:18787是模拟器专用测试转发地址，手机实际使用应填写服务窗口显示的电脑局域网地址；不能将乙浏览器截图称为第二台实体手机。

这是待办清单，不是班级提交成功证据；README 或 ZIP 存在不代表已发博客或已完成 GitHub 结对。
