// Local Configuration & Center Focus Variables
const localLat = 27.1353;
const localLon = -82.4382;
let countdownVal = 120;

const AIRNOW_API_KEY = "E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4"; 

const myakkaGauges = [
    { id: "02298488", name: "Myakka River Upst from Youngs Ck", lat: 27.35, lon: -82.10, noaaId: "MYKFL1" },
    { id: "02298554", name: "Myakka River Near Myakka City", lat: 27.35, lon: -82.10, noaaId: "MYKFL2" },
    { id: "02298830", name: "Myakka River Near Sarasota", lat: 27.25, lon: -82.30, noaaId: "MYKFL3" },
    { id: "02298880", name: "Myakka River At Control Near Laurel", lat: 27.10, lon: -82.40, noaaId: "MYKFL4" },
    { id: "02298990", name: "Myakka River at Ramblers Rest Near South Venice", lat: 27.072, lon: -82.316, noaaId: "MYKFL5" }
];

let globalForecastDataCache = null;
let globalActiveAlertsCache = {};
let globalAQIDetailsCache = {};
let noaaChartInstance = null;
let alertSoundEnabled = false;
let previousAlertCount = 0;
let alertAudio = null;

// Initialize alert sound
function initAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        alertAudio = audioContext;
    } catch (err) {
        console.log("Audio context initialization deferred - will try on first user interaction");
    }
}

// Play alert sound
function playAlertSound() {
    if (!alertSoundEnabled || !alertAudio) return;
    
    try {
        const context = alertAudio;
        if (context.state === 'suspended') {
            context.resume();
        }
        
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.1);
        
        const osc2 = context.createOscillator();
        osc2.connect(gainNode);
        osc2.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.3, context.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.25);
        osc2.start(context.currentTime + 0.15);
        osc2.stop(context.currentTime + 0.25);
    } catch (err) {
        console.error("Alert sound error:", err);
    }
}

// Layout configuration
const config = {
    settings: { hasHeaders: true, reorderEnabled: true, showPopoutIcon: false, showMaximiseIcon: true, showCloseIcon: false },
    content: [{
        type: 'row',
        content: [
            {
                type: 'column',
                width: 40,
                content: [
                    { type: 'component', componentName: 'radarMap', title: 'WINDY DYNAMIC RADAR TRACKING & ARRAYS' },
                    { type: 'component', componentName: 'localForecast', title: '7-DAY GEOGRAPHIC SYNOPTIC OUTLOOK (34275)' }
                ]
            },
            {
                type: 'column',
                width: 30,
                content: [
                    { type: 'component', componentName: 'nwsAlerts', title: 'CRITICAL ENVIRONMENTAL SPECTRUM HAZARDS MATRIX - FLORIDA' },
                    { type: 'component', componentName: 'hydrologyFeed', title: 'MYAKKA HYDROLOGIC REAL-TIME STREAMFLOW' }
                ]
            },
            {
                type: 'column',
                width: 30,
                content: [
                    { type: 'component', componentName: 'cloudMap', title: 'WINDY DYNAMIC TRACKING & ARRAYS' },
                    { type: 'component', componentName: 'airQualityPanel', title: 'REGIONAL AIR QUALITY MATRIX (AIRNOW LIVE)' },
                    { type: 'component', componentName: 'noaaTides', title: 'NOAA TIDES & CURRENTS (STATION 8726384 - PORT MANATEE)' }
                ]
            }
        ]
    }]
};

const layout = new GoldenLayout(config, '#desktopLayoutContainer');

// --- Component Registrations ---
layout.registerComponent('radarMap', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%; background:#0d1117;">
            <div style="position:absolute; top:15px; right:15px; z-index:999;">
                <select id="windyLayerSelect" style="background: rgba(33, 38, 45, 0.9); color: #00ffcc; border: 1px solid #00ffcc; padding: 6px 10px; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; border-radius: 4px; cursor: pointer;">
                    <option value="radar">Weather Radar</option>
                    <option value="satellite">Satellite</option>
                    <option value="wind">Wind</option>
                    <option value="rain">Rain</option>
                    <option value="thunder">Thunderstorms</option>
                    <option value="temp">Temperature</option>
                    <option value="clouds">Clouds</option>
                    <option value="waves">Waves</option>
                    <option value="thermals">Thermals</option>
                    <option value="cape">CAPE Index</option>
                </select>
            </div>
            <iframe id="windyIframe" src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=radar&product=radar&level=surface&lat=27.1353&lon=-82.4382" style="width:100%; height:100%; border:none;"></iframe>
        </div>
    `);
    
    setTimeout(() => {
        const select = container.getElement().find('#windyLayerSelect');
        const iframe = container.getElement().find('#windyIframe')[0];
        
        select.on('change', function() {
            const layer = this.value;
            const product = (layer === 'radar' || layer === 'satellite') ? layer : 'gfs';
            iframe.src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${layer}&product=${product}&level=surface&lat=27.1353&lon=-82.4382`;
        });
    }, 200);
});

layout.registerComponent('cloudMap', function(container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%; background:#0d1117;">
            <div style="position:absolute; top:15px; right:15px; z-index:999;">
                <select id="windyCloudLayerSelect" style="background: rgba(33, 38, 45, 0.9); color: #00ffcc; border: 1px solid #00ffcc; padding: 6px 10px; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; border-radius: 4px; cursor: pointer;">
                    <option value="radar">Weather Radar</option>
                    <option value="satellite">Satellite</option>
                    <option value="wind">Wind</option>
                    <option value="rain">Rain</option>
                    <option value="thunder">Thunderstorms</option>
                    <option value="temp">Temperature</option>
                    <option value="clouds" selected>Clouds</option>
                    <option value="highclouds">High Clouds</option>
                    <option value="mediumclouds">Medium Clouds</option>
                    <option value="lowclouds">Low Clouds</option>
                    <option value="fog">Fog</option>
                    <option value="cloudtop">Cloud Tops</option>
                    <option value="cloudbase">Cloud Base</option>
                    <option value="waves">Waves</option>
                    <option value="thermals">Thermals</option>
                    <option value="cape">CAPE Index</option>
                </select>
            </div>
            <iframe id="windyCloudIframe" src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=clouds&product=gfs&level=surface&lat=27.1353&lon=-82.4382" style="width:100%; height:100%; border:none;"></iframe>
        </div>
    `);
    
    setTimeout(() => {
        const select = container.getElement().find('#windyCloudLayerSelect');
        const iframe = container.getElement().find('#windyCloudIframe')[0];
        
        select.on('change', function() {
            const layer = this.value;
            const product = (layer === 'radar' || layer === 'satellite') ? layer : 'gfs';
            iframe.src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${layer}&product=${product}&level=surface&lat=27.1353&lon=-82.4382`;
        });
    }, 200);
});

layout.registerComponent('localForecast', function(container) {
    container.getElement().html(`<div class="weather-component" id="forecast-container">Connecting to synoptic timeline grids...</div>`);
    container.on('open', fetchNWSForecast);
});

layout.registerComponent('nwsAlerts', function(container) {
    container.getElement().html(`
        <div class="weather-component" style="position:relative;">
            <div style="margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #30363d; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#ffcc00; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> NWS ALERTS</div>
                <button id="soundToggleBtn" onclick="toggleAlertSound()" style="background: #21262d; border: 1px solid #30363d; color: #8b949e; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 0.7rem; transition: all 0.2s;" title="Toggle alert sound">
                    <i class="fa-solid fa-volume-mute"></i> SOUND OFF
                </button>
            </div>
            <div id="alerts-container">Scanning NWS alert network...</div>
        </div>`);
    container.on('open', fetchFloridaAlerts);
});

layout.registerComponent('airQualityPanel', function(container) {
    container.getElement().html(`<div class="weather-component" id="aqi-container-target">Interrogating AirNow sensor frames...</div>`);
    container.on('open', fetchAirQualityData);
});

layout.registerComponent('noaaTides', function(container) {
    container.getElement().html(`
        <div class="weather-component" style="display:flex; flex-direction:column; gap:10px;">
            <div id="noaa-gauges" class="aqi-panel-wrap" style="margin-bottom: 5px;">
                <span style="color:#8b949e; font-size:0.8rem;"><i class="fa-solid fa-satellite-dish"></i> Contacting NOAA sensors...</span>
            </div>
            <div style="flex-grow:1; min-height:180px; position:relative; background:#161b22; border: 1px solid #30363d; border-radius:4px; padding:10px;">
                <canvas id="noaaChart"></canvas>
            </div>
        </div>
    `);
    container.on('open', fetchNOAATides);
});

layout.registerComponent('hydrologyFeed', function(container) {
    container.getElement().html(`<div class="weather-component" id="hydro-river-list">Interrogating USGS stream vectors...</div>`);
    container.on('open', fetchMyakkaHydrology);
});

layout.init();

// Initialize audio on first user interaction
document.addEventListener('click', () => {
    if (!alertAudio) {
        initAlertSound();
    }
}, { once: true });

// --- Logic Implementation ---

function toggleAlertSound() {
    if (!alertAudio) {
        initAlertSound();
    }
    
    alertSoundEnabled = !alertSoundEnabled;
    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
        if (alertSoundEnabled) {
            btn.style.background = '#1a3a1a';
            btn.style.borderColor = '#00ff55';
            btn.style.color = '#00ff55';
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> SOUND ON';
            playAlertSound();
        } else {
            btn.style.background = '#21262d';
            btn.style.borderColor = '#30363d';
            btn.style.color = '#8b949e';
            btn.innerHTML = '<i class="fa-solid fa-volume-mute"></i> SOUND OFF';
        }
    }
}

function fetchNWSForecast() {
    fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
        .then(res => res.json())
        .then(d => fetch(d.properties.forecast))
        .then(res => res.json())
        .then(data => {
            globalForecastDataCache = data.properties.periods;
            let html = `<div id="current-obs" style="margin-bottom:15px; font-size:1.1rem; color:#fff; padding:10px; background:#161b22; border:1px solid #30363d; border-radius:4px;">CURRENT CONDITIONS</div>`;
            html += `<div class="forecast-grid">`;
            
            globalForecastDataCache.forEach((p, i) => {
                html += `
                <div class="forecast-card" onclick="openForecastDetails(${i})">
                    <div style="color:#8b949e; font-size:0.75rem; font-weight:bold; height:24px; overflow:hidden;">${p.name.toUpperCase()}</div>
                    <img src="${p.icon}">
                    <div class="${p.isDaytime?'temp-high':'temp-low'}">${p.temperature}°${p.temperatureUnit}</div>
                    <div style="font-size:0.65rem; color:#8b949e; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; margin-top:4px;">${p.shortForecast}</div>
                </div>`;
            });
            html += `</div>`;
            $('#forecast-container').html(html);
        }).catch(err => console.error("Forecast error:", err));
}

function openForecastDetails(index) {
    if (!globalForecastDataCache || !globalForecastDataCache[index]) return;
    const period = globalForecastDataCache[index];
    const modalHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
            <img src="${period.icon}" style="width:70px; border-radius: 4px;">
            <h2 style="margin: 5px 0; color:#fff;">${period.temperature}°${period.temperatureUnit}</h2>
            <div style="color:#ffcc00; font-weight:bold; letter-spacing:1px;">${period.shortForecast}</div>
        </div>
        <div style="border-top: 1px solid #30363d; padding-top: 15px; color:#c9d1d9; font-family: monospace; line-height: 1.6;">
            ${period.detailedForecast}
        </div>`;
    openFloatingModal(`${period.name} METEOROLOGICAL DETAILS`, modalHTML);
}

function fetchFloridaAlerts() {
    const container = $('#alerts-container');
    console.log("Starting Florida alerts fetch...");
    
    // Use the NWS alerts API with a broad Florida search
    // Query all alerts and filter for FL
    fetch('https://api.weather.gov/alerts/active')
        .then(res => {
            console.log("Alert API response status:", res.status);
            return res.json();
        })
        .then(data => {
            console.log("Total features returned:", data.features ? data.features.length : 0);
            
            let allAlerts = data.features || [];
            
            // Filter for Florida alerts only
            let flAlerts = allAlerts.filter(f => {
                const areaDesc = f.properties.areaDesc || '';
                const properties = f.properties;
                
                // Check if alert applies to FL
                return areaDesc.includes('FL') || 
                       areaDesc.includes('Florida') ||
                       (properties.areaDesc && properties.areaDesc.toLowerCase().includes('florida'));
            });
            
            console.log("Florida alerts found:", flAlerts.length);
            flAlerts.forEach(alert => {
                console.log("Alert:", alert.properties.event, "-", alert.properties.areaDesc);
            });
            
            globalActiveAlertsCache = {};
            let html = '';
            let alertCount = 0;
            
            if (flAlerts.length > 0) {
                html += `<div style="margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #30363d;">
                    <div style="font-size:0.75rem; color:#ffcc00; font-weight:bold; margin-bottom:5px;">ACTIVE ALERTS - ${flAlerts.length}</div>`;
                
                flAlerts.forEach(f => {
                    const props = f.properties;
                    const alertId = props.id;
                    globalActiveAlertsCache[alertId] = props;
                    alertCount++;
                    
                    // Critical event types highlighting
                    const criticalEvents = ['Tornado Warning', 'Severe Thunderstorm Warning', 'Flash Flood Warning', 'Winter Storm Warning', 'Flood Warning', 'Hurricane Warning'];
                    const isCritical = criticalEvents.includes(props.event);
                    const alertStyle = isCritical ? 'border-left: 4px solid #ff0000; background: #3d1a1a;' : 'border-left: 4px solid #ff6600; background: #2d2416;';
                    
                    html += `
                        <div class="alert-item" style="${alertStyle} padding: 8px; margin-bottom: 6px; border-radius: 2px; cursor: pointer; font-size:0.75rem;" onclick="openAlertDetails('${alertId}')">
                            <div style="color: ${isCritical ? '#ff0000' : '#ffaa33'}; font-weight: bold; text-transform: uppercase;">${props.event}</div>
                            <div style="color:#8b949e; margin-top:2px; font-size:0.7rem;">${props.areaDesc} | ${props.headline ? props.headline.substring(0, 40) + (props.headline.length > 40 ? '...' : '') : ''}</div>
                        </div>`;
                });
                html += `</div>`;
            } else {
                html = "<span style='color:#00ff55; font-size:0.8rem;'>✓ SYSTEM CLEAN: NO ACTIVE ALERTS FOR FLORIDA</span>";
            }
            
            // Check if new alerts appeared and play sound
            if (alertCount > previousAlertCount && alertCount > 0) {
                playAlertSound();
            }
            previousAlertCount = alertCount;
            
            container.html(html);
        })
        .catch(err => {
            console.error("Florida alerts fetch error:", err);
            container.html(`<span style="color:#ff5555; font-size:0.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> ALERT DATABASE UNREACHABLE</span>`);
        });
}

function openAlertDetails(id) {
    const alertData = globalActiveAlertsCache[id];
    if (!alertData) return;
    
    let body = `<div style="color:#ff5555; font-weight:bold; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:8px;">${alertData.headline || alertData.event}</div>`;
    body += `<div style="color:#8b949e; margin-bottom:8px;"><strong>Area:</strong> ${alertData.areaDesc}</div>`;
    body += `<div style="color:#fff; background:#0d1117; padding:12px; border-radius:4px; border:1px solid #21262d; margin-bottom:15px; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; word-wrap:break-word;">${alertData.description}</div>`;
    
    if (alertData.instruction) {
        body += `<div style="color:#ffcc00; font-weight:bold; margin-bottom:5px;"><i class="fa-solid fa-shield-halved"></i> RECOMMENDED ACTIONS:</div>`;
        body += `<div style="color:#00ffcc; background:#1f242c; padding:12px; border-radius:4px; border:1px solid #30363d; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; word-wrap:break-word;">${alertData.instruction}</div>`;
    }
    
    openFloatingModal(`FLORIDA ALERT DETAILS`, body);
}

// EPA-standard AQI category reference (used for both live readings and forecast data)
const AQI_CATEGORY_INFO = {
    1: { label: "Good", color: "#00e400", message: "Air quality is satisfactory, and air pollution poses little or no risk." },
    2: { label: "Moderate", color: "#ffff00", message: "Air quality is acceptable. Unusually sensitive individuals should consider limiting prolonged outdoor exertion." },
    3: { label: "Unhealthy SG", color: "#ff7e00", message: "Members of sensitive groups (asthma, heart/lung conditions, children, older adults) may experience health effects." },
    4: { label: "Unhealthy", color: "#ff0000", message: "Everyone may begin to experience health effects; sensitive groups may experience more serious effects." },
    5: { label: "Very Unhealthy", color: "#8f3f97", message: "Health alert: risk of health effects is increased for everyone." },
    6: { label: "Hazardous", color: "#7e0023", message: "Health warning of emergency conditions: the entire population is more likely to be affected." }
};

function getAQIColorSpecs(aqiValue, categoryNumber) {
    if (categoryNumber && AQI_CATEGORY_INFO[categoryNumber]) return AQI_CATEGORY_INFO[categoryNumber];
    // Fallback to standard EPA breakpoints if no category number is supplied
    if (aqiValue <= 50)  return AQI_CATEGORY_INFO[1];
    if (aqiValue <= 100) return AQI_CATEGORY_INFO[2];
    if (aqiValue <= 150) return AQI_CATEGORY_INFO[3];
    if (aqiValue <= 200) return AQI_CATEGORY_INFO[4];
    if (aqiValue <= 300) return AQI_CATEGORY_INFO[5];
    return AQI_CATEGORY_INFO[6];
}

function fetchAirQualityData() {
    const zipCode = "34275";
    const currentUrl = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zipCode}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
    const forecastUrl = `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${zipCode}&distance=25&API_KEY=${AIRNOW_API_KEY}`;

    Promise.all([
        fetch(currentUrl).then(res => res.json()),
        fetch(forecastUrl).then(res => res.json()).catch(() => [])
    ])
        .then(([data, forecastData]) => {
            let html = `
                <div style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed #30363d;">
                    <div style="font-size:0.85rem; color:#fff;">
                        <i class="fa-solid fa-satellite-dish"></i> NOKOMIS / VENICE (34275)
                        <span style="color: #00ffcc; font-size: 0.7rem; margin-left:4px;">[LIVE]</span>
                    </div>
                </div>`;

            globalAQIDetailsCache = {};

            if(!data || data.length === 0) {
                html += `<div style="color:#ff8800; font-size:0.75rem; padding:8px 0;">NO SENSOR DATA</div>`;
            } else {
                // Determine the worst active category among current readings for an enhanced alert banner
                let worstCategory = 0;
                let worstParam = null;
                data.forEach(p => {
                    const catNum = p.Category && p.Category.Number ? p.Category.Number : null;
                    if (catNum && catNum > worstCategory) {
                        worstCategory = catNum;
                        worstParam = p;
                    }
                });

                // Enhanced health alert banner when AQI reaches Unhealthy-for-Sensitive-Groups or worse
                if (worstCategory >= 3 && worstParam) {
                    const alertProfile = getAQIColorSpecs(worstParam.AQI, worstCategory);
                    globalAQIDetailsCache['health'] = {
                        title: `${alertProfile.label.toUpperCase()} - ${worstParam.ParameterName}`,
                        body: `<div style="color:${alertProfile.color}; font-weight:bold; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:8px;">${worstParam.ParameterName} &mdash; AQI ${worstParam.AQI} (Category ${worstCategory}: ${alertProfile.label})</div>
                            <div style="color:#8b949e; margin-bottom:8px;"><strong>Reporting Area:</strong> ${worstParam.ReportingArea || 'N/A'}, ${worstParam.StateCode || ''}</div>
                            <div style="color:#8b949e; margin-bottom:8px;"><strong>Observed:</strong> ${worstParam.DateObserved || ''} ${worstParam.HourObserved !== undefined ? worstParam.HourObserved + ':00' : ''} ${worstParam.LocalTimeZone || ''}</div>
                            <div style="color:#fff; background:#0d1117; padding:12px; border-radius:4px; border:1px solid #21262d; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; word-wrap:break-word;">${alertProfile.message}</div>`
                    };
                    html += `
                        <div style="border-left:4px solid ${alertProfile.color}; background:#211515; padding:8px; margin-bottom:10px; border-radius:2px; cursor:pointer;" onclick="openAQIDetails('health')">
                            <div style="color:${alertProfile.color}; font-weight:bold; font-size:0.75rem; text-transform:uppercase;">
                                <i class="fa-solid fa-triangle-exclamation"></i> ${alertProfile.label.toUpperCase()} - ${worstParam.ParameterName}
                            </div>
                            <div style="color:#c9d1d9; font-size:0.7rem; margin-top:4px;">${alertProfile.message}</div>
                        </div>`;
                }

                // Air Quality Action Day banner sourced from the AirNow forecast feed
                const actionDay = Array.isArray(forecastData) ? forecastData.find(f => f.ActionDay) : null;
                if (actionDay) {
                    const fullDiscussion = actionDay.Discussion || 'An Air Quality Action Day has been declared for this reporting area.';
                    const preview = fullDiscussion.length > 150 ? fullDiscussion.substring(0, 150) + '... (click to read full advisory)' : fullDiscussion;
                    globalAQIDetailsCache['actionday'] = {
                        title: `AIR QUALITY ACTION DAY - ${actionDay.ReportingArea || actionDay.StateCode || ''}`,
                        body: `<div style="color:#ffcc00; font-weight:bold; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:8px;">${actionDay.ParameterName || ''} Forecast for ${actionDay.DateForecast || ''}</div>
                            <div style="color:#8b949e; margin-bottom:8px;"><strong>Area:</strong> ${actionDay.ReportingArea || 'N/A'}, ${actionDay.StateCode || ''}</div>
                            <div style="color:#fff; background:#0d1117; padding:12px; border-radius:4px; border:1px solid #21262d; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; word-wrap:break-word;">${fullDiscussion}</div>`
                    };
                    html += `
                        <div style="border-left:4px solid #ffcc00; background:#2d2416; padding:8px; margin-bottom:10px; border-radius:2px; cursor:pointer;" onclick="openAQIDetails('actionday')">
                            <div style="color:#ffcc00; font-weight:bold; font-size:0.75rem; text-transform:uppercase;">
                                <i class="fa-solid fa-bell"></i> AIR QUALITY ACTION DAY
                            </div>
                            <div style="color:#c9d1d9; font-size:0.7rem; margin-top:4px;">${preview}</div>
                        </div>`;
                }

                // Reporting station metadata
                const meta = data[0];
                if (meta) {
                    html += `<div style="font-size:0.65rem; color:#8b949e; margin-bottom:8px;">
                        <i class="fa-solid fa-location-dot"></i> ${meta.ReportingArea || 'N/A'}, ${meta.StateCode || ''} &nbsp;|&nbsp; ${meta.DateObserved || ''} ${meta.HourObserved !== undefined ? meta.HourObserved + ':00' : ''} ${meta.LocalTimeZone || ''}
                    </div>`;
                }

                // Current pollutant readings grid (now includes AirNow category number alongside label, click to expand)
                html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">`;
                data.forEach((p, idx) => {
                    const catNum = p.Category && p.Category.Number ? p.Category.Number : null;
                    const profile = getAQIColorSpecs(p.AQI, catNum);
                    const cacheKey = `param-${idx}`;
                    globalAQIDetailsCache[cacheKey] = {
                        title: `${p.ParameterName} - ${profile.label.toUpperCase()}`,
                        body: `<div style="color:${profile.color}; font-weight:bold; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:8px;">${p.ParameterName} &mdash; AQI ${p.AQI}${catNum ? ' (Category ' + catNum + ')' : ''}</div>
                            <div style="color:#8b949e; margin-bottom:8px;"><strong>Reporting Area:</strong> ${p.ReportingArea || 'N/A'}, ${p.StateCode || ''}</div>
                            <div style="color:#8b949e; margin-bottom:8px;"><strong>Observed:</strong> ${p.DateObserved || ''} ${p.HourObserved !== undefined ? p.HourObserved + ':00' : ''} ${p.LocalTimeZone || ''}</div>
                            <div style="color:#8b949e; margin-bottom:8px;"><strong>Coordinates:</strong> ${p.Latitude !== undefined ? p.Latitude : 'N/A'}, ${p.Longitude !== undefined ? p.Longitude : 'N/A'}</div>
                            <div style="color:#fff; background:#0d1117; padding:12px; border-radius:4px; border:1px solid #21262d; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; word-wrap:break-word;">${profile.message}</div>`
                    };
                    html += `
                        <div style="background: #0d1117; border: 1px solid #21262d; border-radius: 3px; padding:6px; text-align:center; cursor:pointer;" onclick="openAQIDetails('${cacheKey}')">
                            <div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px; text-transform:uppercase; letter-spacing:0.5px;">${p.ParameterName}</div>
                            <div style="font-size:1.6rem; color:${profile.color}; font-weight:bold;">${p.AQI}</div>
                            <div style="font-size:0.6rem; color:${profile.color}; font-weight:bold; margin-top:2px;">${profile.label}${catNum ? ' (Cat ' + catNum + ')' : ''}</div>
                        </div>`;
                });
                html += `</div>`;

                // AirNow multi-day forecast strip (click any day/pollutant to expand)
                if (Array.isArray(forecastData) && forecastData.length > 0) {
                    html += `<div style="margin-top:10px; padding-top:8px; border-top:1px dashed #30363d;">
                        <div style="font-size:0.7rem; color:#8b949e; font-weight:bold; margin-bottom:6px; text-transform:uppercase;">
                            <i class="fa-solid fa-calendar-days"></i> AirNow Forecast
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap:6px;">`;
                    forecastData.forEach((f, fidx) => {
                        if (!f.ParameterName) return;
                        const fCatNum = f.Category && f.Category.Number ? f.Category.Number : null;
                        const fProfile = getAQIColorSpecs(f.AQI, fCatNum);
                        const fCacheKey = `forecast-${fidx}`;
                        globalAQIDetailsCache[fCacheKey] = {
                            title: `${f.ParameterName} FORECAST - ${f.DateForecast || ''}`,
                            body: `<div style="color:${fProfile.color}; font-weight:bold; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:8px;">${f.ParameterName} &mdash; Forecast AQI ${f.AQI !== -1 ? f.AQI : 'N/A'}${fCatNum ? ' (Category ' + fCatNum + ')' : ''}</div>
                                <div style="color:#8b949e; margin-bottom:8px;"><strong>Forecast Date:</strong> ${f.DateForecast || 'N/A'}</div>
                                <div style="color:#8b949e; margin-bottom:8px;"><strong>Reporting Area:</strong> ${f.ReportingArea || 'N/A'}, ${f.StateCode || ''}</div>
                                <div style="color:#8b949e; margin-bottom:8px;"><strong>Action Day:</strong> ${f.ActionDay ? 'YES' : 'No'}</div>
                                <div style="color:#fff; background:#0d1117; padding:12px; border-radius:4px; border:1px solid #21262d; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; word-wrap:break-word;">${f.Discussion ? f.Discussion : fProfile.message}</div>`
                        };
                        html += `
                            <div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:5px; text-align:center; cursor:pointer;" title="${f.DateForecast || ''}" onclick="openAQIDetails('${fCacheKey}')">
                                <div style="font-size:0.55rem; color:#8b949e; font-weight:bold;">${f.DateForecast ? f.DateForecast.substring(5) : ''}</div>
                                <div style="font-size:0.6rem; color:#8b949e; font-weight:bold;">${f.ParameterName}</div>
                                <div style="font-size:1.1rem; color:${fProfile.color}; font-weight:bold;">${f.AQI !== -1 ? f.AQI : '—'}</div>
                                <div style="font-size:0.55rem; color:${fProfile.color};">${fProfile.label}</div>
                            </div>`;
                    });
                    html += `</div></div>`;
                }
            }
            $('#aqi-container-target').html(html);
        })
        .catch(err => {
            console.error("AirNow loop crash:", err);
            $('#aqi-container-target').html(`<span style="color:#ff5555; font-size:0.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> FEED TIMEOUT</span>`);
        });
}

function openAQIDetails(key) {
    const detail = globalAQIDetailsCache[key];
    if (!detail) return;
    openFloatingModal(detail.title, detail.body);
}

function fetchNOAATides() {
    // NOTE: 8725899 (Nokomis/Venice Inlet) is a tide-PREDICTION-ONLY subordinate
    // station - it has no real-time water level or meteorological sensors, so
    // water_level/air_temperature requests against it always come back empty.
    // 8726384 (Port Manatee, FL) is the nearest active NOAA NWLON station with
    // live water level data and is used for the "observed" readings below.
    const station = '8726384';
    const timeZone = 'lst_ldt';
    const units = 'english';
    const format = 'json';
    const date = 'today';

    const baseUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${station}&time_zone=${timeZone}&units=${units}&format=${format}&date=${date}`;

    // Helper: fetch a product and resolve to null (instead of rejecting) on any
    // failure - either a network error, a non-OK response, or a NOAA "error"
    // payload (NOAA returns HTTP 200 with an {error:{...}} body for unsupported
    // products/stations rather than a proper HTTP error).
    function fetchProduct(url) {
        return fetch(url)
            .then(r => r.json())
            .then(json => (json && json.error) ? null : json)
            .catch(() => null);
    }

    Promise.all([
        fetchProduct(`${baseUrl}&product=water_level&datum=MLLW`),
        fetchProduct(`${baseUrl}&product=water_level&datum=NAVD`),
        fetchProduct(`${baseUrl}&product=predictions&datum=MLLW`),
        fetchProduct(`${baseUrl}&product=air_temperature`)
    ]).then(([wlMllw, wlNavd, predsMllw, airTemp]) => {

        const latestWlMllw = wlMllw && wlMllw.data && wlMllw.data.length ? wlMllw.data[wlMllw.data.length - 1] : null;
        const latestWlNavd = wlNavd && wlNavd.data && wlNavd.data.length ? wlNavd.data[wlNavd.data.length - 1] : null;
        const latestAirTemp = airTemp && airTemp.data && airTemp.data.length ? airTemp.data[airTemp.data.length - 1] : null;

        let gaugeHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;">`;
        gaugeHtml += latestWlMllw
            ? `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px;">MLLW</div><div style="font-size:1.4rem; color:#00ffcc; font-weight:bold;">${latestWlMllw.v}</div><div style="font-size:0.6rem; color:#8b949e;">ft</div></div>`
            : `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px;">MLLW</div><div style="font-size:0.9rem; color:#8b949e;">N/A</div></div>`;
        gaugeHtml += latestWlNavd
            ? `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px;">NAVD</div><div style="font-size:1.4rem; color:#00ffcc; font-weight:bold;">${latestWlNavd.v}</div><div style="font-size:0.6rem; color:#8b949e;">ft</div></div>`
            : `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px;">NAVD</div><div style="font-size:0.9rem; color:#8b949e;">N/A</div></div>`;
        gaugeHtml += latestAirTemp
            ? `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px;">AIR TEMP</div><div style="font-size:1.4rem; color:#00ffcc; font-weight:bold;">${latestAirTemp.v}</div><div style="font-size:0.6rem; color:#8b949e;">°F</div></div>`
            : `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.65rem; color:#8b949e; font-weight:bold; margin-bottom:3px;">AIR TEMP</div><div style="font-size:0.9rem; color:#8b949e;">N/A</div></div>`;
        gaugeHtml += `</div>`;

        if (!latestWlMllw && !latestWlNavd && !latestAirTemp) {
            gaugeHtml += `<div style="margin-top:6px;"><span style="color:#ff8800; font-size:0.7rem;"><i class="fa-solid fa-triangle-exclamation"></i> LIVE SENSOR DATA UNAVAILABLE - SHOWING PREDICTIONS ONLY</span></div>`;
        }

        $('#noaa-gauges').html(gaugeHtml);

        // Prefer timestamps from the observed feed; fall back to the
        // predictions feed so the chart still renders when live sensor data
        // is unavailable.
        const timeSource = (wlMllw && wlMllw.data && wlMllw.data.length) ? wlMllw.data
            : (predsMllw && predsMllw.predictions ? predsMllw.predictions : []);
        const labels = timeSource.map(d => {
            const timeParts = d.t.split(' ')[1].split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
        });
        const dataMllw = (wlMllw && wlMllw.data) ? wlMllw.data.map(d => parseFloat(d.v)) : [];
        const dataPreds = (predsMllw && predsMllw.predictions) ? predsMllw.predictions.map(d => parseFloat(d.v)) : [];

        const ctx = document.getElementById('noaaChart').getContext('2d');
        if(noaaChartInstance) noaaChartInstance.destroy();

        Chart.defaults.color = '#8b949e';
        Chart.defaults.font.family = "'Share Tech Mono', monospace";

        const datasets = [];
        if (dataMllw.length) {
            datasets.push({
                label: 'Observed (MLLW) ft',
                data: dataMllw,
                borderColor: '#00ffcc',
                backgroundColor: 'rgba(0, 255, 204, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.4
            });
        }
        if (dataPreds.length) {
            datasets.push({
                label: 'Predicted (MLLW) ft',
                data: dataMllw.length ? dataPreds.slice(0, labels.length) : dataPreds,
                borderColor: '#ff5555',
                borderDash: [4, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: !dataMllw.length,
                tension: 0.4
            });
        }

        noaaChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, usePointStyle: true } }
                },
                scales: {
                    x: { ticks: { maxTicksLimit: 6 }, grid: { color: '#21262d' } },
                    y: { grid: { color: '#21262d' } }
                }
            }
        });

    }).catch(err => {
        console.error("NOAA API Error:", err);
        $('#noaa-gauges').html('<span style="color:#ff5555; font-size:0.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> NOAA TIMEOUT</span>');
    });
}

function fetchMyakkaHydrology() {
    let html = '<h3 style="margin-top:0; margin-bottom:10px; color:#00ffcc; letter-spacing:1px; font-size:0.9rem;">HYDRO-CORRIDOR BASIN STREAMFLOW</h3>';
    myakkaGauges.forEach(g => {
        html += `
            <div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:8px; margin-bottom:8px;">
                <div style="font-weight:bold; color:#fff; font-size:0.85rem;">${g.name}</div>
                <div style="color:#00ffcc; margin:4px 0; font-size:0.75rem;"><i class="fa-solid fa-water"></i> USGS-${g.id}</div>
                <button class="gauge-btn" onclick="openHydrographModal('${g.id}', '${g.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-chart-line"></i> Waveform</button>
            </div>`;
    });
    $('#hydro-river-list').html(html);
}

function openHydrographModal(stationId, stationName) {
    const embedUrl = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${stationId}&open=plots&banner=false&pad=false`;
    const modalHTML = `
        <div style="height: 500px; width:100%;">
            <iframe src="${embedUrl}" style="width:100%; height:100%; background:#fff; border:none; border-radius:4px;"></iframe>
        </div>`;
    openFloatingModal(`USGS WAVE DATA MATRIX: ${stationName}`, modalHTML);
}

// --- Floating Control Modules ---
function openFloatingModal(title, textHTML) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = textHTML;
    document.getElementById('hubFloatingModal').style.display = 'flex';
}
function closeFloatingModal() { 
    document.getElementById('hubFloatingModal').style.display = 'none'; 
    document.getElementById('modalBody').innerHTML = ''; 
}

// Global Core Sync Timer
setInterval(() => {
    countdownVal--;
    if(countdownVal <= 0) {
        countdownVal = 120;
        fetchNWSForecast();
        fetchFloridaAlerts();
        fetchAirQualityData();
        fetchNOAATides();
        fetchMyakkaHydrology();
    }
    const targetTimer = document.getElementById('countdown');
    if(targetTimer) targetTimer.innerText = countdownVal;
}, 1000);

window.addEventListener('resize', () => { 
    layout.updateSize(); 
});
