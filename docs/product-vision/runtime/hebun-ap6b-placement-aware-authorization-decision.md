# AP-6b — Placement-Aware Authorization — Decision Record

Roadmap position: §20.4, the department-scoped workforce step opened as the AP-6 architecture review
(2026-10-18). AP-6a (the Engineering Agent's placement) is PRODUCTION-ACCEPTED in its own record,
`hebun-ap6a-engineering-agent-placement-closure.md`; this record does not restate or change it.

**Status: DEFERRED — IMPLEMENTATION NOT JUSTIFIED (Director, 2026-10-18).** AP-6b is NOT IMPLEMENTED.
No placement-aware authorization is authorized. This is a decision record, not a closure: AP-6b has
not been done, so it is not closed.

Evidence below was read at `87274f2c` (production, `dpl_EJgAdNHV15kAE5YvbvXHTe3Z1LBT`) from git objects,
read-only. Production counts are those the AP-5 and AP-6a records measured on 2026-10-17/18; they were
not re-measured for this decision.

## Decision

1. **Placement grants no authority.** Unchanged. `agents.department_id` is read only by the
   Organization Authority's placement reader and writer and by display paths; AP-2 rule 6 enforces
   it (`tests/ap2-agent-placement/firewall.ts`, hardened by AP2-RULE6-RAW-SQL-1).
2. **Existing mandates and responsibilities remain authoritative.** What an agent may propose is its
   mandate's `proposal_scope`; what work it is responsible for is its mandate's responsibility rows
   (AP-4A/B). Both are checked when a proposal is filed and again inside the permit spend
   (`consume-action-permit.server.ts` `spendPermit`), which every execution path — human Execute,
   governed internal acts and the machine executor — goes through. The standing issuer checks them
   inside its own transaction before it issues.
3. **No approved policy requires an agent to operate only in its placement department.**
4. **Current controls do NOT guarantee department isolation in a multi-department tenant.** An agent
   responsible for a work domain may record that domain's work in any active department of its tenant;
   nothing ties the work's department to the agent's placement, and nothing was designed to. In
   production today the Hebun AI tenant has one department, so the case cannot arise there — that is a
   fact about current data, not a guarantee of the system.
5. **No new authorization subsystem is justified.**

## Future reconsideration

Reopen only when a concrete department-scoped policy or a demonstrated enterprise requirement exists
(for example: a tenant with two or more active departments, and a written Director rule that an agent
works only in its own). Before proposing any enforcement, evaluate whether existing mandate authority
can express the rule.

- **Option B** (a department bound expressed in the mandate) is **not pre-approved**.
- **Option C** (placement read as a restriction at the enforcement points) is **not pre-approved**.
  Either would need its own Director decision, a V3 phase and, for C, a replacement for AP-2 rule 6.

## Concurrency semantics of mandate revision and permit spend (G3)

Recorded as they are; nothing here changes isolation, locking or the permit lifecycle.

| Moment | What happens | Owner |
|---|---|---|
| Permit authorization | A Governance human approves; a permit is issued bound to the request's payload digest. The mandate is checked when the proposal is filed, not re-derived at approval | Action Authorization, Governance |
| Mandate revision commit | One transaction: agent and effective revision read unlocked, compared with the revision the human was shown (`stale-mandate-revision`), new revision and its responsibility rows inserted; the unique index `(tenant_id, agent_id, mandate_revision)` separates simultaneous writers | Agent Mandate Authority (`establish-agent-mandate.server.ts`) |
| Permit consumption | One transaction: a single UPDATE spends the permit (tenant, `active`, `expires_at > now()` on the database clock); payload re-hashed against both digests; agent row read `FOR SHARE`; mandate read unlocked; mandate ceiling and responsibility checked; internal acts write inside the same transaction (`onAuthorizedWithin`). A refusal rolls the spend back — the permit stays `active`, it is not revoked | Action Authorization (`spendPermit`) |
| External execution | For an external act (send) the provider call happens after the spend commits; the execution attempt row is written inside the spend | Action Execution (R3B) |
| Execution success | Recorded by the execution attempt; consumed ≠ succeeded, and a failed act does not return the permit | Action Execution |

- Isolation, three separate facts:
  - **Application configuration (verified in code):** no transaction in the repository sets an
    isolation level, so each runs at the session's `default_transaction_isolation`.
  - **PostgreSQL semantics:** the built-in default is READ COMMITTED, under which each statement sees
    the data committed before that statement began — visibility is per statement, not per
    transaction.
  - **Production configuration: UNKNOWN.** Production's `default_transaction_isolation` (server,
    database or role setting) was not measured. Everything below assumes READ COMMITTED until it is.
- Suspension and retirement take the agent row `FOR UPDATE`, so they serialize with a spend.
- A mandate revision is **not** serialized with a spend. Which revision a spend observes is decided by
  when its mandate read *statement* starts: a revision committed before that statement starts is
  read, whenever the spend's transaction began; one that commits after it is not seen, and that spend
  proceeds under the previous revision (the L-2b residual). A spend is refused only if the revision it
  observed no longer admits the requested act.
- By analysis of the two transactions' read and write sets — the revision writer reads nothing the
  spend writes — a spend that did not observe the revision has an outcome equivalent to the spend
  having happened just before the revision.
  This is an analytic conclusion, not an experimentally verified concurrency result.
- A mandate revision is **not immediate revocation**: it does not revoke issued permits, it does not
  interrupt an external call already in flight, and it does not undo an act. Permit consumption is not
  execution success.
- Classification: expected behavior. No exploit was identified.

## Related maintenance

AP2-RULE6-RAW-SQL-1 (`hebun-ap2-rule6-raw-sql-hardening-closure.md`): rule 6 now also covers raw-SQL
use of `department_id` and whole-row `agents` reads; the machine executor's stale residual-window
comment was corrected. Neither changes runtime behavior.

## Deferred risks

None created. Existing risks are unchanged: AP6A-WITHDRAW-UNEXERCISED-1 (DEFERRED),
AP6A-APPROVALS-LABEL-LIVE-AGENT-1 (DEFERRED).

## Three questions

1. **What did we learn?** The useful question was not how to make placement restrict but whether
   anything needs restricting: every act is already bounded by mandate, responsibility, department
   validity and liveness at proposal and at spend, and the one thing those do not bound — which
   department an agent's work lands in — no policy asks for yet.
2. **How does this improve Turkish Rug House?** It does not change it: TRH has no department and one
   agent. It avoids a second authority TRH would have to reason about.
3. **How does this become part of Hebun AI?** Hebun AI keeps one authorization model. When a tenant
   needs department isolation, the decision starts from the mandate, with a written policy and its
   own gate.
