# Deployment Checklist

## Pre-Deployment
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes without errors  
- [ ] Environment variables are set in `.env.local`
- [ ] Default model fallbacks are in place for all API routes

## Server Startup
- [ ] Use `nohup npm run dev > server.log 2>&1 &` for background running
- [ ] Check `tail -f server.log` for any startup errors
- [ ] Verify server responds: `curl -I http://localhost:3000`
- [ ] Test critical endpoints: `/test-ai`, `/api/ai-proxy`

## Common Issues & Fixes
1. **"Model undefined" error**: Check default model fallback in `app/api/chat/route.ts`
2. **Port 3000 in use**: `pkill -f "next dev"` then restart
3. **Environment variables**: Verify `.env.local` has required keys
4. **Build failures**: Check TypeScript errors and dependencies

## Testing Sequence
1. Visit http://localhost:3000
2. Visit http://localhost:3000/test-ai  
3. Generate a simple app
4. Test AI injection in generated app console
5. Verify `window.AI.ask("test")` works