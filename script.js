/* script.js */
/* =========================================================
   PetNourish – Full MVP EXTENDED
   Features:
   - Real GPS + demo GPS modal
   - Map with Stores + Hospitals
   - Blue route to destination (OSRM)
   - Red routes to nearest shop + hospital (OSRM)
   - Yellow traffic corridor (full length under routes)
   - Traffic time-of-day (Morning/Noon/Night) affects fake status + corridor style
   - Destination suggestions + recent searches (LocalStorage)
   - Multi-stop trip: Shop → Hospital → Home (and custom stops)
   - Open now (fake schedule) for shops/hospitals + sorting
   - Saved places ⭐ (LocalStorage)
   - Emergency mode button (nearest hospital, fullscreen, vibration)
   - Price comparison view (table + route to cheapest + save)
   - Basket + total + best store suggestion (LocalStorage)
   - Price alerts (demo) + simulate update (LocalStorage)
   - Onboarding tour (first run)
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
  { id: "h4", name: "Thao Dien Vet (Dist 2)", lat: 10.8058, lng: 106.7356 },
];

function buildStoresFromDatabase(db){
  const mapStore = new Map();
  db.forEach(item=>{
    if(!mapStore.has(item.store)){
      mapStore.set(item.store, { store:item.store, lat:item.lat, lng:item.lng, items:[] });
    }
    mapStore.get(item.store).items.push(item);
  });
  return Array.from(mapStore.values());
}
const STORES = buildStoresFromDatabase(DATABASE);

/* -------------------------
   2) OPEN-NOW (FAKE SCHEDULE)
   - We'll generate a weekly schedule for each place.
------------------------- */
function makeSchedule(seedStr){
  // consistent-ish schedule based on a string seed
  const seed = Array.from(seedStr).reduce((a,c)=>a+c.charCodeAt(0), 0);
  const openBase = 7 + (seed % 3);   // 7-9
  const closeBase = 19 + (seed % 4); // 19-22
  return {
    // Mon-Sun same hours (demo)
    open: openBase,
    close: closeBase
  };
}

const PLACE_SCHEDULE = {
  stores: Object.fromEntries(STORES.map(s => [s.store, makeSchedule(s.store)])),
  hospitals: Object.fromEntries(HOSPITALS.map(h => [h.id, makeSchedule(h.name)]))
};

function getNowHour(){
  // Uses local time (Vietnam user)
  return new Date().getHours() + new Date().getMinutes()/60;
}
function getOpenStatus(schedule){
  const now = getNowHour();
  const open = schedule.open;
  const close = schedule.close;

  // Basic (no overnight for demo)
  if(now < open) return { state:"Closed", detail:`Opens at ${open}:00`, rank:2 };
  if(now >= close) return { state:"Closed", detail:`Closed at ${close}:00`, rank:2 };
  // Closing soon
  if(close - now <= 1) return { state:"Closing soon", detail:`Closes at ${close}:00`, rank:1 };
  return { state:"Open", detail:`Closes at ${close}:00`, rank:0 };
}

/* -------------------------
   3) LOCAL STORAGE HELPERS
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

function lsGet(key, fallback){
  try{
    const v = localStorage.getItem(key);
    if(v === null || v === undefined) return fallback;
    return JSON.parse(v);
  }catch{
    return fallback;
  }
}
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
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
let routeYellowA = null;
let routeYellowB = null;

let activeStore = null;          // store object
let activePlace = null;          // {type:"store"/"hospital", id, name, lat, lng}
let trafficTime = lsGet(LS.trafficTime, "morning"); // "morning" | "noon" | "night"

let multiStops = []; // array of stop objects {type, name, lat, lng}

/* -------------------------
   5) ELEMENTS
------------------------- */
const els = {
  // Tabs
  tabMap: document.getElementById("tab-map"),
  tabFood: document.getElementById("tab-food"),
  tabCare: document.getElementById("tab-care"),
  tabNearby: document.getElementById("tab-nearby"),
  tabTraffic: document.getElementById("tab-traffic"),
  tabSaved: document.getElementById("tab-saved"),
  tabCompare: document.getElementById("tab-compare"),
  tabBasket: document.getElementById("tab-basket"),
  tabAlerts: document.getElementById("tab-alerts"),

  // Views
  viewMap: document.getElementById("view-map"),
  viewFood: document.getElementById("view-food"),
  viewCare: document.getElementById("view-care"),
  viewNearby: document.getElementById("view-nearby"),
  viewTraffic: document.getElementById("view-traffic"),
  viewSaved: document.getElementById("view-saved"),
  viewCompare: document.getElementById("view-compare"),
  viewBasket: document.getElementById("view-basket"),
  viewAlerts: document.getElementById("view-alerts"),

  // Toast
  toast: document.getElementById("toast"),

  // Map + sheet
  mapWrap: document.querySelector(".map-wrap"),
  bottomSheet: document.getElementById("bottom-sheet"),
  sheetHeader: document.getElementById("sheet-header"),
  sheetSub: document.getElementById("sheet-sub"),
  statusText: document.getElementById("status-text"),

  btnStartRoute: document.getElementById("btn-start-route"),
  btnClearRoute: document.getElementById("btn-clear-route"),
  destInput: document.getElementById("dest-input"),
  destSuggestions: document.getElementById("dest-suggestions"),

  chipNearestShop: document.getElementById("chip-nearest-shop"),
  chipNearestHospital: document.getElementById("chip-nearest-hospital"),
  chipHome: document.getElementById("chip-home"),
  chipBenThanh: document.getElementById("chip-ben-thanh"),

  btnFullscreen: document.getElementById("btn-fullscreen"),
  btnMapBack: document.getElementById("btn-map-back"),
  btnMyLocation: document.getElementById("btn-my-location"),

  btnEmergency: document.getElementById("btn-emergency"),

  // Multi-stop
  stopList: document.getElementById("stop-list"),
  btnAddStop: document.getElementById("btn-add-stop"),
  btnClearStops: document.getElementById("btn-clear-stops"),
  btnStartTrip: document.getElementById("btn-start-trip"),

  // Traffic time-of-day (two locations)
  trafficMorning: document.getElementById("traffic-morning"),
  trafficNoon: document.getElementById("traffic-noon"),
  trafficNight: document.getElementById("traffic-night"),
  trafficMorning2: document.getElementById("traffic-morning-2"),
  trafficNoon2: document.getElementById("traffic-noon-2"),
  trafficNight2: document.getElementById("traffic-night-2"),
  trafficStatusText: document.getElementById("traffic-status-text"),
  btnRerollTraffic: document.getElementById("btn-reroll-traffic"),

  // Theme
  themeToggle: document.getElementById("theme-toggle"),

  // GPS Modal
  gpsModal: document.getElementById("gps-modal"),
  btnEnableGps: document.getElementById("btn-enable-gps"),
  btnUseDemo: document.getElementById("btn-use-demo"),

  // Drawer store
  storeDrawer: document.getElementById("store-drawer"),
  drawerGrab: document.getElementById("drawer-grab"),
  drawerClose: document.getElementById("drawer-close"),
  drawerTitle: document.getElementById("drawer-title"),
  drawerSub: document.getElementById("drawer-sub"),
  drawerBody: document.getElementById("drawer-body"),
  drawerRouteBlue: document.getElementById("drawer-route-blue"),
  drawerRouteRed: document.getElementById("drawer-route-red"),
  drawerFav: document.getElementById("drawer-fav"),

  // Place drawer (hospitals or generic)
  placeDrawer: document.getElementById("place-drawer"),
  placeGrab: document.getElementById("place-grab"),
  placeClose: document.getElementById("place-close"),
  placeTitle: document.getElementById("place-title"),
  placeSub: document.getElementById("place-sub"),
  placeBody: document.getElementById("place-body"),
  placeRouteBlue: document.getElementById("place-route-blue"),
  placeRouteRed: document.getElementById("place-route-red"),
  placeFav: document.getElementById("place-fav"),

  // Food
  foodGrid: document.getElementById("food-grid"),
  foodSearch: document.getElementById("food-search"),
  foodCategory: document.getElementById("food-category"),

  // Care
  careGrid: document.getElementById("care-grid"),

  // Nearby
  nearbyGrid: document.getElementById("nearby-grid"),
  nearbyType: document.getElementById("nearby-type"),
  nearbySort: document.getElementById("nearby-sort"),

  // Saved
  savedGrid: document.getElementById("saved-grid"),
  savedFilter: document.getElementById("saved-filter"),
  btnClearSaved: document.getElementById("btn-clear-saved"),

  // Compare
  compareInput: document.getElementById("compare-input"),
  compareSuggestions: document.getElementById("compare-suggestions"),
  btnCompare: document.getElementById("btn-compare"),
  compareTbody: document.getElementById("compare-tbody"),
  btnRouteCheapest: document.getElementById("btn-route-cheapest"),
  btnSaveCheapest: document.getElementById("btn-save-cheapest"),

  // Basket
  basketList: document.getElementById("basket-list"),
  basketCount: document.getElementById("basket-count"),
  basketTotal: document.getElementById("basket-total"),
  basketSuggested: document.getElementById("basket-suggested"),
  btnClearBasket: document.getElementById("btn-clear-basket"),
  btnRouteBestBasket: document.getElementById("btn-route-best-basket"),
  btnSaveBestBasket: document.getElementById("btn-save-best-basket"),

  // Alerts
  alertItem: document.getElementById("alert-item"),
  alertSuggestions: document.getElementById("alert-suggestions"),
  alertPrice: document.getElementById("alert-price"),
  btnAddAlert: document.getElementById("btn-add-alert"),
  btnSimUpdate: document.getElementById("btn-simulate-update"),
  alertsGrid: document.getElementById("alerts-grid"),

  // Tour
  tour: document.getElementById("tour"),
  tourCard: document.getElementById("tour-card"),
  tourEmoji: document.getElementById("tour-emoji"),
  tourTitle: document.getElementById("tour-title"),
  tourText: document.getElementById("tour-text"),
  tourHighlight: document.getElementById("tour-highlight"),
  tourDots: document.getElementById("tour-dots"),
  tourNext: document.getElementById("tour-next"),
  tourBack: document.getElementById("tour-back"),
  tourSkip: document.getElementById("tour-skip"),
};

/* -------------------------
   6) UI UTILITIES
------------------------- */
function showToast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(()=>els.toast.classList.remove("show"), 2500);
}
function setStatus(text){ els.statusText.textContent = text; }

function setLoading(btn, isLoading){
  if(!btn) return;
  btn.classList.toggle("is-loading", !!isLoading);
  btn.disabled = !!isLoading;
}

/* -------------------------
   7) TABS
------------------------- */
function setActiveTab(tabName){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("view--active"));
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("tab-btn--active"));

  const view = document.getElementById(`view-${tabName}`);
  const tab = document.getElementById(`tab-${tabName}`);
  if(view) view.classList.add("view--active");
  if(tab) tab.classList.add("tab-btn--active");

  if(tabName === "map" && map) setTimeout(()=> map.invalidateSize(), 200);
}

els.tabMap.addEventListener("click", ()=> setActiveTab("map"));
els.tabFood.addEventListener("click", ()=> { setActiveTab("food"); renderFood(); });
els.tabCare.addEventListener("click", ()=> { setActiveTab("care"); renderHospitals(); });
els.tabNearby.addEventListener("click", ()=> { setActiveTab("nearby"); renderNearby(); });
els.tabTraffic.addEventListener("click", ()=> { setActiveTab("traffic"); syncTrafficButtons(); });
els.tabSaved.addEventListener("click", ()=> { setActiveTab("saved"); renderSaved(); });
els.tabCompare.addEventListener("click", ()=> { setActiveTab("compare"); });
els.tabBasket.addEventListener("click", ()=> { setActiveTab("basket"); renderBasket(); });
els.tabAlerts.addEventListener("click", ()=> { setActiveTab("alerts"); renderAlerts(); });

/* -------------------------
   8) GEOUTILS
------------------------- */
function haversine(aLat, aLng, bLat, bLng){
  const R = 6371e3;
  const toRad = d => d * Math.PI/180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function parseVND(priceStr){
  return Number(String(priceStr).replace(/[^\d]/g, "")) || 0;
}
function formatVND(n){
  try{
    return n.toLocaleString("vi-VN") + "₫";
  }catch{
    return String(n) + "₫";
  }
}

/* -------------------------
   9) MAP INIT + PANES
------------------------- */
const HCMC_CENTER = { lat: 10.7769, lng: 106.7009 };

function initMap(){
  map = L.map("map", { zoomControl:true }).setView([HCMC_CENTER.lat, HCMC_CENTER.lng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution:"© OpenStreetMap" }).addTo(map);

  map.createPane("paneYellow"); map.getPane("paneYellow").style.zIndex = 350;
  map.createPane("paneRed");    map.getPane("paneRed").style.zIndex = 360;
  map.createPane("paneBlue");   map.getPane("paneBlue").style.zIndex = 370;
  map.createPane("paneMarkersTop"); map.getPane("paneMarkersTop").style.zIndex = 500;

  // Store markers
  STORES.forEach(s=>{
    const icon = L.divIcon({
      className:"",
      html:`<div style="
        background: rgba(133,200,138,0.95);
        border: 2px solid white;
        width: 26px; height: 26px;
        border-radius: 10px;
        display:grid; place-items:center;
        box-shadow: 0 10px 18px rgba(0,0,0,0.18);
        font-size: 14px;">🛒</div>`,
      iconSize:[26,26], iconAnchor:[13,13]
    });

    const sched = PLACE_SCHEDULE.stores[s.store];
    const st = getOpenStatus(sched);
    const popup = `<b>🛒 ${s.store}</b><br>${st.state} • ${st.detail}<br>${s.items.length} items`;

    const m = L.marker([s.lat, s.lng], { icon, pane:"paneMarkersTop" }).addTo(map).bindPopup(popup);

    m.on("click", ()=> openStoreDrawer(s.store));
    storeMarkers[s.store] = m;
  });

  // Hospital markers
  HOSPITALS.forEach(h=>{
    const icon = L.divIcon({
      className:"",
      html:`<div style="
        background: rgba(228,75,75,0.95);
        border: 2px solid white;
        width: 26px; height: 26px;
        border-radius: 10px;
        display:grid; place-items:center;
        box-shadow: 0 10px 18px rgba(0,0,0,0.18);
        font-size: 14px;">🏥</div>`,
      iconSize:[26,26], iconAnchor:[13,13]
    });

    const sched = PLACE_SCHEDULE.hospitals[h.id];
    const st = getOpenStatus(sched);
    const popup = `<b>🏥 ${h.name}</b><br>${st.state} • ${st.detail}`;

    const m = L.marker([h.lat, h.lng], { icon, pane:"paneMarkersTop" }).addTo(map).bindPopup(popup);

    m.on("click", ()=> openPlaceDrawer({ type:"hospital", id:h.id, name:h.name, lat:h.lat, lng:h.lng }));
    hospitalMarkers[h.id] = m;
  });

  setStatus("Waiting for GPS");
}
initMap();

/* -------------------------
   10) ROUTE LAYERS
------------------------- */
function clearRoutes(all=true){
  // all true => clears everything
  const list = [routeBlue, routeRedShop, routeRedHospital, routeYellowA, routeYellowB];
  list.forEach(l=>{ if(l) map.removeLayer(l); });
  routeBlue = routeRedShop = routeRedHospital = routeYellowA = routeYellowB = null;
  if(all){
    els.trafficStatusText.textContent = "No route yet.";
  }
}

function trafficProfile(){
  // used to slightly change corridor weight/opacity and status per time-of-day
  if(trafficTime === "morning") return { w:18, o:0.38, label:"Morning peak", status:["Medium","High","Medium"] };
  if(trafficTime === "noon")    return { w:16, o:0.34, label:"Noon flow",   status:["Low","Medium","Medium"] };
  return { w:14, o:0.30, label:"Night fast",  status:["Low","Low","Medium"] };
}

function makeTrafficLayer(coords){
  // jitter applied to ALL points for full corridor
  const base = trafficProfile();
  const jitter = (trafficTime === "morning") ? 0.00026 : (trafficTime === "noon") ? 0.00021 : 0.00018;
  const phase = Math.random() * Math.PI * 2;

  return coords.map((c, i)=>{
    const wave = Math.sin(i * 0.22 + phase) * jitter;
    const noiseLat = (Math.random()-0.5) * (jitter*0.55);
    const noiseLng = (Math.random()-0.5) * (jitter*0.55);
    return [c[0] + wave + noiseLat, c[1] - wave + noiseLng];
  });
}

function drawTrafficUnder(coords){
  const p = trafficProfile();
  return L.polyline(coords, {
    pane:"paneYellow",
    color:"#F6C34A",
    weight:p.w,
    opacity:p.o,
    lineCap:"round",
    lineJoin:"round"
  }).addTo(map);
}

function drawBlue(coords){
  return L.polyline(coords, {
    pane:"paneBlue",
    color:"#2E78FF",
    weight:6,
    opacity:0.86,
    lineCap:"round",
    lineJoin:"round"
  }).addTo(map);
}

function drawRed(coords, dashed=false){
  return L.polyline(coords, {
    pane:"paneRed",
    color:"#E44B4B",
    weight:6,
    opacity:0.75,
    dashArray: dashed ? "10,10" : null,
    lineCap:"round",
    lineJoin:"round"
  }).addTo(map);
}

function fakeTrafficStatus(){
  const p = trafficProfile();
  const pick = p.status[Math.floor(Math.random()*p.status.length)];
  const note = (pick === "High") ? "Heavy congestion likely" :
               (pick === "Medium") ? "Some congestion expected" :
               "Smooth traffic flow";
  return { label: pick, note, timeLabel: p.label };
}
function updateTrafficUI(){
  const t = fakeTrafficStatus();
  els.trafficStatusText.textContent = `${t.timeLabel}: ${t.label} — ${t.note}`;
  if(routeBlue || routeRedShop || routeRedHospital){
    els.sheetSub.textContent = `Traffic (${t.timeLabel}): ${t.label} — ${t.note}`;
  }
  return t;
}

/* -------------------------
   11) OSRM ROUTING + NOMINATIM
------------------------- */
async function geocodeToLatLng(query){
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers:{ "Accept":"application/json" } });
  if(!res.ok) throw new Error("Geocoder failed");
  const data = await res.json();
  if(!data || !data[0]) throw new Error("Destination not found");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

async function fetchOsrmRoute(aLat, aLng, bLat, bLng){
  const url = `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("Routing failed");
  const data = await res.json();
  if(!data.routes || !data.routes[0]) throw new Error("No route found");
  return data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
}

/* Multi-leg route (waypoints array of {lat,lng}) */
async function fetchOsrmTrip(waypoints){
  if(waypoints.length < 2) throw new Error("Need at least 2 stops");
  const parts = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${parts}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("Trip routing failed");
  const data = await res.json();
  if(!data.routes || !data.routes[0]) throw new Error("No trip route found");
  return data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
}

/* -------------------------
   12) GPS
------------------------- */
function placeUser(lat, lng, label="You are here (GPS)"){
  userLat = lat; userLng = lng;

  if(userMarker) map.removeLayer(userMarker);

  userMarker = L.marker([userLat, userLng], {
    pane:"paneMarkersTop",
    icon: L.divIcon({
      className:"user-icon",
      html:`<div style="background:#2E78FF;width:15px;height:15px;border-radius:50%;border:2px solid white;"></div>`,
      iconSize:[20,20]
    })
  }).addTo(map).bindPopup(label);

  map.setView([userLat, userLng], 14);
  setStatus("GPS Locked ✅");
  showToast("GPS connected ✅");

  // auto set home if not set
  const home = lsGet(LS.home, null);
  if(!home){
    lsSet(LS.home, { lat:userLat, lng:userLng, label:"Home (auto set)" });
  }

  // render dependent views
  renderNearby();
  renderSaved();
  renderBasket();
}

els.btnEnableGps.addEventListener("click", ()=>{
  if(!navigator.geolocation){ showToast("Geolocation not supported"); return; }
  setStatus("Requesting GPS...");

  navigator.geolocation.getCurrentPosition(
    pos=>{
      placeUser(pos.coords.latitude, pos.coords.longitude);
      els.gpsModal.classList.remove("modal--show");
      routeToNearestShopAndHospital();
      maybeStartTour();
    },
    ()=>{
      showToast("GPS denied. Try Demo Location.");
      setStatus("GPS denied");
    },
    { enableHighAccuracy:true, timeout:12000, maximumAge:0 }
  );
});

els.btnUseDemo.addEventListener("click", ()=>{
  placeUser(10.7767, 106.7030, "You are here (Demo)");
  els.gpsModal.classList.remove("modal--show");
  routeToNearestShopAndHospital();
  maybeStartTour();
});

/* -------------------------
   13) MAIN ROUTE ACTIONS
------------------------- */
async function routeToDestinationText(destinationText){
  if(!userLat){ showToast("Waiting for GPS..."); return; }
  setLoading(els.btnStartRoute, true);

  try{
    const dest = await geocodeToLatLng(destinationText);
    rememberDestination(destinationText);

    // Clear only blue + yellowA (keep red routes)
    if(routeBlue) map.removeLayer(routeBlue);
    if(routeYellowA) map.removeLayer(routeYellowA);
    routeBlue = routeYellowA = null;

    const blueCoords = await fetchOsrmRoute(userLat, userLng, dest.lat, dest.lng);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(blueCoords));
    routeBlue = drawBlue(blueCoords);

    map.fitBounds(L.latLngBounds(blueCoords), { padding:[50,50] });
    setStatus("Routing active ✅");
    updateTrafficUI();

    els.bottomSheet.classList.add("sheet-minimized");
    closeAllDrawers();
    showToast("Route ready ✅");
  }catch(err){
    showToast(err?.message || "Route failed");
  }finally{
    setLoading(els.btnStartRoute, false);
  }
}

async function routeToDestinationLatLng(lat, lng){
  if(!userLat){ showToast("Waiting for GPS..."); return; }

  try{
    if(routeBlue) map.removeLayer(routeBlue);
    if(routeYellowA) map.removeLayer(routeYellowA);
    routeBlue = routeYellowA = null;

    const blueCoords = await fetchOsrmRoute(userLat, userLng, lat, lng);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(blueCoords));
    routeBlue = drawBlue(blueCoords);

    map.fitBounds(L.latLngBounds(blueCoords), { padding:[50,50] });
    setStatus("Routing active ✅");
    updateTrafficUI();
    els.bottomSheet.classList.add("sheet-minimized");
  }catch{
    showToast("Route failed");
  }
}

async function routeToNearestShopAndHospital(){
  if(!userLat) return;

  // nearest store
  let nearestStore = null; let bestS = Infinity;
  STORES.forEach(s=>{
    const d = haversine(userLat, userLng, s.lat, s.lng);
    if(d < bestS){ bestS = d; nearestStore = s; }
  });

  // nearest hospital
  let nearestHospital = null; let bestH = Infinity;
  HOSPITALS.forEach(h=>{
    const d = haversine(userLat, userLng, h.lat, h.lng);
    if(d < bestH){ bestH = d; nearestHospital = h; }
  });

  try{
    // remove old reds + yellowB
    if(routeRedShop) map.removeLayer(routeRedShop);
    if(routeRedHospital) map.removeLayer(routeRedHospital);
    if(routeYellowB) map.removeLayer(routeYellowB);
    routeRedShop = routeRedHospital = routeYellowB = null;

    if(nearestStore){
      const coords = await fetchOsrmRoute(userLat, userLng, nearestStore.lat, nearestStore.lng);
      routeYellowB = drawTrafficUnder(makeTrafficLayer(coords));
      routeRedShop = drawRed(coords, false);
    }

    if(nearestHospital){
      const coordsH = await fetchOsrmRoute(userLat, userLng, nearestHospital.lat, nearestHospital.lng);
      routeRedHospital = drawRed(coordsH, true);
    }

    updateTrafficUI();
  }catch{
    showToast("Nearest routing failed");
  }
}

/* Multi-stop TRIP: User -> Shop -> Hospital -> Home (plus extra stops user adds) */
async function startTripDefault(){
  if(!userLat){ showToast("Waiting for GPS..."); return; }
  setLoading(els.btnStartTrip, true);

  try{
    // pick nearest shop & hospital
    let nearestStore = null; let bestS = Infinity;
    STORES.forEach(s=>{
      const d = haversine(userLat, userLng, s.lat, s.lng);
      if(d < bestS){ bestS = d; nearestStore = s; }
    });
    let nearestHospital = null; let bestH = Infinity;
    HOSPITALS.forEach(h=>{
      const d = haversine(userLat, userLng, h.lat, h.lng);
      if(d < bestH){ bestH = d; nearestHospital = h; }
    });

    const home = lsGet(LS.home, { lat:userLat, lng:userLng, label:"Home" });

    // Build trip waypoints: user + (extra stops) + nearest shop + nearest hospital + home
    const wp = [{ lat:userLat, lng:userLng }];
    // include custom stops chosen by user (if any)
    multiStops.forEach(s => wp.push({ lat:s.lat, lng:s.lng }));
    if(nearestStore) wp.push({ lat:nearestStore.lat, lng:nearestStore.lng });
    if(nearestHospital) wp.push({ lat:nearestHospital.lat, lng:nearestHospital.lng });
    wp.push({ lat:home.lat, lng:home.lng });

    // Clear everything (trip is main)
    clearRoutes(true);

    const tripCoords = await fetchOsrmTrip(wp);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(tripCoords));
    routeBlue = drawBlue(tripCoords);

    map.fitBounds(L.latLngBounds(tripCoords), { padding:[50,50] });
    setStatus("Trip active ✅");
    updateTrafficUI();
    els.bottomSheet.classList.add("sheet-minimized");
    closeAllDrawers();
    showToast("Trip started ✅");
  }catch(e){
    showToast(e?.message || "Trip failed");
  }finally{
    setLoading(els.btnStartTrip, false);
  }
}

/* -------------------------
   14) DESTINATION SUGGESTIONS + RECENTS
------------------------- */
function rememberDestination(text){
  const rec = lsGet(LS.recentDest, []);
  const cleaned = text.trim();
  if(!cleaned) return;
  const next = [cleaned, ...rec.filter(x=>x.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8);
  lsSet(LS.recentDest, next);
}

function getDestinationSuggestions(q){
  const rec = lsGet(LS.recentDest, []);
  const picks = [];

  // quick places
  const quick = ["Ben Thanh Market", "Saigon Zoo", "Landmark 81", "Tan Son Nhat Airport"];
  const all = [...rec, ...quick];

  const qq = q.toLowerCase().trim();
  all.forEach(x=>{
    if(!qq || x.toLowerCase().includes(qq)){
      if(!picks.includes(x)) picks.push(x);
    }
  });
  return picks.slice(0, 6);
}

function renderDestSuggestions(list){
  if(!els.destSuggestions) return;
  if(!list || list.length === 0){
    els.destSuggestions.innerHTML = "";
    els.destSuggestions.style.display = "none";
    return;
  }

  els.destSuggestions.style.display = "block";
  els.destSuggestions.innerHTML = list.map((s,i)=>`
    <button class="sug-item" type="button" data-val="${encodeURIComponent(s)}">${s}</button>
  `).join("");

  els.destSuggestions.querySelectorAll(".sug-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = decodeURIComponent(btn.dataset.val);
      els.destInput.value = v;
      els.destSuggestions.style.display = "none";
      routeToDestinationText(v);
    });
  });
}

els.destInput.addEventListener("input", ()=>{
  const list = getDestinationSuggestions(els.destInput.value);
  renderDestSuggestions(list);
});
els.destInput.addEventListener("focus", ()=>{
  const list = getDestinationSuggestions(els.destInput.value);
  renderDestSuggestions(list);
});
document.addEventListener("click", (e)=>{
  if(!els.destSuggestions) return;
  if(!els.destSuggestions.contains(e.target) && e.target !== els.destInput){
    els.destSuggestions.style.display = "none";
  }
});

/* -------------------------
   15) MULTI-STOP UI
------------------------- */
function renderStops(){
  if(!els.stopList) return;

  if(multiStops.length === 0){
    els.stopList.innerHTML = `<div class="stop-empty">No custom stops. Add stop if needed.</div>`;
    return;
  }

  els.stopList.innerHTML = multiStops.map((s, idx)=>`
    <div class="stop-row">
      <div class="stop-left">
        <div class="stop-name">${s.type === "store" ? "🛒" : s.type==="hospital" ? "🏥" : "📍"} ${s.name}</div>
        <div class="stop-sub">${(userLat ? (haversine(userLat,userLng,s.lat,s.lng)/1000).toFixed(2) : "—")} km away</div>
      </div>
      <button class="stop-remove" type="button" data-idx="${idx}">Remove</button>
    </div>
  `).join("");

  els.stopList.querySelectorAll(".stop-remove").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      multiStops.splice(idx, 1);
      renderStops();
      showToast("Stop removed");
    });
  });
}

function addStopChooser(){
  // Very simple chooser (demo): add nearest store or nearest hospital or custom typed destination
  const choice = prompt("Add stop:\n1 = Nearest Store\n2 = Nearest Hospital\n3 = Type destination address");
  if(!choice) return;

  if(choice.trim() === "1"){
    if(!userLat) return showToast("Need GPS first");
    let nearestStore=null; let best=Infinity;
    STORES.forEach(s=>{
      const d=haversine(userLat,userLng,s.lat,s.lng);
      if(d<best){best=d; nearestStore=s;}
    });
    if(nearestStore){
      multiStops.push({ type:"store", name:nearestStore.store, lat:nearestStore.lat, lng:nearestStore.lng });
      renderStops(); showToast("Added nearest store");
    }
    return;
  }

  if(choice.trim() === "2"){
    if(!userLat) return showToast("Need GPS first");
    let nearest=null; let best=Infinity;
    HOSPITALS.forEach(h=>{
      const d=haversine(userLat,userLng,h.lat,h.lng);
      if(d<best){best=d; nearest=h;}
    });
    if(nearest){
      multiStops.push({ type:"hospital", name:nearest.name, lat:nearest.lat, lng:nearest.lng });
      renderStops(); showToast("Added nearest hospital");
    }
    return;
  }

  if(choice.trim() === "3"){
    const t = prompt("Type destination name/address:");
    if(!t) return;
    // geocode and add
    (async ()=>{
      try{
        const d = await geocodeToLatLng(t);
        multiStops.push({ type:"custom", name:t, lat:d.lat, lng:d.lng });
        renderStops(); showToast("Added custom stop");
      }catch{
        showToast("Stop not found");
      }
    })();
    return;
  }

  showToast("Invalid choice");
}

els.btnAddStop.addEventListener("click", addStopChooser);
els.btnClearStops.addEventListener("click", ()=>{
  multiStops = [];
  renderStops();
  showToast("Stops cleared");
});
els.btnStartTrip.addEventListener("click", startTripDefault);
renderStops();

/* -------------------------
   16) QUICK CHIPS
------------------------- */
els.btnStartRoute.addEventListener("click", ()=>{
  const val = els.destInput.value.trim();
  if(!val){ showToast("Type a destination"); return; }
  routeToDestinationText(val);
});

els.btnClearRoute.addEventListener("click", ()=>{
  clearRoutes(true);
  els.destInput.value = "";
  els.bottomSheet.classList.remove("sheet-minimized");
  setStatus(userLat ? "GPS Locked ✅" : "Waiting for GPS");
  els.sheetSub.textContent = "GPS routing + nearest shop & hospital";
  showToast("Cleared");
});

els.sheetHeader.addEventListener("click", ()=>{
  els.bottomSheet.classList.toggle("sheet-minimized");
});

els.chipNearestShop.addEventListener("click", async ()=>{
  if(!userLat) return showToast("Waiting for GPS...");
  await routeToNearestShopAndHospital();

  let nearestStore=null; let best=Infinity;
  STORES.forEach(s=>{
    const d=haversine(userLat,userLng,s.lat,s.lng);
    if(d<best){best=d; nearestStore=s;}
  });
  if(nearestStore){
    setActiveTab("map");
    map.flyTo([nearestStore.lat, nearestStore.lng], 16);
    storeMarkers[nearestStore.store]?.openPopup();
    openStoreDrawer(nearestStore.store);
  }
});

els.chipNearestHospital.addEventListener("click", async ()=>{
  if(!userLat) return showToast("Waiting for GPS...");
  await routeToNearestShopAndHospital();

  let nearest=null; let best=Infinity;
  HOSPITALS.forEach(h=>{
    const d=haversine(userLat,userLng,h.lat,h.lng);
    if(d<best){best=d; nearest=h;}
  });
  if(nearest){
    setActiveTab("map");
    map.flyTo([nearest.lat, nearest.lng], 16);
    hospitalMarkers[nearest.id]?.openPopup();
    openPlaceDrawer({ type:"hospital", id:nearest.id, name:nearest.name, lat:nearest.lat, lng:nearest.lng });
  }
});

els.chipBenThanh.addEventListener("click", ()=>{
  els.destInput.value = "Ben Thanh Market";
  routeToDestinationText("Ben Thanh Market");
});

els.chipHome.addEventListener("click", ()=>{
  const home = lsGet(LS.home, null);
  if(!home) return showToast("Home not set yet");
  setActiveTab("map");
  map.flyTo([home.lat, home.lng], 16);
  routeToDestinationLatLng(home.lat, home.lng);
});

/* -------------------------
   17) FULLSCREEN + MY LOCATION
------------------------- */
function toggleFullscreen(isFull){
  if(isFull) els.mapWrap.classList.add("map-expanded");
  else els.mapWrap.classList.remove("map-expanded");
  setTimeout(()=> map.invalidateSize(), 200);
}
els.btnFullscreen.addEventListener("click", ()=> toggleFullscreen(true));
els.btnMapBack.addEventListener("click", ()=> toggleFullscreen(false));

els.btnMyLocation.addEventListener("click", ()=>{
  if(!userLat) return showToast("GPS not ready");
  setActiveTab("map");
  map.flyTo([userLat, userLng], 15);
  userMarker?.openPopup();
});

/* -------------------------
   18) EMERGENCY MODE
------------------------- */
els.btnEmergency.addEventListener("click", async ()=>{
  if(!userLat) return showToast("Need GPS first");

  // nearest hospital
  let nearest=null; let best=Infinity;
  HOSPITALS.forEach(h=>{
    const d=haversine(userLat,userLng,h.lat,h.lng);
    if(d<best){best=d; nearest=h;}
  });
  if(!nearest) return;

  showToast("Emergency: routing to nearest hospital!");
  setActiveTab("map");
  toggleFullscreen(true);

  // vibrate (mobile)
  if(navigator.vibrate) navigator.vibrate([120, 80, 120]);

  await routeToDestinationLatLng(nearest.lat, nearest.lng);
  hospitalMarkers[nearest.id]?.openPopup();
  openPlaceDrawer({ type:"hospital", id:nearest.id, name:nearest.name, lat:nearest.lat, lng:nearest.lng });
});

/* -------------------------
   19) TRAFFIC TIME BUTTONS
------------------------- */
function setTrafficTime(t){
  trafficTime = t;
  lsSet(LS.trafficTime, t);
  syncTrafficButtons();
  // If routes exist, reroll traffic corridor
  rerollTrafficLayer();
}
function syncTrafficButtons(){
  const setActive = (id, active)=>{
    const el = document.getElementById(id);
    if(el) el.classList.toggle("pill-btn--active", active);
  };
  setActive("traffic-morning", trafficTime==="morning");
  setActive("traffic-noon", trafficTime==="noon");
  setActive("traffic-night", trafficTime==="night");

  setActive("traffic-morning-2", trafficTime==="morning");
  setActive("traffic-noon-2", trafficTime==="noon");
  setActive("traffic-night-2", trafficTime==="night");
}

function bindTrafficBtn(btn, time){
  if(!btn) return;
  btn.addEventListener("click", ()=> setTrafficTime(time));
}
bindTrafficBtn(els.trafficMorning, "morning");
bindTrafficBtn(els.trafficNoon, "noon");
bindTrafficBtn(els.trafficNight, "night");
bindTrafficBtn(els.trafficMorning2, "morning");
bindTrafficBtn(els.trafficNoon2, "noon");
bindTrafficBtn(els.trafficNight2, "night");

function rerollTrafficLayer(){
  // Replace existing yellow layers based on route coords
  if(routeBlue){
    const coords = routeBlue.getLatLngs().map(ll => [ll.lat, ll.lng]);
    if(routeYellowA) map.removeLayer(routeYellowA);
    routeYellowA = drawTrafficUnder(makeTrafficLayer(coords));
  }
  if(routeRedShop){
    const coords = routeRedShop.getLatLngs().map(ll => [ll.lat, ll.lng]);
    if(routeYellowB) map.removeLayer(routeYellowB);
    routeYellowB = drawTrafficUnder(makeTrafficLayer(coords));
  }
  updateTrafficUI();
}
els.btnRerollTraffic.addEventListener("click", ()=>{
  rerollTrafficLayer();
  showToast("Traffic layer regenerated");
});
syncTrafficButtons();

/* -------------------------
   20) DRAWERS + SAVED PLACES
------------------------- */
function closeAllDrawers(){
  closeStoreDrawer();
  closePlaceDrawer();
}

function openDrawer(el){
  el?.classList.add("drawer--open");
  el?.setAttribute("aria-hidden", "false");
}
function closeDrawer(el){
  el?.classList.remove("drawer--open");
  el?.setAttribute("aria-hidden", "true");
}

/* Saved places structure:
   [{ type:"store", key:"storeName" } , { type:"hospital", key:"h1"}]
*/
function getSaved(){ return lsGet(LS.saved, []); }
function setSaved(list){ lsSet(LS.saved, list); renderSaved(); }

function isSaved(type, key){
  const s = getSaved();
  return s.some(x=>x.type===type && x.key===key);
}
function toggleSaved(type, key){
  const s = getSaved();
  const exists = s.some(x=>x.type===type && x.key===key);
  const next = exists ? s.filter(x=>!(x.type===type && x.key===key)) : [{type, key}, ...s];
  setSaved(next);
  showToast(exists ? "Removed from saved" : "Saved ✅");
}

/* Store Drawer */
function openStoreDrawer(storeName){
  const store = STORES.find(s=>s.store===storeName);
  if(!store) return;
  activeStore = store;

  // minimize sheet
  els.bottomSheet.classList.add("sheet-minimized");

  // open status
  const sch = PLACE_SCHEDULE.stores[store.store];
  const st = getOpenStatus(sch);

  // distance
  let dist = "—";
  if(userLat) dist = (haversine(userLat,userLng,store.lat,store.lng)/1000).toFixed(2) + " km";

  els.drawerTitle.textContent = store.store;
  els.drawerSub.textContent = `${st.state} • ${st.detail} • ${dist} • ${store.items.length} items`;

  // Favorite star state
  els.drawerFav.textContent = isSaved("store", store.store) ? "⭐" : "☆";

  // top cheapest items
  const sorted = [...store.items].sort((a,b)=>parseVND(a.price)-parseVND(b.price));
  const top3 = sorted.slice(0,3);

  els.drawerBody.innerHTML = `
    <div class="drawer-mini">
      <div class="drawer-badges">
        <span class="badge ${st.state==="Open" ? "badge-open" : st.state==="Closing soon" ? "badge-soon" : "badge-closed"}">${st.state}</span>
        <span class="badge badge-soft">Best deals</span>
      </div>
    </div>
    <div class="drawer-list">
      ${top3.map(it=>`
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

  // bind add buttons
  els.drawerBody.querySelectorAll(".drawer-add").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = Number(btn.dataset.id);
      addToBasket(id);
    });
  });

  closePlaceDrawer();
  openDrawer(els.storeDrawer);
}
function closeStoreDrawer(){
  closeDrawer(els.storeDrawer);
  activeStore = null;
}
els.drawerClose.addEventListener("click", closeStoreDrawer);
els.drawerGrab.addEventListener("click", closeStoreDrawer);

els.drawerFav.addEventListener("click", ()=>{
  if(!activeStore) return;
  toggleSaved("store", activeStore.store);
  els.drawerFav.textContent = isSaved("store", activeStore.store) ? "⭐" : "☆";
});

els.drawerRouteBlue.addEventListener("click", async ()=>{
  if(!activeStore) return;
  setActiveTab("map");
  map.flyTo([activeStore.lat, activeStore.lng], 16);
  storeMarkers[activeStore.store]?.openPopup();
  await routeToDestinationLatLng(activeStore.lat, activeStore.lng);
});
els.drawerRouteRed.addEventListener("click", async ()=>{
  await routeToNearestShopAndHospital();
  showToast("Red routes updated");
});

/* Place Drawer (Hospitals or other) */
function openPlaceDrawer(place){
  activePlace = place;

  els.bottomSheet.classList.add("sheet-minimized");

  const sch = (place.type==="hospital") ? PLACE_SCHEDULE.hospitals[place.id] : PLACE_SCHEDULE.stores[place.name];
  const st = getOpenStatus(sch);

  let dist = "—";
  if(userLat) dist = (haversine(userLat,userLng,place.lat,place.lng)/1000).toFixed(2) + " km";

  els.placeTitle.textContent = (place.type==="hospital" ? "🏥 " : "📍 ") + place.name;
  els.placeSub.textContent = `${st.state} • ${st.detail} • ${dist}`;

  const key = place.type === "hospital" ? place.id : place.name;
  els.placeFav.textContent = isSaved(place.type, key) ? "⭐" : "☆";

  els.placeBody.innerHTML = `
    <div class="care-card" style="margin:0;">
      <div class="care-title">${st.state}</div>
      <div class="care-sub">${st.detail}</div>
      <div class="care-sub">Tip: Use Emergency Mode for fastest hospital routing.</div>
    </div>
  `;

  closeStoreDrawer();
  openDrawer(els.placeDrawer);
}
function closePlaceDrawer(){
  closeDrawer(els.placeDrawer);
  activePlace = null;
}
els.placeClose.addEventListener("click", closePlaceDrawer);
els.placeGrab.addEventListener("click", closePlaceDrawer);

els.placeFav.addEventListener("click", ()=>{
  if(!activePlace) return;
  const key = activePlace.type === "hospital" ? activePlace.id : activePlace.name;
  toggleSaved(activePlace.type, key);
  els.placeFav.textContent = isSaved(activePlace.type, key) ? "⭐" : "☆";
});

els.placeRouteBlue.addEventListener("click", async ()=>{
  if(!activePlace) return;
  setActiveTab("map");
  map.flyTo([activePlace.lat, activePlace.lng], 16);
  await routeToDestinationLatLng(activePlace.lat, activePlace.lng);
});
els.placeRouteRed.addEventListener("click", async ()=>{
  await routeToNearestShopAndHospital();
});

/* -------------------------
   21) SAVED VIEW
------------------------- */
function renderSaved(){
  if(!els.savedGrid) return;

  const list = getSaved();
  const filter = els.savedFilter?.value || "all";
  const shown = list.filter(x => filter==="all" ? true : x.type===filter);

  if(shown.length === 0){
    els.savedGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">No saved places</div>
        <div class="care-sub">Tap ⭐ on a store/hospital to save it.</div>
      </div>`;
    return;
  }

  els.savedGrid.innerHTML = shown.map(x=>{
    if(x.type === "store"){
      const s = STORES.find(k=>k.store===x.key);
      if(!s) return "";
      const st = getOpenStatus(PLACE_SCHEDULE.stores[s.store]);
      const dist = userLat ? (haversine(userLat,userLng,s.lat,s.lng)/1000).toFixed(2)+" km" : "—";
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
    }else{
      const h = HOSPITALS.find(k=>k.id===x.key);
      if(!h) return "";
      const st = getOpenStatus(PLACE_SCHEDULE.hospitals[h.id]);
      const dist = userLat ? (haversine(userLat,userLng,h.lat,h.lng)/1000).toFixed(2)+" km" : "—";
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

  els.savedGrid.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const act = btn.dataset.act;
      const type = btn.dataset.type;
      const key = decodeURIComponent(btn.dataset.key);

      if(act === "remove"){
        toggleSaved(type, key);
        return;
      }

      if(type === "store"){
        const s = STORES.find(z=>z.store===key);
        if(!s) return;
        setActiveTab("map");
        map.flyTo([s.lat, s.lng], 16);
        storeMarkers[s.store]?.openPopup();
        openStoreDrawer(s.store);
        if(act === "route") await routeToDestinationLatLng(s.lat, s.lng);
      }else{
        const h = HOSPITALS.find(z=>z.id===key);
        if(!h) return;
        setActiveTab("map");
        map.flyTo([h.lat, h.lng], 16);
        hospitalMarkers[h.id]?.openPopup();
        openPlaceDrawer({ type:"hospital", id:h.id, name:h.name, lat:h.lat, lng:h.lng });
        if(act === "route") await routeToDestinationLatLng(h.lat, h.lng);
      }
    });
  });
}

els.savedFilter.addEventListener("change", renderSaved);
els.btnClearSaved.addEventListener("click", ()=>{
  lsSet(LS.saved, []);
  renderSaved();
  showToast("Saved cleared");
});

/* -------------------------
   22) FOOD VIEW + BASKET
------------------------- */
function hydrateCategories(){
  const cats = Array.from(new Set(DATABASE.map(d=>d.category))).sort();
  els.foodCategory.innerHTML = `<option value="any">All Categories</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
}
hydrateCategories();

function getBasket(){ return lsGet(LS.basket, []); } // [{id, qty}]
function setBasket(list){ lsSet(LS.basket, list); renderBasket(); }

function addToBasket(itemId){
  const b = getBasket();
  const found = b.find(x=>x.id===itemId);
  if(found) found.qty += 1;
  else b.push({ id:itemId, qty:1 });
  setBasket(b);
  showToast("Added to basket ✅");
}

function removeFromBasket(itemId){
  const b = getBasket().filter(x=>x.id!==itemId);
  setBasket(b);
  showToast("Removed");
}

function updateBasketQty(itemId, qty){
  const b = getBasket();
  const found = b.find(x=>x.id===itemId);
  if(!found) return;
  found.qty = Math.max(1, qty);
  setBasket(b);
}

function renderFood(){
  const q = (els.foodSearch.value || "").toLowerCase().trim();
  const cat = els.foodCategory.value;

  const filtered = DATABASE.filter(d=>{
    const matchText = d.item.toLowerCase().includes(q) || d.store.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q);
    const matchCat = (cat==="any") ? true : d.category===cat;
    return matchText && matchCat;
  });

  if(filtered.length === 0){
    els.foodGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">No results</div>
        <div class="care-sub">Try another keyword or category.</div>
      </div>`;
    return;
  }

  els.foodGrid.innerHTML = filtered.map(d=>{
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
          <button class="btn-map-link" type="button" data-act="alert" data-name="${encodeURIComponent(d.item)}">
            🔔 Alert
          </button>
        </div>
      </div>
    `;
  }).join("");

  els.foodGrid.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const act = btn.dataset.act;

      if(act === "map"){
        const store = decodeURIComponent(btn.dataset.store);
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        setActiveTab("map");
        map.flyTo([lat,lng], 16);
        storeMarkers[store]?.openPopup();
        openStoreDrawer(store);
        return;
      }

      if(act === "basket"){
        const id = Number(btn.dataset.id);
        addToBasket(id);
        return;
      }

      if(act === "save"){
        const store = decodeURIComponent(btn.dataset.store);
        toggleSaved("store", store);
        renderFood(); // refresh button label
        return;
      }

      if(act === "alert"){
        const name = decodeURIComponent(btn.dataset.name);
        setActiveTab("alerts");
        els.alertItem.value = name;
        showToast("Set alert for item");
        return;
      }
    });
  });
}

els.foodSearch.addEventListener("input", renderFood);
els.foodCategory.addEventListener("change", renderFood);
renderFood();

/* Basket view + best store suggestion */
function basketSummary(){
  const b = getBasket();
  const items = b.map(x=>{
    const data = DATABASE.find(d=>d.id===x.id);
    return data ? { ...data, qty:x.qty, unit:parseVND(data.price) } : null;
  }).filter(Boolean);

  const count = items.reduce((a,x)=>a+x.qty,0);
  const total = items.reduce((a,x)=>a+x.qty*x.unit,0);

  // Suggest best store by total sum if user buys all items from that store (simple demo)
  // Since each item belongs to one store in our dataset, this finds store with most basket coverage and lowest total.
  const storeTotals = new Map();
  items.forEach(it=>{
    const cur = storeTotals.get(it.store) || { sum:0, count:0 };
    cur.sum += it.qty * it.unit;
    cur.count += it.qty;
    storeTotals.set(it.store, cur);
  });

  let bestStore = null;
  let bestSum = Infinity;
  storeTotals.forEach((v, store)=>{
    if(v.sum < bestSum){ bestSum = v.sum; bestStore = store; }
  });

  return { items, count, total, bestStore, bestSum };
}

function renderBasket(){
  if(!els.basketList) return;

  const sum = basketSummary();
  els.basketCount.textContent = String(sum.count);
  els.basketTotal.textContent = formatVND(sum.total);

  if(sum.items.length === 0){
    els.basketList.innerHTML = `<div class="empty-state">Your basket is empty.</div>`;
    els.basketSuggested.textContent = "Add items to get a recommendation.";
    return;
  }

  els.basketList.innerHTML = sum.items.map(it=>`
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

  // Suggest store
  if(sum.bestStore){
    els.basketSuggested.textContent = `Best store for your basket: ${sum.bestStore} — Total ${formatVND(sum.bestSum)}`;
  }else{
    els.basketSuggested.textContent = "No recommendation yet.";
  }

  els.basketList.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const act = btn.dataset.act;
      const id = Number(btn.dataset.id);

      const b = getBasket();
      const f = b.find(x=>x.id===id);
      if(!f) return;

      if(act === "remove"){
        removeFromBasket(id);
        return;
      }
      if(act === "plus"){
        f.qty += 1;
        setBasket(b);
        return;
      }
      if(act === "minus"){
        f.qty = Math.max(1, f.qty - 1);
        setBasket(b);
        return;
      }
    });
  });

  els.basketList.querySelectorAll(".qty-input").forEach(inp=>{
    inp.addEventListener("change", ()=>{
      const id = Number(inp.dataset.id);
      const qty = Number(inp.value || 1);
      updateBasketQty(id, qty);
    });
  });
}

els.btnClearBasket.addEventListener("click", ()=>{
  lsSet(LS.basket, []);
  renderBasket();
  showToast("Basket cleared");
});

els.btnRouteBestBasket.addEventListener("click", async ()=>{
  const sum = basketSummary();
  if(!sum.bestStore) return showToast("Basket is empty");
  const store = STORES.find(s=>s.store===sum.bestStore);
  if(!store) return;
  setActiveTab("map");
  map.flyTo([store.lat, store.lng], 16);
  storeMarkers[store.store]?.openPopup();
  openStoreDrawer(store.store);
  await routeToDestinationLatLng(store.lat, store.lng);
});

els.btnSaveBestBasket.addEventListener("click", ()=>{
  const sum = basketSummary();
  if(!sum.bestStore) return showToast("Basket is empty");
  toggleSaved("store", sum.bestStore);
});

/* -------------------------
   23) PRICE COMPARISON VIEW
   (In this dataset, each item is unique per store,
    so comparison will match by keyword and show candidate items/stores)
------------------------- */
function uniqueItemNames(){
  const names = Array.from(new Set(DATABASE.map(d=>d.item))).sort();
  return names;
}

function suggestItems(q){
  const qq = q.toLowerCase().trim();
  const all = uniqueItemNames();
  if(!qq) return all.slice(0, 6);
  return all.filter(n=>n.toLowerCase().includes(qq)).slice(0, 6);
}

function renderSuggestions(container, list, onPick){
  if(!container) return;
  if(!list || list.length===0){
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  container.innerHTML = list.map(x=>`<button class="sug-item" type="button" data-val="${encodeURIComponent(x)}">${x}</button>`).join("");
  container.querySelectorAll(".sug-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = decodeURIComponent(btn.dataset.val);
      onPick(v);
      container.style.display = "none";
    });
  });
}

let lastCompareRows = []; // cached rows from last compare
let lastCheapestStore = null;

function doCompare(){
  const q = els.compareInput.value.toLowerCase().trim();
  if(!q){
    showToast("Type an item name to compare");
    return;
  }

  // Find matching items by keyword (demo)
  const matches = DATABASE.filter(d=>d.item.toLowerCase().includes(q));
  if(matches.length===0){
    els.compareTbody.innerHTML = `<tr><td colspan="4" class="empty-cell">No matching items found.</td></tr>`;
    lastCompareRows = [];
    lastCheapestStore = null;
    return;
  }

  // Build rows (store, price, open)
  const rows = matches.map(d=>{
    const st = getOpenStatus(PLACE_SCHEDULE.stores[d.store]);
    return {
      store: d.store,
      lat: d.lat, lng: d.lng,
      price: parseVND(d.price),
      priceLabel: d.price,
      open: st.state,
      openDetail: st.detail
    };
  }).sort((a,b)=>a.price-b.price);

  lastCompareRows = rows;
  lastCheapestStore = rows[0]?.store || null;

  els.compareTbody.innerHTML = rows.map((r, idx)=>`
    <tr class="${idx===0 ? "row-cheapest" : ""}">
      <td>${r.store}</td>
      <td><b>${r.priceLabel}</b></td>
      <td>${r.open} <span class="muted">(${r.openDetail})</span></td>
      <td>
        <button class="btn-map-link" type="button" data-act="route" data-store="${encodeURIComponent(r.store)}">Route</button>
      </td>
    </tr>
  `).join("");

  els.compareTbody.querySelectorAll("button[data-act='route']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const store = decodeURIComponent(btn.dataset.store);
      const s = STORES.find(x=>x.store===store);
      if(!s) return;
      setActiveTab("map");
      map.flyTo([s.lat,s.lng], 16);
      storeMarkers[s.store]?.openPopup();
      openStoreDrawer(s.store);
      await routeToDestinationLatLng(s.lat, s.lng);
    });
  });

  showToast(`Cheapest: ${rows[0].store}`);
}

els.compareInput.addEventListener("input", ()=>{
  renderSuggestions(els.compareSuggestions, suggestItems(els.compareInput.value), (v)=>{ els.compareInput.value=v; doCompare(); });
});
els.compareInput.addEventListener("focus", ()=>{
  renderSuggestions(els.compareSuggestions, suggestItems(els.compareInput.value), (v)=>{ els.compareInput.value=v; doCompare(); });
});
document.addEventListener("click", (e)=>{
  if(els.compareSuggestions && !els.compareSuggestions.contains(e.target) && e.target!==els.compareInput){
    els.compareSuggestions.style.display = "none";
  }
});

els.btnCompare.addEventListener("click", doCompare);

els.btnRouteCheapest.addEventListener("click", async ()=>{
  if(!lastCheapestStore) return showToast("Compare first");
  const s = STORES.find(x=>x.store===lastCheapestStore);
  if(!s) return;
  setActiveTab("map");
  map.flyTo([s.lat,s.lng], 16);
  storeMarkers[s.store]?.openPopup();
  openStoreDrawer(s.store);
  await routeToDestinationLatLng(s.lat, s.lng);
});

els.btnSaveCheapest.addEventListener("click", ()=>{
  if(!lastCheapestStore) return showToast("Compare first");
  toggleSaved("store", lastCheapestStore);
});

/* -------------------------
   24) ALERTS (DEMO)
------------------------- */
function getAlerts(){ return lsGet(LS.alerts, []); } // [{item, below}]
function setAlerts(list){ lsSet(LS.alerts, list); renderAlerts(); }

function renderAlerts(){
  const list = getAlerts();

  if(list.length===0){
    els.alertsGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">Your alerts</div>
        <div class="care-sub">No alerts yet. Add one above.</div>
      </div>`;
    return;
  }

  els.alertsGrid.innerHTML = list.map((a, idx)=>`
    <div class="care-card">
      <div class="care-title">🔔 ${a.item}</div>
      <div class="care-sub">Notify if below <b>${formatVND(a.below)}</b></div>
      <button class="btn-map-link" type="button" data-idx="${idx}">Remove</button>
    </div>
  `).join("");

  els.alertsGrid.querySelectorAll("button[data-idx]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      const next = getAlerts().filter((_,i)=>i!==idx);
      setAlerts(next);
      showToast("Alert removed");
    });
  });
}

function alertItemSuggestions(q){
  const qq = q.toLowerCase().trim();
  const names = uniqueItemNames();
  if(!qq) return names.slice(0, 6);
  return names.filter(n=>n.toLowerCase().includes(qq)).slice(0, 6);
}

els.alertItem.addEventListener("input", ()=>{
  renderSuggestions(els.alertSuggestions, alertItemSuggestions(els.alertItem.value), (v)=>{ els.alertItem.value=v; });
});
els.alertItem.addEventListener("focus", ()=>{
  renderSuggestions(els.alertSuggestions, alertItemSuggestions(els.alertItem.value), (v)=>{ els.alertItem.value=v; });
});
document.addEventListener("click", (e)=>{
  if(els.alertSuggestions && !els.alertSuggestions.contains(e.target) && e.target!==els.alertItem){
    els.alertSuggestions.style.display = "none";
  }
});

els.btnAddAlert.addEventListener("click", ()=>{
  const item = els.alertItem.value.trim();
  const below = Number(els.alertPrice.value || 0);
  if(!item || !below) return showToast("Enter item and price");

  const list = getAlerts();
  list.unshift({ item, below });
  setAlerts(list.slice(0, 12));
  showToast("Alert added ✅");
});

els.btnSimUpdate.addEventListener("click", ()=>{
  const alerts = getAlerts();
  if(alerts.length===0) return showToast("No alerts to simulate");

  // Simulate price changes by random - and see if trigger any alert
  let triggered = 0;

  alerts.forEach(a=>{
    // find matching items in DB (keyword)
    const matches = DATABASE.filter(d=>d.item.toLowerCase().includes(a.item.toLowerCase()));
    if(matches.length===0) return;

    // simulate new price (0.7 - 1.1 of current)
    const pick = matches[Math.floor(Math.random()*matches.length)];
    const current = parseVND(pick.price);
    const factor = 0.70 + Math.random()*0.40;
    const simulated = Math.round(current * factor / 1000) * 1000;

    if(simulated < a.below){
      triggered++;
      showToast(`🔔 Alert! "${a.item}" dropped to ${formatVND(simulated)} (demo)`);
    }
  });

  if(triggered===0) showToast("No alerts triggered (demo)");
});

/* -------------------------
   25) CARE + NEARBY (open now sorting)
------------------------- */
function renderHospitals(){
  els.careGrid.innerHTML = HOSPITALS.map(h=>{
    const st = getOpenStatus(PLACE_SCHEDULE.hospitals[h.id]);
    const dist = userLat ? (haversine(userLat,userLng,h.lat,h.lng)/1000).toFixed(2)+" km" : "—";
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

  els.careGrid.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const h = HOSPITALS.find(x=>x.id===id);
      if(!h) return;

      if(act === "save"){
        toggleSaved("hospital", h.id);
        renderHospitals();
        return;
      }

      setActiveTab("map");
      map.flyTo([h.lat,h.lng], 16);
      hospitalMarkers[h.id]?.openPopup();
      openPlaceDrawer({ type:"hospital", id:h.id, name:h.name, lat:h.lat, lng:h.lng });

      if(act === "route"){
        await routeToDestinationLatLng(h.lat, h.lng);
      }
    });
  });
}

function renderNearby(){
  if(!els.nearbyGrid) return;
  els.nearbyGrid.innerHTML = "";

  if(!userLat){
    els.nearbyGrid.innerHTML = `
      <div class="care-card">
        <div class="care-title">GPS required</div>
        <div class="care-sub">Enable GPS (or Demo location) to view nearby places.</div>
      </div>`;
    return;
  }

  const type = els.nearbyType.value; // all | store | hospital
  const sort = els.nearbySort.value; // distance | name | open

  let list = [];

  if(type==="all" || type==="store"){
    STORES.forEach(s=>{
      const sch = PLACE_SCHEDULE.stores[s.store];
      const st = getOpenStatus(sch);
      list.push({
        kind:"store",
        key:s.store,
        name:s.store,
        lat:s.lat, lng:s.lng,
        dist:haversine(userLat,userLng,s.lat,s.lng),
        openRank: st.rank,
        openText: `${st.state} • ${st.detail}`
      });
    });
  }

  if(type==="all" || type==="hospital"){
    HOSPITALS.forEach(h=>{
      const st = getOpenStatus(PLACE_SCHEDULE.hospitals[h.id]);
      list.push({
        kind:"hospital",
        key:h.id,
        name:h.name,
        lat:h.lat, lng:h.lng,
        dist:haversine(userLat,userLng,h.lat,h.lng),
        openRank: st.rank,
        openText: `${st.state} • ${st.detail}`
      });
    });
  }

  if(sort==="distance") list.sort((a,b)=>a.dist-b.dist);
  if(sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==="open") list.sort((a,b)=>a.openRank-b.openRank || a.dist-b.dist);

  els.nearbyGrid.innerHTML = list.slice(0,12).map(p=>{
    const km = (p.dist/1000).toFixed(2);
    const saved = isSaved(p.kind==="store" ? "store" : "hospital", p.key);
    return `
      <div class="care-card">
        <div class="care-title">${p.kind==="store" ? "🛒" : "🏥"} ${p.name}</div>
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

  els.nearbyGrid.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const act = btn.dataset.act;
      const kind = btn.dataset.kind;
      const key = decodeURIComponent(btn.dataset.key);

      if(act==="save"){
        toggleSaved(kind, key);
        renderNearby();
        return;
      }

      if(kind==="store"){
        const s = STORES.find(x=>x.store===key);
        if(!s) return;
        setActiveTab("map");
        map.flyTo([s.lat,s.lng], 16);
        storeMarkers[s.store]?.openPopup();
        openStoreDrawer(s.store);
        if(act==="route") await routeToDestinationLatLng(s.lat, s.lng);
      }else{
        const h = HOSPITALS.find(x=>x.id===key);
        if(!h) return;
        setActiveTab("map");
        map.flyTo([h.lat,h.lng], 16);
        hospitalMarkers[h.id]?.openPopup();
        openPlaceDrawer({ type:"hospital", id:h.id, name:h.name, lat:h.lat, lng:h.lng });
        if(act==="route") await routeToDestinationLatLng(h.lat, h.lng);
      }
    });
  });
}
els.nearbyType.addEventListener("change", renderNearby);
els.nearbySort.addEventListener("change", renderNearby);

/* -------------------------
   26) THEME
------------------------- */
els.themeToggle.addEventListener("click", ()=> document.body.classList.toggle("theme-dark"));

/* -------------------------
   27) ONBOARDING TOUR (simple)
------------------------- */
const TOUR_STEPS = [
  { emoji:"🗺️", title:"Map & GPS", text:"This map shows pet stores and hospitals around you. Enable GPS for best results.", target:"#map" },
  { emoji:"🚨", title:"Emergency Mode", text:"Tap Emergency to route instantly to the nearest hospital.", target:"#btn-emergency" },
  { emoji:"🧭", title:"Routing Controls", text:"Use the search bar to route anywhere, and the Yellow corridor shows traffic status.", target:"#bottom-sheet" },
  { emoji:"⭐", title:"Saved Places", text:"Save your favorite store/hospital and access them quickly in the Saved tab.", target:"#tab-saved" }
];

let tourIndex = 0;

function maybeStartTour(){
  const done = lsGet(LS.tour, false);
  if(done) return;
  startTour();
}

function startTour(){
  tourIndex = 0;
  els.tour.classList.remove("tour--hidden");
  renderTourStep();
}

function endTour(){
  els.tour.classList.add("tour--hidden");
  lsSet(LS.tour, true);
}

function renderTourDots(){
  els.tourDots.innerHTML = TOUR_STEPS.map((_,i)=>`<span class="dotx ${i===tourIndex?"dotx--on":""}"></span>`).join("");
}

function renderTourStep(){
  const s = TOUR_STEPS[tourIndex];
  els.tourEmoji.textContent = s.emoji;
  els.tourTitle.textContent = s.title;
  els.tourText.textContent = s.text;

  renderTourDots();

  // highlight target
  const targetEl = document.querySelector(s.target);
  if(targetEl){
    const r = targetEl.getBoundingClientRect();
    els.tourHighlight.style.display = "block";
    els.tourHighlight.style.left = (r.left - 8) + "px";
    els.tourHighlight.style.top = (r.top - 8) + "px";
    els.tourHighlight.style.width = (r.width + 16) + "px";
    els.tourHighlight.style.height = (r.height + 16) + "px";
  }else{
    els.tourHighlight.style.display = "none";
  }

  els.tourBack.disabled = (tourIndex === 0);
  els.tourNext.textContent = (tourIndex === TOUR_STEPS.length-1) ? "Finish" : "Next";
}

els.tourNext.addEventListener("click", ()=>{
  if(tourIndex >= TOUR_STEPS.length-1){
    endTour();
  }else{
    tourIndex++;
    renderTourStep();
  }
});
els.tourBack.addEventListener("click", ()=>{
  tourIndex = Math.max(0, tourIndex-1);
  renderTourStep();
});
els.tourSkip.addEventListener("click", endTour);

/* -------------------------
   28) STARTUP DEFAULTS
------------------------- */
// show modal is already in HTML. We'll keep it.
// make sure initial render
renderHospitals();
renderNearby();
renderSaved();
renderBasket();
renderAlerts();

/* -------------------------
   29) Small missing CSS hooks fallback
   (If you didn't add these in CSS yet, it won't break, just no styling.)
------------------------- */
(function injectMissingSuggestionCSS(){
  // No-op; kept for safety (we won't inject styles here).
})();
