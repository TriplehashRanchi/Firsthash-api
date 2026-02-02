# Task Bundles Frontend Implementation Guide

This document explains the new **Task Bundles** feature and how frontend should implement it.

## Feature Summary

- Each company/admin can create reusable **Task Bundles**.
- A bundle contains multiple **bundle items** (template tasks), including optional nested items via `parent_item_id`.
- From any deliverable, user can import a bundle.
- Import creates normal rows in `tasks` table, so existing task UI/actions continue to work.

---

## Auth + Access

- All endpoints require Firebase auth header:
  - `Authorization: Bearer <token>`
- Backend enforces company scope from middleware (`req.company.id`).
- Frontend should not send `company_id` for this module.

---

## API Endpoints

Base: `/api/task-bundles`

### Bundles

- `GET /api/task-bundles`
  - List all bundles for current company.

- `POST /api/task-bundles`
  - Create a bundle.
  - Body:
    ```json
    {
      "name": "Pre Wedding Shoot",
      "description": "Default checklist for pre-wedding",
      "is_active": true
    }
    ```

- `PUT /api/task-bundles/:id`
  - Update bundle metadata.
  - Body (any subset):
    ```json
    {
      "name": "Pre Wedding Updated",
      "description": "Edited text",
      "is_active": false
    }
    ```

- `DELETE /api/task-bundles/:id`
  - Delete bundle.

### Bundle Items

- `GET /api/task-bundles/:id/items`
  - Get all items for a bundle.

- `POST /api/task-bundles/:id/items`
  - Create bundle item.
  - Body:
    ```json
    {
      "title": "Moodboard finalization",
      "description": "Confirm references with client",
      "priority": "medium",
      "due_in_days": 1,
      "sort_order": 1,
      "parent_item_id": null
    }
    ```

- `PUT /api/task-bundles/:id/items/:itemId`
  - Update bundle item.
  - Body (any subset of item fields):
    ```json
    {
      "title": "Moodboard lock",
      "priority": "high",
      "due_in_days": 2,
      "sort_order": 2
    }
    ```

- `DELETE /api/task-bundles/:id/items/:itemId`
  - Delete an item (and its child items if DB FK cascade is enabled).

### Import into Deliverable

- `POST /api/deliverables/:deliverableId/import-task-bundle`
  - Import bundle items as normal tasks under a deliverable.
  - Body:
    ```json
    {
      "bundle_id": 3,
      "due_base_date": "2026-02-14",
      "skip_duplicates": true
    }
    ```
  - Success response:
    ```json
    {
      "success": true,
      "message": "Bundle imported successfully.",
      "created_count": 8,
      "skipped_count": 1
    }
    ```

---

## Data Contracts (Suggested TS Types)

```ts
export type TaskBundle = {
  id: number;
  company_id: string;
  name: string;
  description: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
  items_count?: number;
};

export type TaskBundleItem = {
  id: number;
  bundle_id: number;
  parent_item_id: number | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  due_in_days: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
```

---

## Frontend Screens to Build

## 1) Task Bundles Management Page

Suggested route: `/settings/task-bundles`

UI elements:
- Bundle list/cards/table:
  - `name`, `description`, `items_count`, `is_active`
- Actions:
  - Create
  - Edit
  - Activate/Deactivate
  - Delete
  - Manage Items

APIs used:
- `GET /api/task-bundles`
- `POST /api/task-bundles`
- `PUT /api/task-bundles/:id`
- `DELETE /api/task-bundles/:id`

## 2) Bundle Items Editor (modal/page/drawer)

UI elements:
- Item list sorted by `sort_order`
- Add root task item
- Add sub-item (set `parent_item_id`)
- Edit item fields
- Delete item

APIs used:
- `GET /api/task-bundles/:id/items`
- `POST /api/task-bundles/:id/items`
- `PUT /api/task-bundles/:id/items/:itemId`
- `DELETE /api/task-bundles/:id/items/:itemId`

## 3) Import Bundle in Deliverable Task Area

In deliverable task UI, add button:
- `Import Bundle`

Import modal fields:
- Bundle selector (active bundles first)
- Due base date (optional)
- Skip duplicate task titles toggle (default true)

API used:
- `POST /api/deliverables/:deliverableId/import-task-bundle`

After success:
- Close modal
- Refresh deliverable tasks list
- Show toast using `created_count` and `skipped_count`

---

## UX Flow (Recommended)

1. Admin opens Task Bundles page and creates bundle.
2. Admin adds bundle items (and optional sub-items).
3. In project deliverable, admin clicks `Import Bundle`.
4. Selects bundle + optional date + imports.
5. Existing task list refreshes; imported tasks appear as normal tasks.

---

## Validation Rules (Frontend)

- Bundle `name` is required.
- Item `title` is required.
- `priority` must be one of: `low`, `medium`, `high`.
- `due_in_days` should be integer or empty.
- Do not allow item to be parent of itself.
- For import, `bundle_id` is required.

---

## Error Handling

- `400`: validation issues (show inline/form error).
- `404`: bundle or deliverable not found/inactive (show action toast).
- `500`: generic server error (show retry toast).

Always show clear action-oriented messages:
- "Could not import bundle. Please try again."
- "This bundle no longer exists."

---

## Integration Checklist

- [ ] Add API service methods for all routes above
- [ ] Add Task Bundles settings page
- [ ] Add Bundle Items editor UI
- [ ] Add Import Bundle modal inside deliverable task section
- [ ] Refresh tasks after import
- [ ] Add loading + error + success states
- [ ] Add optimistic/fast UI updates where safe

---

## Notes for Frontend Agent

- Imported tasks are standard tasks; no special rendering required.
- Keep existing "Add Task manually" flow unchanged.
- This feature is additive: manual + bundle import both should coexist.
