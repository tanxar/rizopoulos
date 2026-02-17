// Global state
let currentPhotoIndex = 0;
let allPhotos = [];
let currentProjectPhotos = []; // All photos from the currently opened project
let currentProjectId = null;
let globalSetActiveFromScroll = null; // Global function to update active section

// Initialize
let isInitialized = false;
document.addEventListener('DOMContentLoaded', function() {
    if (isInitialized) {
        console.warn('DOMContentLoaded called multiple times, skipping...');
        return; // Prevent double initialization
    }
    isInitialized = true;
    console.log('Initializing page...');
    
    initNavigation();
    initPhotoGallery();
    initContactForm();
    initModal();
    initStatistics();
    initScrollAnimations();
    initProjectFilters();
    initHeroSlideshow();
    // Clean look: no 3D/tilt mouse effects
});

// Navigation
function initNavigation() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const overlay = document.getElementById('mobileMenuOverlay');
    
    const toggleMenu = () => {
        const isActive = navMenu.classList.contains('active');
        
        if (isActive) {
            // Close menu
            navMenu.classList.remove('active');
            mobileToggle?.classList.remove('active');
            overlay?.classList.remove('active');
            document.body.classList.remove('menu-open');
        } else {
            // Open menu - no need to update active state for mobile
            navMenu.classList.add('active');
            mobileToggle?.classList.add('active');
            overlay?.classList.add('active');
            document.body.classList.add('menu-open');
        }
    };
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMenu);
    }
    
    if (overlay) {
        overlay.addEventListener('click', toggleMenu);
    }
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu?.classList.contains('active')) {
            navMenu.classList.remove('active');
            mobileToggle?.classList.remove('active');
            overlay?.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });

    // Handle navigation links in mobile menu
    if (navMenu) {
        navMenu.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href) return;
            
            // Close menu immediately for all links
            navMenu.classList.remove('active');
            mobileToggle?.classList.remove('active');
            overlay?.classList.remove('active');
            document.body.classList.remove('menu-open');
            
            // For anchor links (#), handle smooth scroll
            if (href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    // Small delay to allow menu to start closing
                    setTimeout(() => {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                        // Update active state
                        document.querySelectorAll('.nav-menu a[href^="#"]').forEach(l => l.removeAttribute('aria-current'));
                        link.setAttribute('aria-current', 'page');
                    }, 100);
                }
            }
            // For external links (like projects.html), let the browser navigate normally - no preventDefault
        });
    }
    
    // Handle smooth scroll for anchor links outside mobile menu (desktop)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        // Skip if already handled by mobile menu listener
        if (anchor.closest('.nav-menu')) return;
        
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // After smooth scroll completes, update active state
                // This ensures scroll spy works correctly after clicking
                setTimeout(() => {
                    if (globalSetActiveFromScroll) {
                        globalSetActiveFromScroll();
                    }
                }, 500);
            }
        });
    });

    // Navbar scroll state (use class instead of inline styles)
    const navbar = document.querySelector('.navbar');
    const onScroll = () => {
        if (!navbar) return;
        navbar.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Active section highlight (scroll spy)
    initActiveSectionObserver();
}

function initActiveSectionObserver() {
    const navLinks = Array.from(document.querySelectorAll('.nav-menu a[href^="#"]'));
    if (navLinks.length === 0) return;

    const linkById = new Map();
    const sections = [];

    navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const id = href.startsWith('#') ? href.slice(1) : '';
        if (!id) return;
        const section = document.getElementById(id);
        if (!section) return;
        linkById.set(id, link);
        sections.push(section);
    });

    const setActive = (id) => {
        // ALWAYS remove active state from all links FIRST
        navLinks.forEach(l => {
            l.removeAttribute('aria-current');
        });
        
        if (!id) {
            return;
        }
        
        // Set active state on the current link
        const activeLink = linkById.get(id);
        if (activeLink) {
            activeLink.setAttribute('aria-current', 'page');
            // Force immediate CSS update
            void activeLink.offsetHeight;
        }
    };

    const setActiveFromScroll = () => {
        // Pick the section closest to the top (after navbar)
        const offset = 120;
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        
        // If we've scrolled past 100px, never consider home section
        const isScrolledPastTop = window.scrollY > 100;

        // Find the section that's closest to the offset point
        sections.forEach(section => {
            if (!section || !section.id) return;
            
            const rect = section.getBoundingClientRect();
            
            // Special handling for contact section - make it easier to activate
            if (section.id === 'contact') {
                // If contact section is in viewport or near bottom of page
                if (rect.top <= window.innerHeight && rect.bottom > 0) {
                    // If we're near the bottom of the page or contact is visible
                    const distanceFromTop = rect.top;
                    
                    // Activate if contact is visible and we're scrolled far enough
                    if (distanceFromTop < window.innerHeight * 0.7 || 
                        (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 100) {
                        const dist = Math.abs(rect.top - offset);
                        if (dist < bestDist) {
                            bestDist = dist;
                            best = section;
                        }
                    }
                }
                // Continue checking other sections
                return;
            }
            
            // Check if section is in viewport or just above/below
            const isVisible = rect.bottom > 0 && rect.top < window.innerHeight + 300;
            
            if (isVisible) {
                // Calculate distance from the offset point (navbar height)
                // Prefer sections that are at or past the offset point
                let dist;
                
                // Special handling for home section - only activate if we're at the very top
                if (section.id === 'home') {
                    // NEVER consider home if we've scrolled past 100px
                    if (isScrolledPastTop) {
                        return;
                    }
                    // Only consider home if we're VERY close to the top of the page (less than 50px)
                    // This prevents home from staying active when scrolled to other sections
                    if (window.scrollY < 50 && rect.top >= 0 && rect.top <= offset + 30) {
                        dist = Math.abs(rect.top - offset);
                    } else {
                        // Skip home if we've scrolled past 50px
                        return;
                    }
                } else {
                    // For non-home sections, consider them if they're:
                    // 1. At or past the offset point (preferred)
                    // 2. Or approaching the offset point (within 200px above)
                    // This ensures we always have an active section when scrolling
                if (rect.top <= offset + 100) {
                    // Section is at or past the offset - this is what we want
                    dist = Math.abs(rect.top - offset);
                    } else if (rect.top > offset + 100 && rect.top < offset + 200 && isScrolledPastTop) {
                        // Section is approaching the offset - use it if we've scrolled past top
                        // This prevents gaps between sections
                        dist = Math.abs(rect.top - offset) + 50; // Add penalty for being above offset
                } else {
                    // Section is way above the offset - skip it
                    return;
                    }
                }
                
                if (dist < bestDist) {
                    bestDist = dist;
                    best = section;
                }
            }
        });

        // Set active if we found a section
        // setActive will handle clearing previous states
        if (best && best.id) {
            // If we found a section, set it as active
            // This will clear home if it was previously active
            setActive(best.id);
        } else if (window.scrollY < 50 && linkById.has('home')) {
            // Only set home if we're at the VERY top (less than 50px) AND no other section was found
            // This prevents home from staying active when we scroll down
            setActive('home');
        } else if (isScrolledPastTop) {
            // If we've scrolled past top and no section was found, try to find the closest section
            // This prevents gaps between sections
            let closestSection = null;
            let closestDist = Number.POSITIVE_INFINITY;
            
            sections.forEach(section => {
                if (!section || !section.id || section.id === 'home' || section.id === 'contact') return;
                
                const rect = section.getBoundingClientRect();
                // Consider sections that are visible or approaching
                if (rect.bottom > 0 && rect.top < window.innerHeight + 500) {
                    const dist = Math.abs(rect.top - offset);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestSection = section;
                    }
                }
            });
            
            if (closestSection && closestSection.id) {
                setActive(closestSection.id);
            } else {
                setActive(null);
            }
        } else {
            // If no section was found and we're scrolled past 50px, ALWAYS clear active state
            // This is critical to prevent home from staying active when scrolled
            setActive(null);
        }
    };
    
    // Make setActiveFromScroll globally accessible
    globalSetActiveFromScroll = setActiveFromScroll;

    // IntersectionObserver for stable “active” state as you scroll.
    // IntersectionObserver disabled - using scroll listener only for better control
    // The observer was causing conflicts with the scroll-based detection
    
    // Use scroll listener as primary method for better control
    window.addEventListener('scroll', setActiveFromScroll, { passive: true });

    // Ensure a correct initial state
    setActiveFromScroll();

    // If user navigates via hash (or clicks), set it temporarily
    // But scroll will override it immediately on next scroll event
    window.addEventListener('hashchange', () => {
        const id = (location.hash || '').replace('#', '');
        if (id && linkById.has(id)) {
            setActive(id);
            // Immediately let scroll take over to prevent stuck active state
            requestAnimationFrame(() => {
                setActiveFromScroll();
            });
        }
    });
}

// Photo Gallery
let currentFilter = 'all';
let galleryInitialized = false;
// allPhotos is already declared at the top of the file

async function initPhotoGallery() {
    if (galleryInitialized) {
        console.log('Gallery already initialized, skipping...');
        return;
    }
    
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    galleryInitialized = true;
    console.log('Initializing photo gallery...');

    // Check if server is accessible
    if (window.location.protocol === 'file:') {
        try {
            const testResponse = await fetch('http://localhost:3000/api/projects', { 
                method: 'HEAD',
                mode: 'no-cors' 
            });
        } catch (e) {
            // CORS will fail but that's ok, we'll try the actual request
        }
    }

    try {
        // Always load all photos initially, then filter client-side
        const loadedPhotos = await getPhotosFromAPI('all');
        
        // Remove duplicates using Map for guaranteed uniqueness
        const photosMap = new Map();
        loadedPhotos.forEach(photo => {
            if (!photosMap.has(photo.id)) {
                photosMap.set(photo.id, photo);
            }
        });
        
        // Clear and set allPhotos atomically
        allPhotos = Array.from(photosMap.values());
        
        // Render once
        renderPhotos(currentFilter);
    } catch (error) {
        console.error('Error loading photos:', error);
        galleryInitialized = false; // Reset on error so it can retry
        const grid = document.getElementById('projectsGrid');
        if (grid) {
            let errorMsg = 'Σφάλμα κατά τη φόρτωση των φωτογραφιών.';
            let helpMsg = '';
            
            if (window.location.protocol === 'file:') {
                errorMsg = 'Παρακαλώ ανοίξτε τη σελίδα μέσω του server.';
                helpMsg = '<p><strong>Οδηγίες:</strong></p><ol style="text-align: left; max-width: 500px; margin: 1rem auto;"><li>Βεβαιωθείτε ότι ο server τρέχει: <code>node server.js</code></li><li>Ανοίξτε: <a href="http://localhost:3000/projects" style="color: var(--site-accent); font-weight: 600;">http://localhost:3000/projects</a></li></ol>';
            } else if (error.message && error.message.includes('Failed to fetch')) {
                errorMsg = 'Δεν μπορεί να συνδεθεί στον server.';
                helpMsg = '<p>Βεβαιωθείτε ότι ο server τρέχει στο <code>http://localhost:3000</code></p>';
            }
            
            grid.innerHTML = `
                <div class="project-placeholder">
                    <p>${errorMsg}</p>
                    ${helpMsg}
                </div>
            `;
        }
    }
}

let isRendering = false;

function renderPhotos(filter = 'all') {
    // Prevent concurrent renders
    if (isRendering) {
        return;
    }
    
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;
    
    isRendering = true;
    
    // COMPLETELY CLEAR THE GRID FIRST - use innerHTML for atomic clear
    grid.innerHTML = '';
    
    if (allPhotos.length === 0) {
        grid.innerHTML = '';
        isRendering = false;
        return;
    }

    // Filter photos by category
    let filteredPhotos = allPhotos;
    if (filter !== 'all') {
        filteredPhotos = allPhotos.filter(photo => {
            const photoCategory = (photo.category || 'public').toLowerCase();
            const filterLower = filter.toLowerCase();
            return photoCategory === filterLower;
        });
    }

    if (filteredPhotos.length === 0) {
        grid.innerHTML = '';
        isRendering = false;
        return;
    }

    // Remove duplicates using Map - guaranteed unique by ID
    const uniquePhotosMap = new Map();
    filteredPhotos.forEach(photo => {
        if (photo.id && !uniquePhotosMap.has(photo.id)) {
            uniquePhotosMap.set(photo.id, photo);
        }
    });
    
    const uniquePhotos = Array.from(uniquePhotosMap.values());
    
    // Build HTML string atomically - one item per project
    const htmlParts = uniquePhotos.map((photo, index) => {
        const originalIndex = allPhotos.findIndex(p => p.id === photo.id);
        const photoIndex = originalIndex >= 0 ? originalIndex : index;
        
        // Build absolute URL
        let photoUrl = photo.url || '';
        if (photoUrl && photoUrl.startsWith('/')) {
            if (window.location.protocol === 'file:') {
                photoUrl = `http://localhost:3000${photoUrl}`;
            } else {
                photoUrl = `${window.location.origin}${photoUrl}`;
            }
        }
        
        const category = (photo.category || 'public').replace(/"/g, '&quot;');
        const title = (photo.title || '').trim();
        const titleEscaped = title ? title.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
        const photoId = photo.id || `photo-${index}`;
        const altText = title || 'Έργο';
        
        return `<div class="project-item" data-index="${photoIndex}" data-category="${category}" data-photo-id="${photoId}" data-project-id="${photo.projectId || ''}"><img src="${photoUrl}" alt="${altText}" loading="lazy" onerror="this.style.display='none';"><div class="project-caption">${titleEscaped}</div></div>`;
    });
    
    // Set innerHTML atomically - this replaces everything at once
    grid.innerHTML = htmlParts.join('');
    
    // Re-attach click handlers after DOM is updated
    grid.querySelectorAll('.project-item').forEach((item) => {
        const photoIndex = parseInt(item.getAttribute('data-index')) || 0;
        item.addEventListener('click', () => openModal(photoIndex));
    });
    
    isRendering = false;
}

// createPhotoElement is no longer used - we use innerHTML for atomic updates
// Keeping for backward compatibility but it won't be called
function createPhotoElement(photo, index) {
    const item = document.createElement('div');
    item.className = 'project-item';
    item.setAttribute('data-index', index);
    item.setAttribute('data-photo-id', photo.id);
    
    const img = document.createElement('img');
    let photoUrl = photo.url;
    if (photoUrl && photoUrl.startsWith('/')) {
        if (window.location.protocol === 'file:') {
            photoUrl = `http://localhost:3000${photoUrl}`;
        } else {
            photoUrl = `${window.location.origin}${photoUrl}`;
        }
    }
    img.src = photoUrl;
    img.alt = (photo.title || '').trim() || 'Έργο';
    img.loading = 'lazy';
    
    img.onerror = function() {
        console.error('Failed to load image:', photoUrl);
        this.style.display = 'none';
    };
    
    const caption = document.createElement('div');
    caption.className = 'project-caption';
    const title = (photo.title || '').trim();
    caption.textContent = title; // Empty string if no title

    item.addEventListener('click', () => openModal(index));
    
    item.appendChild(img);
    item.appendChild(caption);
    return item;
}

// getPhotos function removed - now using getPhotosFromAPI from api.js

// Modal
function initModal() {
    const modal = document.getElementById('photoModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.modal-close');
    const prevBtn = document.getElementById('modalPrev');
    const nextBtn = document.getElementById('modalNext');
    const modalImg = document.getElementById('modalImage');
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateModal(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateModal(1));
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-content')) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (modal.style.display !== 'block') return;
        
        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'ArrowLeft') {
            navigateModal(-1);
        } else if (e.key === 'ArrowRight') {
            navigateModal(1);
        }
    });
    
    // Enhanced swipe gestures for mobile - works on entire modal
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    let touchStartTime = 0;
    let isSwiping = false;
    let hasMoved = false;
    
    const handleTouchStart = (e) => {
        if (modal.style.display !== 'block') return;
        const touch = e.touches[0] || e.changedTouches[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        isSwiping = false;
        hasMoved = false;
    };
    
    const handleTouchMove = (e) => {
        if (modal.style.display !== 'block') return;
        const touch = e.touches[0];
        if (!touch) return;
        
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        
        // Only prevent default if it's clearly a horizontal swipe
        if (!hasMoved && deltaX > 10 && deltaX > deltaY * 1.5) {
            isSwiping = true;
            hasMoved = true;
            // Only prevent default if event is cancelable
            if (e.cancelable) {
                e.preventDefault();
            }
        }
    };
    
    const handleTouchEnd = (e) => {
        if (modal.style.display !== 'block') return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        
        touchEndX = touch.clientX;
        touchEndY = touch.clientY;
        const touchDuration = Date.now() - touchStartTime;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const minSwipeDistance = 50;
        const maxSwipeTime = 500; // Max 500ms for a swipe
        
        // Only trigger if:
        // 1. Horizontal swipe is greater than vertical
        // 2. Swipe distance is sufficient
        // 3. Swipe is fast enough (not a slow drag)
        // 4. We detected swiping during move OR it's a clear horizontal swipe
        if ((isSwiping || (Math.abs(deltaX) > Math.abs(deltaY) * 1.5)) && 
            Math.abs(deltaX) > minSwipeDistance && 
            touchDuration < maxSwipeTime) {
            
            if (deltaX > 0) {
                // Swipe right - previous photo
                navigateModal(-1);
            } else {
                // Swipe left - next photo
                navigateModal(1);
            }
        }
        
        isSwiping = false;
        hasMoved = false;
    };
    
    // Add event listeners to modal (not just image) for better touch area
    // Use passive: true for start/end, and only make move non-passive if needed
    modal.addEventListener('touchstart', handleTouchStart, { passive: true });
    modal.addEventListener('touchmove', handleTouchMove, { passive: false });
    modal.addEventListener('touchend', handleTouchEnd, { passive: true });
}

async function openModal(index) {
    if (allPhotos.length === 0) return;
    
    const clickedPhoto = allPhotos[index];
    const projectId = clickedPhoto.projectId;
    
    if (!projectId) {
        console.error('No projectId found for photo');
        return;
    }
    
    // Load all photos from this project
    try {
        const project = await getProjectFromAPI(projectId);
        if (!project || !project.photos || project.photos.length === 0) {
            console.error('No photos found for project');
            return;
        }
        
        // Store all photos from this project
        currentProjectPhotos = project.photos.map(photo => ({
            ...photo,
            title: project.title || '',
            category: project.category || 'public',
            projectId: project.id
        }));
        
        currentProjectId = projectId;
        currentPhotoIndex = 0; // Start with first photo of the project
        
        // Show modal with first photo
        showModalPhoto(0);
    } catch (error) {
        console.error('Error loading project photos:', error);
        return;
    }
}

function showModalPhoto(photoIndex) {
    if (currentProjectPhotos.length === 0) return;
    
    const modal = document.getElementById('photoModal');
    const modalImg = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');
    const prevBtn = document.getElementById('modalPrev');
    const nextBtn = document.getElementById('modalNext');
    
    if (!modal || !modalImg) return;
    
    const photo = currentProjectPhotos[photoIndex];
    currentPhotoIndex = photoIndex;
    
    // Ensure URL is absolute
    let photoUrl = photo.url;
    if (photoUrl && photoUrl.startsWith('/')) {
        if (window.location.protocol === 'file:') {
            photoUrl = `http://localhost:3000${photoUrl}`;
        } else {
            photoUrl = `${window.location.origin}${photoUrl}`;
        }
    }
    
    modal.style.display = 'block';
    
    // Add fade transition
    modalImg.style.transition = 'opacity 0.2s ease-out';
    modalImg.style.opacity = '0';
    
    modalImg.onerror = () => {
        console.error('Failed to load modal image:', photoUrl);
        modalImg.style.opacity = '0';
    };
    
    modalImg.onload = () => {
        modalImg.style.opacity = '1';
    };
    
    // Set src after setting opacity for smooth transition
    modalImg.src = photoUrl;
    
    if (modalCaption) {
        const title = (photo.title || '').trim();
        modalCaption.textContent = title; // Empty string if no title
        // Hide caption if empty
        if (title) {
            modalCaption.style.display = 'block';
        } else {
            modalCaption.style.display = 'none';
        }
    }
    
    // Show/hide navigation buttons based on project photos count
    if (prevBtn) prevBtn.style.display = currentProjectPhotos.length > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = currentProjectPhotos.length > 1 ? 'flex' : 'none';
    
    // Update counter
    updateModalCounter();
    
    document.body.style.overflow = 'hidden';
}

function updateModalCounter() {
    const counter = document.getElementById('modalCounter');
    if (!counter || currentProjectPhotos.length === 0) {
        if (counter) counter.style.display = 'none';
        return;
    }
    
    const currentSpan = counter.querySelector('.counter-current');
    const totalSpan = counter.querySelector('.counter-total');
    
    if (currentSpan && totalSpan) {
        currentSpan.textContent = currentPhotoIndex + 1;
        totalSpan.textContent = currentProjectPhotos.length;
        counter.style.display = 'flex';
    }
}

function navigateModal(direction) {
    if (currentProjectPhotos.length === 0) return;
    
    let newIndex = currentPhotoIndex + direction;
    
    if (newIndex < 0) {
        newIndex = currentProjectPhotos.length - 1;
    } else if (newIndex >= currentProjectPhotos.length) {
        newIndex = 0;
    }
    
    showModalPhoto(newIndex);
}

function closeModal() {
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    // Clear project photos when closing
    currentProjectPhotos = [];
    currentProjectId = null;
    currentPhotoIndex = 0;
}

// Contact Form
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    // Real-time validation
    const inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        // Validate all fields
        let isValid = true;
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        if (!isValid) {
            showToast('Παρακαλώ συμπληρώστε σωστά όλα τα πεδία.', 'error');
            return;
        }

        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            message: document.getElementById('message').value.trim()
        };

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span> Αποστολή...';

        // Simulate API call
        setTimeout(() => {
            // Here you would normally send to a server
            showToast('Ευχαριστούμε για το μήνυμά σας! Θα επικοινωνήσουμε μαζί σας σύντομα.', 'success');
            form.reset();
            inputs.forEach(input => input.classList.remove('error'));
            
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }, 1500);
    });
}

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Remove previous error
    field.classList.remove('error');
    const existingError = field.parentElement.querySelector('.error-message');
    if (existingError) existingError.remove();

    // Validation rules
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'Αυτό το πεδίο είναι υποχρεωτικό.';
    } else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        isValid = false;
        errorMessage = 'Παρακαλώ εισάγετε έγκυρο email.';
    } else if (field.type === 'tel' && value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
        isValid = false;
        errorMessage = 'Παρακαλώ εισάγετε έγκυρο τηλέφωνο.';
    }

    if (!isValid) {
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        field.parentElement.appendChild(errorDiv);
    }

    return isValid;
}

// Statistics Counter Animation
function initStatistics() {
    const stats = document.querySelectorAll('.stat-number');
    if (stats.length === 0) return;

    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                animateCounter(entry.target);
            }
        });
    }, observerOptions);

    stats.forEach(stat => observer.observe(stat));
}

function animateCounter(element) {
    const rawTarget = (element.getAttribute('data-target') || '0').trim();
    const target = parseInt(rawTarget.replace(/[^\d]/g, ''), 10) || 0;
    const suffix = element.getAttribute('data-suffix') || '';
    
    // Faster animation on mobile devices
    const isMobile = window.innerWidth <= 768;
    const duration = isMobile ? 1000 : 2000;
    
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out cubic) for smoother animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(target * easeOut);
        
        element.textContent = `${current}${suffix}`;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = `${target}${suffix}`;
        }
    };

    requestAnimationFrame(updateCounter);
}

// Scroll Animations
function initScrollAnimations() {
    const elements = document.querySelectorAll('.feature, .service-card, .contact-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    elements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

// Project Filters
let filtersInitialized = false;
function initProjectFilters() {
    if (filtersInitialized) {
        console.log('Filters already initialized, skipping...');
        return; // Prevent double initialization
    }
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (filterButtons.length === 0) return;
    
    filtersInitialized = true;
    console.log('Initializing project filters...');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const filter = btn.getAttribute('data-filter');
            console.log('Filter clicked:', filter);
            
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update filter and render
            currentFilter = filter;
            renderPhotos(filter);
        });
    });
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Mouse tilt effects intentionally removed for a cleaner UI.

// Hero Slideshow
let heroSlideshowInterval = null;
let currentHeroSlide = 0;
let heroSlides = [];

async function initHeroSlideshow() {
    const container = document.getElementById('heroSlideshowContainer');
    const indicators = document.getElementById('heroSlideshowIndicators');
    
    if (!container || !indicators) {
        console.log('Hero slideshow containers not found');
        return;
    }
    
    // Check if getProjectsFromAPI is available
    if (typeof getProjectsFromAPI === 'undefined') {
        console.error('getProjectsFromAPI is not defined. Make sure api.js is loaded before script.js');
        return;
    }
    
    try {
        console.log('Loading projects for hero slideshow...');
        // Fetch all projects with photos
        const projects = await getProjectsFromAPI('all');
        console.log('Projects loaded:', projects.length);
        
        // Collect all photos from all projects
        heroSlides = [];
        projects.forEach(project => {
            if (project.photos && project.photos.length > 0) {
                project.photos.forEach(photo => {
                    heroSlides.push({
                        url: photo.url,
                        title: project.title || '',
                        projectId: project.id
                    });
                });
            }
        });
        
        // If no photos, use a dark gradient background
        if (heroSlides.length === 0) {
            console.log('No photos found for hero slideshow');
            // Hide slideshow if no photos
            const slideshow = document.getElementById('heroSlideshow');
            if (slideshow) {
                slideshow.style.display = 'none';
            }
            // Add dark gradient background to hero section
            const heroSection = document.querySelector('.hero');
            if (heroSection) {
                heroSection.classList.add('no-projects');
            }
            return;
        }
        
        // Remove no-projects class if photos exist
        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            heroSection.classList.remove('no-projects');
        }
        
        console.log('Total slides collected:', heroSlides.length);
        
        // Limit to max 10 slides for performance
        if (heroSlides.length > 10) {
            heroSlides = heroSlides.slice(0, 10);
        }
        
        // Create slides
        container.innerHTML = '';
        indicators.innerHTML = '';
        
        heroSlides.forEach((slide, index) => {
            // Create slide element
            const slideEl = document.createElement('div');
            slideEl.className = 'hero-slide';
            if (index === 0) slideEl.classList.add('active');
            
            const img = document.createElement('img');
            img.src = slide.url;
            img.alt = slide.title || 'Project photo';
            img.loading = index === 0 ? 'eager' : 'lazy';
            
            // Handle image load errors
            img.onerror = function() {
                console.error('Failed to load image:', slide.url);
                this.style.display = 'none';
            };
            
            slideEl.appendChild(img);
            container.appendChild(slideEl);
        });
        
        console.log('Slideshow initialized with', heroSlides.length, 'slides');
        
        // Start auto-play
        startHeroSlideshow();
        
        // Pause on hover
        const slideshow = document.getElementById('heroSlideshow');
        if (slideshow) {
            slideshow.addEventListener('mouseenter', pauseHeroSlideshow);
            slideshow.addEventListener('mouseleave', startHeroSlideshow);
        }
        
    } catch (error) {
        console.error('Error initializing hero slideshow:', error);
        // Hide slideshow on error
        const slideshow = document.getElementById('heroSlideshow');
        if (slideshow) {
            slideshow.style.display = 'none';
        }
    }
}

function startHeroSlideshow() {
    if (heroSlideshowInterval) {
        clearInterval(heroSlideshowInterval);
    }
    
    if (heroSlides.length <= 1) return;
    
    heroSlideshowInterval = setInterval(() => {
        nextHeroSlide();
    }, 5000); // Change slide every 5 seconds
}

function pauseHeroSlideshow() {
    if (heroSlideshowInterval) {
        clearInterval(heroSlideshowInterval);
        heroSlideshowInterval = null;
    }
}

function nextHeroSlide() {
    currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
    goToSlide(currentHeroSlide);
}

function goToSlide(index) {
    if (index < 0 || index >= heroSlides.length) return;
    
    currentHeroSlide = index;
    
    // Update slides
    const slides = document.querySelectorAll('.hero-slide');
    slides.forEach((slide, i) => {
        if (i === index) {
            slide.classList.add('active');
        } else {
            slide.classList.remove('active');
        }
    });
    
    // Restart auto-play
    pauseHeroSlideshow();
    startHeroSlideshow();
}

// Export functions if needed
if (typeof window !== 'undefined') {
    // Functions are now in api.js
}
