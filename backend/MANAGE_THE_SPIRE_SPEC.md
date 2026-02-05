# Manage the Spire - Specification

## Market Niche & Unique Value Proposition

### The Gap in Current Management Tools
- **Too Complex**: Enterprise tools like BambooHR, Workday require extensive training
- **Too Simple**: Basic scheduling apps lack compliance tracking
- **Expensive**: Most charge per-employee monthly fees ($8-15/user)
- **Poor Mobile UX**: Desktop-first designs don't work for frontline workers
- **No Fairness Metrics**: Managers can play favorites without accountability
- **Limited Employee Voice**: One-way communication, no anonymous feedback

### Manage the Spire's Unique Niche
**Target Market**: Small to medium businesses (5-100 employees) in retail, hospitality, healthcare, and service industries

**Key Differentiators**:
1. **Fairness-First Scheduling Algorithm** - Prevents manager bias, ensures equitable distribution
2. **Compliance Automation** - Built-in labor law compliance (breaks, overtime, minor restrictions)
3. **Employee Wellness Integration** - Mental health check-ins, burnout detection
4. **Skills Matrix & Training** - Track certifications, required training, skill gaps
5. **Transparent Performance System** - Warnings, commendations visible to both parties
6. **Real-Time Shift Economy** - Employees can swap/pick up shifts with instant approval workflows
7. **Anonymous Feedback Channels** - Safe reporting of issues, suggestions
8. **Mobile-First Design** - Works perfectly on smartphones for frontline workers
9. **Free Tier** - Up to 10 employees free forever (revenue from premium features)
10. **Privacy-Focused** - No selling employee data, GDPR/CCPA compliant

## Core Features

### For Business Owners/Managers
- **Dashboard**: Real-time overview of staffing, costs, compliance alerts
- **Smart Scheduler**: Drag-drop interface with AI suggestions for optimal coverage
- **Employee Profiles**: Skills, availability, performance history, certifications
- **Time Tracking**: Clock in/out, GPS verification, break compliance monitoring
- **Leave Management**: PTO requests, sick days, approval workflows
- **Performance Management**: Warnings, write-ups, commendations, improvement plans
- **Compliance Monitoring**: Automatic alerts for labor law violations
- **Analytics & Reporting**: Labor costs, overtime trends, turnover predictions
- **Communication Hub**: Announcements, direct messaging, emergency broadcasts
- **Budget Tracking**: Forecast labor costs against actual

### For Employees
- **Personal Dashboard**: Upcoming shifts, hours worked, earnings projection
- **Schedule View**: Month/week view with shift details
- **Shift Marketplace**: Pick up open shifts, request shift swaps
- **Time-Off Requests**: Submit PTO, view accruals, check approval status
- **Availability Management**: Set recurring availability, blackout dates
- **Document Center**: View pay stubs, tax forms, handbooks
- **Skills & Training**: See required certifications, complete assigned training
- **Wellness Check-ins**: Optional mental health surveys, burnout alerts
- **Anonymous Feedback**: Report issues safely without fear of retaliation
- **Performance Tracking**: View commendations, goals, improvement plans

## Technical Architecture

### Database Schema
**Tables**:
- `manage_businesses` - Company info, subscription tier, settings
- `manage_employees` - Employee profiles, roles, hire date, status
- `manage_shifts` - Scheduled shifts with position, notes
- `manage_time_entries` - Clock in/out records with location
- `manage_time_off_requests` - PTO/sick leave requests
- `manage_warnings` - Disciplinary actions, performance issues
- `manage_commendations` - Positive recognition, achievements
- `manage_skills` - Skills catalog (certifications, training)
- `manage_employee_skills` - Employee-skill junction with expiry dates
- `manage_availability` - Employee availability patterns
- `manage_shift_swaps` - Shift trade requests and approvals
- `manage_announcements` - Company-wide communications
- `manage_feedback` - Anonymous employee feedback
- `manage_compliance_alerts` - Auto-generated compliance warnings
- `manage_audit_logs` - Complete audit trail of all actions

### Tech Stack
- **Backend**: FastAPI (Python) - existing stack
- **Frontend**: Vanilla JS, HTML5, CSS3 - matches Quiz the Spire
- **Database**: MySQL - existing infrastructure
- **Authentication**: JWT tokens with role-based access
- **Real-time**: Socket.IO for live updates
- **Mobile**: Progressive Web App (PWA) installable

### Security & Privacy
- **Role-based permissions**: Owner, Manager, Employee tiers
- **Data encryption**: All PII encrypted at rest
- **Audit logging**: Every action tracked with IP and timestamp
- **Anonymous feedback**: One-way encryption prevents de-anonymization
- **GDPR compliance**: Data export, right to deletion
- **Session management**: Automatic timeout, device tracking

## Monetization Strategy
- **Free Tier**: Up to 10 employees, basic features
- **Pro Tier**: $49/month unlimited employees, advanced analytics
- **Enterprise**: Custom pricing, API access, SSO, dedicated support

## Implementation Phases
**Phase 1 (MVP)**: 
- Basic authentication
- Employee CRUD
- Simple scheduling
- Time-off requests
- Warnings system

**Phase 2**:
- Shift swapping
- Skills tracking
- Compliance alerts
- Analytics dashboard

**Phase 3**:
- Anonymous feedback
- Wellness check-ins
- Mobile PWA
- Advanced reporting

## Success Metrics
- User acquisition: 100 businesses in first 3 months
- Daily active usage: >60% of registered employees
- Customer satisfaction: >4.5/5 average rating
- Conversion rate: >15% free to paid
- Retention: <5% monthly churn
