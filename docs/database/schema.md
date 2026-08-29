# Database schema

DataChat reads a telecom-style CRM in Supabase Postgres. All access goes through the server secret key.

## Entity relationship

```mermaid
erDiagram
  customers ||--o{ subscriptions : has
  customers ||--o{ invoices : has
  customers ||--o{ payment_methods : has
  customers ||--o{ equipment : has
  customers ||--o{ incidents : has
  customers ||--o{ interaction_logs : has
  customers {
    uuid id PK
    varchar first_name
    varchar last_name
    varchar email UK
    varchar phone_number
    text address
    timestamptz created_at
  }
  subscriptions {
    uuid id PK
    uuid customer_id FK
    varchar service_category
    varchar plan_name
    varchar status
    numeric monthly_price
    date activation_date
  }
  invoices {
    uuid id PK
    uuid customer_id FK
    varchar billing_period
    numeric amount_due
    date issue_date
    date due_date
    varchar status
  }
```

## Tables

| Table | Purpose |
| --- | --- |
| `customers` | Identity (name, email, phone, address) |
| `subscriptions` | Service plans and status |
| `invoices` | Billing periods, amounts, paid/unpaid |
| `payment_methods` | Card / payment provider metadata |
| `equipment` | Devices, models, serials, warranty |
| `incidents` | Support issues and resolution |
| `interaction_logs` | Agent notes by channel |

All child tables are keyed by `customer_id` → `customers.id`.

## Row Level Security

RLS is **enabled** on every public table. With **no policies**, the browser/anon key cannot read anything.

The app uses `SUPABASE_SECRET_KEY` on the server only, which **bypasses RLS**. That is intentional: the chat tools need full read access, and the secret never ships to the client.

## Demo data

Typical sample customers:

- Eleanor Shellstrop
- Chidi Anagonye
- Tahani Al-Jamil

Madam Peterson is **not** present — useful for testing the no-match path.
