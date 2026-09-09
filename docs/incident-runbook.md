# Prototype incident runbook

Use this small runbook to demonstrate operational thinking. It assumes a single prototype deployment.

1. **Detect and record.** Capture the time, affected route, request ID, user-visible symptom, deployment revision, and
   readiness result. Never copy passwords, cookies, tokens, sick-leave reasons, or request bodies into the incident log.
2. **Contain.** Disable public access or stop the affected service. For suspected account compromise, suspend the
   employee or reset the password so sessions revoke immediately. Preserve database and application logs.
3. **Assess.** Check `/health` for process health and `/health/ready` for database reachability. Correlate structured
   logs by request ID. Determine affected identities, departments, records, and time window.
4. **Recover.** Roll back to the last verified image or configuration. For data loss, restore the latest validated
   backup into a separate database first, run integrity queries, then make a documented recovery decision.
5. **Verify.** Run health checks, a login/RBAC smoke test, and the affected browser journey. Monitor errors before
   reopening access.
6. **Learn.** Write cause, impact, timeline, evidence, corrective action, owner, and due date. Escalate any suspected
   personal-data breach to the employer's responsible privacy lead for their legal assessment.

Prototype targets for rehearsal are an **RPO of 24 hours** and an **RTO of 4 hours**. These are demonstration
assumptions, not agreed business commitments.
