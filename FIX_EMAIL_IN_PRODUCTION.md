# Fix Email Sign-In in Production

**Issue:** OTP (6-digit code) not being sent in production  
**Cause:** `MAIL_PROVIDER` environment variable not set in Cloud Run  
**Status:** Requires immediate fix

---

## Quick Fix (5 minutes)

### Set Environment Variables in Cloud Run

```bash
gcloud run services update tag-hub-git \
  --region us-central1 \
  --update-env-vars \
  MAIL_PROVIDER=gmail,\
GMAIL_SENDER=support@taxadvisorygrowth.net
```

**Note:** The service account `hub-app@tag-success-hub.iam.gserviceaccount.com` must have IAM permissions to send mail via Gmail API.

---

## Verify the Fix

1. Navigate to Cloud Run console: https://console.cloud.google.com/run
2. Click `tag-hub-git` service
3. Click "Revisions" tab
4. Verify the new revision has `MAIL_PROVIDER=gmail` in Environment variables
5. Test by signing in again - should receive 6-digit code

---

## Detailed Setup (If New Environment)

If this is a fresh deployment without Gmail configured:

### Step 1: Set Basic Email Variable

```bash
gcloud run services update tag-hub-git \
  --region us-central1 \
  --update-env-vars MAIL_PROVIDER=gmail,GMAIL_SENDER=support@taxadvisorygrowth.net
```

### Step 2: Configure Gmail API (One-time setup)

In Google Cloud Console:
1. Go to APIs & Services → Library
2. Search for "Gmail API"
3. Click "Enable"
4. Go to "Service Accounts"
5. Find `hub-app@tag-success-hub.iam.gserviceaccount.com`
6. Grant it "Service Account Token Creator" role

### Step 3: Configure Google Workspace Domain-Wide Delegation

In Google Workspace Admin Console:
1. Go to Security → API controls → Domain-wide delegation
2. Click "Add new"
3. Enter:
   - **Client ID:** `102839561497136967158`
   - **Scope:** `https://www.googleapis.com/auth/gmail.send`

### Step 4: Verify Connection

Test the connection:
```bash
# Tail logs for email errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tag-hub-git AND severity=ERROR" --limit 20 --format json
```

---

## Environment Variables Needed

```
MAIL_PROVIDER=gmail
GMAIL_SENDER=support@taxadvisorygrowth.net
```

Optional (already configured):
```
GMAIL_SERVICE_ACCOUNT=hub-app@tag-success-hub.iam.gserviceaccount.com  # Default, can omit
```

---

## Testing After Fix

1. Go to https://tag-hub-git-vdsoboedgq-uc.a.run.app
2. Enter any email
3. Click "Request code"
4. **Should receive** email with 6-digit code
5. Enter code to sign in

---

## If Still Not Working

**Check Cloud Run logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tag-hub-git" \
  --limit 50 \
  --format json | grep -i "mail\|email\|error"
```

**Common issues:**
- [ ] `MAIL_PROVIDER` not set → Set to `gmail`
- [ ] Gmail API not enabled → Enable in Cloud APIs
- [ ] Service account missing permissions → Add token creator role
- [ ] Domain-wide delegation not configured → Configure in Workspace admin
- [ ] Sender address not configured → Set `GMAIL_SENDER`

---

## Quick Test Command

After setting environment variables, verify:

```bash
# Check environment variables are set
gcloud run services describe tag-hub-git --region us-central1 --format 'value(spec.template.spec.containers[0].env)'
```

Should show:
```
MAIL_PROVIDER: gmail
GMAIL_SENDER: support@taxadvisorygrowth.net
```

---

## Summary

**Immediate action:** Run the gcloud command above to set `MAIL_PROVIDER=gmail`  
**Expected result:** OTP emails will start sending immediately  
**Time to fix:** ~5 minutes  
**Testing:** Try signing in again to verify

