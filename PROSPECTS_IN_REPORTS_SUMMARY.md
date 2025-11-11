# Prospects Added to Reports Page

## Overview
Prospects (unconverted referrals) are now fully integrated into the Reports page, providing complete pipeline visibility from initial referral through service delivery.

---

## 🆕 New Components Added

### 1. **ProspectMetrics Component** (4-Card Overview)

#### Card 1: Active Prospects
- **Shows**: Total number of prospects (referrals without `client_id`)
- **Growth**: 30-day trend with ↗️/↘️ indicator
- **Color**: Purple gradient accent
- **Link**: Clicks through to Prospects page

#### Card 2: Conversion Rate
- **Shows**: Percentage of referrals converted to clients
- **Secondary**: Shows "X/Y" (converted/total)
- **Color**: Green gradient (success indicator)
- **Purpose**: Track how well prospects are being converted

#### Card 3: Avg Wait Time
- **Shows**: Average days prospects are waiting (since created)
- **Secondary**: Shows oldest prospect age
- **Color**: Orange/amber gradient
- **Alert**: Green if avg < 7 days, red if > 7 days
- **Purpose**: Identify aging prospects that need attention

#### Card 4: Stale Prospects
- **Shows**: Count of prospects older than 14 days
- **Status**: "Needs attention" or "All fresh"
- **Color**: Red gradient (warning indicator)
- **Purpose**: Highlight prospects that need immediate follow-up
- **Action Required**: If > 0, review and convert

---

### 2. **ProspectFunnelChart Component** (Conversion Pipeline)

#### Visual Funnel Bars
Interactive horizontal progress bars showing:
1. 📋 **Referrals** (100% - total count)
2. 👥 **Active Prospects** (% unconverted)
3. ✅ **Converted** (% converted to clients)
4. 📝 **In Intake** (% in intake phase)
5. ⚙️ **In Onboarding** (% in onboarding)
6. 🎯 **In Service** (% in service initiation)

Each bar shows:
- Icon for quick identification
- Stage name and count
- Percentage of total referrals
- Width proportional to percentage
- Color-coded by stage

#### Bar Chart
Below the visual funnel is a traditional bar chart showing the same data with:
- Detailed tooltips on hover
- Exact counts and percentages
- Color-coded bars matching funnel colors

#### Header Metrics
- **Total Referrals**: All-time count
- **Conversion Rate**: Percentage that became clients

---

## 📊 Metrics Being Tracked

### Prospect-Specific Metrics

| Metric | Calculation | Business Value |
|--------|-------------|----------------|
| **Active Prospects** | Referrals where `client_id IS NULL` | Pipeline size |
| **30-Day Prospect Growth** | Compare last 30d vs previous 30d | Trend tracking |
| **Avg Wait Time** | Average days since prospect created | Speed to conversion |
| **Oldest Prospect** | Max days since created | At-risk identification |
| **Stale Prospects** | Count > 14 days old | Follow-up urgency |
| **Conversion Rate** | (Converted / Total Referrals) × 100 | Quality metric |

### Funnel Stages

```
Referrals (100%)
    ↓
Active Prospects (X%)
    ↓
Converted to Clients (Y%)
    ↓
├─ In Intake (A%)
├─ In Onboarding (B%)
└─ In Service (C%)
```

---

## 🎯 Business Questions Now Answered

### Question 1: "How many prospects are waiting?"
**Answer**: ProspectMetrics → "Active Prospects" card
- Exact count displayed
- 30-day trend shows if growing

### Question 2: "Are prospects getting stale?"
**Answer**: ProspectMetrics → "Avg Wait Time" & "Stale Prospects" cards
- Average days waiting
- Count older than 14 days
- **Action**: If stale > 0, prioritize follow-up

### Question 3: "What's our conversion rate?"
**Answer**: ProspectMetrics → "Conversion Rate" card
- Percentage converting from referral to client
- **Benchmark**: >70% is excellent

### Question 4: "Where are prospects dropping off?"
**Answer**: ProspectFunnelChart visual funnel
- See exact stage where numbers decline
- Identify conversion bottlenecks
- **Example**: If 100 referrals → 80 prospects → 40 converted = 50% drop-off

### Question 5: "How does the full pipeline look?"
**Answer**: ProspectFunnelChart complete view
- From referral through service initiation
- See every stage percentage
- Visual representation makes gaps obvious

---

## 🚨 Alert Thresholds

### Green (Healthy) 🟢
- **Avg Wait Time**: < 7 days
- **Stale Prospects**: 0
- **Conversion Rate**: > 70%

### Yellow (Monitor) 🟡
- **Avg Wait Time**: 7-14 days
- **Stale Prospects**: 1-5
- **Conversion Rate**: 50-70%

### Red (Action Required) 🔴
- **Avg Wait Time**: > 14 days
- **Stale Prospects**: > 5
- **Conversion Rate**: < 50%
- **Oldest Prospect**: > 30 days

---

## 📅 Weekly Prospect Review Process

### Monday Morning Checklist

1. **Check Active Prospects**
   - Look at count and 30-day trend
   - **Action**: If declining, review referral sources

2. **Review Stale Prospects**
   - Look at stale count (>14 days)
   - **Action**: If any stale, assign follow-up calls

3. **Analyze Conversion Rate**
   - Check percentage
   - **Action**: If <70%, investigate why prospects aren't converting

4. **Review Funnel Drop-offs**
   - Look at ProspectFunnelChart
   - **Action**: Identify largest percentage drops

5. **Set Weekly Goals**
   - Target: Convert X prospects this week
   - Target: Reduce avg wait time by Y days
   - Target: Clear all stale prospects

---

## 🎯 Action Plans Based on Data

### Scenario 1: High Prospect Count, Low Conversion
**Data**: 50 active prospects, 30% conversion rate
**Problem**: Not converting enough
**Actions**:
1. Review prospect qualification criteria
2. Speed up intake scheduling
3. Improve follow-up process
4. Train team on conversion best practices

### Scenario 2: High Stale Prospect Count
**Data**: 15 stale prospects (>14 days)
**Problem**: Prospects waiting too long
**Actions**:
1. Assign immediate follow-up calls
2. Streamline intake process
3. Add more intake capacity
4. Set up automated reminders

### Scenario 3: Low Referral Volume
**Data**: Only 10 new prospects this month (30-day trend -40%)
**Problem**: Not enough prospects entering pipeline
**Actions**:
1. Increase marketing efforts
2. Contact referral sources
3. Launch referral incentive program
4. Attend community events

### Scenario 4: Funnel Bottleneck
**Data**: 80% convert to clients, but 50% stuck in intake
**Problem**: Bottleneck at intake phase
**Actions**:
1. Add intake staff
2. Streamline intake forms
3. Pre-schedule intake appointments
4. Automate document collection

---

## 🔄 Integration with Existing Reports

### Prospect Metrics Position
- **Location**: After StatsOverview, before Intake Trends
- **Visibility**: Always visible (4 cards side-by-side)
- **Purpose**: Quick prospect pipeline health check

### Prospect Funnel Position
- **Location**: After Intake Trends & Throughput charts
- **Visibility**: Full-width chart with visual funnel
- **Purpose**: Detailed conversion analysis

### Data Flow
```
Referrals (Prospects Page)
    ↓
Prospect Metrics (Reports)
    ↓
Prospect Funnel (Reports)
    ↓
Client Stats (Reports)
    ↓
Throughput Analysis (Reports)
```

---

## 📱 Role-Based Filtering

### Marketers
- See **only their own prospects** (by marketer_name/email)
- Prospect metrics filtered to their data
- Funnel shows only their referrals

### Admins/Managers
- See **all prospects** across organization
- Complete funnel visibility
- Can compare marketer performance

---

## 💡 Pro Tips

1. **Check Stale Prospects Daily**
   - Set goal: Zero stale prospects by end of week
   - Prioritize oldest first

2. **Track Conversion Rate Weekly**
   - Document what works when rate improves
   - Investigate when rate drops

3. **Use Funnel for Training**
   - Show new staff the full pipeline
   - Explain each stage purpose

4. **Set Conversion Goals**
   - Example: "Convert 80% of prospects within 7 days"
   - Track progress weekly

5. **Celebrate Wins**
   - When conversion rate improves, recognize team
   - Share successful conversion stories

---

## 🎓 Training Use Cases

### For Intake Coordinators
- Monitor stale prospects daily
- Track average wait time
- Goal: Convert prospects within 7 days

### For Marketers
- See their own prospect pipeline
- Track their conversion rate
- Identify which referral sources convert best

### For Management
- Strategic pipeline visibility
- Resource allocation decisions
- Performance benchmarking

---

## ✨ Key Benefits

1. **Complete Visibility**: See entire pipeline from referral to service
2. **Early Warning**: Identify stale prospects before they're lost
3. **Performance Tracking**: Measure conversion effectiveness
4. **Bottleneck Identification**: See where prospects drop off
5. **Data-Driven Actions**: Make decisions based on real metrics
6. **Accountability**: Clear metrics for team performance

---

## 📊 Example Insights

**Before**: "We have some prospects waiting, not sure how many or how long"

**After**: 
- "We have 24 active prospects"
- "5 are stale (>14 days) and need immediate follow-up"
- "Our conversion rate is 68% - slightly below our 70% target"
- "Average wait time is 9 days - we should aim for <7"
- "Biggest drop-off is between referral and conversion (32% drop)"

---

Your Reports page now provides **complete pipeline intelligence** from initial referral through service delivery! 🚀

