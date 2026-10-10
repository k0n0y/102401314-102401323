"""核对博客复制版及已公开图片；不将材料齐备当作个人经历或发表证明。"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import re
import urllib.request
import subprocess

root = Path(__file__).resolve().parents[1]
docs = root / 'docs'
articles = []
urls = {}
for name in ['曾炜毅', '陈勇昊']:
    path = docs / f'博客园直接粘贴版_{name}.md'
    text = path.read_text(encoding='utf-8')
    images = re.findall(r'!\[[^\]]*\]\(([^)]+)\)', text)
    assert text.count('\n## ') == 10 and text.count('```') % 2 == 0
    assert len(images) == 11 and len(set(images)) == 11
    assert not re.search(r'【待(?:填写|核实)', text)
    assert '待记录' in text and '不是已测量的实际耗时' in text
    for url in images:
        assert url.startswith('https://raw.githubusercontent.com/k0n0y/')
        local = docs / url.split('/docs/', 1)[1]
        assert local.is_file()
        urls[url] = local
    articles.append({'author': name, 'file': str(path), 'mainSections': 10,
                     'images': 11, 'emptyPersonalParagraphs': 0,
                     'personalExpressionDrafted': True,
                     'personalExpressionConfirmed': False,
                     'actualPersonalPspConfirmed': False,
                     'publishedArticleVerified': False})

def verify(item):
    url, local = item
    request = urllib.request.Request(url, headers={'User-Agent': 'Shiguang-publication-audit'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read()
        status, content_type = response.status, response.headers.get('Content-Type', '')
    local_hash = hashlib.sha256(local.read_bytes()).hexdigest()
    remote_hash = hashlib.sha256(data).hexdigest()
    assert status == 200 and content_type.startswith('image/')
    assert local_hash == remote_hash, '公开图片与正文引用的本地图片不一致：' + url
    return {'url': url, 'httpStatus': status, 'contentType': content_type,
            'bytes': len(data), 'sha256': remote_hash, 'localBytesMatched': True}

with ThreadPoolExecutor(max_workers=6) as pool:
    links = list(pool.map(verify, urls.items()))

report = {'checkedAtUtc': datetime.now(timezone.utc).isoformat(),
          'passed': True, 'scope': '正文结构、非空个人草稿及公开图片字节核验',
          'articles': articles, 'publicImageLinks': links,
          'uniquePublicImages': len(links),
          'cnblogsPreviewVerified': False, 'classSubmissionVerified': False,
          'fullAssignmentComplete': False,
          'remaining': ['成员确认个人表达和实际投入', '博客园预览与发表并取得文章链接',
                        '课程提交成功及班级结对表填写']}
(root / 'evidence/publication-materials-check.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
audit_path = root / 'evidence/homework-self-check.json'
if audit_path.exists():
    audit = json.loads(audit_path.read_text(encoding='utf-8'))
    audit['blogs'] = articles
    audit['publicationSupplement'] = {
        'checkedAtUtc': report['checkedAtUtc'],
        'sourceCommitBeforeSupplementCommit': subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
        'publicImageLinksVerified': len(links),
        'personalDraftsFilled': True,
        'collaborationProblemFilledFromEvidence': True,
        'cnblogsPreviewVerified': False}
    audit['remaining'] = report['remaining']
    audit['overallAssignmentComplete'] = False
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
print('PUBLICATION MATERIALS PASS: 2 drafts; 10 sections and 11 images each; '
      '11 public images returned HTTP 200 and matched local bytes')
