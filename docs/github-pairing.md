# 两人真实 GitHub 协作操作

作业要求的主仓库名：`102401314-102401323`。主仓库由一名同学创建，另一名同学在自己账号 fork；本说明不会代替实际 fork 与 Pull Request。

## 当前已完成的记录

队友 Cgg0024 的 [fork](https://github.com/Cgg0024/102401314-102401323) 已核对，提交 README 运行记录的 [PR #1](https://github.com/k0n0y/102401314-102401323/pull/1) 已合并到主仓库 main。原提交 e2f0ac2、维护者环境名称修正 b667b8d 和合并提交 3f85f54 均保留；详见结对协作记录.md。以下步骤作为后续改进参考，不是尚未完成的首次 fork/PR 待办。

## 后续改进与本人操作验收

在已有 fork 同步主仓库后建立分支，例如 `test-app-playthrough`。可以在安卓模拟器或实体手机安装 APK，把设备或模拟器名称、安卓版本、复现步骤、发现的问题和截图记录到 `docs/app-playtest.md`；如果发现代码问题则先修复，再运行单元测试。作业截图没有强制实体手机，使用模拟器时如实注明环境。

```powershell
git clone https://github.com/你的账号/102401314-102401323.git
cd 102401314-102401323
git switch -c test-app-playthrough
# 完成真实试玩记录或功能修复；不要只创建空文件冒充工作。
npm test
git add docs/app-playtest.md
git commit -m "test: record Android app installation and complete playthrough"
git push -u origin test-app-playthrough
```

再在 GitHub 点击 Contribute → Open pull request，将该分支提交到主仓库 main。PR 正文填写真实改进、为什么需要、如何测试；主仓库成员审阅后合并。记录对方账号、fork 地址、PR 地址和提交 SHA，并在两人的博客中说明各自贡献。

如修改源码，还应在测试通过后重新构建 APK，再核对 README、博客、APK 版本和截图一致性。不要把未运行的测试写成通过。

本次本地提交记录是助手辅助实施的真实进展，不是两人分别签入的证明。个人参与、协作评论、代码复审和时间需据实记录。
