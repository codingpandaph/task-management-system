# ADR 001: Employee identity and revocable sessions

Status: Accepted

Employees are the identity record. The login name is a separate immutable business employee ID allocated with a native
PostgreSQL sequence. Access JWTs are short-lived references to an authoritative server session. Refresh credentials are
random opaque values stored as digests, rotated atomically, and retained after consumption until session expiry for
replay detection.

This lets suspension, termination, contract expiry, and password reset take effect on the next protected request rather
than waiting for a JWT to expire. It also avoids a duplicate generic User model and avoids placing mutable permissions
or personal data in tokens. The cost is a database check on protected requests and occasional reauthentication after an
exceptional concurrent refresh.
