"""
PandaHub Expected Outcomes & System Outputs Generator
Generates an executive-grade, beautifully styled PDF documenting the expected outcomes and outputs of PandaHub.
Written in simple English points with clear, bold headlines.
"""

import os
import shutil
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

# ─────────────────────────────────────────────────────────────────────────────
# Custom NumberedCanvas for Running Headlines & Dynamic "Page X of Y"
# ─────────────────────────────────────────────────────────────────────────────

class PandaExpectedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        page_num = self._pageNumber
        page_width, page_height = letter

        navy_dark = colors.HexColor("#0B1120")
        slate_text = colors.HexColor("#64748B")
        green_accent = colors.HexColor("#10B981")
        border_color = colors.HexColor("#CBD5E1")

        # Top Running Header
        if page_num == 1:
            # First page top accent bar
            self.setFillColor(navy_dark)
            self.rect(0, page_height - 6, page_width, 6, fill=True, stroke=False)
            self.setFillColor(green_accent)
            self.rect(0, page_height - 6, 140, 6, fill=True, stroke=False)
        else:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(navy_dark)
            self.drawString(36, page_height - 28, "PANDAHUB PROJECT DELIVERABLES & EXPECTED OUTCOMES")

            self.setFont("Helvetica", 8)
            self.setFillColor(slate_text)
            self.drawString(290, page_height - 28, "-- Simple English Functional Breakdown")

            self.setFillColor(green_accent)
            self.circle(page_width - 42, page_height - 25, 3.5, fill=True, stroke=False)

            self.setStrokeColor(border_color)
            self.setLineWidth(0.6)
            self.line(36, page_height - 34, page_width - 36, page_height - 34)

        # Bottom Running Footer (All pages)
        self.setStrokeColor(border_color)
        self.setLineWidth(0.6)
        self.line(36, 36, page_width - 36, 36)

        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))
        self.drawString(36, 24, "PandaHub Developer Platform")

        self.setFont("Helvetica", 8)
        self.setFillColor(slate_text)
        self.drawString(165, 24, "|  Expected Outcomes & Deliverables Specification  |  Simple English Edition")

        page_str = f"Page {page_num} of {total_pages}"
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(navy_dark)
        self.drawRightString(page_width - 36, 24, page_str)

        self.restoreState()


# ─────────────────────────────────────────────────────────────────────────────
# Outcomes Data: Headlines + Simple English Points
# ─────────────────────────────────────────────────────────────────────────────

HEADLINES_DATA = [
    {
        "headline_num": "HEADLINE 01",
        "category": "CORE STORAGE ENGINE",
        "color": "#0284C7",
        "title": "Cloud-Ready Git Repository Hosting & Version Control",
        "summary": "PandaHub provides full Git capabilities so developers can host, store, and manage their software code safely.",
        "points": [
            ("Universal Git Compatibility", "Developers can push, pull, and clone code using their standard terminal commands (git push, git pull) without installing extra software."),
            ("In-Browser Code Explorer", "Anyone can click through folders, inspect syntax-highlighted code files, and download files directly in their web browser."),
            ("Commit History & Timeline", "The system keeps an exact chronological record of every saved change, showing who made it, when it was made, and what was altered."),
            ("Branch Comparison & Switching", "Teams can create separate branches to test new features and compare exact line changes before merging into the main branch."),
            ("Secure Bare Repository Storage", "Repositories are stored in isolated, bare Git directories on local disk or cloud buckets with automated integrity checks."),
        ]
    },
    {
        "headline_num": "HEADLINE 02",
        "category": "FRONTEND & USER EXPERIENCE",
        "color": "#10B981",
        "title": "Modern Next.js Web Interface & Interactive Dashboard",
        "summary": "The web application delivers an intuitive, fast, and responsive user experience across all devices.",
        "points": [
            ("Lightning-Fast Page Speeds", "Built with Next.js 14, React, and Tailwind CSS to ensure pages load under one second with seamless navigation."),
            ("28 Complete Functional Pages", "Includes everything from login screens and repo explorers to startup showcases, team profiles, and administration dashboards."),
            ("Sleek Dark Mode Interface", "Features a modern, eye-friendly dark design inspired by developer-focused platforms that looks great day and night."),
            ("Personalized Developer Dashboard", "Gives each developer an organized home screen showing their active repositories, latest pull requests, and activity feeds."),
            ("Mobile & Tablet Responsive", "Every page automatically adjusts to fit smartphones, tablets, and widescreen desktop monitors perfectly."),
        ]
    },
    {
        "headline_num": "HEADLINE 03",
        "category": "ARTIFICIAL INTELLIGENCE",
        "color": "#8B5CF6",
        "title": "AI-Powered Code Reviewer & Repository Assistant",
        "summary": "Built-in artificial intelligence helps engineers catch bugs faster, review pull requests, and understand complex codebases.",
        "points": [
            ("Automated Code Reviews", "The AI inspects proposed code changes automatically, highlighting logic bugs, security risks, and slow code before merging."),
            ("Plain English PR Summaries", "Generates clear, simple explanations of code diffs so teammates can understand changes without reading thousands of lines."),
            ("Interactive Codebase Chatbot (RAG)", "Developers can ask questions like 'How does the login work?' and receive accurate answers referencing project files."),
            ("Smart Multi-Model Switching", "Dynamically routes requests between leading AI models (Gemini, Claude, GPT) and automatically falls back if one is slow."),
            ("Code Quality Scoring", "Evaluates source code against engineering standards and gives developers constructive tips to improve their skills."),
        ]
    },
    {
        "headline_num": "HEADLINE 04",
        "category": "COLLABORATION & WORKFLOWS",
        "color": "#F59E0B",
        "title": "Team Collaboration Suite (PRs, Issues & Discussions)",
        "summary": "PandaHub brings teams together with built-in tools for tracking work, discussing ideas, and reviewing contributions.",
        "points": [
            ("Side-by-Side Pull Request Diffs", "Reviewers can inspect changes with green additions and red deletions, leave inline comments, and approve merges with one click."),
            ("Visual Issue Tracker & Roadmaps", "Teams can report bugs, request features, set priority labels, assign owners, and track milestone deadlines."),
            ("Community Discussion Boards", "Open-forum discussion threads let communities brainstorm project ideas, ask questions, and share guides."),
            ("Real-Time Notification Feeds", "Users receive instant notifications when they are mentioned in a comment, assigned a task, or when code is reviewed."),
            ("Rich Markdown & Emoji Support", "All comments support checkboxes, formatting, code blocks, and emoji reactions for friendly, clear communication."),
        ]
    },
    {
        "headline_num": "HEADLINE 05",
        "category": "SECURITY & COMPLIANCE",
        "color": "#EF4444",
        "title": "Automated Security Gate & Vulnerability Scanner",
        "summary": "Protects projects from data leaks and vulnerabilities before hazardous code ever reaches production.",
        "points": [
            ("Secret & API Key Detection", "Scans every commit to prevent accidental leaks of database passwords, payment keys, or private tokens."),
            ("Dependency Vulnerability Audits", "Analyzes project dependency files (requirements.txt, package.json) to alert developers about known vulnerable libraries."),
            ("Protected Branch Safeguards", "Locks main production branches so code cannot be pushed directly without code review and passing checks."),
            ("Role-Based Access Control (RBAC)", "Assigns clear permissions (Owner, Maintainer, Contributor, Reader) to guarantee only authorized members can edit code."),
            ("Safe Single Sign-On (OAuth)", "Allows secure one-click sign-in using Google or GitHub accounts alongside encrypted password authentication."),
        ]
    },
    {
        "headline_num": "HEADLINE 06",
        "category": "COMMUNITY & VENTURES",
        "color": "#EC4899",
        "title": "Startups Hub & Talent Matching Ecosystem",
        "summary": "Connects student developers and indie makers directly with collaborators, users, and mentors.",
        "points": [
            ("Venture Discovery Showcase", "A dedicated platform page where student entrepreneurs can showcase their prototypes, products, and tech startups."),
            ("Stage-Based Project Filtering", "Visitors can browse projects categorized by their development stage: Idea Stage, Working Prototype (MVP), or Scaling Startup."),
            ("Co-Founder & Team Recruitment", "Project founders can post open roles to find frontend developers, backend engineers, UI designers, or marketing helpers."),
            ("Community Feedback & Upvoting", "Peers and mentors can upvote exciting projects, give practical feedback, and follow regular launch updates."),
        ]
    },
    {
        "headline_num": "HEADLINE 07",
        "category": "DEVELOPER TOOLING",
        "color": "#06B6D4",
        "title": "Native Command-Line Interface (Panda CLI Engine)",
        "summary": "A dedicated terminal application that lets engineers interact with PandaHub directly from their command prompt.",
        "points": [
            ("Terminal-First Efficiency", "Developers can create repositories, clone projects, and view issues without ever leaving their terminal window."),
            ("One-Command Secure Authentication", "Connects your local machine to your PandaHub account in seconds using a secure token authentication command."),
            ("Local AI Code Review Command", "Engineers can run a CLI command to check their code with AI before committing or pushing to the cloud."),
            ("Cross-Platform Support", "Works reliably across Windows PowerShell, macOS Terminal, and Linux shells with colored status feedback."),
        ]
    },
    {
        "headline_num": "HEADLINE 08",
        "category": "WEB PUBLISHING",
        "color": "#14B8A6",
        "title": "Static Documentation & Web Hosting (Panda Pages)",
        "summary": "Allows developers to publish live documentation, portfolios, and project websites directly from their Git branches.",
        "points": [
            ("Automatic Documentation Websites", "Converts Markdown documentation files into clean, readable web documentation with no complex build setup."),
            ("Developer Portfolio Hosting", "Students can host their personal portfolios and demo projects for free under clear, sharable links."),
            ("Automatic Rebuild on Push", "Whenever new updates are pushed to the publishing branch, the live website rebuilds and updates automatically."),
            ("Isolated Domain Routing", "Each hosted page receives a secure web address with SSL encryption and safe file isolation."),
        ]
    },
    {
        "headline_num": "HEADLINE 09",
        "category": "GOVERNANCE & TELEMETRY",
        "color": "#6366F1",
        "title": "System Governance, Diagnostics & Administration",
        "summary": "Provides platform administrators with complete oversight, real-time diagnostics, and audit capabilities.",
        "points": [
            ("Real-Time Error Telemetry", "Monitors server crashes and runtime exceptions live with stack traces so engineers can fix bugs quickly."),
            ("System Audit Logging", "Keeps a permanent, tamper-resistant history of administrative actions, user logins, and repository deletions."),
            ("User & Repository Management", "Administrators can suspend abusive users, adjust system storage quotas, and archive abandoned repositories."),
            ("Server Health & Resource Gauges", "Displays live metrics on database connections, active user counts, and background task queues."),
        ]
    },
    {
        "headline_num": "HEADLINE 10",
        "category": "DEVOPS & INFRASTRUCTURE",
        "color": "#3B82F6",
        "title": "Production Docker Architecture & Zero Vendor Lock-In",
        "summary": "PandaHub is packaged into lightweight containers that can be deployed anywhere with one command.",
        "points": [
            ("One-Command Setup (docker-compose)", "Spins up the full system—Next.js frontend, FastAPI backend, PostgreSQL, Redis, and Nginx—in minutes."),
            ("Host Anywhere (Zero Cloud Lock-In)", "Runs on personal laptops, university servers, private clouds, or cloud providers (AWS, GCP, Render) without changes."),
            ("High-Performance Redis Caching", "Uses Redis for ultra-fast session management, real-time WebSocket messaging, and background task processing."),
            ("Automated Database Migrations", "Uses Alembic migrations to ensure database tables upgrade smoothly without losing user data or code."),
        ]
    },
    {
        "headline_num": "HEADLINE 11",
        "category": "REAL-WORLD IMPACT",
        "color": "#10B981",
        "title": "Academic, Business & Community Benefits",
        "summary": "Delivers concrete value to students, educational institutions, independent developers, and businesses.",
        "points": [
            ("Free & Accessible for Students", "Eliminates expensive monthly SaaS fees by offering a self-hosted, full-featured developer platform for everyone."),
            ("100% Data Sovereignty & Privacy", "Organizations own their source code completely without sending proprietary intellectual property to third parties."),
            ("Accelerated Learning Curve", "Beginner developers receive instant AI feedback that teaches them industry-standard coding practices as they work."),
            ("All-in-One Developer Hub", "Replaces 4 different tools (GitHub + Jira + Discord + ProductHunt) with a single, harmonious workspace."),
        ]
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Performance Metrics Table Data
# ─────────────────────────────────────────────────────────────────────────────

METRICS_DATA = [
    ("Metric / Target Area", "Benchmark Goal", "Simple English Significance"),
    ("Web Page Load Speed", "< 1.2 Seconds", "Pages appear almost instantly, ensuring a smooth user experience."),
    ("Git Push / Pull Latency", "< 250 Milliseconds", "Developers experience zero noticeable delay when syncing code."),
    ("AI Code Review Speed", "< 10 Seconds", "Pull requests receive thorough automated reviews without waiting."),
    ("Storage Compression", "Up to 80% Reduction", "Git packfile compression minimizes disk usage and hosting costs."),
    ("Secret Scanning Time", "< 2 Seconds", "Security checks run in the background without slowing down developers."),
    ("System Availability Target", "99.9% Uptime", "Platform stays reliable and accessible around the clock."),
]

# ─────────────────────────────────────────────────────────────────────────────
# Tangible Deliverable Artifacts Matrix
# ─────────────────────────────────────────────────────────────────────────────

DELIVERABLES_MATRIX = [
    ("Deliverable Component", "Delivered Artifact", "Status", "Simple English Summary"),
    ("Frontend Web App", "Next.js 14 App Router (28 Pages)", "Ready", "Complete web portal for developers, startups & admins"),
    ("Backend API Service", "FastAPI Python Application", "Ready", "High-speed REST and WebSocket communication core"),
    ("Git Storage Engine", "Smart HTTP Protocol Service", "Ready", "Native version control supporting push, pull & branch diffs"),
    ("AI Review Engine", "Multi-LLM RAG & Code Reviewer", "Ready", "Automated code analysis, PR summaries & technical Q&A"),
    ("Security Scanner", "Secret & Dependency Scanner", "Ready", "Pre-merge protection against leaked keys and unsafe packages"),
    ("Panda CLI Engine", "Typer-based Python CLI Tool", "Ready", "Terminal interface for managing repositories & reviews"),
    ("Panda Pages", "Static Documentation Publisher", "Ready", "Automated web page hosting directly from Git branches"),
    ("Deployment Suite", "Docker Compose & Nginx Setup", "Ready", "Single-command containerized deployment for any host"),
    ("Documentation Suite", "Architecture Guides & PDF Reports", "Ready", "Complete developer, API, and system specification reports"),
]


# ─────────────────────────────────────────────────────────────────────────────
# PDF Builder Function
# ─────────────────────────────────────────────────────────────────────────────

def build_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=46,
    )

    styles = getSampleStyleSheet()

    # Base typography styles
    cover_title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0B1120"),
    )

    cover_subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )

    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0B1120"),
    )

    section_desc = ParagraphStyle(
        "SectionDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11.5,
        textColor=colors.HexColor("#475569"),
    )

    # Card / Headline styles
    card_badge_style = ParagraphStyle(
        "CardBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.5,
        leading=8,
        textColor=colors.white,
        alignment=1,
    )

    card_num_style = ParagraphStyle(
        "CardNum",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#64748B"),
    )

    card_title_style = ParagraphStyle(
        "CardTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0F172A"),
    )

    card_summary_style = ParagraphStyle(
        "CardSummary",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )

    bullet_lead_style = ParagraphStyle(
        "BulletLead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
    )

    bullet_text_style = ParagraphStyle(
        "BulletText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )

    # Table styles
    table_head_style = ParagraphStyle(
        "TableHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    table_badge_green = ParagraphStyle(
        "TableBadgeGreen",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#047857"),
        alignment=1,
    )

    story = []

    # ═════════════════════════════════════════════════════════════════════════
    # 1. COVER / EXECUTIVE SUMMARY HEADER
    # ═════════════════════════════════════════════════════════════════════════

    # Top pill badge
    badge_table = Table(
        [[Paragraph("PROJECT SPECIFICATION & SYSTEM DELIVERABLES REPORT", ParagraphStyle("Pill", fontName="Helvetica-Bold", fontSize=7, leading=8, textColor=colors.HexColor("#0284C7")))]],
        colWidths=[540],
    )
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E0F2FE")),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 4))

    # Main Title & Subtitle
    story.append(Paragraph("PANDAHUB: EXPECTED OUTCOMES & SYSTEM OUTPUTS", cover_title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph(
        "A clear, simple-English breakdown of every functional outcome, tangible deliverable, and real-world benefit produced by the PandaHub developer platform.",
        cover_subtitle_style
    ))
    story.append(Spacer(1, 8))

    # Executive Metadata Box
    meta_data = [
        [
            Paragraph("<b>Project Name:</b>", meta_label),
            Paragraph("PandaHub (Self-Hosted Cloud Git Platform)", meta_val),
            Paragraph("<b>Architecture:</b>", meta_label),
            Paragraph("Next.js 14 + FastAPI + Git Engine + Redis + Postgres", meta_val),
        ],
        [
            Paragraph("<b>Core Mission:</b>", meta_label),
            Paragraph("Code Hosting, AI Reviews & Student Startup Hub", meta_val),
            Paragraph("<b>Format:</b>", meta_label),
            Paragraph("Simple English Points with Clear Headlines", meta_val),
        ],
        [
            Paragraph("<b>Target Audience:</b>", meta_label),
            Paragraph("Students, Developers, Evaluators & Founders", meta_val),
            Paragraph("<b>Delivery Status:</b>", meta_label),
            Paragraph("Production-Ready & Fully Containerized", meta_val),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[80, 190, 80, 190])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # Short Executive Summary Callout
    exec_summary_text = (
        "<b>Executive Summary:</b> PandaHub was built to provide an all-in-one, self-hosted software collaboration ecosystem. "
        "Unlike commercial platforms that charge high monthly fees and lock away private data, PandaHub delivers complete Git repository hosting, "
        "automated AI code reviews, student startup talent matching, and containerized Docker deployment in a single open architecture. "
        "The following points describe the exact expected outcomes and system outputs in plain, easy-to-understand English."
    )
    exec_summary_table = Table([[Paragraph(exec_summary_text, section_desc)]], colWidths=[540])
    exec_summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#86EFAC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(exec_summary_table)
    story.append(Spacer(1, 10))

    # ═════════════════════════════════════════════════════════════════════════
    # 2. DETAILED HEADLINES & SIMPLE ENGLISH POINTS
    # ═════════════════════════════════════════════════════════════════════════

    for item in HEADLINES_DATA:
        card_content = []

        # Top Header row: Headline Number + Category Badge
        top_header_data = [
            [
                Paragraph(f"{item['headline_num']} | {item['category']}", card_num_style),
                Paragraph(item['category'], card_badge_style)
            ]
        ]
        top_header_table = Table(top_header_data, colWidths=[430, 96])
        badge_hex = item.get("color", "#0284C7")
        top_header_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (1, 0), (1, 0), colors.HexColor(badge_hex)),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        card_content.append(top_header_table)
        card_content.append(Spacer(1, 2))

        # Main Headline Title
        card_content.append(Paragraph(item['title'], card_title_style))
        card_content.append(Spacer(1, 2))

        # Summary / Context line
        card_content.append(Paragraph(f"<b>Core Outcome:</b> {item['summary']}", card_summary_style))
        card_content.append(Spacer(1, 4))

        # Thin divider
        card_content.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceAfter=4, spaceBefore=0))

        # Bullet points in simple English
        for lead, desc in item['points']:
            bullet_row = [
                [
                    Paragraph("&bull;", bullet_lead_style),
                    Paragraph(f"<b>{lead}:</b> {desc}", bullet_text_style)
                ]
            ]
            bullet_table = Table(bullet_row, colWidths=[12, 514])
            bullet_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            card_content.append(bullet_table)

        # Wrap everything in an outer card with subtle border and light background
        outer_table = Table([[card_content]], colWidths=[540])
        outer_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E2E8F0")),
            ("LINELEFT", (0, 0), (0, -1), 3.0, colors.HexColor(badge_hex)), # Left colored border accent
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))

        # KeepTogether prevents awkward breaks inside a headline card
        story.append(KeepTogether([outer_table]))
        story.append(Spacer(1, 7))

    # ═════════════════════════════════════════════════════════════════════════
    # 3. PERFORMANCE TARGETS & QUANTITATIVE BENCHMARKS
    # ═════════════════════════════════════════════════════════════════════════

    metrics_section = []
    metrics_section.append(Spacer(1, 4))
    metrics_section.append(Paragraph("HEADLINE 12: QUANTITATIVE PERFORMANCE TARGETS & SYSTEM METRICS", section_heading))
    metrics_section.append(Spacer(1, 2))
    metrics_section.append(Paragraph(
        "PandaHub achieves strict operational benchmarks to guarantee speed, reliability, and low resource overhead.",
        section_desc
    ))
    metrics_section.append(Spacer(1, 5))

    metric_rows = []
    # Header row
    metric_rows.append([
        Paragraph("Metric / Target Area", table_head_style),
        Paragraph("Benchmark Goal", table_head_style),
        Paragraph("Simple English Significance", table_head_style),
    ])

    for row in METRICS_DATA[1:]:
        metric_rows.append([
            Paragraph(f"<b>{row[0]}</b>", table_cell_bold),
            Paragraph(row[1], table_cell_bold),
            Paragraph(row[2], table_cell_style),
        ])

    metrics_table = Table(metric_rows, colWidths=[140, 110, 290])
    metrics_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1120")),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    metrics_section.append(metrics_table)
    story.append(KeepTogether(metrics_section))
    story.append(Spacer(1, 8))

    # ═════════════════════════════════════════════════════════════════════════
    # 4. TANGIBLE DELIVERABLE ARTIFACTS MATRIX
    # ═════════════════════════════════════════════════════════════════════════

    deliv_section = []
    deliv_section.append(Paragraph("HEADLINE 13: SUMMARY OF TANGIBLE DELIVERABLE ARTIFACTS", section_heading))
    deliv_section.append(Spacer(1, 2))
    deliv_section.append(Paragraph(
        "A complete inventory of the actual software codebases, services, and assets delivered in the PandaHub repository.",
        section_desc
    ))
    deliv_section.append(Spacer(1, 5))

    deliv_rows = []
    deliv_rows.append([
        Paragraph("Deliverable Component", table_head_style),
        Paragraph("Delivered Artifact", table_head_style),
        Paragraph("Status", table_head_style),
        Paragraph("Simple English Summary", table_head_style),
    ])

    for row in DELIVERABLES_MATRIX[1:]:
        deliv_rows.append([
            Paragraph(f"<b>{row[0]}</b>", table_cell_bold),
            Paragraph(row[1], table_cell_style),
            Paragraph(f"<b>{row[2]}</b>", table_badge_green),
            Paragraph(row[3], table_cell_style),
        ])

    deliv_table = Table(deliv_rows, colWidths=[110, 150, 45, 235])
    deliv_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1120")),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    deliv_section.append(deliv_table)
    story.append(KeepTogether(deliv_section))
    story.append(Spacer(1, 8))

    # ═════════════════════════════════════════════════════════════════════════
    # 5. CONCLUSION CALLOUT BOX
    # ═════════════════════════════════════════════════════════════════════════

    conclusion_text = (
        "<b>Final Conclusion & Future Roadmap:</b> "
        "The primary expected outcome of the PandaHub project is an independent, developer-first platform that unites code hosting, "
        "artificial intelligence assistance, and student startup collaboration under one roof. "
        "By packaging the entire ecosystem into clean Docker containers with a modern Next.js frontend and a modular FastAPI backend, "
        "PandaHub succeeds in democratizing software engineering infrastructure for universities, developer communities, and emerging startups worldwide."
    )
    conclusion_table = Table([[Paragraph(conclusion_text, section_desc)]], colWidths=[540])
    conclusion_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(KeepTogether([conclusion_table]))

    # Build the document using the custom two-pass canvas
    doc.build(story, canvasmaker=PandaExpectedCanvas)
    print(f"Successfully generated PDF: {output_path}")

    # Synchronize to Desktop workspace if it exists
    alt_dest_dir = r"c:\Users\ravit\OneDrive\Desktop\pandahub"
    if os.path.exists(alt_dest_dir):
        alt_dest = os.path.join(alt_dest_dir, os.path.basename(output_path))
        shutil.copy2(output_path, alt_dest)
        print(f"Synchronized PDF to Desktop workspace: {alt_dest}")

if __name__ == "__main__":
    out_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PandaHub_Expected_Outcomes_and_Outputs.pdf")
    build_pdf(out_file)
