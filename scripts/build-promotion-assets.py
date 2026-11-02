"""紹介素材を再生成する。実行にはPillow・reportlab・Popplerを使う（アプリの依存ではない）。"""
import json
import argparse
import subprocess
import unicodedata
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image, ImageDraw, ImageFont
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as PdfFont
from reportlab.pdfgen import canvas

parser = argparse.ArgumentParser()
parser.add_argument('--pdf-font', required=True, help='NotoSansJPのRegular TrueTypeフォントへのパス')
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static/promo"
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((ROOT / "src/lib/content/promotion-data.json").read_text())
BG, INK, ACCENT, MUTED = "#faf8f1", "#343e39", "#894432", "#687264"
FONT_DIR = Path("/System/Library/Fonts")


def font_path(name):
    return next(p for p in FONT_DIR.iterdir() if unicodedata.normalize("NFC", p.name) == name)


REGULAR = font_path("ヒラギノ角ゴシック W3.ttc")
BOLD = font_path("ヒラギノ角ゴシック W6.ttc")


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REGULAR), size)


def fitted(draw, value, size, width, bold=False):
    while draw.textlength(value, font=font(size, bold)) > width:
        size -= 1
    return font(size, bold)


for index, card in enumerate(DATA["cards"]):
    im = Image.new("RGB", (1080, 1350), BG)
    d = ImageDraw.Draw(im)
    d.line((72, 165, 1008, 165), fill="#d9d9ca", width=2)
    d.text((72, 57), "Koi-Tre", font=font(46, True), fill=ACCENT)
    d.text((755, 75), "会う前の、ちいさな準備", font=font(19), fill=MUTED)
    d.text((72, 210), f"会話のひと工夫  {index + 1:02d} / 03", font=font(23), fill=ACCENT)
    for n, title in enumerate(card["title"]):
        d.text((72, 290 + n * 102), title, font=fitted(d, title, 65, 936, True), fill=INK)
    d.rounded_rectangle((72, 565, 1008, 700), radius=15, fill="#eeeee4")
    d.text((108, 589), "こんなとき", font=font(20), fill=MUTED)
    d.text((108, 633), card["question"], font=fitted(d, card["question"], 30, 864), fill=INK)
    d.rounded_rectangle((72, 735, 1008, 965), radius=15, fill="#ffffff", outline="#d9d9ca", width=2)
    d.text((108, 765), "自分の言葉で、例えば", font=font(20), fill=ACCENT)
    for n, line in enumerate(card["reply"]):
        d.text((108, 817 + n * 58), line, font=fitted(d, line, 34, 864, True), fill=INK)
    d.text((72, 1013), card["tip"], font=fitted(d, card["tip"], 28, 936), fill=INK)
    d.rounded_rectangle((72, 1120, 1008, 1194), radius=7, fill=ACCENT)
    d.text((109, 1140), "登録不要・無料の会話ネタ帳で、次のひと言を。", font=font(27, True), fill="white")
    d.text((72, 1240), "app.koi-tre.com/topics", font=font(28), fill=ACCENT)
    d.text((72, 1294), "※会話例は架空のやり取りです。", font=font(17), fill=MUTED)
    im.save(OUT / f"{card['id']}.png", optimize=True)

channel = DATA["channels"]["event"]
link = "https://app.koi-tre.com/topics?" + urlencode({
    "utm_source": channel["source"], "utm_medium": channel["medium"],
    "utm_campaign": DATA["campaign"], "utm_content": "flyer"
})
qr = QRCode(None, QRErrorCorrectLevel.M)
qr.addData(link)
qr.make()
border, scale = 4, 12
size = (qr.moduleCount + border * 2) * scale
qr_im = Image.new("RGB", (size, size), "white")
qd = ImageDraw.Draw(qr_im)
for row in range(qr.moduleCount):
    for col in range(qr.moduleCount):
        if qr.modules[row][col]:
            x, y = (col + border) * scale, (row + border) * scale
            qd.rectangle((x, y, x + scale - 1, y + scale - 1), fill="black")
qr_im.save(OUT / "event-qr.png")

pdfmetrics.registerFont(PdfFont("NotoSansJP", args.pdf_font))
pdf = OUT / "koi-tre-event-guide.pdf"
c = canvas.Canvas(str(pdf), pagesize=A4)
c.setTitle("Koi-Tre - 会う前の会話準備ガイド")
c.setAuthor("TechGuide LLC.")
w, h = A4
c.setFillColor(BG)
c.rect(0, 0, w, h, fill=1, stroke=0)


def line(text, x, y, size=12, color=INK):
    c.setFont("NotoSansJP", size)
    c.setFillColor(color)
    c.drawString(x, y, text)


line("Koi-Tre  コイトレ", 44, h - 56, 21, ACCENT)
line("会う日の前に、", 44, h - 126, 31)
line("会話のちいさな準備を。", 44, h - 171, 31)
line("初対面で、何を話そう。相手の返事に、どう返そう。", 44, h - 214, 13)
line("聞き方と返し方の例を、会う前に一つだけ。", 44, h - 238, 13)

c.setFillColor("#eeeee4")
c.roundRect(44, 383, w - 88, 170, 5, fill=1, stroke=0)
line("例えば、休日の話になったら。", 64, 523, 14, ACCENT)
line("相手：お休みの日は、何をしていますか？", 64, 486, 12)
line("自分：最近は散歩が楽しみです。", 64, 459, 12)
line("　　　歩くときは、目的地を決めますか？", 64, 432, 12)
line("自分のことをひと言添えて、相手の話も聞いてみる。", 64, 405, 10, MUTED)

line("01  読む", 44, 341, 16, ACCENT)
line("18の話題と返し方。登録不要・無料です。", 44, 316, 12)
line("02  試す", 44, 272, 16, ACCENT)
line("30秒のお試しで、返し方を選んでみる。", 44, 247, 12)
line("03  練習する", 44, 203, 16, ACCENT)
line("AI相手に3往復。自分の言葉で練習できます。", 44, 178, 11)
line("Googleログインが必要です。月10回無料。", 44, 157, 10, MUTED)
c.drawImage(str(OUT / "event-qr.png"), w - 183, 204, width=139, height=139)
line("会話ネタ帳を開く", w - 166, 187, 10, ACCENT)
c.linkURL(link, (w - 183, 204, w - 44, 343), relative=0, thickness=0)
line("女性も男性も。ご自身の性別を入力せずに使えます。", 44, 119, 11)
line("app.koi-tre.com/topics", 44, 88, 14, ACCENT)
line("※会話例は架空のやり取りです。恋愛の結果を保証するものではありません。", 44, 58, 8, MUTED)
line("運営：TechGuide LLC.", 44, 40, 8, MUTED)
c.showPage()
c.save()
subprocess.run(["pdftoppm", "-singlefile", "-scale-to", "842", "-png", str(pdf), str(OUT / "event-guide-preview")], check=True)
print(f"紹介画像3枚、QR画像、A4 PDFとプレビューを生成: {OUT}")
