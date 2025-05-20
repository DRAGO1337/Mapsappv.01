// Initialize map
const map = L.map('map').setView([51.505, -0.09], 13);

// Define tile layers with modern styling
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

// Initialize geocoder
const geocoder = L.Control.Geocoder.nominatim();
const searchInput = document.getElementById('search-input');

// Handle search input
searchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value;
        try {
            geocoder.geocode(query, results => {
                if (results.length > 0) {
                    const { center, name } = results[0];
                    map.setView(center, 13);
                    L.marker(center).addTo(map)
                        .bindPopup(name)
                        .openPopup();
                }
            });
        } catch (error) {
            console.error('Search failed:', error);
        }
    }
});

// Handle layer switching
const layerButtons = document.querySelectorAll('.map-btn');
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

// Initialize markers array for routing
let markers = [];

// Click to add marker with modern styling
map.on('click', (e) => {
    const marker = L.marker(e.latlng, {
        icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: 24px;
                height: 24px;
                background: #1a73e8;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            "></div>`
        })
    }).addTo(map);

    markers.push(marker);

    if (markers.length > 2) {
        markers[0].remove();
        markers.shift();
    }

    if (markers.length === 2) {
        // Draw route between markers
        const start = markers[0].getLatLng();
        const end = markers[1].getLatLng();
        // Add routing logic here if needed
    }
});

// Get user's location
document.getElementById('location-button').addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation = [position.coords.latitude, position.coords.longitude];
            map.setView(userLocation, 13);
            L.marker(userLocation).addTo(map)
                .bindPopup('You are here!')
                .openPopup();
        },
        () => {
            alert('Unable to get your location');
        }
    );
});