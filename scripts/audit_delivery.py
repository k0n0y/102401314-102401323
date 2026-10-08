from pathlib import Path
import zipfile, json, hashlib, re
from PIL import Image

root=Path(__file__).resolve().parents[1]
checks=[]
def check(ok,label):
    if not ok:raise RuntimeError('Delivery audit failed: '+label)
    checks.append(label)
reports={name:json.loads((root/'evidence'/name).read_text(encoding='utf-8')) for name in ['unit-tests.json','browser-ui.json','android-ui.json','apk-verification.json']}
check(reports['unit-tests.json']['tests']>=10 and reports['unit-tests.json']['failed']==0,'单元测试至少 10 个且全部通过')
check(reports['browser-ui.json']['passed'] and reports['android-ui.json']['passed'],'浏览器与实际 APK 检查全部通过')
check(not reports['android-ui.json']['consoleErrors'],'安装版没有页面脚本与资源错误')
apk=root/'apk/shiguang-1.0.0.apk'
check(hashlib.sha256(apk.read_bytes()).hexdigest()==reports['apk-verification.json']['sha256'],'APK 哈希与签名验证记录一致')
with zipfile.ZipFile(apk) as z:
    check('classes.dex' in z.namelist() and 'AndroidManifest.xml' in z.namelist(),'APK 包含原生代码与 Android manifest')
    for file in (root/'web').iterdir():
        check(z.read('assets/'+file.name)==file.read_bytes(),'APK 内置资源与提交源码一致：'+file.name)
for directory in ['docs/images/android','docs/images/browser']:
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
check('待记录' in (root/'docs/PSP.md').read_text(encoding='utf-8'),'PSP 实际保留待本人记录标识')
report={'passed':True,'checks':checks,'unitTests':reports['unit-tests.json']['tests'],'browserChecks':len(reports['browser-ui.json']['checks']),'androidChecks':len(reports['android-ui.json']['checks']),'apkSha256':reports['apk-verification.json']['sha256']}
(root/'evidence/delivery-audit.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(f'DELIVERY AUDIT PASS: {len(checks)} checks; {report["unitTests"]} unit tests, {report["browserChecks"]} browser checks, {report["androidChecks"]} Android checks')
