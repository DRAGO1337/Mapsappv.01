
// Initialize map
const map = L.map('map', {
    zoomControl: false
}).setView([51.505, -0.09], 13);

// Add zoom control to top-right corner
L.control.zoom({
    position: 'topright'
}).addTo(map);

// Define tile layers
const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
    })
};

// Add default street layer
layers.street.addTo(map);

// Initialize variables
let currentMarker = null;
let searchResults = [];
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.querySelector('.search-results');
const loadingIndicator = document.getElementById('loading-indicator');
const zoomIndicator = document.getElementById('zoom-level');
const bookmarksPanel = document.getElementById('bookmarks-panel');
const bookmarksList = document.getElementById('bookmarks-list');

// Update zoom level indicator
map.on('zoomend', () => {
    zoomIndicator.textContent = `Zoom: ${map.getZoom()}`;
});

// Show loading indicator during tile loading
map.on('loading', () => {
    loadingIndicator.classList.remove('loading-hidden');
});

map.on('load', () => {
    loadingIndicator.classList.add('loading-hidden');
});

// Search functionality
const geocoder = new L.Control.Geocoder.Nominatim();

searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value;
    if (query.length < 3) {
        searchResultsContainer.style.display = 'none';
        return;
    }

    loadingIndicator.classList.remove('loading-hidden');
    try {
        geocoder.geocode(query, (results) => {
            searchResults = results;
            displaySearchResults(results);
            loadingIndicator.classList.add('loading-hidden');
        });
    } catch (error) {
        console.error('Geocoding error:', error);
        loadingIndicator.classList.add('loading-hidden');
    }
}, 300));

function displaySearchResults(results) {
    searchResultsContainer.innerHTML = '';
    searchResultsContainer.style.display = results.length ? 'block' : 'none';

    results.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = result.name;
        div.addEventListener('click', () => selectSearchResult(index));
        searchResultsContainer.appendChild(div);
    });
}

function selectSearchResult(index) {
    const result = searchResults[index];
    const latlng = result.center;
    
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    currentMarker = L.marker(latlng)
        .addTo(map)
        .bindPopup(result.name)
        .openPopup();

    map.setView(latlng, 16);
    searchResultsContainer.style.display = 'none';
}

// Clear search
document.getElementById('clear-search').addEventListener('click', () => {
    searchInput.value = '';
    searchResultsContainer.style.display = 'none';
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    map.setView([51.505, -0.09], 13);
});

// Current location
document.getElementById('current-location').addEventListener('click', () => {
    if ('geolocation' in navigator) {
        loadingIndicator.classList.remove('loading-hidden');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latlng = [position.coords.latitude, position.coords.longitude];
                if (currentMarker) {
                    map.removeLayer(currentMarker);
                }
                currentMarker = L.marker(latlng)
                    .addTo(map)
                    .bindPopup('Your location')
                    .openPopup();
                map.setView(latlng, 16);
                loadingIndicator.classList.add('loading-hidden');
            },
            (error) => {
                console.error('Geolocation error:', error);
                loadingIndicator.classList.add('loading-hidden');
                alert('Unable to get your location');
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
});

// Bookmarks functionality
let bookmarks = JSON.parse(localStorage.getItem('mapBookmarks')) || [];

document.getElementById('bookmark-location').addEventListener('click', () => {
    if (currentMarker) {
        const latlng = currentMarker.getLatLng();
        const name = prompt('Enter a name for this location:');
        if (name) {
            const bookmark = {
                name,
                lat: latlng.lat,
                lng: latlng.lng
            };
            bookmarks.push(bookmark);
            localStorage.setItem('mapBookmarks', JSON.stringify(bookmarks));
            updateBookmarksList();
        }
    } else {
        alert('Please search for a location first');
    }
});

function updateBookmarksList() {
    bookmarksList.innerHTML = '';
    bookmarks.forEach((bookmark, index) => {
        const div = document.createElement('div');
        div.className = 'bookmark-item';
        div.textContent = bookmark.name;
        div.addEventListener('click', () => {
            const latlng = [bookmark.lat, bookmark.lng];
            if (currentMarker) {
                map.removeLayer(currentMarker);
            }
            currentMarker = L.marker(latlng)
                .addTo(map)
                .bindPopup(bookmark.name)
                .openPopup();
            map.setView(latlng, 16);
        });
        bookmarksList.appendChild(div);
    });
}

// Layer switching
document.querySelectorAll('.layer-btn').forEach(button => {
    button.addEventListener('click', () => {
        const layerType = button.dataset.layer;
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        Object.values(layers).forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        layers[layerType].addTo(map);
    });
});

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize bookmarks list
updateBookmarksList();
