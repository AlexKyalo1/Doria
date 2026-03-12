import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorMode } from "../utils/useColorMode";

const ACCOUNTS_API = "http://127.0.0.1:8000/api/accounts";
const SECURITY_API = "http://127.0.0.1:8000/api/security";
const INCIDENTS_API = "http://127.0.0.1:8000/api/incidents";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const DEFAULT_MAP_CENTER = [-1.286389, 36.817223];

const parseCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toRad = (value) => (value * Math.PI) / 180;

const haversineKm = (from, to) => {
  const R = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getFacilityTypeIcon = (type) => {
  const icons = {
    police_station: "🚓",
    police_post: "👮",
    dci: "🕵️",
    administration: "🏛️",
  };
  return icons[type] || "📍";
};

const getFacilityTypeColor = (type) => {
  const colors = {
    police_station: { primary: "#2563eb", secondary: "#1e40af", light: "#dbeafe" },
    police_post: { primary: "#059669", secondary: "#047857", light: "#d1fae5" },
    dci: { primary: "#f59e0b", secondary: "#d97706", light: "#fef3c7" },
    administration: { primary: "#8b5cf6", secondary: "#7c3aed", light: "#ede9fe" },
    default: { primary: "#0ea5e9", secondary: "#0284c7", light: "#e0f2fe" },
  };
  return colors[type] || colors.default;
};

// Custom control component
function CenterControl(div, onClick) {
  div.style.backgroundColor = 'white';
  div.style.borderRadius = '8px';
  div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  div.style.cursor = 'pointer';
  div.style.margin = '12px';
  div.style.padding = '8px 14px';
  div.style.fontSize = '14px';
  div.style.fontWeight = '500';
  div.style.color = '#1f2937';
  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.gap = '6px';
  div.style.transition = 'all 0.2s';
  div.innerHTML = '📍 <span>Reset Center</span>';
  
  div.addEventListener('click', onClick);
  div.addEventListener('mouseenter', () => {
    div.style.backgroundColor = '#f3f4f6';
    div.style.transform = 'scale(1.02)';
  });
  div.addEventListener('mouseleave', () => {
    div.style.backgroundColor = 'white';
    div.style.transform = 'scale(1)';
  });
}

const FacilitiesDistanceMap = ({
  ready,
  center,
  facilities,
  incidents,
  fromId,
  toId,
  onMarkerSelect,
  isDark,
  distanceKm,
  distanceFrom,
  distanceTo,
  facilityById,
}) => {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markerEntriesRef = useRef([]);
  const lineRef = useRef(null);
  const hoverInfoRef = useRef(null);
  const clickInfoRef = useRef(null);
  const distanceInfoRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const lastClickMarkerIdRef = useRef(null);

  const markerIcon = useCallback((facility) => {
    const facilityId = facility?.id;
    const isFrom = facilityId === fromId;
    const isTo = facilityId === toId;
    const typeKey = facility?.facility_type || "default";
    const colors = getFacilityTypeColor(typeKey);

    let scale = 12;
    let strokeWeight = 2;
    
    if (isFrom || isTo) {
      scale = 20;
      strokeWeight = 3;
    }

    const pulsingEffect = (isFrom || isTo) ? 
      '<circle cx="12" cy="12" r="16" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3">' +
      '<animate attributeName="r" values="16;20;16" dur="1.5s" repeatCount="indefinite" />' +
      '<animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" />' +
      '</circle>' : '';

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        ${pulsingEffect}
        <g filter="url(#shadow)">
          <circle cx="24" cy="24" r="${scale}" fill="${colors.primary}" 
            stroke="${isFrom ? '#2563eb' : isTo ? '#7c3aed' : colors.secondary}" 
            stroke-width="${strokeWeight}" />
          <text x="24" y="24" text-anchor="middle" dy=".3em" fill="white" 
            font-size="${scale * 0.6}" font-weight="bold" font-family="Arial, sans-serif">
            ${getFacilityTypeIcon(facility.facility_type)}
          </text>
        </g>
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
      scaledSize: new window.google.maps.Size(48, 48),
      anchor: new window.google.maps.Point(24, 24),
    };
  }, [fromId, toId]);

  const incidentMarkerIcon = useCallback((incident) => {
    const severity = incident?.severity || 'medium';
    const colors = {
      high: '#dc2626',
      medium: '#f59e0b',
      low: '#10b981'
    };
    const color = colors[severity] || colors.medium;

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M20 2 L36 38 L20 30 L4 38 Z" fill="${color}" stroke="#991b1b" stroke-width="2"/>
          <circle cx="20" cy="22" r="2" fill="white">
            <animate attributeName="r" values="2;3;2" dur="1s" repeatCount="indefinite" />
          </circle>
          <text x="20" y="28" text-anchor="middle" fill="white" font-size="12" font-weight="bold">⚠️</text>
        </g>
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 30),
    };
  }, []);

  const showFacilityInfo = useCallback((facility, marker) => {
    if (!clickInfoRef.current) {
      clickInfoRef.current = new window.google.maps.InfoWindow({
        maxWidth: 240,
      });
    }
    
    const colors = getFacilityTypeColor(facility.facility_type);
    const typeLabel = facility.facility_type
      ? facility.facility_type.replace("_", " ").toUpperCase()
      : "";
    
    const details = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 4px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background: ${colors.primary}; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">
            ${getFacilityTypeIcon(facility.facility_type)}
          </div>
          <div>
            <div style="font-weight:700; color: #1f2937; font-size: 13px;">${escapeHtml(facility.name)}</div>
            <div style="font-size:11px; color: #6b7280;">${escapeHtml(typeLabel)}</div>
          </div>
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #4b5563;">
          ${escapeHtml(facility.county)} • ${escapeHtml(facility.sub_county || "-")}
        </div>
        <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${facility.active ? '#10b981' : '#ef4444'};"></span>
          <span style="font-size: 11px; font-weight: 600; color: #374151;">${facility.active ? 'ACTIVE' : 'INACTIVE'}</span>
        </div>
      </div>
    `;    
    clickInfoRef.current.setContent(details);
    clickInfoRef.current.open({ map: mapRef.current, anchor: marker });
  }, []);

  const showDistanceFeedback = useCallback((marker) => {
    const feedbackWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 4px 8px; background: #10b981; color: white; border-radius: 4px; font-size: 12px;">
          📍 Selected for distance
        </div>
      `,
      pixelOffset: new window.google.maps.Size(0, -30)
    });
    feedbackWindow.open({ map: mapRef.current, anchor: marker });
    setTimeout(() => feedbackWindow.close(), 1000);
  }, []);

  useEffect(() => {
    if (!ready || !window.google?.maps || !hostRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(hostRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom: 7,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_RIGHT,
        },
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: isDark ? [
          { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
        ] : null,
      });

      const centerControlDiv = document.createElement('div');
      const centerControl = new CenterControl(centerControlDiv, () => {
        mapRef.current.setCenter({ lat: center[0], lng: center[1] });
        mapRef.current.setZoom(7);
      });
      mapRef.current.controls[window.google.maps.ControlPosition.TOP_LEFT].push(centerControlDiv);
    }

    mapRef.current.setCenter({ lat: center[0], lng: center[1] });
  }, [ready, center, isDark]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    markerEntriesRef.current.forEach((entry) => entry.marker.setMap(null));
    const entries = [];

    facilities.forEach((facility) => {
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: facility.lat, lng: facility.lng },
        title: facility.name,
        icon: markerIcon(facility),
        animation: window.google.maps.Animation.DROP,
        optimized: false,
      });

      marker.addListener("mouseover", () => {
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 750);
        
        if (!hoverInfoRef.current) {
          hoverInfoRef.current = new window.google.maps.InfoWindow({
            maxWidth: 300,
          });
        }
        
        const colors = getFacilityTypeColor(facility.facility_type);
        const brief = `
          <div style="padding: 8px 12px; background: ${colors.light}; border-radius: 8px; border-left: 4px solid ${colors.primary};">
            <div style="font-weight:600; font-size: 14px; color: #1f2937;">${escapeHtml(facility.name)}</div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">
              ${escapeHtml(facility.facility_type?.replace('_', ' ').toUpperCase() || 'FACILITY')}
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 6px; border-top: 1px solid #e5e7eb; padding-top: 4px;">
              🔍 Single-click: Select for distance | 👆 Double-click: Show details
            </div>
          </div>
        `;
        hoverInfoRef.current.setContent(brief);
        hoverInfoRef.current.open({ map: mapRef.current, anchor: marker });
      });

      marker.addListener("mouseout", () => {
        if (hoverInfoRef.current) {
          hoverInfoRef.current.close();
        }
      });

      marker.addListener("click", () => {
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTimeRef.current;
        const isDoubleClick = timeSinceLastClick < 300 && lastClickMarkerIdRef.current === facility.id;

        lastClickTimeRef.current = now;
        lastClickMarkerIdRef.current = facility.id;

        if (isDoubleClick) {
          // Double-click: show compact info window
          showFacilityInfo(facility, marker);
          lastClickTimeRef.current = 0;
          lastClickMarkerIdRef.current = null;
        } else {
          // Single click: select for distance calculation (no info window)
          onMarkerSelect(facility);

          if (clickInfoRef.current) {
            clickInfoRef.current.close();
          }
          if (hoverInfoRef.current) {
            hoverInfoRef.current.close();
          }

          showDistanceFeedback(marker);
        }
      });

      entries.push({
        id: `facility-${facility.id}`,
        kind: "facility",
        facilityId: facility.id,
        facilityType: facility.facility_type,
        marker,
      });
    });

    incidents.forEach((incident) => {
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: incident.lat, lng: incident.lng },
        title: incident.incident_type || "Incident",
        icon: incidentMarkerIcon(incident),
        animation: window.google.maps.Animation.DROP,
      });

      marker.addListener("mouseover", () => {
        if (!hoverInfoRef.current) {
          hoverInfoRef.current = new window.google.maps.InfoWindow();
        }
        const brief = `
          <div style="padding: 8px 12px; background: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626;">
            <div style="font-weight:600; font-size: 14px;">⚠️ ${escapeHtml(incident.incident_type || "Unknown")}</div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">
              Severity: ${incident.severity || 'medium'}
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">
              🔍 Click for details
            </div>
          </div>
        `;
        hoverInfoRef.current.setContent(brief);
        hoverInfoRef.current.open({ map: mapRef.current, anchor: marker });
      });

      marker.addListener("mouseout", () => {
        if (hoverInfoRef.current) {
          hoverInfoRef.current.close();
        }
      });

      marker.addListener("click", () => {
        if (!clickInfoRef.current) {
          clickInfoRef.current = new window.google.maps.InfoWindow({
            maxWidth: 350,
          });
        }
        
        const facilityIdValue = incident.facility_id ?? incident.facility;
        const facilityFromMap = facilityById && facilityIdValue != null
          ? facilityById.get(String(facilityIdValue))
          : null;
        const facilityName =
          incident.facility_name ||
          (typeof incident.facility === "string" ? incident.facility : null) ||
          facilityFromMap?.name ||
          null;
        const severity = incident.severity || 'medium';
        const severityColors = {
          high: '#dc2626',
          medium: '#f59e0b',
          low: '#10b981'
        };
        
        const details = `
          <div style="font-family: system-ui, -apple-system, sans-serif;">
            <div style="margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">⚠️</span>
                <div>
                  <div style="font-weight:700; color: #1f2937; font-size: 16px;">${escapeHtml(incident.incident_type || "Unknown")}</div>
                  <div style="font-size:12px; color: #6b7280;">OB: ${escapeHtml(incident.ob_number || "-")}</div>
                  ${facilityName ? `<div style="font-size:12px; color: #6b7280; margin-top: 2px;">Facility: ${escapeHtml(facilityName)}</div>` : ""}
                </div>
              </div>
            </div>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
              <div style="margin-bottom: 12px;">
                <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Description</div>
                <div style="font-size: 13px; background: #f9fafb; padding: 8px; border-radius: 6px;">
                  ${escapeHtml(incident.description || "No description")}
                </div>
              </div>
              ${(incident.follow_up_note || incident.follow_up_status) ? `
                <div style="margin-bottom: 12px;">
                  <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Follow-up</div>
                  <div style="font-size: 13px; background: #f0f9ff; padding: 8px; border-radius: 6px;">
                    <div><strong>Status:</strong> ${escapeHtml(incident.follow_up_status || "open")}</div>
                    ${incident.follow_up_note ? `<div style="margin-top: 4px;">${escapeHtml(incident.follow_up_note)}</div>` : ""}
                    ${(incident.follow_up_by_name || incident.follow_up_at) ? `<div style="margin-top: 6px; font-size: 11px; color: #6b7280;">
                      ${incident.follow_up_by_name ? `By ${escapeHtml(incident.follow_up_by_name)}` : ""}
                      ${incident.follow_up_at ? ` • ${escapeHtml(new Date(incident.follow_up_at).toLocaleString())}` : ""}
                    </div>` : ""}
                  </div>
                </div>
              ` : ""}
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                  <div style="font-size: 11px; color: #6b7280;">Occurred</div>
                  <div style="font-size: 13px; font-weight: 500;">${escapeHtml(new Date(incident.occurred_at).toLocaleString() || "-")}</div>
                </div>
                <div>
                  <span style="background: ${severityColors[severity]}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;">
                    ${severity.toUpperCase()}
                  </span>
                </div>
              </div>
              ${incident.location ? `
                <div style="margin-top: 8px;">
                  <div style="font-size: 11px; color: #6b7280;">Location</div>
                  <div style="font-size: 13px;">${escapeHtml(incident.location)}</div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
        
        clickInfoRef.current.setContent(details);
        clickInfoRef.current.open({ map: mapRef.current, anchor: marker });
      });

      entries.push({ 
        id: `incident-${incident.id || incident.occurred_at}`, 
        kind: "incident", 
        marker,
        incident 
      });
    });

    markerEntriesRef.current = entries;
  }, [facilities, incidents, onMarkerSelect, markerIcon, incidentMarkerIcon, showFacilityInfo, showDistanceFeedback, facilityById]);

  useEffect(() => {
    if (!window.google?.maps) return;

    markerEntriesRef.current.forEach((entry) => {
      if (entry.kind !== "facility") return;
      const facility = {
        id: entry.facilityId,
        facility_type: entry.facilityType,
      };
      entry.marker.setIcon(markerIcon(facility));
    });
  }, [fromId, toId, markerIcon]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const mapPoints = [...facilities, ...incidents];
    if (mapPoints.length === 0) return;

    if (mapPoints.length === 1) {
      mapRef.current.setCenter({ lat: mapPoints[0].lat, lng: mapPoints[0].lng });
      mapRef.current.setZoom(11);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    mapPoints.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
    mapRef.current.fitBounds(bounds, 40);
  }, [facilities, incidents]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (lineRef.current) {
      lineRef.current.setMap(null);
      lineRef.current = null;
    }

    const fromFacility = facilities.find((item) => item.id === fromId);
    const toFacility = facilities.find((item) => item.id === toId);
    if (!fromFacility || !toFacility) return;

    const lineSymbol = {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 4,
      strokeColor: "#ef4444",
    };

    lineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path: [
        { lat: fromFacility.lat, lng: fromFacility.lng },
        { lat: toFacility.lat, lng: toFacility.lng },
      ],
      strokeColor: "#ef4444",
      strokeOpacity: 0.95,
      strokeWeight: 4,
      icons: [{
        icon: lineSymbol,
        offset: '50%',
      }],
    });
  }, [facilities, fromId, toId]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    if (!distanceKm || !distanceFrom || !distanceTo) {
      if (distanceInfoRef.current) distanceInfoRef.current.close();
      return;
    }

    if (!distanceInfoRef.current) {
      distanceInfoRef.current = new window.google.maps.InfoWindow({
        pixelOffset: new window.google.maps.Size(0, -20),
      });
    }

    const midpoint = {
      lat: (distanceFrom.lat + distanceTo.lat) / 2,
      lng: (distanceFrom.lng + distanceTo.lng) / 2,
    };
    const formatted = typeof distanceKm === "number" ? distanceKm.toFixed(2) : distanceKm;
    distanceInfoRef.current.setPosition(midpoint);
    distanceInfoRef.current.setContent(
      `<div style="background: white; padding: 8px 16px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-weight:700; border: 2px solid #ef4444;">
        📏 Distance: ${escapeHtml(formatted)} km
      </div>`
    );
    distanceInfoRef.current.open({ map: mapRef.current });
  }, [distanceKm, distanceFrom, distanceTo]);

  if (!ready) {
    return <div style={styles.mapFallback}>🗺️ Google map preview will appear once Maps loads.</div>;
  }

  return <div ref={hostRef} style={styles.map} />;
};

const FacilitiesMapPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme, isDark } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [distanceForm, setDistanceForm] = useState({ from_id: "", to_id: "" });
  const [distanceResult, setDistanceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [googleMapsReady, setGoogleMapsReady] = useState(false);


  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type: "", text: "" }), 3500);
  };

  const getErrorMessage = (data, fallback) => {
    if (!data) return fallback;
    if (typeof data.error === "string") return data.error;
    
    const firstKey = Object.keys(data)[0];
    if (!firstKey) return fallback;
    
    const firstValue = data[firstKey];
    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return `${firstKey}: ${firstValue[0]}`;
    }
    if (typeof firstValue === "string") {
      return `${firstKey}: ${firstValue}`;
    }
    return fallback;
  };

  const loadProfile = async () => {
    const res = await fetch(`${ACCOUNTS_API}/profile/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load profile"));
    }
    setProfile(data.user || null);
    return data.user || null;
  };

  const loadInstitutions = async (user) => {
    const scope = user?.is_staff ? "?scope=all" : "";
    const res = await fetch(`${ACCOUNTS_API}/institutions/${scope}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load institutions"));
    }
    const list = data.institutions || [];
    setInstitutions(list);
    if (list.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(String(list[0].id));
    }
  };

  const loadFacilities = async () => {
    const res = await fetch(`${SECURITY_API}/facilities/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load facilities"));
    }
    const list = Array.isArray(data) ? data.filter(Boolean) : 
                 Array.isArray(data.facilities) ? data.facilities.filter(Boolean) : [];
    setFacilities(list);
  };

  const loadIncidents = async () => {
    const res = await fetch(`${INCIDENTS_API}/map/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load incidents"));
    }
    const list = Array.isArray(data) ? data.filter(Boolean) : 
                 Array.isArray(data.incidents) ? data.incidents.filter(Boolean) : [];
    setIncidents(list);
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      showBanner("error", "Google Maps key missing. Set REACT_APP_GOOGLE_MAPS_API_KEY.");
      return;
    }

    if (window.google?.maps) {
      setGoogleMapsReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleMapsReady(true);
    script.onerror = () => showBanner("error", "Failed to load Google Maps script.");
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setLoading(true);
        const user = await loadProfile();
        await Promise.all([loadInstitutions(user), loadFacilities(), loadIncidents()]);
        showBanner("success", "Map loaded successfully.");
      } catch (error) {
        showBanner("error", error.message || "Failed to load map");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const filteredFacilities = useMemo(() => {
    const list = facilities.filter(Boolean);
    if (!selectedInstitutionId) return list;
    return list.filter((facility) => 
      facility.institution_id == null || String(facility.institution_id) === String(selectedInstitutionId)
    );
  }, [facilities, selectedInstitutionId]);

  const mappableFacilities = useMemo(
    () =>
      filteredFacilities
        .map((facility) => {
          const lat = parseCoord(facility.latitude);
          const lng = parseCoord(facility.longitude);
          if (lat === null || lng === null) return null;
          return { ...facility, lat, lng };
        })
        .filter(Boolean),
    [filteredFacilities]
  );

  const filteredIncidents = useMemo(() => {
    const list = incidents.filter(Boolean);
    if (!selectedInstitutionId) return list;
    return list.filter(
      (incident) => incident.institution_id == null || String(incident.institution_id) === String(selectedInstitutionId)
    );
  }, [incidents, selectedInstitutionId]);

  const mappableIncidents = useMemo(
    () =>
      filteredIncidents
        .map((incident) => {
          const lat = parseCoord(incident.latitude);
          const lng = parseCoord(incident.longitude);
          if (lat === null || lng === null) return null;
          return { ...incident, lat, lng };
        })
        .filter(Boolean),
    [filteredIncidents]
  );

  const facilityById = useMemo(() => {
    const map = new Map();
    mappableFacilities.forEach((facility) => {
      map.set(String(facility.id), facility);
    });
    return map;
  }, [mappableFacilities]);

  const fromFacility = useMemo(
    () => facilityById.get(String(distanceForm.from_id || "")) || null,
    [facilityById, distanceForm.from_id]
  );

  const toFacility = useMemo(
    () => facilityById.get(String(distanceForm.to_id || "")) || null,
    [facilityById, distanceForm.to_id]
  );

  useEffect(() => {
    if (!fromFacility || !toFacility) {
      setDistanceResult(null);
      return;
    }
    const distanceKm = haversineKm(fromFacility, toFacility);
    setDistanceResult({ distance_km: distanceKm, from: fromFacility, to: toFacility });
  }, [fromFacility, toFacility]);

  const mapCenter = useMemo(() => {
    if (mappableFacilities.length === 0) return DEFAULT_MAP_CENTER;
    
    const totals = mappableFacilities.reduce(
      (acc, item) => ({ lat: acc.lat + item.lat, lng: acc.lng + item.lng }),
      { lat: 0, lng: 0 }
    );
    return [totals.lat / mappableFacilities.length, totals.lng / mappableFacilities.length];
  }, [mappableFacilities]);

  const handleMarkerSelect = (facility) => {
    setDistanceResult(null);
    setDistanceForm((prev) => {
      if (!prev.from_id || (prev.from_id && prev.to_id)) {
        return { from_id: facility.id, to_id: "" };
      }
      if (prev.from_id === facility.id) {
        return { from_id: facility.id, to_id: "" };
      }
      return { from_id: prev.from_id, to_id: facility.id };
    });
  };

  const calculateDistance = async (event) => {
    event.preventDefault();

    if (!distanceForm.from_id || !distanceForm.to_id) {
      showBanner("error", "Select both facilities first.");
      return;
    }

    if (distanceForm.from_id === distanceForm.to_id) {
      showBanner("error", "Select two different facilities.");
      return;
    }

    try {
      const params = new URLSearchParams(distanceForm).toString();
      const res = await fetch(`${SECURITY_API}/facilities/distance/?${params}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to calculate distance"));
      }

      setDistanceResult(data);
      showBanner("success", `Distance computed: ${data.distance_km} km`);
    } catch (error) {
      showBanner("error", error.message || "Failed to calculate distance");
    }
  };

  const bannerStyle = {
    ...styles.banner,
    ...(banner.type === "success" ? styles.bannerSuccess : {}),
    ...(banner.type === "error" ? styles.bannerError : {}),
    animation: "slideDown 0.3s ease-out",
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <style>
        {`
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <div style={styles.header}>
        <div style={styles.titleSection}>
          <h1 style={{ ...styles.title, color: theme.text }}>🗺️ Facility Distance Map</h1>
          {profile && (
            <div style={styles.modeBadge}>
              {profile.is_staff ? "👑 Admin View" : "👤 User View"}
            </div>
          )}
        </div>

        <div style={styles.headerControls}>
          <select
            style={styles.filterSelect}
            value={selectedInstitutionId}
            onChange={(event) => {
              setSelectedInstitutionId(event.target.value);
              setDistanceResult(null);
              setDistanceForm({ from_id: "", to_id: "" });
            }}
          >
            <option value="">🏛️ All Institutions</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={String(institution.id)}>
                {institution.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.instructionsBanner}>
        <div style={styles.instructionItem}>
          <span style={styles.instructionIcon}>🔍</span>
          <span><strong>Single-click:</strong> Select facility for distance</span>
        </div>
        <div style={styles.instructionItem}>
          <span style={styles.instructionIcon}>👆👆</span>
          <span><strong>Double-click:</strong> Show detailed info (always)</span>
        </div>
        <div style={styles.instructionDivider}>|</div>
        <div style={styles.instructionItem}>
          <span style={styles.instructionIcon}>📌</span>
          <span>From: {fromFacility?.name || 'Not selected'}</span>
        </div>
        <div style={styles.instructionItem}>
          <span style={styles.instructionIcon}>📍</span>
          <span>To: {toFacility?.name || 'Not selected'}</span>
        </div>
      </div>

      {banner.text && <div style={bannerStyle}>{banner.text}</div>}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{mappableFacilities.length}</div>
          <div style={styles.statLabel}>🏢 Facilities on Map</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{mappableIncidents.length}</div>
          <div style={styles.statLabel}>⚠️ Incidents on Map</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{filteredFacilities.length - mappableFacilities.length}</div>
          <div style={styles.statLabel}>❌ Missing Coordinates</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{filteredFacilities.filter((f) => f.active).length}</div>
          <div style={styles.statLabel}>✅ Active Facilities</div>
        </div>
      </div>

      <section
        style={{
          ...styles.mapContainer,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          borderColor: theme.cardBorder,
          boxShadow: isDark
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            : "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
        }}
      >
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingSpinner}></div>
            <p>Loading map data...</p>
          </div>
        )}

        <FacilitiesDistanceMap
          ready={googleMapsReady}
          center={mapCenter}
          facilities={mappableFacilities}
          incidents={mappableIncidents}
          fromId={distanceForm.from_id}
          toId={distanceForm.to_id}
          onMarkerSelect={handleMarkerSelect}
          isDark={isDark}
          distanceKm={distanceResult?.distance_km}
          distanceFrom={fromFacility}
          distanceTo={toFacility}
          facilityById={facilityById}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>📏 Distance Calculator</h2>
          <div style={styles.cardBadge}>Click markers to select</div>
        </div>
        <p style={styles.hint}>Click two markers in sequence (first for From, second for To), or use dropdowns below.</p>
        <form onSubmit={calculateDistance} style={styles.formGrid}>
          <div>
            <label style={styles.label}>
              <span style={styles.labelIcon}>📌</span> From
            </label>
            <select
              style={styles.input}
              value={distanceForm.from_id}
              onChange={(event) => setDistanceForm((prev) => ({ ...prev, from_id: event.target.value }))}
              required
            >
              <option value="">Select facility</option>
              {mappableFacilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>
              <span style={styles.labelIcon}>📍</span> To
            </label>
            <select
              style={styles.input}
              value={distanceForm.to_id}
              onChange={(event) => setDistanceForm((prev) => ({ ...prev, to_id: event.target.value }))}
              required
            >
              <option value="">Select facility</option>
              {mappableFacilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" style={styles.primaryButton}>
            Calculate Distance
          </button>
        </form>

        {distanceResult && (
          <div style={styles.resultBox}>
            <div style={styles.resultIcon}>📏</div>
            <div style={styles.resultContent}>
              <div style={styles.resultDistance}>
                <strong>{typeof distanceResult.distance_km === "number" ? distanceResult.distance_km.toFixed(2) : distanceResult.distance_km} km</strong>
              </div>
              <div style={styles.resultPath}>
                {distanceResult.from.name} → {distanceResult.to.name}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    padding: "24px",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  titleSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  title: {
    margin: "0",
    fontSize: "32px",
    fontWeight: "700",
    letterSpacing: "-0.5px",
  },
  modeBadge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    color: "#3b82f6",
    border: "1px solid rgba(59, 130, 246, 0.2)",
  },
  headerControls: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  instructionsBanner: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 16px",
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  instructionItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#334155",
  },
  instructionIcon: {
    fontSize: "16px",
  },
  instructionDivider: {
    color: "#cbd5e1",
    fontSize: "16px",
  },
  filterSelect: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    fontSize: "14px",
    fontWeight: "500",
    backgroundColor: "white",
    cursor: "pointer",
    minWidth: "240px",
    outline: "none",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "16px",
    marginBottom: "8px",
  },
  statCard: {
    padding: "20px",
    borderRadius: "16px",
    backgroundColor: "white",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -2px rgba(0,0,0,0.05)",
    transition: "transform 0.2s, boxShadow 0.2s",
    cursor: "pointer",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "4px",
  },
  statLabel: {
    fontSize: "13px",
    color: "#64748b",
    fontWeight: "500",
  },
  banner: {
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "8px",
  },
  bannerSuccess: {
    backgroundColor: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
  },
  bannerError: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
  mapContainer: {
    position: "relative",
    borderRadius: "24px",
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    height: "600px",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapFallback: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    fontSize: "14px",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e2e8f0",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "12px",
  },
  card: {
    border: "1px solid #dbeafe",
    borderRadius: "14px",
    padding: "20px",
    backgroundColor: "#ffffff",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  cardTitle: {
    margin: "0",
    fontSize: "18px",
    color: "#0f5132",
  },
  cardBadge: {
    padding: "4px 10px",
    backgroundColor: "#f1f5f9",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "500",
    color: "#475569",
  },
  hint: {
    margin: "0 0 16px",
    fontSize: "13px",
    color: "#64748b",
  },
  formGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "end",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#334155",
    marginBottom: "4px",
  },
  labelIcon: {
    fontSize: "14px",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "11px 14px",
    background: "linear-gradient(120deg, #166534 0%, #15803d 100%)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    height: "42px",
    transition: "transform 0.2s, boxShadow 0.2s",
  },
  resultBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "12px",
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#14532d",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  resultIcon: {
    fontSize: "24px",
  },
  resultContent: {
    flex: 1,
  },
  resultDistance: {
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "4px",
  },
  resultPath: {
    fontSize: "13px",
    opacity: 0.8,
  },

};

export default FacilitiesMapPage;