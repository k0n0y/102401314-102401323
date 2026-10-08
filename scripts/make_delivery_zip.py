from pathlib import Path
import zipfile, hashlib, json
root=Path(__file__).resolve().parents[1]
target=root.parent/'拾光App_第二次结对作业_交付包.zip'
exclusions={'.git','build','.gradle','__pycache__'}
files=[]
for file in root.rglob('*'):
    relative=file.relative_to(root)
    if not file.is_file() or any(part in exclusions or part.startswith('.verify-profile-') for part in relative.parts) or file.suffix=='.keystore':continue
    files.append(file)
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for file in sorted(files):z.write(file,root.name+'/'+file.relative_to(root).as_posix())
with zipfile.ZipFile(target) as z:
    bad=z.testzip()
    if bad:raise RuntimeError('Bad ZIP member: '+bad)
    actual=z.read(root.name+'/apk/shiguang-1.0.0.apk')
    if actual!=(root/'apk/shiguang-1.0.0.apk').read_bytes():raise RuntimeError('ZIP APK mismatch')
report={'zipName':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'files':len(files),'zipIntegrityVerified':True,'apkBytesMatched':True}
(root.parent/'拾光App_交付包核验.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(str(target));print(json.dumps(report,ensure_ascii=False))
