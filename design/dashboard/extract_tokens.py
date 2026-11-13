#!/usr/bin/env python3
"""Pixel-sample dashboard v2 PNGs. 1440-wide PNGs == 1 CSS px."""
from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from math import sqrt

import numpy as np
from PIL import Image

DIR = os.path.dirname(os.path.abspath(__file__))


def hex_rgb(rgb) -> str:
    r, g, b = (int(x) for x in rgb[:3])
    return f"#{r:02x}{g:02x}{b:02x}"


def dist(a, b) -> float:
    return float(sqrt(sum((int(x) - int(y)) ** 2 for x, y in zip(a[:3], b[:3]))))


def median_hex(pixels) -> str:
    if len(pixels) == 0:
        return "#000000"
    arr = np.array(pixels, dtype=np.float64)
    return hex_rgb(np.median(arr, axis=0))


def sample_box(arr, x0, y0, x1, y1, step=1):
    h, w = arr.shape[:2]
    x0, y0 = max(0, int(x0)), max(0, int(y0))
    x1, y1 = min(w, int(x1)), min(h, int(y1))
    patch = arr[y0:y1:step, x0:x1:step, :3]
    if patch.size == 0:
        return None
    return hex_rgb(np.median(patch.reshape(-1, 3), axis=0))


def unique_colors(arr, x0, y0, x1, y1, min_count=8, quant=4):
    h, w = arr.shape[:2]
    x0, y0 = max(0, int(x0)), max(0, int(y0))
    x1, y1 = min(w, int(x1)), min(h, int(y1))
    patch = arr[y0:y1, x0:x1, :3]
    if patch.size == 0:
        return []
    q = (patch.astype(np.int16) // quant) * quant
    flat = q.reshape(-1, 3)
    tuples = [tuple(int(v) for v in p) for p in flat]
    cnt = Counter(tuples)
    out = []
    for color, n in cnt.most_common(20):
        if n < min_count:
            continue
        out.append({"hex": hex_rgb(color), "count": n, "ratio": round(n / len(tuples), 4)})
    return out


def fit_corner_radius(arr, x0, y0, x1, y1, bg, max_r=24):
    """Estimate top-left corner radius of a light card on darker bg."""
    h, w = arr.shape[:2]
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    if x0 < 0 or y0 < 0 or x1 > w or y1 > h:
        return None
    # A pixel is "inside" if far from page bg (lighter or colored)
    def inside(x, y):
        return dist(arr[y, x], bg) >= 12

    best = None
    for r in range(3, max_r + 1):
        cx, cy = x0 + r, y0 + r
        if cx >= x1 or cy >= y1:
            break
        err = 0
        samples = 0
        for k in range(0, r + 1):
            # circle x = r - sqrt(r^2 - (r-k)^2) offset from corner
            dy = r - k
            dx = r - sqrt(max(0, r * r - dy * dy))
            xi = int(round(x0 + dx))
            yi = int(round(y0 + k))
            if 0 <= xi < w - 1 and 0 <= yi < h:
                samples += 1
                # just inside should be card, just outside should be bg
                if not inside(min(w - 1, xi + 2), yi):
                    err += 1
                if xi > 1 and inside(xi - 2, yi):
                    err += 1
        if samples:
            score = err / samples
            if best is None or score < best[0]:
                best = (score, r)
    return None if best is None else {"radius_px": best[1], "error": round(best[0], 3)}


def runs_on_row(arr, y, x0, x1, pred):
    """Return (start, end) inclusive-exclusive runs where pred(pixel) is true."""
    row = arr[int(y), int(x0) : int(x1)]
    out = []
    start = None
    for i, px in enumerate(row):
        ok = pred(px)
        if ok and start is None:
            start = i
        elif not ok and start is not None:
            out.append((int(x0) + start, int(x0) + i))
            start = None
    if start is not None:
        out.append((int(x0) + start, int(x1)))
    return out


def find_rectangles(mask, min_w=80, min_h=60):
    """Find axis-aligned white-ish blobs via connected components bbox."""
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    boxes = []
    ys, xs = np.where(mask)
    # flood from a grid of seeds to keep it fast
    step = 4
    for y in range(0, h, step):
        for x in range(0, w, step):
            if not mask[y, x] or visited[y, x]:
                continue
            # BFS bbox
            stack = [(x, y)]
            visited[y, x] = True
            minx = maxx = x
            miny = maxy = y
            count = 0
            while stack:
                cx, cy = stack.pop()
                count += 1
                if cx < minx:
                    minx = cx
                if cx > maxx:
                    maxx = cx
                if cy < miny:
                    miny = cy
                if cy > maxy:
                    maxy = cy
                for nx, ny in ((cx + step, cy), (cx - step, cy), (cx, cy + step), (cx, cy - step)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((nx, ny))
            bw, bh = maxx - minx, maxy - miny
            if bw >= min_w and bh >= min_h and count > 40:
                boxes.append(
                    {
                        "x": int(minx),
                        "y": int(miny),
                        "w": int(bw),
                        "h": int(bh),
                        "x1": int(maxx),
                        "y1": int(maxy),
                    }
                )
    # merge overlapping
    boxes.sort(key=lambda b: (b["y"], b["x"]))
    merged = []
    for b in boxes:
        hit = False
        for m in merged:
            if not (b["x1"] < m["x"] or b["x"] > m["x1"] or b["y1"] < m["y"] or b["y"] > m["y1"]):
                m["x"] = min(m["x"], b["x"])
                m["y"] = min(m["y"], b["y"])
                m["x1"] = max(m["x1"], b["x1"])
                m["y1"] = max(m["y1"], b["y1"])
                m["w"] = m["x1"] - m["x"]
                m["h"] = m["y1"] - m["y"]
                hit = True
                break
        if not hit:
            merged.append(dict(b))
    return merged


def is_blue(px, min_b=160, max_rg=200):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return b >= min_b and b > r + 20 and b > g + 10 and r < max_rg


def is_green_teal(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return g > r + 25 and g > b + 10 and g > 90 and r < 160


def is_magenta(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return r > 160 and b > 140 and g < 140 and r > g + 40


def is_gray_bar(px, lo=160, hi=210):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    if abs(r - g) > 12 or abs(g - b) > 12:
        return False
    m = (r + g + b) / 3
    return lo <= m <= hi


def is_light_track(px, lo=220, hi=242):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    if abs(r - g) > 10 or abs(g - b) > 10:
        return False
    m = (r + g + b) / 3
    return lo <= m <= hi


def is_dark_text(px, max_l=80):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return (r + g + b) / 3 <= max_l


def glyph_height(arr, x0, y0, x1, y1, max_l=70):
    """Bounding-box height of dark glyphs in a box."""
    patch = arr[int(y0) : int(y1), int(x0) : int(x1), :3]
    if patch.size == 0:
        return None
    lum = patch.mean(axis=2)
    mask = lum <= max_l
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        return None
    return {
        "glyph_h": int(rows[-1] - rows[0] + 1),
        "glyph_w": int(cols[-1] - cols[0] + 1),
        "box": [int(x0 + cols[0]), int(y0 + rows[0]), int(x0 + cols[-1] + 1), int(y0 + rows[-1] + 1)],
        "est_font_px_inter": round((rows[-1] - rows[0] + 1) / 0.72),  # cap-height ≈ 0.72 em Inter
        "est_font_px_pretendard": round((rows[-1] - rows[0] + 1) / 0.73),
    }


def load(name):
    path = os.path.join(DIR, name)
    im = Image.open(path).convert("RGB")
    return im, np.array(im)


def analyze():
    files = sorted(f for f in os.listdir(DIR) if f.endswith(".png"))
    report = {
        "png_scale": "All source PNGs are 1440px wide. Design baseWidth is 1440, so 1 PNG px = 1 CSS px.",
        "files": {},
        "tokens": {},
    }

    # --- 01 empty ---
    im01, a01 = load("01_목양_대시보드_진입.png")
    h01, w01 = a01.shape[:2]
    bg = tuple(int(x) for x in np.median(np.concatenate([
        a01[0:8, :, :3].reshape(-1, 3),
        a01[-8:, :, :3].reshape(-1, 3),
        a01[:, 0:8, :3].reshape(-1, 3),
    ]), axis=0))
    report["tokens"]["page_bg"] = hex_rgb(bg)
    report["files"]["01"] = {"size": [w01, h01]}

    # sidebar active pill: around y of first menu, x ~20-220
    # sample a strip
    report["tokens"]["sidebar"] = {
        "bg_sample": sample_box(a01, 0, 0, 240, h01, 4),
        "active_menu_box": sample_box(a01, 16, 150, 220, 195),
        "active_menu_colors": unique_colors(a01, 16, 145, 230, 200, min_count=20),
        "inactive_menu_text": sample_box(a01, 24, 220, 120, 250),
        "date_today": sample_box(a01, 20, 78, 70, 96),
        "date_value": sample_box(a01, 70, 78, 200, 96),
        "logo_ink": sample_box(a01, 20, 28, 160, 58),
        "profile_icon": sample_box(a01, 18, h01 - 70, 62, h01 - 28),
        "profile_name": sample_box(a01, 70, h01 - 62, 200, h01 - 40),
    }

    # card mask: not page bg
    lum = a01.mean(axis=2)
    bg_l = sum(bg) / 3
    card_mask = (lum > bg_l + 10) | (np.abs(a01[:, :, 0].astype(int) - a01[:, :, 2].astype(int)) > 8)
    # ignore sidebar
    card_mask[:, :250] = False
    card_mask[:70, :] = False
    boxes01 = find_rectangles(card_mask, min_w=120, min_h=80)
    report["files"]["01"]["card_boxes"] = boxes01

    # --- 04 populated cards ---
    im04, a04 = load("04_목양_대시보드_카드 활성화.png")
    h04, w04 = a04.shape[:2]
    report["files"]["04"] = {"size": [w04, h04]}
    lum04 = a04.mean(axis=2)
    mask04 = (lum04 > bg_l + 8) | (np.abs(a04[:, :, 0].astype(int) - a04[:, :, 2].astype(int)) > 6)
    mask04[:, :250] = False
    mask04[:70, :] = False
    boxes04 = find_rectangles(mask04, min_w=100, min_h=70)
    report["files"]["04"]["card_boxes"] = boxes04

    # Classify boxes by y then x
    def sort_cards(boxes):
        return sorted(boxes, key=lambda b: (round(b["y"] / 20) * 20, b["x"]))

    cards = sort_cards(boxes04)
    report["files"]["04"]["cards_sorted"] = cards

    # Attendance bars: blue pixels in left top card
    blue_mask = np.zeros((h04, w04), dtype=bool)
    # vectorized blue
    r, g, b = a04[:, :, 0].astype(int), a04[:, :, 1].astype(int), a04[:, :, 2].astype(int)
    blue_mask = (b >= 170) & (b > r + 25) & (b > g + 15) & (r < 210) & (g < 210)
    blue_mask[:, :250] = False
    blue_ys, blue_xs = np.where(blue_mask)
    if len(blue_xs):
        att_x0, att_x1 = int(blue_xs.min()), int(blue_xs.max()) + 1
        att_y0, att_y1 = int(blue_ys.min()), int(blue_ys.max()) + 1
        mid_y = (att_y0 + att_y1) // 2
        bar_runs = runs_on_row(a04, mid_y, att_x0 - 4, att_x1 + 40, lambda px: is_blue(px) or is_light_track(px, 225, 245))
        blue_runs = runs_on_row(a04, mid_y, att_x0 - 4, att_x1 + 80, is_blue)
        empty_runs = runs_on_row(a04, mid_y, att_x0 - 4, att_x1 + 80, lambda px: is_light_track(px, 225, 245))
        bar_w = [e - s for s, e in blue_runs]
        gaps = []
        seq = sorted(blue_runs + empty_runs)
        for i in range(len(seq) - 1):
            gaps.append(seq[i + 1][0] - seq[i][1])
        fill_px = a04[blue_ys, blue_xs, :3]
        report["tokens"]["attendance_bar"] = {
            "bbox": [att_x0, att_y0, att_x1, att_y1],
            "height_px": att_y1 - att_y0,
            "fill": median_hex(fill_px),
            "fill_unique": unique_colors(a04, att_x0, att_y0, att_x1, att_y1, min_count=30),
            "blue_bar_count": len(blue_runs),
            "blue_bar_widths": bar_w,
            "blue_bar_width_median": int(np.median(bar_w)) if bar_w else None,
            "empty_bar_count": len(empty_runs),
            "empty_widths": [e - s for s, e in empty_runs],
            "gaps": gaps,
            "gap_median": int(np.median(gaps)) if gaps else None,
            "empty_fill": sample_box(a04, empty_runs[-1][0] + 2, mid_y - 8, empty_runs[-1][1] - 2, mid_y + 8) if empty_runs else None,
            "radius": fit_corner_radius(a04, att_x0, att_y0, blue_runs[0][1] if blue_runs else att_x0 + 16, att_y1, bg, 16) if blue_runs else None,
        }
        # empty bar color from a known empty run
        if empty_runs:
            es, ee = empty_runs[-1]
            report["tokens"]["attendance_bar"]["empty_fill_median"] = sample_box(a04, es + 2, att_y0 + 4, ee - 2, att_y1 - 4)

    # Member dots
    green_mask = (g > r + 20) & (g > b + 8) & (g > 100) & (r < 180) & (b < 180)
    green_mask[:, :700] = False  # right side
    green_mask[:70, :] = False
    gy, gx = np.where(green_mask)
    if len(gx):
        dot_x0, dot_x1 = int(gx.min()), int(gx.max()) + 1
        dot_y0, dot_y1 = int(gy.min()), int(gy.max()) + 1
        # find a row through first dot row
        row_y = int(np.median(gy[gy < gy.min() + 20])) if len(gy) else (dot_y0 + 6)
        # refine: first y with many green
        counts = Counter(gy.tolist())
        row_y = counts.most_common(1)[0][0]
        green_runs = runs_on_row(a04, row_y, dot_x0 - 4, dot_x1 + 40, is_green_teal)
        # empty dots: light gray circles to the right of greens on last rows
        empty_dot_runs = runs_on_row(
            a04,
            int(np.percentile(gy, 90)),
            dot_x0 - 4,
            min(w04 - 20, dot_x1 + 80),
            lambda px: is_light_track(px, 210, 235) and not is_green_teal(px),
        )
        dw = [e - s for s, e in green_runs]
        dgap = [green_runs[i + 1][0] - green_runs[i][1] for i in range(len(green_runs) - 1)]
        report["tokens"]["member_dot"] = {
            "bbox": [dot_x0, dot_y0, dot_x1, dot_y1],
            "fill": median_hex(a04[gy, gx, :3]),
            "fill_unique": unique_colors(a04, dot_x0, dot_y0, dot_x1, dot_y1, min_count=40),
            "dot_count_first_row": len(green_runs),
            "diameter_median": int(np.median(dw)) if dw else None,
            "diameters": dw[:8],
            "gap_median": int(np.median(dgap)) if dgap else None,
            "gaps": dgap[:8],
            "grid_height": dot_y1 - dot_y0,
        }
        # empty dot: last row right side
        last_row = int(np.percentile(gy, 95))
        empty_runs_last = runs_on_row(
            a04, last_row, dot_x0, w04 - 40, lambda px: is_light_track(px, 205, 236)
        )
        if empty_runs_last:
            es, ee = empty_runs_last[-1]
            report["tokens"]["member_dot"]["empty"] = sample_box(a04, es + 1, last_row - 2, ee - 1, last_row + 3)

    # Mid 4 cards: below attendance, 4 columns
    # Use boxes whose y is around 320-430 and h ~160-220
    mid_candidates = [b for b in cards if 280 < b["y"] < 480 and 140 < b["h"] < 280 and b["w"] < 400]
    mid_candidates = sorted(mid_candidates, key=lambda b: b["x"])
    report["files"]["04"]["mid_cards"] = mid_candidates
    mid_tokens = []
    labels = ["newfamily", "risk", "visit", "prayer"]
    for i, b in enumerate(mid_candidates[:4]):
        pad = 8
        top = sample_box(a04, b["x"] + pad, b["y"] + pad, b["x"] + b["w"] * 0.45, b["y"] + 36)
        midp = sample_box(a04, b["x"] + pad, b["y"] + b["h"] * 0.45, b["x"] + b["w"] * 0.5, b["y"] + b["h"] * 0.55)
        bot = sample_box(a04, b["x"] + b["w"] * 0.55, b["y"] + b["h"] - 36, b["x"] + b["w"] - pad, b["y"] + b["h"] - 8)
        # gradient samples along diagonal
        diag = []
        for t in (0.08, 0.25, 0.5, 0.75, 0.92):
            x = b["x"] + 12 + t * (b["w"] - 24)
            y = b["y"] + 12 + t * (b["h"] - 24)
            diag.append(hex_rgb(a04[int(y), int(x)]))
        # border: 1px outside vs inside
        outside = sample_box(a04, b["x"] - 3, b["y"] + 20, b["x"] - 1, b["y"] + 40)
        edge = sample_box(a04, b["x"], b["y"] + 20, b["x"] + 2, b["y"] + 40)
        rad = fit_corner_radius(a04, b["x"], b["y"], b["x1"], b["y1"], bg, 20)
        mid_tokens.append(
            {
                "id": labels[i] if i < 4 else f"mid{i}",
                "box": b,
                "top_left": top,
                "center": midp,
                "bottom_right": bot,
                "diagonal": diag,
                "edge": edge,
                "outside": outside,
                "radius": rad,
            }
        )
    report["tokens"]["mid_cards"] = mid_tokens

    # Text gray steps from 01 empty numbers and labels
    # Large 0% in attendance card — first card
    top_cards = [b for b in sort_cards(boxes01) if b["y"] < 280]
    report["files"]["01"]["top_cards"] = top_cards
    if len(top_cards) >= 1:
        c0 = top_cards[0]
        report["tokens"]["type_attendance_empty"] = {
            "label": glyph_height(a01, c0["x"] + 16, c0["y"] + 12, c0["x"] + 180, c0["y"] + 48, 50),
            "value": glyph_height(a01, c0["x"] + 16, c0["y"] + 44, c0["x"] + 160, c0["y"] + 130, 90),
            "sub": glyph_height(a01, c0["x"] + 120, c0["y"] + 70, c0["x"] + 360, c0["y"] + 110, 160),
            "label_color": sample_box(a01, c0["x"] + 24, c0["y"] + 20, c0["x"] + 90, c0["y"] + 36),
        }
    if len(top_cards) >= 2:
        c1 = top_cards[1]
        report["tokens"]["type_member_empty"] = {
            "label": glyph_height(a01, c1["x"] + 16, c1["y"] + 12, c1["x"] + 160, c1["y"] + 48, 50),
            "value": glyph_height(a01, c1["x"] + 16, c1["y"] + 44, c1["x"] + 140, c1["y"] + 130, 90),
        }

    # 04 large 75% and 101
    top04 = [b for b in cards if b["y"] < 280]
    top04 = sorted(top04, key=lambda b: b["x"])
    report["files"]["04"]["top_cards"] = top04
    if top04:
        c0 = top04[0]
        report["tokens"]["type_attendance_75"] = {
            "label": glyph_height(a04, c0["x"] + 16, c0["y"] + 10, c0["x"] + 160, c0["y"] + 46, 40),
            "value": glyph_height(a04, c0["x"] + 16, c0["y"] + 40, c0["x"] + 200, c0["y"] + 130, 40),
            "sub": glyph_height(a04, c0["x"] + 150, c0["y"] + 70, c0["x"] + 420, c0["y"] + 110, 170),
            "ink": sample_box(a04, c0["x"] + 24, c0["y"] + 18, c0["x"] + 80, c0["y"] + 34),
            "value_ink": sample_box(a04, c0["x"] + 24, c0["y"] + 58, c0["x"] + 90, c0["y"] + 100),
            "sub_color_samples": unique_colors(a04, c0["x"] + 160, c0["y"] + 78, c0["x"] + 380, c0["y"] + 102, min_count=10, quant=8),
        }
        # padding: text start vs card
        lab = report["tokens"]["type_attendance_75"]["label"]
        if lab:
            report["tokens"]["type_attendance_75"]["pad_left"] = lab["box"][0] - c0["x"]
            report["tokens"]["type_attendance_75"]["pad_top"] = lab["box"][1] - c0["y"]

    if len(top04) >= 2:
        c1 = top04[1]
        report["tokens"]["type_member_101"] = {
            "label": glyph_height(a04, c1["x"] + 16, c1["y"] + 10, c1["x"] + 160, c1["y"] + 46, 40),
            "value": glyph_height(a04, c1["x"] + 16, c1["y"] + 40, c1["x"] + 220, c1["y"] + 130, 40),
            "sub": glyph_height(a04, c1["x"] + 180, c1["y"] + 70, c1["x"] + 420, c1["y"] + 110, 170),
        }

    # Card radius / shadow from a large white card (출석통계 empty in 04)
    white_cards = [b for b in cards if b["h"] > 220 and b["w"] > 400]
    if white_cards:
        wc = max(white_cards, key=lambda b: b["h"] * b["w"])
        report["tokens"]["large_card"] = {
            "box": wc,
            "bg": sample_box(a04, wc["x"] + 40, wc["y"] + 40, wc["x"] + 80, wc["y"] + 80),
            "radius": fit_corner_radius(a04, wc["x"], wc["y"], wc["x1"], wc["y1"], bg, 24),
        }
        # shadow: sample 6px outside top-left vs page bg
        sh = []
        for dy in range(-8, 12):
            for dx in range(-8, 12):
                x, y = wc["x"] + dx, wc["y"] + dy
                if 0 <= x < w04 and 0 <= y < h04:
                    if dx < 0 or dy < 0:
                        sh.append(tuple(int(v) for v in a04[y, x, :3]))
        report["tokens"]["large_card"]["outside_near_corner"] = median_hex(sh) if sh else None
        report["tokens"]["large_card"]["page_bg"] = hex_rgb(bg)

    # Gaps between cards
    if len(top04) >= 2:
        report["tokens"]["gap_top_cards"] = top04[1]["x"] - top04[0]["x1"]
    if mid_candidates and top04:
        report["tokens"]["gap_row1_to_row2"] = mid_candidates[0]["y"] - top04[0]["y1"]
    if len(mid_candidates) >= 2:
        report["tokens"]["gap_mid_cards"] = [
            mid_candidates[i + 1]["x"] - mid_candidates[i]["x1"] for i in range(len(mid_candidates) - 1)
        ]

    # W/M/Y buttons from 01
    # find near-black small squares in attendance card area
    dark = (a01.mean(axis=2) < 40)
    dark[:, :500] = False
    dark[:200, :] = False
    dark[500:, :] = False
    ys, xs = np.where(dark)
    report["tokens"]["wmy_01"] = {}
    if len(xs):
        report["tokens"]["wmy_01"]["dark_bbox"] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        report["tokens"]["wmy_01"]["active_bg"] = median_hex(a01[ys, xs, :3])
        report["tokens"]["wmy_01"]["size_est"] = [int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]

    # --- 05 department ---
    im05, a05 = load("05_목양_대시보드_부서별 인원 활성화.png")
    h05, w05 = a05.shape[:2]
    r5, g5, b5 = a05[:, :, 0].astype(int), a05[:, :, 1].astype(int), a05[:, :, 2].astype(int)
    mag = (r5 > 170) & (b5 > 140) & (g5 < 160) & (r5 > g5 + 30)
    mag[:, :250] = False
    my, mx = np.where(mag)
    dept = {}
    if len(mx):
        dx0, dx1 = int(mx.min()), int(mx.max()) + 1
        dy0, dy1 = int(my.min()), int(my.max()) + 1
        midy = (dy0 + dy1) // 2
        dept["top_bar"] = {
            "fill": median_hex(a05[my, mx, :3]),
            "bbox": [dx0, dy0, dx1, dy1],
            "height": dy1 - dy0,
            "width": dx1 - dx0,
            "unique": unique_colors(a05, dx0, dy0, dx1, dy1, min_count=20),
            "radius": fit_corner_radius(a05, dx0, dy0, dx1, dy1, bg, 16),
        }
        # scan downward for gray bars
        # find horizontal bands of gray in x range of magenta bar, y below
        gray_rows = []
        for y in range(dy1 + 4, min(h05 - 20, dy1 + 400)):
            run = runs_on_row(a05, y, dx0 - 10, dx1 + 40, lambda px: is_gray_bar(px, 150, 200))
            if run:
                longest = max(run, key=lambda t: t[1] - t[0])
                if longest[1] - longest[0] > 40:
                    gray_rows.append((y, longest))
        # cluster rows into bars
        bars = []
        if gray_rows:
            cur = [gray_rows[0]]
            for item in gray_rows[1:]:
                if item[0] - cur[-1][0] <= 2:
                    cur.append(item)
                else:
                    bars.append(cur)
                    cur = [item]
            bars.append(cur)
        dept_bars = []
        for band in bars:
            y0b, y1b = band[0][0], band[-1][0] + 1
            xs0 = int(np.median([t[1][0] for t in band]))
            xs1 = int(np.median([t[1][1] for t in band]))
            fill = sample_box(a05, xs0 + 4, y0b + 2, xs1 - 4, y1b - 2)
            # track to the right of fill, same row
            track = sample_box(a05, xs1 + 8, y0b + 2, dx1 - 4, y1b - 2)
            dept_bars.append(
                {
                    "y0": int(y0b),
                    "h": int(y1b - y0b),
                    "fill_w": int(xs1 - xs0),
                    "fill": fill,
                    "track": track,
                }
            )
        dept["other_bars"] = dept_bars
        if len(dept_bars) >= 2:
            dept["row_gap"] = dept_bars[1]["y0"] - (dept_bars[0]["y0"] + dept_bars[0]["h"])
        # label color left of first bar
        dept["label_color"] = sample_box(a05, 280, dy0, dx0 - 8, dy1)
        dept["count_color"] = sample_box(a05, dx1 + 4, dy0, dx1 + 60, dy1)
    report["tokens"]["dept"] = dept

    # --- 07 week chart ---
    im07, a07 = load("07_목양_대시보드_출석통계 주간 활성화.png")
    r7, g7, b7 = a07[:, :, 0].astype(int), a07[:, :, 1].astype(int), a07[:, :, 2].astype(int)
    blue7 = (b7 >= 170) & (b7 > r7 + 25) & (b7 > g7 + 10) & (r7 < 210)
    blue7[:, :250] = False
    blue7[:400, :] = False  # chart is lower
    by, bx = np.where(blue7)
    chart = {}
    if len(bx):
        cx0, cx1 = int(bx.min()), int(bx.max()) + 1
        cy0, cy1 = int(by.min()), int(by.max()) + 1
        chart["highlight"] = {
            "fill": median_hex(a07[by, bx, :3]),
            "bbox": [cx0, cy0, cx1, cy1],
            "h": cy1 - cy0,
            "w": cx1 - cx0,
            "unique": unique_colors(a07, cx0, cy0, cx1, cy1, min_count=30),
            "radius_tl": fit_corner_radius(a07, cx0, cy0, cx1, cy1, tuple(int(x) for x in np.median(a07[cy0 - 10:cy0, cx0:cx1].reshape(-1, 3), axis=0)) if cy0 > 10 else bg, 16),
        }
        # gray bars to the left
        midy = cy0 + int((cy1 - cy0) * 0.6)
        gray_runs = runs_on_row(a07, midy, 260, cx0 - 4, lambda px: is_gray_bar(px, 150, 205))
        track_runs = runs_on_row(a07, cy0 + 8, 260, cx1 + 4, lambda px: is_light_track(px, 232, 248))
        chart["gray_bars"] = {
            "count": len(gray_runs),
            "runs": gray_runs,
            "widths": [e - s for s, e in gray_runs],
            "fill": sample_box(a07, gray_runs[0][0] + 6, midy - 6, gray_runs[0][1] - 6, midy + 6) if gray_runs else None,
        }
        chart["track"] = {
            "count": len(track_runs),
            "fill": sample_box(a07, track_runs[0][0] + 4, cy0 + 10, track_runs[0][1] - 4, cy0 + 24) if track_runs else None,
        }
        if gray_runs:
            gaps = [gray_runs[i + 1][0] - gray_runs[i][1] for i in range(len(gray_runs) - 1)]
            if gray_runs and cx0:
                gaps.append(cx0 - gray_runs[-1][1])
            chart["bar_gaps"] = gaps
        # percent text on highlight (white-ish)
        chart["highlight_text"] = unique_colors(a07, cx0, cy0, cx1, cy0 + 50, min_count=8, quant=8)
        chart["gray_text"] = unique_colors(a07, gray_runs[0][0], cy0 - 4, gray_runs[0][1], cy0 + 50, min_count=6, quant=8) if gray_runs else None
        chart["axis"] = unique_colors(a07, cx0, cy1, cx1, min(cy1 + 28, a07.shape[0]), min_count=6, quant=8)
    report["tokens"]["week_chart"] = chart

    # --- 08 tooltip ---
    im08, a08 = load("08_목양_대시보드_출석통계 주간 활성화(그래프 hover-툴팁).png")
    # black tooltip
    lum8 = a08.mean(axis=2)
    black = lum8 < 35
    black[:, :250] = False
    black[:400, :] = False
    by8, bx8 = np.where(black)
    tip = {}
    if len(bx8):
        tip["bbox"] = [int(bx8.min()), int(by8.min()), int(bx8.max()) + 1, int(by8.max()) + 1]
        tip["bg"] = median_hex(a08[by8, bx8, :3])
        tip["size"] = [int(bx8.max() - bx8.min() + 1), int(by8.max() - by8.min() + 1)]
        tip["text"] = unique_colors(a08, bx8.min(), by8.min(), bx8.max() + 1, by8.max() + 1, min_count=10, quant=8)
        tip["radius"] = fit_corner_radius(a08, int(bx8.min()), int(by8.min()), int(bx8.max()) + 1, int(by8.max()) + 1, (250, 250, 250), 12)
    report["tokens"]["tooltip"] = tip

    # --- 10 month ---
    im10, a10 = load("10_목양_대시보드_출석통계 월간 활성화.png")
    r10, g10, b10 = a10[:, :, 0].astype(int), a10[:, :, 1].astype(int), a10[:, :, 2].astype(int)
    blue10 = (b10 >= 170) & (b10 > r10 + 25) & (b10 > g10 + 10)
    blue10[:, :250] = False
    blue10[:400, :] = False
    by10, bx10 = np.where(blue10)
    month = {}
    if len(bx10):
        month["highlight"] = {
            "fill": median_hex(a10[by10, bx10, :3]),
            "bbox": [int(bx10.min()), int(by10.min()), int(bx10.max()) + 1, int(by10.max()) + 1],
            "h": int(by10.max() - by10.min() + 1),
            "w": int(bx10.max() - bx10.min() + 1),
        }
        midy = int(np.median(by10))
        gray_runs = runs_on_row(a10, midy, 260, int(bx10.min()) - 2, lambda px: is_gray_bar(px, 150, 205))
        month["gray_count"] = len(gray_runs)
        month["gray_widths"] = [e - s for s, e in gray_runs]
        month["gray_fill"] = sample_box(a10, gray_runs[0][0] + 2, midy - 4, gray_runs[0][1] - 2, midy + 4) if gray_runs else None
        if gray_runs:
            month["gaps"] = [gray_runs[i + 1][0] - gray_runs[i][1] for i in range(len(gray_runs) - 1)]
        # year dropdown chip near header
        month["year_chip_colors"] = unique_colors(a10, 520, 430, 640, 480, min_count=8, quant=4)
    report["tokens"]["month_chart"] = month

    # --- 12 year ---
    im12, a12 = load("12_목양_대시보드_출석통계 연간 활성화.png")
    r12, g12, b12 = a12[:, :, 0].astype(int), a12[:, :, 1].astype(int), a12[:, :, 2].astype(int)
    blue12 = (b12 >= 170) & (b12 > r12 + 25) & (b12 > g12 + 10)
    blue12[:, :250] = False
    blue12[:400, :] = False
    by12, bx12 = np.where(blue12)
    year = {}
    if len(bx12):
        year["highlight"] = {
            "fill": median_hex(a12[by12, bx12, :3]),
            "bbox": [int(bx12.min()), int(by12.min()), int(bx12.max()) + 1, int(by12.max()) + 1],
            "h": int(by12.max() - by12.min() + 1),
            "w": int(bx12.max() - bx12.min() + 1),
        }
        # gray stacked blocks to the left
        midy = int(by12.min() + 20)
        gray_runs = runs_on_row(a12, midy, 260, int(bx12.min()) + 40, lambda px: is_gray_bar(px, 140, 210))
        year["back_blocks"] = {
            "runs": gray_runs,
            "fills": [sample_box(a12, s + 8, midy - 4, e - 8, midy + 4) for s, e in gray_runs],
        }
        year["pct_on_blue"] = unique_colors(
            a12, int(bx12.min()), int(by12.min()), int(bx12.min()) + 120, int(by12.min()) + 80, min_count=8, quant=8
        )
        year["year_label"] = unique_colors(
            a12, int(bx12.min()), int(by12.max()) - 28, int(bx12.min()) + 80, int(by12.max()) + 4, min_count=6, quant=8
        )
    report["tokens"]["year_chart"] = year

    # --- 14 dropdown ---
    im14, a14 = load("14_목양_대시보드_출석통계 연간 활성화(연도 드롭다운).png")
    # white menu over chart
    lum14 = a14.mean(axis=2)
    # find a compact white rectangle around year selector (~x 520-640, y 450-620)
    drop = unique_colors(a14, 530, 455, 640, 640, min_count=15, quant=4)
    report["tokens"]["year_dropdown"] = {
        "colors": drop,
        "panel_bg": sample_box(a14, 545, 500, 620, 610),
        "hover_row": sample_box(a14, 545, 545, 620, 568),
        "selected_row": sample_box(a14, 545, 490, 620, 512),
        "border": sample_box(a14, 538, 500, 542, 560),
    }

    # --- 02/03 hover icon ---
    im02, a02 = load("02_목양_대시보드_설정 hover&click.png")
    im03, a03 = load("03_목양_대시보드_로그아웃 hover&click.png")
    # settings/logout live at top-right ~ x 1320-1420, y 20-70
    report["tokens"]["icon_hover"] = {
        "settings_02": unique_colors(a02, 1280, 18, 1430, 72, min_count=10, quant=4),
        "logout_03": unique_colors(a03, 1320, 18, 1438, 72, min_count=10, quant=4),
        "idle_01_settings": unique_colors(a01, 1280, 18, 1430, 72, min_count=10, quant=4),
    }

    # --- 06 arrow hover on dept ---
    im06, a06 = load("06_목양_대시보드_부서별 인원 화살표 hover&clic.png")
    # compare 05 vs 06 at dept header right
    report["tokens"]["dept_arrow"] = {
        "05_header_right": unique_colors(a05, 720, 680, 820, 740, min_count=8, quant=4),
        "06_header_right": unique_colors(a06, 720, 680, 820, 740, min_count=8, quant=4),
    }

    # --- 09 M button hover ---
    im09, a09 = load("09_목양_대시보드_출석통계 월간 버튼 hover.png")
    report["tokens"]["wmy_hover"] = {
        "07_wmy": unique_colors(a07, 680, 430, 820, 490, min_count=8, quant=4),
        "09_wmy": unique_colors(a09, 680, 430, 820, 490, min_count=8, quant=4),
        "10_wmy": unique_colors(a10, 620, 430, 840, 490, min_count=8, quant=4),
    }

    # Text gray ladder from various UI
    report["tokens"]["text_grays"] = {
        "ink_logo": sample_box(a04, 22, 30, 140, 55),
        "sidebar_inactive": sample_box(a04, 28, 230, 90, 248),
        "card_title": sample_box(a04, 300, 100, 360, 118) if True else None,
        "muted_sub": sample_box(a04, 470, 155, 620, 172),
        "empty_message": sample_box(a01, 420, 620, 560, 640),
        "feed_empty": sample_box(a01, 980, 720, 1180, 760),
        "axis_label": sample_box(a07, 300, 780, 360, 800),
        "mid_sub": sample_box(a04, 300, 360, 400, 378),
        "unit_beside_number": sample_box(a04, 700, 500, 760, 530),
    }

    # Border vs bg
    report["tokens"]["chrome"] = {
        "page_bg": hex_rgb(bg),
        "topbar": sample_box(a01, 400, 8, 800, 40),
        "search_underline": unique_colors(a01, 1100, 48, 1380, 68, min_count=8, quant=4),
        "nav_baseline": unique_colors(a01, 280, 58, 800, 68, min_count=8, quant=4),
        "nav_active_mark": unique_colors(a01, 280, 56, 340, 68, min_count=4, quant=4),
        "card_white": sample_box(a01, 300, 120, 360, 160),
    }

    # Layout measurements vs 1440
    report["tokens"]["layout"] = {
        "canvas": [1440, h01],
        "sidebar_width_est": 250,  # refined below
    }
    # sidebar/content split: first column where color becomes card/content
    col_var = []
    for x in range(180, 320):
        col_var.append((x, float(np.mean(np.abs(a01[80:200, x] - a01[80:200, 10])))))
    # jump
    jumps = [(col_var[i][0], col_var[i][1] - col_var[i - 1][1]) for i in range(1, len(col_var))]
    report["tokens"]["layout"]["sidebar_content_jump"] = sorted(jumps, key=lambda t: -t[1])[:5]

    if top04:
        report["tokens"]["layout"]["content_left"] = top04[0]["x"]
        report["tokens"]["layout"]["content_right"] = w04 - (top04[-1]["x1"] if len(top04) > 1 else top04[0]["x1"])
        report["tokens"]["layout"]["top_card_y"] = top04[0]["y"]
        report["tokens"]["layout"]["top_card_h"] = top04[0]["h"]
        report["tokens"]["layout"]["top_card_w"] = top04[0]["w"]

    # 11 month tooltip
    im11, a11 = load("11_목양_대시보드_출석통계 월간 활성화(그래프 hover-툴팁).png")
    lum11 = a11.mean(axis=2)
    black11 = (lum11 < 35)
    black11[:, :250] = False
    black11[:400, :] = False
    by11, bx11 = np.where(black11)
    if len(bx11):
        report["tokens"]["month_tooltip"] = {
            "bbox": [int(bx11.min()), int(by11.min()), int(bx11.max()) + 1, int(by11.max()) + 1],
            "bg": median_hex(a11[by11, bx11, :3]),
            "size": [int(bx11.max() - bx11.min() + 1), int(by11.max() - by11.min() + 1)],
        }

    im13, a13 = load("13_목양_대시보드_출석통계 연간 활성화(그래프 hover-툴팁).png")
    lum13 = a13.mean(axis=2)
    black13 = lum13 < 35
    black13[:, :250] = False
    black13[:400, :] = False
    by13, bx13 = np.where(black13)
    if len(bx13):
        report["tokens"]["year_tooltip"] = {
            "bbox": [int(bx13.min()), int(by13.min()), int(bx13.max()) + 1, int(by13.max()) + 1],
            "bg": median_hex(a13[by13, bx13, :3]),
            "size": [int(bx13.max() - bx13.min() + 1), int(by13.max() - by13.min() + 1)],
        }

    out_path = os.path.join(DIR, "extract_tokens.json")
    with open(out_path, "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("wrote", out_path)
    # compact summary
    t = report["tokens"]
    print("BG", t.get("page_bg"))
    print("ATT", json.dumps(t.get("attendance_bar"), ensure_ascii=False)[:800])
    print("DOT", json.dumps(t.get("member_dot"), ensure_ascii=False)[:800])
    print("MID", json.dumps(t.get("mid_cards"), ensure_ascii=False)[:1200])
    print("DEPT", json.dumps(t.get("dept"), ensure_ascii=False)[:800])
    print("WEEK", json.dumps(t.get("week_chart"), ensure_ascii=False)[:800])
    print("LAYOUT", t.get("layout"))
    print("TYPE75", t.get("type_attendance_75"))
    print("GAPS", t.get("gap_top_cards"), t.get("gap_row1_to_row2"), t.get("gap_mid_cards"))
    print("LARGE", t.get("large_card"))
    print("WMY", t.get("wmy_01"), t.get("wmy_hover"))
    print("TIP", t.get("tooltip"), t.get("month_tooltip"), t.get("year_tooltip"))
    print("TEXT", t.get("text_grays"))
    print("CHROME", t.get("chrome"))
    print("YEAR", t.get("year_chart"))
    print("DROP", t.get("year_dropdown"))
    print("ICON", t.get("icon_hover"))


if __name__ == "__main__":
    analyze()
