// Admin Project Management
let allProjects = [];
let currentEditProjectId = null;
let currentPhotoUploadProjectId = null;
let isDraggingPhoto = false;
let mouseMovedDuringDrag = false;
let lastDragEndTime = 0;

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (!data.isAuthenticated) {
            // Not authenticated - redirect to login
            window.location.href = '/login';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking auth:', error);
        window.location.href = '/login';
        return false;
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/login';
        } else {
            console.error('Logout failed');
        }
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin page loaded');
    
    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return; // Will redirect to login
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    initProjectModal();
    initPhotoUploadModal();
    loadProjects();
    
    // Add project button
    const addProjectBtn = document.getElementById('addProjectBtn');
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            openProjectModal();
        });
    } else {
        console.error('Add project button not found!');
    }
    
    // Global listener to prevent collapse during photo drag - MUST be in capture phase
    // This runs FIRST and stops ALL collapse events during drag
    document.addEventListener('click', function(e) {
        const collapseBtn = e.target.closest('.collapse-toggle-btn');
        if (collapseBtn) {
            const card = collapseBtn.closest('.project-card');
            
            if (card) {
                const photosContainer = card.querySelector('.project-photos-grid');
                const timeSinceDragEnd = Date.now() - lastDragEndTime;
                
                // ABSOLUTE CHECKS - if ANY of these are true, STOP the event completely
                if (isDraggingPhoto ||
                    mouseMovedDuringDrag ||
                    timeSinceDragEnd < 3000 || // Prevent collapse for 3 seconds after drag
                    document.body.getAttribute('data-dragging-photo') === 'true' ||
                    card.classList.contains('dragging-photo') ||
                    document.body.classList.contains('dragging-photo') ||
                    collapseBtn.getAttribute('data-dragging') === 'true' ||
                    collapseBtn.hasAttribute('disabled') ||
                    collapseBtn.style.display === 'none' ||
                    collapseBtn.style.visibility === 'hidden' ||
                    collapseBtn.style.pointerEvents === 'none' ||
                    collapseBtn.style.opacity === '0' ||
                    (photosContainer && photosContainer.classList.contains('sortable-active'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }
        }
    }, true); // Capture phase - runs BEFORE all other listeners
});

// Update Statistics
function updateStatistics() {
    const totalProjects = allProjects.length;
    const totalPhotos = allProjects.reduce((sum, project) => sum + (project.photos ? project.photos.length : 0), 0);
    const publicProjects = allProjects.filter(p => p.category === 'public').length;
    const privateProjects = allProjects.filter(p => p.category === 'private').length;
    
    // Animate numbers
    animateValue('totalProjects', 0, totalProjects, 500);
    animateValue('totalPhotos', 0, totalPhotos, 500);
    animateValue('publicProjects', 0, publicProjects, 500);
    animateValue('privateProjects', 0, privateProjects, 500);
}

function animateValue(elementId, start, end, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startTime = performance.now();
    const range = end - start;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + range * easeOut);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end;
        }
    }
    
    requestAnimationFrame(update);
}

// Load Projects
async function loadProjects() {
    try {
        const response = await fetch(`${window.location.origin}/api/projects`);
        if (!response.ok) throw new Error('Failed to load projects');
        allProjects = await response.json();
        updateStatistics();
        renderProjects();
    } catch (error) {
        console.error('Error loading projects:', error);
        showToast('Σφάλμα κατά τη φόρτωση των έργων.', 'error');
        allProjects = [];
        updateStatistics();
        renderProjects();
    }
}

// Store expanded project IDs to restore after reload
let expandedProjectIds = new Set();

// Render Projects
function renderProjects() {
    const list = document.getElementById('projectsList');
    if (!list) {
        console.error('Projects list element not found!');
        return;
    }

    // Save current expanded state before clearing
    if (list.children.length > 0) {
        expandedProjectIds.clear();
        Array.from(list.children).forEach(card => {
            if (card.classList.contains('project-card') && !card.classList.contains('collapsed')) {
                const projectId = card.getAttribute('data-project-id');
                if (projectId) {
                    expandedProjectIds.add(parseInt(projectId));
                }
            }
        });
    }

    if (allProjects.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                </div>
                <p>Δεν υπάρχουν έργα ακόμα</p>
                <p style="font-size: 0.9375rem; font-weight: 400; color: var(--text-muted); margin-top: -1rem;">Προσθέστε ένα νέο έργο για να ξεκινήσετε!</p>
                <button class="btn btn-primary empty-state-action" id="addProjectBtnEmpty" style="margin-top: 1rem;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Προσθήκη Πρώτου Έργου
                </button>
            </div>
        `;
        
        // Add event listener for empty state button
        const emptyBtn = document.getElementById('addProjectBtnEmpty');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => {
                openProjectModal();
            });
        }
        return;
    }

    list.innerHTML = '';
    allProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        list.appendChild(projectCard);
        
        // Restore expanded state if it was expanded before
        if (expandedProjectIds.has(project.id)) {
            projectCard.classList.remove('collapsed');
        }
    });
    
    // Initialize Sortable for projects
    if (allProjects.length > 0) {
        new Sortable(list, {
            animation: 200,
            handle: '.project-drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            forceFallback: true,
            fallbackOnBody: true,
            filter: '.empty-state', // Prevent dragging empty state
            draggable: '.project-card', // Only allow dragging project cards
            onStart: function(evt) {
                isDraggingPhoto = false; // Reset flag when dragging project
                list.classList.add('sortable-active');
                document.body.style.cursor = 'grabbing';
            },
            onEnd: async function(evt) {
                list.classList.remove('sortable-active');
                document.body.style.cursor = '';
                await updateProjectOrder();
            }
        });
    }
    
    console.log(`Rendered ${allProjects.length} projects`);
}

// Create Project Card
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.setAttribute('data-project-id', project.id);
    
    const categoryLabel = project.category === 'private' ? 'Ιδιωτικό' : 'Δημόσιο';
    const categoryClass = project.category === 'private' ? 'category-private' : 'category-public';
    
    card.innerHTML = `
        <div class="project-card-header">
            <div class="project-drag-handle" title="Σύρετε για αλλαγή σειράς">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="12" r="1"></circle>
                    <circle cx="9" cy="5" r="1"></circle>
                    <circle cx="9" cy="19" r="1"></circle>
                    <circle cx="15" cy="12" r="1"></circle>
                    <circle cx="15" cy="5" r="1"></circle>
                    <circle cx="15" cy="19" r="1"></circle>
                </svg>
            </div>
            <div class="project-card-title-section">
                <h3>${escapeHtml(project.title || 'Χωρίς τίτλο')}</h3>
                <div class="project-meta">
                    <span class="project-category ${categoryClass}">${categoryLabel}</span>
                    <span class="photos-count-inline">${project.photos ? project.photos.length : 0} φωτογραφίες</span>
                </div>
            </div>
            <div class="project-card-actions">
                <button class="btn-icon collapse-toggle-btn" data-project-id="${project.id}" title="Επέκταση/Σύμπτυξη">
                    <svg class="collapse-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <button class="btn-icon edit-project-btn" data-project-id="${project.id}" title="Επεξεργασία">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="btn-icon btn-icon-danger delete-project-btn" data-project-id="${project.id}" title="Διαγραφή">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="project-card-content">
            ${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ''}
            <div class="project-photos-section">
                <div class="project-photos-header">
                    <span class="photos-count">${project.photos ? project.photos.length : 0} φωτογραφίες</span>
                    <button class="btn-small add-photos-btn" data-project-id="${project.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Προσθήκη Φωτογραφιών
                    </button>
                </div>
                <div class="project-photos-grid" id="photos-${project.id}" data-project-id="${project.id}">
                    ${renderProjectPhotos(project.photos || [], project.id)}
                </div>
            </div>
        </div>
    `;
    
    // Set collapsed by default
    card.classList.add('collapsed');
    
    // Initialize Sortable for photos in this project
    const photosContainer = card.querySelector(`#photos-${project.id}`);
    const collapseBtn = card.querySelector('.collapse-toggle-btn');
    
    // Store original collapse handler
    let collapseHandler = null;
    
    if (photosContainer && project.photos && project.photos.length > 0) {
        new Sortable(photosContainer, {
            animation: 150,
            handle: '.project-photo-item',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            forceFallback: true,
            fallbackOnBody: true,
            onChoose: function(evt) {
                // DISABLE collapse button IMMEDIATELY when choosing to drag
                isDraggingPhoto = true;
                mouseMovedDuringDrag = true;
                if (collapseBtn) {
                    collapseBtn.setAttribute('data-dragging', 'true');
                    collapseBtn.style.pointerEvents = 'none';
                    collapseBtn.style.display = 'none';
                    collapseBtn.style.opacity = '0';
                    collapseBtn.style.visibility = 'hidden';
                }
            },
            onStart: function(evt) {
                isDraggingPhoto = true;
                mouseMovedDuringDrag = true;
                photosContainer.classList.add('sortable-active');
                card.classList.add('dragging-photo');
                document.body.classList.add('dragging-photo');
                document.body.setAttribute('data-dragging-photo', 'true');
                document.body.style.cursor = 'grabbing';
                
                // Ensure collapse button is completely disabled
                if (collapseBtn) {
                    collapseBtn.setAttribute('data-dragging', 'true');
                    collapseBtn.setAttribute('disabled', 'true');
                    collapseBtn.style.pointerEvents = 'none';
                    collapseBtn.style.display = 'none';
                    collapseBtn.style.opacity = '0';
                    collapseBtn.style.visibility = 'hidden';
                }
            },
            onEnd: async function(evt) {
                // Record drag end time
                lastDragEndTime = Date.now();
                
                // Save that this card is expanded before reload
                if (!card.classList.contains('collapsed')) {
                    expandedProjectIds.add(project.id);
                }
                
                photosContainer.classList.remove('sortable-active');
                card.classList.remove('dragging-photo');
                document.body.classList.remove('dragging-photo');
                document.body.removeAttribute('data-dragging-photo');
                document.body.style.cursor = '';
                
                // Keep flags true for longer to prevent accidental collapse
                isDraggingPhoto = true;
                mouseMovedDuringDrag = true;
                
                // Restore collapse button after LONG delay
                const currentCollapseBtn = card.querySelector('.collapse-toggle-btn');
                if (currentCollapseBtn) {
                    setTimeout(() => {
                        currentCollapseBtn.removeAttribute('data-dragging');
                        currentCollapseBtn.removeAttribute('disabled');
                        currentCollapseBtn.style.display = '';
                        currentCollapseBtn.style.visibility = '';
                        currentCollapseBtn.style.opacity = '';
                        currentCollapseBtn.style.pointerEvents = '';
                    }, 2000);
                    
                    // Reset flags after even longer delay
                    setTimeout(() => {
                        isDraggingPhoto = false;
                        mouseMovedDuringDrag = false;
                    }, 2500);
                } else {
                    setTimeout(() => {
                        isDraggingPhoto = false;
                        mouseMovedDuringDrag = false;
                    }, 2500);
                }
                
                await updatePhotoOrder(project.id);
            }
        });
    }
    
    // Add event listeners for buttons - use event delegation instead
    card.addEventListener('click', (e) => {
        if (e.target.closest('.add-photos-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const projectId = parseInt(e.target.closest('.add-photos-btn').getAttribute('data-project-id'));
            console.log('Add photos button clicked for project:', projectId);
            openPhotoUploadModal(projectId);
        }
    });
    
    // Use event delegation for all buttons
    card.addEventListener('click', function(e) {
        // Collapse toggle button - don't trigger if dragging photo
        if (e.target.closest('.collapse-toggle-btn')) {
            const collapseBtn = e.target.closest('.collapse-toggle-btn');
            const photosContainer = card.querySelector('.project-photos-grid');
            const timeSinceDragEnd = Date.now() - lastDragEndTime;
            
            // ABSOLUTE CHECKS - if ANY of these are true, STOP everything
            if (isDraggingPhoto ||
                mouseMovedDuringDrag ||
                timeSinceDragEnd < 3000 || // Prevent collapse for 3 seconds after drag
                document.body.getAttribute('data-dragging-photo') === 'true' ||
                card.classList.contains('dragging-photo') ||
                document.body.classList.contains('dragging-photo') ||
                collapseBtn.getAttribute('data-dragging') === 'true' ||
                collapseBtn.hasAttribute('disabled') ||
                collapseBtn.style.display === 'none' ||
                collapseBtn.style.visibility === 'hidden' ||
                collapseBtn.style.pointerEvents === 'none' ||
                collapseBtn.style.opacity === '0' ||
                (photosContainer && photosContainer.classList.contains('sortable-active'))) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
            
            // Allow collapse only if all checks pass
            e.preventDefault();
            e.stopPropagation();
            const wasCollapsed = card.classList.contains('collapsed');
            card.classList.toggle('collapsed');
            
            // Update expanded state tracking
            const projectId = parseInt(card.getAttribute('data-project-id'));
            if (wasCollapsed) {
                // Now expanded
                expandedProjectIds.add(projectId);
            } else {
                // Now collapsed
                expandedProjectIds.delete(projectId);
            }
        }
        
        // Edit project button
        if (e.target.closest('.edit-project-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const projectId = parseInt(e.target.closest('.edit-project-btn').getAttribute('data-project-id'));
            openProjectModal(projectId);
        }
        
        // Delete project button
        if (e.target.closest('.delete-project-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const projectId = parseInt(e.target.closest('.delete-project-btn').getAttribute('data-project-id'));
            deleteProject(projectId);
        }
        
        // Delete photo button
        if (e.target.closest('.delete-photo-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const photoId = parseInt(e.target.closest('.delete-photo-btn').getAttribute('data-photo-id'));
            deletePhoto(photoId);
        }
    });
    
    return card;
}

// Render Project Photos
function renderProjectPhotos(photos, projectId) {
    if (!photos || photos.length === 0) {
        return '<div class="no-photos">Δεν υπάρχουν φωτογραφίες. Προσθέστε κάποιες!</div>';
    }
    
    return photos.map(photo => `
        <div class="project-photo-item" data-photo-id="${photo.id}">
            <img src="${photo.url}" alt="Photo">
            <div class="project-photo-actions">
                <button class="btn-icon-small delete-photo-btn" data-photo-id="${photo.id}" title="Διαγραφή">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Project Modal
function initProjectModal() {
    const modal = document.getElementById('projectModal');
    const saveBtn = document.getElementById('saveProjectBtn');
    const cancelBtn = document.getElementById('cancelProjectBtn');
    
    saveBtn.addEventListener('click', saveProject);
    cancelBtn.addEventListener('click', closeProjectModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeProjectModal();
        }
    });
}

function openProjectModal(projectId = null) {
    const modal = document.getElementById('projectModal');
    const titleInput = document.getElementById('projectTitleInput');
    const categoryInput = document.getElementById('projectCategoryInput');
    const descriptionInput = document.getElementById('projectDescriptionInput');
    const modalTitle = document.getElementById('projectModalTitle');
    
    currentEditProjectId = projectId;
    
    if (projectId) {
        const project = allProjects.find(p => p.id === projectId);
        if (project) {
            modalTitle.textContent = 'Επεξεργασία Έργου';
            titleInput.value = project.title || '';
            categoryInput.value = project.category || 'public';
            descriptionInput.value = project.description || '';
        }
    } else {
        modalTitle.textContent = 'Προσθήκη Νέου Έργου';
        titleInput.value = '';
        categoryInput.value = 'public';
        descriptionInput.value = '';
    }
    
    modal.style.display = 'flex';
    titleInput.focus();
}

function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    modal.style.display = 'none';
    currentEditProjectId = null;
}

async function saveProject() {
    const titleInput = document.getElementById('projectTitleInput');
    const categoryInput = document.getElementById('projectCategoryInput');
    const descriptionInput = document.getElementById('projectDescriptionInput');
    
    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const description = descriptionInput.value.trim();
    
    // Title is optional - no validation needed
    
    try {
        const url = currentEditProjectId 
            ? `${window.location.origin}/api/projects/${currentEditProjectId}`
            : `${window.location.origin}/api/projects`;
        
        const method = currentEditProjectId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ title, category, description })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save project');
        }
        
        await loadProjects();
        closeProjectModal();
        showToast(currentEditProjectId ? 'Το έργο ενημερώθηκε επιτυχώς!' : 'Το έργο προστέθηκε επιτυχώς!', 'success');
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Σφάλμα κατά την αποθήκευση του έργου.', 'error');
    }
}

// Photo Upload Modal
function initPhotoUploadModal() {
    const modal = document.getElementById('photoUploadModal');
    const uploadArea = document.getElementById('modalUploadArea');
    const fileInput = document.getElementById('modalFileInput');
    const closeBtn = document.getElementById('closePhotoUploadBtn');
    
    if (!modal) {
        console.error('Photo upload modal not found!');
        return;
    }
    
    if (!closeBtn) {
        console.error('Close button not found!');
        return;
    }
    
    closeBtn.addEventListener('click', closePhotoUploadModal);
    
    uploadArea.addEventListener('click', (e) => {
        // Don't trigger if clicking on the label/button inside
        if (e.target.closest('label') || e.target.closest('.btn')) {
            return;
        }
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handlePhotoUpload(e.dataTransfer.files);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handlePhotoUpload(e.target.files);
        }
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePhotoUploadModal();
        }
    });
}

function openPhotoUploadModal(projectId) {
    console.log('openPhotoUploadModal called with projectId:', projectId);
    const modal = document.getElementById('photoUploadModal');
    const title = document.getElementById('photoUploadTitle');
    const fileInput = document.getElementById('modalFileInput');
    
    if (!modal) {
        console.error('Modal not found!');
        return;
    }
    
    if (!title) {
        console.error('Title element not found!');
        return;
    }
    
    // Reset file input when opening modal
    if (fileInput) {
        fileInput.value = '';
    }
    
    const project = allProjects.find(p => p.id === projectId);
    
    currentPhotoUploadProjectId = projectId;
    title.textContent = project ? `Προσθήκη Φωτογραφιών - ${project.title}` : 'Προσθήκη Φωτογραφιών';
    
    // Reset progress
    const progressDiv = document.getElementById('modalUploadProgress');
    if (progressDiv) {
        progressDiv.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    console.log('Modal should be visible now');
}

function closePhotoUploadModal() {
    const modal = document.getElementById('photoUploadModal');
    modal.style.display = 'none';
    currentPhotoUploadProjectId = null;
    document.getElementById('modalFileInput').value = '';
    document.getElementById('modalUploadProgress').style.display = 'none';
}

function handlePhotoUpload(files) {
    if (!currentPhotoUploadProjectId) return;
    
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showToast('Παρακαλώ επιλέξτε μόνο αρχεία εικόνας.', 'error');
        return;
    }
    
    const formData = new FormData();
    imageFiles.forEach(file => {
        formData.append('photos', file);
    });
    
    const progressDiv = document.getElementById('modalUploadProgress');
    const progressFill = document.getElementById('modalProgressFill');
    const progressText = document.getElementById('modalProgressText');
    
    progressDiv.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.style.transition = 'width 0.3s ease';
    progressText.textContent = 'Προετοιμασία... 0%';
    
    // Use XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = `${percentComplete}%`;
            progressText.textContent = `Φόρτωση... ${percentComplete}%`;
        }
    });
    
    // Handle completion
    xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const result = JSON.parse(xhr.responseText);
                progressFill.style.width = '100%';
                progressText.textContent = `Ολοκληρώθηκε! 100%`;
                
                // Reset file input
                const fileInput = document.getElementById('modalFileInput');
                if (fileInput) {
                    fileInput.value = '';
                }
                
                setTimeout(async () => {
                    await loadProjects();
                    closePhotoUploadModal();
                    showToast(`Προστέθηκαν ${result.photos.length} φωτογραφίες!`, 'success');
                }, 500);
            } catch (error) {
                console.error('Error parsing response:', error);
                showToast('Σφάλμα κατά την επεξεργασία της απάντησης.', 'error');
                progressDiv.style.display = 'none';
            }
        } else {
            // Error response
            try {
                const error = JSON.parse(xhr.responseText);
                throw new Error(error.error || 'Failed to upload photos');
            } catch (error) {
                showToast('Σφάλμα κατά τη φόρτωση των φωτογραφιών.', 'error');
                progressDiv.style.display = 'none';
            }
        }
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
        console.error('Upload error');
        showToast('Σφάλμα κατά τη φόρτωση των φωτογραφιών.', 'error');
        progressDiv.style.display = 'none';
        
        // Reset file input even on error
        const fileInput = document.getElementById('modalFileInput');
        if (fileInput) {
            fileInput.value = '';
        }
    });
    
    // Handle abort
    xhr.addEventListener('abort', () => {
        progressDiv.style.display = 'none';
    });
    
    // Open and send request
    xhr.open('POST', `${window.location.origin}/api/projects/${currentPhotoUploadProjectId}/photos`);
    xhr.withCredentials = true; // Include credentials (cookies)
    xhr.send(formData);
}

// Update Project Order
async function updateProjectOrder() {
    const list = document.getElementById('projectsList');
    if (!list) return;
    
    // Get only project cards (not empty state or other elements)
    const projectCards = Array.from(list.children).filter(item => 
        item.classList.contains('project-card') && item.hasAttribute('data-project-id')
    );
    
    const projectIds = projectCards
        .map(item => {
            const id = item.getAttribute('data-project-id');
            return id ? parseInt(id) : null;
        })
        .filter(id => id !== null && !isNaN(id));
    
    if (projectIds.length === 0) {
        console.warn('No valid project IDs found');
        return;
    }
    
    console.log('Updating project order:', projectIds);
    console.log('Request URL:', `${window.location.origin}/api/projects/order`);
    console.log('Request body:', JSON.stringify({ projectIds }));
    
    try {
        const response = await fetch(`${window.location.origin}/api/projects/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ projectIds })
        });
        
        const responseText = await response.text();
        console.log('Response status:', response.status);
        console.log('Response text:', responseText);
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch (e) {
                errorData = { error: responseText || 'Unknown error' };
            }
            console.error('Server error:', errorData);
            throw new Error(errorData.error || 'Failed to update order');
        }
        
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { message: 'Order updated successfully' };
        }
        console.log('Order updated successfully:', result);
        
        // Update local array order
        const newOrder = [];
        projectIds.forEach(id => {
            const project = allProjects.find(p => p.id === id);
            if (project) newOrder.push(project);
        });
        allProjects = newOrder;
        
        showToast('Η σειρά των έργων ενημερώθηκε επιτυχώς!', 'success');
    } catch (error) {
        console.error('Error updating project order:', error);
        showToast(`Σφάλμα κατά την ενημέρωση της σειράς: ${error.message}`, 'error');
        // Reload to get correct order from server
        await loadProjects();
    }
}

// Update Photo Order
async function updatePhotoOrder(projectId) {
    const container = document.getElementById(`photos-${projectId}`);
    if (!container) return;
    
    const photoIds = Array.from(container.children)
        .map(item => parseInt(item.getAttribute('data-photo-id')))
        .filter(id => !isNaN(id));
    
    if (photoIds.length === 0) return;
    
    try {
        const response = await fetch(`${window.location.origin}/api/projects/${projectId}/photos/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ photoIds })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update order');
        }
        
        await loadProjects();
        showToast('Η σειρά ενημερώθηκε επιτυχώς!', 'success');
    } catch (error) {
        console.error('Error updating photo order:', error);
        showToast('Σφάλμα κατά την ενημέρωση της σειράς.', 'error');
        await loadProjects();
    }
}

// Delete Project
async function deleteProject(projectId) {
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έργο; Όλες οι φωτογραφίες θα διαγραφούν επίσης.')) {
        return;
    }
    
    try {
        const response = await fetch(`${window.location.origin}/api/projects/${projectId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete project');
        }
        
        await loadProjects();
        showToast('Το έργο διαγράφηκε επιτυχώς.', 'success');
    } catch (error) {
        console.error('Error deleting project:', error);
        showToast('Σφάλμα κατά τη διαγραφή του έργου.', 'error');
    }
}

// Delete Photo
async function deletePhoto(photoId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη φωτογραφία;')) {
        return;
    }
    
    try {
        const response = await fetch(`${window.location.origin}/api/photos/${photoId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete photo');
        }
        
        await loadProjects();
        showToast('Η φωτογραφία διαγράφηκε επιτυχώς.', 'success');
    } catch (error) {
        console.error('Error deleting photo:', error);
        showToast('Σφάλμα κατά τη διαγραφή της φωτογραφίας.', 'error');
    }
}

// Edit Project (global function - removed, using event delegation)
// window.editProject - not needed

// Open Photo Upload Modal (global function - removed to avoid recursion)
// Using event delegation instead, so this is not needed

// Delete Project (global function - removed, using event delegation)
// window.deleteProject - not needed

// Delete Photo (global function - removed, using event delegation)
// window.deletePhoto - not needed

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

// Utility
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
