# 🚀 Vercel Deployment Guide

This guide will walk you through deploying your FCA application to Vercel.

## Prerequisites

- ✅ A [Vercel account](https://vercel.com/signup) (free tier is perfect)
- ✅ Your code pushed to GitHub, GitLab, or Bitbucket
- ✅ Your Supabase project URL and anon key

---

## 🎯 Quick Deploy (5 minutes)

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Choose your FCA repository
5. Vercel will auto-detect it's a Vite project ✨

### Step 2: Configure the Project

When prompted:

**Framework Preset:** Vite (auto-detected)  
**Root Directory:** `fca-web`  
**Build Command:** `npm run build` (auto-detected)  
**Output Directory:** `dist` (auto-detected)

### Step 3: Add Environment Variables

In the Vercel project settings, add these environment variables:

| Variable Name | Value | Where to Find It |
|--------------|-------|------------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Dashboard → Settings → API → Project API keys |

**Important:** Make sure to use the variable names exactly as shown (with `VITE_` prefix).

### Step 4: Deploy! 🚀

Click **"Deploy"** and Vercel will:
- Install dependencies
- Build your app
- Deploy to a global CDN
- Give you a live URL (e.g., `your-app.vercel.app`)

**First deployment takes ~2-3 minutes.**

---

## 🔄 Continuous Deployment (Automatic)

Once deployed, Vercel automatically:
- ✅ Deploys every push to your main branch
- ✅ Creates preview deployments for pull requests
- ✅ Provides unique URLs for each deployment
- ✅ Rolls back instantly if needed

---

## 🌐 Custom Domain (Optional)

To use your own domain (e.g., `app.yourdomain.com`):

1. Go to your Vercel project → **Settings** → **Domains**
2. Add your domain
3. Update your DNS records (Vercel provides instructions)
4. SSL certificate is added automatically! 🔒

---

## 🔧 Local Testing Before Deploy

Test the production build locally:

```bash
cd fca-web
npm run build
npm run preview
```

Visit `http://localhost:4173` to test the production build.

---

## 📊 Monitoring & Analytics

After deployment, Vercel provides:
- **Real-time logs** - See errors as they happen
- **Performance analytics** - Core Web Vitals tracking
- **Deployment history** - Rollback to any previous version

Access these in your Vercel dashboard.

---

## 🐛 Troubleshooting

### Issue: "Module not found" errors

**Solution:** Make sure all imports in your code use the correct aliases defined in `vite.config.js`

### Issue: Environment variables not working

**Solution:** 
1. Ensure they start with `VITE_` prefix
2. Redeploy after adding/changing env vars
3. Check Settings → Environment Variables in Vercel

### Issue: 404 on page refresh

**Solution:** The `vercel.json` file handles this - make sure it's committed to your repo

### Issue: Build fails

**Solution:** 
1. Check build logs in Vercel
2. Test `npm run build` locally first
3. Ensure all dependencies are in `package.json` (not just dev dependencies)

---

## 🎯 Production Checklist

Before your first deploy:

- [ ] All environment variables are set in Vercel
- [ ] `vercel.json` is committed to your repo
- [ ] Local production build works (`npm run build && npm run preview`)
- [ ] Supabase RLS policies are properly configured
- [ ] All database migrations have been run

---

## 📚 Useful Commands

```bash
# Install Vercel CLI (optional, for advanced users)
npm i -g vercel

# Deploy from command line
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs
```

---

## 🔗 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Supabase + Vercel Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-vercel)

---

## 🎉 That's It!

Your app will be live at `https://your-project-name.vercel.app`

**Deployment time:** ~2-3 minutes  
**Global CDN:** Content served from 100+ locations worldwide  
**Free SSL:** Automatic HTTPS certificate  

Questions? Check the [Vercel Community](https://github.com/vercel/vercel/discussions) or open an issue in your repo.

