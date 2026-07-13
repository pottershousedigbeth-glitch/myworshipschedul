# Worship Team Database

## Original Problem Statement
Create a database for worship team with:
- Schedule every Sunday and Wednesday (now supports all 7 days)
- Roles: singers, bass, guitarist, keyboard player, drummer
- Song slots for each service

## Architecture & Tasks Completed

### Backend (FastAPI + MongoDB)
- **User Authentication**: JWT-based auth with email/password
- **Role-based Access Control**: 
  - Master Admin: Full access + user management
  - Admin: Can edit team, songs, schedules
  - Member: View-only access
- Team Members CRUD with roles (singer, bass, guitarist, keyboard, drummer)
- Songs CRUD with title, artist, key, tempo, notes
- Services CRUD with date, day (all 7 days), time, title
- Service assignments (assign team members to specific roles)
- Song slots (assign songs to services in order)
- Stats endpoint for dashboard
- Upcoming services endpoint

### Frontend (React + Tailwind + Shadcn/UI)
- **Login page** with email/password authentication
- **User management page** (Master Admin only)
- Dashboard with stats cards and upcoming services
- Team Members page with add/edit/delete functionality
- Songs page with song library management
- Schedule page with calendar view (all 7 days support)
- Service Detail page for managing assignments and song lists
- Dark sidebar navigation with user info and role badge
- Role-based UI (edit buttons hidden for Members)
- Responsive design for mobile/desktop

### Database Collections
- users: id, email, name, password_hash, role, created_at
- team_members: id, name, email, phone, roles[], notes, created_at
- songs: id, title, artist, key, tempo, notes, created_at
- services: id, date, day, time, title, notes, assignments[], song_slots[], created_at

### User Roles
- **Master Admin**: n.marrett@hotmail.co.uk / worship2024
- **Admin**: Can edit schedules, songs, team members
- **Member**: View-only access

## Next Tasks / Enhancements
1. Password reset functionality
2. Email notifications - send weekly schedule to team members
3. Song lyrics/chord sheets - attach PDF or text to songs
4. Recurring service templates - auto-generate services for next month
5. Export to PDF - generate printable service sheets
6. Member availability tracking - mark dates they're unavailable
7. Practice scheduling - track rehearsal times separate from services
