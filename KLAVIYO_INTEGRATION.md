# Klaviyo Integration

## Overview

New email subscribers are automatically synced to a Klaviyo list for email marketing. When a user subscribes on the landing page, their email is saved to the local database and sent to Klaviyo in the background.

## Setup

1. Log in to the admin dashboard at `http://localhost:3001`
2. Go to the **Integrations** tab
3. Enter your **Klaviyo Private API Key** (starts with `pk_`)
4. Enter your **Klaviyo List ID** (found in Klaviyo under Lists & Segments)
5. Click **Save Klaviyo Settings**
6. Click **Test Connection** to verify the credentials

## How It Works

1. A visitor enters their email on the landing page
2. The backend saves the email to the SQLite `subscribers` table
3. The backend calls the Klaviyo API in the background (non-blocking)
4. The subscriber is added to the configured Klaviyo list with `SUBSCRIBED` marketing consent
5. If Klaviyo sync fails, the local subscription still succeeds — errors are logged server-side

## API Details

- **Klaviyo API version**: v3 (revision `2024-10-15`)
- **Endpoint used**: `POST /api/profile-subscription-bulk-create-jobs`
- Profiles are created/updated and subscribed to the list in a single call

## Security

- Klaviyo API Key and List ID are stored in the `settings` table
- The public settings endpoint (`GET /api/settings`) excludes these keys
- Only authenticated admin requests can read (`GET /api/settings/all`) or update them

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Klaviyo not configured" in server logs | Add API Key and List ID in the Integrations tab |
| "Invalid API Key" on test | Verify you're using a **Private API Key**, not a public one |
| "List ID not found" on test | Copy the List ID from Klaviyo's Lists & Segments page |
| Subscriber saved locally but not in Klaviyo | Check server logs — Klaviyo sync is non-blocking, failures are logged |
