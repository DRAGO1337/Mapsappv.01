// Initialize map with custom zoom control position
const map = L.map('map', {
    zoomControl: false
}).setView([51.505, -0.09], 13);

// Add zoom control to top-right corner
L.control.zoom({
    position: 'topright'
}).addTo(map);

// Define tile layers with correct URLs
const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap',
        maxZoom: 17
    })
};

// Add default street layer
layers.street.addTo(map);

// Initialize geocoder control
const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topleft',
    placeholder: 'Search locations...',
    geocoder: new L.Control.Geocoder.Nominatim()
}).addTo(map);

let currentMarker = null;

// Handle geocoding results
geocoder.on('markgeocode', function(e) {
    const { center, name } = e.geocode;

    // Remove existing marker if any
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // Add new marker
    currentMarker = L.marker(center).addTo(map)
        .bindPopup(name)
        .openPopup();

    // Pan to location with smooth animation
    map.setView(center, 13, {
        animate: true,
        duration: 1
    });
});

// Handle layer switching
document.querySelectorAll('.layer-btn').forEach(button => {
    button.addEventListener('click', () => {
        const layerType = button.dataset.layer;

        // Remove active class from all buttons
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked button
        button.classList.add('active');

        // Remove all layers first
        Object.values(layers).forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });

        // Add selected layer
        layers[layerType].addTo(map);
    });
});