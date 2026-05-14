# Annual entitlements (grants) and split requests

This app models **annual leave** as one or more **entitlement grants** per project member (`annual_entitlement_grants`). Each grant has:

- **`grant_year`**: which accrual year the pool belongs to (nullable on legacy rows).
- **`days_allocated`**: how many working days that pool may fund.
- **`valid_from` / `valid_to`**: the window in which the **start date** of a request may draw from that pool (inclusive date strings, `YYYY-MM-DD`).
- **`source`**: `legacy_migration` (pre-feature backfill), `grant` (opened by the year-reset job), or `carryover` (reserved for future use).
- **`definition_id`** (optional): links a grant to a **`project_annual_fund_definitions`** row so label and validity can be maintained project-wide.

When a member requests annual leave, the API stores **`leave_request_grant_allocations`**: rows `(leave_request_id, grant_id, working_days)` so consumption is tracked **per fund**. Pending and approved allocations both reserve balance.

## Project-wide fund definitions

Table **`project_annual_fund_definitions`** holds reusable templates (label, optional grant year, `valid_from` / `valid_to`, sort order). Project admins manage them under **Project settings** (API: `GET/POST /api/projects/[slug]/annual-fund-definitions`, `PATCH/DELETE …/[definitionId]`). Updating a definition propagates label and dates to every **`annual_entitlement_grants`** row that still references it.

On **Manage members**, each member’s **legacy** annual pool is assigned with a **dropdown** (`annual_fund_definition_id` on `PATCH …/members/[memberId]`). That copies the definition’s metadata onto the legacy grant and sets `definition_id`. **Allocated** days on the legacy grant stay driven by the member’s annual totals on the same page; the definition does not override the day count.

## Project policy fields

On **`projects`**:

| Field | Meaning |
|-------|--------|
| **`annual_accrual_month` / `annual_accrual_day`** | Calendar date when each year’s **new** grant opens. Defaults `1` / `1` (1 January). The year-reset job uses this to set each new grant’s `valid_from` and to cap overlapping legacy grants. |
| **`annual_first_use_by_month` / `annual_first_use_by_day`** | Optional. If both set, each new yearly grant gets `valid_to` on that **month/day in the following calendar year** (example: accrual 2026-01-01 with use-by 7 / 1 → fund expires 2027-07-01). If either is null, new grants get **no** automatic `valid_to`. |
| **`year_reset_month` / `year_reset_day`** | When the **carry-over / balance reset** job runs (`runYearResetJobs`): clears `annual_leave_used`, applies carry-over rules on `project_members`, and opens the new yearly grant as above. |

## Year reset job

`runYearResetForProject` (see `src/lib/carry-over/process.ts`) still updates **`project_members`**. After that, `openAnnualGrantAfterYearReset` (`src/lib/leave/grant-year-reset.ts`):

1. Inserts a **`grant`** row for `resetYear` if missing, with `days_allocated = annual_leave_total + carriedOver` (post-policy amounts).
2. Caps **`legacy_migration`** grants so `valid_to` is the day **before** the new accrual date (stops legacy overlap with the new fund).
3. Caps prior-year **`grant`** rows that still have `valid_to IS NULL`.

## Requests and validation

- If a member has **no** entitlement rows, validation falls back to the original scalar balance on `project_members` / global balance.
- If any grants exist, annual requests **must** have allocations. When **multiple** grants are valid on the **start date**, the client must send **`annualAllocations`** (see `POST /api/leave-requests` and the leave request form).
- Triggers on `leave_requests` continue to maintain **`annual_leave_used`** on members; that aggregate should match approved annual working days and is consistent with the sum of allocations on approved requests.

## Where this appears in the app

- **Project overview** (main project page): shows the **next** calendar occurrence of the configured year-reset and accrual month/day, with a day countdown.
- **Project settings** (admins): an **Upcoming** panel recalculates as you edit month/day fields; **Annual fund definitions** to create/edit project-wide funds; and a **Team annual funds** table with **Edit** per row (`PATCH /api/projects/[slug]/annual-grants/[grantId]`) to attach a definition and set **allocated working days** (cannot go below pending+approved allocations). Legacy rows: changing days updates **`project_members.annual_leave_total`** so the pool matches **Manage members** (trigger keeps `days_allocated` in sync).
- **Manage members**: role, **annual fund** (legacy link to a definition), and leave totals. Saving applies the selected definition to the member’s legacy grant when changed.

These UI elements follow the same calendar rules as this document. The automated year-reset **job** still runs only on the configured reset date (`year_reset_month` / `year_reset_day`).

## Migrations

Apply migrations in order, including:

- `supabase/migrations/012_annual_entitlement_grants.sql` — grants and project columns.
- `supabase/migrations/013_project_annual_fund_definitions.sql` — definitions table and `definition_id` on grants.

Deploy app code that references definitions only after **013** is applied.
