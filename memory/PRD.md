# Worship Team Scheduler - Product Requirements Document

## Overview
A full-stack database application for managing worship teams, including scheduling, team member management, song library, and role-based access control.

## User Personas
- **Master Admin**: Full control over all features, user management, analytics
- **Admin**: Team/service management, scheduling, approval workflows
- **Member**: View schedules, request swaps, suggest songs
- **Everyone**: Basic access role

## Core Features (Implemented)

### Authentication & RBAC
- JWT-based authentication
- Role-based access control (master_admin, admin, member, everyone)
- Self-service password changes
- Public "Forgot Password" flow with email-based reset

### Scheduling System
- Create/edit/archive services with date, time, title
- Assign team members to roles
- Add songs to services with drag-and-drop reordering
- Mobile-friendly up/down arrows for song reordering
- Scheduling warnings for overuse of songs (1 month) and members (1 week)

### Team Management
- Full CRUD for team members
- Swap request system with admin approval
- Availability marking system
- "View as Member" mode for admins

### Song Library
- Full CRUD for songs
- File uploads for song sheets/charts
- Song suggestion system with admin approval

### Notifications (Resend Integration)
- "Notify Team" - email assigned members about a service
- "Announce" - email all team members about a service
- **"Notify Member" (Bell icon)** - send individual reminder to a specific team member
- Password reset emails
- Push notifications when assigned to services

### Admin Tools
- Analytics dashboard with stats
- Service archiving
- Admin-driven password resets

### PWA (Progressive Web App) - COMPLETED
- Web App Manifest with app icons
- Service Worker for offline caching
- Installable on mobile/desktop devices
- App shortcuts to Schedule and Songs pages

### Push Notifications - COMPLETED
- VAPID key-based web push notifications
- Automatic notifications when assigned to a service
- Automatic notifications when schedule changes (date/time updates)
- Enable/disable toggle in sidebar
- Test notification feature
- Subscription persistence in MongoDB

## Technical Architecture

### Stack
- **Frontend**: React with Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Email**: Resend API

### Key Files
- `/app/backend/server.py`: Main API server
- `/app/frontend/src/App.js`: React routing
- `/app/frontend/public/manifest.json`: PWA manifest
- `/app/frontend/public/service-worker.js`: PWA service worker

### API Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/forgot-password` - Initiate password reset
- `POST /api/auth/reset-password` - Complete password reset
- `POST /api/services/{id}/archive` - Toggle service archive status
- `POST /api/services/{id}/notify` - Notify assigned team members
- `POST /api/services/{id}/notify-all` - Announce to all members
- `GET /health` - Kubernetes health check

## Completed This Session
- [x] PWA Conversion verification (Jan 30, 2026)
  - Manifest serving correctly
  - Service worker registered
  - Icons accessible
  - App installable
- [x] Push Notifications implementation (Jan 30, 2026)
  - Backend VAPID key setup and push endpoints
  - Service worker push event handling
  - React hook for subscription management
  - Sidebar toggle for enabling/disabling notifications
  - Automatic notifications on service assignment
  - Automatic notifications on schedule changes

## Known Issues
1. **Email Delivery (BLOCKED)**: Test users have placeholder emails - need real emails
2. **Swap Icon Visibility**: Awaiting user verification on improved button

## Backlog
- [ ] **P1: Ticket Section** - Awaiting user clarification on requirements
- [ ] **P2: WhatsApp Notifications** - Deferred
- [ ] **P2: Mobile Date Picker Refactor**

## Test Credentials
- **Master Admin**: n.marrett@hotmail.co.uk / password
- **Member 1**: jodie@test.com / member123
- **Member 2**: beni@test.com / member123
