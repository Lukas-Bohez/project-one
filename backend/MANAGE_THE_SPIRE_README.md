# Manage the Spire - Employee Management System

## Overview

**Manage the Spire** is a comprehensive employee management platform designed for fairness, transparency, and compliance. It's integrated into the Quiz The Spire ecosystem and provides tools for scheduling, time tracking, HR management, and analytics.

## ✅ What's Been Built

### Backend (Complete)
- ✅ **Database Schema**: 16 tables successfully migrated to `quizTheSpire` database
  - `manage_businesses` - Business account information
  - `manage_employees` - Employee profiles and roles
  - `manage_shifts` - Work schedule management
  - `manage_time_off` - PTO requests and approvals
  - `manage_warnings` - Performance management
  - `manage_employee_availability` - Schedule preferences
  - `manage_shift_swaps` - Peer-to-peer shift trading
  - `manage_announcements` - Company communications
  - `manage_documents` - File management
  - `manage_notes` - Employee notes (private to managers)
  - `manage_certifications` - Compliance tracking
  - `manage_departments` - Organizational structure
  - `manage_labor_costs` - Financial tracking
  - `manage_business_settings` - Configuration
  - `manage_templates` - Reusable schedules
  - `manage_audit_logs` - Complete activity tracking

- ✅ **API Endpoints** (`/api/v1/manage`):
  - `GET /health` - Health check
  - `POST /businesses` - Create business account
  - `GET /businesses/{id}` - Get business details
  - `GET /businesses/{id}/dashboard` - Analytics dashboard
  - `POST /employees` - Add employee
  - `GET /employees/{id}` - Get employee details
  - `GET /businesses/{business_id}/employees` - List employees
  - `POST /shifts` - Create shift
  - `GET /shifts` - Query shifts by date range
  - `GET /employees/{employee_id}/shifts` - Employee schedule
  - `POST /time-off` - Request time off
  - `GET /businesses/{business_id}/time-off` - List requests
  - `PUT /time-off/{id}` - Approve/deny request
  - `POST /warnings` - Issue warning
  - `GET /employees/{employee_id}/warnings` - Warning history

- ✅ **Pydantic Models** with validation:
  - Role enums (owner, manager, employee)
  - Status enums (active, inactive, pending, etc.)
  - Field validators (end_time > start_time, date ranges)
  - Business tier logic (free vs pro)

- ✅ **Repository Layer**:
  - Connection pooling integration
  - Type-safe database operations
  - Error handling and logging

### Frontend (Complete - Advanced)
- ✅ **Landing Page** (`/html/manage.html`):
  - Hero section with features and pricing
  - Login modal
  - Business setup modal
  - Dashboard with live stats
  - Links to Schedule Manager and Employee Portal
  - Dark mode support
  - Responsive design

- ✅ **Schedule Manager** (`/html/manage-schedule.html`):
  - **Interactive weekly calendar** with drag-and-drop shift moving
  - Employee rows with 7-day grid view
  - Add/Edit/Delete shifts with modal forms
  - Quick Fill feature for bulk shift creation
  - Real-time weekly summary (hours, labor costs, overtime)
  - Color-coded shift cards by status
  - Week navigation (Previous/Next/Today)
  - Mobile-responsive calendar with horizontal scroll

- ✅ **Employee Portal** (`/html/manage-employee.html`):
  - **Self-service interface** for employees
  - Tabbed navigation (Schedule, Time Off, Swaps, Profile)
  - Quick stats dashboard (weekly hours, estimated pay, PTO balance)
  - Upcoming shifts list with pay estimates
  - Time-off request form with PTO calculation
  - Shift swap marketplace (foundation)
  - Employee profile with performance metrics
  - Availability management

- ✅ **JavaScript** (`/js/manage.js`, `/js/schedule.js`, `/js/employee.js`):
  - Modal management system
  - Form validation and submission
  - API integration with fetch
  - LocalStorage state persistence
  - Toast notification system
  - Drag-and-drop shift scheduling
  - Dynamic shift duration calculation
  - Weekly analytics computation

- ✅ **Styling** (`/css/manage.css`, `/css/schedule.css`, `/css/employee.css`):
  - Professional UI components
  - Dark mode CSS variables
  - Responsive grid layouts
  - Smooth animations and transitions
  - Color-coded status badges
  - Mobile-first responsive design

### Integration
- ✅ Added "⚙️ Manage the Spire" button to main Quiz The Spire homepage
- ✅ Router integrated into FastAPI app with error handling
- ✅ Uses existing MySQL connection pool

## 🚧 What Needs to Be Built Next

### Priority 1: Authentication Integration
- [ ] Connect to main Quiz The Spire user system
- [ ] JWT token generation/validation
- [ ] Role-based access control middleware
- [ ] Password hashing and validation

### Priority 2: Full UI Implementation ✅ COMPLETE
- [✅] **Employer Dashboard**:
  - [✅] Drag-and-drop schedule calendar
  - [✅] Employee rows with weekly grid
  - [✅] Quick Fill for bulk scheduling
  - [✅] Weekly analytics (hours, costs, overtime)
  - [✅] Labor cost tracking
  
- [✅] **Employee Portal**:
  - [✅] Personal schedule view with upcoming shifts
  - [✅] Time-off request form with PTO calculation
  - [✅] Shift swap marketplace (foundation ready)
  - [✅] Profile with performance metrics
  - [✅] Weekly earnings estimate

- [🚧] **Manager Interface** (Partial - uses Schedule Manager):
  - [✅] View team schedules
  - [ ] Approve/deny time-off requests UI
  - [ ] Issue warnings UI
  - [ ] Department management UI

### Priority 3: Advanced Features
- [ ] Real-time notifications (Socket.IO)
- [ ] Mobile-responsive calendar
- [ ] CSV export for payroll
- [ ] Compliance alerts (overtime, labor laws)
- [ ] AI-powered scheduling recommendations
- [ ] Shift conflict detection
- [ ] Employee self-service check-in/out
- [ ] Integration with accounting software

### Priority 4: Testing & Deployment
- [ ] Unit tests for API endpoints
- [ ] Integration tests for database operations
- [ ] Frontend E2E tests
- [ ] Load testing for multi-tenant setup
- [ ] Security audit (SQL injection, XSS, CSRF)
- [ ] Documentation for end users
- [ ] Admin training materials

## 🎯 Unique Value Propositions

1. **Fairness-First Scheduling**: Algorithm ensures equitable shift distribution
2. **Compliance Automation**: Built-in labor law monitoring and alerts
3. **Two-Way Communication**: Anonymous feedback and transparent tracking
4. **Mobile-First**: Designed for frontline workers on smartphones
5. **Transparent Pricing**: No hidden fees, clear tier structure

## 💰 Revenue Model

- **Free Tier**: 10 employees, core features
- **Pro Tier**: $49/month, unlimited employees
- **Enterprise**: Custom pricing for advanced features

## 📊 Market Fit

**Target Customers**:
- Restaurants (5-50 employees)
- Retail stores (3-30 employees)
- Small service businesses (2-20 employees)

**Competitive Advantage**:
- More affordable than When I Work ($2-3/user/month)
- Fairer than ZoomShift (unlimited employees vs per-user)
- Simpler than Deputy (no complex enterprise features)

## 🔧 Technical Stack

- **Backend**: FastAPI, Python 3.9+
- **Database**: MySQL 8.0+ with connection pooling
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Authentication**: JWT (to be implemented)
- **Real-time**: Socket.IO (existing infrastructure)

## 📁 File Structure

```
backend/
├── api/routers/manage.py          # API endpoints (15 endpoints)
├── models/manage_models.py        # Pydantic schemas
├── database/manage_repository.py  # Data access layer
├── src/create_manage_tables.sql   # Database schema (16 tables)
└── app.py                         # FastAPI app (router integrated)

frontend/
├── html/
│   ├── manage.html                # Main dashboard & landing page
│   ├── manage-schedule.html       # Interactive schedule calendar
│   └── manage-employee.html       # Employee self-service portal
├── css/
│   ├── manage.css                 # Core styling
│   ├── schedule.css               # Calendar-specific styles
│   └── employee.css               # Employee portal styles
└── js/
    ├── manage.js                  # Main dashboard logic
    ├── schedule.js                # Schedule calendar interactions
    └── employee.js                # Employee portal functionality

scripts/
└── migrate_manage_tables.sh       # Migration script (already run ✅)
```

## 🚀 Quick Start

### For Developers

1. **Database is already set up** (16 tables migrat (main dashboard)
   - Or click "⚙️ Manage the Spire" from the main Quiz The Spire homepage
   - **Schedule Manager**: `http://127.0.0.1:5000/html/manage-schedule.html`
   - **Employee Portal**: `http://127.0.0.1:5000/html/manage-employee.html`

4. **Test the API**:
   ```bash
   curl http://127.0.0.1:5000/api/v1/manage/health
   ```

5. **Try the Interactive Features**:
   - **Schedule Calendar**: Drag shifts between days/employees
   - **Quick Fill**: Create multiple shifts at once
   - **Employee Portal**: Request time off, view schedule
   - **Weekly Analytics**: See real-time labor cost calculations

3. **Access the UI**:
   - Visit `http://127.0.0.1:5000/html/manage.html`
   - Or click "⚙️ Manage the Spire" from the main Quiz The Spire homepage

4. **Test the API**:
   ```bash
   curl http://127.0.0.1:5000/api/v1/manage/health
   ```

### For Business Owners

1. Click "⚙️ Manage the Spire" from Quiz The Spire homepage
2. Click "Get Started Free"
3. Fill out business registration form
4. Start adding employees and creating schedules

## 📝 API Examples

### Create a Business
```bash
curl -X POST http://127.0.0.1:5000/api/v1/manage/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "owner_user_id": 1,
    "business_name": "Joe's Coffee Shop",
    "tier": "free",
    "max_employees": 10,
    "timezone": "America/New_York",
    "contact_email": "joe@coffeeshop.com"
  }'
```

### Add an Employee
```bash
curl -X POST http://127.0.0.1:5000/api/v1/manage/employees \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": 1,
    "user_id": 2,
    "role_id": 3,
    "employee_code": "EMP001",
    "first_name": "Alice",
    "last_name": "Johnson",
    "hourly_rate": 15.50
  }'
```

### Create a Shift
```bash
curl -X POST http://127.0.0.1:5000/api/v1/manage/shifts \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "business_id": 1,
    "shift_date": "2026-01-15",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "break_minutes": 30,
    "notes": "Morning shift - cashier"
  }'
```

### Get Dashboard Stats
```bash
curl http://127.0.0.1:5000/api/v1/manage/businesses/1/dashboard
```

## 🔒 Security Considerations

- [ ] Implement rate limiting on login endpoints
- [ ] Add CSRF protection for form submissions
- [ ] Sanitize all user inputs to prevent XSS
- [ ] Use parameterized queries (already implemented)
- [ ] Add audit logging for sensitive actions (table exists)
- [ ] Implement role-based access control
- [ ] Encrypt sensitive employee data (SSN, etc.)

## 📈 Next Steps

1. **Immediate**: Implement authentication with main user system
2. **Week 1**: Build drag-and-drop schedule calendar
3. **Week 2**: Complete employee portal with time-off requests
4. **Week 3**: Add analytics dashboard with charts
5. **Month 2**: Marketing and beta testing with real businesses
6. **Month 3**: Launch Pro tier and payment processing
February 4, 2026  
**Status**: ✅ Backend Complete | ✅ Frontend Advanced UI Complete  
**Migration**: ✅ 16 Tables Successfully Created  
**Features Ready**: 🎯 Schedule Manager | 👤 Employee Portal | 📊 Analytics Dashboar
- Authentication not yet integrated (uses demo mode)
- Dashboard shows placeholder data
- No real-time updates (Socket.IO integration pending)
- Missing mobile app (web-only for now)

## 📞 Support

For questions or issues:
- Contact: Oroka Conner
- Project: Quiz The Spire Suite
- Status: **Backend Complete, Frontend Basic UI Ready**

---

**Last Updated**: January 2026  
**Status**: ✅ Backend Complete | 🚧 Frontend In Progress  
**Migration**: ✅ 16 Tables Successfully Created
