// --- 1. GLOBAL UI FUNCTIONS ( Ferrari-spec Fixes ) ---

// Smoothly dismiss the disclaimer
window.acceptDisclaimer = () => {
    const modal = document.getElementById('disclaimerModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
};

window.closeMetaForm = () => {
    document.getElementById('metaModal').style.display = 'none';
};

// --- 2. CONFIGURATION ---
const SUPABASE_URL = 'https://zevrtruxhekpzhrsefsp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpldnJ0cnV4aGVrcHpocnNlZnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODE4NDcsImV4cCI6MjA4OTE1Nzg0N30.OvqDoPIwAtw9ZJcVtlAAI4Yvc-UtYJxcuCmULLdAB74';

if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
var supabase = window.supabaseClient;

// --- 3. MAP INITIALIZATION & LAYERS ---
const map = L.map('map', {
    zoomControl: false,
    attributionControl: false
}).setView([15, 0], 3);

const mainMarkers = L.layerGroup().addTo(map);
const highlightLayer = L.layerGroup().addTo(map);

const layers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
};

// Start with Road layer
layers.street.addTo(map);

// --- 4. NAVIGATION & EXPLORER CONTROL ---
const navButtons = document.querySelectorAll('.shortcut-btn');
navButtons.forEach(btn => {
    btn.onclick = function() {
        navButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const page = this.id;
        highlightLayer.clearLayers();
        document.getElementById('gen-filter').style.display = (page === 'nav-gens') ? 'flex' : 'none';

        if (page === 'nav-leaderboard') loadLeaderboard();
        if (page === 'nav-map') {
            document.querySelectorAll('.gen-pill').forEach(p => p.classList.remove('active'));
            loadSavedPins();
        }
    };
});

// --- 5. HIGHLIGHT SYSTEM (Generation Filtering) ---
async function updateMapHighlights(genNum) {
    highlightLayer.clearLayers();
    if (genNum === 'all') {
        loadSavedPins();
        return;
    }

    loadSavedPins('gen' + genNum);

    const { data, error } = await supabase
        .from('coverage_areas')
        .select('geojson_data, color_code')
        .eq('gen_tag', 'gen' + genNum);

    if (error) return console.error("Highlight Error:", error);

    if (data) {
        data.forEach(area => {
            L.geoJSON(area.geojson_data, {
                style: {
                    fillColor: area.color_code,
                    fillOpacity: 0.3,
                    color: area.color_code,
                    weight: 1,
                    opacity: 0.8
                }
            }).addTo(highlightLayer);
        });
    }
}

document.querySelectorAll('.gen-pill').forEach(pill => {
    pill.onclick = function() {
        document.querySelectorAll('.gen-pill').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        updateMapHighlights(this.getAttribute('data-gen'));
    };
});

// --- 6. SEARCH LOGIC ---
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const clearSearchBtn = document.getElementById('clear-search');

searchInput.addEventListener('input', (e) => {
    clearSearchBtn.style.display = e.target.value.length > 0 ? 'flex' : 'none';
});

function performSearch(query) {
    if (query.length < 3) { searchResults.style.display = 'none'; return; }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
        .then(res => res.json())
        .then(data => {
            searchResults.innerHTML = '';
            if (!data.length) { searchResults.style.display = 'none'; return; }
            searchResults.style.display = 'block';
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `<i class="fas fa-map-marker-alt" style="margin-right:10px;"></i> <span>${item.display_name.split(',')[0]}</span>`;
                div.onclick = () => {
                    map.flyTo([item.lat, item.lon], 12, { animate: true });
                    searchResults.style.display = 'none';
                    searchInput.value = item.display_name.split(',')[0];
                };
                searchResults.appendChild(div);
            });
        });
}

function debounce(func, wait) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}
searchInput.addEventListener('input', debounce((e) => performSearch(e.target.value), 400));

clearSearchBtn.onclick = () => {
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchResults.style.display = 'none';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
};

// --- 7. MARKER SYSTEM ---
function placeSavedMarker(pinData) {
    const img = pinData.image_url || 'https://via.placeholder.com/300x150';
    const genLabel = pinData.gen_tag ? pinData.gen_tag.toUpperCase() : 'META';
    const marker = L.marker([pinData.lat, pinData.lng]);
    const cardHtml = `
        <div class="meta-card">
            <img src="${img}" class="meta-card-img">
            <div class="meta-card-body">
                <span class="meta-card-tag">${genLabel}</span>
                <p class="meta-card-desc">${pinData.description}</p>
                <div class="meta-card-user">
                    <i class="fas fa-user-circle"></i> ${pinData.username || 'Anonymous'}
                </div>
            </div>
        </div>
    `;
    marker.bindPopup(cardHtml).addTo(mainMarkers);
}

async function loadSavedPins(filterGen = null) {
    mainMarkers.clearLayers();
    let query = supabase.from('metas').select('*');
    if (filterGen) query = query.eq('gen_tag', filterGen);
    const { data } = await query;
    if (data) data.forEach(pin => placeSavedMarker(pin));
}

// --- 8. SCOREBOARD & PROFILE ---
async function loadLeaderboard() {
    document.getElementById('leaderboardModal').style.display = 'flex';
    const { data } = await supabase.from('profiles').select('*').order('pins_count', { ascending: false }).limit(10);
    const container = document.getElementById('leaderboard-list');
    if (!data || data.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#64748b;">No contributors yet.</p>`;
        return;
    }
    container.innerHTML = data.map((u, i) => `
        <div class="leaderboard-row">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-weight:800; color:var(--primary);">#${i+1}</span>
                <img src="${u.pfp_url || 'https://via.placeholder.com/30'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                <span style="font-weight:600;">${u.username || 'Anonymous'}</span>
            </div>
            <span style="font-size:12px; font-weight:700; background:#f1f5f9; padding:4px 8px; border-radius:8px; color:#1e293b;">${u.pins_count || 0} PINS</span>
        </div>
    `).join('');
}

document.getElementById('open-profile').onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { document.getElementById('loginModal').style.display = 'flex'; return; }
    document.getElementById('profileModal').style.display = 'flex';
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
        document.getElementById('display-username').innerText = profile.username || "Explorer";
        document.getElementById('update-username').value = profile.username || "";
        document.getElementById('update-pfp').value = profile.pfp_url || "";
    }
};

// --- 9. AUTHENTICATION ( Login / Sign Up ) ---
let isSignUpMode = false; // Add toggle logic if you have a toggle button
document.getElementById('auth-action-btn').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Captcha handling (Ensure hcaptcha is loaded in HTML)
    const captchaResponse = typeof hcaptcha !== 'undefined' ? hcaptcha.getResponse() : "skipped";
    if (!email || !password) return alert("Please fill all fields");

    let result;
    if (isSignUpMode) {
        result = await supabase.auth.signUp({ email, password });
    } else {
        result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error) alert(result.error.message);
    else location.reload();
};

// --- 10. SUBMIT NEW META ( THE BIG FIX ) ---
document.getElementById('finalSubmit').onclick = async function() {
    const btn = this;
    const desc = document.getElementById('modal-desc').value;
    const gen = document.querySelector('input[name="gen-select"]:checked')?.value;

    if (!desc || !gen) return alert("Description and Gen are required");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("You must be logged in to submit.");

    btn.disabled = true;
    btn.innerText = "Uploading...";

    try {
        let imageUrl = "";
        const fileInput = document.getElementById('modal-file');

        // 1. Handle Image Upload
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('meta-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            imageUrl = supabase.storage.from('meta-images').getPublicUrl(fileName).data.publicUrl;
        }

        // 2. Get real username from Profile
        const { data: profile } = await supabase.from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();

        const finalUsername = profile?.username || user.email.split('@')[0] || 'Explorer';

        // 3. Insert into Database
        const { error: insertError } = await supabase.from('metas').insert([{
            lat: parseFloat(document.getElementById('modal-lat').value),
            lng: parseFloat(document.getElementById('modal-lng').value),
            description: desc,
            gen_tag: gen,
            image_url: imageUrl,
            username: finalUsername,
            user_id: user.id
        }]);

        if (insertError) throw insertError;

        // 4. Update Score
        await supabase.rpc('increment_pin_count', { user_id: user.id });

        location.reload();

    } catch (err) {
        console.error(err);
        alert("Submission failed: " + err.message);
        btn.disabled = false;
        btn.innerText = "Submit Meta";
    }
};

// --- 11. INITIALIZE & FERRARI LAYER CONTROL ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedPins();
    supabase.auth.getUser().then(({data}) => {
        if (data.user) {
            if (document.getElementById('open-login')) document.getElementById('open-login').style.display = 'none';
            if (document.getElementById('doLogout')) document.getElementById('doLogout').style.display = 'flex';
        }
    });
});

document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.onclick = function() {
        const type = this.getAttribute('data-layer');

        Object.values(layers).forEach(layer => map.removeLayer(layer));
        layers[type].addTo(map);

        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Smart Filter class toggling
        document.body.classList.remove('satellite-active', 'topo-active');
        if (type === 'satellite') document.body.classList.add('satellite-active');
        if (type === 'topo') document.body.classList.add('topo-active');
    };
});

window.openMetaForm = (lat, lng) => {
    document.getElementById('display-coords').innerText = `${lat}, ${lng}`;
    document.getElementById('modal-lat').value = lat;
    document.getElementById('modal-lng').value = lng;
    document.getElementById('metaModal').style.display = 'flex';
};

map.on('contextmenu', (e) => window.openMetaForm(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)));

document.getElementById('theme-toggle').onclick = () => document.body.classList.toggle('dark-theme');

document.getElementById('doLogout').onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
};