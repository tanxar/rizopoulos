# Deployment στο Render

## Προαπαιτούμενα

1. GitHub account
2. Render account (https://render.com)

## Βήμα 1: Push στο GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## Βήμα 2: Δημιουργία Web Service στο Render

1. Πηγαίνετε στο [Render Dashboard](https://dashboard.render.com)
2. Κάντε κλικ "New +" → "Web Service"
3. Connect your GitHub repository
4. Επιλέξτε το repository σας
5. Συμπληρώστε:
   - **Name**: `rizopoulos`
   - **Environment**: `Node`
   - **Region**: `Frankfurt` (ή πιο κοντά)
   - **Branch**: `main`
   - **Root Directory**: (άδειο)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Κάντε κλικ "Create Web Service"

## Βήμα 3: Environment Variables

Στο Render Dashboard → Environment Variables, προσθέστε:

```
NODE_ENV=production
PORT=10000
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=your_random_secret_key_min_32_chars
UPLOADS_DIR=/opt/render/project/src/uploads
DATABASE_PATH=/opt/render/project/src/database.sqlite
```

## Βήμα 4: Persistent Disk (για uploads και database)

1. Στο Render Dashboard → Settings
2. Κάντε κλικ "Add Persistent Disk"
3. Συμπληρώστε:
   - **Name**: `rizopoulos-storage`
   - **Mount Path**: `/opt/render/project/src`
   - **Size**: `5 GB` (αρχικά, μπορείτε να αυξήσετε αργότερα)
4. Κάντε κλικ "Add Disk"

**Σημείωση**: Το disk mount path πρέπει να είναι parent directory του uploads και database.

## Βήμα 5: Custom Domain (.gr domain)

1. Στο Render Dashboard → Settings → Custom Domains
2. Κάντε κλικ "Add Custom Domain"
3. Εισάγετε: `your-domain.gr`
4. Προσθέστε και: `www.your-domain.gr` (optional)

### DNS Configuration

Στο domain registrar σας (όπου αγοράσατε το .gr domain), προσθέστε:

**Για root domain (your-domain.gr):**
```
Type: A
Name: @
Value: [Render IP - θα το δείτε στο Render dashboard]
TTL: 3600
```

**Για www subdomain (www.your-domain.gr):**
```
Type: CNAME
Name: www
Value: [Render hostname - π.χ. rizopoulos.onrender.com]
TTL: 3600
```

## Βήμα 6: Deploy

1. Το Render θα κάνει auto-deploy
2. Μπορείτε να δείτε τα logs στο Render Dashboard
3. Περιμένετε 2-3 λεπτά για το πρώτο deploy

## Έλεγχος

1. Άνοιγμα: `https://your-domain.gr` (ή το Render URL)
2. Admin panel: `https://your-domain.gr/admin.html`
3. Test upload: Προσθέστε ένα έργο και φωτογραφία

## Troubleshooting

### Uploads δεν αποθηκεύονται
- Ελέγξτε ότι το Persistent Disk είναι mounted
- Ελέγξτε το `UPLOADS_DIR` environment variable

### Database errors
- Ελέγξτε ότι το Persistent Disk είναι mounted
- Ελέγξτε το `DATABASE_PATH` environment variable

### Service sleep
- Upgrade σε Starter Plan ($7/μήνα) για no-sleep

## Cost

- **Free Tier**: Δωρεάν (με sleep)
- **Starter Plan**: $7/μήνα (no sleep)
- **Persistent Disk**: $0.25/GB/μήνα (5GB = $1.25/μήνα)

**Σύνολο**: ~$8-9/μήνα

## Useful Links

- [Render Docs](https://render.com/docs)
- [Render Pricing](https://render.com/pricing)
