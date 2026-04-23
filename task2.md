# HostelPro — Future SaaS Features (Task 2)
# Instructions for Next Iterations
# ============================================================
# This file tracks the new features and missing infrastructure work 
# needed to take HostelPro to an advanced, production-grade SaaS.
# Based on the multi-agent architectural review.
# ============================================================

---

## TASK GROUP 1 — Revenue Operations & Subscriptions

### Task 1.1 — Stripe Billing Integration
- **Goal:** Automate SaaS subscription collection.
- **Requirements:** 
  - Set up Stripe products (e.g., Starter, Pro, Enterprise tiers).
  - Create secure checkout sessions for new properties.
  - Implement a Customer Portal for viewing invoices and managing billing.

### Task 1.2 — Subscriptions Database Schema
- **Goal:** Link properties to their billing status.
- **Requirements:** 
  - Create a `subscriptions` table linked to `properties`.
  - Add fields for `stripe_customer_id`, `status` (active, past_due, canceled), `current_period_end`.
  - Listen to Stripe webhooks in a Next.js API route (`/api/webhooks/stripe`) to update this table automatically.

---

## TASK GROUP 2 — Advanced Property Operations

### Task 2.1 — Basic Point of Sale (POS) Module
- **Goal:** Allow hostels to sell extras (food, drinks, surf lessons, tours).
- **Requirements:** 
  - Create a `products` table (Item, Price, Category).
  - Add a rapid POS screen for staff to add items to a guest's tab.
  - Show combined "Accommodation + Extras" total on the checkout Payment screen.

### Task 2.2 — Guest Self Check-In Web Portal
- **Goal:** Guests fill out their own Fiche de Police details before arrival.
- **Requirements:** 
  - Create a public-facing route `/checkin/[booking_uuid]`.
  - Add form validation matching the precise Moroccan Fiche de Police data requirements.
  - Auto-generate a WhatsApp message template containing the guest's unique check-in link.

### Task 2.3 — Shift Change & Cash Reconciliation
- **Goal:** Prevent cash discrepancies between receptionist shifts.
- **Requirements:** 
  - Create a physical cash drawer hand-over flow.
  - Log expected cash vs actual cash with the specific staff member's ID signing off.
  - Send automated alerts to the owner on significant cash discrepancies.

---

## TASK GROUP 3 — Security, Data & Access

### Task 3.1 — Granular Role-Based Access Control (RBAC)
- **Goal:** Restrict sensitive operations and protect business data.
- **Requirements:** 
  - Enforce PostgREST RLS policies so *receptionists* cannot see total aggregate revenue or delete payments.
  - Update UI to hide revenue metrics based on the `hide_revenue` flag in the staff table.

### Task 3.2 — Immutable Audit Logs
- **Goal:** Track destructive operations.
- **Requirements:** 
  - Create an `audit_logs` table (Timestamp, User ID, Action, Record ID, Schema).
  - Use Supabase Database Functions/Triggers or Middleware to log who modified booking dates, pricing, or deleted any record.

### Task 3.3 — Offline-First PWA Capabilities
- **Goal:** Allow check-ins even when internet connectivity drops.
- **Requirements:** 
  - Configure `next-pwa` with service workers.
  - Use a local sync strategy (e.g., IndexedDB) to queue check-ins and payments when offline, submitting them to Supabase once connectivity returns.

### Task 3.4 — Automated Police Report (DGSN) Submission
- **Goal:** Remove the manual step of emailing or printing PDFs if permitted.
- **Requirements:** 
  - Set up a cron job (via Vercel Cron) to batch generate Fiches de Police at 23:59.
  - Automate secure emailing to the local prefecture or integrate directly with a local government API if exposed.

---

## TASK GROUP 4 — External Distribution (Channel Manager)

### Task 4.1 — Channel Manager (Two-Way Sync) Integration
- **Goal:** Keep Hostelworld, Booking.com, and HostelPro availability perfectly in sync.
- **Requirements:** 
  - API Integration with a Channel Manager aggregator (e.g., Channex.io or Beds24).
  - Setup webhook listeners to insert incoming OTA bookings instantly into the `bookings` table.
  - Trigger inventory availability pushes to the OTA whenever a bed is booked manually in the app or via walk-in.

---

## TASK GROUP 5 — Essential DevOps & Monitoring (Missing Setup Tasks)

### Task 5.1 — Error Monitoring Configuration
- **Goal:** Proactively catch front-end and back-end errors.
- **Requirements:** 
  - Install and configure Sentry.io or Datadog for the Next.js project.

### Task 5.2 — CI/CD Deployment Pipeline
- **Goal:** Automate testing and deployment safely.
- **Requirements:** 
  - Create GitHub Actions workflows for running TypeScript compilation checks, ESLint verification.
  - Automate pushing verified builds to Vercel (or prevent Vercel builds if GitHub checks fail).

### Task 5.3 — Staging Environment Configuration
- **Goal:** A safe testing ground without affecting live guests.
- **Requirements:** 
  - Spin up a separate Supabase project dedicated to staging.
  - Set up a Vercel staging URL linked to the staging database branch.
