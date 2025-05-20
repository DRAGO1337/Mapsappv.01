
// Initialize map centered on London
const map = L.map('map').setView([51.505, -0.09], 13);

// Add custom styled tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap, ©CartoDB',
    maxZoom: 19
}).addTo(map);

let markers = [];
let routingControl = null;

// Click to add marker
map.on('click', (e) => {
    const marker = L.marker(e.latlng).addTo(map);
    const popup = `Latitude: ${e.latlng.lat.toFixed(4)}<br>Longitude: ${e.latlng.lng.toFixed(4)}`;
    marker.bindPopup(popup).openPopup();
    markers.push(marker);

    // If we have 2 markers, draw a route
    if (markers.length === 2) {
        drawRoute();
    }
    // Reset markers after 2
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
