"""
PDF generation service for Study Reviewers using reportlab.
"""
from __future__ import annotations

import base64
import io
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Surie logo (base64-encoded PNG) ────────────────────────────
_LOGO_B64 = (
    "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"
)

# Brand color
SURIE_BLUE = colors.HexColor("#0072C6")
SURIE_DARK = colors.HexColor("#0F1A2E")
LIGHT_GRAY = colors.HexColor("#F5F4F1")
MID_GRAY = colors.HexColor("#9B9794")


def _get_logo_image(size: float = 28) -> Image:
    data = base64.b64decode(_LOGO_B64)
    buf = io.BytesIO(data)
    img = Image(buf, width=size, height=size)
    return img


def _parse_markdown(text: str, styles: dict) -> list:
    """Convert AI-generated markdown into reportlab Flowables."""
    elements = []
    lines = text.strip().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            elements.append(Spacer(1, 3 * mm))
            i += 1
            continue

        if stripped.startswith("### "):
            content = _inline_md(stripped[4:])
            elements.append(Paragraph(content, styles["h3"]))
            i += 1
            continue

        if stripped.startswith("## "):
            content = _inline_md(stripped[3:])
            elements.append(Paragraph(content, styles["h2"]))
            i += 1
            continue

        if stripped.startswith("# "):
            content = _inline_md(stripped[2:])
            elements.append(Paragraph(content, styles["h1"]))
            i += 1
            continue

        if stripped.startswith(("- ", "* ")):
            bullet_text = _inline_md(stripped[2:])
            elements.append(Paragraph(f"• {bullet_text}", styles["bullet"]))
            i += 1
            continue

        # Regular paragraph
        content = _inline_md(stripped)
        if content:
            elements.append(Paragraph(content, styles["body"]))
        i += 1

    return elements


def _inline_md(text: str) -> str:
    """Convert **bold** and *italic* to reportlab XML tags."""
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.+?)\*", r"<i>\1</i>", text)
    # Escape any stray ampersands not already part of entity
    text = re.sub(r"&(?!amp;|lt;|gt;|#)", "&amp;", text)
    return text


def generate_reviewer_pdf(
    title: str,
    content: str,
    subject: str,
    grade_level: str,
    class_name: str,
    teacher_name: str,
    generated_at: str,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title=title,
    )

    base = getSampleStyleSheet()

    styles = {
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontSize=16,
            textColor=SURIE_BLUE,
            spaceBefore=10,
            spaceAfter=4,
            fontName="Helvetica-Bold",
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontSize=13,
            textColor=SURIE_BLUE,
            spaceBefore=8,
            spaceAfter=3,
            fontName="Helvetica-Bold",
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=base["Heading3"],
            fontSize=11,
            textColor=SURIE_DARK,
            spaceBefore=6,
            spaceAfter=2,
            fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontSize=10,
            leading=15,
            textColor=SURIE_DARK,
            spaceBefore=2,
            spaceAfter=2,
            fontName="Helvetica",
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            textColor=SURIE_DARK,
            leftIndent=12,
            spaceBefore=1,
            spaceAfter=1,
            fontName="Helvetica",
        ),
        "meta": ParagraphStyle(
            "meta",
            parent=base["Normal"],
            fontSize=9,
            textColor=MID_GRAY,
            fontName="Helvetica",
        ),
    }

    story = []

    # ── Header row: logo + "Surie" | title ──────────────────────
    try:
        logo = _get_logo_image(24)
    except Exception:
        logo = Spacer(24, 24)

    logo_cell = [[logo, Paragraph("<b>Surie</b>", ParagraphStyle(
        "brand",
        fontSize=13,
        textColor=SURIE_BLUE,
        fontName="Helvetica-Bold",
        leading=16,
    ))]]
    logo_tbl = Table(logo_cell, colWidths=[28, 60])
    logo_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    header_data = [[logo_tbl, Paragraph(
        f'<font color="#9B9794" size="9">Study Reviewer</font>',
        ParagraphStyle("right", fontSize=9, textColor=MID_GRAY, fontName="Helvetica", alignment=2),
    )]]
    header_tbl = Table(header_data, colWidths=[None, 80])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_tbl)
    story.append(HRFlowable(width="100%", thickness=1.5, color=SURIE_BLUE, spaceAfter=6 * mm))

    # ── Document title ──────────────────────────────────────────
    story.append(Paragraph(title, ParagraphStyle(
        "doctitle",
        fontSize=18,
        textColor=SURIE_DARK,
        fontName="Helvetica-Bold",
        spaceAfter=4 * mm,
    )))

    # ── Metadata chips (class, teacher, subject, grade, date) ───
    chips = []
    if class_name:
        chips.append(f"Class: {class_name}")
    if teacher_name:
        chips.append(f"Teacher: {teacher_name}")
    if subject:
        chips.append(f"Subject: {subject}")
    if grade_level:
        chips.append(f"Grade {grade_level}")
    if generated_at:
        chips.append(f"Generated: {generated_at}")

    if chips:
        story.append(Paragraph(
            " &nbsp;|&nbsp; ".join(chips),
            styles["meta"],
        ))
    story.append(Spacer(1, 5 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E8E6E1"), spaceAfter=5 * mm))

    # ── Reviewer content ────────────────────────────────────────
    story.extend(_parse_markdown(content, styles))

    doc.build(story)
    return buf.getvalue()
