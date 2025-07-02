
Deployment Checklist
Before each deployment to Vercel:

Environment Variables
E2B_API_KEY
OPENROUTER_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (for cron jobs)
CRON_SECRET

Database Migrations

Run migrations on Supabase
Test RLS policies
Verify indexes


Security Checks

API routes have proper auth
No exposed secrets
CORS configured correctly


Performance

Images optimized
Code splitting working
