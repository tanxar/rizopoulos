# ΡΙΖΟΠΟΥΛΟΣ, ΓΕΩΡΓΙΟΣ, & ΣΙΑ Ο.Ε. - Website

Website για πολιτικό μηχανικό με backend API για διαχείριση έργων.

## Προαπαιτούμενα

- Node.js (v14 ή νεότερη)
- npm ή yarn

## Εγκατάσταση

1. Εγκαταστήστε τις dependencies:
```bash
npm install
```

2. Δημιουργήστε τον φάκελο `uploads` (θα δημιουργηθεί αυτόματα όταν τρέξει ο server):
```bash
mkdir uploads
```

## Εκκίνηση

Για development:
```bash
npm run dev
```

Για production:
```bash
npm start
```

Ο server θα τρέξει στο `http://localhost:3000`

## Χρήση

### Προσθήκη Έργων

1. Μεταβείτε στο `/admin` (ή `admin.html`)
2. Επιλέξτε κατηγορία (Δημόσιο/Ιδιωτικό)
3. Προσθέστε φωτογραφίες (drag & drop ή click)
4. Επεξεργαστείτε τίτλους και κατηγορίες

### Προβολή Έργων

- Αρχική σελίδα: `index.html`
- Σελίδα έργων: `projects.html`
- Φιλτράρισμα: Δημόσια/Ιδιωτικά/Όλα

## API Endpoints

- `GET /api/photos` - Λήψη όλων των φωτογραφιών (query: `?category=public|private`)
- `GET /api/photos/:id` - Λήψη συγκεκριμένης φωτογραφίας
- `POST /api/photos` - Προσθήκη νέας φωτογραφίας (multipart/form-data)
- `PUT /api/photos/:id` - Ενημέρωση φωτογραφίας
- `DELETE /api/photos/:id` - Διαγραφή φωτογραφίας

## Database

Χρησιμοποιεί SQLite (`database.sqlite`). Το database δημιουργείται αυτόματα κατά την πρώτη εκκίνηση.

## File Structure

```
├── server.js          # Express backend server
├── api.js             # Frontend API helper functions
├── admin.html         # Admin panel
├── admin.js           # Admin functionality
├── projects.html      # Projects page
├── script.js          # Main frontend scripts
├── index.html         # Homepage
├── uploads/          # Uploaded photos (auto-created)
└── database.sqlite   # SQLite database (auto-created)
```

## Deployment

Για production deployment:

1. Ορίστε το `PORT` environment variable (default: 3000)
2. Βεβαιωθείτε ότι ο φάκελος `uploads` είναι writable
3. Χρησιμοποιήστε process manager όπως PM2:
```bash
npm install -g pm2
pm2 start server.js --name rizopoulos
```

## Notes

- Μέγιστο μέγεθος αρχείου: 10MB
- Υποστηριζόμενες μορφές: JPEG, JPG, PNG, GIF, WEBP
- Τα αρχεία αποθηκεύονται στον φάκελο `uploads/`
- Το database είναι SQLite (αρχείο `database.sqlite`)
