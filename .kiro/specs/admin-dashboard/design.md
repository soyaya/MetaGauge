# Design Document: MetaGauge Admin Dashboard

## Overview

The MetaGauge Admin Dashboard is a standalone, role-gated control plane for platform operators. It is served at `/admin` with its own Next.js layout, visually distinct from the user-facing analytics dashboard. The admin backend is a set of Express.js routes under `/api/admin/*`, protected by a dedicated `requireAdminAuth` middleware that validates a separate JWT signed with `ADMIN_JWT_SECRET`.

Authentication is hardcoded — admin credentials are set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. There is no self-registration path. The admin shares the same PostgreSQL database as the main app and reads/writes directly to all tables.

The dashboard covers 23 functional areas: authentication, user CRM (full CRUD, sessions, notes, context panel), subscription and billing management, platform KPIs, churn risk scoring, indexing health, audit log, security event log, API key management, feature flags, runtime config editor, system announcements, IP access controls, email delivery monitoring, platform health, bulk user actions, permission matrix viewer, 2FA enforcement, team invitations, competitive intelligence admin view, alert management admin view, and AI usage admin view.
