#!/usr/bin/env python3
"""export_pdf.py - print reports\\<id>\\portfolio_report.html to an A4-landscape PDF with headless Edge or Chrome.

    python report\\export_pdf.py [ID]
"""
import re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BROWSERS = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe", r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else sorted(p.name for p in (ROOT / "reports").iterdir() if p.is_dir())[-1]
    src = ROOT / "reports" / sid / "portfolio_report.html"
    if not src.exists(): sys.exit(f"{src} not found; run report\\build_report.py first")
    pdf = src.with_suffix(".pdf")
    exe = next((b for b in BROWSERS if Path(b).exists()), None) or shutil.which("msedge") or shutil.which("chrome")
    if not exe: sys.exit("No Edge or Chrome found")
    pdf.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={profile}", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", src.as_uri()], check=True, timeout=120)
    if not pdf.exists(): sys.exit("The browser did not produce a PDF")
    (ROOT / "latest").mkdir(exist_ok=True)
    shutil.copyfile(pdf, ROOT / "latest" / "portfolio_report.pdf")
    raw = pdf.read_bytes().decode("latin1")
    pages = max((int(n) for n in re.findall(r"/Count\s+(\d+)", raw)), default=0)
    print(f"wrote {pdf} ({pdf.stat().st_size / 1024:.0f} KB, {pages} pages)")


if __name__ == "__main__":
    main()
