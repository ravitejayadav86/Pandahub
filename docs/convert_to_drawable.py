import os
import xml.etree.ElementTree as ET
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# -----------------------------------------------------------------------------
# 1. GENERATE DRAW.IO XML (.drawio file)
# -----------------------------------------------------------------------------
def generate_drawio_file(output_path):
    mxfile = ET.Element('mxfile', {
        'host': 'app.diagrams.net',
        'modified': '2026-10-04T21:00:00.000Z',
        'agent': 'PandaHub Architecture Generator',
        'version': '24.7.17',
        'type': 'device'
    })
    diagram = ET.SubElement(mxfile, 'diagram', {
        'id': 'pandahub-system-architecture',
        'name': 'PandaHub System Architecture'
    })
    model = ET.SubElement(diagram, 'mxGraphModel', {
        'dx': '1422',
        'dy': '794',
        'grid': '1',
        'gridSize': '10',
        'guides': '1',
        'tooltips': '1',
        'connect': '1',
        'arrows': '1',
        'fold': '1',
        'page': '1',
        'pageScale': '1',
        'pageWidth': '1400',
        'pageHeight': '920',
        'background': '#EEF4EF',
        'math': '0',
        'shadow': '0'
    })
    root = ET.SubElement(model, 'root')
    
    ET.SubElement(root, 'mxCell', {'id': '0'})
    ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})

    def add_node(id, value, style, x, y, width, height):
        cell = ET.SubElement(root, 'mxCell', {
            'id': id,
            'value': value,
            'style': style,
            'vertex': '1',
            'parent': '1'
        })
        ET.SubElement(cell, 'mxGeometry', {
            'x': str(x),
            'y': str(y),
            'width': str(width),
            'height': str(height),
            'as': 'geometry'
        })
        return cell

    def add_edge(id, value, source, target, style, points=None):
        edge = ET.SubElement(root, 'mxCell', {
            'id': id,
            'value': value,
            'style': style,
            'edge': '1',
            'parent': '1',
            'source': source,
            'target': target
        })
        geom = ET.SubElement(edge, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
        if points:
            pts_elem = ET.SubElement(geom, 'Array', {'as': 'points'})
            for px, py in points:
                ET.SubElement(pts_elem, 'mxPoint', {'x': str(px), 'y': str(py)})
        return edge

    # Header Banner
    # Header Banner
    add_node('hdr_bg', '', 'rounded=0;whiteSpace=wrap;html=1;fillColor=#0F172A;strokeColor=none;', 0, 0, 1400, 90)
    add_node('hdr_txt1', 'Template Gallery  /  PandaHub Modular System Architecture', 'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=12;fontColor=#94A3B8;fontStyle=1;', 40, 15, 600, 25)
    add_node('hdr_txt2', 'PandaHub Cloud Platform System Architecture', 'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=22;fontColor=#FFFFFF;fontStyle=1;', 40, 42, 600, 35)
    add_node('hdr_btn', 'Production Ready', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#0F172A;fontSize=11;fontColor=#0F172A;fontStyle=1;', 1220, 28, 140, 36)

    # Styles (Clean Black & White Monochrome Aesthetic)
    box_white = "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.8;fontSize=11;fontStyle=1;fontColor=#0F172A;"
    box_rounded = "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.8;fontSize=11;fontStyle=1;fontColor=#0F172A;"
    box_sub = "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#0F172A;strokeWidth=1.5;fontSize=10;fontStyle=1;fontColor=#0F172A;"
    cyl_gray = "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#F8FAFC;strokeColor=#0F172A;strokeWidth=1.8;fontSize=11;fontStyle=1;fontColor=#0F172A;"
    container_dashed = "swimlane;startSize=30;rounded=0;html=1;fillColor=#F8FAFC;strokeColor=#0F172A;strokeWidth=2;dashed=1;fontSize=12;fontStyle=1;fontColor=#0F172A;"
    edge_style = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#0F172A;strokeWidth=1.8;fontSize=9;fontColor=#0F172A;fontStyle=1;"

    # Nodes
    add_node('developer', '<b>Developer Workstation</b><br/><span style="font-size:9px;font-weight:normal;">Local Git Client & Browser</span>', box_white, 40, 130, 180, 90)
    add_node('client_app', '<b>Frontend & CLI</b><br/><span style="font-size:9px;font-weight:normal;">Next.js 14 App Router & Panda CLI</span>', box_white, 270, 130, 200, 90)
    add_node('api_gateway', '<b>FastAPI Modular Monolith Core</b><br/><span style="font-size:9px;font-weight:normal;">REST Gateway, WebSocket Server,<br/>Exception Buffer & Request-ID</span>', box_white, 530, 130, 330, 90)
    add_node('cloud_b2', '<b>Backblaze B2 / MinIO Storage</b><br/><span style="font-size:9px;font-weight:normal;">S3-Compatible Cloud Storage<br/>Bare Git Archives & Avatars</span>', box_rounded, 1070, 130, 270, 90)

    add_node('db_postgres', '<b>PostgreSQL Database</b><br/><span style="font-size:9px;font-weight:normal;">38+ Relational Tables<br/>(Users, Orgs, Issues, PRs, Startups)</span>', cyl_gray, 50, 300, 220, 150)
    add_node('git_engine', '<b>Git Smart-HTTP Engine</b><br/><span style="font-size:9px;font-weight:normal;">git-http-backend Process<br/>PAT/JWT Auth & Push Hooks</span>', box_white, 330, 320, 220, 110)
    add_node('bare_git', '<b>Bare Git Repositories</b><br/><span style="font-size:9px;font-weight:normal;">Local Disk (/data/repositories)<br/>PyGit2 & libgit2</span>', cyl_gray, 620, 300, 200, 150)

    add_node('cont_ai', 'Unit of AI Code Intelligence & Hybrid Routing', container_dashed, 910, 260, 430, 390)
    add_node('ai_class', '<b>Heuristic Diff Classifier</b><br/><span style="font-size:9px;font-weight:normal;">AST & Metadata Pass (Functional, Refactor, Docs, Disc)</span>', box_sub, 940, 310, 370, 70)
    add_node('ai_router', '<b>Specialist Model Dispatch (k=3)</b><br/><span style="font-size:9px;font-weight:normal;">Qwen2.5-Coder-32B & Mistral-7B (Majority Voting)</span>', box_sub, 940, 410, 370, 70)
    add_node('ai_rag', '<b>Qdrant Vector Database</b><br/><span style="font-size:9px;font-weight:normal;">384-d all-MiniLM-L6-v2 Embeddings (Review Memory)</span>', box_sub, 940, 510, 370, 90)

    add_node('redis_broker', '<b>Redis In-Memory Broker</b><br/><span style="font-size:9px;font-weight:normal;">Pub/Sub, WebSocket Rooms,<br/>Celery Queue State</span>', cyl_gray, 50, 500, 220, 150)
    add_node('celery_worker', '<b>Celery Task Worker</b><br/><span style="font-size:9px;font-weight:normal;">Email, Pages Builder,<br/>Secret Scanner & CVE Scanner</span>', box_white, 330, 520, 240, 110)

    add_node('tools_bg', '<b>Core Platform Technologies:</b> Next.js 14 (Frontend)  •  FastAPI (Backend)  •  PostgreSQL 16 (DB)  •  Redis & Celery (Broker/Worker)  •  Claude AI & Qwen (Intelligence)  •  PyGit2 & Backblaze B2 (Storage)  •  Docker & Render (PaaS)', 
             'rounded=1;whiteSpace=wrap;html=1;fillColor=#F8FAFC;strokeColor=#0F172A;strokeWidth=1.5;fontSize=10;fontColor=#0F172A;',
             40, 700, 1300, 45)

    # Connections
    add_edge('e1', 'Terminal & UI', 'developer', 'client_app', edge_style)
    add_edge('e2', 'HTTPS REST & WS', 'client_app', 'api_gateway', edge_style)
    add_edge('e3', 'Static Media & Assets', 'api_gateway', 'cloud_b2', edge_style)
    add_edge('e4', 'git push/pull (Basic Auth)', 'developer', 'git_engine', edge_style, [(130, 250), (440, 250)])
    add_edge('e5', 'Async ORM Queries', 'api_gateway', 'db_postgres', edge_style, [(600, 250), (160, 250)])
    add_edge('e6', 'Repo CRUD & Perms', 'api_gateway', 'git_engine', edge_style)
    add_edge('e7', 'PyGit2 Write', 'git_engine', 'bare_git', edge_style)
    add_edge('e8', 'Push Archival & Restore', 'bare_git', 'cloud_b2', edge_style, [(720, 260), (1205, 260)])
    add_edge('e9', 'PR Diffs for Review', 'api_gateway', 'ai_class', edge_style, [(780, 230), (1125, 230)])
    add_edge('e10', 'Diff Category', 'ai_class', 'ai_router', edge_style)
    add_edge('e11', 'Vector Similarity', 'ai_router', 'ai_rag', edge_style)
    add_edge('e12', 'Persist Synthetic Reviews', 'ai_rag', 'db_postgres', edge_style, [(910, 560), (690, 560), (690, 470), (160, 470)])
    add_edge('e13', 'Enqueue Async Tasks', 'api_gateway', 'celery_worker', edge_style, [(640, 230), (640, 490), (450, 490)])
    add_edge('e14', 'Task Queue State', 'celery_worker', 'redis_broker', edge_style)
    add_edge('e15', 'Cache Invalidation', 'db_postgres', 'redis_broker', edge_style)
    add_edge('e16', 'Real-time WebSocket Events', 'redis_broker', 'client_app', edge_style, [(30, 575), (30, 175)])

    xml_str = ET.tostring(mxfile, encoding='utf-8')
    import xml.dom.minidom
    dom = xml.dom.minidom.parseString(xml_str)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(dom.toprettyxml(indent="  "))
    print(f"Generated editable Draw.io XML file at: {output_path}")

# -----------------------------------------------------------------------------
# 2. GENERATE PERFECT HIGH-RES DRAWABLE ARCHITECTURE IMAGE (.png)
# -----------------------------------------------------------------------------
def draw_cylinder(ax, x, y, width, height, facecolor='#F1F5F9', topcolor='#E2E8F0', edgecolor='#0F172A', lw=1.8):
    """Draw a 3D-styled database cylinder matching the black-and-white architectural theme."""
    r = height * 0.16
    rect = patches.Rectangle((x, y + r), width, height - r * 2, facecolor=facecolor, edgecolor='none')
    ax.add_patch(rect)
    
    ax.plot([x, x], [y + r, y + height - r], color=edgecolor, lw=lw, solid_capstyle='round')
    ax.plot([x + width, x + width], [y + r, y + height - r], color=edgecolor, lw=lw, solid_capstyle='round')
    
    pts = []
    for deg in np.linspace(np.pi, 2*np.pi, 60):
        pts.append([x + width/2 + (width/2)*np.cos(deg), y + r + r*np.sin(deg)])
    pts.append([x + width, y + r])
    pts.append([x, y + r])
    poly_bot = patches.Polygon(pts, facecolor=facecolor, edgecolor='none')
    ax.add_patch(poly_bot)
    
    bottom_arc = patches.Arc((x + width/2, y + r), width, r * 2, angle=0, theta1=180, theta2=360, color=edgecolor, lw=lw)
    ax.add_patch(bottom_arc)
    
    top_ellipse = patches.Ellipse((x + width/2, y + height - r), width, r * 2, facecolor=topcolor, edgecolor=edgecolor, lw=lw)
    ax.add_patch(top_ellipse)

def draw_stepped_arrow(ax, points, label=None, label_pos=None, label_align='center', label_valign='bottom', color='#0F172A', lw=1.6):
    """Draw a clean orthogonal/stepped arrow with labeled text annotation."""
    for i in range(len(points) - 2):
        p1 = points[i]
        p2 = points[i+1]
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=color, lw=lw, solid_capstyle='round')
    
    p_prev = points[-2]
    p_last = points[-1]
    ax.annotate("", xy=p_last, xytext=p_prev,
                arrowprops=dict(arrowstyle="-|>", color=color, lw=lw, mutation_scale=13))
    
    if label and label_pos:
        ax.text(label_pos[0], label_pos[1], label, fontsize=7.2, fontweight='semibold',
                ha=label_align, va=label_valign, color='#0F172A',
                bbox=dict(boxstyle="square,pad=0.14", facecolor='#FFFFFF', edgecolor='#CBD5E1', alpha=0.96))

def create_complete_drawable_diagram(output_path):
    fig, ax = plt.subplots(figsize=(16, 11), dpi=220)
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 11)
    ax.axis('off')
    
    # Canvas background - pure clean white
    canvas_bg = patches.Rectangle((0, 0), 16, 9.4, facecolor='#FFFFFF', edgecolor='none')
    ax.add_patch(canvas_bg)
    
    # Header Banner - Solid Black (#0F172A)
    banner = patches.Rectangle((0, 9.4), 16, 1.6, facecolor='#0F172A', edgecolor='none')
    ax.add_patch(banner)
    
    ax.text(0.7, 10.55, "Template Gallery  /  PandaHub Modular System Architecture", 
            fontsize=11.5, color='#94A3B8', fontweight='medium', fontfamily='sans-serif')
    ax.text(0.7, 9.85, "PandaHub Cloud Platform System Architecture", 
            fontsize=21, color='white', fontweight='bold', fontfamily='sans-serif')
    
    btn = patches.FancyBboxPatch((13.3, 9.85), 2.0, 0.65, boxstyle="round,pad=0.08,rounding_size=0.12",
                                facecolor='white', edgecolor='#0F172A', lw=1.2)
    ax.add_patch(btn)
    ax.text(14.3, 10.17, "Production Ready", fontsize=9.5, color='#0F172A', 
            fontweight='bold', ha='center', va='center', fontfamily='sans-serif')
    
    EC = '#0F172A' # Dark black/slate border
    LW = 1.8       # Line width
    
    # -------------------------------------------------------------
    # TIER 1: DEVELOPER & CLIENT (TOP LEFT)
    # -------------------------------------------------------------
    # Developer workstation: x in [0.7, 2.3]
    b_dev = patches.Rectangle((0.7, 7.3), 1.6, 1.5, facecolor='#FFFFFF', edgecolor=EC, lw=LW)
    ax.add_patch(b_dev)
    ax.text(1.5, 8.2, "Developer", fontsize=10.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(1.5, 7.65, "(Workstation &\nLocal Git Client)", fontsize=7.2, ha='center', va='center', color='#334155')
    
    # Client Applications (Next.js 14 & CLI): x in [3.5, 5.2]
    b_client = patches.Rectangle((3.5, 7.3), 1.7, 1.5, facecolor='#FFFFFF', edgecolor=EC, lw=LW)
    ax.add_patch(b_client)
    ax.text(4.35, 8.2, "Frontend & CLI", fontsize=10.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(4.35, 7.65, "(Next.js 14 Web &\nPanda CLI Tool)", fontsize=7.2, ha='center', va='center', color='#334155')
    
    # -------------------------------------------------------------
    # TIER 2: API GATEWAY & CORE MONOLITH (TOP CENTER)
    # -------------------------------------------------------------
    # x in [6.4, 10.4]
    b_api = patches.Rectangle((6.4, 7.3), 4.0, 1.5, facecolor='#FFFFFF', edgecolor=EC, lw=LW)
    ax.add_patch(b_api)
    ax.text(8.4, 8.2, "FastAPI Modular Monolith Core", fontsize=11.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(8.4, 7.65, "(REST API Routing, WebSocket Gateway,\nCentral Exception Buffer & Request-ID Tracing)", fontsize=7.8, ha='center', va='center', color='#334155')
    
    # -------------------------------------------------------------
    # TIER 3: OBJECT STORAGE (TOP RIGHT)
    # -------------------------------------------------------------
    # x in [11.8, 15.3]
    b_b2 = patches.FancyBboxPatch((11.8, 7.3), 3.5, 1.5, boxstyle="round,pad=0.08,rounding_size=0.15",
                                 facecolor='#FFFFFF', edgecolor=EC, lw=LW)
    ax.add_patch(b_b2)
    ax.text(13.55, 8.2, "Backblaze B2 / MinIO Storage", fontsize=11, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(13.55, 7.65, "(S3-Compatible Object Store,\nBare Git Archives & Media Storage)", fontsize=7.8, ha='center', va='center', color='#334155')
    
    # -------------------------------------------------------------
    # TIER 4: PERSISTENCE & STORAGE (MIDDLE ROW)
    # -------------------------------------------------------------
    # PostgreSQL Database: x in [0.7, 3.1]
    draw_cylinder(ax, 0.7, 4.1, 2.4, 2.1, facecolor='#F1F5F9', topcolor='#E2E8F0', edgecolor=EC, lw=LW)
    ax.text(1.9, 5.25, "PostgreSQL Database", fontsize=10.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(1.9, 4.65, "(38+ Relational Tables:\nUsers, Orgs, Issues, PRs, Startups)", fontsize=7, ha='center', va='center', color='#334155')
    
    # Git Smart-HTTP Engine: x in [4.3, 6.8]
    b_git = patches.Rectangle((4.3, 4.4), 2.5, 1.5, facecolor='#FFFFFF', edgecolor=EC, lw=LW)
    ax.add_patch(b_git)
    ax.text(5.55, 5.35, "Git Smart-HTTP Engine", fontsize=10, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(5.55, 4.8, "(git-http-backend Process,\nPAT/JWT Auth & Hooks)", fontsize=7.2, ha='center', va='center', color='#334155')
    
    # Bare Git Repositories: x in [7.8, 10.0]
    draw_cylinder(ax, 7.8, 4.1, 2.2, 2.1, facecolor='#F1F5F9', topcolor='#E2E8F0', edgecolor=EC, lw=LW)
    ax.text(8.9, 5.25, "Bare Git Repos", fontsize=10.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(8.9, 4.65, "(/data/repositories\nPyGit2 libgit2 C-Bindings)", fontsize=7, ha='center', va='center', color='#334155')
    
    # -------------------------------------------------------------
    # TIER 5: ASYNC WORKERS & CACHE (BOTTOM-LEFT / BOTTOM-CENTER)
    # -------------------------------------------------------------
    # Redis In-Memory Broker: x in [0.7, 3.1]
    draw_cylinder(ax, 0.7, 1.4, 2.4, 2.1, facecolor='#F1F5F9', topcolor='#E2E8F0', edgecolor=EC, lw=LW)
    ax.text(1.9, 2.55, "Redis In-Memory Broker", fontsize=10.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(1.9, 1.95, "(Pub/Sub Channels, WS Rooms,\nCelery Task Queue State)", fontsize=7, ha='center', va='center', color='#334155')
    
    # Celery Task Worker: x in [4.3, 7.1]
    b_worker = patches.Rectangle((4.3, 1.7), 2.8, 1.5, facecolor='#FFFFFF', edgecolor=EC, lw=LW)
    ax.add_patch(b_worker)
    ax.text(5.7, 2.65, "Celery Task Worker", fontsize=11, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(5.7, 2.1, "(Email Queue, Pages Builder,\nSecret & Dep CVE Scanners)", fontsize=7.5, ha='center', va='center', color='#334155')
    
    # -------------------------------------------------------------
    # TIER 6: UNIT OF AI INTELLIGENCE & VECTOR RAG (RIGHT CONTAINER)
    # -------------------------------------------------------------
    # x in [11.2, 15.3]
    cont_ai = patches.Rectangle((11.2, 1.3), 4.1, 5.2, facecolor='#F8FAFC', edgecolor=EC, lw=2.0, linestyle='--')
    ax.add_patch(cont_ai)
    ax.text(13.25, 6.15, "Unit of AI Code Intelligence\n& Hybrid Routing", fontsize=11, fontweight='bold', 
            ha='center', va='center', color=EC)
    
    # Sub-block 1: Heuristic Classifier
    sb_class = patches.Rectangle((11.5, 4.75), 3.5, 1.05, facecolor='#FFFFFF', edgecolor=EC, lw=1.5)
    ax.add_patch(sb_class)
    ax.text(13.25, 5.4, "Heuristic Diff Classifier", fontsize=9.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(13.25, 5.0, "(Functional, Refactor, Docs, Disc)", fontsize=7.5, ha='center', va='center', color='#334155')
    
    # Sub-block 2: Specialist Model Dispatch
    sb_disp = patches.Rectangle((11.5, 3.4), 3.5, 1.05, facecolor='#FFFFFF', edgecolor=EC, lw=1.5)
    ax.add_patch(sb_disp)
    ax.text(13.25, 4.05, "Specialist Model Routing ($k=3$)", fontsize=9.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(13.25, 3.65, "(Qwen2.5-Coder-32B & Mistral-7B)", fontsize=7.5, ha='center', va='center', color='#334155')
    
    # Sub-block 3: Qdrant Vector Store
    sb_rag = patches.Rectangle((11.5, 1.7), 3.5, 1.35, facecolor='#FFFFFF', edgecolor=EC, lw=1.5)
    ax.add_patch(sb_rag)
    ax.text(13.25, 2.6, "Qdrant Vector Database", fontsize=9.5, fontweight='bold', ha='center', va='center', color=EC)
    ax.text(13.25, 2.05, "(384-d all-MiniLM-L6-v2 Embeddings\nNeighbor-Voting Review Memory)", fontsize=7.5, ha='center', va='center', color='#334155')
    
    # -------------------------------------------------------------
    # ORTHOGONAL CONNECTING ARROWS & DATA FLOWS
    # -------------------------------------------------------------
    # 1. Developer -> Client App
    draw_stepped_arrow(ax, [(2.3, 8.05), (3.5, 8.05)], 
                       label="Terminal &\nBrowser UI", label_pos=(2.9, 8.15), label_align='center')
    
    # 2. Client App -> API Gateway
    draw_stepped_arrow(ax, [(5.2, 8.05), (6.4, 8.05)], 
                       label="HTTPS REST\n& WebSocket", label_pos=(5.8, 8.15), label_align='center')
    
    # 3. Developer -> Git Engine (Stepped: down to 6.9, right to 4.3, down into Git Engine)
    draw_stepped_arrow(ax, [(1.9, 7.3), (1.9, 6.9), (4.3, 6.9), (4.3, 5.6)], 
                       label="git push / pull / clone (HTTP Basic Auth with PAT)", label_pos=(3.1, 7.05), label_align='center')
    
    # 4. API Gateway -> Backblaze B2 (Horizontal)
    draw_stepped_arrow(ax, [(10.4, 8.05), (11.8, 8.05)], 
                       label="Static Media\n& Avatars", label_pos=(11.1, 8.15), label_align='center')
    
    # 5. API Gateway -> PostgreSQL (Orthogonal: exits bottom of API, steps down, left, into Postgres)
    draw_stepped_arrow(ax, [(6.6, 7.3), (6.6, 6.55), (2.5, 6.55), (2.5, 6.2)], 
                       label="Async ORM Queries & 38+ Table State", label_pos=(4.55, 6.7), label_align='center')
    
    # 6. API Gateway -> Git Engine (Straight down)
    draw_stepped_arrow(ax, [(5.55, 7.3), (5.55, 5.9)], 
                       label="Repo CRUD & Perms", label_pos=(5.55, 6.15), label_align='center')
    
    # 7. Git Engine -> Bare Git Repos (Straight horizontal)
    draw_stepped_arrow(ax, [(6.8, 5.15), (7.8, 5.15)], 
                       label="PyGit2 Write", label_pos=(7.3, 5.3), label_align='center')
    
    # 8. Bare Git Repos -> Backblaze B2 (Two-way sync)
    draw_stepped_arrow(ax, [(8.9, 6.2), (8.9, 7.0), (12.5, 7.0), (12.5, 7.3)], 
                       label="Push-time Archival & Startup Auto-Restore", label_pos=(10.7, 7.15), label_align='center')
    
    # 9. API Gateway -> AI Container (PR Diffs)
    draw_stepped_arrow(ax, [(10.4, 7.5), (10.8, 7.5), (10.8, 5.2), (11.2, 5.2)], 
                       label="PR Diffs for AI Review", label_pos=(10.8, 6.25), label_align='center')
    
    # 10. Inside AI Container: Classifier -> Router
    draw_stepped_arrow(ax, [(13.25, 4.75), (13.25, 4.45)], 
                       label="Diff Category", label_pos=(13.75, 4.6), label_align='left', label_valign='center')
    
    # 11. Inside AI Container: Router -> RAG
    draw_stepped_arrow(ax, [(13.25, 3.4), (13.25, 3.05)], 
                       label="Vector Search", label_pos=(13.75, 3.25), label_align='left', label_valign='center')
    
    # 12. AI Container -> PostgreSQL (Persist synthetic review comments)
    draw_stepped_arrow(ax, [(11.2, 3.7), (10.5, 3.7), (10.5, 3.6), (3.1, 3.6), (3.1, 4.4)], 
                       label="Persist Synthetic Review Comments & Severity Ratings", label_pos=(6.8, 3.75), label_align='center')
    
    # 13. API Gateway -> Celery Worker (Down)
    draw_stepped_arrow(ax, [(7.6, 7.3), (7.6, 2.9), (6.8, 2.9), (6.8, 3.2)], 
                       label="Enqueue Tasks (Email, Security, Pages)", label_pos=(7.6, 3.05), label_align='right')
    
    # 14. Celery Worker -> Redis (Straight horizontal)
    draw_stepped_arrow(ax, [(4.3, 2.45), (3.1, 2.45)], 
                       label="Queue State", label_pos=(3.7, 2.6), label_align='center')
    
    # 15. PostgreSQL -> Redis (Straight vertical)
    draw_stepped_arrow(ax, [(1.9, 4.1), (1.9, 3.5)], 
                       label="Cache Invalidate", label_pos=(1.9, 3.8), label_align='center')
    
    # 16. Redis -> Frontend (Real-time WebSocket events)
    for i in range(2):
        pts = [(0.7, 2.45), (0.18, 2.45), (0.18, 8.05), (3.5, 8.05)]
    ax.plot([0.7, 0.18], [2.45, 2.45], color=EC, lw=1.6)
    ax.plot([0.18, 0.18], [2.45, 8.05], color=EC, lw=1.6)
    ax.annotate("", xy=(3.5, 8.05), xytext=(0.18, 8.05),
                arrowprops=dict(arrowstyle="-|>", color=EC, lw=1.6, mutation_scale=13))
    ax.text(0.18, 5.25, "Live WebSocket Notifications & E2EE Chat", rotation=90,
            fontsize=7.5, fontweight='semibold', ha='center', va='center', color='#0F172A',
            bbox=dict(boxstyle="square,pad=0.15", facecolor='#FFFFFF', edgecolor='#CBD5E1', alpha=0.96))
    
    # -------------------------------------------------------------
    # BOTTOM TOOLS & TECHNOLOGIES BANNER
    # -------------------------------------------------------------
    b_tools = patches.FancyBboxPatch((0.7, 0.4), 14.6, 0.7, boxstyle="round,pad=0.08,rounding_size=0.1",
                                    facecolor='#F8FAFC', edgecolor=EC, lw=1.5)
    ax.add_patch(b_tools)
    ax.text(8.0, 0.75, "Core Platform Stack: Next.js 14 (Frontend)  •  FastAPI (Backend)  •  PostgreSQL 16 (DB)  •  Redis & Celery (Broker/Worker)  •  Claude AI & Qwen (Intelligence)  •  PyGit2 & Backblaze B2 (Storage)  •  Docker & Render (PaaS)", 
            fontsize=8.8, color='#0F172A', fontweight='bold', ha='center', va='center', fontfamily='sans-serif')
    
    plt.tight_layout(pad=0)
    plt.savefig(output_path, dpi=200, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print(f"Generated complete drawable architecture diagram at: {output_path}")

if __name__ == "__main__":
    project_root = r"c:\Users\ravit\Downloads\Pandahub"
    docs_folder = os.path.join(project_root, "docs")
    
    drawio_path = os.path.join(docs_folder, "system_architecture.drawio")
    generate_drawio_file(drawio_path)
    
    img_path = os.path.join(docs_folder, "drawable_system_architecture.png")
    create_complete_drawable_diagram(img_path)
