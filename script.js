/* script.js */
/* =========================================================
   PetNourish – Full MVP EXTENDED (SAFE BOOT VERSION)
   Fixes:
   ✅ Prevents “stuck at beginning” by:
      - Waiting for DOMContentLoaded
      - Never calling addEventListener on null elements
      - Guarding optional UI sections (works even if HTML is not updated yet)
   ========================================================= */

/* -------------------------
   1) DATABASE (Items)
------------------------- */
const DATABASE = [
  { id: 1, item: "Royal Canin Medium Adult (3kg)", category: "Dry Food", price: "580,000₫", desc: "Complete feed for medium breed adult dogs.", store: "Pet Mart (Nguyen Thi Minh Khai)", lat: 10.7845, lng: 106.6980 },
  { id: 2, item: "Whiskas Tuna Can (400g)", category: "Wet Food", price: "35,000₫", desc: "Tasty tuna loaf wet food for adult cats.", store: "Paddy Pet Shop (Thao Dien)", lat: 10.8062, lng: 106.7321 },
  { id: 3, item: "Bentonite Cat Litter (10L)", category: "Litter", price: "120,000₫", desc: "High clumping, lavender scented dust-free litter.", store: "Dog Paradise (Dist 3)", lat: 10.7765, lng: 106.6854 },
  { id: 4, item: "Plush Donut Bed (Large)", category: "Bedding", price: "450,000₫", desc: "Anxiety-relief fluffy bed, machine washable.", store: "Pet City (Ly Chinh Thang)", lat: 10.7856, lng: 106.6832 },
  { id: 5, item: "Multi-Level Cat Tree (1.2m)", category: "Furniture", price: "1,200,000₫", desc: "Sisal scratching posts with hammock.", store: "Little Dog (Dist 7)", lat: 10.7301, lng: 106.7058 },
  { id: 6, item: "Kong Classic Toy (Medium)", category: "Toys", price: "280,000₫", desc: "Durable rubber chew toy for active dogs.", store: "Arale Petshop (Go Vap)", lat: 10.8374, lng: 106.6463 },
  { id: 7, item: "Plastic Travel Carrier", category: "Transport", price: "350,000₫", desc: "IATA approved air travel crate.", store: "Oh My Pet (Phu Nhuan)", lat: 10.7905, lng: 106.6758 },
  { id: 8, item: "SOS Hypoallergenic Shampoo", category: "Grooming", price: "90,000₫", desc: "Specialized formula for sensitive skin.", store: "Pet Saigon (Dist 10)", lat: 10.7789, lng: 106.6805 },
  { id: 9, item: "Reflective Nylon Leash", category: "Accessories", price: "150,000₫", desc: "1.5m leash with padded handle.", store: "Happy Pet Care (Dist 1)", lat: 10.7892, lng: 106.6968 },
  { id: 10, item: "Calcium Bone Supplements", category: "Supplements", price: "210,000₫", desc: "Daily chewables for teeth and bones.", store: "Hachiko Petshop (Phu Nhuan)", lat: 10.7965, lng: 106.6912 }
];

const HOSPITALS = [
  { id: "h1", name: "City Pet Hospital (Dist 1)", lat: 10.7782, lng: 106.7032 },
  { id: "h2", name: "Saigon Vet Clinic (Binh Thanh)", lat: 10.8013, lng: 106.7126 },
  { id: "h3", name: "Happy Paws Animal Hospital (Dist 3)", lat: 10.7818, lng: 106.6869 },
  { id: "h4", name: "Thao Dien Vet (Dist 2)", lat: 10.8058, lng: 106.7356 }
];

function buildStoresFromDatabase(db) {
  const mapStore = new Map();
  db.forEach(item => {
    if (!mapStore.has(item.store)) {
      mapStore.set(item.store, { store: item.store, lat: item.lat, lng: item.lng, items: [] });
    }
    mapStore.get(item.store).items.push(item);
  });
  return Array.from(mapStore.values());
}
const STORES = buildStoresFromDatabase(DATABASE);

/* -------------------------
   2) OPEN-NOW (FAKE SCHEDULE)
------------------------- */
function makeSchedule(seedStr) {
  const seed = Array.from(seedStr).reduce((a, c) => a + c.charCodeAt(0), 0);
  const openBase = 7 + (seed % 3);   // 7-9
  const closeBase = 19 + (seed % 4); // 19-22
  return { open: openBase, close: closeBase };
}

const PLACE_SCHEDULE = {
  stores: Object.fromEntries(STORES.map(s => [s.store, makeSchedule(s.store)])),
  hospitals: Object.fromEntries(HOSPITALS.map(h => [h.id, makeSchedule(h.name)]))
};

function getNowHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function getOpenStatus(schedule) {
  const now = getNowHour();
  const open = schedule.open;
  const close = schedule.close;

  if (now < open) return { state: "Closed", detail: `Opens at ${open}:00`, rank: 2 };
  if (now >= close) return { state: "Closed", detail: `Closed at ${close}:00`, rank: 2 };
  if (close - now <= 1) return { state: "Closing soon", detail: `Closes at ${close}:00`, rank: 1 };
  return { state: "Open", detail: `Closes at ${close}:00`, rank: 0 };
}

/* -------------------------
   3) LOCAL STORAGE
------------------------- */
const LS = {
  recentDest: "pn_recent_destinations_v1",
  saved: "pn_saved_places_v1",
  basket: "pn_basket_v1",
  alerts: "pn_alerts_v1",
  home: "pn_home_location_v1",
  tour: "pn_onboarding_done_v1",
  trafficTime: "pn_traffic_time_v1"
};

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { }
}

/* -------------------------
   4) GLOBAL STATE
------------------------- */
let map = null;
let userLat = null;
let userLng = null;
let userMarker = null;

let storeMarkers = {};
let hospitalMarkers = {};

let routeBlue = null;
let routeRedShop = null;
let routeRedHospital = null;
let routeYellowA = null; // under blue (traffic corridor)
let routeYellowB = null; // under red shop (traffic corridor)

let activeStore = null;
let activePlace = null;

let trafficTime = lsGet(LS.trafficTime, "morning"); // "morning" | "noon" | "night"
let multiStops = []; // [{type,name,lat,lng}]

/* -------------------------
   5) SAFE DOM HELPERS
------------------------- */
const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
}

/* -------------------------
   6) ELEMENTS (optional-safe)
------------------------- */
let els = {};
function cacheEls() {
  els = {
    // Tabs (some may not exist in your current HTML)
    tabMap: byId("tab-map"),
    tabFood: byId("tab-food"),
    tabCare: byId("tab-care"),
    tabNearby: byId("tab-nearby"),
    tabTraffic: byId("tab-traffic"),
    tabSaved: byId("tab-saved"),
    tabCompare: byId("tab-compare"),
    tabBasket: byId("tab-basket"),
    tabAlerts: byId("tab-alerts"),

    // Views
    viewMap: byId("view-map"),
    viewFood: byId("view-food"),
    viewCare: byId("view-care"),
    viewNearby: byId("view-nearby"),
    viewTraffic: byId("view-traffic"),
    viewSaved: byId("view-saved"),
    viewCompare: byId("view-compare"),
    viewBasket: byId("view-basket"),
    viewAlerts: byId("view-alerts"),

    // Map + sheet
    mapWrap: $(".map-wrap"),
    bottomSheet: byId("bottom-sheet"),
    sheetHeader: byId("sheet-header"),
    sheetSub: byId("sheet-sub"),
    statusText: byId("status-text"),

    btnStartRoute: byId("btn-start-route"),
    btnClearRoute: byId("btn-clear-route"),
    destInput: byId("dest-input"),
    destSuggestions: byId("dest-suggestions"),

    chipNearestShop: byId("chip-nearest-shop"),
    chipNearestHospital: byId("chip-nearest-hospital"),
    chipHome: byId("chip-home"),
    chipBenThanh: byId("chip-ben-thanh"),

    btnFullscreen: byId("btn-fullscreen"),
    btnMapBack: byId("btn-map-back"),
    btnMyLocation: byId("btn-my-location"),
    btnEmergency: byId("btn-emergency"),

    // Multi-stop
    stopList: byId("stop-list"),
    btnAddStop: byId("btn-add-stop"),
    btnClearStops: byId("btn-clear-stops"),
    btnStartTrip: byId("btn-start-trip"),

    // Traffic
    trafficMorning: byId("traffic-morning"),
    trafficNoon: byId("traffic-noon"),
    trafficNight: byId("traffic-night"),
    trafficMorning2: byId("traffic-morning-2"),
    trafficNoon2: byId("traffic-noon-2"),
    trafficNight2: byId("traffic-night-2"),
    trafficStatusText: byId("traffic-status-text"),
    btnRerollTraffic: byId("btn-reroll-traffic"),

    // Theme
    themeToggle: byId("theme-toggle"),

    // GPS modal
    gpsModal: byId("gps-modal"),
    btnEnableGps: byId("btn-enable-gps"),
    btnUseDemo: byId("btn-use-demo"),

    // Drawers
    storeDrawer: byId("store-drawer"),
    drawerGrab: byId("drawer-grab"),
    drawerClose: byId("drawer-close"),
    drawerTitle: byId("drawer-title"),
    drawerSub: byId("drawer-sub"),
    drawerBody: byId("drawer-body"),
    drawerRouteBlue: byId("drawer-route-blue"),
    drawerRouteRed: byId("drawer-route-red"),
    drawerFav: byId("drawer-fav"),

    placeDrawer: byId("place-drawer"),
    placeGrab: byId("place-grab"),
    placeClose: byId("place-close"),
    placeTitle: byId("place-title"),
    placeSub: byId("place-sub"),
    placeBody: byId("place-body"),
    placeRouteBlue: byId("place-route-blue"),
    placeRouteRed: byId("place-route-red"),
    placeFav: byId("place-fav"),

    // Food
    foodGrid: byId("food-grid"),
    foodSearch: byId("food-search"),
    foodCategory: byId("food-category"),

    // Care
    careGrid: byId("care-grid"),

    // Nearby
    nearbyGrid: byId("nearby-grid"),
    nearbyType: byId("nearby-type"),
    nearbySort: byId("nearby-sort"),

    // Saved
    savedGrid: byId("saved-grid"),
    savedFilter: byId("saved-filter"),
    btnClearSaved: byId("btn-clear-saved"),

    // Compare
    compareInput: byId("compare-input"),
    compareSuggestions: byId("compare-suggestions"),
    btnCompare: byId("btn-compare"),
    compareTbody: byId("compare-tbody"),
    btnRouteCheapest: byId("btn-route-cheapest"),
    btnSaveCheapest: byId("btn-save-cheapest"),

    // Basket
    basketList: byId("basket-list"),
    basketCount: byId("basket-count"),
    basketTotal: byId("basket-total"),
    basketSuggested: byId("basket-suggested"),
    btnClearBasket: byId("btn-clear-basket"),
    btnRouteBestBasket: byId("btn-route-best-basket"),
    btnSaveBestBasket: byId("btn-save-best-basket"),

    // Alerts
    alertItem: byId("alert-item"),
    alertSuggestions: byId("alert-suggestions"),
    alertPrice: byId("alert-price"),
    btnAddAlert: byId("btn-add-alert"),
    btnSimUpdate: byId("btn-simulate-update"),
    alertsGrid: byId("alerts-grid"),

    // Tour (optional)
    tour: byId("tour"),
    tourEmoji: byId("tour-emoji"),
    tourTitle: byId("tour-title"),
    tourText: byId("tour-text"),
    tourHighlight: byId("tour-highlight"),
    tourDots: byId("tour-dots"),
    tourNext: byId("tour-next"),
    tourBack: byId("tour-back"),
    tourSkip: byId("tour-skip"),

    // Toast
    toast: byId("toast")
  };
}

/* -------------------------
   7) UI UTILITIES
------------------------- */
function showToast(msg) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2500);
}
function setStatus(text) {
  if (els.statusText) els.statusText.textContent = text;
}
function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.classList.toggle("is-loading", !!isLoading);
  btn.disabled = !!isLoading;
}

/* -------------------------
   8) GEO UTILITIES
------------------------- */
function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371e3;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function parseVND(priceStr) {
  return Number(String(priceStr).replace(/[^\d]/g, "")) || 0;
}
function formatVND(n) {
  try { return n.toLocaleString("vi-VN") + "₫"; }
  catch { return String(n) + "₫"; }
}

/* -------------------------
   9) MAP INIT + PANES
------------------------- */
const HCMC_CENTER = { lat: 10.7769, lng: 106.7009 };

function initMap() {
  // Guard: Leaflet must exist + #map must exist
  if (typeof L === "undefined") throw new Error("Leaflet (L) not loaded. Check CDN in index.html.");
  if (!byId("map")) throw new Error("#map element not found in HTML.");

  map = L.map("map", { zoomControl: true }).setView([HCMC_CENTER.lat, HCMC_CENTER.lng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // Panes for layering: Yellow under Red under Blue
  map.createPane("paneYellow"); map.getPane("paneYellow").style.zIndex = 350;
  map.createPane("paneRed");    map.getPane("paneRed").style.zIndex = 360;
  map.createPane("paneBlue");   map.getPane("paneBlue").style.zIndex = 370;
  map.createPane("paneMarkersTop"); map.getPane("paneMarkersTop").style.zIndex = 500;

  // Store markers
  STORES.forEach(s => {
    const icon = L.divIcon({
      className: "",
      html: `<div style="
        background: rgba(133,200,138,0.95);
        border: 2px solid white;
        width: 26px; height: 26px;
        border-radius: 10px;
        display:grid; place-items:center;
        box-shadow: 0 10px 18px rgba(0,0,0,0.18);
        font-size: 14px;">🛒</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });

    const sched = PLACE_SCHEDULE.stores[s.store];
    const st = getOpenStatus(sched);
    const popup = `<b>🛒 ${s.store}</b><br>${st.state} • ${st.detail}<br>${s.items.length} items`;

    const m = L.marker([s.lat, s.lng], { icon, pane: "paneMarkersTop" })
      .addTo(map)
      .bindPopup(popup);

    m.on("click", () => openStoreDrawer(s.store));
    storeMarkers[s.store] = m;
  });

  // Hospital markers
  HOSPITALS.forEach(h => {
    const icon = L.divIcon({
      className: "",
      html: `<div style="
        background: rgba(228,75,75,0.95);
        border: 2px solid white;
        width: 26px; height: 26px;
        border-radius: 10px;
        display:grid; place-items:center;
        box-shadow: 0 10px 18px rgba(0,0,0,0.18);
        font-size: 14px;">🏥</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });

    const sched = PLACE_SCHEDULE.hospitals[h.id];
    const st = getOpenStatus(sched);
    const popup = `<b>🏥 ${h.name}</b><br>${st.state} • ${st.detail}`;

    const m = L.marker([h.lat, h.lng], { icon, pane: "paneMarkersTop" })
      .addTo(map)
      .bindPopup(popup);

    m.on("click", () => openPlaceDrawer({ type: "hospital", id: h.id, name: h.name, lat: h.lat, lng: h.lng }));
    hospitalMarkers[h.id] = m;
  });

  setStatus("Waiting for GPS");
}

/* -------------------------
   10) ROUTES (layers)
------------------------- */
function clearRoutes(all = true) {
  const list = [routeBlue, routeRedShop, routeRedHospital, routeYellowA, routeYellowB];
  list.forEach(l => { if (l) map.removeLayer(l); });
  routeBlue = routeRedShop = routeRedHospital = routeYellowA = routeYellowB = null;

  if (all && els.trafficStatusText) els.trafficStatusText.textContent = "No route yet.";
}

function trafficProfile() {
  if (trafficTime === "morning") return { w: 18, o: 0.38, label: "Morning peak", status: ["Medium", "High", "Medium"] };
  if (trafficTime === "noon") return { w: 16, o: 0.34, label: "Noon flow", status: ["Low", "Medium", "Medium"] };
  return { w: 14, o: 0.30, label: "Night fast", status: ["Low", "Low", "Medium"] };
}

/* FULL-LENGTH corridor (old behavior)
   If you later want “only random segment”, tell me and I’ll adjust. */
function makeTrafficLayer(coords) {
  const jitter = (trafficTime === "morning") ? 0.00026 : (trafficTime === "noon") ? 0.00021 : 0.00018;
  const phase = Math.random() * Math.PI * 2;

  return coords.map((c, i) => {
    const wave = Math.sin(i * 0.22 + phase) * jitter;
    const noiseLat = (Math.random() - 0.5) * (jitter * 0.55);
    const noiseLng = (Math.random() - 0.5) * (jitter * 0.55);
    return [c[0] + wave + noiseLat, c[1] - wave + noiseLng];
  });
}

function drawTrafficUnder(coords) {
  const p = trafficProfile();
  return L.polyline(coords, {
    pane: "paneYellow",
    color: "#F6C34A",
    weight: p.w,
    opacity: p.o,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);
}

function drawBlue(coords) {
  return L.polyline(coords, {
    pane: "paneBlue",
    color: "#2E78FF",
    weight: 6,
    opacity: 0.86,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);
}

function drawRed(coords, dashed = false) {
  return L.polyline(coords, {
    pane: "paneRed",
    color: "#E44B4B",
    weight: 6,
    opacity: 0.75,
    dashArray: dashed ? "10,10" : null,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);
}

function fakeTrafficStatus() {
  const p = trafficProfile();
  const pick = p.status[Math.floor(Math.random() * p.status.length)];
  const note = (pick === "High") ? "Heavy congestion likely" :
    (pick === "Medium") ? "Some congestion expected" :
      "Smooth traffic flow";
  return { label: pick, note, timeLabel: p.label };
}
function updateTrafficUI() {
  const t = fakeTrafficStatus();
  if (els.trafficStatusText) els.trafficStatusText.textContent = `${t.timeLabel}: ${t.label} — ${t.note}`;
  if (els.sheetSub && (routeBlue || routeRedShop || routeRedHospital)) {
    els.sheetSub.textContent = `Traffic (${t.timeLabel}): ${t.label} — ${t.note}`;
  }
  return t;
}

/* -------------------------
   11) OSRM ROUTING + NOMINATIM
------------------------- */
async function geocodeToLatLng(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error("Geocoder failed");
  const data = await res.json();
  if (!data || !data[0]) throw new Error("Destination not found");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

async function fetchOsrmRoute(aLat, aLng, bLat, bLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing failed");
  const data = await res.json();
  if (!data.routes || !data.routes[0]) throw new Error("No route found");
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

async function fetchOsrmTrip(waypoints) {
  if (waypoints.length < 2) throw new Error("Need at least 2 stops");
  const parts = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${parts}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Trip routing failed");
  const data = await res.json();
  if (!data.routes || !data.routes[0]) throw new Error("No trip route found");
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

/* -------------------------
   12) GPS
------------------------- */
function placeUser(lat, lng, label = "You are here (GPS)") {
  userLat = lat; userLng = lng;

  if (userMarker) map.removeLayer(userMarker);

  userMarker = L.marker([userLat, userLng], {
    pane: "paneMarkersTop",
    icon: L.divIcon({
      className: "user-icon",
      html: `<div style="background:#2E78FF;width:15px;height:15px;border-radius:50%;border:2px solid white;"></div>`,
      iconSize: [20, 20]
    })
  }).addTo(map).bindPopup(label);

  map.setView([userLat, userLng], 14);
  setStatus("GPS Locked ✅");
  showToast("GPS connected ✅");

  // auto set home if not set
  const home = lsGet(LS.home, null);
  if (!home) {
    lsSet(LS.home, { lat: userLat, lng: userLng, label: "Home (auto set)" });
  }

  // refresh dependent views (safe)
  renderNearby();
  renderSaved();
  renderBasket();
}

/* -------------------------
   13) MAIN ROUTE ACTIONS
------------------------- */
function rememberDestination(text) {
  const rec = lsGet(LS.recentDest, []);
  const cleaned = text.trim();
  if (!cleaned) return;
  const next = [cleaned, ...rec.filter(x => x.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8);
  lsSet(LS.recentDest, next);
}

async function routeToDestinationText(destinationText) {
  if (!userLat) { showToast("Waiting for GPS..."); return; }
  setLoading(els.btnStartRoute, true);

  try {
    const dest = await geocodeToLatLng(destinationText);
    rememberDestination(destinationText);

    // Clear only blue + yellowA
    if (routeBlue) map.removeLayer(routeBlue);
    if (routeYellowA) map.removeLayer(routeYellowA);
    routeBlue = routeYellowA = null;

    const blueCoords = await fetchOsrmRoute(userLat, userLng, dest.lat, dest.lng);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(blueCoords));
    routeBlue = drawBlue(blueCoords);

    map.fitBounds(L.latLngBounds(blueCoords), { padding: [50, 50] });
    setStatus("Routing active ✅");
    updateTrafficUI();

    els.bottomSheet?.classList.add("sheet-minimized");
    closeAllDrawers();
    showToast("Route ready ✅");
  } catch (err) {
    showToast(err?.message || "Route failed");
  } finally {
    setLoading(els.btnStartRoute, false);
  }
}

async function routeToDestinationLatLng(lat, lng) {
  if (!userLat) { showToast("Waiting for GPS..."); return; }
  try {
    if (routeBlue) map.removeLayer(routeBlue);
    if (routeYellowA) map.removeLayer(routeYellowA);
    routeBlue = routeYellowA = null;

    const blueCoords = await fetchOsrmRoute(userLat, userLng, lat, lng);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(blueCoords));
    routeBlue = drawBlue(blueCoords);

    map.fitBounds(L.latLngBounds(blueCoords), { padding: [50, 50] });
    setStatus("Routing active ✅");
    updateTrafficUI();

    els.bottomSheet?.classList.add("sheet-minimized");
  } catch {
    showToast("Route failed");
  }
}

async function routeToNearestShopAndHospital() {
  if (!userLat) return;

  let nearestStore = null; let bestS = Infinity;
  STORES.forEach(s => {
    const d = haversine(userLat, userLng, s.lat, s.lng);
    if (d < bestS) { bestS = d; nearestStore = s; }
  });

  let nearestHospital = null; let bestH = Infinity;
  HOSPITALS.forEach(h => {
    const d = haversine(userLat, userLng, h.lat, h.lng);
    if (d < bestH) { bestH = d; nearestHospital = h; }
  });

  try {
    if (routeRedShop) map.removeLayer(routeRedShop);
    if (routeRedHospital) map.removeLayer(routeRedHospital);
    if (routeYellowB) map.removeLayer(routeYellowB);
    routeRedShop = routeRedHospital = routeYellowB = null;

    if (nearestStore) {
      const coords = await fetchOsrmRoute(userLat, userLng, nearestStore.lat, nearestStore.lng);
      routeYellowB = drawTrafficUnder(makeTrafficLayer(coords));
      routeRedShop = drawRed(coords, false);
    }

    if (nearestHospital) {
      const coordsH = await fetchOsrmRoute(userLat, userLng, nearestHospital.lat, nearestHospital.lng);
      routeRedHospital = drawRed(coordsH, true);
    }

    updateTrafficUI();
  } catch {
    showToast("Nearest routing failed");
  }
}

async function startTripDefault() {
  if (!userLat) { showToast("Waiting for GPS..."); return; }
  setLoading(els.btnStartTrip, true);

  try {
    let nearestStore = null; let bestS = Infinity;
    STORES.forEach(s => {
      const d = haversine(userLat, userLng, s.lat, s.lng);
      if (d < bestS) { bestS = d; nearestStore = s; }
    });
    let nearestHospital = null; let bestH = Infinity;
    HOSPITALS.forEach(h => {
      const d = haversine(userLat, userLng, h.lat, h.lng);
      if (d < bestH) { bestH = d; nearestHospital = h; }
    });

    const home = lsGet(LS.home, { lat: userLat, lng: userLng, label: "Home" });

    const wp = [{ lat: userLat, lng: userLng }];
    multiStops.forEach(s => wp.push({ lat: s.lat, lng: s.lng }));
    if (nearestStore) wp.push({ lat: nearestStore.lat, lng: nearestStore.lng });
    if (nearestHospital) wp.push({ lat: nearestHospital.lat, lng: nearestHospital.lng });
    wp.push({ lat: home.lat, lng: home.lng });

    clearRoutes(true);

    const tripCoords = await fetchOsrmTrip(wp);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(tripCoords));
    routeBlue = drawBlue(tripCoords);

    map.fitBounds(L.latLngBounds(tripCoords), { padding: [50, 50] });
    setStatus("Trip active ✅");
    updateTrafficUI();
    els.bottomSheet?.classList.add("sheet-minimized");
    closeAllDrawers();
    showToast("Trip started ✅");
  } catch (e) {
    showToast(e?.message || "Trip failed");
  } finally {
    setLoading(els.btnStartTrip, false);
  }
}

/* -------------------------
   14) DESTINATION SUGGESTIONS (safe)
------------------------- */
function getDestinationSuggestions(q) {
  const rec = lsGet(LS.recentDest, []);
  const quick = ["Ben Thanh Market", "Saigon Zoo", "Landmark 81", "Tan Son Nhat Airport"];
  const all = [...rec, ...quick];

  const picks = [];
  const qq = (q || "").toLowerCase().trim();
  all.forEach(x => {
    if (!qq || x.toLowerCase().includes(qq)) {
      if (!picks.includes(x)) picks.push(x);
    }
  });
  return picks.slice(0, 6);
}

function renderDestSuggestions(list) {
  if (!els.destSuggestions) return;
  if (!list || list.length === 0) {
    els.destSuggestions.innerHTML = "";
    els.destSuggestions.style.display = "none";
    return;
  }

  els.destSuggestions.style.display = "block";
  els.destSuggestions.innerHTML = list.map(s => `
    <button class="sug-item" type="button" data-val="${encodeURIComponent(s)}">${s}</button>
  `).join("");

  els.destSuggestions.querySelectorAll(".sug-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = decodeURIComponent(btn.dataset.val);
      if (els.destInput) els.destInput.value = v;
      els.destSuggestions.style.display = "none";
      routeToDestinationText(v);
    });
  });
}

/* -------------------------
   15) MULTI-STOP UI (safe)
------------------------- */
function renderStops() {
  if (!els.stopList) return;

  if (multiStops.length === 0) {
    els.stopList.innerHTML = `<div class="stop-empty">No custom stops. Add stop if needed.</div>`;
    return;
  }

  els.stopList.innerHTML = multiStops.map((s, idx) => `
    <div class="stop-row">
      <div class="stop-left">
        <div class="stop-name">${s.type === "store" ? "🛒" : s.type === "hospital" ? "🏥" : "📍"} ${s.name}</div>
        <div class="stop-sub">${(userLat ? (haversine(userLat, userLng, s.lat, s.lng) / 1000).toFixed(2) : "—")} km away</div>
      </div>
      <button class="stop-remove" type="button" data-idx="${idx}">Remove</button>
    </div>
  `).join("");

  els.stopList.querySelectorAll(".stop-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      multiStops.splice(idx, 1);
      renderStops();
      showToast("Stop removed");
    });
  });
}

function addStopChooser() {
  const choice = prompt("Add stop:\n1 = Nearest Store\n2 = Nearest Hospital\n3 = Type destination address");
  if (!choice) return;

  if (choice.trim() === "1") {
    if (!userLat) return showToast("Need GPS first");
    let nearestStore = null; let best = Infinity;
    STORES.forEach(s => {
      const d = haversine(userLat, userLng, s.lat, s.lng);
      if (d < best) { best = d; nearestStore = s; }
    });
    if (nearestStore) {
      multiStops.push({ type: "store", name: nearestStore.store, lat: nearestStore.lat, lng: nearestStore.lng });
      renderStops(); showToast("Added nearest store");
    }
    return;
  }

  if (choice.trim() === "2") {
    if (!userLat) return showToast("Need GPS first");
    let nearest = null; let best = Infinity;
    HOSPITALS.forEach(h => {
      const d = haversine(userLat, userLng, h.lat, h.lng);
      if (d < best) { best = d; nearest = h; }
    });
    if (nearest) {
      multiStops.push({ type: "hospital", name: nearest.name, lat: nearest.lat, lng: nearest.lng });
      renderStops(); showToast("Added nearest hospital");
    }
    return;
  }

  if (choice.trim() === "3") {
    const t = prompt("Type destination name/address:");
    if (!t) return;
    (async () => {
      try {
        const d = await geocodeToLatLng(t);
        multiStops.push({ type: "custom", name: t, lat: d.lat, lng: d.lng });
        renderStops(); showToast("Added custom stop");
      } catch {
        showToast("Stop not found");
      }
    })();
    return;
  }

  showToast("Invalid choice");
}

/* -------------------------
   16) SAVED PLACES + DRAWERS (safe)
------------------------- */
function openDrawer(el) {
  if (!el) return;
  el.classList.add("drawer--open");
  el.setAttribute("aria-hidden", "false");
}
function closeDrawer(el) {
  if (!el) return;
  el.classList.remove("drawer--open");
  el.setAttribute("aria-hidden", "true");
}
function closeAllDrawers() {
  closeStoreDrawer();
  closePlaceDrawer();
}

function getSaved() { return lsGet(LS.saved, []); }
function setSaved(list) { lsSet(LS.saved, list); renderSaved(); }

function isSaved(type, key) {
  const s = getSaved();
  return s.some(x => x.type === type && x.key === key);
}
function toggleSaved(type, key) {
  const s = getSaved();
  const exists = s.some(x => x.type === type && x.key === key);
  const next = exists ? s.filter(x => !(x.type === type && x.key === key)) : [{ type, key }, ...s];
  setSaved(next);
  showToast(exists ? "Removed from saved" : "Saved ✅");
}

function openStoreDrawer(storeName) {
  if (!els.storeDrawer) return; // if you haven't added drawer HTML yet, just skip

  const store = STORES.find(s => s.store === storeName);
  if (!store) return;
  activeStore = store;

  els.bottomSheet?.classList.add("sheet-minimized");

  const sch = PLACE_SCHEDULE.stores[store.store];
  const st = getOpenStatus(sch);

  let dist = "—";
  if (userLat) dist = (haversine(userLat, userLng, store.lat, store.lng) / 1000).toFixed(2) + " km";

  if (els.drawerTitle) els.drawerTitle.textContent = store.store;
  if (els.drawerSub) els.drawerSub.textContent = `${st.state} • ${st.detail} • ${dist} • ${store.items.length} items`;
  if (els.drawerFav) els.drawerFav.textContent = isSaved("store", store.store) ? "⭐" : "☆";

  if (els.drawerBody) {
    const sorted = [...store.items].sort((a, b) => parseVND(a.price) - parseVND(b.price));
    const top3 = sorted.slice(0, 3);

    els.drawerBody.innerHTML = `
      <div class="drawer-list">
        ${top3.map(it => `
          <div class="drawer-item">
            <div class="left">
              <div class="name">${it.item}</div>
              <div class="meta">${it.category}</div>
            </div>
            <div class="price">${it.price}</div>
          </div>
          <button class="drawer-add" type="button" data-id="${it.id}">+ Add to basket</button>
        `).join("")}
      </div>
    `;

    els.drawerBody.querySelectorAll(".drawer-add").forEach(btn => {
      btn.addEventListener("click", () => addToBasket(Number(btn.dataset.id)));
    });
  }

  closePlaceDrawer();
  openDrawer(els.storeDrawer);
}
function closeStoreDrawer() {
  closeDrawer(els.storeDrawer);
  activeStore = null;
}

function openPlaceDrawer(place) {
  if (!els.placeDrawer) return; // drawer not in HTML yet
  activePlace = place;

  els.bottomSheet?.classList.add("sheet-minimized");

  const sch = PLACE_SCHEDULE.hospitals[place.id];
  const st = getOpenStatus(sch);

  let dist = "—";
  if (userLat) dist = (haversine(userLat, userLng, place.lat, place.lng) / 1000).toFixed(2) + " km";

  if (els.placeTitle) els.placeTitle.textContent = `🏥 ${place.name}`;
  if (els.placeSub) els.placeSub.textContent = `${st.state} • ${st.detail} • ${dist}`;
  if (els.placeFav) els.placeFav.textContent = isSaved("hospital", place.id) ? "⭐" : "☆";

  if (els.placeBody) {
    els.placeBody.innerHTML = `
      <div class="care-card" style="margin:0;">
        <div class="care-title">${st.state}</div>
        <div class="care-sub">${st.detail}</div>
        <div class="care-sub">Tip: Use Emergency Mode for fastest hospital routing.</div>
      </div>
    `;
  }

  closeStoreDrawer();
  openDrawer(els.placeDrawer);
}
function closePlaceDrawer() {
  closeDrawer(els.placeDrawer);
  activePlace = null;
}

/* -------------------------
   17) SAVED VIEW (safe)
------------------------- */
function renderSaved() {
  if (!els.savedGrid) return;

  const list = getSaved();
  const filter = els.savedFilter?.value || "all";
  const shown = list.filter(x => filter === "all" ? true : x.type === filter);

  if (shown.length === 0) {
    els.savedGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">No saved places</div>
        <div class="care-sub">Tap ⭐ on a store/hospital to save it.</div>
      </div>`;
    return;
  }

  els.savedGrid.innerHTML = shown.map(x => {
    if (x.type === "store") {
      const s = STORES.find(k => k.store === x.key);
      if (!s) return "";
      const st = getOpenStatus(PLACE_SCHEDULE.stores[s.store]);
      const dist = userLat ? (haversine(userLat, userLng, s.lat, s.lng) / 1000).toFixed(2) + " km" : "—";
      return `
        <div class="care-card">
          <div class="care-title">🛒 ${s.store}</div>
          <div class="care-sub">${st.state} • ${st.detail} • ${dist}</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn-map-link" type="button" data-act="view" data-type="store" data-key="${encodeURIComponent(s.store)}">View</button>
            <button class="btn-map-link" type="button" data-act="route" data-type="store" data-key="${encodeURIComponent(s.store)}">Route</button>
            <button class="btn-map-link" type="button" data-act="remove" data-type="store" data-key="${encodeURIComponent(s.store)}">Remove</button>
          </div>
        </div>`;
    } else {
      const h = HOSPITALS.find(k => k.id === x.key);
      if (!h) return "";
      const st = getOpenStatus(PLACE_SCHEDULE.hospitals[h.id]);
      const dist = userLat ? (haversine(userLat, userLng, h.lat, h.lng) / 1000).toFixed(2) + " km" : "—";
      return `
        <div class="care-card">
          <div class="care-title">🏥 ${h.name}</div>
          <div class="care-sub">${st.state} • ${st.detail} • ${dist}</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn-map-link" type="button" data-act="view" data-type="hospital" data-key="${encodeURIComponent(h.id)}">View</button>
            <button class="btn-map-link" type="button" data-act="route" data-type="hospital" data-key="${encodeURIComponent(h.id)}">Route</button>
            <button class="btn-map-link" type="button" data-act="remove" data-type="hospital" data-key="${encodeURIComponent(h.id)}">Remove</button>
          </div>
        </div>`;
    }
  }).join("");

  els.savedGrid.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const type = btn.dataset.type;
      const key = decodeURIComponent(btn.dataset.key);

      if (act === "remove") {
        toggleSaved(type, key);
        return;
      }

      if (type === "store") {
        const s = STORES.find(z => z.store === key);
        if (!s) return;
        setActiveTab("map");
        map.flyTo([s.lat, s.lng], 16);
        storeMarkers[s.store]?.openPopup();
        openStoreDrawer(s.store);
        if (act === "route") await routeToDestinationLatLng(s.lat, s.lng);
      } else {
        const h = HOSPITALS.find(z => z.id === key);
        if (!h) return;
        setActiveTab("map");
        map.flyTo([h.lat, h.lng], 16);
        hospitalMarkers[h.id]?.openPopup();
        openPlaceDrawer({ type: "hospital", id: h.id, name: h.name, lat: h.lat, lng: h.lng });
        if (act === "route") await routeToDestinationLatLng(h.lat, h.lng);
      }
    });
  });
}

/* -------------------------
   18) FOOD + BASKET (safe)
------------------------- */
function hydrateCategories() {
  if (!els.foodCategory) return;
  const cats = Array.from(new Set(DATABASE.map(d => d.category))).sort();
  els.foodCategory.innerHTML = `<option value="any">All Categories</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

function getBasket() { return lsGet(LS.basket, []); }
function setBasket(list) { lsSet(LS.basket, list); renderBasket(); }

function addToBasket(itemId) {
  const b = getBasket();
  const found = b.find(x => x.id === itemId);
  if (found) found.qty += 1;
  else b.push({ id: itemId, qty: 1 });
  setBasket(b);
  showToast("Added to basket ✅");
}

function renderFood() {
  if (!els.foodGrid) return;

  const q = (els.foodSearch?.value || "").toLowerCase().trim();
  const cat = els.foodCategory?.value || "any";

  const filtered = DATABASE.filter(d => {
    const matchText = d.item.toLowerCase().includes(q) || d.store.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q);
    const matchCat = (cat === "any") ? true : d.category === cat;
    return matchText && matchCat;
  });

  if (filtered.length === 0) {
    els.foodGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">No results</div>
        <div class="care-sub">Try another keyword or category.</div>
      </div>`;
    return;
  }

  els.foodGrid.innerHTML = filtered.map(d => {
    const st = getOpenStatus(PLACE_SCHEDULE.stores[d.store]);
    const saved = isSaved("store", d.store);
    return `
      <div class="food-card">
        <div class="food-head">
          <div class="food-title">${d.item}</div>
          <div class="food-price">${d.price}</div>
        </div>
        <div class="food-store">📍 ${d.store} • <b>${st.state}</b></div>
        <div class="food-desc">${d.desc}</div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
          <button class="btn-map-link" type="button" data-act="map" data-store="${encodeURIComponent(d.store)}" data-lat="${d.lat}" data-lng="${d.lng}">
            View on Map 🗺️
          </button>
          <button class="btn-map-link" type="button" data-act="basket" data-id="${d.id}">
            + Add to Basket
          </button>
          <button class="btn-map-link" type="button" data-act="save" data-store="${encodeURIComponent(d.store)}">
            ${saved ? "⭐ Saved" : "☆ Save"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  els.foodGrid.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;

      if (act === "map") {
        const store = decodeURIComponent(btn.dataset.store);
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        setActiveTab("map");
        map.flyTo([lat, lng], 16);
        storeMarkers[store]?.openPopup();
        openStoreDrawer(store);
        return;
      }

      if (act === "basket") {
        addToBasket(Number(btn.dataset.id));
        return;
      }

      if (act === "save") {
        const store = decodeURIComponent(btn.dataset.store);
        toggleSaved("store", store);
        renderFood();
        return;
      }
    });
  });
}

function basketSummary() {
  const b = getBasket();
  const items = b.map(x => {
    const data = DATABASE.find(d => d.id === x.id);
    return data ? { ...data, qty: x.qty, unit: parseVND(data.price) } : null;
  }).filter(Boolean);

  const count = items.reduce((a, x) => a + x.qty, 0);
  const total = items.reduce((a, x) => a + x.qty * x.unit, 0);

  const storeTotals = new Map();
  items.forEach(it => {
    const cur = storeTotals.get(it.store) || { sum: 0, count: 0 };
    cur.sum += it.qty * it.unit;
    cur.count += it.qty;
    storeTotals.set(it.store, cur);
  });

  let bestStore = null;
  let bestSum = Infinity;
  storeTotals.forEach((v, store) => {
    if (v.sum < bestSum) { bestSum = v.sum; bestStore = store; }
  });

  return { items, count, total, bestStore, bestSum };
}

function renderBasket() {
  if (!els.basketList || !els.basketCount || !els.basketTotal || !els.basketSuggested) return;

  const sum = basketSummary();
  els.basketCount.textContent = String(sum.count);
  els.basketTotal.textContent = formatVND(sum.total);

  if (sum.items.length === 0) {
    els.basketList.innerHTML = `<div class="empty-state">Your basket is empty.</div>`;
    els.basketSuggested.textContent = "Add items to get a recommendation.";
    return;
  }

  els.basketList.innerHTML = sum.items.map(it => `
    <div class="basket-item">
      <div class="basket-left">
        <div class="basket-name">${it.item}</div>
        <div class="basket-sub">📍 ${it.store} • ${it.price}</div>
      </div>
      <div class="basket-right">
        <button class="qty-btn" type="button" data-act="minus" data-id="${it.id}">−</button>
        <input class="qty-input" type="number" min="1" value="${it.qty}" data-id="${it.id}" />
        <button class="qty-btn" type="button" data-act="plus" data-id="${it.id}">+</button>
        <button class="qty-remove" type="button" data-act="remove" data-id="${it.id}">✕</button>
      </div>
    </div>
  `).join("");

  if (sum.bestStore) {
    els.basketSuggested.textContent = `Best store for your basket: ${sum.bestStore} — Total ${formatVND(sum.bestSum)}`;
  } else {
    els.basketSuggested.textContent = "No recommendation yet.";
  }

  els.basketList.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      const id = Number(btn.dataset.id);

      const b = getBasket();
      const f = b.find(x => x.id === id);
      if (!f) return;

      if (act === "remove") {
        setBasket(b.filter(x => x.id !== id));
        return;
      }
      if (act === "plus") {
        f.qty += 1;
        setBasket(b);
        return;
      }
      if (act === "minus") {
        f.qty = Math.max(1, f.qty - 1);
        setBasket(b);
        return;
      }
    });
  });

  els.basketList.querySelectorAll(".qty-input").forEach(inp => {
    inp.addEventListener("change", () => {
      const id = Number(inp.dataset.id);
      const qty = Math.max(1, Number(inp.value || 1));
      const b = getBasket();
      const f = b.find(x => x.id === id);
      if (!f) return;
      f.qty = qty;
      setBasket(b);
    });
  });
}

/* -------------------------
   19) CARE (Hospitals list) + NEARBY (safe)
------------------------- */
function renderHospitals() {
  if (!els.careGrid) return;

  els.careGrid.innerHTML = HOSPITALS.map(h => {
    const st = getOpenStatus(PLACE_SCHEDULE.hospitals[h.id]);
    const dist = userLat ? (haversine(userLat, userLng, h.lat, h.lng) / 1000).toFixed(2) + " km" : "—";
    const saved = isSaved("hospital", h.id);
    return `
      <div class="care-card">
        <div class="care-title">🏥 ${h.name}</div>
        <div class="care-sub">${st.state} • ${st.detail} • ${dist}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn-map-link" type="button" data-act="view" data-id="${h.id}">View on Map</button>
          <button class="btn-map-link" type="button" data-act="route" data-id="${h.id}">Route</button>
          <button class="btn-map-link" type="button" data-act="save" data-id="${h.id}">
            ${saved ? "⭐ Saved" : "☆ Save"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  els.careGrid.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const h = HOSPITALS.find(x => x.id === id);
      if (!h) return;

      if (act === "save") {
        toggleSaved("hospital", h.id);
        renderHospitals();
        return;
      }

      setActiveTab("map");
      map.flyTo([h.lat, h.lng], 16);
      hospitalMarkers[h.id]?.openPopup();
      openPlaceDrawer({ type: "hospital", id: h.id, name: h.name, lat: h.lat, lng: h.lng });

      if (act === "route") {
        await routeToDestinationLatLng(h.lat, h.lng);
      }
    });
  });
}

function renderNearby() {
  if (!els.nearbyGrid) return;

  if (!userLat) {
    els.nearbyGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">GPS required</div>
        <div class="care-sub">Enable GPS (or Demo location) to view nearby places.</div>
      </div>`;
    return;
  }

  const type = els.nearbyType?.value || "all";
  const sort = els.nearbySort?.value || "distance";

  let list = [];
  if (type === "all" || type === "store") {
    STORES.forEach(s => {
      const st = getOpenStatus(PLACE_SCHEDULE.stores[s.store]);
      list.push({
        kind: "store",
        key: s.store,
        name: s.store,
        lat: s.lat, lng: s.lng,
        dist: haversine(userLat, userLng, s.lat, s.lng),
        openRank: st.rank,
        openText: `${st.state} • ${st.detail}`
      });
    });
  }
  if (type === "all" || type === "hospital") {
    HOSPITALS.forEach(h => {
      const st = getOpenStatus(PLACE_SCHEDULE.hospitals[h.id]);
      list.push({
        kind: "hospital",
        key: h.id,
        name: h.name,
        lat: h.lat, lng: h.lng,
        dist: haversine(userLat, userLng, h.lat, h.lng),
        openRank: st.rank,
        openText: `${st.state} • ${st.detail}`
      });
    });
  }

  if (sort === "distance") list.sort((a, b) => a.dist - b.dist);
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "open") list.sort((a, b) => a.openRank - b.openRank || a.dist - b.dist);

  els.nearbyGrid.innerHTML = list.slice(0, 12).map(p => {
    const km = (p.dist / 1000).toFixed(2);
    const saved = isSaved(p.kind === "store" ? "store" : "hospital", p.key);
    return `
      <div class="care-card">
        <div class="care-title">${p.kind === "store" ? "🛒" : "🏥"} ${p.name}</div>
        <div class="care-sub">${p.openText} • ${km} km</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn-map-link" type="button" data-act="view" data-kind="${p.kind}" data-key="${encodeURIComponent(p.key)}">View</button>
          <button class="btn-map-link" type="button" data-act="route" data-kind="${p.kind}" data-key="${encodeURIComponent(p.key)}">Route</button>
          <button class="btn-map-link" type="button" data-act="save" data-kind="${p.kind}" data-key="${encodeURIComponent(p.key)}">
            ${saved ? "⭐ Saved" : "☆ Save"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  els.nearbyGrid.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const kind = btn.dataset.kind;
      const key = decodeURIComponent(btn.dataset.key);

      if (act === "save") {
        toggleSaved(kind, key);
        renderNearby();
        return;
      }

      if (kind === "store") {
        const s = STORES.find(x => x.store === key);
        if (!s) return;
        setActiveTab("map");
        map.flyTo([s.lat, s.lng], 16);
        storeMarkers[s.store]?.openPopup();
        openStoreDrawer(s.store);
        if (act === "route") await routeToDestinationLatLng(s.lat, s.lng);
      } else {
        const h = HOSPITALS.find(x => x.id === key);
        if (!h) return;
        setActiveTab("map");
        map.flyTo([h.lat, h.lng], 16);
        hospitalMarkers[h.id]?.openPopup();
        openPlaceDrawer({ type: "hospital", id: h.id, name: h.name, lat: h.lat, lng: h.lng });
        if (act === "route") await routeToDestinationLatLng(h.lat, h.lng);
      }
    });
  });
}

/* -------------------------
   20) TABS (safe)
------------------------- */
function setActiveTab(tabName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("view--active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-btn--active"));

  const view = byId(`view-${tabName}`);
  const tab = byId(`tab-${tabName}`);
  if (view) view.classList.add("view--active");
  if (tab) tab.classList.add("tab-btn--active");

  if (tabName === "map" && map) setTimeout(() => map.invalidateSize(), 200);
}

/* -------------------------
   21) FULLSCREEN + MY LOCATION
------------------------- */
function toggleFullscreen(isFull) {
  if (!els.mapWrap) return;
  if (isFull) els.mapWrap.classList.add("map-expanded");
  else els.mapWrap.classList.remove("map-expanded");
  setTimeout(() => map?.invalidateSize?.(), 200);
}

/* -------------------------
   22) TRAFFIC TIME (safe)
------------------------- */
function setTrafficTime(t) {
  trafficTime = t;
  lsSet(LS.trafficTime, t);
  syncTrafficButtons();
  rerollTrafficLayer();
}

function syncTrafficButtons() {
  const setActive = (id, active) => {
    const el = byId(id);
    if (el) el.classList.toggle("pill-btn--active", active);
  };
  setActive("traffic-morning", trafficTime === "morning");
  setActive("traffic-noon", trafficTime === "noon");
  setActive("traffic-night", trafficTime === "night");
  setActive("traffic-morning-2", trafficTime === "morning");
  setActive("traffic-noon-2", trafficTime === "noon");
  setActive("traffic-night-2", trafficTime === "night");
}

function bindTrafficBtn(btn, time) {
  on(btn, "click", () => setTrafficTime(time));
}

function rerollTrafficLayer() {
  if (!map) return;

  if (routeBlue) {
    const coords = routeBlue.getLatLngs().map(ll => [ll.lat, ll.lng]);
    if (routeYellowA) map.removeLayer(routeYellowA);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(coords));
  }

  if (routeRedShop) {
    const coords = routeRedShop.getLatLngs().map(ll => [ll.lat, ll.lng]);
    if (routeYellowB) map.removeLayer(routeYellowB);
    routeYellowB = drawTrafficUnder(makeTrafficLayer(coords));
  }

  updateTrafficUI();
}

/* -------------------------
   23) EMERGENCY MODE (safe)
------------------------- */
async function emergencyToNearestHospital() {
  if (!userLat) return showToast("Need GPS first");

  let nearest = null; let best = Infinity;
  HOSPITALS.forEach(h => {
    const d = haversine(userLat, userLng, h.lat, h.lng);
    if (d < best) { best = d; nearest = h; }
  });
  if (!nearest) return;

  showToast("Emergency: routing to nearest hospital!");
  setActiveTab("map");
  toggleFullscreen(true);

  if (navigator.vibrate) navigator.vibrate([120, 80, 120]);

  await routeToDestinationLatLng(nearest.lat, nearest.lng);
  hospitalMarkers[nearest.id]?.openPopup();
  openPlaceDrawer({ type: "hospital", id: nearest.id, name: nearest.name, lat: nearest.lat, lng: nearest.lng });
}

/* -------------------------
   24) BIND UI (NO CRASH)
------------------------- */
function bindUI() {
  // Tabs
  on(els.tabMap, "click", () => setActiveTab("map"));
  on(els.tabFood, "click", () => { setActiveTab("food"); renderFood(); });
  on(els.tabCare, "click", () => { setActiveTab("care"); renderHospitals(); });
  on(els.tabNearby, "click", () => { setActiveTab("nearby"); renderNearby(); });
  on(els.tabTraffic, "click", () => { setActiveTab("traffic"); syncTrafficButtons(); });
  on(els.tabSaved, "click", () => { setActiveTab("saved"); renderSaved(); });
  on(els.tabCompare, "click", () => setActiveTab("compare"));
  on(els.tabBasket, "click", () => { setActiveTab("basket"); renderBasket(); });
  on(els.tabAlerts, "click", () => { setActiveTab("alerts"); });

  // Sheet
  on(els.sheetHeader, "click", () => els.bottomSheet?.classList.toggle("sheet-minimized"));

  // Destination input + suggestions
  on(els.destInput, "input", () => renderDestSuggestions(getDestinationSuggestions(els.destInput.value)));
  on(els.destInput, "focus", () => renderDestSuggestions(getDestinationSuggestions(els.destInput.value)));
  on(document, "click", (e) => {
    if (!els.destSuggestions) return;
    if (!els.destSuggestions.contains(e.target) && e.target !== els.destInput) {
      els.destSuggestions.style.display = "none";
    }
  });

  // Routing buttons
  on(els.btnStartRoute, "click", () => {
    const val = (els.destInput?.value || "").trim();
    if (!val) return showToast("Type a destination");
    routeToDestinationText(val);
  });

  on(els.btnClearRoute, "click", () => {
    clearRoutes(true);
    if (els.destInput) els.destInput.value = "";
    els.bottomSheet?.classList.remove("sheet-minimized");
    setStatus(userLat ? "GPS Locked ✅" : "Waiting for GPS");
    if (els.sheetSub) els.sheetSub.textContent = "GPS routing + nearest shop & hospital";
    showToast("Cleared");
  });

  // Chips (optional)
  on(els.chipBenThanh, "click", () => {
    if (els.destInput) els.destInput.value = "Ben Thanh Market";
    routeToDestinationText("Ben Thanh Market");
  });

  on(els.chipHome, "click", () => {
    const home = lsGet(LS.home, null);
    if (!home) return showToast("Home not set yet");
    setActiveTab("map");
    map.flyTo([home.lat, home.lng], 16);
    routeToDestinationLatLng(home.lat, home.lng);
  });

  on(els.chipNearestShop, "click", async () => {
    if (!userLat) return showToast("Waiting for GPS...");
    await routeToNearestShopAndHospital();

    let nearestStore = null; let best = Infinity;
    STORES.forEach(s => {
      const d = haversine(userLat, userLng, s.lat, s.lng);
      if (d < best) { best = d; nearestStore = s; }
    });
    if (nearestStore) {
      setActiveTab("map");
      map.flyTo([nearestStore.lat, nearestStore.lng], 16);
      storeMarkers[nearestStore.store]?.openPopup();
      openStoreDrawer(nearestStore.store);
    }
  });

  on(els.chipNearestHospital, "click", async () => {
    if (!userLat) return showToast("Waiting for GPS...");
    await routeToNearestShopAndHospital();

    let nearest = null; let best = Infinity;
    HOSPITALS.forEach(h => {
      const d = haversine(userLat, userLng, h.lat, h.lng);
      if (d < best) { best = d; nearest = h; }
    });
    if (nearest) {
      setActiveTab("map");
      map.flyTo([nearest.lat, nearest.lng], 16);
      hospitalMarkers[nearest.id]?.openPopup();
      openPlaceDrawer({ type: "hospital", id: nearest.id, name: nearest.name, lat: nearest.lat, lng: nearest.lng });
    }
  });

  // Fullscreen + location
  on(els.btnFullscreen, "click", () => toggleFullscreen(true));
  on(els.btnMapBack, "click", () => toggleFullscreen(false));
  on(els.btnMyLocation, "click", () => {
    if (!userLat) return showToast("GPS not ready");
    setActiveTab("map");
    map.flyTo([userLat, userLng], 15);
    userMarker?.openPopup();
  });

  // Emergency
  on(els.btnEmergency, "click", emergencyToNearestHospital);

  // Multi-stop
  on(els.btnAddStop, "click", addStopChooser);
  on(els.btnClearStops, "click", () => { multiStops = []; renderStops(); showToast("Stops cleared"); });
  on(els.btnStartTrip, "click", startTripDefault);

  // Traffic
  bindTrafficBtn(els.trafficMorning, "morning");
  bindTrafficBtn(els.trafficNoon, "noon");
  bindTrafficBtn(els.trafficNight, "night");
  bindTrafficBtn(els.trafficMorning2, "morning");
  bindTrafficBtn(els.trafficNoon2, "noon");
  bindTrafficBtn(els.trafficNight2, "night");
  on(els.btnRerollTraffic, "click", () => { rerollTrafficLayer(); showToast("Traffic layer regenerated"); });

  // Theme
  on(els.themeToggle, "click", () => document.body.classList.toggle("theme-dark"));

  // GPS modal
  on(els.btnEnableGps, "click", () => {
    if (!navigator.geolocation) { showToast("Geolocation not supported"); return; }
    setStatus("Requesting GPS...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeUser(pos.coords.latitude, pos.coords.longitude);
        els.gpsModal?.classList.remove("modal--show");
        routeToNearestShopAndHospital();
      },
      () => {
        showToast("GPS denied. Try Demo Location.");
        setStatus("GPS denied");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  on(els.btnUseDemo, "click", () => {
    placeUser(10.7767, 106.7030, "You are here (Demo)");
    els.gpsModal?.classList.remove("modal--show");
    routeToNearestShopAndHospital();
  });

  // Drawer controls (if present)
  on(els.drawerClose, "click", closeStoreDrawer);
  on(els.drawerGrab, "click", closeStoreDrawer);
  on(els.placeClose, "click", closePlaceDrawer);
  on(els.placeGrab, "click", closePlaceDrawer);

  on(els.drawerFav, "click", () => {
    if (!activeStore) return;
    toggleSaved("store", activeStore.store);
    if (els.drawerFav) els.drawerFav.textContent = isSaved("store", activeStore.store) ? "⭐" : "☆";
  });

  on(els.placeFav, "click", () => {
    if (!activePlace) return;
    toggleSaved("hospital", activePlace.id);
    if (els.placeFav) els.placeFav.textContent = isSaved("hospital", activePlace.id) ? "⭐" : "☆";
  });

  on(els.drawerRouteBlue, "click", async () => {
    if (!activeStore) return;
    setActiveTab("map");
    map.flyTo([activeStore.lat, activeStore.lng], 16);
    storeMarkers[activeStore.store]?.openPopup();
    await routeToDestinationLatLng(activeStore.lat, activeStore.lng);
  });

  on(els.drawerRouteRed, "click", async () => {
    await routeToNearestShopAndHospital();
    showToast("Red routes updated");
  });

  on(els.placeRouteBlue, "click", async () => {
    if (!activePlace) return;
    setActiveTab("map");
    map.flyTo([activePlace.lat, activePlace.lng], 16);
    await routeToDestinationLatLng(activePlace.lat, activePlace.lng);
  });

  on(els.placeRouteRed, "click", async () => {
    await routeToNearestShopAndHospital();
  });

  // Food search
  on(els.foodSearch, "input", renderFood);
  on(els.foodCategory, "change", renderFood);

  // Saved filter + clear
  on(els.savedFilter, "change", renderSaved);
  on(els.btnClearSaved, "click", () => { lsSet(LS.saved, []); renderSaved(); showToast("Saved cleared"); });

  // Nearby
  on(els.nearbyType, "change", renderNearby);
  on(els.nearbySort, "change", renderNearby);

  // Basket clear + route best (only if UI exists)
  on(els.btnClearBasket, "click", () => { lsSet(LS.basket, []); renderBasket(); showToast("Basket cleared"); });
  on(els.btnRouteBestBasket, "click", async () => {
    const sum = basketSummary();
    if (!sum.bestStore) return showToast("Basket is empty");
    const store = STORES.find(s => s.store === sum.bestStore);
    if (!store) return;
    setActiveTab("map");
    map.flyTo([store.lat, store.lng], 16);
    storeMarkers[store.store]?.openPopup();
    openStoreDrawer(store.store);
    await routeToDestinationLatLng(store.lat, store.lng);
  });
  on(els.btnSaveBestBasket, "click", () => {
    const sum = basketSummary();
    if (!sum.bestStore) return showToast("Basket is empty");
    toggleSaved("store", sum.bestStore);
  });
}

/* -------------------------
   25) BOOT (this is the main fix)
------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  try {
    cacheEls();       // cache all IDs safely
    initMap();        // init leaflet
    bindUI();         // bind events safely (no null crash)

    // initial renders (safe)
    hydrateCategories();
    renderFood();
    renderHospitals();
    renderNearby();
    renderSaved();
    renderBasket();
    renderStops();
    syncTrafficButtons();

    // If you DON'T have GPS modal in HTML, this does nothing
    if (els.gpsModal && els.gpsModal.classList.contains("modal--show")) {
      setStatus("Waiting for GPS");
    }
  } catch (err) {
    console.error("BOOT ERROR:", err);
    alert("JS boot error. Open Console to see details.\n\n" + (err?.message || err));
  }
});
