# Prototype security review

This review defines the security evidence supplied with the CPSync job-application prototype. It is an engineering
review, not an independent penetration test or compliance certification.

| Asset                | Main threat                          | Implemented control                                                                                                      | Verification                                    |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Employee credentials | Theft, enumeration, replay           | bcrypt, generic login failures, short access token, rotating opaque refresh secret, replay revocation, HTTP-only cookies | Auth unit, integration and browser tests        |
| HR and leave records | Unauthorized viewing or mutation     | Current database permissions, role and resource policies, restricted projections, route proxy, CSRF and Origin checks    | Role-matrix, privacy and direct-API tests       |
| Leave balances       | Duplicate or concurrent posting      | Immutable ledger, unique operation keys, row locks and serializable retries                                              | PostgreSQL integration concurrency tests        |
| Tasks and reports    | Cross-department access              | Department workspace boundaries and Senior Director scope checks on every API path                                       | Multi-role API and Playwright journeys          |
| Logs and errors      | Credential or health-data disclosure | Identifier-only request and trace correlation, allowlisted audit metadata, safe errors, explicit redaction               | Logging unit test and privacy integration tests |
| Database             | Loss or corrupt recovery             | Guarded custom-format backup and restore into a disposable verification database                                         | `yarn db:backup` and `yarn db:restore:verify`   |
| Supply chain         | Vulnerable or malicious dependency   | Immutable Yarn install, lockfile, high-severity dependency audit and local secret scan                                   | `yarn security:check`                           |

Trust boundaries are the browser, same-origin Next.js proxy, Nest API, and PostgreSQL. Browser input is always
untrusted. Next.js improves route privacy, while Nest remains the authorization authority. PostgreSQL constraints are
the final guard for uniqueness and invariant enforcement.

Residual prototype risks include single-process throttling and scheduling, locally managed secrets, external
attachment links, and the absence of an independent security assessor. MFA and SSO remain deferred by scope.
