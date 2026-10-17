"""Builds the fake intake packets in samples/intake-packets/ for testing the AI reader.

Every person, number, payer and clinic here is made up. Each page carries a "SAMPLE / FICTIONAL" banner.
The packets are deliberately long (20-25 pages) and confusing, the way real referrals arrive: old claims,
spouses and relatives, other insurance cards, attorney and nurse letters, partial approvals, cancelled items,
a misfiled page from another patient, duplicates, an upside-down page, handwritten corrections.
Form layouts are modeled on the public California DWC forms (RFA, Doctor's First Report, PR-2, claim form)
and VA forms (10-10172 Request for Service, prosthetics authorization) but are NOT the official forms.
Pages are drawn as images (like real faxes and scans) and saved as one multi-page PDF per packet.
An answer key (answer_key.json) lists the right values and the traps in each packet.

Dev tool only (not part of the app). Needs Python 3 with Pillow, plus two free handwriting fonts
(Caveat and Reenie Beanie, from Google Fonts, OFL licence). Usage:
    python3 scripts/sample-packets/make_packets.py <fonts-dir> samples/intake-packets
"""
import json
import re
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS_DIR = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1700, 2200  # US letter at 200 dpi
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
HANDS = {"neat": FONTS_DIR / "Caveat%5Bwght%5D.ttf", "messy": FONTS_DIR / "ReenieBeanie.ttf"}
_font_cache = {}


def font(path, size):
    key = (str(path), size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(str(path), size)
    return _font_cache[key]


class Page:
    def __init__(self, rng):
        self.img = Image.new("L", (W, H), 255)
        self.d = ImageDraw.Draw(self.img)
        self.rng = rng
        self.d.text((60, 30), "*** SAMPLE DOCUMENT - FICTIONAL PERSON - FOR SOFTWARE TESTING ONLY ***", font=font(SANS_B, 22), fill=90)

    def text(self, x, y, s, size=30, bold=False, mono=False):
        self.d.text((x, y), s, font=font(MONO if mono else (SANS_B if bold else SANS), size), fill=0)

    def title(self, y, s, size=46):
        f = font(SANS_B, size)
        w = self.d.textlength(s, font=f)
        self.d.text(((W - w) / 2, y), s, font=f, fill=0)

    def line(self, x1, y1, x2, y2, width=2):
        self.d.line((x1, y1, x2, y2), fill=0, width=width)

    def rect(self, x1, y1, x2, y2, width=2):
        self.d.rectangle((x1, y1, x2, y2), outline=0, width=width)

    def hand(self, x, y, s, size=54, style="neat", angle=None):
        """Handwriting: drawn on its own layer, slightly tilted and uneven."""
        if not s:
            return
        f = font(HANDS[style], size)
        w = int(self.d.textlength(s, font=f)) + 40
        layer = Image.new("L", (w, size * 2), 0)
        ld = ImageDraw.Draw(layer)
        cx = 10
        for ch in s:  # uneven baseline, like a real pen
            ld.text((cx, size * 0.3 + self.rng.uniform(-3, 3)), ch, font=f, fill=255)
            cx += ld.textlength(ch, font=f) + self.rng.uniform(-1, 1.5)
        layer = layer.rotate(angle if angle is not None else self.rng.uniform(-2.5, 2.5), expand=True, resample=Image.BICUBIC)
        ink = Image.new("L", layer.size, self.rng.choice([10, 30, 45]))
        self.img.paste(ink, (int(x), int(y - size * 0.35)), layer)

    def field(self, x, y, label, value, width=600, hand=None, size=30):
        """A form field: label, a line, and the value typed or handwritten on it."""
        self.text(x, y, label, size=22)
        self.line(x, y + 70, x + width, y + 70, 1)
        if hand:  # written just above the line, the way people fill in forms
            size = 54 if hand == "neat" else 60
            self.hand(x + 10, y + 66 - int(size * 0.95), value, size=size, style=hand)
        else:
            self.text(x + 10, y + 32, value, size=size)

    def checkbox(self, x, y, label, checked, hand=False):
        self.rect(x, y, x + 28, y + 28)
        if checked:
            if hand:
                self.hand(x - 4, y + 4, "X", size=48, style="neat")
            else:
                self.text(x + 4, y - 2, "X", size=30, bold=True)
        self.text(x + 40, y - 2, label, size=26)

    def signature(self, x, y, name, style="messy"):
        self.hand(x, y, name, size=70, style=style, angle=self.rng.uniform(2, 6))

    def table(self, x, y, cols, rows, widths, size=26):
        h = 54
        total = sum(widths)
        self.rect(x, y, x + total, y + h * (len(rows) + 1))
        cx = x
        for c, wd in zip(cols, widths):
            self.text(cx + 8, y + 12, c, size=size, bold=True)
            cx += wd
            self.line(cx, y, cx, y + h * (len(rows) + 1), 1)
        for r, row in enumerate(rows):
            ry = y + h * (r + 1)
            self.line(x, ry, x + total, ry, 1)
            cx = x
            for v, wd in zip(row, widths):
                self.text(cx + 8, ry + 12, v, size=size)
                cx += wd
        return y + h * (len(rows) + 1)

    def paragraph(self, x, y, s, size=28, width=1540, gap=1.45):
        f = font(SANS, size)
        for para in s.split("\n"):
            words, cur = para.split(" "), ""
            for wd in words:
                t = (cur + " " + wd).strip()
                if self.d.textlength(t, font=f) > width:
                    self.text(x, y, cur, size=size)
                    y += int(size * gap)
                    cur = wd
                else:
                    cur = t
            self.text(x, y, cur, size=size)
            y += int(size * gap * 1.4)
        return y




def fax(page, header, rng, quality="ok"):
    """Make it look faxed: tilt, speckles, black-and-white, and a fax header line. Works on a copy."""
    img = page.img.copy()
    if getattr(page, "flip", False):  # fed into the fax machine upside down
        img = img.rotate(180)
    d = ImageDraw.Draw(img)
    d.text((40, 2), header, font=font(MONO, 22), fill=0)
    tilt = {"clean": 0.0, "ok": rng.uniform(-0.8, 0.8), "bad": rng.uniform(-1.8, 1.8)}[getattr(page, "quality", None) or quality]
    q = getattr(page, "quality", None) or quality
    if tilt:
        img = img.rotate(tilt, fillcolor=255, resample=Image.BICUBIC)
    if q != "clean":
        px = img.load()
        for _ in range({"ok": 2500, "bad": 12000}[q]):
            x, y = rng.randrange(W), rng.randrange(H)
            px[x, y] = 0
        if q == "bad":
            img = img.filter(ImageFilter.GaussianBlur(0.9))
        img = img.point(lambda v: 255 if v > (150 if q == "ok" else 165) else 0)
        return img.convert("1", dither=Image.Dither.NONE)
    return img.convert("L")


# ---------------------------------------------------------------- a general form engine
# A document is a list of blocks; the engine lays them out top to bottom.
#   ("sec", "TITLE")                         section heading with a rule
#   ("kv", [(label, value), ...])            two-column label / value list
#   ("row", [(label, value, width, hand), ...])  form fields side by side (hand: None | "neat" | "messy")
#   ("checks", [(label, checked), ...])      checkboxes, three per line
#   ("table", cols, rows, widths)
#   ("para", text)                           wrapped typed text
#   ("hand", text, style)                    a handwritten line
#   ("fix", label, old, new)                 typed value crossed out, corrected by hand
#   ("sig", name, caption, style)            signature over a line
#   ("space", pixels)


def doc(rng, title, org=None, sub=None, blocks=(), flip=False, quality=None):
    p = Page(rng)
    p.flip, p.quality = flip, quality
    y = 70
    if org:
        p.title(y, org.upper(), 34); y += 50
    p.title(y, title, 40); y += 62
    if sub:
        p.title(y, sub, 22); y += 44
    y += 10
    for b in blocks:
        k = b[0]
        if y > H - 160:
            break  # keep everything on the page
        if k == "sec":
            p.text(100, y, b[1], 28, True); p.line(100, y + 38, 1600, y + 38, 2); y += 58
        elif k == "kv":
            for lab, val in b[1]:
                p.text(110, y, lab, 24, True); p.text(600, y, str(val), 26); y += 44
            y += 8
        elif k == "row":
            x = 100
            for lab, val, wd, hd in b[1]:
                p.field(x, y, lab, val, wd, hd, 26)
                x += wd + 40
            y += 100
        elif k == "checks":
            items = b[1]
            for i in range(0, len(items), 3):
                for j, (lab, chk) in enumerate(items[i:i + 3]):
                    p.checkbox(110 + j * 500, y, lab, chk)
                y += 48
            y += 6
        elif k == "table":
            y = p.table(100, y, b[1], b[2], b[3], 22) + 24
        elif k == "para":
            y = p.paragraph(110, y, b[1], 24, 1480, 1.35)
        elif k == "hand":
            style = b[2] if len(b) > 2 else "neat"
            p.hand(120, y, b[1], 50 if style == "neat" else 58, style); y += 74
        elif k == "fix":
            _, lab, old, new = b
            p.text(110, y, lab, 24, True)
            f = font(SANS, 26)
            p.text(600, y, old, 26)
            wd = p.d.textlength(old, font=f)
            p.line(596, y + 15, 604 + wd, y + 13, 3)
            p.hand(640, y + 36, f"{new}  (corrected)", 46, "neat")  # written just below the crossed-out value
            y += 110
        elif k == "sig":
            _, name, cap, *rest = b
            p.signature(130, y, name, rest[0] if rest else "messy")
            p.line(110, y + 82, 900, y + 82); p.text(110, y + 90, cap, 22); y += 140
        elif k == "space":
            y += b[1]
    return p


def cover(rng, frm, frm_fax, to, pages, note, date="10/14/2026", hand=False, attn=""):
    blocks = [("kv", [("DATE", date), ("TO", to), ("ATTN", attn or "Intake / Billing"), ("FROM", frm), ("FAX", frm_fax), ("PAGES", f"{pages} including cover")]), ("sec", "MESSAGE")]
    blocks += [("hand", line) for line in note.split("\n")] if hand else [("para", note)]
    blocks += [("space", 600), ("para", "CONFIDENTIALITY NOTICE: This facsimile may contain protected health information. If you are not the intended recipient, notify the sender at the number above and destroy all copies. (Sample text.)")]
    return doc(rng, "FAX TRANSMITTAL", sub="sample document for software testing", blocks=blocks)


# ---------------------------------------------------------------- shared fictional entities

CLINICS = {
    "A": {"clinic": "Example Orthopedic Group (Sample)", "address": "200 Sample Blvd, San Diego, CA 92101", "phone": "(555) 010-0140", "fax": "(555) 010-0144", "name": "Alan Sample, MD (fictional)", "sig": "A. Sample MD", "npi": "1245319599", "spec": "Orthopedic Surgery"},
    "B": {"clinic": "Desert Sports Medicine (Sample)", "address": "9 Test Way, Austin, TX 78701", "phone": "(555) 010-0150", "fax": "(555) 010-0155", "name": "Rita Example, DO (fictional)", "sig": "R Example DO", "npi": "1003000126", "spec": "Sports Medicine"},
    "C": {"clinic": "Veterans Community Clinic (Sample)", "address": "55 Demo Rd, Phoenix, AZ 85001", "phone": "(555) 010-0160", "fax": "(555) 010-0166", "name": "Sam Testwell, MD (fictional)", "sig": "S. Testwell", "npi": "1003000134", "spec": "Family Medicine"},
    "D": {"clinic": "Harbor Occupational Health (Sample)", "address": "8 Dock St, San Diego, CA 92113", "phone": "(555) 010-0210", "fax": "(555) 010-0211", "name": "Nina Placeholder, MD (fictional)", "sig": "N Placeholder", "npi": "1234567893", "spec": "Occupational Medicine"},
    "E": {"clinic": "Coastal Physical Therapy (Sample)", "address": "41 Wave Ave, San Diego, CA 92109", "phone": "(555) 010-0220", "fax": "(555) 010-0221", "name": "Lee Fakename, DPT (fictional)", "sig": "L. Fakename DPT", "npi": "1003000142", "spec": "Physical Therapy"},
}
SUPPLIER = {"name": "SCORE (DEMO) Delivery", "address": "1 Warehouse Ln, San Diego, CA 92101", "phone": "(555) 010-0199"}
CARRIERS = {
    "GOLD": {"name": "GOLDEN STATE COMP MUTUAL (TEST)", "addr": "PO Box 0001, Sacramento, CA 95801", "phone": "555-0100", "fax": "555-0109"},
    "SUN": {"name": "SUNBELT WC ADMINISTRATORS (TEST)", "addr": "PO Box 0002, Austin, TX 78701", "phone": "555-0101", "fax": "555-0108"},
    "OLD": {"name": "PINECREST CASUALTY (TEST)", "addr": "PO Box 0099, Fresno, CA 93701", "phone": "555-0230", "fax": "555-0231"},
    "VAD": {"name": "VA MEDICAL CENTER - DIRECT (TEST)", "addr": "Prosthetics Service, 3350 Sample Dr, San Diego, CA 92161", "phone": "555-0102", "fax": "555-0107"},
    "CCN": {"name": "COMMUNITY CARE TPA (TEST)", "addr": "PO Box 0003, Phoenix, AZ 85001", "phone": "555-0103", "fax": "555-0106"},
}
PERSONAL_PLAN = "PACIFIC COAST HEALTH PLAN (TEST)"
ADV_PLAN = "SAMPLE SENIOR ADVANTAGE PLAN (TEST)"

ITEMS = {
    "L1833": "Knee orthosis, adjustable knee joints, prefab, off-the-shelf",
    "L1851": "Knee orthosis, single upright, prefab, off-the-shelf",
    "E0218": "Water circulating cold pad with pump",
    "L3809": "Wrist hand finger orthosis, prefab, off-the-shelf",
    "E0143": "Walker, folding, wheeled, adjustable",
    "L0650": "Lumbar-sacral orthosis, prefab, off-the-shelf",
    "L4361": "Walking boot, pneumatic and/or vacuum, prefab, OTS",
    "E0114": "Crutches, underarm, other than wood, pair",
    "E0730": "TENS, four or more leads",
    "A4595": "Electrical stimulator supplies, 2 lead, per month",
}
DX = {
    "S83.511A": "Sprain of ACL of right knee, initial encounter",
    "S83.241A": "Other tear of medial meniscus, right knee, initial",
    "M25.561": "Pain in right knee",
    "S63.501A": "Unspecified sprain of right wrist, initial encounter",
    "M17.11": "Unilateral primary osteoarthritis, right knee",
    "M54.50": "Low back pain, unspecified",
    "M51.16": "Intervertebral disc disorders w radiculopathy, lumbar",
    "S93.401A": "Sprain of unsp ligament of right ankle, initial",
    "M75.101": "Unsp rotator cuff tear of right shoulder, not trauma",
    "S43.421A": "Sprain of right rotator cuff capsule, initial",
    "M25.562": "Pain in left knee",
}


def us(iso):
    y, m, d = iso.split("-")
    return f"{m}/{d}/{y}"


# ---------------------------------------------------------------- document builders (modeled on real forms; not official)


def face_sheet(rng, pt, clinic, extra=(), blocks_after=()):
    rows = [("Patient", f'{pt["last"]}, {pt["first"]} {pt.get("mi", "")}'.strip()), ("Preferred name", pt.get("nick", "")), ("DOB", us(pt["dob"])), ("Sex", pt["sex"]), ("SSN", pt.get("ssn", "")),
            ("Address", pt["addr"]), ("City / State / ZIP", f'{pt["city"]}, {pt["state"]} {pt["zip"]}'), ("Home phone", pt.get("phone", "")), ("Cell", pt.get("cell", "")), ("Email", pt.get("email", "")),
            ("Employer", pt.get("employer", "")), ("Occupation", pt.get("occupation", "")), ("Marital status", pt.get("marital", "")), ("Language", "English")]
    blocks = [("sec", "PATIENT"), ("kv", [r for r in rows if r[1]]), ("sec", "EMERGENCY CONTACT / RESPONSIBLE PARTY"), ("kv", pt.get("contact", []))]
    if extra:
        blocks += [("sec", "INSURANCE ON FILE"), ("kv", list(extra))]
    return doc(rng, "PATIENT REGISTRATION / FACE SHEET", clinic["clinic"], f'{clinic["address"]}   Tel {clinic["phone"]}', blocks + list(blocks_after))


def rfa(rng, pt, case, md, items, response=None, hand=None, flip=False, claim_override=None):
    """Modeled on the layout of California's DWC Form RFA (sample, not the official form)."""
    s = hand
    rows = [[DX[d][:30], d, ITEMS[c][:30], c, other] for c, d, other in items]
    blocks = [
        ("checks", [("New request", True), ("Resubmission - change in material facts", False), ("Expedited review", False), ("Written confirmation of prior oral request", False)]),
        ("sec", "EMPLOYEE INFORMATION"),
        ("row", [("Name (Last, First, Middle)", f'{pt["last"]}, {pt["first"]}', 760, s), ("Date of injury (MM/DD/YYYY)", us(case["doi"]), 660, s)]),
        ("row", [("Date of birth (MM/DD/YYYY)", us(pt["dob"]), 560, s), ("Claim number", claim_override or case["claim"], 860, s)]),
        ("row", [("Employer", case["employer"], 1460, s)]),
        ("sec", "REQUESTING PHYSICIAN INFORMATION"),
        ("kv", [("Name", md["name"]), ("Practice name", md["clinic"]), ("Address", md["address"]), ("Phone / Fax", f'{md["phone"]} / {md["fax"]}'), ("Specialty / NPI", f'{md["spec"]} / {md["npi"]}')]),
        ("sec", "CLAIMS ADMINISTRATOR INFORMATION"),
        ("kv", [("Company name", case["carrier"]["name"]), ("Contact name", case["adjuster"]), ("Address", case["carrier"]["addr"]), ("Phone / Fax", f'{case["adj_phone"]} / {case["carrier"]["fax"]}')]),
        ("sec", "REQUESTED TREATMENT (attach Doctor's First Report or PR-2)"),
        ("table", ["Diagnosis", "ICD", "Service / good requested", "HCPCS", "Other (freq/dur/qty)"], rows, [380, 180, 470, 150, 320]),
        ("sig", md["sig"], f'Requesting physician signature    Date: {us(case["rfa_date"])}'),
        ("sec", "CLAIMS ADMINISTRATOR / UR RESPONSE"),
    ]
    if response:
        blocks += [("checks", [("Approved", response["status"] == "approved"), ("Denied / modified", response["status"] == "partial"), ("Liability disputed", False)]),
                   ("kv", [("Authorization number", response.get("auth", "")), ("Authorized by", response.get("by", "")), ("Date", response.get("date", ""))])]
        if response.get("note"):
            blocks += [("hand", response["note"], "neat")]
    else:
        blocks += [("para", "(left blank: not yet reviewed)")]
    return doc(rng, "REQUEST FOR AUTHORIZATION", sub="Workers' Compensation - SAMPLE modeled on DWC Form RFA; not an official state form", blocks=blocks, flip=flip)


def first_report(rng, pt, case, md, how, subjective, objective, dx, plan, work):
    """Modeled on California's Doctor's First Report of Occupational Injury (DLSR 5021). Sample only."""
    blocks = [
        ("kv", [("1. Insurer name and address", f'{case["carrier"]["name"]}, {case["carrier"]["addr"]}'), ("2. Employer name", case["employer"]), ("3. Employer address", case.get("employer_addr", "")), ("4. Nature of business", case.get("business", "")),
                ("5. Patient name", f'{pt["first"]} {pt["last"]}'), ("6. Sex / DOB", f'{pt["sex"]} / {us(pt["dob"])}'), ("7. Address", f'{pt["addr"]}, {pt["city"]}, {pt["state"]} {pt["zip"]}'), ("8. Phone", pt.get("phone", "")), ("9. Occupation", pt.get("occupation", "")),
                ("10. SSN", pt.get("ssn", "")), ("11. Injured at", case.get("where", "")), ("12. Date / hour of injury", f'{us(case["doi"])}  {case.get("hour", "")}'), ("13. Date last worked", case.get("last_worked", "")), ("14. Date / hour first examined", case.get("first_exam", "")), ("15. Prior treatment by", case.get("prior", "none"))]),
        ("sec", "16. HOW DID THE INJURY OCCUR?"), ("para", how),
        ("sec", "17. SUBJECTIVE COMPLAINTS"), ("para", subjective),
        ("sec", "18. OBJECTIVE FINDINGS"), ("para", objective),
        ("sec", "19. DIAGNOSIS (ICD-10)"), ("para", "; ".join(f"{c} {DX.get(c, '')}" for c in dx)),
        ("sec", "20-23. TREATMENT / WORK STATUS"), ("para", plan), ("para", work),
        ("sig", md["sig"], f'{md["name"]}   NPI {md["npi"]}   {md["clinic"]}'),
    ]
    return doc(rng, "DOCTOR'S FIRST REPORT OF OCCUPATIONAL INJURY OR ILLNESS", sub="SAMPLE modeled on form DLSR 5021; not the official form", blocks=blocks)


def pr2(rng, pt, case, md, date, reasons, subjective, objective, dx, plan, work, flip=False):
    """Modeled on the California PR-2 progress report. Sample only."""
    checks = [(r, r in reasons) for r in ["Periodic report", "Change in treatment plan", "Change in work status", "Need for referral or consultation", "Need for surgery or hospitalization", "Request for authorization"]]
    blocks = [
        ("checks", checks),
        ("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Claim number", case["claim"]), ("Date of injury", us(case["doi"])), ("Employer", case["employer"]), ("Claims administrator", case["carrier"]["name"]), ("Date of exam", date)]),
        ("sec", "SUBJECTIVE COMPLAINTS"), ("para", subjective),
        ("sec", "OBJECTIVE FINDINGS"), ("para", objective),
        ("sec", "DIAGNOSES"), ("para", "; ".join(f"{c} {DX.get(c, '')}" for c in dx)),
        ("sec", "TREATMENT PLAN (methods, frequency, duration)"), ("para", plan),
        ("sec", "WORK STATUS"), ("para", work),
        ("sig", md["sig"], f'{md["name"]}   {md["spec"]}   NPI {md["npi"]}   Date {date}'),
    ]
    return doc(rng, "PRIMARY TREATING PHYSICIAN'S PROGRESS REPORT (PR-2)", md["clinic"], "SAMPLE modeled on DWC Form PR-2; not the official form", blocks, flip=flip)


def employee_claim(rng, pt, case, hand="messy", employer_part=True):
    """Modeled on an employee claim form (DWC-1 style). Sample only."""
    s = hand
    blocks = [
        ("sec", "EMPLOYEE: complete this section"),
        ("row", [("1. Name", f'{pt["first"]} {pt["last"]}', 900, s), ("Today's date", case.get("claim_form_date", "09/30/2026"), 520, s)]),
        ("row", [("2. Home address", pt.get("claim_addr", pt["addr"]), 1460, s)]),
        ("row", [("3. City", pt["city"], 600, s), ("State", pt["state"], 240, s), ("ZIP", pt["zip"], 540, s)]),
        ("row", [("4. Date of injury", case.get("doi_employee", us(case["doi"])), 600, s), ("Time", case.get("hour", ""), 380, s), ("5. Address where it happened", case.get("where_short", ""), 400, s)]),
        ("row", [("6. Describe injury and part of body affected", case.get("desc_short", ""), 1460, s)]),
        ("row", [("7. Social Security number", pt.get("ssn", ""), 700, s), ("Phone", pt.get("phone", ""), 700, s)]),
        ("sig", f'{pt["first"].title()} {pt["last"].split("-")[-1].title()}', "8. Employee signature"),
    ]
    if employer_part:
        blocks += [
            ("sec", "EMPLOYER: complete this section"),
            ("kv", [("9. Name of employer", case["employer"]), ("10. Address", case.get("employer_addr", "")), ("11. Date employer first knew of injury", case.get("employer_knew", "")), ("12. Date claim form was given", case.get("claim_form_date", "")),
                    ("13. Date claim form was returned", case.get("claim_form_date", "")), ("14. Insurance carrier / adjusting agency", case["carrier"]["name"]), ("15. Insurance policy number", case.get("policy", "")), ("16. Supervisor", case.get("supervisor", ""))]),
            ("sig", case.get("supervisor", "Supervisor"), "17. Signature of employer representative", "neat"),
        ]
    return doc(rng, "WORKERS' COMPENSATION CLAIM FORM", sub="SAMPLE modeled on an employee claim form (DWC-1 style); not the official form", blocks=blocks)


def letter(rng, sender, addr, phone, title, date, to_lines, body_kv, body_text, signer, flip=False, quality=None):
    blocks = [("para", f"{addr}    Phone {phone}"), ("space", 10), ("para", date)]
    blocks += [("para", "\n".join(to_lines))]
    if body_kv:
        blocks += [("kv", body_kv)]
    blocks += [("para", body_text), ("space", 20), ("sig", signer, signer, "neat")]
    return doc(rng, title, sender, None, blocks, flip=flip, quality=quality)


def chart_note(rng, pt, md, date, title, body, flip=False):
    blocks = [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Date of service", date), ("Provider", md["name"])]), ("para", body), ("sig", md["sig"], f'Electronically signed by {md["name"]} on {date}', "neat")]
    return doc(rng, title, md["clinic"], f'{md["address"]}   Tel {md["phone"]}   Fax {md["fax"]}', blocks, flip=flip)


def imaging(rng, pt, date, study, findings, impression):
    blocks = [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Exam date", date), ("Study", study), ("Ordering", "see referral"), ("Accession #", f"TESTACC{rng.randint(100000, 999999)}")]),
              ("sec", "FINDINGS"), ("para", findings), ("sec", "IMPRESSION"), ("para", impression), ("sig", "J. Radiologist MD", "Electronically signed: Jo Radiologist, MD (fictional)", "neat")]
    return doc(rng, "DIAGNOSTIC IMAGING REPORT", "Sample Imaging Center", "77 Picture Way, San Diego, CA 92108   Tel (555) 010-0240", blocks)


def pt_daily(rng, pt, date, visit_no, body_part, notes):
    blocks = [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Visit", f"{visit_no} of 12"), ("Date", date), ("Body part", body_part)]),
              ("table", ["Exercise", "Sets x reps", "Resistance", "Notes"], [["Quad sets", "3 x 10", "-", "tolerated"], ["Straight leg raise", "3 x 10", "1 lb", "mild pain"], ["Stationary bike", "10 min", "level 2", "-"], ["Mini squats", "2 x 10", "BW", "cueing needed"], ["Ice", "15 min", "-", "post session"]], [460, 260, 260, 480]),
              ("para", notes), ("sig", CLINICS["E"]["sig"], f'{CLINICS["E"]["name"]}', "neat")]
    return doc(rng, "PHYSICAL THERAPY DAILY NOTE", CLINICS["E"]["clinic"], CLINICS["E"]["address"], blocks)


def med_list(rng, pt, meds, allergies):
    blocks = [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Updated", "10/13/2026")]),
              ("table", ["Medication", "Dose", "Directions", "Prescriber"], meds, [420, 220, 520, 300]), ("sec", "ALLERGIES"), ("para", allergies)]
    return doc(rng, "MEDICATION LIST", CLINICS["A"]["clinic"], None, blocks)


def swo(rng, pt, md, date, items, dx, los, notes="", hand=None):
    """Prescription / standard written order: name, order date, item description, quantity, practitioner name/NPI, signature."""
    rows = [[c, ITEMS[c][:44], q] for c, q in items]
    blocks = [("row", [("Patient name", f'{pt["first"]} {pt["last"]}' if hand else f'{pt["last"]}, {pt["first"]}', 900, hand), ("DOB", us(pt["dob"]), 520, hand)]),
              ("row", [("Order date", date, 500, hand), ("Length of need", los, 920, hand)]),
              ("table", ["HCPCS", "Description", "Qty"], rows, [220, 1040, 200]),
              ("sec", "DIAGNOSES"), ("para", "; ".join(f"{c} {DX.get(c, '')}" for c in dx))]
    if notes:
        blocks += [("sec", "NOTES"), ("hand", notes, hand) if hand else ("para", notes)]
    blocks += [("space", 60), ("sig", md["sig"], f'{md["name"]}   NPI {md["npi"]}   Date {date}')]
    return doc(rng, "PRESCRIPTION / STANDARD WRITTEN ORDER - DME", md["clinic"], f'{md["address"]}   Tel {md["phone"]}   Fax {md["fax"]}', blocks)


def delivery(rng, pt, items, ticket, date, signer, ship_addr=None, note=""):
    rows = [[c, m, ITEMS[c][:34], "1", sn] for c, m, sn in items]
    blocks = [("kv", [("Ticket #", ticket), ("Delivery date", date), ("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Deliver to", ship_addr or f'{pt["addr"]}, {pt["city"]}, {pt["state"]} {pt["zip"]}')]),
              ("table", ["HCPCS", "Mod", "Description", "Qty", "Serial / lot"], rows, [200, 120, 720, 100, 320]),
              ("para", "I received the item(s) listed above in good working order. I was instructed in use, care and cleaning, and received the warranty information and supplier standards. (Sample wording.)")]
    if note:
        blocks += [("hand", note, "neat")]
    blocks += [("sig", signer, "Patient or authorized representative signature"), ("kv", [("Relationship to patient", "Self" if signer != "Maria Rivera" else "Spouse"), ("Date received", date)])]
    return doc(rng, "DELIVERY TICKET / PROOF OF DELIVERY", SUPPLIER["name"], f'{SUPPLIER["address"]}   {SUPPLIER["phone"]}', blocks)


def supplier_forms(rng, pt, signer):
    """The paperwork a DME supplier has the patient sign: assignment of benefits, supplier standards, warranty, privacy notice."""
    pages = []
    for title, text in [
        ("ASSIGNMENT OF BENEFITS / FINANCIAL RESPONSIBILITY", "I authorize payment of benefits directly to the supplier for equipment provided. I understand workers' compensation and VA claims are billed to the responsible payer. I authorize release of information needed to process my claims. (Sample wording.)"),
        ("ACKNOWLEDGMENT OF SUPPLIER STANDARDS AND WARRANTY", "I received a copy of the supplier standards, the manufacturer warranty, and instructions on how to contact the supplier for repairs, returns or complaints. Business hours are Monday-Friday 8-5. (Sample wording.)"),
        ("NOTICE OF PRIVACY PRACTICES - ACKNOWLEDGMENT", "I acknowledge that I received the Notice of Privacy Practices, which explains how my health information may be used and disclosed. (Sample wording.)"),
    ]:
        pages.append(doc(rng, title, SUPPLIER["name"], None, [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"]))]), ("para", text), ("space", 200), ("sig", signer, "Signature of patient or representative"), ("hand", "10/15/2026", "neat")]))
    return pages


def ur_decision(rng, case, pt, date, lines, auth, reviewer="Utilization Review Physician (fictional)"):
    rows = [[c, ITEMS[c][:40], dec] for c, dec in lines]
    text = "This is the utilization review decision on the request for authorization received. Items marked CERTIFIED are authorized. Items NOT CERTIFIED are denied; you may request independent medical review (IMR). (Sample letter; not legal advice.)"
    return letter(rng, case["carrier"]["name"], case["carrier"]["addr"], case["carrier"]["phone"], "UTILIZATION REVIEW DETERMINATION", date,
                  [f'Requesting physician: see RFA', f'Employee: {pt["last"]}, {pt["first"]}'],
                  [("Claim number", case["claim"]), ("Date of injury", us(case["doi"])), ("Authorization #", auth)],
                  text + "\n" + "\n".join(f"{c}  {ITEMS[c][:40]}:  {dec}" for c, dec in lines), reviewer)


def card(rng, plan, member, group, name, extra=""):
    p = Page(rng)
    p.title(80, "COPY OF INSURANCE CARD (FRONT AND BACK)", 34)
    p.rect(250, 200, 1450, 900, 4)
    p.text(300, 240, plan, 40, True)
    p.text(300, 340, "Member", 24); p.text(300, 375, name, 36, True)
    p.text(300, 470, "Member ID", 24); p.text(300, 505, member, 36, True)
    p.text(300, 600, "Group", 24); p.text(300, 635, group, 36)
    p.text(300, 760, extra or "PPO   Rx BIN 000000", 26)
    p.rect(250, 1000, 1450, 1700, 4)
    p.paragraph(300, 1050, "Claims: PO Box 0000, Example City, CA 90000. Payer ID TEST1. Prior auth 555-0170. Member services 555-0171. NOT FOR WORK-RELATED INJURIES. (Sample card.)", 28, 1100)
    return p


def junk(rng, kind):
    texts = {
        "ad": ("SPECIAL OFFER!!!", "Toner and paper 40% off this week only. Call 555-0188. Reply STOP to be removed from this list. (Sample junk fax.)"),
        "blank": ("", ""),
        "survey": ("PATIENT SATISFACTION SURVEY", "How did we do? Circle 1-5 for each question. 1. Wait time  2. Courtesy  3. Cleanliness. (Blank sample survey; no patient information.)"),
    }
    t, body = texts[kind]
    p = Page(rng)
    if kind == "blank":
        p.title(1000, "(this page intentionally left blank)", 28)
    else:
        p.title(300, t, 70)
        p.paragraph(200, 600, body, 40, 1300)
    return p


def handwritten_intake(rng, pt, case, items, dx, overrides=None):
    o = overrides or {}
    s = "messy"
    blocks = [
        ("row", [("Last name", pt["last"], 760, s), ("First name", o.get("first", pt["first"]), 660, s)]),
        ("row", [("Date of birth", o.get("dob", us(pt["dob"])), 560, s), ("Sex", pt["sex"], 220, s), ("SSN", o.get("ssn", pt.get("ssn", "")), 600, s)]),
        ("row", [("Address", o.get("addr", pt["addr"]), 1460, s)]),
        ("row", [("City", pt["city"], 620, s), ("State", pt["state"], 240, s), ("ZIP", pt["zip"], 520, s)]),
        ("row", [("Phone", o.get("phone", pt.get("phone", "")), 620, s), ("Employer", case.get("employer", ""), 800, s)]),
        ("sec", "INJURY / INSURANCE"),
        ("row", [("Work comp insurance", o.get("carrier", case["carrier"]["name"]), 1460, s)]),
        ("row", [("Claim #", o.get("claim", case.get("claim", "")), 700, s), ("Date of injury", o.get("doi", us(case["doi"])), 720, s)]),
        ("row", [("Adjuster / phone", f'{case.get("adjuster", "")} {case.get("adj_phone", "")}', 1460, s)]),
        ("row", [("Other health insurance", o.get("other_ins", "none"), 1460, s)]),
        ("row", [("Equipment / what doctor ordered", items, 1460, s)]),
        ("row", [("Injury / diagnosis", dx, 1460, s)]),
        ("sig", f'{pt["first"].title()} {pt["last"].split("-")[-1].title()}', "Signature"),
    ]
    return doc(rng, "NEW PATIENT INTAKE", sub="Please print clearly", blocks=blocks)


def va_rfs(rng, pt, md, facility, items, dx, justification, delivery_opt, training_done=True, hand=None):
    """Modeled on VA Form 10-10172 (Community Care Provider - Request for Service). Sample only."""
    s = hand
    rows = [[c, ITEMS[c][:30], brand, q, meas] for c, brand, q, meas in items]
    blocks = [
        ("sec", "VETERAN INFORMATION"),
        ("row", [("Veteran full legal name", f'{pt["last"]}, {pt["first"]} {pt.get("mi", "")}', 960, s), ("Date of birth", us(pt["dob"]), 460, s)]),
        ("row", [("VA facility", facility, 1460, s)]),
        ("sec", "ORDERING PROVIDER"),
        ("kv", [("Name", md["name"]), ("NPI", md["npi"]), ("Specialty", md["spec"]), ("Office address", md["address"]), ("Phone / Fax", f'{md["phone"]} / {md["fax"]}')]),
        ("sec", "TYPE OF SERVICE: DME / PROSTHETICS / ORTHOTICS"),
        ("table", ["HCPCS", "Item", "Brand / model", "Qty", "Measurements"], rows, [180, 520, 360, 100, 320]),
        ("kv", [("Provisional diagnosis (ICD-10)", "; ".join(dx))]),
        ("checks", [("Deliver to ordering provider", delivery_opt == "provider"), ("Pick up at VA medical center", delivery_opt == "va"), ("Deliver to Veteran's home", delivery_opt == "home"), ("Education / training / fitting completed", training_done)]),
        ("sec", "JUSTIFICATION"), ("para", justification),
        ("sig", md["sig"], f'Requesting provider signature (required)   {md["name"]}'),
    ]
    return doc(rng, "COMMUNITY CARE PROVIDER - REQUEST FOR SERVICE", sub="SAMPLE modeled on VA Form 10-10172; not the official form", blocks=blocks)


def seoc_referral(rng, pt, ref, md, status_note=""):
    blocks = [("kv", [("Referral number", ref["referral"]), ("SEOC", ref["seoc"]), ("Authorization number", ref["auth"]), ("Episode of care", ref["episode"]), ("Visits / services authorized", ref.get("visits", "per SEOC")), ("Status", ref.get("status", "ACTIVE")),
                       ("Veteran", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Member / ICN (last 4)", ref["member"]), ("Phone", pt.get("phone", "")), ("Address", f'{pt["addr"]}, {pt["city"]}, {pt["state"]} {pt["zip"]}'),
                       ("Referring VA facility", ref.get("facility", "VA Sample Health Care System (fictional)")), ("Community provider", f'{md["name"]}  NPI {md["npi"]}')]),
              ("sec", "NOTES"), ("para", ref.get("notes", "Bill the TPA using the referral number. Services outside the SEOC need a Request for Service. DME: routine DME is coordinated with the VA medical center. (Sample text.)"))]
    if status_note:
        blocks += [("hand", status_note, "neat")]
    return doc(rng, "COMMUNITY CARE REFERRAL", CARRIERS["CCN"]["name"], "SAMPLE referral document for software testing (not an official VA form)", blocks)


def va_2421(rng, pt, po, items, date, vendor_note=""):
    """Modeled on a VA prosthetic authorization for items or services (10-2421 style). Sample only."""
    rows = [[c, ITEMS[c][:40], q, st] for c, q, st in items]
    blocks = [("kv", [("Authorization / PO #", po), ("Date issued", date), ("Vendor", SUPPLIER["name"]), ("Veteran", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"])), ("Ship to", f'{pt["addr"]}, {pt["city"]}, {pt["state"]} {pt["zip"]}')]),
              ("table", ["HCPCS", "Description", "Qty", "Status"], rows, [200, 860, 120, 280]),
              ("para", "Invoice the VA using the authorization number above. Items marked CANCELLED must not be delivered or billed. (Sample text.)")]
    if vendor_note:
        blocks += [("hand", vendor_note, "neat")]
    return doc(rng, "PROSTHETIC AUTHORIZATION FOR ITEMS OR SERVICES", CARRIERS["VAD"]["name"], "SAMPLE modeled on a VA prosthetics authorization; not the official form", blocks)


def build(rng):
    P = []  # (file name, quality, sender, pages, answer)
    A, B, C, D, E = (CLINICS[k] for k in "ABCDE")

    # ---------------------------------------------------------------- 1. kitchen-sink WC referral
    pt = dict(last="DEMO-RIVERA", first="DANIEL", mi="J", nick="Danny", dob="1984-02-17", sex="M", ssn="000-00-0101", addr="410 SAMPLE AVE APT 3", city="SAN DIEGO", state="CA", zip="92103", phone="555-0121", cell="555-0122",
              email="d.rivera@example.test", employer="EXAMPLE FREIGHT LLC", occupation="Forklift operator", marital="Married",
              contact=[("Name", "Maria Rivera (spouse)"), ("DOB", "05/30/1986"), ("Phone", "555-0123"), ("Employer", "SAMPLE DENTAL GROUP")])
    case = dict(carrier=CARRIERS["GOLD"], claim="TEST-WC-10442", doi="2026-09-03", adjuster="JORDAN SAMPLE", adj_phone="555-0177", employer="EXAMPLE FREIGHT LLC", employer_addr="900 Dock Rd, San Diego, CA 92113",
                business="Freight warehousing", where="Warehouse aisle 12", where_short="900 Dock Rd", hour="10:40 AM", last_worked="09/03/2026", first_exam="09/03/2026 2:15 PM", rfa_date="2026-10-08", policy="TEST-POL-55100", supervisor="K. Supervisor", employer_knew="09/03/2026", claim_form_date="09/04/2026",
                desc_short="twisted R knee lifting pallet")
    old = dict(carrier=CARRIERS["OLD"], claim="TEST-PC-2019-0811", doi="2019-06-11", adjuster="RANDY OLDCLAIM", adj_phone="555-0232", employer="FORMER TRUCKING CO (TEST)")
    pages = [
        cover(rng, D["clinic"], D["fax"], "Caliber DME Billing", 24, "Referral for DME for Daniel Rivera (WC). Includes old records from his 2019 claim at the patient's request. Attorney letter enclosed. Call Nina's MA at 555-0212 with questions."),
        face_sheet(rng, pt, D, [("Primary (work injury)", f'{case["carrier"]["name"]}  Claim {case["claim"]}'), ("Personal health plan", f"{PERSONAL_PLAN}  ID TPC771002345 (spouse's plan)"), ("Prior WC claim", f'{old["carrier"]["name"]}  {old["claim"]}  DOI 06/11/2019 (closed)')]),
        card(rng, PERSONAL_PLAN, "TPC771002345", "TG-31100", "MARIA RIVERA + DEPENDENTS"),
        employee_claim(rng, pt, case),
        first_report(rng, pt, case, D, "Employee was lifting a pallet of boxes from a low shelf when his right foot slipped and his right knee twisted. Felt a pop. Unable to continue working.", "Right knee pain 7/10, swelling, giving way on stairs.", "Moderate effusion R knee, positive Lachman, medial joint line tenderness. Left knee normal.", ["S83.511A", "M25.561"], "Ice, NSAIDs, knee immobilizer for comfort, MRI ordered, refer to orthopedics.", "Modified duty: no lifting over 10 lb, seated work only, until 09/24/2026."),
        letter(rng, "Example & Example Law Group (Sample)", "500 Advocate Plaza, San Diego, CA 92101", "555-0250", "NOTICE OF REPRESENTATION", "09/18/2026", [f'{case["carrier"]["name"]}', f'Attn: {case["adjuster"]}'], [("Applicant", f'{pt["first"]} {pt["last"]}'), ("Claim number", case["claim"]), ("DOI", us(case["doi"])), ("Attorney phone", "555-0177 ext 2")],
               "Please be advised this office represents the applicant. Direct all communication regarding this claim to the undersigned. (Sample letter.)", "Sam Lawyerly, Esq. (fictional)"),
        imaging(rng, pt, "09/20/2026", "MRI right knee without contrast", "Partial-thickness tear of the anterior cruciate ligament. Small horizontal tear of the posterior horn medial meniscus. Joint effusion. Left knee not imaged.", "1. Partial ACL tear, right. 2. Medial meniscus tear, right."),
        pr2(rng, pt, case, A, "09/24/2026", ["Periodic report", "Change in treatment plan"], "Ongoing right knee instability.", "Positive Lachman 1+, effusion improved.", ["S83.511A", "S83.241A"], "PT 2x/week x 6 weeks. Hinged brace. Consider arthroscopy if no improvement.", "Modified duty continues."),
        pr2(rng, pt, case, A, "10/08/2026", ["Change in treatment plan", "Request for authorization"], "Knee still gives way; pain 5/10 at night.", "Effusion trace. Instability persists.", ["S83.511A", "S83.241A", "M25.561"], "Request hinged knee brace L1833 and cold therapy unit E0218 (rental 4 weeks) pending arthroscopy on 10/27/2026. Continue PT.", "Modified duty; no climbing ladders."),
        rfa(rng, pt, case, A, [("L1833", "S83.511A", "qty 1, purchase"), ("E0218", "S83.511A", "4 wk post-op"), ("E0114", "S83.511A", "qty 1 pair")], response={"status": "partial", "auth": "TEST-AUTH-10442-A", "by": "JORDAN SAMPLE", "date": "10/10/2026", "note": "L1833 + E0114 ok. E0218 non-cert - see UR"}),
        ur_decision(rng, case, pt, "10/10/2026", [("L1833", "CERTIFIED"), ("E0114", "CERTIFIED"), ("E0218", "NOT CERTIFIED - not supported before surgery")], "TEST-AUTH-10442-A"),
        swo(rng, pt, A, "10/08/2026", [("L1833", "1"), ("E0218", "1"), ("E0114", "1 pair")], ["S83.511A", "S83.241A"], "6 months"),
        chart_note(rng, pt, A, "10/08/2026", "ORTHOPEDIC FOLLOW-UP NOTE", "42-year-old forklift operator, right knee injury at work 09/03/2026. MRI: partial ACL tear and medial meniscus tear. Failed 4 weeks PT. Plan arthroscopy 10/27/2026. Brace now; cold therapy after surgery; crutches for post-op. Note: patient also has history of LEFT ankle sprain from a 2019 work injury (closed claim, Pinecrest Casualty) - not related to current claim."),
        med_list(rng, pt, [["Ibuprofen", "600 mg", "1 tab three times daily with food", "N. Placeholder"], ["Omeprazole", "20 mg", "1 cap daily", "N. Placeholder"], ["Lisinopril", "10 mg", "1 tab daily", "Primary care"]], "No known drug allergies."),
        *(pt_daily(rng, pt, d, n, "Right knee", "Pt reports knee buckled twice this week. Progressing slowly. Recommend brace for community ambulation.") for d, n in [("09/26/2026", 1), ("09/29/2026", 2), ("10/01/2026", 3), ("10/06/2026", 4)]),
        letter(rng, old["carrier"]["name"], old["carrier"]["addr"], old["carrier"]["phone"], "NOTICE OF CLAIM CLOSURE", "02/14/2020", [f'{pt["first"]} {pt["last"]}', "410 SAMPLE AVE APT 3, SAN DIEGO CA 92103"], [("Claim number", old["claim"]), ("Date of injury", "06/11/2019"), ("Employer", old["employer"]), ("Adjuster", f'{old["adjuster"]}  {old["adj_phone"]}')],
               "Your claim for a left ankle sprain has been closed. No further benefits are payable on this claim. (Sample letter.)", "Claims Department"),
        chart_note(rng, pt, D, "06/12/2019", "URGENT CARE NOTE (2019 - OLD CLAIM)", "Left ankle inversion injury at work 06/11/2019 (former employer FORMER TRUCKING CO). Ankle sprain S93.401A. Walking boot L4361 dispensed. Return to work 06/20/2019."),
        letter(rng, case["carrier"]["name"], case["carrier"]["addr"], case["carrier"]["phone"], "MEDICAL PROVIDER NETWORK (MPN) NOTICE", "09/05/2026", [f'{pt["first"]} {pt["last"]}'], [("Claim number", case["claim"]), ("MPN", "SAMPLE COMP CARE MPN (fictional)"), ("MPN contact", "555-0260")],
               "Your employer uses a medical provider network. You may change treating physicians within the network. (Sample letter.)", "MPN Coordinator"),
        junk(rng, "survey"),
        letter(rng, case["carrier"]["name"], case["carrier"]["addr"], case["carrier"]["phone"], "NURSE CASE MANAGER UPDATE", "10/12/2026", [f'Claim {case["claim"]}'], [("NCM", "Pat Nurseperson, RN (fictional)  555-0179"), ("Adjuster", f'{case["adjuster"]}  {case["adj_phone"]}')],
               "Spoke with the patient and the orthopedic office. Surgery scheduled 10/27/2026. Patient asked about cold therapy; advised it was not certified at this time and may be re-requested after surgery. (Sample note.)", "Pat Nurseperson RN"),
        *supplier_forms(rng, pt, "Daniel Rivera"),
    ]
    P.append(("01-wc-kitchen-sink-24pg", "ok", "(555) 010-0211 Harbor Occ Health", pages, {
        "scenario": "Work Comp, new patient. A long referral with lots of noise.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-RIVERA", "firstName": "DANIEL", "middleInitial": "J", "dob": "1984-02-17", "sex": "M", "ssn": "000000101", "address1": "410 SAMPLE AVE APT 3", "city": "SAN DIEGO", "state": "CA", "zip": "92103", "phone": "555-0121", "cellPhone": "555-0122", "email": "d.rivera@example.test", "employer": "EXAMPLE FREIGHT LLC"},
                    "insurance_primary": {"payerName": CARRIERS["GOLD"]["name"], "payerType": "WC", "claimNumber": "TEST-WC-10442", "dateOfInjury": "2026-09-03", "employerName": "EXAMPLE FREIGHT LLC", "adjusterName": "JORDAN SAMPLE", "adjusterPhone": "555-0177", "authorizationNumber": "TEST-AUTH-10442-A"},
                    "orderingPhysician": A["name"], "hcpcs_ordered": ["L1833", "E0218", "E0114"], "hcpcs_approved": ["L1833", "E0114"], "icd10": ["S83.511A", "S83.241A", "M25.561"]},
        "traps": ["Spouse Maria Rivera's DOB (05/30/1986), phone and employer appear on the face sheet and personal insurance card.",
                  "Personal health plan card (PACIFIC COAST HEALTH PLAN) is NOT the payer for a work injury.",
                  "Old 2019 claim TEST-PC-2019-0811 (PINECREST CASUALTY, left ankle, DOI 06/11/2019, adjuster RANDY OLDCLAIM) is closed and unrelated.",
                  "Attorney letter lists phone '555-0177 ext 2'; the adjuster's phone is 555-0177 (no extension); attorney is not the adjuster.",
                  "E0218 cold therapy was requested but NOT certified by UR; only L1833 and E0114 are authorized.",
                  "Nurse case manager phone 555-0179 is not the adjuster's.",
                  "Old 2019 note lists ICD S93.401A and HCPCS L4361 - not part of this order.",
                  "Patient goes by 'Danny'; legal first name is DANIEL."],
    }))

    # ---------------------------------------------------------------- 2. misfiled page, duplicates, upside-down page
    pt = dict(last="DEMO-CHEN", first="LINDA", dob="1979-11-08", sex="F", ssn="000-00-0102", addr="77 TEST LANE", city="AUSTIN", state="TX", zip="78702", phone="555-0131", employer="SAMPLE BAKERY CO", occupation="Baker",
              contact=[("Name", "Wei Chen (brother)"), ("Phone", "555-0132")])
    other = dict(last="DEMO-CHENG", first="LINDSAY", dob="1981-11-18", sex="F", addr="12 OTHER RD", city="AUSTIN", state="TX", zip="78704", phone="555-0139")
    case = dict(carrier=CARRIERS["SUN"], claim="TEST-TX-58810", doi="2026-09-28", adjuster="MORGAN EXAMPLE", adj_phone="555-0178", employer="SAMPLE BAKERY CO", employer_addr="5 Flour St, Austin, TX 78702", business="Commercial bakery", rfa_date="2026-10-06", where="Bakery floor", hour="6:15 AM",
                desc_short="fell on R wrist on wet floor", supervisor="D. Manager", claim_form_date="09/29/2026", employer_knew="09/28/2026", policy="TEST-TXPOL-7781")
    rx = swo(rng, pt, B, "10/06/2026", [("L3809", "1")], ["S63.501A"], "3 months", "wear at all times x 6 wks", hand="neat")
    misfiled = chart_note(rng, other, B, "10/06/2026", "OFFICE VISIT NOTE", "Patient seen for LEFT shoulder pain after a fall at home (not work related). Diagnosis M75.101 rotator cuff tear. Plan: sling, MRI. Bill personal insurance. (This page belongs to a different patient: DEMO-CHENG, LINDSAY.)")
    pages = [
        cover(rng, B["clinic"], B["fax"], "Caliber billing", 22, "Wrist brace Rx for WC pt Linda Chen\npls verify w/ adjuster Morgan\nsorry if pages out of order", hand=True),
        face_sheet(rng, pt, B, [("Work comp", f'{case["carrier"]["name"]}  Claim {case["claim"]}')]),
        employee_claim(rng, pt, case),
        rx,
        first_report(rng, pt, case, B, "Slipped on a wet floor near the proofing ovens and fell onto an outstretched right hand.", "Right wrist pain 6/10, worse with gripping.", "Dorsal wrist tenderness, no deformity. X-ray negative for fracture.", ["S63.501A"], "Wrist orthosis, ice, NSAIDs, recheck 3 weeks.", "Off work 1 week, then light duty with no use of right hand."),
        imaging(rng, pt, "09/28/2026", "X-ray right wrist 3 views", "No acute fracture or dislocation. Soft tissue swelling dorsally.", "No fracture. Soft tissue injury."),
        misfiled,
        rfa(rng, pt, case, B, [("L3809", "S63.501A", "qty 1")], hand="neat", flip=True),
        rx,  # duplicate page
        pr2(rng, pt, case, B, "10/06/2026", ["Periodic report", "Request for authorization"], "Still painful with lifting trays.", "Grip strength reduced 40% vs left.", ["S63.501A"], "WHFO L3809 full time 6 weeks. Hand therapy 2x/week x 4 weeks.", "Light duty: no lifting over 5 lb with right hand."),
        letter(rng, case["carrier"]["name"], case["carrier"]["addr"], case["carrier"]["phone"], "PREAUTHORIZATION APPROVAL", "10/09/2026", [B["clinic"]], [("Claim number", case["claim"]), ("Employee", f'{pt["last"]}, {pt["first"]}'), ("Approved", "L3809 x 1"), ("Preauthorization #", "TEST-TXPA-2201"), ("Adjuster", f'{case["adjuster"]}  {case["adj_phone"]}')],
               "Preauthorization is approved for the item listed. (Sample letter.)", "Morgan Example"),
        *(pt_daily(rng, pt, d, n, "Right wrist", "Edema decreasing. Tolerating splint.") for d, n in [("10/07/2026", 1), ("10/09/2026", 2), ("10/12/2026", 3), ("10/14/2026", 4)]),
        med_list(rng, pt, [["Naproxen", "500 mg", "twice daily with food", "R. Example"]], "Penicillin (rash)."),
        junk(rng, "blank"),
        delivery(rng, pt, [("L3809", "RT", "WR-55102")], "DT-20261010-11", "10/10/2026", "Linda Chen"),
        *supplier_forms(rng, pt, "Linda Chen"),
        junk(rng, "ad"),
        misfiled,  # the wrong patient again
    ]
    P.append(("02-wc-misfiled-duplicate-upsidedown-22pg", "bad", "(555) 010-0155 Desert Sports", pages, {
        "scenario": "Work Comp (Texas), new patient. Poor fax. Contains a misfiled page from a DIFFERENT patient (twice), a duplicated Rx page, an upside-down RFA page, a blank page and a junk ad.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-CHEN", "firstName": "LINDA", "dob": "1979-11-08", "sex": "F", "ssn": "000000102", "address1": "77 TEST LANE", "city": "AUSTIN", "state": "TX", "zip": "78702", "phone": "555-0131", "employer": "SAMPLE BAKERY CO"},
                    "insurance_primary": {"payerName": CARRIERS["SUN"]["name"], "payerType": "WC", "claimNumber": "TEST-TX-58810", "dateOfInjury": "2026-09-28", "adjusterName": "MORGAN EXAMPLE", "adjusterPhone": "555-0178", "authorizationNumber": "TEST-TXPA-2201"},
                    "orderingPhysician": B["name"], "hcpcs_ordered": ["L3809"], "icd10": ["S63.501A"]},
        "traps": ["Pages 7 and 22 belong to a different patient (DEMO-CHENG, LINDSAY, DOB 11/18/1981, left shoulder, M75.101). A good reader flags this and does NOT mix her details in.",
                  "Page 8 (the RFA) is upside down.", "Page 9 duplicates the Rx on page 4.", "Brother Wei Chen's phone 555-0132 is not the patient's."],
    }))

    # ---------------------------------------------------------------- 3. address/name changes and handwritten corrections
    pt = dict(last="DEMO-OCONNOR-WELLS", first="KATHERINE", mi="A", nick="Kate", dob="1991-08-05", sex="F", ssn="000-00-0103", addr="18 OLD HARBOR DR", city="SAN DIEGO", state="CA", zip="92106", phone="555-0141", cell="555-0142", email="kate.ow@example.test",
              employer="EXAMPLE CITY SCHOOLS", occupation="Custodian", marital="Married", contact=[("Name", "Tom Wells (husband)"), ("Phone", "555-0143")])
    case = dict(carrier=CARRIERS["GOLD"], claim="TEST-WC-20733", doi="2026-08-21", adjuster="CASEY TESTER", adj_phone="555-0176", employer="EXAMPLE CITY SCHOOLS", employer_addr="1 District Way, San Diego, CA 92101", business="Public school district", rfa_date="2026-10-05",
                where="Gym storage room", hour="3:30 PM", desc_short="hurt low back lifting mats", supervisor="J. Facilities", claim_form_date="08/22/2026", employer_knew="08/21/2026", policy="TEST-SELF-INSURED")
    pages = [
        cover(rng, A["clinic"], A["fax"], "Caliber DME Billing", 20, "LSO and TENS for Katherine O'Connor-Wells. NOTE: patient moved, new address on the updated intake (page 4). Maiden name O'Connor on older records."),
        face_sheet(rng, pt, A, [("Work comp", f'{case["carrier"]["name"]}  Claim {case["claim"]}')]),
        doc(rng, "PATIENT INFORMATION UPDATE", A["clinic"], None, [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", us(pt["dob"]))]), ("fix", "Address", "18 OLD HARBOR DR, SAN DIEGO CA 92106", "2290 NEW MESA RD #12, SAN DIEGO CA 92123"),
                                                                 ("fix", "Home phone", "555-0141", "none - use cell"), ("fix", "Last name", "O'CONNOR", "O'CONNOR-WELLS"), ("kv", [("Updated on", "10/02/2026"), ("Staff", "front desk - LM")])]),
        handwritten_intake(rng, dict(pt, addr="2290 NEW MESA RD #12", zip="92123"), case, "back brace + TENS", "low back strain / sciatica"),
        employee_claim(rng, dict(pt, last="DEMO-OCONNOR"), case),
        first_report(rng, dict(pt, last="DEMO-OCONNOR"), case, D, "Lifting stacked gym mats overhead, felt sharp low back pain radiating to the left leg.", "Low back pain 8/10 with numbness down left leg.", "Paraspinal spasm, positive straight leg raise left at 40 degrees.", ["M54.50", "M51.16"], "Medication, PT, MRI lumbar spine.", "Off work until 09/01/2026."),
        imaging(rng, pt, "09/10/2026", "MRI lumbar spine", "L4-5 disc protrusion contacting the left L5 nerve root. Mild facet arthropathy.", "L4-5 disc protrusion with left L5 radiculopathy correlation."),
        pr2(rng, pt, case, A, "10/05/2026", ["Change in treatment plan", "Request for authorization"], "Back pain 6/10, leg numbness intermittent.", "Spasm decreased. SLR positive left 60 degrees.", ["M51.16", "M54.50"], "LSO L0650 for activity. TENS E0730 with supplies A4595 monthly x 3. Continue PT 2x/week.", "Modified duty: no lifting over 15 lb."),
        rfa(rng, pt, case, A, [("L0650", "M51.16", "qty 1"), ("E0730", "M51.16", "30-day trial rental"), ("A4595", "M51.16", "monthly x 3")], response={"status": "approved", "auth": "TEST-AUTH-20733", "by": "CASEY TESTER", "date": "10/07/2026"}),
        swo(rng, pt, A, "10/05/2026", [("L0650", "1"), ("E0730", "1 (30-day trial)"), ("A4595", "1 per month x 3")], ["M51.16", "M54.50"], "3 months"),
        ur_decision(rng, case, pt, "10/07/2026", [("L0650", "CERTIFIED"), ("E0730", "CERTIFIED - 30 day trial"), ("A4595", "CERTIFIED x 3 months")], "TEST-AUTH-20733"),
        *(pt_daily(rng, pt, d, n, "Lumbar spine", "Tolerating core program; increased pain after work shifts.") for d, n in [("09/15/2026", 1), ("09/17/2026", 2), ("09/22/2026", 3), ("09/24/2026", 4), ("09/29/2026", 5)]),
        med_list(rng, pt, [["Cyclobenzaprine", "5 mg", "at bedtime as needed", "A. Sample"], ["Gabapentin", "300 mg", "three times daily", "A. Sample"]], "Sulfa (hives)."),
        delivery(rng, pt, [("L0650", "", "LSO-88231"), ("E0730", "RR", "TENS-41007")], "DT-20261009-02", "10/09/2026", "Kate Wells", ship_addr="2290 NEW MESA RD #12, SAN DIEGO, CA 92123"),
        *supplier_forms(rng, pt, "Kate Wells")[:2],
    ]
    P.append(("03-wc-moved-name-change-corrections-20pg", "ok", "(555) 010-0144 Example Ortho", pages, {
        "scenario": "Work Comp, new patient. She moved and changed her name; old address, old phone and maiden name appear on several pages; staff corrected values by hand.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-OCONNOR-WELLS", "firstName": "KATHERINE", "middleInitial": "A", "dob": "1991-08-05", "sex": "F", "ssn": "000000103", "address1": "2290 NEW MESA RD #12", "city": "SAN DIEGO", "state": "CA", "zip": "92123", "phone": "(none)", "cellPhone": "555-0142", "email": "kate.ow@example.test", "employer": "EXAMPLE CITY SCHOOLS"},
                    "insurance_primary": {"payerName": CARRIERS["GOLD"]["name"], "payerType": "WC", "claimNumber": "TEST-WC-20733", "dateOfInjury": "2026-08-21", "adjusterName": "CASEY TESTER", "adjusterPhone": "555-0176", "authorizationNumber": "TEST-AUTH-20733"},
                    "orderingPhysician": A["name"], "hcpcs_ordered": ["L0650", "E0730", "A4595"], "icd10": ["M51.16", "M54.50"]},
        "traps": ["Old address 18 OLD HARBOR DR 92106 and old home phone 555-0141 appear on the face sheet; the update page and intake show the NEW address.",
                  "Older pages use the maiden last name DEMO-OCONNOR.", "Preferred name 'Kate' vs legal 'KATHERINE'.", "Husband Tom Wells's phone 555-0143 is not hers."],
    }))

    # ---------------------------------------------------------------- 4. VA CCN with an expired and an active referral
    pt = dict(last="DEMO-WASHINGTON", first="JAMES", mi="R", dob="1958-05-30", sex="M", addr="3 VETERAN WAY", city="PHOENIX", state="AZ", zip="85003", phone="555-0151", cell="555-0152", marital="Widowed",
              contact=[("Name", "Denise Washington (daughter)"), ("DOB", "02/14/1984"), ("Phone", "555-0153")])
    old_ref = dict(referral="TEST-CCN-31007", seoc="Orthopedics - Knee, Initial", auth="TEST-AUTH-31007", episode="01/05/2026 - 06/30/2026", member="4471", status="EXPIRED", visits="6 visits")
    new_ref = dict(referral="TEST-CCN-55120", seoc="Orthopedics - Knee, Continuation", auth="TEST-AUTH-55120-1", episode="10/01/2026 - 03/31/2027", member="4471", status="ACTIVE", visits="8 visits")
    pages = [
        cover(rng, C["clinic"], C["fax"], "Caliber DME Billing", 21, "Walker + RFS for Mr. Washington. Old referral included for reference - use the ACTIVE one. He also has a Medicare Advantage card; VA is paying for this."),
        seoc_referral(rng, pt, new_ref, C),
        seoc_referral(rng, pt, old_ref, C, "EXPIRED 06/30/26 - do not use"),
        va_rfs(rng, pt, C, "VA Sample Health Care System - Phoenix (fictional)", [("E0143", "SampleMed FoldWalk 500 (fictional)", "1", "Height 5'10\", handle 34\"")], ["M17.11"], "Two near-falls in the last month due to right knee OA. Needs a wheeled walker for home and community. Fitting and training completed in clinic 10/03/2026.", "home"),
        face_sheet(rng, pt, C, [("VA community care", f'{CARRIERS["CCN"]["name"]}  Referral {new_ref["referral"]}'), ("Other coverage", f"{ADV_PLAN}  ID TSA-552-0091 (not for VA referral care)")]),
        card(rng, ADV_PLAN, "TSA-552-0091", "TG-ADV01", "JAMES R WASHINGTON", "Medicare Advantage HMO (sample)"),
        swo(rng, pt, C, "10/03/2026", [("E0143", "1")], ["M17.11"], "99 months (lifetime)", "Unsteady gait, falls risk."),
        *(chart_note(rng, pt, C, d, t, b) for d, t, b in [
            ("03/10/2026", "OFFICE VISIT", "Right knee OA (M17.11). Steroid injection given. Cane recommended. Old referral TEST-CCN-31007 in effect."),
            ("06/02/2026", "OFFICE VISIT", "Knee pain improved after injection. Using cane. Episode of care ends 06/30/2026."),
            ("10/03/2026", "OFFICE VISIT", "Worsening right knee OA, two near-falls. New referral TEST-CCN-55120 received. Plan: folding wheeled walker E0143, home exercise, consider repeat injection in 6 weeks."),
        ]),
        imaging(rng, pt, "09/28/2026", "X-ray right knee 3 views", "Severe medial joint space narrowing with osteophytes. No fracture.", "Advanced osteoarthritis right knee."),
        med_list(rng, pt, [["Acetaminophen", "500 mg", "2 tabs up to 3x daily", "S. Testwell"], ["Metformin", "500 mg", "twice daily", "VA PCP"], ["Atorvastatin", "20 mg", "daily", "VA PCP"]], "Codeine (nausea)."),
        letter(rng, CARRIERS["CCN"]["name"], CARRIERS["CCN"]["addr"], CARRIERS["CCN"]["phone"], "REFERRAL APPROVAL NOTICE", "10/01/2026", [f'{pt["first"]} {pt["last"]}', f'{pt["addr"]}, {pt["city"]}, {pt["state"]} {pt["zip"]}'], [("Referral number", new_ref["referral"]), ("Authorization", new_ref["auth"]), ("Episode", new_ref["episode"]), ("Provider", C["name"])],
               "Your community care referral has been approved. (Sample letter.)", "Community Care Coordinator"),
        *(junk(rng, "blank") for _ in range(1)),
        doc(rng, "TELEPHONE ENCOUNTER", C["clinic"], None, [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("Date", "10/06/2026"), ("Caller", "Denise Washington (daughter) 555-0153")]), ("para", "Daughter called asking when walker will be delivered. Prefers delivery to her house: 88 DAUGHTER LN, MESA AZ 85201. Told her it must go to the address on the referral unless the Veteran updates his address with the VA. (Sample note.)")]),
        delivery(rng, pt, [("E0143", "NU", "WLK-0098812")], "DT-20261015-07", "10/15/2026", "James Washington"),
        *supplier_forms(rng, pt, "James Washington"),
        letter(rng, "VA Sample Health Care System (fictional)", "650 Federal Way, Phoenix, AZ 85012", "555-0270", "APPOINTMENT REMINDER", "09/20/2026", [f'{pt["first"]} {pt["last"]}'], [("Clinic", "Primary care"), ("Date", "11/02/2026 9:00 AM")], "Please arrive 15 minutes early. (Sample letter.)", "Scheduling"),
    ]
    P.append(("04-va-ccn-expired-vs-active-referral-21pg", "ok", "(555) 010-0166 Veterans Clinic", pages, {
        "scenario": "VA Community Care, new veteran. Two referrals: an EXPIRED one and an ACTIVE one. Also a Medicare Advantage card that is not the payer for VA referral care.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-WASHINGTON", "firstName": "JAMES", "middleInitial": "R", "dob": "1958-05-30", "sex": "M", "address1": "3 VETERAN WAY", "city": "PHOENIX", "state": "AZ", "zip": "85003", "phone": "555-0151", "cellPhone": "555-0152"},
                    "insurance_primary": {"payerName": CARRIERS["CCN"]["name"], "payerType": "VA_CCN", "referralNumber": "TEST-CCN-55120", "authorizationNumber": "TEST-AUTH-55120-1"},
                    "orderingPhysician": C["name"], "hcpcs_ordered": ["E0143"], "icd10": ["M17.11"]},
        "traps": ["Expired referral TEST-CCN-31007 / TEST-AUTH-31007 (ended 06/30/2026).", "Medicare Advantage card TSA-552-0091 is not the payer here.",
                  "Daughter Denise's DOB, phone, and requested delivery address (88 DAUGHTER LN, MESA) are not the Veteran's."],
    }))

    # ---------------------------------------------------------------- 5. VA direct with cancelled items
    pt = dict(last="DEMO-OKAFOR", first="GRACE", dob="1969-12-02", sex="F", addr="12 PRACTICE CT", city="SAN DIEGO", state="CA", zip="92108", phone="555-0161", contact=[("Name", "Chidi Okafor (son)"), ("Phone", "555-0162")])
    pages = [
        cover(rng, CARRIERS["VAD"]["name"], CARRIERS["VAD"]["fax"], "SCORE (DEMO) / Caliber", 20, "Prosthetics authorization for Ms. Okafor. Revised: the TENS was cancelled. Only deliver what is ACTIVE on the latest authorization (dated 10/12)."),
        va_2421(rng, pt, "TEST-VA-PO-7719", [("L0650", "1", "ACTIVE"), ("E0730", "1", "ACTIVE"), ("A4595", "3", "ACTIVE")], "10/02/2026"),
        va_2421(rng, pt, "TEST-VA-PO-7719-R1", [("L0650", "1", "ACTIVE"), ("E0730", "1", "CANCELLED"), ("A4595", "3", "CANCELLED")], "10/12/2026", "TENS cancelled per Dr - pt has pacemaker"),
        swo(rng, pt, A, "09/30/2026", [("L0650", "1"), ("E0730", "1"), ("A4595", "3")], ["M54.50", "M51.16"], "6 months", "LSO + TENS for chronic LBP", hand="neat"),
        *(chart_note(rng, pt, A, d, t, b) for d, t, b in [
            ("09/30/2026", "CONSULT NOTE", "Veteran with chronic low back pain (M54.50) and lumbar radiculopathy (M51.16). Failed 8 weeks PT. Plan: LSO L0650 for activity; TENS trial."),
            ("10/11/2026", "ADDENDUM", "Chart review shows the Veteran has a cardiac pacemaker (placed 2022). TENS is contraindicated. Cancel TENS and supplies. Continue LSO only."),
        ]),
        face_sheet(rng, pt, A, [("Coverage", f'{CARRIERS["VAD"]["name"]}  (prosthetics authorization)')]),
        imaging(rng, pt, "08/12/2026", "MRI lumbar spine", "Multilevel degenerative disc disease, most pronounced at L4-5 with mild foraminal narrowing on the left.", "Degenerative disc disease L4-5."),
        med_list(rng, pt, [["Meloxicam", "15 mg", "daily", "A. Sample"], ["Metoprolol", "25 mg", "twice daily", "VA Cardiology"], ["Apixaban", "5 mg", "twice daily", "VA Cardiology"]], "Latex."),
        *(pt_daily(rng, pt, d, n, "Lumbar spine", "Core stabilization; pain unchanged.") for d, n in [("08/20/2026", 1), ("08/27/2026", 2), ("09/03/2026", 3), ("09/10/2026", 4), ("09/17/2026", 5), ("09/24/2026", 6)]),
        letter(rng, "VA Sample Health Care System (fictional)", "3350 Sample Dr, San Diego, CA 92161", "555-0102", "PROSTHETICS VENDOR INSTRUCTIONS", "10/12/2026", [SUPPLIER["name"]], [("Authorization", "TEST-VA-PO-7719-R1 (replaces TEST-VA-PO-7719)"), ("Contact", "Prosthetics purchasing agent 555-0280")],
               "Deliver within 10 business days. Invoice using the revised authorization number. (Sample letter.)", "Prosthetics Purchasing Agent"),
        delivery(rng, pt, [("L0650", "", "LSO-90112")], "DT-20261014-05", "10/14/2026", "Grace Okafor"),
        *supplier_forms(rng, pt, "Grace Okafor")[:2],
    ]
    P.append(("05-va-direct-revised-auth-cancelled-items-20pg", "ok", "(555) 010-0107 VA Prosthetics", pages, {
        "scenario": "VA direct (prosthetics). The first authorization included a TENS unit; the revised authorization cancels it (patient has a pacemaker). Only the LSO should be delivered and billed.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-OKAFOR", "firstName": "GRACE", "dob": "1969-12-02", "sex": "F", "address1": "12 PRACTICE CT", "city": "SAN DIEGO", "state": "CA", "zip": "92108", "phone": "555-0161"},
                    "insurance_primary": {"payerName": CARRIERS["VAD"]["name"], "payerType": "VA_DIRECT", "authorizationNumber": "TEST-VA-PO-7719-R1"},
                    "orderingPhysician": A["name"], "hcpcs_ordered": ["L0650", "E0730", "A4595"], "hcpcs_active": ["L0650"], "icd10": ["M54.50", "M51.16"]},
        "traps": ["Original authorization TEST-VA-PO-7719 was replaced by TEST-VA-PO-7719-R1.", "E0730 and A4595 are CANCELLED on the revised authorization.", "Son Chidi's phone 555-0162 is not hers."],
    }))

    # ---------------------------------------------------------------- 6. existing patient ONE with a NEW second injury claim
    pt = dict(last="TEST-SCORE", first="PATIENT ONE", dob="1980-01-01", sex="M", ssn="000-00-0001", addr="123 TEST STREET", city="SAN DIEGO", state="CA", zip="92101", phone="555-0199", employer="TEST EMPLOYER INC", occupation="Loader",
              contact=[("Name", "Pat Test (sibling)"), ("Phone", "555-0198")])
    case_old = dict(carrier=CARRIERS["GOLD"], claim="TEST-CLM-00", doi="2026-08-01", adjuster="TEST ADJUSTER", adj_phone="555-0177", employer="TEST EMPLOYER INC")
    case = dict(carrier=CARRIERS["GOLD"], claim="TEST-WC-31950", doi="2026-10-01", adjuster="ALEX NEWADJUSTER", adj_phone="555-0175", employer="TEST EMPLOYER INC", employer_addr="400 Industry Rd, San Diego, CA 92113", business="Logistics", rfa_date="2026-10-09",
                where="Loading dock 3", hour="1:10 PM", desc_short="hurt R shoulder lifting overhead", supervisor="T. Lead", claim_form_date="10/02/2026", employer_knew="10/01/2026", policy="TEST-POL-55100")
    pages = [
        cover(rng, A["clinic"], A["fax"], "Caliber DME Billing", 25, "Existing pt of yours (knee claim) - this is a NEW injury, right shoulder, NEW claim number. Please set up separately from the knee claim."),
        face_sheet(rng, pt, A, [("WC claim 1 (knee)", f'{case_old["claim"]}  DOI 08/01/2026  Adj {case_old["adjuster"]}'), ("WC claim 2 (shoulder)", f'{case["claim"]}  DOI 10/01/2026  Adj {case["adjuster"]} {case["adj_phone"]}')]),
        employee_claim(rng, pt, case),
        first_report(rng, pt, case, D, "Lifting boxes onto an overhead shelf, felt a tearing sensation in the right shoulder.", "Right shoulder pain 7/10, cannot raise arm above shoulder.", "Painful arc, weakness in external rotation, positive drop arm test right.", ["S43.421A", "M75.101"], "Sling, ice, MRI, ortho referral.", "Modified duty: no use of right arm."),
        imaging(rng, pt, "10/05/2026", "MRI right shoulder", "Full-thickness tear of the supraspinatus tendon with 1 cm retraction. Mild AC joint arthropathy.", "Full-thickness rotator cuff tear, right."),
        pr2(rng, pt, case, A, "10/09/2026", ["Need for surgery or hospitalization", "Request for authorization"], "Shoulder pain, unable to sleep on right side.", "Weakness ER 3/5. Positive impingement signs.", ["M75.101", "S43.421A"], "Arthroscopic rotator cuff repair 10/30/2026. Post-op cold therapy E0218 x 21 days. Shoulder sling.", "Modified duty, no right arm use."),
        rfa(rng, pt, case, A, [("E0218", "M75.101", "21 days post-op")], response={"status": "approved", "auth": "TEST-AUTH-31950", "by": "ALEX NEWADJUSTER", "date": "10/13/2026"}),
        ur_decision(rng, case, pt, "10/13/2026", [("E0218", "CERTIFIED x 21 days")], "TEST-AUTH-31950"),
        swo(rng, pt, A, "10/09/2026", [("E0218", "1 (21-day rental)")], ["M75.101", "S43.421A"], "21 days"),
        pr2(rng, pt, case_old, A, "09/24/2026", ["Periodic report"], "Knee improving with brace.", "Trace effusion right knee.", ["S83.511A", "M25.561"], "Continue brace L1833 and cold therapy E0218 as previously authorized. PT.", "Modified duty."),
        letter(rng, case_old["carrier"]["name"], case_old["carrier"]["addr"], case_old["carrier"]["phone"], "UTILIZATION REVIEW DECISION (KNEE CLAIM)", "08/20/2026", [f'Employee {pt["last"]}, {pt["first"]}'], [("Claim number", "TEST-CLM-00"), ("Authorization #", "TEST-AUTH-44120"), ("Certified", "E0218, L1833")],
               "Prior decision on the knee claim, included for reference. (Sample letter.)", "UR Department"),
        *(pt_daily(rng, pt, d, n, "Right knee (claim TEST-CLM-00)", "Knee therapy continues under the knee claim.") for d, n in [("09/16/2026", 7), ("09/18/2026", 8), ("09/23/2026", 9), ("09/25/2026", 10)]),
        *(chart_note(rng, pt, A, d, t, b) for d, t, b in [
            ("10/09/2026", "ORTHOPEDIC CONSULT - SHOULDER", "New work injury 10/01/2026, right shoulder, claim TEST-WC-31950 (adjuster Alex Newadjuster 555-0175). Separate from the 08/01/2026 knee claim TEST-CLM-00. Surgery planned 10/30/2026 with post-op cold therapy."),
            ("10/09/2026", "KNEE FOLLOW-UP", "Knee (claim TEST-CLM-00) stable in brace. No new DME needed for the knee."),
        ]),
        med_list(rng, pt, [["Ibuprofen", "800 mg", "three times daily", "A. Sample"], ["Tramadol", "50 mg", "every 6 hours as needed", "A. Sample"]], "No known drug allergies."),
        junk(rng, "ad"),
        doc(rng, "PRE-OPERATIVE INSTRUCTIONS", A["clinic"], None, [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("Surgery date", "10/30/2026"), ("Arrive", "6:00 AM")]), ("para", "Nothing to eat or drink after midnight. Bring your sling and cold therapy unit to the surgery center if delivered. (Sample instructions.)")]),
        *supplier_forms(rng, pt, "Patient One"),
        delivery(rng, pt, [("E0218", "RR", "CT-66120")], "DT-20261016-01", "10/16/2026", "Patient One", note="Rental start 10/16 - for SHOULDER (claim 31950)"),
    ]
    P.append(("06-existing-patient-one-new-second-claim-25pg", "ok", "(555) 010-0144 Example Ortho", pages, {
        "scenario": "EXISTING patient (TEST-SCORE, PATIENT ONE). He already has a knee claim (TEST-CLM-00). This packet is a NEW right-shoulder injury with a NEW claim number and adjuster. Knee pages are included for reference.",
        "expect_match": "existing: TEST-SCORE, PATIENT ONE",
        "correct": {"patient": {"lastName": "TEST-SCORE", "firstName": "PATIENT ONE", "dob": "1980-01-01", "sex": "M", "address1": "123 TEST STREET", "city": "SAN DIEGO", "state": "CA", "zip": "92101"},
                    "insurance_for_this_order": {"payerName": CARRIERS["GOLD"]["name"], "payerType": "WC", "claimNumber": "TEST-WC-31950", "dateOfInjury": "2026-10-01", "adjusterName": "ALEX NEWADJUSTER", "adjusterPhone": "555-0175", "authorizationNumber": "TEST-AUTH-31950"},
                    "orderingPhysician": A["name"], "hcpcs_ordered": ["E0218"], "icd10": ["M75.101", "S43.421A"]},
        "traps": ["The existing knee claim TEST-CLM-00 (DOI 08/01/2026, TEST ADJUSTER, auth TEST-AUTH-44120) must not be overwritten.",
                  "Knee diagnoses S83.511A / M25.561 and L1833 belong to the old claim.", "Sibling Pat Test 555-0198 is not the patient.",
                  "Reviewer should attach to the existing patient and ADD the new claim as another insurance entry, not replace the knee claim. (Today the intake screen only merges by insurance rank - see notes.)"],
    }))

    # ---------------------------------------------------------------- 7. Texas, conflicting dates of injury, lots of handwriting
    pt = dict(last="DEMO-HERNANDEZ", first="LUIS", dob="1977-03-09", sex="M", ssn="000-00-0107", addr="410 RANCH RD", city="AUSTIN", state="TX", zip="78745", phone="555-0171", employer="SAMPLE ROOFING TX", occupation="Roofer", contact=[("Name", "Ana Hernandez (wife)"), ("Phone", "555-0172")])
    case = dict(carrier=CARRIERS["SUN"], claim="TEST-TX-60177", doi="2026-09-29", adjuster="MORGAN EXAMPLE", adj_phone="555-0178", employer="SAMPLE ROOFING TX", employer_addr="22 Shingle Way, Austin, TX 78744", business="Roofing", rfa_date="2026-10-07",
                where="Job site, 9 Elm St", hour="2:00 PM", desc_short="fell off ladder - R ankle", supervisor="R. Foreman", claim_form_date="09/30/2026", employer_knew="09/30/2026", doi_employee="9/29/26", policy="TEST-TXPOL-9921")
    pages = [
        cover(rng, B["clinic"], B["fax"], "Caliber", 20, "boot + crutches for Luis Hernandez\nWC - Sunbelt\nadjuster Morgan 555-0178", hand=True),
        handwritten_intake(rng, pt, case, "walking boot + crutches", "R ankle sprain", {"doi": "9/29/26", "other_ins": "none", "phone": "555-0171"}),
        employee_claim(rng, pt, case),
        letter(rng, case["employer"], case["employer_addr"], "555-0290", "EMPLOYER'S FIRST REPORT OF INJURY", "10/01/2026", [case["carrier"]["name"]], [("Employee", f'{pt["first"]} {pt["last"]}'), ("Date of injury", "09/30/2026"), ("Time", "8:00 AM"), ("Body part", "Right ankle"), ("Witness", "Joe Coworker 555-0291")],
               "Employee reported injury the morning of 09/30 at the start of shift. (Sample report.)", "R. Foreman", quality="bad"),
        first_report(rng, pt, case, B, "Patient states he fell from the second rung of a ladder at a job site on 09/29/2026 at about 2 PM.", "Right ankle pain and swelling, can't put weight on it.", "Lateral ankle swelling and ecchymosis, ATFL tenderness. X-ray negative.", ["S93.401A"], "Pneumatic walking boot and crutches, ice, elevation.", "Off work 2 weeks."),
        swo(rng, pt, B, "10/07/2026", [("L4361", "1"), ("E0114", "1 pair")], ["S93.401A"], "2 months", "boot x 4 wks, WBAT, crutches", hand="messy"),
        rfa(rng, pt, case, B, [("L4361", "S93.401A", "qty 1"), ("E0114", "S93.401A", "1 pair")], hand="messy"),
        letter(rng, case["carrier"]["name"], case["carrier"]["addr"], case["carrier"]["phone"], "PREAUTHORIZATION DETERMINATION", "10/09/2026", [B["clinic"]], [("Claim number", case["claim"]), ("DOI on file", "09/29/2026"), ("Approved", "L4361, E0114"), ("Preauthorization #", "TEST-TXPA-3107")],
               "Approved. Note: employer report lists 09/30/2026; carrier file uses 09/29/2026 per employee and physician. (Sample letter.)", "Morgan Example"),
        *(chart_note(rng, pt, B, d, t, b) for d, t, b in [("10/07/2026", "FOLLOW-UP", "Ankle still swollen. Boot and crutches ordered. Recheck 2 weeks."), ("10/14/2026", "FOLLOW-UP", "Improving in boot. Weight bearing as tolerated.")]),
        imaging(rng, pt, "09/29/2026", "X-ray right ankle 3 views", "No fracture. Lateral soft tissue swelling.", "Negative for fracture."),
        doc(rng, "WORK STATUS REPORT", B["clinic"], "sample work status form (not an official state form)", [("kv", [("Employee", f'{pt["first"]} {pt["last"]}'), ("Date of injury", "09/29/2026"), ("Employer", case["employer"]), ("Carrier", case["carrier"]["name"])]),
                                                                                             ("checks", [("Return to work without restrictions", False), ("Return with restrictions", False), ("Prevented from working", True)]), ("hand", "off work until 10/21/26", "messy"), ("sig", B["sig"], B["name"])]),
        *(pt_daily(rng, pt, d, n, "Right ankle", "Gait training with crutches.") for d, n in [("10/08/2026", 1), ("10/10/2026", 2), ("10/13/2026", 3)]),
        med_list(rng, pt, [["Ibuprofen", "800 mg", "three times daily", "R. Example"]], "None."),
        delivery(rng, pt, [("L4361", "RT", "BT-33017"), ("E0114", "", "CR-11920")], "DT-20261008-04", "10/08/2026", "Luis Hernandez"),
        *supplier_forms(rng, pt, "Luis Hernandez")[:2],
        junk(rng, "blank"),
    ]
    P.append(("07-tx-wc-conflicting-injury-dates-handwritten-20pg", "ok", "(555) 010-0155 Desert Sports", pages, {
        "scenario": "Work Comp (Texas), new patient. Lots of handwriting. The employer report says DOI 09/30/2026 at 8 AM; the employee, doctor and carrier say 09/29/2026 at about 2 PM.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-HERNANDEZ", "firstName": "LUIS", "dob": "1977-03-09", "sex": "M", "ssn": "000000107", "address1": "410 RANCH RD", "city": "AUSTIN", "state": "TX", "zip": "78745", "phone": "555-0171", "employer": "SAMPLE ROOFING TX"},
                    "insurance_primary": {"payerName": CARRIERS["SUN"]["name"], "payerType": "WC", "claimNumber": "TEST-TX-60177", "dateOfInjury": "2026-09-29 (employer report conflicts: 09/30/2026)", "adjusterName": "MORGAN EXAMPLE", "adjusterPhone": "555-0178", "authorizationNumber": "TEST-TXPA-3107"},
                    "orderingPhysician": B["name"], "hcpcs_ordered": ["L4361", "E0114"], "icd10": ["S93.401A"]},
        "traps": ["Employer's report DOI 09/30/2026 conflicts with everyone else (09/29/2026).", "Witness Joe Coworker 555-0291 and wife Ana 555-0172 phones are not the patient's.", "Employer phone 555-0290."],
    }))

    # ---------------------------------------------------------------- 8. two employers, two WC claims, one order
    pt = dict(last="DEMO-NAKAMURA", first="REI", dob="1986-12-12", sex="F", ssn="000-00-0108", addr="5 TWOJOBS CT", city="SAN DIEGO", state="CA", zip="92117", phone="555-0181", email="rei.n@example.test", employer="EXAMPLE HOSPITAL (and SAMPLE CAFE)", occupation="CNA / barista",
              contact=[("Name", "Ken Nakamura (father)"), ("Phone", "555-0182")])
    case_a = dict(carrier=CARRIERS["GOLD"], claim="TEST-WC-41001", doi="2026-07-14", adjuster="JORDAN SAMPLE", adj_phone="555-0177", employer="EXAMPLE HOSPITAL", employer_addr="10 Care Blvd, San Diego, CA 92123", business="Hospital", rfa_date="2026-10-01",
                  where="Patient room 4B", hour="11:00 PM", desc_short="low back - patient transfer", supervisor="Charge nurse", claim_form_date="07/15/2026", employer_knew="07/14/2026")
    case_b = dict(carrier=CARRIERS["OLD"], claim="TEST-PC-41877", doi="2026-09-02", adjuster="RANDY OLDCLAIM", adj_phone="555-0232", employer="SAMPLE CAFE", employer_addr="3 Bean St, San Diego, CA 92109", business="Restaurant", rfa_date="2026-10-10",
                  where="Behind counter", hour="7:30 AM", desc_short="R wrist - burn/strain carrying tray", supervisor="Cafe manager", claim_form_date="09/03/2026", employer_knew="09/02/2026")
    pages = [
        cover(rng, A["clinic"], A["fax"], "Caliber DME Billing", 24, "Rei Nakamura has TWO open WC claims with two employers. This DME order is for the WRIST (cafe claim). Back records included for history."),
        face_sheet(rng, pt, A, [("WC #1 - back (hospital)", f'{case_a["carrier"]["name"]}  {case_a["claim"]}  DOI 07/14/2026'), ("WC #2 - wrist (cafe)", f'{case_b["carrier"]["name"]}  {case_b["claim"]}  DOI 09/02/2026'), ("Personal", f"{PERSONAL_PLAN}  TPC660012345")]),
        employee_claim(rng, dict(pt, employer="EXAMPLE HOSPITAL"), case_a),
        employee_claim(rng, dict(pt, employer="SAMPLE CAFE"), case_b),
        first_report(rng, pt, case_a, D, "Transferring a patient from bed to wheelchair, felt low back pain.", "Low back pain 6/10.", "Lumbar paraspinal tenderness. Neuro intact.", ["M54.50"], "PT, NSAIDs.", "Modified duty."),
        first_report(rng, pt, case_b, D, "Carrying a heavy tray of drinks, wrist bent back sharply.", "Right wrist pain with gripping.", "Dorsal wrist tenderness; X-ray negative.", ["S63.501A"], "Splint, ice.", "Light duty, no carrying trays."),
        pr2(rng, pt, case_a, A, "10/01/2026", ["Periodic report", "Request for authorization"], "Back pain stable.", "Mild spasm.", ["M54.50"], "Request LSO L0650 for work shifts.", "Modified duty at hospital."),
        rfa(rng, pt, case_a, A, [("L0650", "M54.50", "qty 1")], response={"status": "partial", "auth": "", "by": "JORDAN SAMPLE", "date": "10/04/2026", "note": "NON-CERT L0650 - see UR"}),
        ur_decision(rng, case_a, pt, "10/04/2026", [("L0650", "NOT CERTIFIED")], "(none)"),
        pr2(rng, pt, case_b, A, "10/10/2026", ["Change in treatment plan", "Request for authorization"], "Wrist pain persists 5/10.", "Grip reduced. Tender dorsal wrist.", ["S63.501A"], "WHFO L3809. Hand therapy 2x/week x 4 weeks.", "Light duty at cafe."),
        rfa(rng, pt, case_b, A, [("L3809", "S63.501A", "qty 1")], response={"status": "approved", "auth": "TEST-AUTH-41877", "by": "RANDY OLDCLAIM", "date": "10/13/2026"}),
        swo(rng, pt, A, "10/10/2026", [("L3809", "1")], ["S63.501A"], "3 months", "for cafe claim (wrist)"),
        letter(rng, case_b["carrier"]["name"], case_b["carrier"]["addr"], case_b["carrier"]["phone"], "AUTHORIZATION APPROVED", "10/13/2026", [A["clinic"]], [("Claim number", case_b["claim"]), ("Employer", case_b["employer"]), ("DOI", "09/02/2026"), ("Authorization #", "TEST-AUTH-41877"), ("Approved", "L3809 x 1")],
               "Approved. (Sample letter.)", "Randy Oldclaim"),
        *(pt_daily(rng, pt, d, n, "Lumbar (hospital claim)", "Back program.") for d, n in [("09/10/2026", 3), ("09/17/2026", 4)]),
        *(pt_daily(rng, pt, d, n, "Right wrist (cafe claim)", "Wrist ROM and grip.") for d, n in [("10/12/2026", 1), ("10/14/2026", 2)]),
        imaging(rng, pt, "09/02/2026", "X-ray right wrist", "No fracture.", "Negative."),
        imaging(rng, pt, "07/20/2026", "X-ray lumbar spine", "Mild degenerative change L5-S1. No fracture.", "No acute findings."),
        med_list(rng, pt, [["Naproxen", "500 mg", "twice daily", "A. Sample"]], "Iodine contrast."),
        card(rng, PERSONAL_PLAN, "TPC660012345", "TG-77001", "REI NAKAMURA"),
        delivery(rng, pt, [("L3809", "RT", "WR-77120")], "DT-20261015-03", "10/15/2026", "Rei Nakamura"),
        *supplier_forms(rng, pt, "Rei Nakamura")[:2],
    ]
    P.append(("08-two-employers-two-claims-24pg", "ok", "(555) 010-0144 Example Ortho", pages, {
        "scenario": "Work Comp, new patient with TWO open claims at two jobs. The back brace was denied on the hospital claim; the wrist brace was approved on the cafe claim. The order to bill is the WRIST on the CAFE claim.",
        "expect_match": "new",
        "correct": {"patient": {"lastName": "DEMO-NAKAMURA", "firstName": "REI", "dob": "1986-12-12", "sex": "F", "ssn": "000000108", "address1": "5 TWOJOBS CT", "city": "SAN DIEGO", "state": "CA", "zip": "92117", "phone": "555-0181", "email": "rei.n@example.test", "employer": "SAMPLE CAFE (for this order)"},
                    "insurance_for_this_order": {"payerName": CARRIERS["OLD"]["name"], "payerType": "WC", "claimNumber": "TEST-PC-41877", "dateOfInjury": "2026-09-02", "employerName": "SAMPLE CAFE", "adjusterName": "RANDY OLDCLAIM", "adjusterPhone": "555-0232", "authorizationNumber": "TEST-AUTH-41877"},
                    "also_on_file": {"payerName": CARRIERS["GOLD"]["name"], "claimNumber": "TEST-WC-41001", "dateOfInjury": "2026-07-14", "employerName": "EXAMPLE HOSPITAL"},
                    "orderingPhysician": A["name"], "hcpcs_ordered": ["L3809"], "icd10": ["S63.501A"]},
        "traps": ["Two WC claims; the order belongs to the cafe claim.", "L0650 on the hospital claim was NOT certified - not part of this order.", "Personal plan card is not the payer.", "Father Ken's phone 555-0182 is not hers."],
    }))

    # ---------------------------------------------------------------- 9. existing patient TWO, VA CCN plus other coverage
    pt = dict(last="TEST-SCORE", first="PATIENT TWO", dob="1975-06-15", sex="F", addr="123 TEST STREET", city="SAN DIEGO", state="CA", zip="92101", phone="555-0199", contact=[("Name", "Sam Test (partner)"), ("Phone", "555-0197")])
    ref_new = dict(referral="TEST-REF-01", seoc="Orthopedics - Knee, Continuation", auth="TEST-AUTH-REF01-2", episode="10/15/2026 - 04/15/2027", member="ER01", status="ACTIVE (renewed)")
    ref_old = dict(referral="TEST-REF-01", seoc="Orthopedics - Knee, Initial", auth="TEST-AUTH-REF01-1", episode="04/01/2026 - 10/14/2026", member="ER01", status="ENDED")
    pages = [
        cover(rng, CARRIERS["CCN"]["name"], CARRIERS["CCN"]["fax"], "SCORE (DEMO)", 20, "Authorization renewal for your existing patient. New auth number for the same referral. She also lists a Medicare Advantage plan - VA referral care is billed to the TPA."),
        letter(rng, CARRIERS["CCN"]["name"], CARRIERS["CCN"]["addr"], CARRIERS["CCN"]["phone"], "AUTHORIZATION RENEWAL", "10/10/2026", [f'{pt["first"]} {pt["last"]}'], [("Referral number", "TEST-REF-01"), ("New authorization", "TEST-AUTH-REF01-2"), ("Previous authorization", "TEST-AUTH-REF01-1 (ended 10/14/2026)"), ("Episode", ref_new["episode"])],
               "Your authorization has been renewed. (Sample letter.)", "Community Care Coordinator"),
        seoc_referral(rng, pt, ref_new, C),
        seoc_referral(rng, pt, ref_old, C, "superseded"),
        va_rfs(rng, pt, C, "VA Sample Health Care System - San Diego (fictional)", [("L1851", "SampleBrace Uni (fictional)", "1", "R knee, circ 42 cm"), ("E0143", "SampleMed FoldWalk 500 (fictional)", "1", "handle 32\"")], ["M17.11"], "Continued instability; walker replacement (wheels broken) and knee brace.", "home"),
        card(rng, ADV_PLAN, "TSA-220-1144", "TG-ADV02", "PATIENT TWO TEST-SCORE", "Medicare Advantage PPO (sample)"),
        face_sheet(rng, pt, C, [("VA CCN", f'{CARRIERS["CCN"]["name"]}  Referral TEST-REF-01'), ("Other", f"{ADV_PLAN}  TSA-220-1144")]),
        swo(rng, pt, C, "10/12/2026", [("L1851", "1"), ("E0143", "1 (replacement)")], ["M17.11"], "99 months"),
        *(chart_note(rng, pt, C, d, t, b) for d, t, b in [("10/12/2026", "FOLLOW-UP", "Right knee OA. Walker wheels broken; needs replacement. Add single-upright knee brace L1851."), ("07/01/2026", "FOLLOW-UP", "Doing well with walker."), ("04/02/2026", "INITIAL VISIT", "Referral TEST-REF-01 initial. Walker E0143 ordered.")]),
        imaging(rng, pt, "10/01/2026", "X-ray right knee", "Moderate medial compartment narrowing.", "Osteoarthritis, right knee."),
        med_list(rng, pt, [["Diclofenac gel", "1%", "apply 4x daily", "S. Testwell"], ["Levothyroxine", "75 mcg", "daily", "VA PCP"]], "None known."),
        *(pt_daily(rng, pt, d, n, "Right knee", "Balance and gait.") for d, n in [("09/20/2026", 5), ("09/27/2026", 6), ("10/04/2026", 7)]),
        delivery(rng, pt, [("L1851", "RT", "KB-11902"), ("E0143", "NU", "WLK-77120")], "DT-20261016-09", "10/16/2026", "Patient Two"),
        *supplier_forms(rng, pt, "Patient Two")[:2],
        junk(rng, "survey"),
    ]
    P.append(("09-existing-patient-two-va-renewal-other-coverage-20pg", "ok", "(555) 010-0106 Community Care TPA", pages, {
        "scenario": "EXISTING patient (TEST-SCORE, PATIENT TWO). Same referral, renewed authorization. Also has a Medicare Advantage card (not the payer for VA referral care).",
        "expect_match": "existing: TEST-SCORE, PATIENT TWO",
        "correct": {"patient": {"lastName": "TEST-SCORE", "firstName": "PATIENT TWO", "dob": "1975-06-15", "sex": "F", "address1": "123 TEST STREET", "city": "SAN DIEGO", "state": "CA", "zip": "92101", "phone": "555-0199"},
                    "insurance_primary": {"payerName": CARRIERS["CCN"]["name"], "payerType": "VA_CCN", "referralNumber": "TEST-REF-01", "authorizationNumber": "TEST-AUTH-REF01-2"},
                    "orderingPhysician": C["name"], "hcpcs_ordered": ["L1851", "E0143"], "icd10": ["M17.11"]},
        "traps": ["Old authorization TEST-AUTH-REF01-1 ended 10/14/2026.", "Medicare Advantage TSA-220-1144 is not the payer.", "Partner Sam Test 555-0197 is not the patient."],
    }))

    # ---------------------------------------------------------------- 10. same name as an existing patient, different person
    pt = dict(last="TEST-SCORE", first="PATIENT ONE", dob="1980-10-01", sex="M", ssn="000-00-0110", addr="9 DIFFERENT AVE", city="CHULA VISTA", state="CA", zip="91910", phone="555-0111", employer="EXAMPLE MARINE SUPPLY", occupation="Dock worker",
              contact=[("Name", "Lee Test (cousin)"), ("Phone", "555-0112")])
    case = dict(carrier=CARRIERS["GOLD"], claim="TEST-WC-50110", doi="2026-10-04", adjuster="CASEY TESTER", adj_phone="555-0176", employer="EXAMPLE MARINE SUPPLY", employer_addr="2 Pier Rd, Chula Vista, CA 91910", business="Marine supply", rfa_date="2026-10-12",
                where="Pier 2", hour="9:00 AM", desc_short="L knee - slipped on wet dock", supervisor="Dock lead", claim_form_date="10/05/2026", employer_knew="10/04/2026")
    pages = [
        cover(rng, D["clinic"], D["fax"], "Caliber DME Billing", 20, "New WC patient, LEFT knee.\nNOT the same person as your\nother 'Patient One' - different DOB", hand=True),
        handwritten_intake(rng, pt, case, "knee brace L knee", "L knee sprain", {"dob": "10/1/80", "other_ins": "none"}),
        face_sheet(rng, pt, D, [("Work comp", f'{case["carrier"]["name"]}  Claim {case["claim"]}')]),
        employee_claim(rng, pt, case),
        first_report(rng, pt, case, D, "Slipped on a wet dock and twisted his LEFT knee.", "Left knee pain and swelling.", "Left knee effusion, medial tenderness. Right knee normal.", ["M25.561"], "Brace, ice, MRI.", "Modified duty."),
        doc(rng, "PROVIDER ADDENDUM", D["clinic"], None, [("kv", [("Patient", f'{pt["last"]}, {pt["first"]}'), ("DOB", "10/01/1980"), ("Date", "10/06/2026")]), ("para", "Correction: the diagnosis code on the first report should be for the LEFT knee. Right knee code M25.561 was entered in error; the left knee code is M25.562 (pain in left knee). (Sample addendum.)")]),
        pr2(rng, pt, case, A, "10/12/2026", ["Change in treatment plan", "Request for authorization"], "Left knee still swollen.", "Effusion left knee.", ["M25.562"], "Hinged knee brace (left) L1833.", "Modified duty."),
        rfa(rng, pt, case, A, [("L1833", "M25.562", "qty 1, LT")], response={"status": "approved", "auth": "TEST-AUTH-50110", "by": "CASEY TESTER", "date": "10/14/2026"}),
        swo(rng, pt, A, "10/12/2026", [("L1833", "1 (left)")], ["M25.562"], "6 months", "LEFT knee", hand="messy"),
        imaging(rng, pt, "10/08/2026", "MRI left knee", "Grade 2 MCL sprain. No meniscal tear.", "MCL sprain, left."),
        *(pt_daily(rng, pt, d, n, "Left knee", "ROM improving.") for d, n in [("10/09/2026", 1), ("10/12/2026", 2), ("10/14/2026", 3), ("10/16/2026", 4)]),
        med_list(rng, pt, [["Ibuprofen", "600 mg", "three times daily", "N. Placeholder"]], "None."),
        delivery(rng, pt, [("L1833", "LT", "KB-90011")], "DT-20261016-12", "10/16/2026", "Patient One"),
        *supplier_forms(rng, pt, "Patient One"),
        junk(rng, "ad"),
    ]
    P.append(("10-same-name-different-person-20pg", "bad", "(555) 010-0211 Harbor Occ Health", pages, {
        "scenario": "NEW patient whose name is the SAME as an existing patient (TEST-SCORE, PATIENT ONE) but who is a different person: different DOB (10/01/1980 vs 01/01/1980), address, SSN and claim. The match screen should NOT call this a strong match; the reviewer should create a new patient.",
        "expect_match": "new (name matches TEST-SCORE, PATIENT ONE, but DOB/SSN/address differ)",
        "correct": {"patient": {"lastName": "TEST-SCORE", "firstName": "PATIENT ONE", "dob": "1980-10-01", "sex": "M", "ssn": "000000110", "address1": "9 DIFFERENT AVE", "city": "CHULA VISTA", "state": "CA", "zip": "91910", "phone": "555-0111", "employer": "EXAMPLE MARINE SUPPLY"},
                    "insurance_primary": {"payerName": CARRIERS["GOLD"]["name"], "payerType": "WC", "claimNumber": "TEST-WC-50110", "dateOfInjury": "2026-10-04", "adjusterName": "CASEY TESTER", "adjusterPhone": "555-0176", "authorizationNumber": "TEST-AUTH-50110"},
                    "orderingPhysician": A["name"], "hcpcs_ordered": ["L1833 (LT)"], "icd10": ["M25.562"]},
        "traps": ["Same name as an existing patient; DOB 10/01/1980 vs 01/01/1980 (written '10/1/80' by hand - easy to misread as 1/10/80).",
                  "First report lists M25.561 (RIGHT knee) in error; the addendum corrects it to M25.562 (LEFT).", "Cousin Lee Test 555-0112 is not the patient.", "Poor fax quality."],
    }))
    return P


def main():
    rng = random.Random(20261017)  # same output every run
    key = []
    for name, quality, sender, pages, answer in build(rng):
        n = len(pages)
        name = re.sub(r"-\d+pg$", "", name) + f"-{n}pg"
        imgs = [fax(p, f"OCT 16 2026 08:{(5 + i) % 60:02d}  FROM: {sender}   TO: CALIBER DME   P.{i + 1:02d}/{n}", rng, quality) for i, p in enumerate(pages)]
        path = OUT / f"{name}.pdf"
        imgs[0].save(path, "PDF", resolution=200, save_all=True, append_images=imgs[1:])
        key.append({"file": path.name, "pageCount": n, **answer})
        print(f"{path.name}: {n} pages, {path.stat().st_size // 1024} KB")
    (OUT / "answer_key.json").write_text(json.dumps(key, indent=2) + "\n")
    write_markdown_key(key)


def write_markdown_key(key):
    """The same answer key in plain language, for people checking the reader's work."""
    out = ["# Sample intake packets: answer key", "",
           "All people, numbers, payers and clinics are FAKE. Forms are modeled on public Work Comp and VA forms but are not the official forms.",
           "Diagnosis and HCPCS codes are used only to test reading; they are not billing advice.", "",
           "How to test: in the app, Inbox -> Add paperwork -> drop one PDF. When it's read, compare the review screen with the right answers below.",
           "Score each field: right / wrong / left empty, and note whether the reader flagged each trap in its notes.", ""]
    for k in key:
        out += [f"## {k['file']} ({k['pageCount']} pages)", "", k["scenario"], "", f"**Should be:** {k['expect_match']}", ""]
        for section, values in k["correct"].items():
            if isinstance(values, dict):
                out += [f"**{section.replace('_', ' ').capitalize()}**", "", "| Field | Right answer |", "|---|---|"]
                out += [f"| {f} | {v} |" for f, v in values.items()]
                out += [""]
            else:
                out += [f"**{section.replace('_', ' ').capitalize()}:** {', '.join(values) if isinstance(values, list) else values}", ""]
        out += ["**Traps (things that should NOT be picked, or should be flagged):**", ""] + [f"- {t}" for t in k["traps"]] + [""]
    (OUT / "ANSWER_KEY.md").write_text("\n".join(out))


main()
