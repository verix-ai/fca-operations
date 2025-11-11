# Reports Page Layout Guide

## Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 REPORTS                                                      │
│  Home Care Analytics Dashboard                                  │
│  Track client onboarding, referral performance, throughput...   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  KPI HERO SECTION (Large, Prominent)                            │
│  ┌─────────────┬──────────────────────────┬─────────────────┐  │
│  │ FOCUS AREAS │   MONTHLY PROGRESS       │ HIGHLIGHT       │  │
│  │             │   Client Intake &        │ METRICS         │  │
│  │ • Client    │   Onboarding Pipeline    │                 │  │
│  │   Intake    │   ┌──────────────────┐   │ Avg Throughput │  │
│  │ • Throughput│   │  📈 Area Chart   │   │ Active Clients │  │
│  │ • Marketer  │   │  Monthly Trend   │   │ Conversion %   │  │
│  │   Performance│  │                  │   │ Referrals      │  │
│  │ • Operations│   └──────────────────┘   │                 │  │
│  │             │                          │                 │  │
│  │ Q1: 45      │   [Intake] [Onboarding]  │                 │  │
│  │ Q2: 52      │   [In Service]           │                 │  │
│  │ Q3: 61      │                          │                 │  │
│  └─────────────┴──────────────────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STATS OVERVIEW (4 Cards)                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ 👥       │ │ ⏰       │ │ ⚠️       │ │ ✅       │         │
│  │ TOTAL    │ │ IN       │ │ IN       │ │ IN       │         │
│  │ CLIENTS  │ │ INTAKE   │ │ ONBOARD  │ │ SERVICE  │         │
│  │          │ │          │ │          │ │          │         │
│  │   156    │ │   24     │ │   18     │ │   114    │         │
│  │          │ │          │ │          │ │          │         │
│  │ ↗ +15.3% │ │ ↗ +8.2%  │ │ ↘ -3.1%  │ │ ↗ +12.4% │         │
│  │   30d    │ │   30d    │ │   30d    │ │   30d    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PRIMARY CHARTS (Side-by-Side)                                  │
│  ┌───────────────────────────┬────────────────────────────┐    │
│  │ CLIENT INTAKE TREND       │ THROUGHPUT CHART           │    │
│  │ ┌───────────────────────┐ │ ┌───────────────────────┐  │    │
│  │ │ 📈 Area Chart         │ │ │ 📉 Line Chart         │  │    │
│  │ │ Monthly new clients   │ │ │ Avg days to phases    │  │    │
│  │ │ YTD Total: 156        │ │ │ • Overall Avg         │  │    │
│  │ │                       │ │ │ • To Onboarding       │  │    │
│  │ │ Jan Feb Mar Apr May   │ │ │ • To Service          │  │    │
│  │ │  ▁ ▃ ▄ ▆ █           │ │ │                       │  │    │
│  │ └───────────────────────┘ │ └───────────────────────┘  │    │
│  └───────────────────────────┴────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SECONDARY CHARTS (Side-by-Side)                                │
│  ┌───────────────────────────┬────────────────────────────┐    │
│  │ TOP MARKETERS             │ PHASE TIME CHART           │    │
│  │ ┌───────────────────────┐ │ ┌───────────────────────┐  │    │
│  │ │ 📊 Bar Chart          │ │ │ 📊 Bar Chart          │  │    │
│  │ │ Top 5 by clients      │ │ │ Avg time in phase     │  │    │
│  │ │                       │ │ │                       │  │    │
│  │ │ John Smith    ████    │ │ │ Intake      ██        │  │    │
│  │ │ Mary Johnson  ███     │ │ │ Onboarding  ████      │  │    │
│  │ │ Bob Williams  ██      │ │ │ Service     ███       │  │    │
│  │ │ Sarah Davis   ██      │ │ │                       │  │    │
│  │ │ Mike Brown    █       │ │ │                       │  │    │
│  │ └───────────────────────┘ │ └───────────────────────┘  │    │
│  └───────────────────────────┴────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TERTIARY CHARTS (Side-by-Side)                                 │
│  ┌───────────────────────────┬────────────────────────────┐    │
│  │ CLIENTS BY COUNTY         │ COST SHARE BY PROGRAM      │    │
│  │ ┌───────────────────────┐ │ ┌───────────────────────┐  │    │
│  │ │ 📊 Bar Chart          │ │ │ 🥧 Pie Chart          │  │    │
│  │ │ Top 10 counties       │ │ │ Program distribution  │  │    │
│  │ │                       │ │ │                       │  │    │
│  │ │ Franklin  ██████      │ │ │     PSS (45%)        │  │    │
│  │ │ Delaware  ████        │ │ │     PCA (30%)        │  │    │
│  │ │ Fairfield ███         │ │ │     Companion (15%)  │  │    │
│  │ │ Summit    ██          │ │ │     Respite (10%)    │  │    │
│  │ └───────────────────────┘ │ └───────────────────────┘  │    │
│  └───────────────────────────┴────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  MARKETER PERFORMANCE TABLE (Full Width)                        │
│  [Visible to Admins/Managers only]                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Marketer Performance Details           🏅 8 Active       │  │
│  │ ─────────────────────────────────────────────────────────│  │
│  │ Marketer         │Total│30d│Intake│Board│Svc│Avg│Comp%│  │
│  │ ─────────────────────────────────────────────────────────│  │
│  │ 🥇 John Smith 🏆 │  45 │↗12│  8  │  6  │31 │25d│███69%│  │
│  │ 🥈 Mary Johnson  │  38 │↗10│  5  │  8  │25 │28d│██ 66%│  │
│  │ 🥉 Bob Williams  │  32 │↗ 8│  4  │  5  │23 │32d│██ 72%│  │
│  │    Sarah Davis   │  24 │↗ 5│  3  │  4  │17 │35d│█  71%│  │
│  │    Mike Brown    │  17 │ 3 │  2  │  3  │12 │38d│█  71%│  │
│  │ ─────────────────────────────────────────────────────────│  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Color Legend

- 🟢 **Green** - Positive trends, fast throughput (<30 days)
- 🔴 **Red** - Negative trends, slower performance
- 🔵 **Brand Cyan** - Primary brand color for highlights
- ⚪ **Gray** - Neutral/no data

## Icons & Badges

- 🥇 🥈 🥉 - Top 3 ranked marketers
- 🏆 - Top performer badge
- 📈 ↗ - Positive trend up
- 📉 ↘ - Negative trend down
- ⏰ - Time-related metrics
- 👥 - People/client count
- ✅ - Completion/service
- ⚠️ - In-progress/onboarding

## Responsive Behavior

### Desktop (XL)
- KPI Hero: 3 columns (left rail, chart, right metrics)
- All charts: 2 columns side-by-side
- Table: Full width with all columns

### Tablet (LG)
- KPI Hero: 2 columns (left rail + chart, metrics below)
- All charts: 2 columns side-by-side
- Table: Full width, may need horizontal scroll

### Mobile (MD)
- KPI Hero: Stacked vertical
- Stats: 2 columns
- Charts: Stacked vertical (1 column)
- Table: Horizontal scroll enabled

## Key Metrics at a Glance

| Metric | Location | Purpose |
|--------|----------|---------|
| **Total Clients** | Stats Card #1 | Overall growth tracking |
| **30-Day Growth** | All stat cards | Recent performance |
| **Avg Throughput** | KPI Hero right panel | Speed of client progression |
| **Conversion Rate** | KPI Hero right panel | Referral effectiveness |
| **Monthly Intake** | Client Intake Trend Chart | Seasonal patterns |
| **Phase Times** | Phase Time Chart | Bottleneck identification |
| **Top Marketers** | Top Marketers Chart + Table | Performance recognition |
| **Geographic Coverage** | Clients by County | Territory planning |

## Interactive Elements

1. **Stat Cards** - Click to filter client list by phase
2. **Charts** - Hover for detailed tooltips
3. **Marketer Table** - Sortable columns (future enhancement)
4. **Progress Bars** - Visual completion rates

## Data Refresh

- Auto-loads on page visit
- Real-time calculations from database
- No caching (always current data)
- Filtered by user role automatically

