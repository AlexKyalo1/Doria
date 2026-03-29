import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import {
  ACCOUNTS_API_BASE as ACCOUNTS_API,
  INCIDENTS_API_BASE as INCIDENTS_API,
  SECURITY_API_BASE as SECURITY_API,
} from "../utils/apiBase";
import { useColorMode } from "../utils/useColorMode";
import { getFrontendSettings } from "../utils/frontendSettings";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

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

const parseCoord = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const SOCIAL_SOURCES = ["X", "Facebook", "Telegram", "Citizen report", "Community radio"];
const MANUAL_INTEL_TAG = "[VIP MANUAL]";

const timeAgo = (isoString) => {
  if (!isoString) return "just now";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return "just now";
  const diffMinutes = Math.max(0, Math.round((now - then) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const buildSocialSignals = ({ incidents, liveIntelArticles }) => {
  const parseManualMeta = (description) => {
    const text = String(description || "");
    const sourceMatch = text.match(/\[source:([^\]]+)\]/i);
    const urgencyMatch = text.match(/\[urgency:([^\]]+)\]/i);
    return {
      source: sourceMatch?.[1]?.trim() || "",
      urgency: urgencyMatch?.[1]?.trim() || "",
      isManual: text.includes(MANUAL_INTEL_TAG),
      cleanText: text
        .replace(MANUAL_INTEL_TAG, "")
        .replace(/\[source:[^\]]+\]/gi, "")
        .replace(/\[urgency:[^\]]+\]/gi, "")
        .trim(),
    };
  };

  const candidates = (incidents || [])
    .sort((a, b) => new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime())
    .slice(0, 14);

  const storySignals = (liveIntelArticles || [])
    .slice(0, 10)
    .map((article, index) => ({
      id: `story-${index}-${article.link || article.title || "item"}`,
      source: article.source || "News",
      headline: article.title || "Security story",
      detail: article.matching_signal || "Recent external security report",
      urgency: "high",
      seen_at: article.published_at || "",
      reference: "Story",
      link: article.link || "",
      isStory: true,
      isManual: false,
    }));

  const incidentSignals = candidates.map((incident, index) => {
    const manualMeta = parseManualMeta(incident.description);
    return {
      id: `${incident.id}-${index}`,
      source: manualMeta.source || SOCIAL_SOURCES[index % SOCIAL_SOURCES.length],
      headline: `${String(incident.incident_type || "incident").replaceAll("_", " ")} chatter near ${incident.facility_name || "monitored zone"}`,
      detail: `${manualMeta.cleanText || "Local observers flagged unusual activity."}`.slice(0, 160),
      urgency:
        manualMeta.urgency ||
        (incident.follow_up_status === "resolved" ? "low" : incident.follow_up_status === "in_progress" ? "medium" : "high"),
      seen_at: incident.occurred_at || "",
      reference: incident.ob_number || "Unreferenced",
      isManual: manualMeta.isManual,
      link: "",
      isStory: false,
    };
  });

  return [...storySignals, ...incidentSignals].slice(0, 16);
};

const AreaMap = ({
  ready,
  center,
  radiusKm,
  facilities,
  incidents,
  onAreaChange,
  facilityIcons,
  incidentIcons,
}) => {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!ready || !window.google?.maps || !hostRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(hostRef.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      circleRef.current = new window.google.maps.Circle({
        map: mapRef.current,
        center,
        radius: radiusKm * 1000,
        draggable: true,
        editable: true,
        strokeColor: "#0f766e",
        strokeOpacity: 0.95,
        strokeWeight: 2,
        fillColor: "#14b8a6",
        fillOpacity: 0.14,
      });

      const syncFromCircle = () => {
        if (syncingRef.current || !circleRef.current) {
          return;
        }
        const nextCenter = circleRef.current.getCenter();
        if (!nextCenter) {
          return;
        }
        onAreaChange({
          center: { lat: nextCenter.lat(), lng: nextCenter.lng() },
          radiusKm: Number((circleRef.current.getRadius() / 1000).toFixed(2)),
        });
      };

      circleRef.current.addListener("center_changed", syncFromCircle);
      circleRef.current.addListener("radius_changed", syncFromCircle);
    }
  }, [center, onAreaChange, radiusKm, ready]);

  useEffect(() => {
    if (!mapRef.current || !circleRef.current) {
      return;
    }
    syncingRef.current = true;
    circleRef.current.setCenter(center);
    circleRef.current.setRadius(radiusKm * 1000);
    mapRef.current.panTo(center);
    window.setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, [center, radiusKm]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(center);

    facilities.forEach((facility) => {
      const position = { lat: facility.latitude, lng: facility.longitude };
      bounds.extend(position);
      const colors = getFacilityTypeColor(facility.facility_type);
      const facilityGlyph = facilityIcons?.[facility.facility_type] || "📍";
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${colors.secondary}" flood-opacity="0.35"/>
            </filter>
          </defs>
          <g filter="url(#shadow)">
            <text
              x="28"
              y="30"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size="30"
              font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif"
            >
              ${facilityGlyph}
            </text>
          </g>
        </svg>
      `;
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: facility.name,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
          scaledSize: new window.google.maps.Size(56, 56),
          anchor: new window.google.maps.Point(28, 28),
        },
      });
      marker.addListener("click", () => {
        if (!infoWindowRef.current) {
          infoWindowRef.current = new window.google.maps.InfoWindow();
        }
        infoWindowRef.current.setContent(
          `<div style="padding:8px 10px;min-width:180px">
            <div style="font-weight:700;color:#0f172a">${facility.name}</div>
            <div style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:${colors.secondary};background:${colors.light};margin-top:4px">
              ${String(facility.facility_type || "").replaceAll("_", " ").toUpperCase()}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">${facility.county || ""}${facility.sub_county ? `, ${facility.sub_county}` : ""}</div>
          </div>`
        );
        infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
      });
      markersRef.current.push(marker);
    });

    incidents.forEach((incident) => {
      const position = { lat: incident.latitude, lng: incident.longitude };
      bounds.extend(position);
      const severityColor =
        incident.follow_up_status === "resolved"
          ? "#10b981"
          : incident.follow_up_status === "in_progress"
            ? "#f59e0b"
            : "#dc2626";
      const incidentGlyph = incidentIcons?.[incident.incident_type] || "📍";
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${severityColor}" flood-opacity="0.45"/>
            </filter>
          </defs>
          <g filter="url(#shadow)">
            <text
              x="26"
              y="28"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size="32"
              font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif"
            >
              ${incidentGlyph}
            </text>
            <circle cx="26" cy="26" r="21" fill="none" stroke="${severityColor}" stroke-width="2.5" opacity="0.7" />
          </g>
        </svg>
      `;
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        title: incident.ob_number,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
          scaledSize: new window.google.maps.Size(52, 52),
          anchor: new window.google.maps.Point(26, 26),
        },
      });
      marker.addListener("click", () => {
        if (!infoWindowRef.current) {
          infoWindowRef.current = new window.google.maps.InfoWindow();
        }
        infoWindowRef.current.setContent(
          `<div style="padding:8px 10px;min-width:200px">
            <div style="font-weight:700;color:#0f172a">${incident.ob_number || "Incident"}</div>
            <div style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:${severityColor};background:#f8fafc;margin-top:4px">
              ${String(incident.incident_type || "incident").replaceAll("_", " ").toUpperCase()}
            </div>
            <div style="font-size:12px;color:#475569;margin-top:6px">${incident.facility_name || "No linked facility"}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px">${incident.follow_up_status || "open"}</div>
          </div>`
        );
        infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
      });
      markersRef.current.push(marker);
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 70);
    }
  }, [facilities, facilityIcons, incidentIcons, incidents]);

  if (!ready) {
    return <div style={styles.mapPlaceholder}>Google Maps will appear here once the script is ready.</div>;
  }

  return <div ref={hostRef} style={styles.mapCanvas} />;
};

const VipSurveillancePage = () => {
  const token = localStorage.getItem("access_token");
  const { theme } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(5);
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [areaTouched, setAreaTouched] = useState(false);
  const [frontendSettings, setFrontendSettings] = useState(getFrontendSettings());
  const [includeApiIntel, setIncludeApiIntel] = useState(true);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    headline: "",
    detail: "",
    source: "Field team",
    urgency: "medium",
  });

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const refreshIncidents = useCallback(async () => {
    const incidentsRes = await apiFetch(`${INCIDENTS_API}/`, { headers });
    const incidentsData = await incidentsRes.json();
    if (!incidentsRes.ok) {
      throw new Error(incidentsData?.error || "Failed to load incidents");
    }
    const incidentList = Array.isArray(incidentsData?.incidents)
      ? incidentsData.incidents
      : Array.isArray(incidentsData)
        ? incidentsData
        : [];
    setIncidents(incidentList);
    return incidentList;
  }, [headers]);

  const filteredFacilities = useMemo(() => {
    if (!selectedInstitutionId) {
      return facilities;
    }
    return facilities.filter((facility) => String(facility.institution_id || "") === String(selectedInstitutionId));
  }, [facilities, selectedInstitutionId]);

  const filteredIncidents = useMemo(() => {
    if (!selectedInstitutionId) {
      return incidents;
    }
    return incidents.filter((incident) => {
      const directId = incident.institution_hash || incident.institution_id || "";
      if (String(directId) === String(selectedInstitutionId)) {
        return true;
      }
      const facility = facilities.find((item) => String(item.id) === String(incident.facility_id || incident.facility));
      return facility ? String(facility.institution_id || "") === String(selectedInstitutionId) : false;
    });
  }, [facilities, incidents, selectedInstitutionId]);

  useEffect(() => {
    const onSettingsChange = () => setFrontendSettings(getFrontendSettings());
    window.addEventListener("frontend-settings-changed", onSettingsChange);
    return () => window.removeEventListener("frontend-settings-changed", onSettingsChange);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setMessage("");
      try {
        const [profileRes, institutionsRes, facilitiesRes] = await Promise.all([
          apiFetch(`${ACCOUNTS_API}/profile/`, { headers }),
          apiFetch(`${ACCOUNTS_API}/institutions/`, { headers }),
          apiFetch(`${SECURITY_API}/facilities/`, { headers }),
        ]);

        const [profileData, institutionsData, facilitiesData] = await Promise.all([
          profileRes.json(),
          institutionsRes.json(),
          facilitiesRes.json(),
        ]);

        if (!profileRes.ok) {
          throw new Error(profileData?.error || "Failed to load profile");
        }
        if (!institutionsRes.ok) {
          throw new Error(institutionsData?.error || "Failed to load institutions");
        }
        if (!facilitiesRes.ok) {
          throw new Error(facilitiesData?.error || "Failed to load facilities");
        }
        const institutionList = Array.isArray(institutionsData?.institutions) ? institutionsData.institutions : [];
        const facilityList = Array.isArray(facilitiesData?.facilities)
          ? facilitiesData.facilities
          : Array.isArray(facilitiesData)
            ? facilitiesData
            : [];
        const incidentList = await refreshIncidents();

        setProfile(profileData.user || null);
        setInstitutions(institutionList);
        setFacilities(facilityList);
        setIncidents(incidentList);
        setSelectedInstitutionId((current) => current || institutionList[0]?.id || "");
      } catch (error) {
        setMessage(error.message || "Failed to load area intelligence data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [headers, refreshIncidents, token]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMessage((current) => current || "Google Maps key missing. Set REACT_APP_GOOGLE_MAPS_API_KEY.");
      return;
    }

    if (window.google?.maps) {
      setGoogleMapsReady(true);
      return;
    }

    const existingScript = document.querySelector("script[data-google-maps='true']");
    if (existingScript) {
      const onLoad = () => setGoogleMapsReady(true);
      existingScript.addEventListener("load", onLoad);
      return () => existingScript.removeEventListener("load", onLoad);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = () => setGoogleMapsReady(true);
    script.onerror = () => setMessage("Failed to load Google Maps.");
    document.body.appendChild(script);
    return undefined;
  }, []);

  useEffect(() => {
    if (areaTouched) {
      return;
    }
    const firstFacility = filteredFacilities.find(
      (facility) => parseCoord(facility.latitude) !== null && parseCoord(facility.longitude) !== null
    );
    const firstIncident = filteredIncidents.find(
      (incident) => parseCoord(incident.latitude) !== null && parseCoord(incident.longitude) !== null
    );
    const lat = parseCoord(firstFacility?.latitude ?? firstIncident?.latitude);
    const lng = parseCoord(firstFacility?.longitude ?? firstIncident?.longitude);
    if (lat !== null && lng !== null) {
      setCenter({ lat, lng });
    }
  }, [areaTouched, filteredFacilities, filteredIncidents]);

  const mapFacilities = useMemo(
    () =>
      filteredFacilities
        .map((facility) => ({
          ...facility,
          latitude: parseCoord(facility.latitude),
          longitude: parseCoord(facility.longitude),
        }))
        .filter((facility) => facility.latitude !== null && facility.longitude !== null),
    [filteredFacilities]
  );

  const mapIncidents = useMemo(
    () =>
      filteredIncidents
        .map((incident) => ({
          ...incident,
          latitude: parseCoord(incident.latitude),
          longitude: parseCoord(incident.longitude),
        }))
        .filter((incident) => incident.latitude !== null && incident.longitude !== null),
    [filteredIncidents]
  );

  const runAnalysis = async () => {
    setAnalysisLoading(true);
    setMessage("");
    try {
      const res = await apiFetch(`${INCIDENTS_API}/area-analysis/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          institution_id: selectedInstitutionId || null,
          center_latitude: center.lat,
          center_longitude: center.lng,
          radius_km: radiusKm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to run area analysis");
      }
      setAnalysisResult(data);
    } catch (error) {
      setMessage(error.message || "Failed to run area analysis");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const submitManualIntel = async (event) => {
    event.preventDefault();
    const headline = manualForm.headline.trim();
    const detail = manualForm.detail.trim();
    if (!headline || !detail) {
      setMessage("Manual intel requires both headline and details.");
      return;
    }

    setSubmittingManual(true);
    setMessage("");
    try {
      const preferredFacility = mapFacilities[0];
      const obNumber = `VIP-${Date.now()}`;
      const payload = {
        incident_type: "other",
        ob_number: obNumber,
        description: `${MANUAL_INTEL_TAG} [source:${manualForm.source}] [urgency:${manualForm.urgency}] ${headline}. ${detail}`,
        latitude: center.lat,
        longitude: center.lng,
        occurred_at: new Date().toISOString(),
      };
      if (preferredFacility?.id) {
        payload.facility = preferredFacility.id;
      } else if (selectedInstitutionId) {
        payload.institution = selectedInstitutionId;
      }

      const createRes = await apiFetch(`${INCIDENTS_API}/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData?.error || "Failed to save manual intel");
      }

      await refreshIncidents();
      setManualForm((prev) => ({ ...prev, headline: "", detail: "" }));
      setMessage("Manual intelligence added successfully.");
    } catch (error) {
      setMessage(error.message || "Failed to save manual intel");
    } finally {
      setSubmittingManual(false);
    }
  };

  const stats = analysisResult?.counts || {
    facilities: mapFacilities.length,
    incidents: mapIncidents.length,
    open_incidents: mapIncidents.filter((incident) => incident.follow_up_status !== "resolved").length,
    active_facilities: mapFacilities.filter((facility) => facility.active).length,
  };

  const surveillanceIncidents = analysisResult?.incidents || mapIncidents;
  const liveIntelArticles = analysisResult?.live_intel?.articles || [];
  const socialSignals = useMemo(
    () => buildSocialSignals({ incidents: surveillanceIncidents, liveIntelArticles }),
    [liveIntelArticles, surveillanceIncidents]
  );

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <div style={styles.header}>
        <div>
          <h1 style={{ ...styles.title, color: theme.text }}>VIP Surveillance</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Run geofenced surveillance for VIP movement corridors and highlight all recent security risks in the selected ring.
          </p>
        </div>
        <button type="button" style={styles.primaryButton} onClick={runAnalysis} disabled={analysisLoading || loading}>
          {analysisLoading ? "Scanning..." : "Run VIP scan"}
        </button>
      </div>

      {message ? <div style={styles.banner}>{message}</div> : null}

      <section style={styles.controlCard}>
        <div style={styles.controlGrid}>
          <div>
            <label style={styles.label}>Institution scope</label>
            <select
              style={styles.input}
              value={selectedInstitutionId}
              onChange={(event) => {
                setSelectedInstitutionId(event.target.value);
                setAreaTouched(false);
                setAnalysisResult(null);
              }}
            >
              {profile?.is_staff ? <option value="">All visible institutions</option> : null}
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Radius (km)</label>
            <input
              style={styles.input}
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={radiusKm}
              onChange={(event) => {
                setRadiusKm(Number(event.target.value));
                setAreaTouched(true);
              }}
            />
            <div style={styles.sliderValue}>{radiusKm.toFixed(1)} km</div>
          </div>
          <div>
            <label style={styles.label}>Intel mode</label>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={includeApiIntel}
                onChange={(event) => setIncludeApiIntel(event.target.checked)}
              />
              Include API-backed intel as secondary feed
            </label>
          </div>
          <div style={styles.kpiStrip}>
            <div style={styles.kpiItem}><strong>{stats.facilities}</strong><span>Facilities</span></div>
            <div style={styles.kpiItem}><strong>{stats.incidents}</strong><span>Incidents</span></div>
            <div style={styles.kpiItem}><strong>{stats.open_incidents}</strong><span>Open</span></div>
            <div style={styles.kpiItem}><strong>{stats.active_facilities}</strong><span>Active sites</span></div>
          </div>
        </div>
      </section>

      <section style={styles.workspace}>
        <div style={styles.mapCard}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Live geofence map</h2>
              <p style={styles.hint}>Drag the ring or resize it directly on the map. Facilities are teal, incidents are red.</p>
            </div>
          </div>
          <div style={styles.mapWrap}>
            <AreaMap
              ready={googleMapsReady}
              center={center}
              radiusKm={radiusKm}
              facilities={mapFacilities}
              incidents={mapIncidents}
              facilityIcons={frontendSettings.facilityIcons}
              incidentIcons={frontendSettings.incidentIcons}
              onAreaChange={({ center: nextCenter, radiusKm: nextRadius }) => {
                setCenter(nextCenter);
                setRadiusKm(nextRadius);
                setAreaTouched(true);
              }}
            />
          </div>
          <div style={styles.mapLegendRow}>
            <div style={styles.legendPill}>
              <span style={{ ...styles.legendDot, backgroundColor: "#0f766e" }} />
              Facilities
            </div>
            <div style={styles.legendPill}>
              <span style={{ ...styles.legendDot, backgroundColor: "#dc2626" }} />
              Incidents
            </div>
            <div style={styles.legendNote}>Click a facility marker to see its name and location.</div>
          </div>
          <div style={styles.mapFacilityCard}>
            <div style={styles.analysisLabel}>Facilities on map</div>
            <div style={styles.mapFacilityList}>
              {(analysisResult?.facilities || mapFacilities).slice(0, 10).map((facility) => (
                <div key={facility.id} style={styles.mapFacilityChip}>
                  <strong>{facility.name}</strong>
                  <span>
                    {String(facility.facility_type || "").replaceAll("_", " ")}
                    {facility.distance_km ? ` · ${facility.distance_km} km` : ""}
                  </span>
                </div>
              ))}
              {(analysisResult?.facilities || mapFacilities).length === 0 ? (
                <p style={styles.muted}>No facilities are currently visible on the map.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div style={styles.sideStack}>
          <section style={styles.sideCard}>
            <h2 style={styles.cardTitle}>Add Manual Intelligence</h2>
            <form onSubmit={submitManualIntel} style={styles.manualForm}>
              <input
                style={styles.input}
                value={manualForm.headline}
                onChange={(event) => setManualForm((prev) => ({ ...prev, headline: event.target.value }))}
                placeholder="Short headline (what was observed?)"
              />
              <textarea
                style={styles.textarea}
                rows={3}
                value={manualForm.detail}
                onChange={(event) => setManualForm((prev) => ({ ...prev, detail: event.target.value }))}
                placeholder="Detailed note from intelligence member"
              />
              <div style={styles.manualRow}>
                <input
                  style={styles.input}
                  value={manualForm.source}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, source: event.target.value }))}
                  placeholder="Source (field team, liaison, etc)"
                />
                <select
                  style={styles.input}
                  value={manualForm.urgency}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, urgency: event.target.value }))}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <button type="submit" style={styles.primaryButton} disabled={submittingManual}>
                {submittingManual ? "Saving..." : "Add manual intel"}
              </button>
            </form>
          </section>

          <section style={styles.sideCard}>
            <h2 style={styles.cardTitle}>Social Pulse (All Recent Security Risks)</h2>
            {socialSignals.length === 0 ? (
              <p style={styles.muted}>Run the scan to detect recent social signals in this geofence.</p>
            ) : (
              <div style={styles.listWrap}>
                {socialSignals.slice(0, 12).map((signal) => (
                  <article key={signal.id} style={styles.signalCard}>
                    <div style={styles.signalTopRow}>
                      <span style={styles.signalSource}>{signal.source}</span>
                      <span style={styles.signalTime}>{timeAgo(signal.seen_at)}</span>
                    </div>
                    <div style={styles.listTitle}>{signal.headline}</div>
                    <div style={styles.listMeta}>{signal.detail}</div>
                    <div style={styles.signalMetaRow}>
                      {signal.isStory && signal.link ? (
                        <a href={signal.link} target="_blank" rel="noreferrer" style={styles.storyLink}>
                          Open story
                        </a>
                      ) : null}
                      {signal.isManual ? <span style={styles.signalTag}>Manual</span> : null}
                      {signal.isStory ? <span style={styles.signalTag}>Live story</span> : null}
                      <span style={styles.signalTag}>Urgency: {signal.urgency}</span>
                      <span style={styles.signalTag}>{signal.reference}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {includeApiIntel ? (
            <section style={styles.sideCard}>
              <h2 style={styles.cardTitle}>API Intel (Retained)</h2>
              {!analysisResult ? (
                <p style={styles.muted}>Run the scan to include API risk summary and recommended actions.</p>
              ) : (
                <div style={styles.analysisStack}>
                  <div style={styles.riskPill}>Risk: {analysisResult.analysis?.risk_level || "unknown"}</div>
                  <p style={styles.summary}>{analysisResult.analysis?.summary}</p>
                  <div style={styles.analysisBlock}>
                    <div style={styles.analysisLabel}>Deployment posture</div>
                    <div style={styles.analysisText}>{analysisResult.analysis?.deployment_posture}</div>
                  </div>
                  <div style={styles.analysisBlock}>
                    <div style={styles.analysisLabel}>Recommended actions</div>
                    {(analysisResult.analysis?.recommended_actions || []).map((item) => (
                      <div key={item} style={styles.analysisText}>{item}</div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          <section style={styles.sideCard}>
            <h2 style={styles.cardTitle}>Facilities in ring</h2>
            <div style={styles.listWrap}>
              {(analysisResult?.facilities || mapFacilities).slice(0, 12).map((facility) => (
                <article key={facility.id} style={styles.listItem}>
                  <div style={styles.listTitle}>{facility.name}</div>
                  <div style={styles.listMeta}>
                    {facility.facility_type?.replaceAll("_", " ")} | {facility.county}
                    {facility.distance_km ? ` | ${facility.distance_km} km` : ""}
                  </div>
                </article>
              ))}
              {(analysisResult?.facilities || mapFacilities).length === 0 ? <p style={styles.muted}>No facilities in the current scope.</p> : null}
            </div>
          </section>

          <section style={styles.sideCard}>
            <h2 style={styles.cardTitle}>Incidents in ring</h2>
            <div style={styles.listWrap}>
              {(analysisResult?.incidents || mapIncidents).slice(0, 12).map((incident) => (
                <article key={incident.id} style={styles.listItem}>
                  <div style={styles.listTitle}>{incident.ob_number} · {incident.incident_type}</div>
                  <div style={styles.listMeta}>
                    {incident.follow_up_status || "open"}
                    {incident.facility_name ? ` | ${incident.facility_name}` : ""}
                    {incident.distance_km ? ` | ${incident.distance_km} km` : ""}
                  </div>
                </article>
              ))}
              {(analysisResult?.incidents || mapIncidents).length === 0 ? <p style={styles.muted}>No incidents in the current scope.</p> : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

const styles = {
  page: { display: "flex", flexDirection: "column", gap: 18, minHeight: "100%" },
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
  title: { margin: 0, fontSize: 30, fontWeight: 800 },
  subtitle: { margin: "8px 0 0", fontSize: 14, maxWidth: 760, lineHeight: 1.5 },
  banner: { borderRadius: 12, backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "12px 14px" },
  controlCard: { borderRadius: 16, backgroundColor: "#fff", border: "1px solid #dbeafe", padding: 18 },
  controlGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end" },
  label: { display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", backgroundColor: "#fff" },
  checkboxRow: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", fontWeight: 600 },
  sliderValue: { marginTop: 8, fontSize: 13, color: "#475569", fontWeight: 700 },
  kpiStrip: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 },
  kpiItem: { borderRadius: 12, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: 12, display: "grid", gap: 4, textAlign: "center", color: "#0f172a" },
  workspace: { display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)", gap: 16, alignItems: "start" },
  mapCard: { borderRadius: 16, backgroundColor: "#fff", border: "1px solid #dbeafe", padding: 18, display: "grid", gap: 14 },
  sideStack: { display: "grid", gap: 16 },
  sideCard: { borderRadius: 16, backgroundColor: "#fff", border: "1px solid #dbeafe", padding: 18, display: "grid", gap: 12 },
  cardHead: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardTitle: { margin: 0, fontSize: 18, color: "#0f172a" },
  hint: { margin: "6px 0 0", fontSize: 12, color: "#64748b" },
  mapWrap: { borderRadius: 14, overflow: "hidden", border: "1px solid #cbd5e1", minHeight: 560, backgroundColor: "#f8fafc" },
  mapCanvas: { width: "100%", height: "560px" },
  mapPlaceholder: { width: "100%", height: "560px", display: "grid", placeItems: "center", padding: 20, color: "#64748b" },
  mapLegendRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  legendPill: { display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: "1px solid #dbeafe", backgroundColor: "#f8fafc", padding: "7px 10px", color: "#0f172a", fontSize: 12, fontWeight: 700 },
  legendDot: { width: 10, height: 10, borderRadius: 999, display: "inline-block" },
  legendNote: { fontSize: 12, color: "#64748b" },
  mapFacilityCard: { borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: 12, display: "grid", gap: 10 },
  mapFacilityList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  mapFacilityChip: { borderRadius: 12, border: "1px solid #dbeafe", backgroundColor: "#ffffff", padding: 10, display: "grid", gap: 4, fontSize: 12, color: "#475569" },
  primaryButton: { border: "none", borderRadius: 10, padding: "11px 16px", background: "linear-gradient(120deg, #0f766e 0%, #0d9488 100%)", color: "#fff", fontWeight: 700, cursor: "pointer" },
  manualForm: { display: "grid", gap: 10 },
  manualRow: { display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 8 },
  textarea: { width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", backgroundColor: "#fff", fontFamily: "inherit", resize: "vertical" },
  muted: { margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.5 },
  analysisStack: { display: "grid", gap: 12 },
  riskPill: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "6px 10px", borderRadius: 999, backgroundColor: "#ccfbf1", border: "1px solid #99f6e4", color: "#115e59", fontWeight: 700, fontSize: 12, textTransform: "uppercase" },
  summary: { margin: 0, color: "#0f172a", fontSize: 14, lineHeight: 1.6 },
  analysisBlock: { display: "grid", gap: 6 },
  analysisLabel: { fontSize: 12, fontWeight: 700, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.05em" },
  analysisText: { fontSize: 13, color: "#0f172a", lineHeight: 1.5 },
  helperText: { fontSize: 12, color: "#64748b" },
  listWrap: { display: "grid", gap: 10 },
  signalCard: { borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: 12, display: "grid", gap: 7 },
  signalTopRow: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" },
  signalSource: { fontSize: 12, fontWeight: 700, color: "#0f766e" },
  signalTime: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  signalMetaRow: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  storyLink: { fontSize: 12, color: "#1d4ed8", fontWeight: 800, textDecoration: "none" },
  signalTag: { fontSize: 11, borderRadius: 999, border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", color: "#1e40af", padding: "3px 8px", fontWeight: 700 },
  listItem: { borderRadius: 12, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: 12, display: "grid", gap: 4 },
  listTitle: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  listMeta: { fontSize: 12, color: "#64748b" },
};

export default VipSurveillancePage;
