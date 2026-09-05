# ADR 002: Separate positions from capabilities

Status: Accepted

Senior Director, Account Director, and Member model the fixed organization hierarchy. Stable permission codes model
application capabilities. Guards use current database grants and resource policies add department, ownership, and
workflow scope.

This prevents an editable role builder from blurring reporting lines with application privilege. Senior Director keeps
explicit governance authority, while confidential HR access still requires a grant. HR delegation uses a fixed safe
allowlist, requires the delegator to hold the capability, and prohibits self-escalation. The tradeoff is more explicit
endpoint policy code, which is preferable because the boundaries are visible and testable.
