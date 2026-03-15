const SUPABASE_URL = 'https://zevrtruxhekpzhrsefsp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpldnJ0cnV4aGVrcHpocnNlZnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODE4NDcsImV4cCI6MjA4OTE1Nzg0N30.OvqDoPIwAtw9ZJcVtlAAI4Yvc-UtYJxcuCmULLdAB74';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Initialize map
const map = L.map('map', {
    zoomControl: false
}).setView([43.2102, 23.5529], 13); // Set to Vratsa default

// --- GLOBAL VARIABLES ---
let currentUserMarker = null;

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

// Modified to handle Supabase data structure
function placeSavedMarker(pinData) {
    const marker = L.marker([pinData.lat, pinData.lng]).addTo(map);
    // Handle tags if they are an array or a string
    const displayTags = Array.isArray(pinData.tags) ? pinData.tags.join(', ') : pinData.tags;

    marker.bindPopup(`
        <div style="text-align:center;">
            <strong>Meta Pin</strong><br>
            Tags: ${displayTags || 'None'}<br>
            <small>${pinData.lat.toFixed(4)}, ${pinData.lng.toFixed(4)}</small>
        </div>
    `);
}

// NEW: Load pins from Supabase Cloud instead of LocalStorage
async function loadSavedPins() {
    const { data, error } = await supabase
        .from('metas')
        .select('*');

    if (error) {
        console.error("Error loading pins:", error.message);
    } else {
        data.forEach(pin => placeSavedMarker(pin));
    }
}

// NEW: Save pin to Supabase Cloud
async function savePinToCloud(lat, lng, tags) {
    const { data, error } = await supabase
        .from('metas')
        .insert([
            { lat, lng, tags, image_url: "" }
        ]);

    if (error) {
        alert("Error saving to cloud: " + error.message);
    } else {
        console.log("Pin saved to Ireland database!");
    }
}

// --- INITIALIZE EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    loadSavedPins(); // Load cloud pins on start

    if (sessionStorage.getItem('termsAccepted') === 'true') {
        const disclaimer = document.getElementById('disclaimerModal');
        if (disclaimer) disclaimer.style.display = 'none';
    }

    // Submit Pin logic (Updated for Supabase)
    const submitBtn = document.getElementById('finalSubmit');
    if (submitBtn) {
        submitBtn.onclick = async function() {
            const lat = parseFloat(document.getElementById('modal-lat')?.value);
            const lng = parseFloat(document.getElementById('modal-lng')?.value);
            const selectedTags = Array.from(document.querySelectorAll('.meta-tag:checked')).map(t => t.value);

            // 1. Save to Cloud
            await savePinToCloud(lat, lng, selectedTags);

            // 2. Add to map locally immediately
            placeSavedMarker({ lat, lng, tags: selectedTags });

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
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.querySelector('.search-results');
const clearSearchBtn = document.getElementById('clear-search');

if (clearSearchBtn) {
    clearSearchBtn.onclick = (e) => {
        e.preventDefault();
        searchInput.value = '';
        searchResultsContainer.style.setProperty('display', 'none', 'important');
    };
}

if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query.length >= 2) performSearch(query);
        }
    });

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            searchResultsContainer.style.setProperty('display', 'none', 'important');
            return;
        }
        performSearch(query);
    }, 400));
}

function performSearch(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`;
    fetch(url, {
        headers: { 'Accept-Language': 'en', 'Accept': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
        if (data && data.length > 0) {
            displaySearchResults(data);
        } else {
            searchResultsContainer.innerHTML = '<div class="search-result-item" style="color:#888;">No results found.</div>';
            searchResultsContainer.style.setProperty('display', 'block', 'important');
        }
    })
    .catch(() => {
        searchResultsContainer.innerHTML = '<div class="search-result-item" style="color:#c00;">Search unavailable.</div>';
        searchResultsContainer.style.setProperty('display', 'block', 'important');
    });
}

function displaySearchResults(data) {
    searchResultsContainer.innerHTML = '';
    searchResultsContainer.style.setProperty('display', 'block', 'important');

    data.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = item.display_name;
        div.onclick = () => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            map.setView([lat, lon], 14);
            L.marker([lat, lon]).addTo(map).bindPopup(`<b>${item.display_name}</b>`).openPopup();
            searchResultsContainer.style.setProperty('display', 'none', 'important');
            searchInput.value = item.display_name;
        };
        searchResultsContainer.appendChild(div);
    });
}

// LOCATE ME
document.getElementById('current-location').onclick = function() {
    navigator.geolocation.getCurrentPosition((pos) => {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        if (currentUserMarker) map.removeLayer(currentUserMarker);

        const pulseIcon = L.divIcon({
            className: 'location-marker-wrapper',
            html: '<div class="location-pulse"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        map.setView(latlng, 17);
        currentUserMarker = L.marker(latlng, { icon: pulseIcon }).addTo(map);
        currentUserMarker.bindPopup('<b>You are here</b>').openPopup();

    }, () => alert("Location denied."), { enableHighAccuracy: true });
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

// REALTIME SUBSCRIPTION (The "Pro" feature)
supabase
  .channel('public:metas')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'metas' }, payload => {
    console.log('New pin received in real-time!', payload.new);
    placeSavedMarker(payload.new);
  })
  .subscribe();