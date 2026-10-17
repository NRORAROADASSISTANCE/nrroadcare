# TEXTPE by NR CONNECT

TEXTPE is the planned messaging product under NR CONNECT.

## Current milestone
- Responsive mobile/desktop chat UI prototype.
- Conversation list and search.
- Local demo message composition.
- Blue/cyan/navy brand styling.

## Important status
This is a **front-end prototype only**. It is not a production messaging service yet. It does not have real user registration, OTP verification, remote message delivery, file upload, push notifications, voice/video calling, or end-to-end encryption. Demo messages are stored locally in the current browser.

## Production roadmap
1. Confirm product/domain/trademark clearance and choose the official app domain.
2. Configure Supabase project, auth provider, and secure RLS policies for TEXTPE-specific tables.
3. Implement phone OTP sign-in, profiles, contacts, blocks/reports, and account recovery.
4. Implement conversations, group membership, real-time messages, receipts, media storage, and message permissions.
5. Add push notifications and presence/last-seen controls.
6. Add voice/video calling using a suitable WebRTC/SFU provider and secure call signaling.
7. Implement privacy controls, abuse reporting, rate limits, retention/deletion, backups, and admin audit.
8. Test mobile browsers, accessibility, security, delivery behavior, and load; then publish production deployment and app-store builds.

## Security rules
- Never expose service-role keys in browser code.
- Enable and test row-level security for every user-data table.
- Do not claim end-to-end encryption until a reviewed protocol is implemented and tested.
- Keep production secrets in the hosting provider's encrypted environment variables.
