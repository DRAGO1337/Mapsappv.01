// --- 1. CONFIGURATION ---
const SUPABASE_URL = 'https://zevrtruxhekpzhrsefsp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpldnJ0cnV4aGVrcHpocnNlZnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODE4NDcsImV4cCI6MjA4OTE1Nzg0N30.OvqDoPIwAtw9ZJcVtlAAI4Yvc-UtYJxcuCmULLdAB74';

if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
var supabase = window.supabaseClient;

// --- 2. MAP INITIALIZATION & LAYERS ---
const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([43.2102, 23.5529], 13);

// Layer Definitions
const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
};

// Set Default Layer
layers.street.addTo(map);

/**
 * LAYER GUARD: Automatically manages the CSS filter.
 * Street map gets the 'map-dark-active' class (to allow inversion).
 * Satellite/Terrain remove it so colors look natural.
 */
function handleLayerFilter(layerType) {
    if (layerType === 'street') {
        document.body.classList.add('map-dark-active');
    } else {
        document.body.classList.remove('map-dark-active');
    }
}

// Set initial filter state
handleLayerFilter('street');

// Layer Switcher Logic
document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.onclick = function() {
        const type = this.getAttribute('data-layer');
        // Remove all layers first
        Object.values(layers).forEach(layer => map.removeLayer(layer));
        // Add selected layer
        layers[type].addTo(map);

        // Fix for "broken" satellite/terrain colors
        handleLayerFilter(type);

        // UI Update
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    };
});

// --- 3. THEME LOGIC ---
const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.remove('dark-theme');
        icon.classList.replace('fa-sun', 'fa-moon');
    }
}

themeToggle.onclick = () => {
    const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    localStorage.setItem('map-app-theme', newTheme);
    applyTheme(newTheme);
};

applyTheme(localStorage.getItem('map-app-theme') || 'light');

// --- 4. LOCATE ME LOGIC ---
document.getElementById('current-location').onclick = () => {
    map.locate({setView: true, maxZoom: 16});
};

map.on('locationfound', (e) => {
    L.circle(e.latlng, e.accuracy / 2).addTo(map);
    L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
});

map.on('locationerror', (e) => alert("Location access denied or unavailable."));

// --- 5. CORE MARKER FUNCTIONS ---
function placeSavedMarker(pinData) {
    if (!pinData.lat || !pinData.lng) return;
    const marker = L.marker([pinData.lat, pinData.lng]).addTo(map);
    const tags = Array.isArray(pinData.tags) ? pinData.tags.join(', ') : (pinData.tags || 'None');

    marker.bindPopup(`
        <div style="text-align:center; padding: 5px;">
            <strong style="color: #2563eb; font-size: 14px;">Meta Pin</strong><br>
            <div style="margin: 5px 0; font-size: 12px;"><b>Tags:</b> ${tags}</div>
            <code style="font-size: 10px; color: #64748b;">${pinData.lat.toFixed(6)}, ${pinData.lng.toFixed(6)}</code>
        </div>
    `);
}

async function loadSavedPins() {
    const { data, error } = await supabase.from('metas').select('*');
    if (data) data.forEach(pin => placeSavedMarker(pin));
}

async function savePinToCloud(lat, lng, tags) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showAuthRequired(); return; }

    const { error } = await supabase.from('metas').insert([{ lat, lng, tags, image_url: "" }]);
    if (error) alert("Upload failed: " + error.message);
}

function showAuthRequired() {
    document.getElementById('auth-title').innerText = "Account Required";
    document.getElementById('auth-subtitle').innerText = "Please sign in to place pins.";
    document.getElementById('loginModal').style.display = 'flex';
}

// --- 6. AUTHENTICATION & SLIDE ANIMATION ---
let isSignUpMode = false;
const toggleAuthBtn = document.getElementById('toggle-auth');

if (toggleAuthBtn) {
    toggleAuthBtn.onclick = (e) => {
        e.preventDefault();
        const wrapper = document.querySelector('.auth-content-wrapper');

        // 1. Slide current content out to the left
        wrapper.classList.add('auth-slide-out');

        setTimeout(() => {
            isSignUpMode = !isSignUpMode;

            // 2. Change content while invisible
            document.getElementById('auth-title').innerText = isSignUpMode ? "Join us" : "Sign in";
            document.getElementById('auth-subtitle').innerText = isSignUpMode ? "Create a new account." : "Manage your GeoGuessr metas.";
            document.getElementById('auth-action-btn').innerText = isSignUpMode ? "Create Account" : "Get Started";
            document.getElementById('toggle-auth').innerText = isSignUpMode ? "Already have an account? Sign In" : "Don't have an account? Create one";

            // 3. Move wrapper to the right (off-screen) and prepare for entry
            wrapper.classList.remove('auth-slide-out');
            wrapper.classList.add('auth-slide-in');

            // 4. Slide back into the center
            setTimeout(() => {
                wrapper.classList.remove('auth-slide-in');
            }, 50);
        }, 300);
    };
}

document.getElementById('auth-action-btn').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('auth-action-btn');

    if (!email || !password) return alert("Fields cannot be empty");

    const originalText = btn.innerText;
    btn.innerText = "Processing...";

    let result = isSignUpMode
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
        alert(result.error.message);
        btn.innerText = originalText;
    } else {
        location.reload();
    }
};

document.getElementById('doLogout').onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
};

// --- 7. INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedPins();

    // Check Auth State for UI buttons
    supabase.auth.getUser().then(({data}) => {
        if (data.user) {
            document.getElementById('open-login').style.display = 'none';
            document.getElementById('doLogout').style.display = 'flex';
        }
    });

    // Handle Disclaimer
    if (sessionStorage.getItem('termsAccepted') === 'true') {
        document.getElementById('disclaimerModal').style.display = 'none';
    }

    document.getElementById('open-login').onclick = () => {
        document.getElementById('loginModal').style.display = 'flex';
    };

    document.getElementById('finalSubmit').onclick = async function() {
        const lat = parseFloat(document.getElementById('modal-lat').value);
        const lng = parseFloat(document.getElementById('modal-lng').value);
        const tags = Array.from(document.querySelectorAll('.meta-tag:checked')).map(t => t.value);
        await savePinToCloud(lat, lng, tags);
        window.closeMetaForm();
    };
});

window.acceptDisclaimer = () => {
    document.getElementById('disclaimerModal').style.display = 'none';
    sessionStorage.setItem('termsAccepted', 'true');
};

window.openMetaForm = (lat, lng) => {
    document.getElementById('display-coords').innerText = lat + ", " + lng;
    document.getElementById('modal-lat').value = lat;
    document.getElementById('modal-lng').value = lng;
    document.getElementById('metaModal').style.display = 'flex';
};

window.closeMetaForm = () => {
    document.getElementById('metaModal').style.display = 'none';
    document.querySelectorAll('.meta-tag').forEach(t => t.checked = false);
};

// Context Menu (Right Click)
map.on('contextmenu', (e) => {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    L.popup().setLatLng(e.latlng).setContent(`
        <div style="text-align: center;">
            <button onclick="window.openMetaForm(${lat}, ${lng})" class="btn-primary-auth" style="padding: 8px 16px; font-size: 12px; margin-top: 0;">ADD PIN</button>
        </div>
    `).openOn(map);
});

// Realtime Sync
supabase.channel('public:metas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'metas' }, p => {
    placeSavedMarker(p.new);
}).subscribe();