"""
PandaHub Major Usage & Functional Outputs Guide Generator
Generates an executive-grade, beautifully formatted 4-page PDF documenting the real-world
USAGE and FUNCTIONAL OUTPUTS of PandaHub (focusing strictly on usage, workflows, and results,
with no focus on UI design or styling).
"""

import os
import shutil
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
    PageBreak,
)
from reportlab.pdfgen import canvas

# ─────────────────────────────────────────────────────────────────────────────
# Custom NumberedCanvas for Running Headlines & Dynamic "Page X of Y"
# ─────────────────────────────────────────────────────────────────────────────

class PandaUsageCanvas(canvas.Canvas):
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
            # First page accent banner
            self.setFillColor(navy_dark)
            self.rect(0, page_height - 6, page_width, 6, fill=True, stroke=False)
            self.setFillColor(green_accent)
            self.rect(0, page_height - 6, 140, 6, fill=True, stroke=False)
        else:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(navy_dark)
            self.drawString(36, page_height - 28, "PANDAHUB MAJOR USAGE & FUNCTIONAL OUTPUTS GUIDE")

            self.setFont("Helvetica", 8)
            self.setFillColor(slate_text)
            self.drawString(290, page_height - 28, "-- Practical Workflows & User Deliverables")

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
        self.drawString(165, 24, "|  Major Usage & Functional Output Report  |  Simple English Edition")

        page_str = f"Page {page_num} of {total_pages}"
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(navy_dark)
        self.drawRightString(page_width - 36, 24, page_str)

        self.restoreState()


# ─────────────────────────────────────────────────────────────────────────────
# Usage Headlines Data: Real-World Usage & Concrete Outputs Produced
# ─────────────────────────────────────────────────────────────────────────────

PAGE_1_HEADLINES = [
    {
        "headline_num": "USAGE OUTPUT 01",
        "category": "CODE HOSTING & VERSION CONTROL",
        "color": "#0284C7",
        "title": "Centralized Code Storage, Version Backup & History Tracking",
        "usage_action": "How it is used: A developer writes software on their local computer and pushes their project to PandaHub.",
        "points": [
            ("Safe Cloud Code Storage", "Users securely store all project files and folders online in an organized, versioned repository."),
            ("Complete History Tracking", "Every change saved creates a permanent record showing exactly who modified which line of code and when."),
            ("Team Branching & Safe Merging", "Developers create separate branches to test new features without risking or breaking the main working software."),
            ("Instant Code Rollback", "If a bug is introduced, users can revert to any past commit with one command, eliminating data loss."),
            ("Direct Code Downloading", "Collaborators can download the entire repository as a ZIP archive or clone it to their local machine in seconds."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 02",
        "category": "AUTOMATED CODE REVIEW",
        "color": "#8B5CF6",
        "title": "Automated AI Code Quality & Pull Request Review",
        "usage_action": "How it is used: A team member proposes code changes by submitting a Pull Request (PR) for review.",
        "points": [
            ("Automated Bug Detection", "The built-in AI automatically reviews incoming code line-by-line, highlighting hidden logic errors before code is merged."),
            ("Plain-English Change Summaries", "The system generates clear, non-technical explanations of complex code diffs so the whole team understands what changed."),
            ("Performance & Security Tips", "The AI gives specific, actionable suggestions on how to make code faster, cleaner, and less vulnerable to crashes."),
            ("Instant Junior Developer Mentorship", "Beginner coders receive real-time guidance teaching them industry coding standards on every commit."),
            ("Faster Code Approval Times", "Senior developers save hours of manual review time because the AI handles routine checks upfront."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 03",
        "category": "INTELLIGENT REPOSITORY ASSISTANT",
        "color": "#6366F1",
        "title": "Interactive AI Chat for Instant Codebase Understanding",
        "usage_action": "How it is used: A developer or student joins a project and wants to understand how the system works.",
        "points": [
            ("Natural Language Question Answering", "Users type plain questions like 'How does user login work?' or 'Where are database models defined?'"),
            ("Accurate Code References", "The AI reads the repository files and quotes the exact files and functions that answer the question."),
            ("Rapid Developer Onboarding", "New contributors understand large codebases in minutes instead of spending days reading thousands of lines manually."),
            ("Debugging Assistance", "Users paste error messages or stack traces into the chat to get instant explanations and proposed bug fixes."),
            ("API Explanation & Examples", "Developers ask how to call specific endpoints or functions and receive ready-to-use code examples."),
        ]
    },
]

PAGE_2_HEADLINES = [
    {
        "headline_num": "USAGE OUTPUT 04",
        "category": "TEAM COLLABORATION & TRACKING",
        "color": "#F59E0B",
        "title": "Bug Tracking, Milestone Management & Team Workflows",
        "usage_action": "How it is used: Teams coordinate tasks, report software defects, and organize project release schedules.",
        "points": [
            ("Centralized Issue Tracking", "Users log bug reports and feature requests with clear labels, priorities, descriptions, and assignees."),
            ("Milestone & Deadline Tracking", "Teams group tasks into milestone goals with visual progress bars showing the percentage of work completed."),
            ("Side-by-Side Pull Request Reviews", "Reviewers inspect line-by-line code additions (green) and deletions (red), leaving comments on specific code lines."),
            ("Community Discussion Forums", "Teams brainstorm architectural ideas, share developer guides, and post announcements in open community threads."),
            ("Real-Time Status Notifications", "Engineers receive instant alerts whenever someone assigns them an issue, approves a review, or mentions them."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 05",
        "category": "AUTOMATED SECURITY GATE",
        "color": "#EF4444",
        "title": "Leaked Secret Prevention & Dependency Vulnerability Audits",
        "usage_action": "How it is used: The system automatically scans every commit and branch before code is allowed into production.",
        "points": [
            ("Secret & Password Leak Blocking", "The scanner catches accidentally committed API keys, database passwords, and private tokens before they are made public."),
            ("Insecure Library Alerts (CVEs)", "Analyzes dependencies in requirements.txt or package.json and warns if any third-party library has known vulnerabilities."),
            ("Protected Production Branches", "Locks the main branch so no single person can accidentally overwrite or delete production code without reviews."),
            ("Code Quality Scoring", "Assigns an automated security and cleanliness grade to ensure code meets security standards before deployment."),
            ("Risk Mitigation for Organizations", "Protects universities, labs, and companies from data breaches caused by careless developer commits."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 06",
        "category": "VENTURE & TALENT ECOSYSTEM",
        "color": "#EC4899",
        "title": "Student Startup Showcase & Talent Recruitment (Startups Hub)",
        "usage_action": "How it is used: Student founders and indie developers pitch their software projects to find teammates and mentors.",
        "points": [
            ("Public Venture Discovery", "Innovators create a public startup page showcasing their product, pitch, demo links, and live Git repository."),
            ("Stage-Based Project Filtering", "Visitors explore ventures by maturity level: Idea Stage, Working Prototype (MVP), or Scaling Platform."),
            ("Co-Founder & Teammate Recruitment", "Project creators post specific open roles (e.g., 'Looking for a React developer' or 'Need a PyTorch engineer')."),
            ("Peer Upvoting & Feedback", "Fellow students and mentors upvote innovative ideas and leave constructive feedback to help projects grow."),
            ("Bridging Code to Real Businesses", "Transforms raw software repositories into tangible entrepreneurial ventures with an active community."),
        ]
    },
]

PAGE_3_HEADLINES = [
    {
        "headline_num": "USAGE OUTPUT 07",
        "category": "TERMINAL DEVELOPER OPERATIONS",
        "color": "#06B6D4",
        "title": "Fast Command-Line Operations via Panda CLI Engine",
        "usage_action": "How it is used: Developers work directly inside their terminal prompt without opening a web browser.",
        "points": [
            ("One-Command Repository Creation", "Developers run simple terminal commands to create remote repositories and link their local folders instantly."),
            ("Single-Command Authentication", "Connects a laptop to PandaHub securely with a lightweight token without repetitive login passwords."),
            ("Local Pre-Push AI Reviews", "Engineers run an AI check locally on their uncommitted code before pushing to avoid embarrassment on PRs."),
            ("Fast Issue & PR Inspection", "Users view the status of open pull requests and assigned issues directly in their terminal window."),
            ("Cross-Platform Workflow", "Functions reliably across Windows PowerShell, macOS Terminal, and Linux shells with colored status output."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 08",
        "category": "INSTANT WEB PUBLISHING",
        "color": "#14B8A6",
        "title": "Automated Web Documentation & Portfolio Hosting (Panda Pages)",
        "usage_action": "How it is used: Developers push Markdown files or web content to publish live websites automatically.",
        "points": [
            ("Automatic Documentation Websites", "Turns project README and Markdown guides into clean, shareable web documentation with zero server setup."),
            ("Student Portfolio & Resume Hosting", "Developers host personal portfolios, project demos, and resumes under their own public platform URL."),
            ("Automatic Rebuild on Code Push", "Whenever new documentation is pushed to the repository branch, the live website rebuilds automatically."),
            ("Zero Hosting Maintenance", "Eliminates the need to buy third-party website hosting or configure external web servers."),
            ("Clean, Shareable Links", "Produces clean, secure web links that students can add to their resumes, LinkedIn, or pitch decks."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 09",
        "category": "ACCESS GOVERNANCE & AUDIT",
        "color": "#475569",
        "title": "Role-Based Access Control & Tamper-Proof Audit Logging",
        "usage_action": "How it is used: Project managers and administrators oversee team permissions and system activity.",
        "points": [
            ("Strict Role Permissions", "Assigns members specific access levels: Owner (full control), Maintainer, Contributor (write), or Reader (read-only)."),
            ("Tamper-Proof Audit Trails", "Logs sensitive actions like permission changes, repository deletions, and member invitations for accountability."),
            ("User Moderation & Account Controls", "Platform administrators suspend malicious actors and archive inactive or duplicate repositories."),
            ("Secure Single Sign-On (OAuth)", "Team members log in easily and safely using their existing Google or GitHub accounts or encrypted passwords."),
            ("Data Confidentiality Guarantee", "Private repositories are strictly shielded from unauthorized users with strict server-side access checks."),
        ]
    },
    {
        "headline_num": "USAGE OUTPUT 10",
        "category": "ON-PREMISE DEPLOYMENT",
        "color": "#10B981",
        "title": "Self-Hosted Deployment, Data Sovereignty & Zero SaaS Fees",
        "usage_action": "How it is used: An organization or university deploys PandaHub on their own local servers or private cloud.",
        "points": [
            ("One-Command Server Startup", "Deploys the complete platform (backend, frontend, database, Redis cache, Git engine) with docker-compose up."),
            ("100% Data Sovereignty", "All source code, proprietary algorithms, and AI queries remain inside the organization with zero external leaks."),
            ("Elimination of Monthly SaaS Bills", "Avoids recurring per-user monthly subscription fees charged by commercial hosting platforms."),
            ("Zero Cloud Lock-In", "Runs completely offline on local college lab computers, internal servers, or any public cloud provider."),
            ("Automated Database Safety", "Includes built-in database migration scripts (Alembic) to upgrade database structures safely without data loss."),
        ]
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Workflow Steps & Persona Matrix Data (For Page 4)
# ─────────────────────────────────────────────────────────────────────────────

WORKFLOW_STEPS_DATA = [
    ("Step 1: Write & Push Code", "Developer creates a branch and runs git push. Output: Code is safely stored in remote Git engine."),
    ("Step 2: Propose Changes (PR)", "Developer opens a Pull Request. Output: Automated AI code review report and plain-English summary."),
    ("Step 3: Security & Quality Check", "System scans commit automatically. Output: Immediate block of leaked secrets and vulnerability warnings."),
    ("Step 4: Review, Approve & Merge", "Teammates inspect diffs, comment, and merge. Output: Main branch updated cleanly with zero conflicts."),
    ("Step 5: Publish & Showcase", "Branch publishes docs to Panda Pages or Startup Hub. Output: Live documentation site and public venture profile."),
]

PERSONA_USAGE_DATA = [
    ("User Persona", "Primary Real-World Usage", "Tangible Output Produced"),
    (
        "Student Developer",
        "Pushes course assignments, runs local AI code reviews, hosts portfolio.",
        "Safe versioned code, instant AI feedback, and live portfolio website for resumes."
    ),
    (
        "Capstone / Team Project",
        "Collaborates on shared code, tracks bug issues, reviews teammate PRs.",
        "Clean, merged production codebase, assigned tasks, and milestone completion logs."
    ),
    (
        "Student Startup Founder",
        "Pitches project on Startups Hub, recruits coders, releases MVP updates.",
        "Public product showcase page, recruited team members, and user feedback."
    ),
    (
        "Professor / Evaluator",
        "Reviews student code submissions, commit frequency, and AI summaries.",
        "Clear timeline of who contributed what, commit histories, and code quality grades."
    ),
    (
        "University Lab / Org",
        "Runs on-premise Git server for entire department with private data.",
        "100% private, zero-cost code cloud with full role permissions and audit logs."
    ),
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

    # Typography styles
    cover_title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18.5,
        leading=22.5,
        textColor=colors.HexColor("#0B1120"),
    )

    cover_subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=13,
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
        fontSize=10.5,
        leading=13.5,
        textColor=colors.HexColor("#0B1120"),
    )

    section_desc = ParagraphStyle(
        "SectionDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
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
        fontSize=7.2,
        leading=9,
        textColor=colors.HexColor("#64748B"),
    )

    card_title_style = ParagraphStyle(
        "CardTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
    )

    card_action_style = ParagraphStyle(
        "CardAction",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.6,
        leading=10.5,
        textColor=colors.HexColor("#0369A1"),
    )

    bullet_lead_style = ParagraphStyle(
        "BulletLead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.6,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
    )

    bullet_text_style = ParagraphStyle(
        "BulletText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.6,
        leading=10.5,
        textColor=colors.HexColor("#334155"),
    )

    # Table styles
    table_head_style = ParagraphStyle(
        "TableHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=10,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.4,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.4,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    def render_headline_card(item, spacing_after=5):
        card_content = []
        top_header_data = [
            [
                Paragraph(f"{item['headline_num']} | {item['category']}", card_num_style),
                Paragraph(item['category'], card_badge_style)
            ]
        ]
        badge_hex = item.get("color", "#0284C7")
        top_header_table = Table(top_header_data, colWidths=[425, 101])
        top_header_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND", (1, 0), (1, 0), colors.HexColor(badge_hex)),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ]))
        card_content.append(top_header_table)
        card_content.append(Spacer(1, 1))

        card_content.append(Paragraph(item['title'], card_title_style))
        card_content.append(Spacer(1, 1))

        card_content.append(Paragraph(item['usage_action'], card_action_style))
        card_content.append(Spacer(1, 2.5))

        card_content.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceAfter=3, spaceBefore=0))

        for lead, desc in item['points']:
            bullet_row = [
                [
                    Paragraph("&bull;", bullet_lead_style),
                    Paragraph(f"<b>{lead}:</b> {desc}", bullet_text_style)
                ]
            ]
            bullet_table = Table(bullet_row, colWidths=[11, 515])
            bullet_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]))
            card_content.append(bullet_table)

        outer_table = Table([[card_content]], colWidths=[540])
        outer_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E2E8F0")),
            ("LINELEFT", (0, 0), (0, -1), 3.0, colors.HexColor(badge_hex)),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return KeepTogether([outer_table, Spacer(1, spacing_after)])

    story = []

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 1: COVER HEADER + METADATA + OVERVIEW + HEADLINES 01, 02, 03
    # ═════════════════════════════════════════════════════════════════════════

    badge_table = Table(
        [[Paragraph("PRACTICAL SYSTEM SPECIFICATION & WORKFLOW OUTPUTS REPORT", ParagraphStyle("Pill", fontName="Helvetica-Bold", fontSize=6.8, leading=8, textColor=colors.HexColor("#0284C7")))]],
        colWidths=[540],
    )
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E0F2FE")),
        ("PADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 3))

    story.append(Paragraph("PANDAHUB: MAJOR USAGE & FUNCTIONAL OUTPUTS", cover_title_style))
    story.append(Spacer(1, 1.5))
    story.append(Paragraph(
        "A practical, simple-English breakdown documenting how developers, teams, and students use PandaHub, and the exact outputs produced during daily operations (excluding UI design specifications).",
        cover_subtitle_style
    ))
    story.append(Spacer(1, 5))

    meta_data = [
        [
            Paragraph("<b>Platform Name:</b>", meta_label),
            Paragraph("PandaHub Developer & Collaboration Platform", meta_val),
            Paragraph("<b>Core Focus:</b>", meta_label),
            Paragraph("Real-World Usage, Workflows & Functional Outputs", meta_val),
        ],
        [
            Paragraph("<b>Primary Users:</b>", meta_label),
            Paragraph("Students, Software Engineers, Startup Founders", meta_val),
            Paragraph("<b>Language:</b>", meta_label),
            Paragraph("Simple English Points with Clear Headlines", meta_val),
        ],
        [
            Paragraph("<b>Key Outputs:</b>", meta_label),
            Paragraph("Git Repos, AI Review Logs, Issues, Live Websites", meta_val),
            Paragraph("<b>Deployment:</b>", meta_label),
            Paragraph("Self-Hosted, On-Premise or Cloud Docker Containers", meta_val),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[80, 190, 80, 190])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 5))

    overview_text = (
        "<b>What is this document about?</b> This report explains exactly <b>what users do with PandaHub</b> and <b>what outputs they receive</b>. "
        "It details how developers manage software code, how the AI reviews pull requests, how teams track tasks, and how student founders launch startups. "
        "Every headline below highlights a major practical use case and its concrete deliverables in simple, everyday English."
    )
    overview_table = Table([[Paragraph(overview_text, section_desc)]], colWidths=[540])
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#86EFAC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 6))

    for h in PAGE_1_HEADLINES:
        story.append(render_headline_card(h, spacing_after=5))

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 2: HEADLINES 04, 05, 06 (COLLABORATION, SECURITY, STARTUPS)
    # ═════════════════════════════════════════════════════════════════════════

    for h in PAGE_2_HEADLINES:
        story.append(render_headline_card(h, spacing_after=12))

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 3: HEADLINES 07, 08, 09, 10 (CLI, PAGES, RBAC, DEPLOYMENT)
    # ═════════════════════════════════════════════════════════════════════════

    for h in PAGE_3_HEADLINES:
        story.append(render_headline_card(h, spacing_after=5))

    story.append(PageBreak())

    # ═════════════════════════════════════════════════════════════════════════
    # PAGE 4: 5-STEP LIFECYCLE WORKFLOW + PERSONA MATRIX + CONCLUSION
    # ═════════════════════════════════════════════════════════════════════════

    # Section 11: Workflow
    story.append(Paragraph("HEADLINE 11: END-TO-END DAILY USAGE LIFECYCLE (5-STEP WORKFLOW)", section_heading))
    story.append(Spacer(1, 1.5))
    story.append(Paragraph(
        "A clear 5-step sequence illustrating how a developer interacts with PandaHub from first line of code to live release.",
        section_desc
    ))
    story.append(Spacer(1, 4))

    for title, desc in WORKFLOW_STEPS_DATA:
        flow_row = [
            [
                Paragraph("&bull;", bullet_lead_style),
                Paragraph(f"<b>{title}:</b> {desc}", bullet_text_style)
            ]
        ]
        flow_t = Table(flow_row, colWidths=[12, 528])
        flow_t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(flow_t)

    story.append(Spacer(1, 10))

    # Section 12: Persona Table
    story.append(Paragraph("HEADLINE 12: USER PERSONA USAGE & TANGIBLE DELIVERABLES MATRIX", section_heading))
    story.append(Spacer(1, 1.5))
    story.append(Paragraph(
        "How different stakeholders use PandaHub and the exact real-world outputs they produce.",
        section_desc
    ))
    story.append(Spacer(1, 4))

    persona_rows = []
    persona_rows.append([
        Paragraph("User Persona", table_head_style),
        Paragraph("Primary Real-World Usage", table_head_style),
        Paragraph("Tangible Output Produced", table_head_style),
    ])

    for row in PERSONA_USAGE_DATA[1:]:
        persona_rows.append([
            Paragraph(f"<b>{row[0]}</b>", table_cell_bold),
            Paragraph(row[1], table_cell_style),
            Paragraph(row[2], table_cell_style),
        ])

    persona_table = Table(persona_rows, colWidths=[115, 205, 220])
    persona_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1120")),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(persona_table)
    story.append(Spacer(1, 10))

    # Section 13: Summary Conclusion
    conclusion_text = (
        "<b>Summary of Real-World Output:</b> In everyday practice, PandaHub delivers a complete, independent developer hub. "
        "Users host their software securely without paid third-party subscriptions, get automatic AI reviews on every pull request, "
        "collaborate on bug tickets, publish live documentation pages, and recruit talent for student startup ventures. "
        "The end output is faster software delivery, higher code quality, and total ownership over intellectual property."
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
    story.append(conclusion_table)

    # Build document
    doc.build(story, canvasmaker=PandaUsageCanvas)
    print(f"Successfully generated PDF: {output_path}")

    # Synchronize to Desktop workspace if it exists
    alt_dest_dir = r"c:\Users\ravit\OneDrive\Desktop\pandahub"
    if os.path.exists(alt_dest_dir):
        alt_dest = os.path.join(alt_dest_dir, os.path.basename(output_path))
        shutil.copy2(output_path, alt_dest)
        print(f"Synchronized PDF to Desktop workspace: {alt_dest}")


if __name__ == "__main__":
    primary_pdf = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PandaHub_Major_Usage_and_Outputs_Guide.pdf")
    build_pdf(primary_pdf)

    general_pdf = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PandaHub_Expected_Outcomes_and_Outputs.pdf")
    build_pdf(general_pdf)
