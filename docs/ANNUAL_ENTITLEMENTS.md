# Annual entitlements (grants) and split requests

This app models **annual leave** as one or more **entitlement grants** per project member (`annual_entitlement_grants`). Each grant has:

- **`grant_year`**: which accrual year the pool belongs to (nullable on legacy rows).
- **`days_allocated`**: how many working days that pool may fund.
- **`valid_from` / `valid_to`**: the window in which the **start date** of a request may draw from that pool (inclusive date strings, `YYYY-MM-DD`).
- **`source`**: `legacy_migration` (pre-feature backfill), `grant` (opened by the year-reset job), or `carryover` (reserved for future use).

When a member requests annual leave, the API stores **`leave_request_grant_allocations`**: rows `(leave_request_id, grant_id, working_days)` so consumption is tracked **per fund**. Pending and approved allocations both reserve balance.

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

## Migrations

Apply `supabase/migrations/012_annual_entitlement_grants.sql` so tables and project columns exist before deploying app code that references them.
