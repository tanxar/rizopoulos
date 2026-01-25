const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials (use environment variables in production)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Session configuration with SQLite store
const sessionDbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
app.use(session({
    store: new SQLiteStore({
        db: sessionDbPath,
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'rizopoulos-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(cors({
    origin: true,
    credentials: true // Allow cookies
}));
app.use(express.json());
app.use(express.static('.')); // Serve static files

// Authentication middleware for API routes (returns JSON)
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    } else {
        return res.status(401).json({ error: 'Απαιτείται σύνδεση' });
    }
};

// Authentication middleware for HTML routes (redirects to login)
const requireAuthHTML = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    } else {
        return res.redirect('/login');
    }
};

// Create uploads directory if it doesn't exist
// Use persistent disk path if available (Render), otherwise use project directory
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Μόνο αρχεία εικόνας επιτρέπονται!'));
        }
    }
});

// Initialize database
// Use persistent disk path if available (Render), otherwise use project directory
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database schema
function initDatabase() {
    // Create projects table
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'public',
            description TEXT,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating projects table:', err);
        }
    });

    // Create photos table with project_id foreign key
    db.run(`
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            url TEXT NOT NULL,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating photos table:', err);
        } else {
            console.log('Database initialized');
            // Migrate existing photos to a default project if needed
            db.run(`ALTER TABLE photos ADD COLUMN project_id INTEGER`, (err) => {
                // Ignore error if column already exists
            });
        }
    });
}

// API Routes

// ========== PROJECTS API ==========

// GET all projects with photos (public - no auth required)
app.get('/api/projects', (req, res) => {
    const { category } = req.query;
    
    let query = 'SELECT * FROM projects ORDER BY display_order ASC, created_at DESC';
    const params = [];
    
    if (category && category !== 'all') {
        query = 'SELECT * FROM projects WHERE category = ? ORDER BY display_order ASC, created_at DESC';
        params.push(category);
    }
    
    db.all(query, params, (err, projects) => {
        if (err) {
            console.error('Error fetching projects:', err);
            return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση έργων' });
        }
        
        // Get photos for each project
        const projectsWithPhotos = projects.map(project => {
            return new Promise((resolve) => {
                db.all(
                    'SELECT * FROM photos WHERE project_id = ? ORDER BY display_order ASC',
                    [project.id],
                    (err, photos) => {
                        if (err) {
                            console.error('Error fetching photos for project:', err);
                            resolve({ ...project, photos: [] });
                        } else {
                            // Check for duplicate photo IDs
                            const seenIds = new Set();
                            const uniquePhotos = [];
                            photos.forEach(photo => {
                                if (seenIds.has(photo.id)) {
                                    console.warn(`Duplicate photo ID ${photo.id} in project ${project.id}`);
                                    return;
                                }
                                seenIds.add(photo.id);
                                uniquePhotos.push(photo);
                            });
                            
                            const photosWithUrls = uniquePhotos.map(photo => ({
                                id: photo.id,
                                url: photo.url.startsWith('data:') ? photo.url : `/uploads/${photo.filename}`,
                                display_order: photo.display_order || 0,
                                date: photo.created_at
                            }));
                            
                            if (photos.length !== uniquePhotos.length) {
                                console.warn(`Project ${project.id} had ${photos.length} photos but ${uniquePhotos.length} unique`);
                            }
                            
                            resolve({ ...project, photos: photosWithUrls });
                        }
                    }
                );
            });
        });
        
        Promise.all(projectsWithPhotos).then(results => {
            res.json(results);
        });
    });
});

// GET single project with photos
app.get('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM projects WHERE id = ?', [id], (err, project) => {
        if (err) {
            console.error('Error fetching project:', err);
            return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση έργου' });
        }
        
        if (!project) {
            return res.status(404).json({ error: 'Έργο δεν βρέθηκε' });
        }
        
        db.all(
            'SELECT * FROM photos WHERE project_id = ? ORDER BY display_order ASC',
            [id],
            (err, photos) => {
                if (err) {
                    console.error('Error fetching photos:', err);
                    return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση φωτογραφιών' });
                }
                
                const photosWithUrls = photos.map(photo => ({
                    id: photo.id,
                    url: photo.url.startsWith('data:') ? photo.url : `/uploads/${photo.filename}`,
                    display_order: photo.display_order || 0,
                    date: photo.created_at
                }));
                
                res.json({ ...project, photos: photosWithUrls });
            }
        );
    });
});

// POST new project (requires authentication)
app.post('/api/projects', requireAuth, (req, res) => {
    const { title, category, description } = req.body;
    
    // Title is optional - use empty string if not provided
    const projectTitle = title ? title.trim() : '';
    
    db.get('SELECT MAX(display_order) as max_order FROM projects', [], (err, row) => {
        if (err) {
            console.error('Error getting max order:', err);
        }
        
        const displayOrder = (row && row.max_order !== null) ? row.max_order + 1 : 0;
        
        db.run(
            'INSERT INTO projects (title, category, description, display_order) VALUES (?, ?, ?, ?)',
            [projectTitle, category || 'public', description || '', displayOrder],
            function(err) {
                if (err) {
                    console.error('Error inserting project:', err);
                    return res.status(500).json({ error: 'Σφάλμα κατά την αποθήκευση έργου' });
                }
                
                res.json({
                    id: this.lastID,
                    title: projectTitle,
                    category: category || 'public',
                    description: description || '',
                    display_order: displayOrder,
                    photos: [],
                    created_at: new Date().toISOString()
                });
            }
        );
    });
});

// PUT update project order (MUST be before /api/projects/:id to avoid route conflict) (requires authentication)
app.put('/api/projects/order', requireAuth, (req, res) => {
    const { projectIds } = req.body;
    
    if (!Array.isArray(projectIds)) {
        return res.status(400).json({ error: 'Invalid projectIds format' });
    }
    
    if (projectIds.length === 0) {
        return res.status(400).json({ error: 'ProjectIds array is empty' });
    }
    
    // Validate all project IDs are numbers
    const validProjectIds = projectIds.filter(id => {
        const numId = parseInt(id);
        return !isNaN(numId) && numId > 0;
    });
    
    if (validProjectIds.length !== projectIds.length) {
        return res.status(400).json({ error: 'Invalid project ID format' });
    }
    
    // Verify all projects exist
    const placeholders = validProjectIds.map(() => '?').join(',');
    db.all(
        `SELECT id FROM projects WHERE id IN (${placeholders})`,
        validProjectIds,
        (err, rows) => {
            if (err) {
                console.error('Error verifying projects:', err);
                return res.status(500).json({ error: 'Σφάλμα κατά την επαλήθευση έργων' });
            }
            
            if (rows.length !== validProjectIds.length) {
                return res.status(400).json({ error: 'Μερικά έργα δεν βρέθηκαν' });
            }
            
            // Update display_order for each project
            const updates = validProjectIds.map((projectId, index) => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE projects SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [index, projectId],
                        function(err) {
                            if (err) {
                                console.error(`Error updating project ${projectId}:`, err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });
            });
            
            Promise.all(updates)
                .then(() => {
                    res.json({ message: 'Σειρά ενημερώθηκε επιτυχώς' });
                })
                .catch((err) => {
                    console.error('Error updating project order:', err);
                    res.status(500).json({ error: 'Σφάλμα κατά την ενημέρωση σειράς' });
                });
        }
    );
});

// PUT update project (requires authentication)
app.put('/api/projects/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, category, description } = req.body;
    
    // Title is optional - use empty string if not provided
    const projectTitle = title ? title.trim() : '';
    
    db.run(
        'UPDATE projects SET title = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [projectTitle, category || 'public', description || '', id],
        function(err) {
            if (err) {
                console.error('Error updating project:', err);
                return res.status(500).json({ error: 'Σφάλμα κατά την ενημέρωση έργου' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Έργο δεν βρέθηκε' });
            }
            
            // Fetch updated project
            db.get('SELECT * FROM projects WHERE id = ?', [id], (err, project) => {
                if (err) {
                    return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση ενημερωμένου έργου' });
                }
                
                db.all(
                    'SELECT * FROM photos WHERE project_id = ? ORDER BY display_order ASC',
                    [id],
                    (err, photos) => {
                        const photosWithUrls = (photos || []).map(photo => ({
                            id: photo.id,
                            url: photo.url.startsWith('data:') ? photo.url : `/uploads/${photo.filename}`,
                            display_order: photo.display_order || 0,
                            date: photo.created_at
                        }));
                        
                        res.json({ ...project, photos: photosWithUrls });
                    }
                );
            });
        }
    );
});

// DELETE project (requires authentication)
app.delete('/api/projects/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    // Get photos to delete files
    db.all('SELECT filename FROM photos WHERE project_id = ?', [id], (err, photos) => {
        if (err) {
            console.error('Error fetching photos for deletion:', err);
        } else {
            // Delete photo files
            photos.forEach(photo => {
                if (photo.filename) {
                    const filePath = path.join(uploadsDir, photo.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            });
        }
        
        // Delete project (cascade will delete photos)
        db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('Error deleting project:', err);
                return res.status(500).json({ error: 'Σφάλμα κατά τη διαγραφή έργου' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Έργο δεν βρέθηκε' });
            }
            
            res.json({ message: 'Έργο διαγράφηκε επιτυχώς', id: parseInt(id) });
        });
    });
});

// Helper function to optimize image
async function optimizeImage(inputPath, outputPath) {
    try {
        const metadata = await sharp(inputPath).metadata();
        const maxWidth = 1920; // Max width for web
        const maxHeight = 1920; // Max height for web
        const quality = 85; // JPEG quality (0-100)
        
        let width = metadata.width;
        let height = metadata.height;
        
        // Resize if needed while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
            if (width > height) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }
        }
        
        // Optimize and save
        await sharp(inputPath)
            .resize(width, height, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ 
                quality: quality,
                mozjpeg: true // Better compression
            })
            .toFile(outputPath);
        
        // Get file sizes
        const originalSize = fs.statSync(inputPath).size;
        const optimizedSize = fs.statSync(outputPath).size;
        const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
        
        console.log(`Optimized: ${path.basename(inputPath)} - ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(optimizedSize / 1024 / 1024).toFixed(2)}MB (${savings}% reduction)`);
        
        // Replace original with optimized
        fs.unlinkSync(inputPath);
        fs.renameSync(outputPath, inputPath);
        
        return true;
    } catch (error) {
        console.error('Error optimizing image:', error);
        // If optimization fails, keep original
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        return false;
    }
}

// POST add photos to project (requires authentication)
app.post('/api/projects/:id/photos', requireAuth, upload.array('photos', 20), async (req, res) => {
    const { id } = req.params;
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Δεν επιλέχθηκαν αρχεία' });
    }
    
    // Get max display_order for this project
    db.get(
        'SELECT MAX(display_order) as max_order FROM photos WHERE project_id = ?',
        [id],
        async (err, row) => {
            if (err) {
                console.error('Error getting max order:', err);
            }
            
            let displayOrder = (row && row.max_order !== null) ? row.max_order + 1 : 0;
            const photos = [];
            let completed = 0;
            const total = req.files.length;
            
            // Process each file
            for (const file of req.files) {
                try {
                    // Optimize image before saving to database
                    const tempPath = file.path + '.optimized';
                    await optimizeImage(file.path, tempPath);
                    
                    const filename = file.filename;
                    const url = `/uploads/${filename}`;
                    
                    // Insert into database
                    db.run(
                        'INSERT INTO photos (project_id, filename, url, display_order) VALUES (?, ?, ?, ?)',
                        [id, filename, url, displayOrder],
                        function(err) {
                            if (err) {
                                console.error('Error inserting photo:', err);
                                // Delete uploaded file on error
                                if (fs.existsSync(file.path)) {
                                    fs.unlinkSync(file.path);
                                }
                            } else {
                                photos.push({
                                    id: this.lastID,
                                    url: url,
                                    display_order: displayOrder,
                                    date: new Date().toISOString()
                                });
                            }
                            
                            displayOrder++;
                            completed++;
                            
                            if (completed === total) {
                                res.json({ photos, message: `Προστέθηκαν ${photos.length} φωτογραφίες` });
                            }
                        }
                    );
                } catch (error) {
                    console.error('Error processing file:', error);
                    // Delete file on error
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                    completed++;
                    if (completed === total) {
                        res.json({ photos, message: `Προστέθηκαν ${photos.length} φωτογραφίες` });
                    }
                }
            }
        }
    );
});

// PUT update photo order in project (requires authentication)
app.put('/api/projects/:id/photos/order', requireAuth, (req, res) => {
    const { id } = req.params;
    const { photoIds } = req.body;
    
    if (!Array.isArray(photoIds)) {
        return res.status(400).json({ error: 'Invalid photoIds format' });
    }
    
    // Verify all photos belong to this project
    const placeholders = photoIds.map(() => '?').join(',');
    db.all(
        `SELECT id FROM photos WHERE project_id = ? AND id IN (${placeholders})`,
        [id, ...photoIds],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Σφάλμα κατά την επαλήθευση φωτογραφιών' });
            }
            
            if (rows.length !== photoIds.length) {
                return res.status(400).json({ error: 'Μερικές φωτογραφίες δεν ανήκουν σε αυτό το έργο' });
            }
            
            // Update display_order for each photo
            const updates = photoIds.map((photoId, index) => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE photos SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?',
                        [index, photoId, id],
                        function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });
            });
            
            Promise.all(updates)
                .then(() => {
                    res.json({ message: 'Σειρά ενημερώθηκε επιτυχώς' });
                })
                .catch((err) => {
                    console.error('Error updating photo order:', err);
                    res.status(500).json({ error: 'Σφάλμα κατά την ενημέρωση σειράς' });
                });
        }
    );
});

// ========== PHOTOS API (for backward compatibility and direct photo deletion) ==========

// GET all photos
app.get('/api/photos', (req, res) => {
    const { category } = req.query;
    
    let query = 'SELECT * FROM photos ORDER BY display_order ASC, created_at DESC';
    const params = [];
    
    if (category && category !== 'all') {
        query = 'SELECT * FROM photos WHERE category = ? ORDER BY display_order ASC, created_at DESC';
        params.push(category);
    }
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching photos:', err);
            return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση φωτογραφιών' });
        }
        
        // Convert to base64 URLs for compatibility
        const photos = rows.map(photo => ({
            id: photo.id,
            title: photo.title || '',
            category: photo.category || 'public',
            url: photo.url.startsWith('data:') ? photo.url : `/uploads/${photo.filename}`,
            display_order: photo.display_order || 0,
            date: photo.created_at
        }));
        
        res.json(photos);
    });
});

// GET single photo
app.get('/api/photos/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM photos WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching photo:', err);
            return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση φωτογραφίας' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Φωτογραφία δεν βρέθηκε' });
        }
        
        const photo = {
            id: row.id,
            title: row.title || '',
            category: row.category || 'public',
            url: row.url.startsWith('data:') ? row.url : `/uploads/${row.filename}`,
            date: row.created_at
        };
        
        res.json(photo);
    });
});

// POST new photo (requires authentication)
app.post('/api/photos', requireAuth, upload.single('photo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Δεν επιλέχθηκε αρχείο' });
    }
    
    try {
        // Optimize image before saving to database
        const tempPath = req.file.path + '.optimized';
        await optimizeImage(req.file.path, tempPath);
        
        const { title, category } = req.body;
        const filename = req.file.filename;
        const url = `/uploads/${filename}`;
        
        // Get max display_order for the category and add 1
        db.get(
            'SELECT MAX(display_order) as max_order FROM photos WHERE category = ?',
            [category || 'public'],
            (err, row) => {
                if (err) {
                    console.error('Error getting max order:', err);
                }
                
                const displayOrder = (row && row.max_order !== null) ? row.max_order + 1 : 0;
                
                db.run(
                    'INSERT INTO photos (title, category, filename, url, display_order) VALUES (?, ?, ?, ?, ?)',
                    [title || '', category || 'public', filename, url, displayOrder],
                    function(err) {
                        if (err) {
                            console.error('Error inserting photo:', err);
                            // Delete uploaded file on error
                            if (fs.existsSync(req.file.path)) {
                                fs.unlinkSync(req.file.path);
                            }
                            return res.status(500).json({ error: 'Σφάλμα κατά την αποθήκευση φωτογραφίας' });
                        }
                        
                        res.json({
                            id: this.lastID,
                            title: title || '',
                            category: category || 'public',
                            url: url,
                            display_order: displayOrder,
                            date: new Date().toISOString()
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Error processing photo:', error);
        // Delete file on error
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({ error: 'Σφάλμα κατά την επεξεργασία φωτογραφίας' });
    }
});

// PUT update photo (requires authentication)
app.put('/api/photos/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, category } = req.body;
    
    db.run(
        'UPDATE photos SET title = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title || '', category || 'public', id],
        function(err) {
            if (err) {
                console.error('Error updating photo:', err);
                return res.status(500).json({ error: 'Σφάλμα κατά την ενημέρωση φωτογραφίας' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Φωτογραφία δεν βρέθηκε' });
            }
            
            // Fetch updated photo
            db.get('SELECT * FROM photos WHERE id = ?', [id], (err, row) => {
                if (err) {
                    return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση ενημερωμένης φωτογραφίας' });
                }
                
                const photo = {
                    id: row.id,
                    title: row.title || '',
                    category: row.category || 'public',
                    url: row.url.startsWith('data:') ? row.url : `/uploads/${row.filename}`,
                    date: row.updated_at
                };
                
                res.json(photo);
            });
        }
    );
});

// PUT update photo order (requires authentication)
app.put('/api/photos/order', requireAuth, (req, res) => {
    const { photoIds } = req.body;
    
    if (!Array.isArray(photoIds)) {
        return res.status(400).json({ error: 'Invalid photoIds format' });
    }
    
    // Update display_order for each photo
    const updates = photoIds.map((photoId, index) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE photos SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [index, photoId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    });
    
    Promise.all(updates)
        .then(() => {
            res.json({ message: 'Σειρά ενημερώθηκε επιτυχώς' });
        })
        .catch((err) => {
            console.error('Error updating photo order:', err);
            res.status(500).json({ error: 'Σφάλμα κατά την ενημέρωση σειράς' });
        });
});

// DELETE photo (requires authentication)
app.delete('/api/photos/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    
    // First get the photo to delete the file
    db.get('SELECT filename FROM photos WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching photo for deletion:', err);
            return res.status(500).json({ error: 'Σφάλμα κατά την ανάκτηση φωτογραφίας' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Φωτογραφία δεν βρέθηκε' });
        }
        
        // Delete from database
        db.run('DELETE FROM photos WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('Error deleting photo:', err);
                return res.status(500).json({ error: 'Σφάλμα κατά τη διαγραφή φωτογραφίας' });
            }
            
            // Delete file
            const filePath = path.join(uploadsDir, row.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            res.json({ message: 'Φωτογραφία διαγράφηκε επιτυχώς', id: parseInt(id) });
        });
    });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// ========== AUTHENTICATION API ==========

// POST login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        req.session.username = username;
        res.json({ message: 'Επιτυχής σύνδεση', username: username });
    } else {
        res.status(401).json({ error: 'Λάθος όνομα χρήστη ή κωδικός' });
    }
});

// POST logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Σφάλμα κατά την αποσύνδεση' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Επιτυχής αποσύνδεση' });
    });
});

// GET check authentication status
app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.json({ isAuthenticated: true, username: req.session.username });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Routes for HTML files without extension
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/projects', (req, res) => {
    res.sendFile(path.join(__dirname, 'projects.html'));
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
