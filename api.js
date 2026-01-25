// API Helper Functions
// Use localhost:3000 if opening file directly, otherwise use current origin
let API_BASE_URL;
if (window.location.protocol === 'file:') {
    API_BASE_URL = 'http://localhost:3000';
} else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_BASE_URL = window.location.origin;
} else {
    API_BASE_URL = window.location.origin;
}

// Convert File to base64 for preview (optional, can use direct file upload)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// GET all projects
async function getProjectsFromAPI(category = 'all') {
    try {
        const url = category === 'all' 
            ? `${API_BASE_URL}/api/projects`
            : `${API_BASE_URL}/api/projects?category=${category}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching projects:', error);
        throw error;
    }
}

// GET all photos (for backward compatibility - extracts photos from projects)
// NOW: Returns only the FIRST photo from each project (one project = one item in grid)
async function getPhotosFromAPI(category = 'all') {
    try {
        const projects = await getProjectsFromAPI(category);
        
        // Extract ONLY THE FIRST photo from each project
        const allPhotos = [];
        
        projects.forEach((project) => {
            if (project.photos && project.photos.length > 0) {
                // Take only the first photo (by display_order)
                const firstPhoto = project.photos[0];
                allPhotos.push({
                    ...firstPhoto,
                    title: project.title || '',
                    category: project.category || 'public',
                    projectId: project.id,
                    totalPhotos: project.photos.length // Store total count for potential future use
                });
            }
        });
        
        return allPhotos;
    } catch (error) {
        console.error('Error fetching photos:', error);
        throw error;
    }
}

// GET single photo
async function getPhotoFromAPI(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/photos/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching photo:', error);
        throw error;
    }
}

// GET single project with all photos
async function getProjectFromAPI(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/projects/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching project:', error);
        throw error;
    }
}

// POST new photo
async function addPhotoToAPI(file, title, category) {
    try {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('title', title || '');
        formData.append('category', category || 'public');
        
        const response = await fetch(`${API_BASE_URL}/api/photos`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error adding photo:', error);
        throw error;
    }
}

// PUT update photo order
async function updatePhotoOrderInAPI(photoIds) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/photos/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ photoIds })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error updating photo order:', error);
        throw error;
    }
}

// PUT update photo
async function updatePhotoInAPI(id, title, category) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/photos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title || '',
                category: category || 'public'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error updating photo:', error);
        throw error;
    }
}

// DELETE photo
async function deletePhotoFromAPI(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/photos/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error deleting photo:', error);
        throw error;
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.getPhotosFromAPI = getPhotosFromAPI;
    window.getProjectsFromAPI = getProjectsFromAPI;
    window.getPhotoFromAPI = getPhotoFromAPI;
    window.getProjectFromAPI = getProjectFromAPI;
    window.addPhotoToAPI = addPhotoToAPI;
    window.updatePhotoInAPI = updatePhotoInAPI;
    window.updatePhotoOrderInAPI = updatePhotoOrderInAPI;
    window.deletePhotoFromAPI = deletePhotoFromAPI;
    window.fileToBase64 = fileToBase64;
}
