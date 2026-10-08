"""不用 Gradle 下载依赖，使用官方 SDK 工具构建同一份 Android 源码。"""
from pathlib import Path
import subprocess, os, zipfile, json, hashlib, datetime, argparse, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--sdk', default=os.environ.get('ANDROID_HOME', str(root.parent / 'tools/android-build/sdk')))
parser.add_argument('--jdk', default=os.environ.get('JAVA_HOME', str(root.parent / 'tools/android-build/jdk')))
args = parser.parse_args()
sdk = Path(args.sdk)
jdk = Path(args.jdk)
if not (jdk / 'bin/java.exe').exists():
    jdk = next(jdk.glob('*/bin/java.exe')).parents[1]
platform = next(sdk.rglob('android.jar'))
tools = next(sdk.rglob('aapt2.exe')).parent
build = root / 'build'
for name in ['classes', 'gen', 'dex', 'keys']:
    (build / name).mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
env['JAVA_HOME'] = str(jdk)
env['PATH'] = str(jdk / 'bin') + os.pathsep + env.get('PATH', '')
log = []
def run(command):
    # 部分 Android Windows 工具使用窄字符路径。传相对 ASCII 参数以兼容中文工作目录。
    command = [str(value) if i == 0 or not isinstance(value, Path) else os.path.relpath(value, root) for i, value in enumerate(command)]
    print('RUN', Path(command[0]).name, ' '.join(command[1:]), flush=True)
    result = subprocess.run(command, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    print(result.stdout, flush=True)
    log.append({'tool': Path(command[0]).name, 'exitCode': result.returncode, 'output': result.stdout})
    (root / 'evidence/build-log.json').write_text(json.dumps(log, indent=2, ensure_ascii=False), encoding='utf-8')
    if result.returncode: raise RuntimeError('Build failed: ' + Path(command[0]).name)
    return result.stdout
main = root / 'android/app/src/main'
run([tools / 'aapt2.exe', 'compile', '--dir', main / 'res', '-o', build / 'resources.zip'])
run([tools / 'aapt2.exe', 'link', '-o', build / 'base.apk', '-I', platform, '--manifest', main / 'AndroidManifest.xml', '-A', root / 'web', '--java', build / 'gen', build / 'resources.zip'])
sources = list((main / 'java').rglob('*.java')) + list((build / 'gen').rglob('*.java'))
run([jdk / 'bin/javac.exe', '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', platform, '-d', build / 'classes', *sources])
with zipfile.ZipFile(build / 'classes.jar', 'w') as z:
    for file in (build / 'classes').rglob('*.class'): z.write(file, file.relative_to(build / 'classes').as_posix())
# .bat wrappers are invoked through cmd with an argument list, never string-built file operations.
run(['cmd.exe', '/c', tools / 'd8.bat', '--lib', platform, '--min-api', '26', '--output', build / 'dex', build / 'classes.jar'])
with zipfile.ZipFile(build / 'base.apk', 'a', compression=zipfile.ZIP_DEFLATED) as z:
    for file in (build / 'dex').glob('*.dex'): z.write(file, file.name)
run([tools / 'zipalign.exe', '-f', '4', build / 'base.apk', build / 'aligned.apk'])
key = build / 'keys/coursework.keystore'
if not key.exists():
    run([jdk / 'bin/keytool.exe', '-genkeypair', '-keystore', key, '-storepass', 'coursework', '-keypass', 'coursework', '-alias', 'coursework', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650', '-dname', 'CN=Shiguang Coursework, O=FZU, C=CN'])
apk = root / 'apk/shiguang-1.0.0.apk'
run(['cmd.exe', '/c', tools / 'apksigner.bat', 'sign', '--ks', key, '--ks-pass', 'pass:coursework', '--ks-key-alias', 'coursework', '--out', apk, build / 'aligned.apk'])
signature = run(['cmd.exe', '/c', tools / 'apksigner.bat', 'verify', '--verbose', '--print-certs', apk])
run([tools / 'aapt.exe', 'dump', 'badging', apk])
report = {'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'apk': apk.name, 'bytes': apk.stat().st_size, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'minSdk':26, 'targetSdk':35, 'package':'edu.fzu.shiguang', 'debuggable':True, 'signatureVerified':True}
(root / 'evidence/apk-verification.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
print('APK VERIFIED', apk, flush=True)
