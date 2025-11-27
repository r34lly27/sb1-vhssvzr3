# Troubleshooting Guide

## Common Issues & Solutions

### 1. Admin Cannot Access Dashboard / Stuck as Student

**Symptoms:**
- Admin user cannot access admin dashboard
- Gets redirected to student view
- "Access Denied" message when logging in as admin

**Root Cause:**
- Missing or incorrect admin_users record
- RLS policies not allowing admin verification

**Solution:**
1. Verify admin user exists in database:
```sql
SELECT * FROM admin_users WHERE email = 'your-admin@email.com';
```

2. If missing, run the create_admin.mjs script:
```bash
node create_admin.mjs
```

3. Clear browser cache and localStorage:
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 2. Failed to Fetch Data / Network Errors

**Symptoms:**
- "Failed to fetch" errors in console
- Data not loading after login
- Empty tables/dashboards

**Root Causes:**
- Invalid or expired session
- Incorrect environment variables
- RLS policies blocking access
- Network/CORS issues

**Solutions:**

**A. Check Environment Variables:**
```bash
# Verify .env file has correct values
cat .env
# Should contain:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

**B. Verify Session:**
```javascript
// In browser console:
const { data } = await supabase.auth.getSession();
console.log('Session:', data);
```

**C. Test RLS Policies:**
```sql
-- Check if admin can read students
SELECT * FROM students LIMIT 1;

-- Check if admin user record exists
SELECT * FROM admin_users WHERE id = auth.uid();
```

**D. Force Logout & Re-login:**
1. Click Logout
2. Clear localStorage: `localStorage.clear()`
3. Close all tabs
4. Open new tab and login again

### 3. Auto-Logout After Sleep/Inactivity

**Expected Behavior:**
- Users are automatically logged out after 10 minutes of inactivity
- Alert message: "You have been logged out due to inactivity"

**Activities that Reset Timer:**
- Mouse movement
- Mouse clicks
- Keyboard input
- Scrolling
- Touch events (mobile)

**To Disable (for testing):**
Comment out the inactivity timer in:
- `src/contexts/AdminAuthContext.tsx` (lines 46-76)
- `src/contexts/AuthContext.tsx` (lines 34-64)

### 4. RLS Policy Errors

**Symptoms:**
- "new row violates row-level security policy"
- "permission denied for table"

**Check Current Policies:**
```sql
-- View all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'students';
```

**Common Fixes:**

**Admin can't insert students:**
```sql
-- Verify this policy exists:
SELECT * FROM pg_policies
WHERE tablename = 'students'
AND policyname = 'Admins can insert students';
```

**Student can't view their grades:**
```sql
-- Verify this policy exists:
SELECT * FROM pg_policies
WHERE tablename = 'grades'
AND policyname = 'Authenticated users can view grades';
```

### 5. Production Deployment Issues

**Environment Variables Not Working:**

When deploying (e.g., Vercel, Netlify):

1. Add environment variables in deployment platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Rebuild the application after adding variables

3. Verify variables are loaded:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Anon Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
```

**CORS Issues:**
- Supabase automatically handles CORS for authenticated requests
- Check Supabase dashboard → Settings → API → CORS
- Add your deployment URL to allowed origins

### 6. Session Persistence Issues

**Symptoms:**
- User logged out after page refresh
- Session not maintained between tabs
- Random logouts

**Solutions Implemented:**
```typescript
// In src/lib/supabase.ts
auth: {
  autoRefreshToken: true,     // Auto-refresh expired tokens
  persistSession: true,        // Persist session in localStorage
  detectSessionInUrl: true,    // Handle OAuth redirects
  flowType: 'pkce',            // More secure auth flow
  storage: window.localStorage // Explicit storage location
}
```

**Manual Fix:**
1. Logout completely
2. Clear all browser data for the site
3. Login again
4. Session should now persist correctly

### 7. Bulk Upload Failures

**Excel Format Issues:**
- Ensure all required columns are present
- Check for empty rows
- Verify data types match expected format
- Use the template download feature

**Database Constraints:**
- Duplicate emails will be skipped
- Duplicate NIMs will fail
- Check console for detailed error messages

### 8. Admin Panel Not Showing Data

**Quick Diagnostic:**

1. Open browser console (F12)
2. Check for errors (red text)
3. Look for specific error messages:
   - "Missing Supabase environment variables" → Check .env file
   - "new row violates row-level security" → RLS policy issue
   - "Failed to fetch" → Network/session issue
   - "permission denied" → RLS policy issue

4. Verify admin status:
```javascript
// In console:
const { data: session } = await supabase.auth.getSession();
const { data: admin } = await supabase
  .from('admin_users')
  .select('*')
  .eq('id', session.session.user.id)
  .single();
console.log('Is Admin:', !!admin);
```

## Best Practices

1. **Always logout properly** - Use the logout button, don't just close the tab
2. **Clear cache after updates** - After code changes, clear cache and hard reload (Ctrl+Shift+R)
3. **Check console for errors** - Many issues show detailed errors in browser console
4. **Test in incognito mode** - Eliminates cached data issues
5. **Keep browser updated** - Modern browsers have better localStorage support

## Getting Help

If issues persist:

1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify database policies are correct
4. Test with a fresh account
5. Try a different browser

## Database Maintenance

**Reset a User's Password:**
```sql
-- Generate password reset link in Supabase Dashboard
-- Or use Auth API to send reset email
```

**Clean Up Test Data:**
```sql
-- Delete test students (be careful!)
DELETE FROM students WHERE email LIKE '%test%';

-- Clean up orphaned enrollments
DELETE FROM enrollments
WHERE student_id NOT IN (SELECT id FROM students);
```

**Backup Before Major Changes:**
```bash
# Export data before migrations
supabase db dump > backup.sql
```
