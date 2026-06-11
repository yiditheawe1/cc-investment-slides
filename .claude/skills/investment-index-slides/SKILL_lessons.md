# SKILL Lessons — investment-index-slides

> PPT 完整布局规格、各类卡片 ASCII 实现细节。
> **日常运行无需读此文件** — SKILL.md 已包含所有操作步骤。
> 仅在以下情况读取：
> - 从零重写 `generate_investment_index_slides.js`
> - 调试某类卡片的渲染布局

---

## Step 5 — Generate PPT using pptxgenjs (from scratch)

Use the pptx skill's pptxgenjs.md reference to write and execute a Node.js script.
Output file: `investment-index-slides.pptx` in the current working directory.

### Slide structure (5 slides total)

**Slide 0 — Cover**
- Title: "Market Index Dashboard"
- Subtitle: current date (YYYY-MM-DD) + time (HH:MM UTC/local)
- Dark background (#0F172A), white text
- Accent bar in brand teal (#0D9488)

**Slide 1 — CRYPTO**
**Slide 2 — STOCK**
**Slide 3 — 利率 (Rates)**
**Slide 4 — Forex**

### Per-category slide layout

Each slide must follow this layout:

```
┌─────────────────────────────────────────┐
│  [Category accent bar left edge]        │
│  CATEGORY TITLE          DATE / TIME    │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Indicator│  │ Indicator│  │ ...   │ │
│  │  Value   │  │  Value   │  │       │ │
│  │  +change │  │  label   │  │       │ │
│  └──────────┘  └──────────┘  └───────┘ │
│  (repeat in grid rows as needed)        │
└─────────────────────────────────────────┘
```

- **Layout**: LAYOUT_16x9 (10" × 5.625")
- **Background**: dark navy (#0F172A)
- **Slide title**: white, bold, 28pt, left-aligned, 0.4" from top
- **Date/time**: gray (#94A3B8), 12pt, top-right corner
- **Indicator cards**: white rounded rectangles with subtle shadow
  - Card background: #1E293B
  - Indicator name: slate (#94A3B8), 11pt
  - Value: white, bold, 24pt
  - Change/trend: green (#22C55E) for positive, red (#EF4444) for negative, gray for neutral
  - Sentiment label: teal (#0D9488), italic, 11pt

### Category accent colors

| Category | Accent color |
|----------|-------------|
| CRYPTO   | #F59E0B (amber) |
| STOCK    | #3B82F6 (blue) |
| 利率      | #8B5CF6 (purple) |
| Forex    | #10B981 (emerald) |

Left edge accent bar: 0.08" wide × full slide height, accent color.

### Card grid sizing

Distribute cards evenly. Examples:
- 4 indicators → 2×2 grid
- 6 indicators → 3×2 grid
- 3 indicators → 3×1 row

Card dimensions: adjust to fill the slide body (below title, above bottom margin 0.2").
Horizontal padding between cards: 0.15".
Vertical padding between card rows: 0.15".
Outer horizontal margin: 0.4" (after accent bar).

---

## Step 6 — Card Layout Specs (reference implementation)

### Fund Flow card — 3×2 six-value layout

The 加密货币资金流 tile uses a 3-column × 2-row sub-grid. Implement as `addFundFlowCard(slide, pres, x, y, w, h, d)` where `d` is:
```js
{
  date: "May 25",
  items: [
    { label: '15m',      value: '-327.33万',   dir: 'down'    },  // col0, row0
    { label: '4h',       value: '-1.02亿',     dir: 'down'    },  // col1, row0
    { label: '7D',       value: '-2.96亿',     dir: 'down'    },  // col2, row0
    { label: '30D',      value: '+49.96亿',    dir: 'up'      },  // col0, row1
    { label: '市值($)',  value: '15,445.73亿', dir: 'neutral' },  // col1, row1
    { label: '资金信号', value: '+16 均衡',    dir: 'up'      },  // col2, row1
  ],
}
```

```
┌──────────────────────────────────┐
│ 加密货币资金流            May 25 │  slate 10pt + muted 8pt
├──────────┬────────────┬──────────┤  divider #2D3F55
│   15m    │    4h      │    7D    │  label gray 8pt center
│ -327万   │ -1.02亿   │ -2.96亿  │  value 13pt bold, red (down)
├──────────┼────────────┼──────────┤  divider #2D3F55
│   30D    │  市值($)  │ 资金信号  │  label gray 8pt center
│ +49.96亿 │ 15,445亿  │ +16 均衡  │  value 13pt bold: green/slate/green
└──────────┴────────────┴──────────┘
```

All 6 values use identical font (13pt bold). Color by `dir`: `'up'` → green (#22C55E), `'down'` → red (#EF4444), `'neutral'` → slate (#94A3B8). Vertical dividers between all 3 columns, horizontal divider between 2 rows.

### SOFR card — 3×2 hex-value layout

The SOFR tile uses a 3-column × 2-row sub-grid. Implement as `addSofrCard(slide, x, y, w, h, d)` where `d` is:
```js
{
  date: "2026-05-21",
  cells: [
    { label: "RATE (%)",   value: "3.51%" },  // col0, row0
    { label: "1st %ile",   value: "3.48%" },  // col1, row0
    { label: "25th %ile",  value: "3.51%" },  // col2, row0
    { label: "75th %ile",  value: "3.55%" },  // col0, row1
    { label: "99th %ile",  value: "3.62%" },  // col1, row1
    { label: "Vol ($B)",   value: "3,077"  },  // col2, row1
  ],
}
```

```
┌──────────────────────────────────┐
│ SOFR                  as of DATE │  gray 10pt + muted 8pt
├──────────┬────────────┬──────────┤  divider #2D3F55
│ RATE (%) │ 1st %ile  │ 25th %ile│  label gray 8pt
│ 3.51%    │ 3.48%     │ 3.51%    │  value teal 15pt bold
├──────────┼────────────┼──────────┤  divider #2D3F55
│ 75th %ile│ 99th %ile │ Vol ($B) │
│ 3.55%    │ 3.62%     │ 3,077    │  Vol value white 15pt bold
└──────────┴────────────┴──────────┘
```

Vertical dividers between all 3 columns, horizontal divider between 2 rows.

### Generic quad-value card — used by NAAIM, MM Bull/Bear, AAII

Three cards share the same 2×2 sub-grid layout. Implement as `addQuadCard(slide, x, y, w, h, cfg)` where `cfg` is:
```js
{
  title: "card title",           // slate 10pt
  topLeft:   { label, value },   // row-1 left  — value white 20pt bold
  topRight:  { label, value },   // row-1 right — value white 20pt bold
  botLeft:   { label, value },   // row-2 left  — value teal  20pt bold
  botRight:  { label, value },   // row-2 right — value teal  20pt bold
  footnote:  "as of YYYY-MM-DD", // bottom-right 8pt muted
}
```

```
┌──────────────────────────────────┐
│ <title>                          │  slate 10pt
├─────────────────┬────────────────┤  divider #2D3F55
│ <topLeft.label> │ <topRight.label>│  slate 9pt
│ <topLeft.value> │ <topRight.value>│  white 20pt bold
├─────────────────┼────────────────┤  divider #2D3F55
│ <botLeft.label> │ <botRight.label>│  slate 9pt
│ <botLeft.value> │ <botRight.value>│  teal  20pt bold
│               <footnote>         │  muted 8pt right-align
└──────────────────────────────────┘
```

### NAAIM card — special 4-value layout

The NAAIM card in the STOCK slide must display a 2×2 sub-grid instead of a single value:

```
┌──────────────────────────────────┐
│ NAAIM 经理人持仓                  │  ← card title (slate, 11pt)
├─────────────────┬────────────────┤
│ 当前             │ 前值            │  ← sub-labels (slate, 9pt)
│ 82.02           │ 77.34          │  ← values (white, 18pt bold)
├─────────────────┼────────────────┤
│ 4W MA (当前)    │ 4W MA (前值)   │  ← sub-labels (slate, 9pt)
│ 87.46           │ 90.49          │  ← values (teal, 18pt bold)
└─────────────────┴────────────────┘
```

Implement this as a dedicated `addNaaimCard(slide, x, y, w, h, data)` function. `data` has shape:
```js
{ current: "82.02", prev: "77.34", ma4w: "87.46", ma4wPrev: "90.49", date: "2026-05-20" }
```
