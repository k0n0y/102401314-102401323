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
team=json.loads((root/'docs/team.json').read_text(encoding='utf-8'))
collaboration=team['collaboration']
def github_json(path):
    request=urllib.request.Request('https://api.github.com/'+path,headers={'User-Agent':'Shiguang-coursework-verification'})
    return json.loads(urllib.request.urlopen(request,timeout=30).read().decode('utf-8'))
fork_name=collaboration['partnerFork'].removeprefix('https://github.com/').rstrip('/')
fork=github_json('repos/'+fork_name)
fork_verified=fork.get('fork') is True and fork.get('parent',{}).get('full_name')=='k0n0y/102401314-102401323'
pr_url=collaboration.get('partnerPullRequest')
pr=None
pr_verified=False
if pr_url:
    pr_number=pr_url.rstrip('/').rsplit('/',1)[1]
    pr=github_json('repos/k0n0y/102401314-102401323/pulls/'+pr_number)
    pr_verified=(pr['html_url']==pr_url and pr['user']['login']==collaboration['partnerGitHubAccount'] and
        (pr['head'].get('repo') or {}).get('full_name')==fork_name and
        pr['base']['repo']['full_name']=='k0n0y/102401314-102401323' and pr['changed_files']>0 and pr['commits']>0)
if not fork_verified or (pr_url and not pr_verified):raise RuntimeError('Partner fork or PR source differs from recorded collaboration')
report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repository':'https://github.com/k0n0y/102401314-102401323','remoteHead':remote,'headMatched':True,'publicApkDownloadVerified':True,'apkSha256':actual,'readmeVerified':True,'publicServiceDeployed':False,'classSubmissionVerified':False,'partnerForkVerified':fork_verified,'partnerPullRequestVerified':pr_verified,'partnerForkPrVerified':fork_verified and pr_verified,'partnerPullRequest':pr_url,'partnerPullRequestState':pr['state'] if pr else None,'partnerPullRequestMerged':pr['merged'] if pr else False,'partnerPullRequestHeadSha':pr['head']['sha'] if pr else None}
(root.parent/'GitHub_拾光App共享版核验.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
