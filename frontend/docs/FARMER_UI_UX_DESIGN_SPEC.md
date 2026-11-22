# GreenHarvest Farmer Seller Center: Enterprise UI/UX Design System Specification

## 1. Executive Summary & Design Philosophy
The GreenHarvest Farmer Seller Center (Producer Hub) is an enterprise-grade agricultural commerce workbench tailored specifically to the Ethiopian agro-industrial ecosystem. It provides smallholder farmers, agricultural cooperatives, and commercial farming estates with real-time financial tracking, inventory management, dynamic commodity market intelligence (ECX benchmarks), commercial harvest waybill logistics, and customer dispute resolution.

### Core Ergonomic Principles:
1. **Zero-State Activation ("Farm Launchpad")**: New farmers are never presented with a barren, demotivating empty dashboard. The system dynamically renders a structured 4-step onboarding journey that guides them through KYC, catalog creation, packaging logistics, and storefront customizer.
2. **Agricultural Grounding & Trust**: Deep Emerald (`#059669` / `#047857`) paired with Slate surfaces (`#f8fafc`) and warm Harvest Amber accents (`#d97706`).
3. **Ethiopian Birr (ETB) Precision**: Dual-unit price intelligence displaying both `ETB/kg` and `ETB/quintal` (100 kg) conversions standard to Ethiopian grain, coffee, and pulse trading.
4. **Cognitive Load Reduction**: Semantic status badges, truthful action items (eradicating mock/static placeholder text), and unified keyboard search shortcuts (`⌘K` / `/`).

---

## 2. Design Tokens & Component Hierarchy

### Palette & Tokens
| Token | Hex | Role | Usage |
|---|---|---|---|
| `emerald-900` | `#064e3b` | Primary Deep | Launchpad headers, high-contrast branding |
| `emerald-600` | `#059669` | Primary Interactive | CTAs, active route chips, area chart lines |
| `emerald-50` | `#ecfdf5` | Background Tint | Verified badges, card hover backdrops |
| `amber-500` | `#f59e0b` | Urgency / Warning | Pending harvest packaging (<24h dispatch) |
| `rose-500` | `#f43f5e` | Danger / Alert | Low stock thresholds, return disputes |
| `slate-50` | `#f8fafc` | Canvas Background | Global dashboard background canvas |
| `slate-900` | `#0f172a` | Text Primary | Metric numbers, table headers, titles |

### Bento KPI Stat Cards (4-Grid)
- **Today's Revenue**: Daily settlement in ETB with daily order volume sub-metrics.
- **Awaiting Dispatch**: Immediate operational backlog with direct link to Commercial Waybill generation.
- **All-Time Revenue**: Historical verified revenue earned through the GreenHarvest platform.
- **Harvest Catalog**: Total listed produce lots with total warehouse/field inventory weight in kg/quintals.

---

## 3. Ethiopian Commodity Exchange (ECX) Ticker
Real-time national and regional agricultural benchmarks:
- **White Teff (Grade A)**: Ada'a / Addis Ababa regional rate (ETB/quintal).
- **Arabica Coffee (Jimma Grade 1)**: Primary export benchmark (ETB/kg).
- **Red Onion**: Shashemene wholesale rate (ETB/kg).
- **Bread Wheat**: Arsi / Bale cereal benchmark (ETB/quintal).

---

## 4. Waybills & Dispatch Documentation
Standardized commercial slips adhering to Ethiopian trade and transit regulations:
- Format: `DOC #GH-WAYBILL-XXXXXX`
- Transport Reference: `#ET-GH-XXXXX`
- Includes itemized crop lots, buyer destination, pickup coordinates, driver handover signature blocks, and tamper-evident packaging checklists.
