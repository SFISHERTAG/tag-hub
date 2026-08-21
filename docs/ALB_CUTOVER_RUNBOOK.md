# Runbook — global external ALB in front of Cloud Run

Moving `hub.taxadvisorygrowth.com` from its Cloud Run **domain mapping** to a **global external
Application Load Balancer** with a serverless NEG.

> **You probably should not run this.** The domain mapping works today. This exists because
> domain mappings are documented as Preview and "not production-ready", which is a reason to
> migrate eventually, not now. The best outcome for this file is that it stays closed.

**Verified 2026-08-20** against Google's docs and the live project, with `gcloud` 565.0.0.
Command surfaces drift. **Re-verify before executing** — every substantive claim below carries a
source URL for exactly that reason. Do not trust a year-old certainty about a `gcloud` flag.

---

## The decision that matters

Use **Certificate Manager with DNS authorization.** Not a classic Compute Engine managed
certificate. This single choice is the difference between a clean cutover and a guaranteed
outage window.

| | Classic managed cert | Certificate Manager + DNS auth |
|---|---|---|
| Validates by | Resolving your A record to the LB IP | A `_acme-challenge` CNAME |
| Can issue before DNS cutover | **No** | **Yes** |
| Cutover window | 15–60 min of TLS errors, up to 24h | None — risk collapses to DNS TTL |

The classic cert requires your traffic to already point at the load balancer before issuance
begins: *"The certificate validation fails if the domains and subdomains in a Google-managed
certificate point to another IP than the load balancer's forwarding rule IP address."*
([docs](https://cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs))
Since DNS can only point one place, that is a mandatory dark window.

DNS authorization validates through a record that has nothing to do with where traffic goes:
*"You can provision certificates in advance, before the target proxy is ready to serve network
traffic."* ([docs](https://cloud.google.com/certificate-manager/docs/domain-authorization)) So
you build everything, prove it works against the LB IP with `curl --resolve` while real traffic
is still served by the old path, and the DNS flip becomes a single instant switch onto an
already-working endpoint.

**Everything else in this runbook is arranged around preserving that property.**

---

## Live state as measured (2026-08-20 — re-check before use)

1. **Compute Engine API is not enabled** on `tag-success-hub`. There is no existing LB; enabling
   the API is step 1, not boilerplate.
2. **`hub.taxadvisorygrowth.com` is live via a Cloud Run domain mapping.** It resolves to
   `ghs.googlehosted.com` → `74.125.142.121` and returns `HTTP/2 307 → /signin`, server
   `Google Frontend`. That 307 is the behavioural baseline to compare the LB against.
3. **DNS is Cloudflare** (`love.ns` / `braden.ns`), and the `hub` record is **DNS-only (grey
   cloud)** — it returns the Google host, not a Cloudflare IP. The apex is proxied
   (`162.159.140.166`) and serves something else. Leave the apex alone.
4. **Cloud Run ingress is `all`**; default URL is `https://tag-hub-git-vdsoboedgq-uc.a.run.app`.
5. **The service carries `run.googleapis.com/invoker-iam-disabled: true`** — public access via
   the newer invoker mechanism. The LB will not get 403s, and you do **not** need an
   `allUsers`/`roles/run.invoker` binding.

---

## Pre-flight — do these before touching anything

**Google Search Console verification of `taxadvisorygrowth.com`.** The OAuth consent screen's
Authorized domains takes the **top private domain**, not the subdomain — one entry covers
`hub.`. Ownership must be verified in Search Console under an account with owner permissions on
the API Console project. `run.app` is Google-owned and accepted without verification, so this
has likely never bitten you. It is the one step with a human and DNS-propagation dependency that
cannot be rushed. **If the site already signs people in on `hub.taxadvisorygrowth.com` today,
this is already done** — confirm rather than assume.

**Check for a CAA record at the apex.** If none exists, both `pki.goog` and `letsencrypt.org`
are allowed by default and you need do nothing. If *any* CAA exists, it blocks Google unless it
lists both. Authorize both, not one: *"if you specify just one of the CAs, only that CA is used
to create and renew your certificate, which isn't recommended."*
([docs](https://cloud.google.com/certificate-manager/docs/certificate-manager-best-practices))
A CAA that silently omits Google is a very common cause of stuck provisioning.

**Audit everything that calls the run.app URL** — Cloud Scheduler, Cloud Tasks, Eventarc,
Pub/Sub push subscriptions, Workflows, Firebase, uptime checks. Google explicitly lists all of
these as broken by `--no-default-url`. This is the single most likely way the migration causes a
delayed, confusing outage days later. Repoint them at the custom domain first.

---

## Command sequence

```bash
# Step 0 — everything below reuses these
export PROJECT=tag-success-hub
export REGION=us-central1
export SERVICE=tag-hub-git
export DOMAIN=hub.taxadvisorygrowth.com
gcloud config set project "$PROJECT"

# Step 1 — enable APIs. compute is confirmed NOT enabled; this is mandatory.
gcloud services enable compute.googleapis.com certificatemanager.googleapis.com --project="$PROJECT"

# Step 2 — reserve the global static IP. PREMIUM is required for a global external ALB.
# This is what the Cloudflare A record will point at; it must never change again.
gcloud compute addresses create tag-hub-lb-ip \
  --network-tier=PREMIUM --ip-version=IPV4 --global --project="$PROJECT"

export LB_IP=$(gcloud compute addresses describe tag-hub-lb-ip --global \
  --project="$PROJECT" --format="get(address)")
echo "LB_IP=$LB_IP"
```

```bash
# Step 3 — serverless NEG. --region is REQUIRED and must equal the Cloud Run region.
# This is the only regional resource in the stack. No --load-balancing-scheme flag exists here.
gcloud compute network-endpoint-groups create tag-hub-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$SERVICE" --project="$PROJECT"

# Step 4 — backend service. --load-balancing-scheme=EXTERNAL_MANAGED is REQUIRED: it selects
# the Envoy-based global external ALB. Omitting it silently defaults to EXTERNAL (the CLASSIC
# ALB), which will not match the EXTERNAL_MANAGED forwarding rule later.
# Do NOT add --enable-cdn. Do NOT add any --custom-request-header.
gcloud compute backend-services create tag-hub-backend \
  --load-balancing-scheme=EXTERNAL_MANAGED --global \
  --timeout=3600s --project="$PROJECT"

# Step 5 — attach the NEG. No health check: they are unsupported for serverless NEG backends,
# so do not create one and do not add health-check firewall rules.
gcloud compute backend-services add-backend tag-hub-backend \
  --global --network-endpoint-group=tag-hub-neg \
  --network-endpoint-group-region="$REGION" --project="$PROJECT"

# Step 6 — URL map. One default service, no host rules, no path rewrites. Keeping it this plain
# is deliberate: any route action here is a chance to break same-origin between the page and
# its /api routes. Never configure a URL mask on the NEG either.
gcloud compute url-maps create tag-hub-url-map \
  --default-service=tag-hub-backend --global --project="$PROJECT"
```

```bash
# Step 7 — DNS authorization. THIS is the step that decouples the cert from the traffic record.
gcloud certificate-manager dns-authorizations create tag-hub-dnsauth \
  --domain="$DOMAIN" --type=FIXED_RECORD --project="$PROJECT"

# Step 8 — read the exact CNAME to create. Copy it LITERALLY; do not transcribe by hand.
gcloud certificate-manager dns-authorizations describe tag-hub-dnsauth \
  --project="$PROJECT" --format="yaml(dnsResourceRecord)"

# Step 9 — create that CNAME in Cloudflare now, DNS-only, then confirm it resolves.
# It is inert, changes nothing about live traffic, and must stay permanently — renewals use it.
dig +short CNAME _acme-challenge.hub.taxadvisorygrowth.com

# Step 10 — the certificate, bound to that authorization.
gcloud certificate-manager certificates create tag-hub-cert \
  --domains="$DOMAIN" --dns-authorizations=tag-hub-dnsauth --project="$PROJECT"

# Step 11 — cert map + entry binding the cert to the SNI hostname.
gcloud certificate-manager maps create tag-hub-cert-map --project="$PROJECT"
gcloud certificate-manager maps entries create tag-hub-cert-entry \
  --map=tag-hub-cert-map --certificates=tag-hub-cert \
  --hostname="$DOMAIN" --project="$PROJECT"
```

> ### ⛔ HARD GATE — do not touch DNS until this prints `ACTIVE`
> ```bash
> gcloud certificate-manager certificates describe tag-hub-cert --project="$PROJECT" \
>   --format="yaml(managed.state, managed.provisioningIssue, managed.authorizationAttemptInfo)"
> ```
> Typically 5–20 minutes once the CNAME resolves publicly. Budget 30. If it exceeds 60,
> something is wrong — see [Stuck in PROVISIONING](#stuck-in-provisioning).

```bash
# Step 12 — target HTTPS proxy. --certificate-map is used INSTEAD of --ssl-certificates;
# they are mutually exclusive. No --load-balancing-scheme flag on this command.
gcloud compute target-https-proxies create tag-hub-https-proxy \
  --url-map=tag-hub-url-map --certificate-map=tag-hub-cert-map \
  --http-keep-alive-timeout-sec=610 --global --project="$PROJECT"

# Step 13 — HTTPS forwarding rule. Scheme MUST match the backend service.
# After this the LB is live and serving a valid cert, while real traffic is still on the
# old domain mapping.
gcloud compute forwarding-rules create tag-hub-https-fr \
  --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM \
  --address=tag-hub-lb-ip --target-https-proxy=tag-hub-https-proxy \
  --global --ports=443 --project="$PROJECT"
```

```bash
# Step 14 (optional) — HTTP→HTTPS redirect. Needs its OWN url map; you cannot reuse the first.
cat > /tmp/tag-hub-http-redirect.yaml <<'YAML'
kind: compute#urlMap
name: tag-hub-url-map-http
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: True
YAML

gcloud compute url-maps import tag-hub-url-map-http \
  --source=/tmp/tag-hub-http-redirect.yaml --global --project="$PROJECT"
gcloud compute target-http-proxies create tag-hub-http-proxy \
  --url-map=tag-hub-url-map-http --global --project="$PROJECT"
# Same IP is mandatory or the redirect will not work. Note EXTERNAL_MANAGED here too — the
# classic-ALB version of this doc says EXTERNAL and is the wrong page.
gcloud compute forwarding-rules create tag-hub-http-fr \
  --load-balancing-scheme=EXTERNAL_MANAGED --network-tier=PREMIUM \
  --address=tag-hub-lb-ip --target-http-proxy=tag-hub-http-proxy \
  --global --ports=80 --project="$PROJECT"
```

### Rehearse the entire cutover with zero risk

`curl --resolve` forces the hostname at the LB IP without any DNS change.

```bash
curl -sSI --resolve "$DOMAIN:443:$LB_IP" "https://$DOMAIN/"
curl -sS -o /dev/null -D - --resolve "$DOMAIN:80:$LB_IP" "http://$DOMAIN/" | head -5
curl -sS -i --resolve "$DOMAIN:443:$LB_IP" "https://$DOMAIN/signin" \
  | grep -i -e '^HTTP' -e '^set-cookie' -e '^location'
```

Expect the same `307 → /signin` the live site gives today, and any `Set-Cookie` unmodified.

### The flip

```bash
# Step 15 — LOWER THE TTL FIRST. Set the existing hub record to TTL 300 and wait a full old
# TTL before flipping. This is what makes rollback fast.
dig +noall +answer "$DOMAIN"

# Step 16 — in Cloudflare: DELETE  CNAME hub -> ghs.googlehosted.com
#                          CREATE  A     hub -> $LB_IP   (DNS only / grey cloud, TTL 300)
dig +short "$DOMAIN" @1.1.1.1
dig +short "$DOMAIN" @8.8.8.8

# Step 17 — verify real traffic through the LB, then log in through a real browser end to end
# before proceeding. Everything after this removes a fallback path.
curl -sS -o /dev/null -w 'http_code=%{http_code} remote_ip=%{remote_ip}\n' "https://$DOMAIN/"
```

### Lockdown — one step at a time, verifying between each

```bash
# Step 18 — delete the now-redundant domain mapping. AFTER the flip is verified, not at flip
# time: keeping it is the widest safety net you have.
gcloud beta run domain-mappings delete --domain="$DOMAIN" --region="$REGION" --project="$PROJECT"

# Step 19 — lock ingress to the load balancer.
gcloud run services update "$SERVICE" --region="$REGION" \
  --ingress=internal-and-cloud-load-balancing --project="$PROJECT"

curl -sS -o /dev/null -w 'custom=%{http_code}\n' "https://$DOMAIN/"
curl -sS -o /dev/null -w 'runapp=%{http_code}\n' https://tag-hub-git-vdsoboedgq-uc.a.run.app/

# Step 20 — LAST STEP. Removes your fallback origin, leaving exactly one origin so the
# Origin-vs-Host CSRF check can never see a second hostname. Confirm the run.app audit first.
gcloud run services update "$SERVICE" --region="$REGION" \
  --no-default-url --project="$PROJECT"

gcloud run services describe "$SERVICE" --region="$REGION" \
  --project="$PROJECT" --format="value(status.url)"   # should now be empty
```

---

## DNS records

All in Cloudflare. **Grey cloud / DNS-only is mandatory on both.** An orange-clouded record puts
Cloudflare's TLS terminator in front of Google's, giving you a second edge that caches and can
interfere with `Set-Cookie` on `hub_session` — and the LB IP *"needs to be directly accessible
without any redirects, firewalls, or CDNs in the request path."*

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `hub` | `$LB_IP` | DNS only | 300 |
| CNAME | `_acme-challenge.hub` | *copy literally from the describe output* | DNS only | auto |

The A record **replaces** the existing `CNAME hub → ghs.googlehosted.com`; delete that at
cutover, not before. The `_acme-challenge` CNAME must be the **only** record at that name, and
stays forever — renewals use it.

**Do not create an AAAA record** unless you also reserve a global IPv6 address and a second
forwarding rule. A stray AAAA pointing elsewhere breaks certificate validation and sends some
clients to the wrong origin.

**Leave the apex alone.** It is proxied and serving something else; changing it is out of scope
and adds risk. A global external ALB is reached by A/AAAA, never a CNAME — it has no hostname to
CNAME to, unlike a Cloud Run domain mapping. If you ever *do* add the apex, it needs its own
second DNS authorization: an authorization covers one domain and its first-level wildcard only.

---

## Verification gates and what failure looks like

| Stage | Pass | Failure signature |
|---|---|---|
| Certificate | `managed.state: ACTIVE` | Stuck >15 min → the `_acme-challenge` CNAME is missing, mistyped, or orange-clouded |
| LB serves (pre-DNS) | `307 → /signin`, `Google Frontend` | TLS error → cert map hostname mismatch, or proxy built with `--ssl-certificates`<br>502/503 → NEG not attached<br>hang → scheme mismatch between forwarding rule and backend service |
| Host + cookie | `Set-Cookie` unmodified, no `.run.app` anywhere | A `Location` or cookie `Domain=` naming `*.run.app` means the app builds absolute URLs from something other than the Host header — **fix before flipping** |
| Redirect | `301 → https://…` | 404 or the backend's 307 → HTTP proxy pointed at the wrong url map<br>connection refused → the two forwarding rules are on different IPs |
| DNS | both resolvers return only `$LB_IP` | `ghs.googlehosted.com` → old TTL not expired, wait<br>`104.x`/`172.6x`/`162.159.x` → the record got orange-clouded |
| Real traffic | login completes, `hub_session` survives refresh | 403 from your own CSRF check → Origin no longer matches Host; capture both values before rolling back |
| Ingress | custom domain 307, run.app refused | Custom domain **also** failing → immediately `--ingress=all` and investigate |
| Default URL closed | `status.url` empty | The dangerous one is silent: a background job failing hours later because it called run.app |

---

## Rollback, by stage

Every step before the DNS flip is a no-op for live traffic. Rollback only ever matters from the
flip onward.

**Before the flip** — nothing to roll back. To abandon entirely, delete in reverse dependency
order: forwarding rules → proxies → url maps → backend service → NEG → address → cert map entry
→ map → certificate → dns-authorization.

**After the flip, before deleting the domain mapping** — this is the widest safety net, and the
whole reason those are separate steps. Revert the Cloudflare record to `CNAME hub →
ghs.googlehosted.com`. Because you lowered the TTL, recovery is ~5 minutes. The mapping is
untouched and resumes immediately. **Keep the mapping for a full business day of clean traffic.**

**After deleting the mapping** — still a DNS revert, but you must recreate the mapping first and
wait for its certificate, so expect a gap. In practice it is usually faster to fix the LB than
to retreat.

```bash
# After ingress lockdown — instant, no DNS involved
gcloud run services update tag-hub-git --region=us-central1 --ingress=all --project=tag-success-hub

# After --no-default-url — instant, hostname returns unchanged
gcloud run services update tag-hub-git --region=us-central1 --default-url --project=tag-success-hub
```

Full abort order: `--default-url` → `--ingress=all` → recreate mapping → revert DNS → optionally
tear down the LB. That order keeps the service reachable before DNS moves back.

**Never roll back the `_acme-challenge` CNAME.** It is inert, affects no routing, and saves the
validation wait if you retry later.

---

## Stuck in PROVISIONING

In rough order of likelihood:

1. **`CNAME_MISMATCH`** — trailing-dot error, or the registrar appended the zone name twice
   (producing `_acme-challenge.hub.taxadvisorygrowth.com.taxadvisorygrowth.com`), or the value
   was copied from a different authorization.
2. **A CAA record at the apex omitting `pki.goog` and `letsencrypt.org`.** Silent and common.
3. **Extra records at the `_acme-challenge` name** — the CNAME must be the only one there.
4. **Not publicly resolvable** — split-horizon DNS or a DNS firewall.
5. **`CERTIFICATE_NOT_ATTACHED`** — a cert map whose proxy has no forwarding rule counts as
   unattached.
6. **Long TTL on a pre-existing wrong `_acme-challenge`** — set TTL 30–60 before creating it.
7. **Inconsistent global DNS answers** — CAs use multi-perspective validation and require
   consistent answers worldwide.
8. **Rate limiting** from repeated failed attempts. Stop retrying, fix the cause, wait.

`RESOLVED_TO_NOT_SERVING`, `NO_RESOLVED_IPS`, and `RESOLVED_TO_SERVING_ON_ALT_PORTS` are
load-balancer-authorization failures and **should not appear with DNS authorization** — that is
the point of choosing it.

---

## What was not verified

- **Whether `ingress=internal-and-cloud-load-balancing` still permits domain-mapping traffic.**
  Google's ingress page enumerates internal and external ALB and says nothing either way. This
  is precisely why lockdown comes *after* the flip and after deleting the mapping — that
  ordering makes the answer irrelevant. Deviate from the order and you may take the site down.
- **Whether the app derives the cookie `Secure` flag and absolute URLs from `X-Forwarded-Proto`**
  rather than the connection it observes. The ALB terminates TLS, so the container never sees
  the client's TLS connection. Host preservation is documented on the general ALB page but the
  serverless-NEG page is silent on it. **Verify empirically at the rehearsal step** — a cookie
  losing `Secure`, or a `Location` naming the run.app host, is the failure signature.
- **The exact `_acme-challenge` value.** Generated per-authorization. Read it out of `describe`.
- **What currently calls the run.app URL.** Not enumerable from outside the project.
- **Cloudflare-side specifics** — no Google source covers them, and they were not checked
  against Cloudflare's own docs.

No mutating command was run in producing this. Every check was `list`/`describe`/`get-iam-policy`
plus `dig` and `curl` against the already-public site.
