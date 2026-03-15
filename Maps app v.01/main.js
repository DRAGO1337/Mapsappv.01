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

const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
};

layers.street.addTo(map);

function handleLayerFilter(layerType) {
    if (layerType === 'street') {
        document.body.classList.add('map-dark-active');
    } else {
        document.body.classList.remove('map-dark-active');
    }
}

handleLayerFilter('street');

document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.onclick = function() {
        const type = this.getAttribute('data-layer');
        Object.values(layers).forEach(layer => map.removeLayer(layer));
        layers[type].addTo(map);
        handleLayerFilter(type);
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    };
});

// --- 3. SEARCH LOGIC (ACCURACY & DARK MODE FIX) ---
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const clearSearchBtn = document.getElementById('clear-search');

function performSearch(query) {
    if (query.length < 3) {
        searchResults.style.display = 'none';
        return;
    }

    // limit=10 gives us a better pool to find the actual city center
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
            searchResults.innerHTML = '';
            if (!data || data.length === 0) {
                searchResults.style.display = 'none';
                return;
            }

            searchResults.style.display = 'block';

            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-item';

                const addr = item.address;
                const mainName = addr.city || addr.town || addr.village || addr.hamlet || item.display_name.split(',')[0];
                const subName = [addr.state, addr.country].filter(Boolean).join(', ');

                div.innerHTML = `
                    <i class="fas fa-map-marker-alt" style="margin-right: 12px; color: #94a3b8;"></i>
                    <div style="display: flex; flex-direction: column; overflow: hidden;">
                        <span style="font-weight: 600; color: inherit;">${mainName}</span>
                        <span style="font-size: 11px; opacity: 0.6; color: inherit;">${subName}</span>
                    </div>
                `;

                div.onclick = () => {
                    const lat = parseFloat(item.lat);
                    const lon = parseFloat(item.lon);

                    // Zoom level 12 prevents the "lost in the woods" feeling
                    map.flyTo([lat, lon], 12, {
                        animate: true,
                        duration: 1.8
                    });

                    searchResults.style.display = 'none';
                    searchInput.value = mainName;
                };
                searchResults.appendChild(div);
            });
        });
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

searchInput.addEventListener('input', debounce((e) => performSearch(e.target.value), 400));

clearSearchBtn.onclick = () => {
    searchInput.value = '';
    searchResults.style.display = 'none';
    searchInput.focus();
};

document.addEventListener('click', (e) => {
    if (!document.querySelector('.search-box').contains(e.target)) {
        searchResults.style.display = 'none';
    }
});

// --- 4. THEME & UI LOGIC ---
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

document.getElementById('current-location').onclick = () => {
    map.locate({setView: true, maxZoom: 16});
};

map.on('locationfound', (e) => {
    L.circle(e.latlng, e.accuracy / 2).addTo(map);
    L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
});

// --- 5. MARKER & SUPABASE FUNCTIONS ---
function placeSavedMarker(pinData) {
    if (!pinData.lat || !pinData.lng) return;
    const marker = L.marker([pinData.lat, pinData.lng]).addTo(map);
    const tags = Array.isArray(pinData.tags) ? pinData.tags.join(', ') : (pinData.tags || 'None');
    marker.bindPopup(`<b>Meta Pin</b><br>Tags: ${tags}`);
}

async function loadSavedPins() {
    const { data } = await supabase.from('metas').select('*');
    if (data) data.forEach(pin => placeSavedMarker(pin));
}

async function savePinToCloud(lat, lng, tags) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { document.getElementById('loginModal').style.display = 'flex'; return; }
    await supabase.from('metas').insert([{ lat, lng, tags, image_url: "" }]);
}

// --- 6. AUTHENTICATION ---
let isSignUpMode = false;
const toggleAuthBtn = document.getElementById('toggle-auth');

if (toggleAuthBtn) {
    toggleAuthBtn.onclick = (e) => {
        e.preventDefault();
        const wrapper = document.querySelector('.auth-content-wrapper');
        wrapper.classList.add('auth-slide-out');
        setTimeout(() => {
            isSignUpMode = !isSignUpMode;
            document.getElementById('auth-title').innerText = isSignUpMode ? "Join us" : "Sign in";
            document.getElementById('auth-action-btn').innerText = isSignUpMode ? "Create Account" : "Get Started";
            toggleAuthBtn.innerText = isSignUpMode ? "Already have an account? Sign In" : "Don't have an account? Create one";
            wrapper.classList.remove('auth-slide-out');
            wrapper.classList.add('auth-slide-in');
            setTimeout(() => wrapper.classList.remove('auth-slide-in'), 50);
        }, 300);
    };
}

document.getElementById('auth-action-btn').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) return alert("Fields cannot be empty");

    let result = isSignUpMode
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) alert(result.error.message);
    else location.reload();
};

document.getElementById('doLogout').onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
};

// --- 7. INITIALIZATION & EVENTS ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedPins();
    supabase.auth.getUser().then(({data}) => {
        if (data.user) {
            document.getElementById('open-login').style.display = 'none';
            document.getElementById('doLogout').style.display = 'flex';
        }
    });

    if (sessionStorage.getItem('termsAccepted') === 'true') {
        document.getElementById('disclaimerModal').style.display = 'none';
    }

    document.getElementById('open-login').onclick = () => document.getElementById('loginModal').style.display = 'flex';

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
    document.getElementById('display-coords').innerText = `${lat}, ${lng}`;
    document.getElementById('modal-lat').value = lat;
    document.getElementById('modal-lng').value = lng;
    document.getElementById('metaModal').style.display = 'flex';
};

window.closeMetaForm = () => {
    document.getElementById('metaModal').style.display = 'none';
    document.querySelectorAll('.meta-tag').forEach(t => t.checked = false);
};

map.on('contextmenu', (e) => {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    L.popup().setLatLng(e.latlng).setContent(`
        <button onclick="window.openMetaForm(${lat}, ${lng})" class="btn-primary-auth" style="padding: 8px 16px; font-size: 12px;">ADD PIN</button>
    `).openOn(map);
});

supabase.channel('public:metas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'metas' }, p => {
    placeSavedMarker(p.new);
}).subscribe();