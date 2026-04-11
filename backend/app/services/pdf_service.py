"""
PDF generation service for Study Reviewers using reportlab.
"""
from __future__ import annotations

import io
import os
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

# ── Logo path (bundled in app/static/) ─────────────────────────
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
_LOGO_PATH = os.path.join(_STATIC_DIR, "logo-mark.png")

# Brand color
SURIE_BLUE = colors.HexColor("#0072C6")
SURIE_DARK = colors.HexColor("#0F1A2E")
LIGHT_GRAY = colors.HexColor("#F5F4F1")
MID_GRAY = colors.HexColor("#9B9794")


def _get_logo_image(size: float = 28) -> Image:
    path = os.path.normpath(_LOGO_PATH)
    img = Image(path, width=size, height=size)
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
