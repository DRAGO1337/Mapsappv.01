// 1. Initialize map
const map = L.map('map', {
    zoomControl: false
}).setView([43.2102, 23.5529], 13); // Set to Vratsa default

// --- GLOBAL VARIABLES ---
let currentUserMarker = null; // Tracks your GPS dot to prevent duplicates and "Romania jumps"

// --- GLOBAL FUNCTIONS ---

window.acceptDisclaimer = function() {
    const disclaimer = document.getElementById('disclaimerModal');
    if (disclaimer) {
        disclaimer.style.setProperty('display', 'none', 'important');
        sessionStorage.setItem('termsAccepted', 'true');
    }
};

window.openMetaForm = function(lat, lng) {
    const modal = document.getElementById('metaModal');
    if (!modal) return;
    document.getElementById('display-coords').innerText = lat + ", " + lng;
    document.getElementById('modal-lat').value = lat;
    document.getElementById('modal-lng').value = lng;
    modal.style.setProperty('display', 'flex', 'important');
};

window.closeMetaForm = function() {
    const modal = document.getElementById('metaModal');
    const previewImg = document.getElementById('image-preview');
    const fileInput = document.getElementById('metaImage');
    if (modal) modal.style.setProperty('display', 'none', 'important');
    if (previewImg) { previewImg.src = ""; previewImg.style.display = 'none'; }
    if (fileInput) fileInput.value = "";
    document.querySelectorAll('.meta-tag').forEach(t => t.checked = false);
};

function placeSavedMarker(pinData) {
    const marker = L.marker([pinData.lat, pinData.lng]).addTo(map);
    marker.bindPopup(`
        <div style="text-align:center;">
            <strong>Saved Meta Pin</strong><br>
            Tags: ${pinData.tags.length > 0 ? pinData.tags.join(', ') : 'None'}<br>
            <small>${pinData.lat}, ${pinData.lng}</small>
        </div>
    `);
}

function loadSavedPins() {
    const savedPins = JSON.parse(localStorage.getItem('myPins') || '[]');
    savedPins.forEach(pin => placeSavedMarker(pin));
}

// --- INITIALIZE EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    loadSavedPins();

    if (sessionStorage.getItem('termsAccepted') === 'true') {
        const disclaimer = document.getElementById('disclaimerModal');
        if (disclaimer) disclaimer.style.display = 'none';
    }

    // Submit Pin logic
    const submitBtn = document.getElementById('finalSubmit');
    if (submitBtn) {
        submitBtn.onclick = function() {
            const lat = parseFloat(document.getElementById('modal-lat')?.value);
            const lng = parseFloat(document.getElementById('modal-lng')?.value);
            const selectedTags = Array.from(document.querySelectorAll('.meta-tag:checked')).map(t => t.value);

            const newPin = { lat, lng, tags: selectedTags, timestamp: Date.now() };
            const currentPins = JSON.parse(localStorage.getItem('myPins') || '[]');
            currentPins.push(newPin);
            localStorage.setItem('myPins', JSON.stringify(currentPins));

            placeSavedMarker(newPin);
            window.closeMetaForm();
        };
    }
});

// --- MAP UI & CONTROLS ---

L.control.zoom({ position: 'topright' }).addTo(map);

const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenTopoMap' })
};
layers.street.addTo(map);

map.on('contextmenu', function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    L.popup().setLatLng(e.latlng).setContent(`
        <div style="text-align: center;">
            <h4 style="margin-bottom: 8px;">Set a meta</h4>
            <button onclick="window.openMetaForm(${lat}, ${lng})" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">ADD</button>
        </div>
    `).openOn(map);
});

// --- SEARCH & GEOLOCATION ---
const geocoder = new L.Control.Geocoder.Nominatim();
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.querySelector('.search-results');
const clearSearchBtn = document.getElementById('clear-search');

// FIXED: Clear Search Button Logic
if (clearSearchBtn) {
    clearSearchBtn.onclick = (e) => {
        e.preventDefault();
        searchInput.value = '';
        searchResultsContainer.style.setProperty('display', 'none', 'important');
        console.log("Search cleared and hidden");
    };
}

if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value;
        if (query.length < 3) {
            searchResultsContainer.style.setProperty('display', 'none', 'important');
            return;
        }
        geocoder.geocode(query, (results) => {
            if (results && results.length > 0) {
                displaySearchResults(results);
            } else {
                searchResultsContainer.style.setProperty('display', 'none', 'important');
            }
        });
    }, 300));
}

function displaySearchResults(results) {
    searchResultsContainer.innerHTML = '';
    // Use setProperty to override any conflicting CSS
    searchResultsContainer.style.setProperty('display', 'block', 'important');

    results.forEach((result) => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = result.name;
        div.onclick = () => {
            map.setView(result.center, 16);
            L.marker(result.center).addTo(map).bindPopup(`<b>${result.name}</b>`).openPopup();
            searchResultsContainer.style.setProperty('display', 'none', 'important');
            searchInput.value = result.name;
        };
        searchResultsContainer.appendChild(div);
    });
}

// FIXED LOCATE ME: Linked Marker and Popup + Cleanup
document.getElementById('current-location').onclick = function() {
    navigator.geolocation.getCurrentPosition((pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];

        // 1. Remove old version of you before adding new one
        if (currentUserMarker) {
            map.removeLayer(currentUserMarker);
        }

        const pulseIcon = L.divIcon({
            className: 'location-pulse',
            iconSize: [16, 16],
            iconAnchor: [8, 8] // CRITICAL: This keeps the dot on the coordinate during zoom
        });

        map.setView(latlng, 17);

        // 2. Assign to variable and tether popup directly to marker
        currentUserMarker = L.marker(latlng, {icon: pulseIcon}).addTo(map);
        currentUserMarker.bindPopup("<b>You are here</b>", {
            offset: L.point(0, -10),
            closeButton: false
        }).openPopup();

    }, (err) => {
        alert("Location denied or unavailable.");
    }, { enableHighAccuracy: true });
};

// Layer switching
document.querySelectorAll('.layer-btn').forEach(button => {
    button.addEventListener('click', () => {
        const layerType = button.dataset.layer;
        Object.values(layers).forEach(l => map.removeLayer(l));
        layers[layerType].addTo(map);
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
    });
});

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}