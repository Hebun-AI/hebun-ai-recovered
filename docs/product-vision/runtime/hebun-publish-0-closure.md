# PUBLISH-0 — One Approved Image to Instagram Through the Governed Act · Closure

Until PUBLISH-0, Hebun could prepare, generate, review and compose content, and TENANT-ARM-1 could
make one organization reachable for external send — but nothing Hebun prepared had ever left the
system through a governed act. PUBLISH-0 added one executable action, `publish-instagram-media`, and
took it through the existing proposal → Governance → permit → execution chain against the real
provider.

**Release commits:** `f2005e84` (PUBLISH-0), `72d28682` + `3db976a6` (MEDIA-SUPPLIED, the supplied
original used in acceptance). **Production deployment:** commit
`3db976a631d19f41aae95aecf03df69660459151`, deployment `dpl_JCCAaKrchZHv2spus57AzhN5tJu7`, Ready.
**Production migration ledger: 63.** PUBLISH-0's own migrations:
`20260924133417_publish0_recipientless_attempts` (61) and `20260924173451_publish0_derived_media` (62);
63 is MEDIA-SUPPLIED's.

---

## 1 · Final status

```
IMPLEMENTED                          YES   f2005e84
DEPLOYED                             YES   3db976a6 / dpl_JCCAaKrchZHv2spus57AzhN5tJu7
MIGRATED (production)                YES   ledger 63
/publish PROPOSAL GATE               PASS  37/37
FINAL EXECUTION ACCEPTANCE           PASS  53/53 (includes Instagram provider read)
REAL PROVIDER PUBLISH                YES   accepted, media id 18091512017663172
PROVIDER READ-BACK                   YES   same id, IMAGE, caption exact
DIRECTOR LIVE VERIFICATION           YES   post seen on the profile
TRH EXTERNAL-SEND AFTER CLOSURE      REFUSED (tenant-arming-withdrawn)
```

**PUBLISH-0 PRODUCTION ACCEPTED / CLOSED.**

---

## 2 · Architecture and authority boundaries

```
prepare / admit media  ->  /publish proposal  ->  human Governance approval
   ->  single-use permit (<= 5 min)  ->  Execute now  ->  provider result
```

- **Proposal** — `/publish work-artifact/<uuid>@<revision> <asset-uuid>`, wired through the existing
  Heby propose dispatcher. It creates the deterministic publish derivative and exactly one pending
  Governance request. **It does not authorize, execute, arm or call Instagram.**
- **Governance** — the human-only decision CHECK is unchanged. Approval mints one digest-bound,
  short-lived permit.
- **Execution** — `executeAuthorizedAction` re-reads reachability, validates the permit (tenant,
  active, unconsumed, unrevoked, unexpired), consumes it, re-verifies Media lineage and stored bytes,
  mints a read grant for the **derivative only**, and dispatches one `instagram-graph-publish-v1`
  attempt. Attempts are recipient-less on the existing attempt ledger (migration 61).
- **No new authorization authority.** The provider is a transport, never an authorizer.

## 3 · Provider capability requirements

Publishing is POSSIBLE only when all hold for the connection (`publish-capability.ts`):
Hebun declares the capability; the connection is bound to its own account at `/me`; granted scopes
include `instagram_business_basic` **and** `instagram_business_content_publish`. The consent flow
requests `content_publish`, and it is recorded only when Meta states it was granted.

```
definition != connection != credential != capability != available
           != authorized != executed != successful
```

## 4 · Media original / derivative binding

- `media_assets` gained deterministic `derived` assets: `generated XOR derived XOR supplied`,
  same-tenant lineage, one derivative per source, JPEG only (migration 62).
- `jpeg-publish-v1` (sharp, pinned `0.34.5`) runs inside the Media authority. Derivation grants no
  authority; derivatives stay out of gallery, composer and review.
- The proposal binds original **and** derivative digests; execution re-verifies both before send.

```
original    b4a8491e-8011-8d29-8697-7dc942281d87   supplied (MEDIA-SUPPLIED)
derivative  78bff036-3ed7-8456-bef0-3a5c2b122b06   jpeg-publish-v1  <- the bytes sent
```

## 5 · Tenant arming and root reachability

```
effective external-send reachability = tenant arming active AND root control enabled
```

Unchanged from TENANT-ARM-1. The deployment-level `external-send` root stays enabled; an
organization is reachable only while its own arming revision is active. Arming is a separate,
organization-level Governance decision; **each publish still needs its own approval and permit.**

## 6 · Outcome semantics

| Transport class | Attempt status | Meaning |
|---|---|---|
| `accepted` | `accepted` | Meta returned a **media id**. Only a media id is success; a container id is not a post |
| `rejected` | `failed` (`provider-rejected`) | Meta answered and refused (validation, container error, not ready) |
| `unreachable` | `failed` (`provider-unreachable`) | No answer before anything was published |
| `ambiguous` | `unknown` | Publish answer lost, non-2xx after publish call, or id absent — **may or may not be live** |

`accepted` does **not** mean anyone saw the post, that it stays up, or that it performed.

## 7 · Real-provider acceptance evidence

```
publish request     160d4361-8584-4d8d-8efa-129068a1b36d
integration         7289bc08-caf9-4788-a7ac-692898ea3b20
Instagram account   28295264780115792
draft               work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3
approval            human Director
permit              one, <= 5 min, consumed strictly after issue, non-reusable
attempt             one instagram-graph-publish-v1, accepted
provider_message_id 18091512017663172
permalink           https://www.instagram.com/p/DdtOBObjs0m/   (observed read-only)
```

Exactly one publish request, one permit, one execution attempt. **No retry, no duplicate publish.**

**Provider read-back** (read-only Instagram seam): same media id, `IMAGE` type, caption exactly
matching revision 3. **Director manual verification:** the post was seen live on the profile.

Ceremony side effects matched expectation:

```
action_permits              4 -> 5
action_execution_attempts   0 -> 1
decisions                  20 -> 23
requests                    7 -> 7   (during execution ceremony)
media                       2 -> 2
other tenants               unchanged
```

## 8 · Arming window and final state

TRH external-send was armed **only for the acceptance window**, then disarmed:

```
rev 3  active     arm for acceptance
rev 4  withdrawn  disarm after acceptance
effective TRH reachability   REFUSED  tenant-arming-withdrawn
root external-send           enabled (deployment-level)
machine-internal-execution   disabled
```

No machine-execution or standing-mutation authorization was introduced.

This also closes the narrow item TENANT-ARM-1 left deferred ("a permitted send, under an armed
tenant, reaches a real destination") for the Instagram publish action. TENANT-ARM-1's own closure
record is historical and is not rewritten.

## 9 · Normal workflow vs this acceptance ceremony

The extensive probes (37/37, 53/53), offline derivative comparison and evidence collection were
**first-production-acceptance work, not the per-post workflow.** The normal governed workflow is:

```
prepare/admit media -> /publish proposal -> human approval -> single-use permit -> Execute now -> provider result
```

The one-post arm/disarm window was an acceptance choice. The current architecture permits an
organization to remain armed until it withdraws; each publish still requires its own approval and
permit. Arming is not redesigned here.

## 10 · Known non-blocking product debt

Recorded as limitations; none reopens acceptance.

1. The approval card does not yet show the actual caption / image preview.
2. Execution records provider acceptance and media id but does not automatically perform
   post-publish read-back verification.
3. Tenant external-send arming requires a terminal ceremony and has no TTL; it stays active until
   explicitly withdrawn.
4. Instagram container polling is bounded (default 5 polls) and there is no retry after permit spend.
5. `jpeg-publish-v1` may increase JPEG size; the accepted asset stayed within provider limits.
6. Safari Google Picker failed during acceptance; Chrome succeeded. Not generalized into a proven
   Safari incompatibility.
7. Migration-count test pins are stale and account for the known baseline failures; not repaired in
   the documentation closure.
8. `sharp` is traced into most dashboard functions (bundle-size trade-off, `learnings.md`).

**PUBLISH-0 PRODUCTION ACCEPTED / CLOSED.**
