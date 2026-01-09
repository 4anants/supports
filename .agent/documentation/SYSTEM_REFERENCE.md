# IT Support Portal - Complete System Reference

**Last Updated:** 2026-01-09  
**Purpose:** Comprehensive documentation of all features, workflows, and database schema to prevent breaking changes during updates.

---

## 📋 TABLE OF CONTENTS
1. [Features Overview](#features-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Ticket Workflow](#ticket-workflow)
4. [Email Notification Flow](#email-notification-flow)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Integration Points](#integration-points)
8. [Critical Dependencies](#critical-dependencies)

---

## 🎯 FEATURES OVERVIEW

### 1. **Ticket Management**
- ✅ Public ticket submission (Support Issues + Hardware Requests)
- ✅ Ticket tracking via generated ID (public view)
- ✅ Admin dashboard with full ticket management
- ✅ Status changes: Open → Pending → On Hold → Resolved
- ✅ Priority levels: Low, Medium, High, Critical
- ✅ Admin remarks/notes system
- ✅ Attachment support (image files)
- ✅ Multi-select bulk deletion (PIN protected)
- ✅ Export to CSV functionality
- ✅ **Reopen Ticket Feature** (users can reopen resolved tickets with reason)
- ✅ **Timeline Reset on Reopen** (tracks `reopened_at` for accurate duration)

### 2. **Priority Management** ⭐ NEW
- ✅ Admins and IT Support can change ticket priority
- ✅ Dropdown in dashboard with color-coded options
- ✅ Tracks who changed priority (`resolved_by` field)

### 3. **Email Notifications** ⭐ ENHANCED
- ✅ New ticket notifications (User + Team)
- ✅ Status update notifications (User + Team)
- ✅ Stock update notifications (Team only)
- ✅ Low stock alerts (Team only)
- ✅ **Email Timeline Display** (shows Resolved date + Duration in emails)
- ✅ **Reopen Link** in emails for resolved tickets
- ✅ Beautiful HTML templates (Outlook-compatible)

### 4. **Inventory Management**
- ✅ Stock tracking by item, category, and office
- ✅ Minimum threshold alerts
- ✅ Stock level notifications (email every 2 weeks)
- ✅ **Matrix View** for bulk updates (item × office grid)
- ✅ Inventory logs with change tracking
- ✅ **Stock Color Coding** ⭐ UPDATED
  - **Green**: Good stock (qty >= 7)
  - **Purple**: Medium stock (qty 5-6)
  - **Orange**: Low stock (qty 1-4)
  - **Red**: Out of stock (qty = 0)

### 5. **Security Features**
- ✅ Admin authentication (JWT-based)
- ✅ Role-based access (Admin, IT Support)
- ✅ PIN protection for critical operations (delete tickets)
- ✅ Firewall with IP whitelist
- ✅ Rate limiting (global + login-specific)
- ✅ HTTPS/TLS support

### 6. **Configuration & Branding**
- ✅ Dynamic office and department management
- ✅ Custom branding (background images, logos)
- ✅ SMTP configuration (DB-stored)
- ✅ App URL settings
- ✅ Backup system (local + cloud)

---

## 👥 USER ROLES & PERMISSIONS

### **Public Users (No Auth)**
- ✅ Submit tickets
- ✅ Track ticket status via ID
- ✅ Reopen resolved tickets (with reason)
- ❌ No access to dashboard

### **IT Support**
- ✅ View all tickets
- ✅ Update ticket status
- ✅ Add admin remarks
- ✅ **Change ticket priority** ⭐
- ✅ Resolve tickets
- ✅ View inventory
- ❌ Cannot delete tickets
- ❌ Cannot manage users

### **Admin**
- ✅ All IT Support permissions
- ✅ **Delete tickets** (PIN required)
- ✅ **Bulk delete tickets** (PIN required)
- ✅ Manage users
- ✅ Manage inventory
- ✅ Configure settings
- ✅ View backup logs

---

## 🔄 TICKET WORKFLOW

### **1. Ticket Creation**
```
User fills form → Validates → Uploads attachment? → API creates ticket
                                                    ↓
                                    Generates unique ID (e.g., TKT-20260109-ABCD)
                                                    ↓
                        Sends email to User (confirmation) + Team (new ticket)
                                                    ↓
                                            Status: "Open"
```

**Database Changes:**
- Insert into `Ticket` table
- `status = "Open"`
- `created = now()`
- `generated_id = generated`

**Email Triggers:**
- `sendTicketNotification(ticket)` → User: "Received", Team: "New Ticket"

---

### **2. Status Updates (Admin/IT)**
```
Admin changes status → Modal asks for remarks → API updates ticket
                                                        ↓
                                    Sets resolved_at if "Resolved"
                                    Sets responded_at if first response
                                                        ↓
                                Sends email to User + Team (update)
```

**Database Changes:**
- Update `Ticket` table
- `status = newStatus`
- `resolved_at = now()` (if Resolved)
- `resolved_by = adminName`
- `admin_remarks = remarks`

**Email Triggers:**
- `sendUpdateNotification(ticket)` → User: "Update", Team: "Notify"
- **Includes "Reopen Ticket" link if status is Resolved/Closed** ⭐

---

### **3. Priority Changes** ⭐ NEW
```
Admin/IT changes priority → API updates ticket → Refreshes dashboard
```

**Database Changes:**
- Update `Ticket` table
- `priority = newPriority`
- `resolved_by = adminName` (tracks who changed it)

**Email Triggers:** None (silent update)

---

### **4. Ticket Reopening** ⭐ NEW
```
User clicks "Reopen" link → Enters reason → API updates ticket
                                                    ↓
                                    Status: "Open"
                                    resolved_at: null
                                    reopened_at: now() ⭐ NEW FIELD
                                                    ↓
                        Reason appended to admin_remarks
                                                    ↓
                            Sends email to Team (reopened)
```

**Database Changes:**
- Update `Ticket` table
- `status = "Open"`
- `resolved_at = null`
- `reopened_at = now()` ⭐ **NEW FIELD**
- `admin_remarks += "[Reopened by User on DATE] Reason: ..."`

**Email Triggers:**
- `sendUpdateNotification(ticket)` → Team notified

**Timeline Logic:** ⭐ CRITICAL
- Duration calculation now uses `reopened_at || created` as start time
- If ticket was reopened, duration = `resolved_at - reopened_at`
- If ticket was never reopened, duration = `resolved_at - created`

---

### **5. Hardware Request Fulfillment**
```
Admin clicks "Resolve" on hardware ticket → Selects inventory item → Confirms
                                                                        ↓
                                            Ticket marked "Resolved"
                                            Inventory quantity -= 1
                                                                        ↓
                                                Sends email (resolved)
```

**Database Changes:**
- Update `Ticket`: `status = "Resolved"`, `resolved_at = now()`
- Update `Inventory`: `quantity -= 1`

**Email Triggers:**
- `sendUpdateNotification(ticket)` → User: "Resolved", Team: "Notify"

---

## 📧 EMAIL NOTIFICATION FLOW

### **Email Service Configuration**
- **Source:** `backend/src/lib/email.ts`
- **Settings:** Stored in `Settings` table (DB-first, fallback to ENV)
  - `smtp_service`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`
  - `smtp_from_name`, `smtp_from_address`
  - `app_url` (frontend URL)

### **Email Templates**
All emails use `generateCardHtml()` which creates Outlook-compatible HTML with:
- Gradient header with ticket ID
- Agent name and status badge
- **Details Grid:** ⭐ ENHANCED
  - Row 1: Requester, Submitted Date
  - Row 2: Hostname, IP Address
  - **Row 3 (if resolved):** Resolved Date, **Duration** ⭐ NEW
- Description box
- Attachment link (if present)
- Admin remarks section
- Primary CTA button
- **Secondary action link** (e.g., "Reopen Ticket" for resolved tickets) ⭐

### **Email Triggers**

| Event | Trigger Function | Recipients | Subject |
|-------|-----------------|------------|---------|
| New Ticket Created | `sendTicketNotification()` | User + Team | User: "[Received] Ticket: TKT-xxx"<br>Team: "[New Ticket] TKT-xxx - Dept" |
| Status Changed | `sendUpdateNotification()` | User + Team | User: "[Update] TKT-xxx: Status"<br>Team: "[Notify] TKT-xxx Updated by Agent" |
| Ticket Reopened | `sendUpdateNotification()` | Team | "[Notify] TKT-xxx Updated by Admin" |
| Inventory Updated | `sendStockUpdateNotification()` | Team | "[Inventory] Stock Updated by User, Office" |
| Low Stock Detected | `sendLowStockAlert()` | Team | "[Alert] Low Stock Warning - Office - Items" |
| Test Email | `sendTestEmail()` | Specified | "✅ Test Email - IT Support" |

### **Email Timeline Display** ⭐ NEW FEATURE
- **Location:** Details grid in email HTML
- **Condition:** Only shown if ticket status is "Resolved" or "Closed"
- **Data Displayed:**
  - **Resolved Date:** `new Date(ticket.resolved_at).toLocaleDateString()`
  - **Duration:** Calculated using `calculateDuration(startTime, ticket.resolved_at)` ⭐
    - `startTime = ticket.reopened_at || ticket.created` ⭐ CRITICAL
- **Visual:** Grid row with two columns (50% width each)

---

## 💾 DATABASE SCHEMA

### **Technology:** SQLite (Prisma ORM)
**Location:** `backend/prisma/schema.prisma`

---

### **1. User**
```prisma
model User {
  id       String   @id @default(uuid())
  email    String   @unique
  username String   @unique
  name     String?
  password String
  role     String   @default("IT Support")  // "Admin" | "IT Support"
  avatar   String?
  created  DateTime @default(now())
  updated  DateTime @updatedAt
}
```

**Purpose:** Admin and IT Support authentication

---

### **2. Ticket** ⭐ UPDATED
```prisma
model Ticket {
  id                String    @id @default(uuid())
  generated_id      String    @unique
  requester_email   String
  full_name         String
  computer_name     String?
  ip_address        String?
  department        String?
  priority          String    @default("Medium")  // "Low" | "Medium" | "High" | "Critical"
  office            String?
  type              String    @default("SUPPORT_ISSUE")  // "SUPPORT_ISSUE" | "HARDWARE_REQUEST"
  description       String
  request_item_type String?
  attachment_path   String?
  status            String    @default("Open")  // "Open" | "Pending" | "On Hold" | "Resolved" | "Closed"
  resolved_at       DateTime?
  resolved_by       String?
  responded_at      DateTime?
  reopened_at       DateTime?  ⭐ NEW FIELD (tracks when ticket was reopened)
  admin_remarks     String?
  created           DateTime  @default(now())
  updated           DateTime  @updatedAt
}
```

**Key Fields:**
- `generated_id`: Public-facing ID (e.g., TKT-20260109-ABCD)
- `resolved_by`: Admin/IT who last updated (used for priority changes too)
- `reopened_at`: ⭐ **NEW** - Reset point for duration calculation
- `admin_remarks`: Concatenated history of status changes and reopen reasons

---

### **3. Inventory**
```prisma
model Inventory {
  id              String   @id @default(uuid())
  item_name       String
  category        String
  office_location String
  quantity        Int      @default(0)
  min_threshold   Int      @default(5)
  created         DateTime @default(now())
  updated         DateTime @updatedAt
  lastModifiedBy  String?
  lastLowStockEmail DateTime?
}
```

**Purpose:** Track hardware stock levels

---

### **4. InventoryLog**
```prisma
model InventoryLog {
  id        String   @id @default(uuid())
  itemId    String
  itemName  String
  office    String
  change    Int
  type      String    // "ADD" | "REMOVE" | "ADJUST"
  reason    String?
  performedBy String?
  timestamp DateTime @default(now())
}
```

**Purpose:** Audit trail for inventory changes

---

### **5. Settings**
```prisma
model Settings {
  id    String @id @default(uuid())
  key   String @unique
  value String
}
```

**Common Keys:**
- `smtp_service`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`
- `smtp_from_name`, `smtp_from_address`
- `app_url`, `background_url`, `company_logo`
- `security_pin` (hashed)

---

### **6. Office**
```prisma
model Office {
  id      String   @id @default(uuid())
  name    String   @unique
  created DateTime @default(now())
}
```

---

### **7. Department**
```prisma
model Department {
  id      String   @id @default(uuid())
  name    String   @unique
  order   Int?
  created DateTime @default(now())
}
```

---

### **8. BackupLog**
```prisma
model BackupLog {
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  status    String   // 'SUCCESS' | 'FAILED'
  type      String   // 'LOCAL' | 'CLOUD' | 'HYBRID'
  details   String?
  path      String?
}
```

---

## 🔌 API ENDPOINTS

### **Public Routes** (No Auth)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/tickets/submit` | Create new ticket |
| GET | `/tickets/track/:generatedId` | Get ticket by ID |
| POST | `/tickets/track/:generatedId/reopen` | Reopen ticket ⭐ |
| GET | `/settings/public` | Get public settings (branding) |
| GET | `/offices` | Get office list |
| GET | `/departments` | Get department list |
| GET | `/inventory` | Get inventory (for hardware requests) |

### **Protected Routes** (Requires Auth)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/tickets` | Get all tickets |
| PUT | `/tickets/:id` | Update ticket (status, priority, remarks) ⭐ |
| DELETE | `/tickets/:id` | Delete ticket (PIN required) |
| GET | `/inventory` | Get inventory with details |
| PUT | `/inventory/:id` | Update inventory item |
| POST | `/inventory/bulk-update` | Bulk update inventory |
| POST | `/users` | Create user (Admin only) |
| GET | `/settings` | Get all settings |
| PUT | `/settings` | Update settings |
| POST | `/security/verify-pin` | Verify PIN |
| POST | `/email/test` | Send test email |

---

## 🔗 INTEGRATION POINTS

### **Critical File Dependencies**

#### **Frontend → Backend**
1. **`frontend/src/lib/api.ts`**
   - ✅ `updateTicket(id, data)` - Used for status, priority, remarks updates
   - ✅ `reopenTicket(generatedId, reason)` - Reopen endpoint ⭐
   - ✅ `getTickets()` - Fetches all tickets (includes `reopened_at` field) ⭐
   - ✅ `getInventory()` - Fetches inventory (includes `min_threshold`)

#### **Backend Internal**
1. **`backend/src/lib/email.ts`**
   - ✅ `calculateDuration(start, end)` - Helper function ⭐
   - ✅ `generateCardHtml()` - Email template generator
     - **Uses:** `ticket.reopened_at` for timeline ⭐
     - **Shows:** Duration if resolved ⭐
   - ✅ `sendUpdateNotification()` - Adds "Reopen" link if resolved

2. **`backend/src/routes/tickets.ts`**
   - ✅ `POST /track/:id/reopen` - Reopen logic ⭐
     - Sets `status = "Open"`
     - Sets `resolved_at = null`
     - Sets `reopened_at = new Date()` ⭐
     - Appends reason to `admin_remarks`
   - ✅ `PUT /:id` - Update ticket (used by priority/status changes)

#### **Frontend Components**
1. **`DashboardTickets.jsx`**
   - ✅ `calculateDuration(start, end, reopened)` - Client-side duration ⭐
     - **Uses:** `ticket.reopened_at` as start if available ⭐
   - ✅ `PrioritySelect` - Dropdown component ⭐
   - ✅ `StatusSelect` - Dropdown component
   - ✅ Item selection modal - Uses dynamic threshold colors ⭐

2. **`TicketSubmission.jsx`**
   - ✅ Hardware item modal - **Dynamic stock colors** ⭐
     - Red: qty ≤ 0
     - Orange: qty ≤ threshold
     - Green: qty > threshold

3. **`TicketTracker.jsx`**
   - ✅ Reopen modal - Triggered by `?reopen=true` query param ⭐
   - ✅ `handleReopen()` - Calls `api.reopenTicket()` ⭐

---

## ⚠️ CRITICAL DEPENDENCIES & BREAKING CHANGE RISKS

### **1. Ticket Duration Calculation** ⭐ VERY CRITICAL
**Files Affected:**
- `backend/src/lib/email.ts` (Line ~148)
- `frontend/src/pages/DashboardTickets.jsx` (Line ~167)

**Logic:**
```javascript
// Backend (Email)
const startTime = ticket.reopened_at || ticket.created;
const duration = isResolved ? this.calculateDuration(startTime, ticket.resolved_at) : '';

// Frontend (Dashboard)
const rangeStart = reopened || start;
const duration = calculateDuration(created, resolved, reopened_at);
```

**⚠️ DO NOT:**
- Remove `reopened_at` field from schema
- Change `calculateDuration` signature without updating all callers
- Modify email template grid without checking duration row visibility

---

### **2. Email Templates** ⭐ CRITICAL
**File:** `backend/src/lib/email.ts`

**⚠️ DO NOT:**
- Remove `generateCardHtml()` method signature parameters:
  - `ticket`, `titleSub`, `backendUrl`, `frontendUrl`, `actionUrl`, `actionText`
  - `secondaryActionUrl`, `secondaryActionText` (optional, for reopen link)
- Change `isResolved` logic (affects timeline row display)
- Modify grid structure without testing in Outlook

**Email Flow:**
```
sendTicketNotification() → generateCardHtml() → sendEmail()
sendUpdateNotification() → generateCardHtml() → sendEmail()
                                ↓
                    Checks if resolved → Adds "Reopen" link
                    Checks if resolved → Shows Duration row
```

---

### **3. Inventory Stock Colors** ⭐ CRITICAL
**Files Affected:**
- `frontend/src/pages/DashboardInventory.jsx` (Line ~610-632, Matrix view numbers)
- `frontend/src/pages/DashboardTickets.jsx` (Line ~818, Admin item modal badge)
- `frontend/src/pages/TicketSubmission.jsx` (Line ~362, Public item modal borders)

**Logic:** (7/5/1 Fixed Values)
```javascript
// All three locations use the same logic:
// 7+ : Green
if (qty >= 7) {
    colorClass = 'bg-green-... text-green-...';
}
// 5-6 : Purple
else if (qty >= 5) {
    colorClass = 'bg-purple-... text-purple-...';
}
// 1-4 : Orange
else if (qty >= 1) {
    colorClass = 'bg-orange-... text-orange-...';
}
// 0 : Red
else {
    colorClass = 'bg-red-... text-red-...';
}
```

**⚠️ DO NOT:**
- Change color logic in one file without updating ALL THREE files
- Modify the fixed thresholds (7, 5, 1) without user approval
- Change color classes without testing in all three views (Inventory Matrix, Admin Modal, Public Modal)

---

### **4. Priority Management** ⭐ NEW
**Files Affected:**
- `frontend/src/pages/DashboardTickets.jsx` (Line ~383-395, ~397-431)

**Logic:**
```javascript
const handlePriorityChange = async (ticketId, newPriority) => {
  await api.updateTicket(ticketId, {
    priority: newPriority,
    resolved_by: adminUser?.full_name || 'Admin'  // ⚠️ Tracks who changed it
  });
};
```

**⚠️ DO NOT:**
- Remove `resolved_by` tracking (used for audit trail)
- Change `PrioritySelect` options without updating backend validation
- Remove color styling mapping (Low=Gray, Medium=Blue, High=Yellow, Critical=Red)

---

### **5. Reopen Workflow** ⭐ CRITICAL
**Files Affected:**
- `backend/src/routes/tickets.ts` (Line ~43-66, POST /track/:id/reopen)
- `frontend/src/pages/TicketTracker.jsx` (Line ~39-60, Reopen modal)
- `backend/src/lib/email.ts` (Line ~319-321, Secondary action link)

**Flow:**
```
Email "Reopen" link (?reopen=true) 
    → TicketTracker detects query param
    → Opens reopen modal
    → User enters reason
    → api.reopenTicket(generatedId, reason)
    → Backend updates: status="Open", resolved_at=null, reopened_at=now()
    → Email notification sent to team
```

**⚠️ DO NOT:**
- Remove `reopened_at` field (breaks duration tracking)
- Change `/track/:id/reopen` endpoint path (breaks email links)
- Remove `?reopen=true` query param detection (breaks email UX)
- Remove `resolved_at = null` (breaks status logic)

---

## 🧪 TESTING CHECKLIST (Before Deployment)

### **Priority System**
- [ ] Admin can change priority via dropdown
- [ ] IT Support can change priority
- [ ] `resolved_by` is updated correctly
- [ ] Priority colors display correctly (Red, Yellow, Blue, Gray)

### **Email Timeline**
- [ ] Resolved tickets show "Duration" in email
- [ ] Duration calculation uses `reopened_at` if available
- [ ] Email displays correctly in Gmail, Outlook, Yahoo
- [ ] "Reopen Ticket" link appears for resolved tickets

### **Stock Colors**
- [ ] Admin item modal: Red badge for low stock, Green for sufficient
- [ ] Public item modal: Red border (out), Orange border (low), Green border (good)
- [ ] Threshold logic matches between Admin and Public views

### **Reopen Workflow**
- [ ] Email "Reopen" link opens tracker with modal
- [ ] Reason is required and saved to `admin_remarks`
- [ ] `reopened_at` is set correctly
- [ ] Duration resets after reopen
- [ ] Team receives notification email

### **Database Integrity**
- [ ] `reopened_at` field exists in Ticket table
- [ ] Prisma migrations applied (`npx prisma db push`)
- [ ] No orphaned records

---

## 📝 CHANGE LOG

### **2026-01-09 - Latest Changes**
1. ✅ Added `reopened_at` field to Ticket schema
2. ✅ Implemented email timeline with duration display
3. ✅ Added priority dropdown in dashboard
4. ✅ Fixed stock color logic (dynamic thresholds)
5. ✅ Implemented reopen timeline reset logic

### **Previous Features**
- Ticket reopen feature
- PIN-protected deletion
- Matrix inventory view
- Firewall and rate limiting
- Dynamic branding
- Backup system

---

## 🚨 IMPORTANT NOTES FOR FUTURE EDITS

### **Before Making Any Changes:**
1. ✅ Check this document for affected workflows
2. ✅ Search for usages of fields you're modifying (e.g., `reopened_at`)
3. ✅ Test email notifications after backend changes
4. ✅ Verify both Admin and Public views after frontend changes
5. ✅ Run `npx prisma db push` after schema changes
6. ✅ Update this document with new features

### **Common Breaking Changes to Avoid:**
- ❌ Removing database fields without migration
- ❌ Changing API endpoint paths without updating frontend
- ❌ Modifying email template structure without testing
- ❌ Changing `calculateDuration` signature
- ❌ Removing `resolved_by` tracking
- ❌ Altering threshold logic in one place but not the other

---

**END OF DOCUMENT**
