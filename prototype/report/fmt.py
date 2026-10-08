"""fmt.py - small formatting helpers shared by the report sections."""
import html, re
from decimal import Decimal, ROUND_HALF_UP

LABEL = {"StrongBuy": "Strong Buy", "Buy": "Buy", "Neutral": "Neutral", "Sell": "Sell", "StrongSell": "Strong Sell", "StongSell": "Strong Sell"}
SHORT = {"StrongBuy": "SB", "Buy": "B", "Neutral": "N", "Sell": "S", "StrongSell": "SS", "StongSell": "SS"}
ICON = {"hold": '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
        "watch": '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 1.6a4.4 4.4 0 010 8.8z" fill="currentColor"/></svg>',
        "review": '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.4l5.2 9.2H.8z" fill="currentColor"/></svg>',
        "nodata": '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.4 6h7.2" stroke="currentColor" stroke-width="1.8"/></svg>'}
VCLASS = {"HOLD": "hold", "HOLD · REVIEW SIZE": "hold", "WATCH": "watch", "REVIEW": "review", "NO DATA": "nodata"}


def e(s): return html.escape(str(s), quote=True)
def sid(sym): return re.sub(r"\W", "_", sym)
def money(x, d=0): return f"${x:,.{d}f}" if x >= 0 else f"−${abs(x):,.{d}f}"
def sgn(x, d=1): return f"{x:+.{d}f}%".replace("-", "−")
def sgnm(x, d=0):
    r = round(abs(x), d)
    return "$0" if r == 0 else ("+" if x >= 0 else "−") + f"${r:,.{d}f}"
def pct(x, d=1): return f"{x:.{d}f}%".replace("-", "−")


def usd2(x):
    q = Decimal(str(abs(x))).quantize(Decimal("0.01"), ROUND_HALF_UP)
    return ("−$" if x < 0 else "$") + str(q)


_NUM = "zero one two three four five six seven eight nine ten eleven twelve".split()
def words(n): return _NUM[n] if 0 <= n < len(_NUM) else str(n)
def nice(name): return name.replace("International Business Machines Corporation (IBM)", "IBM").replace("-ADR", " ADR")
def amt(text): return f'<span class="amt">{text}</span>'
def tone(v): return "" if v is None else "good" if v >= .35 else "bad" if v <= -.15 else ""


def big(x, d=1):
    return f"${x / 1e9:,.{d}f}B" if abs(x) >= 1e9 else f"${x / 1e6:,.0f}M"


def chip(verdict):
    k = VCLASS[verdict]
    return f'<span class="chip {k}">{ICON[k]}{e({"HOLD · REVIEW SIZE": "HOLD · SIZE"}.get(verdict, verdict))}</span>'
