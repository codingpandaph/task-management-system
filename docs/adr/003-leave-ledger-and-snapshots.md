# ADR 003: Immutable annual entitlements, ledger, and approval snapshots

Status: Accepted

Annual assignments point to immutable policy versions. A leave account balance is derived only from append-oriented
integer ledger entries. Requests snapshot chargeable dates and concrete ordered approvers at submission.

Historical balances therefore do not change when policies, holidays, or managers change. Reservations prevent pending
requests from overspending, and unique posting keys make retries idempotent. A changed approver can block a snapshot
until cancellation or authorized correction; automatic reassignment is deferred. PostgreSQL row locks and bounded
retries coordinate balance and overlap checks.
