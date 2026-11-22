"""
PandaHub PDF Documentation Generator (2-Line Simple English Edition)
Creates a beautifully formatted, executive-grade PDF documenting all 28 frontend pages of PandaHub.
Specifications:
  - Every page has a clear, prominent Headline (Title + Route + Category Badge)
  - Every page is explained in simple English in strictly 2 lines (Line 1 and Line 2)
  - Running headline header and page numbers on every single physical page of the PDF
"""

import os
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
)
from reportlab.pdfgen import canvas

# ─────────────────────────────────────────────────────────────────────────────
# Custom NumberedCanvas for Running Headlines & Footers on EVERY Page
# ─────────────────────────────────────────────────────────────────────────────

class PandaNumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that adds running headlines, document headers,
    and dynamic 'Page X of Y' footers to EVERY physical page of the PDF.
    """
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

        navy = colors.HexColor("#0B1120")
        slate_text = colors.HexColor("#64748B")
        green_accent = colors.HexColor("#00C853")
        border_color = colors.HexColor("#CBD5E1")

        # ── RUNNING HEADLINE / HEADER (Present on every page) ──
        if page_num == 1:
            self.setFillColor(navy)
            self.rect(0, page_height - 6, page_width, 6, fill=True, stroke=False)
            self.setFillColor(green_accent)
            self.rect(0, page_height - 6, 120, 6, fill=True, stroke=False)
        else:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(navy)
            self.drawString(36, page_height - 28, "PANDAHUB APPLICATION ARCHITECTURE")
            
            self.setFont("Helvetica", 8)
            self.setFillColor(slate_text)
            self.drawString(225, page_height - 28, "— Complete Web Application Pages Directory (Simple 2-Line Guide)")

            self.setFillColor(green_accent)
            self.circle(page_width - 42, page_height - 26, 3, fill=True, stroke=False)

            self.setStrokeColor(border_color)
            self.setLineWidth(0.6)
            self.line(36, page_height - 34, page_width - 36, page_height - 34)

        # ── RUNNING FOOTER (Present on every page) ──
        self.setStrokeColor(border_color)
        self.setLineWidth(0.6)
        self.line(36, 36, page_width - 36, 36)

        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))
        self.drawString(36, 24, "PandaHub Developer Platform")

        self.setFont("Helvetica", 8)
        self.setFillColor(slate_text)
        self.drawString(165, 24, "•  Internal System Specification  •  Next.js + FastAPI Architecture")

        page_str = f"Page {page_num} of {total_pages}"
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(navy)
        self.drawRightString(page_width - 36, 24, page_str)

        self.restoreState()


# ─────────────────────────────────────────────────────────────────────────────
# 28 Pages Data — Simple English in Exactly 2 Lines per Page
# ─────────────────────────────────────────────────────────────────────────────

PAGES_DATA = [
    # ── SECTION 1: Authentication & Onboarding Gateway ──
    {
        "section": "1. Authentication & Onboarding Gateway",
        "index": "PAGE 01",
        "badge": "PUBLIC / ENTRY",
        "badge_color": "#0284C7",
        "headline": "Landing Page (/) — Welcome & Platform Introduction",
        "lines": [
            ("What it is", "This is the main welcome page where visitors learn what PandaHub is and explore its key features."),
            ("How it works", "You can watch interactive animations, see quick terminal commands, and click to sign up or log in."),
        ]
    },
    {
        "section": "1. Authentication & Onboarding Gateway",
        "index": "PAGE 02",
        "badge": "AUTH / SESSIONS",
        "badge_color": "#0284C7",
        "headline": "Login Page (/(auth)/login) — Sign In to Your Account",
        "lines": [
            ("What it is", "This page lets existing users securely log into their PandaHub account using their email and password or Google/GitHub."),
            ("How it works", "Once signed in, you are safely authenticated and taken straight to your personal developer dashboard."),
        ]
    },
    {
        "section": "1. Authentication & Onboarding Gateway",
        "index": "PAGE 03",
        "badge": "ENROLLMENT",
        "badge_color": "#0284C7",
        "headline": "Register Page (/(auth)/register) — Create a New Account",
        "lines": [
            ("What it is", "This page allows new developers and teams to create a free account with their own unique username."),
            ("How it works", "It checks that your username is available and your password is strong before creating your profile."),
        ]
    },
    {
        "section": "1. Authentication & Onboarding Gateway",
        "index": "PAGE 04",
        "badge": "SECURITY",
        "badge_color": "#0284C7",
        "headline": "Reset Password Page (/(auth)/reset-password) — Recover Account Access",
        "lines": [
            ("What it is", "If you forget your password, this page helps you safely reset it by sending a recovery link to your email."),
            ("How it works", "You can type in a new secure password and immediately regain access to your account."),
        ]
    },
    {
        "section": "1. Authentication & Onboarding Gateway",
        "index": "PAGE 05",
        "badge": "FEDERATION",
        "badge_color": "#0284C7",
        "headline": "OAuth Callback Page (/oauth/callback) — Third-Party Sign-In Handler",
        "lines": [
            ("What it is", "This background screen smoothly finishes logging you in when you sign in through Google or GitHub."),
            ("How it works", "It shows a cute Panda loading animation while verifying your login and sending you to your dashboard."),
        ]
    },
    {
        "section": "1. Authentication & Onboarding Gateway",
        "index": "PAGE 06",
        "badge": "ONBOARDING",
        "badge_color": "#0284C7",
        "headline": "Onboarding Page (/onboarding) — Quick Welcome Setup",
        "lines": [
            ("What it is", "This page welcomes brand-new users with a quick 3-step walkthrough to get familiar with PandaHub."),
            ("How it works", "It introduces you to hosting code, joining startup projects, and collaborating with teams before you start."),
        ]
    },

    # ── SECTION 2: Developer Workspace & Community Hub ──
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 07",
        "badge": "WORKSPACE",
        "badge_color": "#10B981",
        "headline": "Developer Dashboard (/dashboard) — Your Personal Home Base",
        "lines": [
            ("What it is", "This is your daily homepage showing all your personal repositories, recent pull requests, and latest notifications."),
            ("How it works", "You can see what your teammates are working on and quickly create a new project with one click."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 08",
        "badge": "DISCOVERY",
        "badge_color": "#10B981",
        "headline": "Explore Page (/explore) — Discover Projects & Repositories",
        "lines": [
            ("What it is", "This page lets you browse public projects, trending code, and student innovations from around the community."),
            ("How it works", "You can search by programming language or topic tags to find inspiring open-source code and developers."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 09",
        "badge": "PROVISIONING",
        "badge_color": "#10B981",
        "headline": "Create Repository Page (/new) — Start a New Project",
        "lines": [
            ("What it is", "This simple form lets you create a new Git repository under your personal account or an organization."),
            ("How it works", "You can choose whether it is public or private and automatically add a README file with starter setup commands."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 10",
        "badge": "STARTUPS HUB",
        "badge_color": "#10B981",
        "headline": "Startups Hub (/startups) — Student & Indie Ventures Showcase",
        "lines": [
            ("What it is", "This page showcases exciting startup ventures, indie tools, and student ideas built directly on PandaHub."),
            ("How it works", "You can filter projects by stage (from Idea to MVP or Scaling) and find open team roles to join."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 11",
        "badge": "ORGANIZATION",
        "badge_color": "#10B981",
        "headline": "Profile Page (/[org]) — Public Developer & Team Portfolio",
        "lines": [
            ("What it is", "This is the public profile page showing an engineer's or team's bio, avatar, and top pinned repositories."),
            ("How it works", "Visitors can view your green contribution activity graph and click the follow button to track your updates."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 12",
        "badge": "SOCIAL GRAPH",
        "badge_color": "#10B981",
        "headline": "Followers Page (/[org]/followers) — People Following This Profile",
        "lines": [
            ("What it is", "This page lists all the community members and developers who follow this user or organization."),
            ("How it works", "You can browse their profile cards, read their bios, and follow them back with a single click."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 13",
        "badge": "SUBSCRIPTIONS",
        "badge_color": "#10B981",
        "headline": "Following Page (/[org]/following) — Profiles Followed by This User",
        "lines": [
            ("What it is", "This page shows the list of developers and organizations that this user is currently following."),
            ("How it works", "It helps you discover which creators and open-source teams this engineer keeps track of."),
        ]
    },
    {
        "section": "2. Developer Workspace & Community Hub",
        "index": "PAGE 14",
        "badge": "SETTINGS",
        "badge_color": "#10B981",
        "headline": "User Settings (/settings) — Manage Your Profile & Security",
        "lines": [
            ("What it is", "This page lets you update your personal details, change your profile picture, and write your bio."),
            ("How it works", "You can also change your password, add SSH keys for pushing code, and set up your notification preferences."),
        ]
    },

    # ── SECTION 3: Git Core & Version Control Engine ──
    {
        "section": "3. Git Core & Version Control Engine",
        "index": "PAGE 15",
        "badge": "GIT REPOSITORY",
        "badge_color": "#F59E0B",
        "headline": "Repository Overview (/[org]/[repo]) — Project Code & Readme",
        "lines": [
            ("What it is", "This is the main page of any project showing the files, latest commit message, and rendered README guide."),
            ("How it works", "You can switch branches, copy the Git clone URL to your computer, or download the project files."),
        ]
    },
    {
        "section": "3. Git Core & Version Control Engine",
        "index": "PAGE 16",
        "badge": "TREE BROWSER",
        "badge_color": "#F59E0B",
        "headline": "Code & File Browser (/[org]/[repo]/tree/...) — View Files & Folders",
        "lines": [
            ("What it is", "This page lets you click through folders and view any source code file with clear syntax highlighting."),
            ("How it works", "You can inspect line numbers, copy code snippets, or download raw files without cloning the repository."),
        ]
    },
    {
        "section": "3. Git Core & Version Control Engine",
        "index": "PAGE 17",
        "badge": "COMMIT LOG",
        "badge_color": "#F59E0B",
        "headline": "Commit History (/[org]/[repo]/commits) — Timeline of Code Changes",
        "lines": [
            ("What it is", "This page displays the complete chronological list of all saves (commits) made to this repository branch."),
            ("How it works", "You can see who wrote each change, when it was saved, and copy the unique commit ID to track revisions."),
        ]
    },
    {
        "section": "3. Git Core & Version Control Engine",
        "index": "PAGE 18",
        "badge": "FILE UPLOAD",
        "badge_color": "#F59E0B",
        "headline": "File Upload (/[org]/[repo]/upload) — Add Files Directly Online",
        "lines": [
            ("What it is", "This page allows you to easily add files to your project directly through the browser without using Git commands."),
            ("How it works", "Simply drag and drop your files, write a short commit message, and save them straight to your branch."),
        ]
    },
    {
        "section": "3. Git Core & Version Control Engine",
        "index": "PAGE 19",
        "badge": "DOCUMENTATION",
        "badge_color": "#F59E0B",
        "headline": "Project Documentation (/[org]/[repo]/pages) — Hosted Guides & Wikis",
        "lines": [
            ("What it is", "This page displays clean, formatted project guides and documentation written in simple Markdown."),
            ("How it works", "It gives developers a neat reading view with a table of contents to understand how to use the software."),
        ]
    },

    # ── SECTION 4: Collaboration, Pull Requests & AI Review Intelligence ──
    {
        "section": "4. Collaboration, Pull Requests & AI Review Intelligence",
        "index": "PAGE 20",
        "badge": "ISSUES",
        "badge_color": "#8B5CF6",
        "headline": "Issue Tracker (/[org]/[repo]/issues) — Bug Reports & Feature Requests",
        "lines": [
            ("What it is", "This page helps project owners and contributors track bugs, suggest new ideas, and manage to-do tasks."),
            ("How it works", "You can filter issues by open/closed status, assign teammates, and add colored labels like 'bug' or 'enhancement'."),
        ]
    },
    {
        "section": "4. Collaboration, Pull Requests & AI Review Intelligence",
        "index": "PAGE 21",
        "badge": "CODE REVIEW",
        "badge_color": "#8B5CF6",
        "headline": "Pull Requests Hub (/[org]/[repo]/pulls) — Review & Merge Code",
        "lines": [
            ("What it is", "This page lists all proposed code contributions waiting to be reviewed and merged into the main project."),
            ("How it works", "You can see who submitted each change, which branch it targets, and whether it has been approved."),
        ]
    },
    {
        "section": "4. Collaboration, Pull Requests & AI Review Intelligence",
        "index": "PAGE 22",
        "badge": "AI INTELLIGENCE",
        "badge_color": "#8B5CF6",
        "headline": "PR Detail & AI Review (/[org]/[repo]/pulls/[#]) — Inspect Diffs & AI Suggestions",
        "lines": [
            ("What it is", "This page shows the exact side-by-side code diffs along with an automated code review generated by AI."),
            ("How it works", "Team members can leave comments on lines of code and merge the approved changes into the project with one click."),
        ]
    },
    {
        "section": "4. Collaboration, Pull Requests & AI Review Intelligence",
        "index": "PAGE 23",
        "badge": "SECURITY ALERTS",
        "badge_color": "#8B5CF6",
        "headline": "Security & Alerts (/[org]/[repo]/security) — Vulnerability & Secret Scanning",
        "lines": [
            ("What it is", "This page automatically warns you if someone accidentally committed private API keys or vulnerable dependencies."),
            ("How it works", "It shows the exact file and line number so you can fix security issues before they cause harm."),
        ]
    },

    # ── SECTION 5: Enterprise Governance, Security & System Diagnostics ──
    {
        "section": "5. Enterprise Governance, Security & System Diagnostics",
        "index": "PAGE 24",
        "badge": "ADMINISTRATION",
        "badge_color": "#EC4899",
        "headline": "Admin Console (/admin) — Platform Management & User Overview",
        "lines": [
            ("What it is", "This dashboard gives platform administrators full visibility over total users, active accounts, and hosted repositories."),
            ("How it works", "Admins can search for users, view their status, and manage platform permissions from one centralized place."),
        ]
    },
    {
        "section": "5. Enterprise Governance, Security & System Diagnostics",
        "index": "PAGE 25",
        "badge": "TELEMETRY",
        "badge_color": "#EC4899",
        "headline": "Error Telemetry (/admin/errors) — Live Server Error Monitor",
        "lines": [
            ("What it is", "This diagnostics page tracks real-time system crashes and server errors happening across the PandaHub platform."),
            ("How it works", "Engineers can view error severity badges and stack traces to quickly fix bugs and keep the website running smoothly."),
        ]
    },
    {
        "section": "5. Enterprise Governance, Security & System Diagnostics",
        "index": "PAGE 26",
        "badge": "DESIGN SYSTEM",
        "badge_color": "#EC4899",
        "headline": "Design System (/design-system) — Living UI Component Showcase",
        "lines": [
            ("What it is", "This showcase page demonstrates all the reusable buttons, cards, inputs, and badges used across PandaHub."),
            ("How it works", "It helps developers and designers build new features quickly with consistent colors, styling, and dark mode."),
        ]
    },
    {
        "section": "5. Enterprise Governance, Security & System Diagnostics",
        "index": "PAGE 27",
        "badge": "RBAC / 403",
        "badge_color": "#EC4899",
        "headline": "Access Denied (/forbidden) — 403 Permission Boundary",
        "lines": [
            ("What it is", "This screen appears whenever a user tries to open a private repository or admin area they do not have access to."),
            ("How it works", "It politely explains that permission is required and gives you a button to head back to your dashboard."),
        ]
    },
    {
        "section": "5. Enterprise Governance, Security & System Diagnostics",
        "index": "PAGE 28",
        "badge": "FALLBACK / 404",
        "badge_color": "#EC4899",
        "headline": "Page Not Found (/not-found) — 404 Missing Route Recovery",
        "lines": [
            ("What it is", "This friendly page displays when you visit a link, repository, or user handle that does not exist."),
            ("How it works", "It features a cute Panda illustration along with quick links to help you navigate back to Explore or Home."),
        ]
    },
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

    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0B1120"),
    )

    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#475569"),
    )

    meta_label_style = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    meta_val_style = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )

    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0B1120"),
    )

    section_sub_style = ParagraphStyle(
        "SectionSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#64748B"),
    )

    headline_style = ParagraphStyle(
        "HeadlineStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
    )

    badge_style = ParagraphStyle(
        "BadgeStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.5,
        leading=8,
        textColor=colors.white,
        alignment=1,
    )

    index_style = ParagraphStyle(
        "IndexStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.2,
        leading=9,
        textColor=colors.HexColor("#00C853"),
    )

    line_num_style = ParagraphStyle(
        "LineNum",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
    )

    line_text_style = ParagraphStyle(
        "LineText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
    )

    story = []

    # ── Top Banner ──
    banner_data = [
        [
            Paragraph("🐼 <b>PANDAHUB APPLICATION ARCHITECTURE</b>", title_style),
            Paragraph("<font color='#00C853'>●</font> <b>SIMPLE 2-LINE GUIDE</b>", ParagraphStyle(
                "RightPill", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10,
                textColor=colors.HexColor("#0B1120"), alignment=2
            ))
        ],
        [
            Paragraph(
                "<b>Complete System Directory:</b> Architectural reference documenting all <b>28 frontend routes</b> in the PandaHub codebase. "
                "Every page features a clear headline and is explained in <b>simple, plain English in exactly 2 lines</b> (what it is and how it works).",
                subtitle_style
            ),
            ""
        ]
    ]

    banner_table = Table(banner_data, colWidths=[420, 120])
    banner_table.setStyle(TableStyle([
        ('SPAN', (0, 1), (1, 1)),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 6))

    # ── Metadata Grid ──
    meta_data = [
        [
            Paragraph("<b>Total Documented Pages:</b>", meta_label_style),
            Paragraph("28 Active Routes", meta_val_style),
            Paragraph("<b>Stack Architecture:</b>", meta_label_style),
            Paragraph("Next.js 14 App Router + TailwindCSS", meta_val_style),
        ],
        [
            Paragraph("<b>Backend API Layer:</b>", meta_label_style),
            Paragraph("FastAPI 0.115 + PostgreSQL + Qdrant", meta_val_style),
            Paragraph("<b>Format Specification:</b>", meta_label_style),
            Paragraph("1 Headline + Simple English in 2 Lines", meta_val_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[120, 150, 120, 150])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # ── Page Iteration ──
    current_section = ""

    for page_info in PAGES_DATA:
        sec = page_info["section"]

        if sec != current_section:
            current_section = sec
            story.append(Spacer(1, 4))
            
            sec_table_data = [
                [
                    Paragraph(f"<b>{sec.upper()}</b>", section_heading_style),
                    Paragraph("Routes Catalog", section_sub_style)
                ]
            ]
            sec_table = Table(sec_table_data, colWidths=[420, 120])
            sec_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LINEBELOW', (0, 0), (-1, -1), 1.2, colors.HexColor("#0B1120")),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))
            story.append(sec_table)
            story.append(Spacer(1, 4))

        # ── Construct the 2-Line Page Card ──
        badge_bg = colors.HexColor(page_info["badge_color"])

        card_header_data = [
            [
                Paragraph(f"<b>{page_info['index']}</b>", index_style),
                Paragraph(f"<b>{page_info['headline']}</b>", headline_style),
                Paragraph(f"<b>{page_info['badge']}</b>", badge_style)
            ]
        ]
        card_header_table = Table(card_header_data, colWidths=[52, 408, 80])
        card_header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ('BACKGROUND', (2, 0), (2, 0), badge_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))

        # 2 Lines content table
        lines_data = []
        for line_idx, (label, text) in enumerate(page_info["lines"], 1):
            lines_data.append([
                Paragraph(f"<b>Line {line_idx}</b>", line_num_style),
                Paragraph(f"<b>[{label}]</b> {text}", line_text_style)
            ])

        lines_table = Table(lines_data, colWidths=[46, 494])
        lines_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('LINEBELOW', (0, 0), (-1, -2), 0.3, colors.HexColor("#F1F5F9")),
        ]))

        full_card_data = [
            [card_header_table],
            [lines_table]
        ]
        full_card = Table(full_card_data, colWidths=[540])
        full_card.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.7, colors.HexColor("#CBD5E1")),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor("#FFFFFF")),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))

        story.append(KeepTogether(full_card))
        story.append(Spacer(1, 3.5))

    doc.build(story, canvasmaker=PandaNumberedCanvas)
    print(f"Successfully generated PDF: {output_path}")

if __name__ == "__main__":
    out_dir = r"c:\Users\ravit\Downloads\Pandahub"
    pdf_filename = "PandaHub_All_Pages_Architecture_Guide.pdf"
    target_path = os.path.join(out_dir, pdf_filename)
    build_pdf(target_path)
