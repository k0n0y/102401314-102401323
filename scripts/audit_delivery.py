from pathlib import Path
import zipfile, json, hashlib, re
from PIL import Image

root=Path(__file__).resolve().parents[1]
checks=[]
def check(ok,label):
    if not ok:raise RuntimeError('Delivery audit failed: '+label)
    checks.append(label)
reports={name:json.loads((root/'evidence'/name).read_text(encoding='utf-8')) for name in ['unit-tests.json','browser-network-ui.json','android-network-ui.json','apk-verification.json']}
check(reports['unit-tests.json']['tests']>=10 and reports['unit-tests.json']['failed']==0,'单元测试至少 10 个且全部通过')
check(reports['browser-network-ui.json']['passed'] and reports['android-network-ui.json']['passed'],'独立客户端与实际共享 APK 检查全部通过')
check(not reports['android-network-ui.json']['consoleErrors'],'安装版没有意外页面脚本与资源错误')
check(reports['android-network-ui.json']['clientA']!=reports['android-network-ui.json']['clientB'],'独立客户端身份不同')
apk=root/'apk/shiguang-1.1.0.apk'
check(hashlib.sha256(apk.read_bytes()).hexdigest()==reports['apk-verification.json']['sha256'],'APK 哈希与签名验证记录一致')
with zipfile.ZipFile(apk) as z:
    check('classes.dex' in z.namelist() and 'AndroidManifest.xml' in z.namelist(),'APK 包含原生代码与 Android manifest')
    for file in (root/'web').iterdir():
        check(z.read('assets/'+file.name)==file.read_bytes(),'APK 内置资源与提交源码一致：'+file.name)
for directory in ['docs/images/android-network','docs/images/browser-network']:
    for file in (root/directory).glob('*.png'):
        with Image.open(file) as im:
            width,height=im.size;im.verify()
        check(width>=320 and height>=600,'截图有效：'+file.name)
for file in (root/'docs').glob('*.md'):
    text=file.read_text(encoding='utf-8')
    check('\ufffd' not in text,'文档无替换字符：'+file.name)
    for image in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',text):
        if not image.startswith('http'):check((file.parent/image).is_file(),'博客图片可定位：'+image)
check((root/'docs/images/github-commits.png').exists(),'实际 GitHub 提交记录截图存在')
psp_text=(root/'docs/PSP.md').read_text(encoding='utf-8')
review=json.loads((root/'evidence/materials-review-confirmation.json').read_text(encoding='utf-8'))
check(review['personalPspConfirmedByUser'] and '回顾估计' in psp_text,'PSP 已获用户审核确认，并标明回顾估计的统计方式')
check((root/'server/server.cjs').exists() and (root/'启动共享服务.cmd').exists(),'共享服务及启动入口可交付')
check('1.1.0' in (root/'README.md').read_text(encoding='utf-8'),'README指向当前共享版')
report={'passed':True,'checks':checks,'unitTests':reports['unit-tests.json']['tests'],'browserChecks':len(reports['browser-network-ui.json']['checks']),'androidChecks':len(reports['android-network-ui.json']['checks']),'apkSha256':reports['apk-verification.json']['sha256']}
(root/'evidence/delivery-audit.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
self_check_path=root/'evidence/homework-self-check.json'
if self_check_path.exists():
    self_check=json.loads(self_check_path.read_text(encoding='utf-8'))
    self_check['deliveryChecksPassed']=True
    self_check['deliveryCheckCount']=len(checks)
    self_check_path.write_text(json.dumps(self_check,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'DELIVERY AUDIT PASS: {len(checks)} checks; {report["unitTests"]} unit tests, {report["browserChecks"]} browser checks, {report["androidChecks"]} Android checks')
