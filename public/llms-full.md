# Sweet Reservation — Full Product Documentation for AI

**URL**: https://www.sweetreservation.com  
**Type**: SaaS Property Management System (PMS)  
**Market**: Morocco, North Africa  
**Language**: French (primary), Arabic, English  
**Currency**: MAD (Moroccan Dirham) for local payments, USD for international subscriptions

---

## Product Overview

Sweet Reservation is a hostel and auberge management platform built for the Moroccan market. It is a web application (Next.js, Supabase) accessible on desktop and mobile browsers, functioning as a Progressive Web App (PWA).

The core problem it solves: Moroccan hostel owners manage their businesses through paper registers, WhatsApp messages, and Excel spreadsheets. Sweet Reservation digitizes every workflow — from guest arrival to night audit — into a single platform that works in French, Arabic, and English.

---

## Core Features

### 1. Check-in Wizard
A 5-step guided flow completed in under 60 seconds:
1. Search existing guests or create new guest profile
2. Collect required information: full name, nationality, document type/number, date of birth, gender, phone/WhatsApp, country of residence, profession, address in Morocco, next destination
3. Assign bed, set dates, select booking source (Direct / Booking.com / Hostelworld / Walk-in / Phone)
4. Record payment (cash, bank transfer, CMI card, or mark as pending)
5. Confirm — triggers: bed status update, fiche de police PDF, WhatsApp welcome message

### 2. Fiche de Police (Police Registration)
- Generates a PDF matching the standard Moroccan police registration format
- Required by law for all foreign guests at any accommodation in Morocco
- Batch generation for all foreign guests per day (for night audit / prefecture submission)
- Fields: guest name, date of birth, nationality, document type and number, gender, profession, country of residence, address in Morocco, next destination, arrival/departure dates

### 3. Live Bed Map
- Visual grid of all beds grouped by room
- Color-coded status: green (occupied), white (available), amber (dirty/needs cleaning), red (maintenance), blue (checked in today)
- Click to open check-in, view guest details, or change status
- Real-time updates via Supabase Realtime

### 4. WhatsApp Hub
- Pre-built message templates in French, Arabic, and English
- Templates: welcome message (with WiFi password + checkout date), payment reminder, checkout reminder, review request
- Uses wa.me deep links — no API required for basic use
- Meta Cloud API integration available for automated sending
- Full message log with timestamps and status

### 5. Payments
- Record payments in MAD: cash, virement (bank transfer), CMI card, Wave, other
- Partial payment tracking (deposit vs. balance due)
- Cash reconciliation: expected vs. actual cash in drawer
- Pending payments list sorted by checkout date
- Payment breakdown by method per day

### 6. Revenue Reports & Analytics
- KPIs: occupancy rate, RevPAR, average length of stay, net revenue after commissions
- Charts: 30-day revenue bar chart, occupancy by day of week, booking source breakdown (donut), 6-month revenue trend
- Channel profitability table: Booking.com (15% commission), Hostelworld (12%), direct (0%)
- Date range filter: 7 days / 30 days / this month / last month / custom

### 7. Night Audit
- Guided wizard: day summary → cash reconciliation → tomorrow's brief → police report
- Records audit in database with cash difference
- Generates consolidated foreign guest PDF for prefecture submission

### 8. Staff Management
- Roles: owner, manager, receptionist, housekeeping
- Email invite flow: owner sends invite link → staff creates password → account linked
- Role-based access: housekeeping sees only bed map; receptionist handles check-in + payments; manager sees reports; owner sees everything
- Permission system: view_revenue, manage_settings, check_in_guests, record_payments, update_bed_status, send_whatsapp, view_night_audit, manage_maintenance

### 9. Maintenance Log
- Kanban board: Open / In Progress / Resolved
- Priority levels: Low / Normal / High / Urgent
- Urgent maintenance automatically marks the bed as unavailable
- Assign to staff member by name

### 10. Calendar View
- Timeline view of all bookings across beds
- Drag-and-resize bookings
- Quick check-in from calendar

### 11. Activities & Events
- Create hostel events (activities, tours, excursions)
- WhatsApp broadcast to all current guests
- Activity tracking feed on dashboard

### 12. Expenses Tracking
- Log operational expenses by category
- View expense trends vs. revenue

### 13. Housekeeping Tasks
- Assign specific cleaning tasks to housekeeping staff
- Track completion status

---

## Technical Architecture

- **Framework**: Next.js (App Router) deployed on Vercel
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Supabase Auth (email + password) with staff invite flow
- **Real-time**: Supabase Realtime subscriptions for live bed map and dashboard
- **PDF**: jsPDF + jsPDF-AutoTable (client-side, no server)
- **Charts**: Recharts
- **Styling**: Tailwind CSS + custom Apple-inspired design system
- **State**: Zustand (global) + TanStack Query (server state)
- **Billing**: LemonSqueezy (subscription management) + bank wire (MAD)

---

## Pricing Plans

| Plan | Price | Beds | Features |
|------|-------|------|----------|
| Free Trial | $0 | All | 14 days, no credit card |
| Starter | $19/month | Up to 20 | Police forms, WhatsApp, reports, email support |
| Pro | $49/month | Unlimited | All Starter features + advanced reports + staff management + WhatsApp support |

Moroccan customers can pay in MAD via bank transfer (Attijariwafa Bank).

---

## Legal & Compliance

- Police registration (fiche de police) compliance for Morocco
- GDPR-aware data handling
- Data stored in Supabase (EU region)

---

## Competitive Context

Sweet Reservation competes with:
- Generic PMS software (Cloudbeds, Little Hotelier) — not adapted to Morocco, expensive, English-only
- Excel/WhatsApp manual workflows — the current standard for most Moroccan hostels
- Local Moroccan PMS solutions — few exist, mostly for hotels not hostels

Sweet Reservation's differentiation: built specifically for Moroccan hostel workflows (fiche de police, MAD payments, WhatsApp-first communication, French/Arabic UI).

---

## Target Users

- Hostel and auberge owners in Moroccan cities: Agadir, Marrakech, Casablanca, Fes, Tangier, Chefchaouen, Essaouira, Merzouga
- Property size: 10–100 beds
- Tech comfort: basic smartphone users
- Languages: French-speaking Moroccan entrepreneurs
