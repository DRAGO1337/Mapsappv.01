
// Initialize map with custom zoom control position
const map = L.map('map', {
    zoomControl: false
}).setView([51.505, -0.09], 13);

// Add zoom control to top-right corner
L.control.zoom({
    position: 'topright'
}).addTo(map);

// Define tile layers
const layers = {
    street: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB',
        maxZoom: 20
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '©Esri',
        maxZoom: 20
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '©OpenTopoMap',
        maxZoom: 17
    })
};

// Add default street layer
layers.street.addTo(map);

// Initialize search elements
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let currentMarker = null;

// Initialize geocoder
const provider = new GeoSearch.OpenStreetMapProvider();

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Handle search input with autocomplete
searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value;
    if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
    }

    try {
        const results = await provider.search({ query });
        if (results.length > 0) {
            searchResults.innerHTML = results
                .slice(0, 5)
                .map(result => `
                    <div class="search-result-item" data-lat="${result.y}" data-lon="${result.x}">
                        ${result.label}
                    </div>
                `).join('');
            searchResults.style.display = 'block';

            // Add click handlers to results
            document.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lat = parseFloat(item.dataset.lat);
                    const lon = parseFloat(item.dataset.lon);
                    
                    // Remove existing marker
                    if (currentMarker) {
                        map.removeLayer(currentMarker);
                    }

                    // Add new marker
                    currentMarker = L.marker([lat, lon]).addTo(map)
                        .bindPopup(item.textContent)
                        .openPopup();

                    // Pan to location
                    map.setView([lat, lon], 13, {
                        animate: true,
                        duration: 1
                    });

                    // Clear search
                    searchInput.value = item.textContent;
                    searchResults.style.display = 'none';
                });
            });
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}, 300));

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-container')) {
        searchResults.style.display = 'none';
    }
});

// Handle layer switching
const layerButtons = document.querySelectorAll('.layer-btn');
layerButtons.forEach(button => {
    button.addEventListener('click', () => {
        const layerType = button.dataset.layer;

        // Remove all layers
        Object.values(layers).forEach(layer => map.removeLayer(layer));

        // Add selected layer
        layers[layerType].addTo(map);

        // Update active state
        layerButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    });
});
