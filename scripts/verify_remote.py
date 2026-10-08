from pathlib import Path
import hashlib,json,urllib.request,subprocess,datetime,sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[1]
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/main'],cwd=root,text=True).split()[0]
if head!=remote:raise RuntimeError('Remote HEAD differs')
base='https://raw.githubusercontent.com/k0n0y/102401314-102401323/'+head+'/'
record=json.loads((root/'evidence/apk-verification.json').read_text(encoding='utf-8'))
apk=urllib.request.urlopen(base+'apk/'+record['apk'],timeout=30).read()
actual=hashlib.sha256(apk).hexdigest()
if actual!=record['sha256']:raise RuntimeError('Remote APK differs')
readme=urllib.request.urlopen(base+'README.md',timeout=30).read().decode('utf-8')
if '不同设备连接同一个共享服务' not in readme or '尚未部署公网' not in readme:raise RuntimeError('README does not describe current scope')
report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repository':'https://github.com/k0n0y/102401314-102401323','remoteHead':remote,'headMatched':True,'publicApkDownloadVerified':True,'apkSha256':actual,'readmeVerified':True,'publicServiceDeployed':False,'classSubmissionVerified':False,'partnerForkPrVerified':False}
(root.parent/'GitHub_拾光App共享版核验.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
