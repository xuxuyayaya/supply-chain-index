import io
import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlsplit
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

CONTENT = json.loads(Path(__file__).with_name("content.json").read_text())
FONT_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
if Path(FONT_PATH).exists():
    pdfmetrics.registerFont(TTFont("ReceiptChinese", FONT_PATH, subfontIndex=0))
    FONT = "ReceiptChinese"
else:
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    FONT = "STSong-Light"


def create_pdf(company, confirmed_at=""):
    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output, pagesize=A4, rightMargin=48, leftMargin=48,
        topMargin=42, bottomMargin=38, title=CONTENT[0],
        author="中国数联物流信息有限公司",
    )
    title = ParagraphStyle("Title", fontName=FONT, fontSize=18, leading=27,
                           alignment=TA_CENTER, spaceAfter=20)
    body = ParagraphStyle("Body", fontName=FONT, fontSize=11.5, leading=19,
                          firstLineIndent=23, alignment=TA_JUSTIFY,
                          wordWrap="CJK", spaceAfter=8)
    issuer = ParagraphStyle("Issuer", parent=body, alignment=TA_RIGHT,
                            firstLineIndent=0, spaceAfter=1)
    signature = ParagraphStyle("Signature", parent=body, firstLineIndent=0,
                               leading=19, spaceAfter=0)
    story = [Paragraph(escape(CONTENT[0]), title)]
    for text in CONTENT[1:8]:
        story.append(Paragraph(escape(text), body))
    story.extend([Spacer(1, 4), Paragraph(escape(CONTENT[8]), issuer),
                  Paragraph(escape(CONTENT[9]), issuer), Spacer(1, 24)])
    table = Table([[Paragraph("响应单位", signature), Paragraph(escape(company), signature)]],
                  colWidths=[63, A4[0] - 159])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LINEBELOW", (1, 0), (1, 0), 0.6, colors.black),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(table)
    if confirmed_at:
        small = ParagraphStyle("Time", fontName=FONT, fontSize=9, leading=14,
                               spaceBefore=12, textColor=colors.HexColor("#555555"))
        story.append(Paragraph("响应时间 " + escape(confirmed_at), small))
    doc.build(story)
    return output.getvalue()


class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.serve_file(head=True)

    def do_GET(self):
        self.serve_file(head=False)

    def serve_file(self, head=False):
        parsed = urlsplit(self.path)
        if parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            if not head:
                self.wfile.write(b"ok")
            return
        if parsed.path != "/certificate.pdf":
            self.send_error(404)
            return
        params = parse_qs(parsed.query)
        company = params.get("company", [""])[0].strip()
        if not company or len(company) > 100 or any(ord(c) < 32 for c in company):
            self.send_error(400, "Company is required and must be at most 100 characters")
            return
        confirmed_at = params.get("confirmedAt", [""])[0].strip()
        if len(confirmed_at) > 80 or any(ord(c) < 32 for c in confirmed_at):
            self.send_error(400, "Invalid confirmation date")
            return
        try:
            pdf = create_pdf(company, confirmed_at)
        except Exception:
            self.send_error(500, "Could not create PDF")
            return
        disposition = "attachment" if params.get("mode", [""])[0] == "download" else "inline"
        filename = quote("倡议响应凭证-" + company + ".pdf", safe="")
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition",
                         disposition + "; filename=initiative-response.pdf; filename*=UTF-8''" + filename)
        self.send_header("Content-Length", str(len(pdf)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head:
            self.wfile.write(pdf)

    def log_message(self, format, *args):
        pass  # Do not log company names embedded in download URLs.


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
