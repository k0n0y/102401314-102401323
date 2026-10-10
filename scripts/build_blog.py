"""兼容旧材料生成入口，统一使用当前博客正文生成器。"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('build_publication_drafts.py')), run_name='__main__')
