/* Kaizen Portal - Script.js (Refined Global & Map-Interaction) */

// --- GLOBAL STATE ---
let map;
let activeMarkerLayer = null; 
let tempCoords = null;
let tempMarker = null; 
let tempRelX = 0;
let tempRelY = 0;
let scale = 1;
let isDragging = false;
let startX, startY;
let translateX = 0;
let translateY = 0;
let improvementCache = [];
let dashboardMap;
let floorLookup = {}; // New lookup for O(1) access

// Mock User Data - will be updated by session if available
let currentUser = { id: "USR001", role: "admin", name: "System Admin" }; 

// --- 1. CONFIGURATION ---
const factoryConfig = {
    "第一工場": {
        folder: "1st Factory",
        floors: {
            "1階": { path: "1st_Factory_1F.png", id: "f1_1f" },
            "2階": { path: "1st_Factory_2F-1.png", id: "f1_2f_1" },
            "3階": { path: "1st_Factory_3F.png", id: "f1_3f" },
            "屋外": { path: "1st_Factory_Outdoor.png", id: "f1_od" },
            "屋上": { path: "1st_Factory_RF.png", id: "f1_rf" }
        }
    },
    "第二工場": {
        folder: "2nd Factory",
        floors: {
            "1階": { path: "2nd_Factory_1F.png", id: "f2_1f" },
            "2階": { path: "2nd_Factory_2F.png", id: "f2_2f" },
            "3階": { path: "2nd_Factory_3F.png", id: "f2_3f" },
            "屋外": { path: "2nd_Factory_Outdoor.png", id: "f2_od" }
        }
    },
    "第三工場": {
        folder: "3rd Factory",
        floors: {
            "1階": { path: "3rd_Factory_1F.png", id: "f3_1f" }
        }
    },
    "豊田工場": {
        folder: "Toyota Factory",
        floors: {
            "1階": { path: "Toyota_Factory_1F.png", id: "tf_1f" },
            "2階": { path: "Toyota_Factory_2F.png", id: "tf_2f" },
            "3階": { path: "Toyota_Factory_3F.png", id: "tf_3f" },
            "屋外": { path: "Toyota_Factory_Outdoor.png", id: "tf_od" }
        }
    }
};

const office_othersConfig = {
    "事務棟": {
        folder: "Head Office",
        floors: {
            "1階": { path: "Head_Office_1F.png", id: "ho_1f" },
            "2階": { path: "Head_Office_2F.png", id: "ho_2f" },
            "3階": { path: "Head_Office_3F.png", id: "ho_3f" },
            "屋外": { path: "Head_Office_Outdoor.png", id: "ho_od" },
            "屋上": { path: "Head_Office_RF.png", id: "ho_rf" }
        }
    },
    "倉庫": {
        folder: "Material Warehouse",
        floors: {
            "1階": { path: "Material_Warehouse_1F.png", id: "wh_1f" },
            "2階": { path: "Material_Warehouse_2F.png", id: "wh_2f" },
            "3階": { path: "Material_Warehouse_3F.png", id: "wh_3f" },
        }
    }
};

const markers = {};
const allConfigs = [factoryConfig, office_othersConfig];

// Initialize Lookup Table
allConfigs.forEach(configSet => {
    for (const building in configSet) {
        Object.entries(configSet[building].floors).forEach(([floorName, floorInfo]) => {
            markers[floorInfo.id] = L.layerGroup();
            floorLookup[floorInfo.id] = {
                building,
                floorName,
                folder: configSet[building].folder,
                path: floorInfo.path,
                fullPath: `/static/resource/Company Blueprints/${configSet[building].folder}/${floorInfo.path}`
            };
        });
    }
});

function showSection(sectionId) {
    const sections = ['home', 'map', 'list', 'personal', 'profile', 'settings'];
    closeKaizenSidePanel(); 
    clearTempMarker();

    sections.forEach(s => {
        const content = document.getElementById('content-' + s);
        const link = document.getElementById('link-' + s);
        if (content) content.classList.add('hidden');
        if (link) link.classList.remove('nav-active');
    });

    const activeSection = document.getElementById('content-' + sectionId);
    if (activeSection) activeSection.classList.remove('hidden');

    const activeLink = document.getElementById('link-' + sectionId);
    if (activeLink) activeLink.classList.add('nav-active');

    if (sectionId === 'map') {
        initMap(); // Initializes if not already created
        setTimeout(() => { 
            if (map) {
                map.invalidateSize();    // Recalculates map dimensions
                syncMarkersToMainMap();  // CRITICAL: Forces pins to render now
            }
        }, 200);
    } else if (sectionId === 'home') {
        setTimeout(() => {
            updateDashboardMap();
            if (dashboardMap) {
                dashboardMap.invalidateSize();
                const bounds = [[0, 0], [1500, 2250]];
                dashboardMap.fitBounds(bounds, { animate: false });
            }
        }, 150);
    }
}

// --- 3. LEAFLET MAP CORE ---
function initMap() {
    if (!map) {
        map = L.map('kaizen-map', {
            crs: L.CRS.Simple,
            minZoom: -1,
            maxZoom: 2,
            attributionControl: false
        });

        const bounds = [[0, 0], [1500, 2250]];
        const basePath = '/static/resource/Company Blueprints/';

        function buildTreeBranch(configSet) {
            let branch = [];
            for (const buildingName in configSet) {
                const buildingData = configSet[buildingName];
                const buildingNode = { label: buildingName, children: [] };
                
                for (const floorName in buildingData.floors) {
                    const config = buildingData.floors[floorName];
                    const fullPath = `${basePath}${buildingData.folder}/${config.path}`;
                    
                    const imgOverlay = L.imageOverlay(fullPath, bounds);
                    const combinedGroup = L.layerGroup([imgOverlay, markers[config.id]]);
                    
                    buildingNode.children.push({
                        label: floorName,
                        layer: combinedGroup,
                        selected: (config.id === 'f1_1f') 
                    });

                    if (config.id === 'f1_1f') {
                        combinedGroup.addTo(map);
                        activeMarkerLayer = markers[config.id];
                        updateFloorLabel(buildingName, floorName);
                    }
                }
                branch.push(buildingNode);
            }
            return branch;
        }

        const fullTreeData = [
            { label: '工場エリア (Factories)', children: buildTreeBranch(factoryConfig) },
            { label: '事務・倉庫 (Office & Warehouse)', children: buildTreeBranch(office_othersConfig) }
        ];

        L.control.layers.tree(fullTreeData, null, { 
            collapsed: true, 
            position: 'topleft' 
        }).addTo(map);

        map.on('baselayerchange', function(e) {
            const floorId = Object.keys(markers).find(id => e.layer.hasLayer(markers[id]));
            if (floorId) activeMarkerLayer = markers[floorId];
            
            const info = floorLookup[floorId];
            if (info) {
                updateFloorLabel(info.building, info.floorName);
            }
            clearTempMarker();
        });

        map.on('click', function(e) {
            const prompt = document.getElementById('map-bottom-prompt');
            const panel = document.getElementById('kaizen-side-panel');
            
            if ((prompt && !prompt.classList.contains('hidden')) || (panel && !panel.classList.contains('hidden'))) {
                clearTempMarker();
                closeKaizenSidePanel();
                return;
            }
            
            tempCoords = e.latlng;
            const greyIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });

            if (tempMarker) {
                tempMarker.setLatLng(e.latlng);
                if (!map.hasLayer(tempMarker)) tempMarker.addTo(map);
            } else {
                tempMarker = L.marker(e.latlng, { icon: greyIcon }).addTo(map);
                tempMarker.on('click', (ev) => L.DomEvent.stopPropagation(ev));
            }

            if (prompt) {
                prompt.classList.remove('hidden');
                setTimeout(() => { prompt.style.transform = 'translate(-50%, 0)'; }, 10);
            }
        });

        map.fitBounds(bounds);
    } else {
        setTimeout(() => { map.invalidateSize(); }, 100);
    }
}

// --- 3.2 MARKER SYNC LOGIC ---
function syncMarkersToMainMap() {
    // hashing console.log("Syncing markers. Cache size:", improvementCache.length); // Debug
    // console.log("Syncing markers. Cache size:", improvementCache.length); // Debug
    // 1. Clear existing markers
    Object.values(markers).forEach(layerGroup => layerGroup.clearLayers());

    // 2. Loop through fetched data
    improvementCache.forEach(report => {

        // console.log("Processing report:", report.id, "Floor ID from DB:", report.floorId); // Debug
        const layer = markers[report.floorId];
        
        if (layer) {
            const marker = L.marker([report.lat, report.lng]);
            
            marker.bindPopup(`
                <div class="p-2">
                    <h3 class="font-bold border-b mb-1">${report.title}</h3>
                    <p class="text-xs text-slate-600">${report.category} | ${report.status}</p>
                    <button onclick="openViewModal(${JSON.stringify(report).replace(/"/g, '&quot;')})" class="mt-2 text-blue-500 text-xs font-bold">VIEW DETAILS</button>
                </div>
            `);
            
            layer.addLayer(marker);
            //console.log(`Added marker to layer: ${report.floorId}`); // Debug
            // --- ADD THIS LOGIC ---
            // If this marker belongs to the floor currently being looked at, 
            // manually add it to the map to ensure visibility.
            if (activeMarkerLayer === layer && map) {
                marker.addTo(map);
            }
        }
    });
}

// --- 4. FORM LOGIC ---
window.openFullForm = function(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    
    // 1. Detect which floor is currently active/visible on the map
    let activeFloorId = "";
    for (const id in markers) {
        if (map.hasLayer(markers[id])) {
            activeFloorId = id;
            break;
        }
    }

    // 2. Open the UI
    openKaizenSidePanel();

    // 3. Sync Dropdowns & Trigger the Mini-Map Pin
    if (activeFloorId) {
        syncDropdownsToFloor(activeFloorId);
        
        // IMPORTANT: Manually trigger a 'change' event on the floor selector 
        // to force the mini-map (Step 3 logic) to render the blueprint and pin.
        const fSel = document.getElementById('select-floor');
        if (fSel) {
            fSel.dispatchEvent(new Event('change'));
        }
    }

    // 4. Update Coordinate UI
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay && tempCoords) {
        coordDisplay.innerText = "Location Set via Map Click";
        coordDisplay.classList.remove('text-amber-500', 'animate-pulse');
        coordDisplay.classList.add('text-green-600');
    }
};

window.submitKaizenForm = async function() {
    // 1. Collect Form Data
    const title = document.getElementById('kaizen-title').value;
    const desc = document.getElementById('kaizen-description').value;
    const method = document.getElementById('kaizen-method')?.value || "";
    const benefits = document.getElementById('kaizen-benefits')?.value || "";
    const categoryEl = document.querySelector('input[name="kubun"]:checked');
    const category = categoryEl ? categoryEl.value : "others";
    const selectedFloorId = document.getElementById('select-floor').value;
    
    // Image Handling
    const photoSrc = document.getElementById('form-photo-preview')?.src;
    const finalImage = (photoSrc && photoSrc.startsWith('data:image')) ? photoSrc : (photoSrc || null);

    // 2. Validation
    if (!title || !desc) return alert("件名と内容は必須です。");
    if (!tempCoords) return alert("場所をピン留めしてください。");

    try {
        // 3. POST to API (Using underscore floor_id for Python)
        const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                description: desc,
                method: method,
                benefits: benefits,
                category: category,
                floor_id: selectedFloorId || null,
                lat: tempCoords.lat,
                lng: tempCoords.lng,
                photo: finalImage
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Server error');
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // --- THE AUTO-UPDATE MAGIC ---
            
            // A. Re-fetch all reports from DB (updates improvementCache)
            // This ensures naming (floorId) and IDs are 100% correct.
            await loadAllReports(); 

            // B. Trigger UI Re-renders
            if (typeof syncMarkersToMainMap === 'function') syncMarkersToMainMap();
            if (typeof renderPersonalKaizenList === 'function') renderPersonalKaizenList();
            if (typeof updateDashboardMap === 'function') updateDashboardMap();
            
            alert(result.message || "改善提案を登録しました！");
            
            // C. Cleanup UI
            window.closeKaizenSidePanel();
            resetRegistrationForm();
            
            // D. Remove the temporary red "placement" pin if it exists
            if (window.tempMarker) {
                map.removeLayer(window.tempMarker);
                window.tempMarker = null;
            }
            window.tempCoords = null;

        } else {
            alert(`エラー: ${result.message || 'Unknown error'}`);
        }
    } catch (err) {
        console.error("Save failed:", err);
        alert(`保存に失敗しました: ${err.message}`);
    }
};

// Helper to clear the form for the next use
function resetRegistrationForm() {
    document.getElementById('kaizen-title').value = "";
    document.getElementById('kaizen-description').value = "";
    if(document.getElementById('kaizen-method')) document.getElementById('kaizen-method').value = "";
    if(document.getElementById('kaizen-benefits')) document.getElementById('kaizen-benefits').value = "";
    
    // Clear Photo
    const preview = document.getElementById('form-photo-preview');
    if (preview) {
        preview.src = "";
        preview.classList.add('hidden');
    }
    const placeholder = document.getElementById('upload-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');

    // Reset Coordinates
    tempCoords = null;
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay) {
        coordDisplay.innerText = "マップ上で場所を選択してください";
        coordDisplay.classList.add('text-amber-500');
    }
}

function renderImprovementList() {
    const listBody = document.getElementById('improvement-list-body');
    if (!listBody) return;

    listBody.innerHTML = '';

    if (improvementCache.length === 0) {
        listBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">データがありません</td></tr>`;
        return;
    }

    improvementCache.forEach(item => {
        const row = document.createElement('tr');
        row.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer";
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td class="p-4 text-xs text-slate-500">${item.date}</td>
            <td class="p-4 text-sm font-bold text-slate-700">${item.title}</td>
            <td class="p-4 text-xs text-slate-600">${item.user}</td>
            <td class="p-4 text-xs text-slate-600 truncate max-w-[200px]">${item.description}</td>
            <td class="p-4 text-xs"><span class="px-2 py-1 bg-blue-100 text-blue-600 rounded-full font-bold">${item.category}</span></td>
            <td class="p-4 text-xs text-amber-500 font-bold">Pending</td>
        `;
        
        // Click event to view/edit improvement details
        row.addEventListener('click', function() {
            openViewModal(item);
        });
        
        listBody.appendChild(row);
    });
}

// Render Personal Kaizen List - displays user's own contributions
function renderPersonalKaizenList() {
    const personalContainer = document.getElementById('personal-kaizen-list');
    if (!personalContainer) return;

    personalContainer.innerHTML = '';

    if (improvementCache.length === 0) {
        personalContainer.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400"><p>まだ改善提案がありません</p></div>`;
        return;
    }

    improvementCache.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all cursor-pointer group";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex-1">${item.title}</h3>
                <span class="px-2 py-1 bg-blue-100 text-blue-600 rounded-full font-bold text-[10px]">${item.category}</span>
            </div>
            <p class="text-xs text-slate-500 mb-3">${item.date} | ${item.floorId}</p>
            <p class="text-sm text-slate-600 line-clamp-2 mb-3">${item.description}</p>
            <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                <span class="text-xs text-amber-500 font-bold">Status: Pending</span>
                <button onclick="event.stopPropagation(); openViewModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="text-blue-600 hover:text-blue-700 font-bold text-xs">
                    詳細 &rarr;
                </button>
            </div>
        `;
        
        // Click event to view details
        card.addEventListener('click', function() {
            openViewModal(item);
        });
        
        personalContainer.appendChild(card);
    });
}

// --- 5. LIGHTBOX INTERACTION (DRAG/ZOOM) ---
function initLightbox() {
    const viewport = document.getElementById('lightbox-viewport');
    const container = document.getElementById('lightbox-container');
    const lightbox = document.getElementById('map-lightbox'); // Added reference

    if (!viewport || !container) return;

    // 1. Zoom Logic (Keep as is, it's good)
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const imageX = (mouseX - translateX) / scale;
        const imageY = (mouseY - translateY) / scale;

        const delta = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.min(Math.max(scale * delta, 0.5), 5);

        translateX = mouseX - imageX * newScale;
        translateY = mouseY - imageY * newScale;
        scale = newScale;

        updateTransform();
    }, { passive: false });

    // 2. Drag Logic (Keep as is, helpful for viewing details)
    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        if(viewport) viewport.style.cursor = 'grab';
    });

    // 3. Click Logic (MODIFIED for View-Only)
    viewport.onclick = function(e) {
        // --- NEW: BLOCK IF READ-ONLY ---
        if (lightbox.dataset.readOnly === "true") return;

        // Prevent pinning if the user was actually dragging the map
        if (Math.abs(e.movementX) > 5 || Math.abs(e.movementY) > 5) return; 

        const pin = document.getElementById('lightbox-pin');
        const img = document.getElementById('lightbox-img');
        
        // If pin exists, clicking removes it (Toggle behavior)
        if (pin && !pin.classList.contains('hidden')) {
            pin.classList.add('hidden');
            tempRelX = 0;
            tempRelY = 0;
            
            const coordDisplay = document.getElementById('display-coords');
            if(coordDisplay) {
                coordDisplay.innerText = "マップ上で場所を選択してください";
                coordDisplay.classList.add('text-amber-500', 'animate-pulse');
                coordDisplay.classList.remove('text-green-600');
            }
            return;
        }

        // Calculate position relative to the image container
        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        if (pin) {
            pin.style.left = `${x}px`;
            pin.style.top = `${y}px`;
            // Ensure tip alignment
            pin.style.transform = 'translate(-50%, -100%)'; 
            pin.classList.remove('hidden');
        }

        // Save relative coordinates for the "Confirm" function
        if (img) {
            tempRelX = x / img.offsetWidth;
            tempRelY = y / img.offsetHeight;
        }
    };
}

function updateTransform() {
    const container = document.getElementById('lightbox-container');
    if (container) container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

window.openMapLightbox = function(path, floorId, isReadOnly = false) {
    const lightbox = document.getElementById('map-lightbox');
    const img = document.getElementById('lightbox-img');
    const viewport = document.getElementById('lightbox-viewport');
    const pin = document.getElementById('lightbox-pin');
    
    // Select footer buttons by their specific IDs for precision
    const confirmBtn = document.getElementById('lightbox-confirm-btn');
    const cancelBtn = document.getElementById('lightbox-cancel-btn');

    if (!img || !viewport) return;

    // 1. Layering Fix: Match your new style.css hierarchy
    lightbox.style.zIndex = "15000"; 
    lightbox.dataset.readOnly = isReadOnly;

    // 2. Button Aesthetic Logic
    if (isReadOnly) {
        // Hide 'Set Location' completely
        if (confirmBtn) confirmBtn.style.display = 'none';
        
        // Morph 'Cancel' into the primary 'Back' button
        if (cancelBtn) {
        cancelBtn.innerText = "戻す";
        // Remove the old grey styles and add the new 'neat' blue styles
        cancelBtn.className = "px-8 py-3 rounded-xl font-bold text-white bg-blue-600 shadow-lg transition-all";
    }
    } else {
        // Restore standard Drafting Mode appearance
        if (confirmBtn) {
            confirmBtn.style.display = 'block';
            confirmBtn.innerText = "場所を確定";
        }
        if (cancelBtn) {
            cancelBtn.innerText = "キャンセル";
            cancelBtn.classList.remove('bg-blue-600', 'text-white');
            cancelBtn.classList.add('bg-slate-200', 'text-slate-700');
        }
    }

    // 3. Image & Pin Positioning Logic
    img.src = path;
    scale = 1;

    img.onload = function() {
        // Center image in viewport
        translateX = (viewport.offsetWidth - img.offsetWidth) / 2;
        translateY = (viewport.offsetHeight - img.offsetHeight) / 2;
        updateTransform();

        if (tempCoords) {
            // Using your established coordinate mapping
            const pixelX = (tempCoords.lng / 2250) * img.offsetWidth;
            const pixelY = (1 - (tempCoords.lat / 1500)) * img.offsetHeight;

            if (pin) {
                pin.style.left = `${pixelX}px`;
                pin.style.top = `${pixelY}px`;
                // Crucial: Keep the tip of the pin on the spot
                pin.style.transform = 'translate(-50%, -100%)';
                pin.classList.remove('hidden');
            }
        } else {
            if (pin) pin.classList.add('hidden');
        }
    };

    // 4. Smooth Transition
    lightbox.classList.remove('hidden');
    setTimeout(() => lightbox.classList.add('opacity-100'), 10);
};

window.resetLightboxView = function() {
    const vp = document.getElementById('lightbox-viewport');
    const img = document.getElementById('lightbox-img');
    scale = 1;
    if (vp && img) {
        translateX = (vp.offsetWidth - img.offsetWidth) / 2;
        translateY = (vp.offsetHeight - img.offsetHeight) / 2;
    } else {
        translateX = 0;
        translateY = 0;
    }
    updateTransform();
};

window.confirmLightboxLocation = function() {
    const pin = document.getElementById('lightbox-pin');
    if (!pin || pin.classList.contains('hidden')) {
        alert("場所をピン留めしてください");
        return;
    }

    const percentX = tempRelX * 100;
    const percentY = tempRelY * 100;

    const miniPin = document.getElementById('mini-pin');
    if (miniPin) {
        miniPin.style.left = `${percentX}%`;
        miniPin.style.top = `${percentY}%`;
        miniPin.style.transform = 'translate(-50%, -100%)';
        miniPin.classList.remove('hidden');
    }

    tempCoords = { lat: (1 - tempRelY) * 1500, lng: tempRelX * 2250 };
    
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay) {
        coordDisplay.innerText = "Location Set";
        coordDisplay.classList.remove('animate-pulse', 'text-amber-500');
        coordDisplay.classList.add('text-green-600');
    }
    window.closeMapLightbox();
};

window.closeMapLightbox = () => {
    const lightbox = document.getElementById('map-lightbox');
    if (!lightbox) return;
    lightbox.classList.remove('opacity-100');
    setTimeout(() => lightbox.classList.add('hidden'), 300);
};

// --- 6. UTILITIES ---
function clearTempMarker() {
    if (tempMarker && map) map.removeLayer(tempMarker);
    tempMarker = null;
    const prompt = document.getElementById('map-bottom-prompt');
    if (prompt) {
        prompt.style.transform = 'translate(-50%, 200%)';
        setTimeout(() => prompt.classList.add('hidden'), 300);
    }
    tempCoords = null;
}

window.openKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    if (panel) {
        panel.classList.remove('hidden');
        updateFormDate(); 
        setTimeout(() => { 
            panel.style.transform = 'translateX(0)'; 
            if (overlay) { 
                overlay.classList.remove('hidden'); 
                overlay.style.pointerEvents = 'auto'; // Ensure it can catch clicks to close
                setTimeout(() => overlay.classList.add('opacity-100'), 10);
            }
        }, 10);
    }
};

window.closeKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    
    if (panel) {
        panel.style.transform = 'translateX(100%)';
        
        if (overlay) {
            overlay.classList.remove('opacity-100');
            overlay.style.pointerEvents = 'none'; // STOP BLOCKING CLICKS IMMEDIATELY
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        }

        // Reset inputs
        const titleInput = document.getElementById('kaizen-title');
        const descInput = document.getElementById('kaizen-description');
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';

        setTimeout(() => { 
            panel.classList.add('hidden');
            const coordDisplay = document.getElementById('display-coords');
            if(coordDisplay) {
                coordDisplay.innerText = "場所を選択してください";
                coordDisplay.classList.remove('text-green-600');
                coordDisplay.classList.add('text-amber-500', 'animate-pulse');
            }
        }, 300);
    }
};

function updateFloorLabel(building, floor) {
    const label = document.getElementById('active-floor-name');
    if (label) label.innerText = `${building} - ${floor}`;
}

function updateFormDate() {
    const dateElement = document.getElementById('current-submission-date');
    if(!dateElement) return;
    const now = new Date();
    dateElement.innerText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function updateDashboardClock() {
    const clockElement = document.getElementById('dashboard-clock');
    if (!clockElement) return;
    const now = new Date();
    clockElement.innerText = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function updateDashboardMap() {
    const mapContainer = document.getElementById('dashboard-mini-map');
    if (!mapContainer) return;

    if (!dashboardMap) {
        dashboardMap = L.map('dashboard-mini-map', {
            crs: L.CRS.Simple,
            zoomControl: false,
            dragging: false, // Set to false for a cleaner "preview" feel
            scrollWheelZoom: false,
            attributionControl: false,
            minZoom: -2,
            maxZoom: 1
        });

        // Redirect to full map when the dashboard preview is clicked
        dashboardMap.on('click', () => showSection('map'));
    } else {
        dashboardMap.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.ImageOverlay) {
                dashboardMap.removeLayer(layer);
            }
        });
    }

    const latestEntry = improvementCache[improvementCache.length - 1];
    const floorToDisplay = latestEntry ? latestEntry.floorId : "F1_A"; 
    const blueprintPath = floorLookup[floorToDisplay]?.fullPath;
    const bounds = [[0, 0], [1500, 2250]];

    if (blueprintPath) {
        L.imageOverlay(blueprintPath, bounds).addTo(dashboardMap);

        improvementCache.forEach(item => {
            if (item.floorId === floorToDisplay) {
                // Set interactive: false so clicks pass through to the map container
                const marker = L.marker(item.coords, { interactive: false }).addTo(dashboardMap);
                
                marker.bindTooltip(item.title, { 
                    permanent: false, 
                    direction: 'top',
                    className: 'dashboard-tooltip' 
                });
            }
        });

        dashboardMap.fitBounds(bounds, { animate: false });
    }
}

function syncDropdownsToFloor(floorId) {
    const mainAreaSel = document.getElementById('select-main-area');
    const bSel = document.getElementById('select-building');
    const fSel = document.getElementById('select-floor');

    const info = floorLookup[floorId];
    if (info) {
        const areaKey = (info.folder.includes('Factory')) ? 'factory' : 'office';
        
        mainAreaSel.value = areaKey;
        mainAreaSel.dispatchEvent(new Event('change'));

        bSel.value = info.building;
        bSel.dispatchEvent(new Event('change'));

        fSel.value = floorId;
        fSel.dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            const miniPin = document.getElementById('mini-pin');
            if (miniPin && tempCoords) {
                const relX = (tempCoords.lng / 2250) * 100;
                const relY = (1 - (tempCoords.lat / 1500)) * 100;
                miniPin.style.left = `${relX}%`;
                miniPin.style.top = `${relY}%`;
                miniPin.style.transform = 'translate(-50%, -100%)';
                miniPin.classList.remove('hidden');
            }
        }, 150);
    }
}

window.openImprovementDetails = function(data) {
    // Open the side panel (the same one used for the form)
    openKaizenSidePanel();

    // Fill the fields with the "submitted" data
    document.getElementById('kaizen-title').value = data.title;
    document.getElementById('kaizen-description').value = data.description;
    document.getElementById('kaizen-method').value = data.method || "";
    document.getElementById('kaizen-benefits').value = data.benefits || "";
    document.getElementById('select-floor').value = data.floorId;

    // Set the category radio button
    const categoryRadio = document.querySelector(`input[name="kubun"][value="${data.category}"]`);
    if (categoryRadio) categoryRadio.checked = true;

    // Set the location coordinates for editing
    tempCoords = data.coords || null;
    
    // Update the coordinates display
    const coordDisplay = document.getElementById('display-coords');
    if (coordDisplay && tempCoords) {
        coordDisplay.innerText = "Location already set";
        coordDisplay.classList.remove('text-amber-500', 'animate-pulse');
        coordDisplay.classList.add('text-green-600');
    }

    // Sync the mini-map to show the selected floor
    syncDropdownsToFloor(data.floorId);

    // Change the panel title or button to "View/Edit" mode if needed
    const submitBtn = document.querySelector('#kaizen-side-panel button[onclick="submitKaizenForm()"]');
    if (submitBtn) {
        submitBtn.innerText = "更新する (Update)";
        // You would likely update the onclick here to a different edit function
    }
};

// Helper function to find blueprint path from floorId
function getBlueprintPathFromFloorId(floorId) {
    return floorLookup[floorId]?.fullPath || null;
}

// --- VIEW MODAL LOGIC (Fully Updated & Optimized) ---
window.openViewModal = async function(data) {
    const modal = document.getElementById('kaizen-view-modal');
    if (!modal) return;
    
    // 1. Fetch Fresh Data if only an ID is provided
    if (data && data.id && !data.title) {
        try {
            const response = await fetch(`/api/reports/${data.id}`);
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    data = result.data;
                }
            }
        } catch (err) {
            console.error("Failed to load report details:", err);
            return;
        }
    }
    
    // Save coordinates for potential reference
    tempCoords = data.coords;

    // 2. Map Text Data to UI
    document.getElementById('view-modal-title').innerText = data.title || "No Title";
    document.getElementById('view-modal-user').innerText = data.user || "System Admin";
    document.getElementById('view-modal-date').innerText = data.date || "-";
    document.getElementById('view-modal-description').innerText = data.description || "No description provided.";
    document.getElementById('view-modal-method').innerText = data.method && data.method.trim() !== "" ? data.method : "改善案が未設定です";
    document.getElementById('view-modal-benefits').innerText = data.benefits && data.benefits.trim() !== "" ? data.benefits : "期待効果が未設定です";
    
    // 3. Classification Badge & Row Logic
    const classificationBadge = document.getElementById('classification-badge');
    const classificationText = document.getElementById('classification-text');
    
    if (classificationText && classificationBadge) {
        classificationText.innerText = data.category ? data.category.toUpperCase() : "GENERAL";
        const colorMap = {
            'production': '#ef4444', 'cost': '#f59e0b', 'quality': '#8b5cf6',
            'safety': '#ef4444', '5s': '#10b981', 'others': '#3b82f6'
        };
        classificationBadge.style.backgroundColor = colorMap[data.category] || '#3b82f6';
    }

    const classificationMap = {
        'production': 'view-modal-class-production',
        'cost': 'view-modal-class-cost',
        'quality': 'view-modal-class-quality',
        'safety': 'view-modal-class-safety',
        '5s': 'view-modal-class-5s',
        'others': 'view-modal-class-others'
    };
    
    Object.values(classificationMap).forEach(id => {
        const classEl = document.getElementById(id);
        if (classEl) {
            classEl.classList.remove('bg-blue-600', 'border-blue-600', 'text-white', 'shadow-sm');
            classEl.classList.add('border-slate-200', 'text-slate-400');
        }
    });
    
    if (data.category && classificationMap[data.category]) {
        const selectedEl = document.getElementById(classificationMap[data.category]);
        if (selectedEl) {
            selectedEl.classList.remove('border-slate-200', 'text-slate-400');
            selectedEl.classList.add('bg-blue-600', 'border-blue-600', 'text-white', 'shadow-sm');
        }
    }

    // 4. Evidence Image Handler (The Visibility Fix)
    const imgEl = document.getElementById('view-image');
    const placeholderEl = document.getElementById('view-placeholder');
    const rawPath = data.photo || data.image || "";
    const imagePath = rawPath.trim();

    // Reset state before loading
    imgEl.classList.add('hidden');
    imgEl.style.display = 'none';
    if (placeholderEl) placeholderEl.style.display = 'flex';

    if (imagePath !== "") {
        let finalSrc;
        
        // Build correct path
        if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
            finalSrc = imagePath;
        } else if (imagePath.startsWith('/static/uploads/') || imagePath.startsWith('static/uploads/')) {
            finalSrc = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
        } else {
            finalSrc = `/static/uploads/${imagePath}`;
        }
        
        // Set Source
        imgEl.src = finalSrc;
        
        // Wait for image load to trigger visibility (prevents render lag)
        imgEl.onload = () => {
            imgEl.classList.remove('hidden');
            imgEl.style.display = 'block';
            if (placeholderEl) placeholderEl.style.display = 'none';
        };

        // Fallback for cached images
        if (imgEl.complete) {
            imgEl.classList.remove('hidden');
            imgEl.style.display = 'block';
            if (placeholderEl) placeholderEl.style.display = 'none';
        }
        
        imgEl.classList.add('cursor-pointer');
        imgEl.onclick = () => window.open(finalSrc, '_blank');
    }

    // 5. Blueprint Mini-Map with Pin Logic
    const blueprintImg = document.getElementById('view-modal-blueprint');
    const mapPin = document.getElementById('view-modal-map-pin');
    const mapPlaceholder = document.getElementById('view-modal-map-placeholder');
    const blueprintPath = getBlueprintPathFromFloorId(data.floorId);
    
    if (blueprintPath && blueprintImg) {
        blueprintImg.src = blueprintPath;
        blueprintImg.style.display = 'block';
        if (mapPlaceholder) mapPlaceholder.style.display = 'none';
        
        blueprintImg.onclick = () => window.openMapLightbox(blueprintPath, data.floorId, true);
        blueprintImg.classList.add('cursor-zoom-in');

        if (data.coords && mapPin) {
            const relX = (data.coords.lng / 2250) * 100;
            const relY = (1 - (data.coords.lat / 1500)) * 100;
            mapPin.style.left = `${relX}%`;
            mapPin.style.top = `${relY}%`;
            mapPin.classList.remove('hidden');
        } else if (mapPin) {
            mapPin.classList.add('hidden');
        }
    } else {
        if (blueprintImg) blueprintImg.style.display = 'none';
        if (mapPlaceholder) mapPlaceholder.style.display = 'flex';
        if (mapPin) mapPin.classList.add('hidden');
    }

    // 6. Permissions / Edit Button Logic
    const editBtn = document.getElementById('view-modal-edit-btn');
    if (editBtn) {
        const isAdmin = currentUser.role === "admin";
        const isSubmitter = data.user === currentUser.name;
        
        if (isAdmin || isSubmitter) {
            editBtn.style.display = 'flex';
            editBtn.onclick = function() {
                window.openImprovementDetails(data);
                closeViewModal();
            };
        } else {
            editBtn.style.display = 'none';
        }
    }

    // 7. Modal Animation Execution
    modal.classList.remove('hidden');
    modal.classList.add('active');
    
    const modalContent = document.querySelector('#kaizen-view-modal .overflow-y-auto');
    if (modalContent) modalContent.scrollTop = 0;
    
    setTimeout(() => {
        modal.classList.add('opacity-100');
    }, 10);
};

window.closeViewModal = function() {
    const modal = document.getElementById('kaizen-view-modal');
    if (!modal) return;

    modal.classList.remove('opacity-100');
    modal.classList.remove('active');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.previewImage = function(event) {
    const reader = new FileReader();
    const preview = document.getElementById('form-photo-preview');
    const placeholder = document.getElementById('upload-placeholder');

    reader.onload = function() {
        if (preview) {
            preview.src = reader.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
        }
    }
    
    if (event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    }
};

/* --- Phase 3, Step 1: Photo Preview Logic --- */

document.getElementById('kaizen-photo-input')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const previewContainer = document.getElementById('photo-preview-container');
    const previewImg = document.getElementById('photo-preview-img');
    const placeholder = document.getElementById('photo-placeholder');

    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            if (previewImg && previewContainer && placeholder) {
                previewImg.src = event.target.result;
                previewContainer.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }
        };
        
        reader.readAsDataURL(file);
    }
});

// Function to clear the photo
window.removeSelectedPhoto = function() {
    const input = document.getElementById('kaizen-photo-input');
    const previewContainer = document.getElementById('photo-preview-container');
    const placeholder = document.getElementById('photo-placeholder');
    
    if (input) input.value = ""; // Clear file
    if (previewContainer) previewContainer.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
};

/* --- Phase 3, Step 2: Department/Team POV Logic --- */

window.toggleTeamFields = function(isTeam) {
    const teamSection = document.getElementById('team-details-section');
    if (!teamSection) return;

    if (isTeam) {
        teamSection.classList.remove('hidden');
        teamSection.classList.add('animate-fadeIn');
    } else {
        teamSection.classList.add('hidden');
    }
};


// --- 7. GLOBAL ACTIONS ---
window.openGlobalNewForm = function() {
    clearTempMarker(); 
    
    const miniMap = document.getElementById('sync-mini-map');
    if (miniMap) {
        miniMap.innerHTML = `
            <div class="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-4 border-2 border-dashed border-slate-200 rounded-lg">
                場所を選択するとマップが表示されます
            </div>`;
    }

    openKaizenSidePanel();
    
    const areaSel = document.getElementById('select-main-area');
    if (areaSel) {
        areaSel.value = "";
        areaSel.dispatchEvent(new Event('change'));
    }
    
    // ALWAYS CLEAR PROPOSED METHOD - Empty for every new form generation
    const methodInput = document.getElementById('kaizen-method');
    if (methodInput) {
        methodInput.value = "";
    }
    
    // ALWAYS CLEAR BENEFITS - Empty for every new form generation
    const benefitsInput = document.getElementById('kaizen-benefits');
    if (benefitsInput) {
        benefitsInput.value = "";
    }
    
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay) {
        coordDisplay.innerText = "場所を選択してください";
        coordDisplay.classList.add('text-amber-500', 'animate-pulse');
        coordDisplay.classList.remove('text-green-600');
    }
};

window.toggleUserMenu = () => document.getElementById('user-dropdown').classList.toggle('hidden');

// --- 8. CASCADING SELECTORS ---
/* --- Phase 1: Main Area & Building Sync --- */
document.getElementById('select-main-area')?.addEventListener('change', function(e) {
    const bSel = document.getElementById('select-building');
    const fSel = document.getElementById('select-floor');
    const miniMap = document.getElementById('sync-mini-map');
    const area = e.target.value; // 'factory' or 'office'

    // 1. Clear and Reset Building Dropdown
    bSel.innerHTML = '<option value="" selected disabled>対象を選択 (Select Building/Area)</option>';
    
    if (area) {
        bSel.disabled = false;
        
        // Use Reference: factoryConfig / office_othersConfig
        const currentConfig = (area === 'factory') ? factoryConfig : office_othersConfig;
        
        // Populate building names from the keys of the config object
        for (const buildingName in currentConfig) {
            const opt = document.createElement('option');
            opt.value = buildingName; 
            opt.textContent = buildingName;
            bSel.appendChild(opt);
        }
    } else {
        bSel.disabled = true;
    }

    // 2. Cascading Clear: Reset Floor dropdown
    fSel.disabled = true;
    fSel.innerHTML = '<option value="" selected disabled>階を選択 (Select Floor)</option>';

    // 3. Mini-Map Reset: Clear any previous blueprint preview
    if (miniMap) {
        miniMap.innerHTML = `
            <div class="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-4 border-2 border-dashed border-slate-200 rounded-lg">
                場所を選択するとマップが表示されます<br>(Select location to preview map)
            </div>`;
    }
});

/* --- Phase 1, Step 2: Building to Floor Sync --- */
document.getElementById('select-building')?.addEventListener('change', function(e) {
    const fSel = document.getElementById('select-floor');
    const area = document.getElementById('select-main-area').value;
    const buildingName = e.target.value;

    // 1. Clear and Reset Floor Dropdown
    fSel.innerHTML = '<option value="" selected disabled>階を選択 (Select Floor)</option>';
    
    if (buildingName && area) {
        fSel.disabled = false;
        
        // Retrieve the correct floor configuration based on Area + Building
        const configSource = (area === 'factory') ? factoryConfig : office_othersConfig;
        const floors = configSource[buildingName].floors;
        
        // Populate floors (e.g., "1F", "2F", "Roof")
        for (const floorName in floors) {
            const opt = document.createElement('option');
            
            // We store the unique floorId as the value, but show floorName to the user
            opt.value = floors[floorName].id; 
            opt.textContent = floorName;
            fSel.appendChild(opt);
        }
    } else {
        fSel.disabled = true;
    }

    // 2. Clear Mini-Map (If user changes building, the old floor plan is no longer valid)
    const miniMap = document.getElementById('sync-mini-map');
    if (miniMap) {
        miniMap.innerHTML = `
            <div class="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-4 border-2 border-dashed border-slate-200 rounded-lg">
                階を選択するとマップが表示されます
            </div>`;
    }
});


/* --- Phase 1, Step 3: Floor Selection & Blueprint Rendering --- */

document.getElementById('select-floor')?.addEventListener('change', function(e) {
    const floorId = e.target.value;
    const info = floorLookup[floorId];
    if (!info) return;

    renderMiniMapPreview(info.fullPath, floorId);
});

/**
 * Refined helper to render the mini-map blueprint with its pin.
 * This replaces the inline HTML injection for better maintainability.
 */
function renderMiniMapPreview(imgPath, floorId) {
    const miniMap = document.getElementById('sync-mini-map');
    if (!miniMap || !imgPath) return;

    let pinClass = 'hidden';
    let pinStyle = '';

    if (tempCoords) {
        const relX = (tempCoords.lng / 2250) * 100;
        const relY = (1 - (tempCoords.lat / 1500)) * 100;
        pinStyle = `left: ${relX}%; top: ${relY}%; transform: translate(-50%, -100%);`;
        pinClass = ''; 
    }

    miniMap.innerHTML = `
        <div class="w-full h-full flex items-center justify-center p-2">
            <div class="relative inline-block cursor-zoom-in group" onclick="window.openMapLightbox('${imgPath}', '${floorId}')">
                <img src="${imgPath}" class="max-w-full max-h-full block opacity-90 group-hover:opacity-100 transition-opacity rounded shadow-sm">
                
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:bg-black/5 transition-colors">
                    <span class="bg-white/95 px-3 py-1.5 rounded-full text-[10px] font-bold text-blue-600 shadow-lg border border-blue-100">
                        <i class="fa-solid fa-magnifying-glass-plus mr-1"></i> クリックしてピン留め (Click to Pin)
                    </span>
                </div>

                <div id="mini-pin" class="absolute ${pinClass} text-red-500 pointer-events-none z-10" style="${pinStyle}">
                    <i class="fa-solid fa-location-dot text-2xl drop-shadow-md"></i>
                </div>
            </div>
        </div>`;
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    showSection('home');
    initLightbox();
    setInterval(updateDashboardClock, 1000);
    setTimeout(() => {
        updateDashboardMap();
        if (dashboardMap) {
            dashboardMap.invalidateSize();
            // Force it to fit the bounds again after size is calculated
            const bounds = [[0, 0], [1500, 2250]];
            dashboardMap.fitBounds(bounds);
        }
    }, 200);
    
    // Load initial data from API
    loadAllReports();
    updateFormDate();
});

// Load all reports from API
async function loadAllReports() {
    try {
        const response = await fetch('/api/reports');
        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
                improvementCache = result.data;
                renderImprovementList();
                renderPersonalKaizenList();
                syncMarkersToMainMap();
            }
        }
    } catch (err) {
        console.warn("Failed to load reports from API:", err);
        // Fall back to empty cache if API fails
    }
}