
// Initialize map centered on London
const map = L.map('map').setView([51.505, -0.09], 13);

// Define tile layers
const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors'
    })
};

// Add default street layer
layers.street.addTo(map);

// Handle layer controls
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

let markers = [];
let routingControl = null;

// Click to add marker
map.on('click', (e) => {
    const marker = L.marker(e.latlng).addTo(map);
    const popup = `Latitude: ${e.latlng.lat.toFixed(4)}<br>Longitude: ${e.latlng.lng.toFixed(4)}`;
    marker.bindPopup(popup).openPopup();
    markers.push(marker);

    if (markers.length === 2) {
        drawRoute();
    }
    if (markers.length > 2) {
        markers.forEach(m => map.removeLayer(m));
        markers = [marker];
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
    }
});

// Draw route between two points
function drawRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
    }
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(markers[0].getLatLng()),
            L.latLng(markers[1].getLatLng())
        ],
        routeWhileDragging: true
    }).addTo(map);
}

// Geocoding search
document.getElementById('search-button').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.length > 0) {
            const location = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            map.setView(location, 13);
            L.marker(location).addTo(map)
                .bindPopup(data[0].display_name)
                .openPopup();
        } else {
            alert('Location not found');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('Search failed. Please try again.');
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
