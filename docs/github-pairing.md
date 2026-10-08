# 两人真实 GitHub 协作操作

作业要求的主仓库名：`102401314-102401323`。主仓库由一名同学创建，另一名同学在自己账号 fork；本说明不会代替实际 fork 与 Pull Request。

陈勇昊可以在主仓库页面点击 Fork，进入自己的副本后建立分支，例如 `test-phone-playthrough`。先在手机安装 APK，再把机型、系统版本、复现步骤、发现的问题和截图记录到 `docs/phone-playtest.md`；如果发现代码问题则先修复，再运行单元测试。

```powershell
git clone https://github.com/你的账号/102401314-102401323.git
cd 102401314-102401323
git switch -c test-phone-playthrough
# 完成真实试玩记录或功能修复；不要只创建空文件冒充工作。
npm test
git add docs/phone-playtest.md
git commit -m "test: record Android phone installation and complete playthrough"
git push -u origin test-phone-playthrough
```

再在 GitHub 点击 Contribute → Open pull request，将该分支提交到主仓库 main。PR 正文填写真实改进、为什么需要、如何测试；主仓库成员审阅后合并。记录对方账号、fork 地址、PR 地址和提交 SHA，并在两人的博客中说明各自贡献。

如修改源码，还应在测试通过后重新构建 APK，再核对 README、博客、APK 版本和截图一致性。不要把未运行的测试写成通过。

本次本地提交记录是助手辅助实施的真实进展，不是两人分别签入的证明。个人参与、协作评论、代码复审和时间需据实记录。
