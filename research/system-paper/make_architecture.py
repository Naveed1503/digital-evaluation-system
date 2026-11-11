"""Generate the implemented DES architecture figure (no external assets)."""
from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = Path(__file__).resolve().parent
NAVY = "#142B4A"
NAVY_2 = "#203E64"
GOLD = "#B78A2E"
PALE = "#F4F6F9"
PALE_GOLD = "#FBF7EC"
INK = "#182332"
MUTED = "#536174"
WHITE = "#FFFFFF"
LINE = "#9EACBC"

fig, ax = plt.subplots(figsize=(14, 7.4), dpi=220)
ax.set_xlim(0, 14)
ax.set_ylim(0, 8)
ax.axis("off")
fig.patch.set_facecolor(WHITE)


def box(x, y, w, h, title, lines=(), face=WHITE, edge=NAVY, title_color=NAVY, size=13):
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.025,rounding_size=0.09",
        linewidth=1.6, edgecolor=edge, facecolor=face,
    )
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h - 0.30, title, ha="center", va="top",
            fontsize=size + 1, fontweight="bold", color=title_color)
    if lines:
        ax.text(x + w / 2, y + h - 0.78, "\n".join(lines), ha="center", va="top",
                fontsize=size - 1, color=INK, linespacing=1.45)
    return patch


def arrow(x1, y1, x2, y2, color=LINE, style="-|>", width=1.5, connection="arc3"):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2), arrowstyle=style, mutation_scale=14,
        linewidth=width, color=color, connectionstyle=connection,
        shrinkA=2, shrinkB=2,
    ))


ax.text(7, 7.76, "ROLE-BASED BROWSER INTERFACES", ha="center", va="center",
        fontsize=12, fontweight="bold", color=MUTED)
roles = [
    (0.25, "Controller", ["Exams · assignment", "publication · audit"]),
    (3.02, "Evaluator", ["Assigned scripts", "marks · drafts"]),
    (5.79, "Moderator", ["Moderation", "flag review"]),
    (8.56, "Student", ["Published results", "marks · grade"]),
    (11.33, "Analytics", ["Datasets · model", "results · reports"]),
]
for x, title, lines in roles:
    box(x, 6.15, 2.42, 1.22, title, lines, face=PALE, size=12)
    arrow(x + 1.21, 6.12, x + 1.21, 5.63)

box(1.10, 4.30, 11.80, 1.30, "DIGITAL EVALUATION WEB APPLICATION",
    ["React + TypeScript · TanStack Start · authenticated server functions",
     "Role-aware navigation · workflow validation · responsive dashboards"],
    face=NAVY, edge=NAVY, title_color=WHITE, size=14)
# Recolour body text inside the dark application box.
ax.texts[-1].set_color(WHITE)

# Main backend boxes.
box(0.25, 0.70, 5.45, 2.45, "CLOUD POSTGRESQL DATABASE",
    ["12 application tables · row-level security",
     "roles · scripts · marks · revisions · audit log",
     "ML datasets · runs · results · review status",
     "server-validated workflow functions"],
    face=PALE, edge=NAVY_2, size=13)
box(6.00, 0.70, 3.25, 2.45, "PRIVATE FILE STORAGE",
    ["Scanned answer scripts",
     "no public file URLs",
     "authorised signed access"],
    face=PALE_GOLD, edge=GOLD, size=13)
box(9.55, 0.70, 4.20, 2.45, "PYTHON ML SERVICE",
    ["FastAPI · scikit-learn",
     "Isolation Forest",
     "scores · labels · metrics",
     "shared-key authentication"],
    face=PALE_GOLD, edge=GOLD, size=13)

# Data paths.
arrow(2.95, 4.27, 2.95, 3.20, color=NAVY_2, style="<|-|>", width=1.8)
ax.text(3.12, 3.73, "queries · workflow writes", fontsize=10.5, color=MUTED, va="center")
arrow(7.62, 4.27, 7.62, 3.20, color=GOLD, style="<|-|>", width=1.8)
ax.text(7.80, 3.73, "authorised file access", fontsize=10.5, color=MUTED, va="center")
arrow(11.65, 4.27, 11.65, 3.20, color=GOLD, style="<|-|>", width=1.8)
ax.text(11.83, 3.73, "numeric data + configuration", fontsize=10.5, color=MUTED, va="center")
ax.text(11.83, 3.44, "advisory analytics returned", fontsize=10.5, color=MUTED, va="center")

ax.text(7, 0.25,
        "The ML service has no direct connection to private files and cannot modify examination marks.",
        ha="center", va="center", fontsize=11.5, color=MUTED, style="italic")

plt.subplots_adjust(left=0.012, right=0.988, top=0.99, bottom=0.02)
fig.savefig(OUT / "system-architecture.png", dpi=300, bbox_inches="tight", facecolor=WHITE)
fig.savefig(OUT / "system-architecture.pdf", bbox_inches="tight", facecolor=WHITE)
print(OUT / "system-architecture.png")
