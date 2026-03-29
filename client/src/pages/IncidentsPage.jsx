import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColorMode } from "../utils/useColorMode";
import { apiFetch } from "../utils/apiFetch";

const ACCOUNTS_API = "http://127.0.0.1:8000/api/accounts";
const SECURITY_API = "http://127.0.0.1:8000/api/security";
const INCIDENTS_API = "http://127.0.0.1:8000/api/incidents";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const DEFAULT_MAP_CENTER = [-1.286389, 36.817223];

const INCIDENT_TYPES = [
  { value: "robbery", label: "Robbery" },
  { value: "assault", label: "Assault" },
  { value: "accident", label: "Accident" },
  { value: "missing_person", label: "Missing Person" },
  { value: "murder", label: "Murder" },
  { value: "theft", label: "Theft" },
  { value: "other", label: "Other" },
];

const getDefaultOccurredAt = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

const defaultIncidentForm = {
  facility_id: "",
  incident_type: "robbery",
  ob_number: "",
  contact_phone: "",
  description: "",
  latitude: "",
  longitude: "",
  occurred_at: getDefaultOccurredAt(),
};

const parseCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatStatus = (value) => {
  if (value === "in_progress") return "In Progress";
  if (value === "resolved") return "Resolved";
  return "Open";
};

const IncidentPreviewMap = ({ ready, center, selectedPosition, onPick }) => {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!ready || !window.google?.maps || !hostRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(hostRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapRef.current.addListener("click", (event) => {
        const lat = event.latLng?.lat?.();
        const lng = event.latLng?.lng?.();
        if (typeof lat === "number" && typeof lng === "number") {
          onPick(lat, lng);
        }
      });
    }

    mapRef.current.setCenter({ lat: center[0], lng: center[1] });
  }, [ready, center, onPick]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    if (!selectedPosition) {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#ef4444",
          fillOpacity: 0.95,
          strokeColor: "#b91c1c",
          strokeWeight: 2,
        },
      });
    }

    markerRef.current.setPosition({ lat: selectedPosition.lat, lng: selectedPosition.lng });
  }, [selectedPosition]);

  if (!ready) {
    return <div style={styles.mapPlaceholder}>Google map preview will appear once Maps loads.</div>;
  }

  return <div ref={hostRef} style={styles.map} />;
};

const IncidentsPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [incidentForm, setIncidentForm] = useState(defaultIncidentForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const selectingRef = useRef(false);
  const suppressNextSearchRef = useRef(false);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);

  const isAdmin = Boolean(profile?.is_staff);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

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

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type: "", text: "" }), 3500);
  };

  const loadProfile = async () => {
    const res = await apiFetch(`${ACCOUNTS_API}/profile/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load profile"));
    }

    setProfile(data.user || null);
    return data.user || null;
  };

  const loadFacilities = async (user) => {
    const res = await apiFetch(`${SECURITY_API}/facilities/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load facilities"));
    }

    const list = Array.isArray(data)
      ? data.filter(Boolean)
      : Array.isArray(data.facilities)
        ? data.facilities.filter(Boolean)
        : [];
    setFacilities(list);

    if (list.length > 0 && !user?.is_staff) {
      const defaultFacilityId = String(list[0].id);
      setSelectedFacilityId((prev) => (prev ? String(prev) : defaultFacilityId));
      setIncidentForm((prev) => ({
        ...prev,
        facility_id: prev.facility_id || defaultFacilityId,
      }));
    }
  };

  const loadIncidents = async () => {
    const res = await apiFetch(`${INCIDENTS_API}/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load incidents"));
    }

    const list = Array.isArray(data)
      ? data.filter(Boolean)
      : Array.isArray(data.incidents)
        ? data.incidents.filter(Boolean)
        : [];
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
    script.onerror = () => showBanner("error", "Failed to load Google Maps script.");
    document.body.appendChild(script);
    return undefined;
  }, []);

  useEffect(() => {
    if (!googleMapsReady) {
      setPlacesReady(false);
      return;
    }

    if (!window.google?.maps?.places) {
      setPlacesReady(false);
      setPlacesError("Places library not available yet. Reload page after Maps loads.");
      return;
    }

    autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement("div"));
    setPlacesReady(true);
    setPlacesError("");
  }, [googleMapsReady]);

  useEffect(() => {
    if (!placesReady || !autocompleteServiceRef.current || selectingRef.current) {
      setPlaceSuggestions([]);
      return;
    }

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      setPlaceSuggestions([]);
      return;
    }

    const q = placeQuery.trim();
    if (q.length < 3) {
      setPlaceSuggestions([]);
      return;
    }

    const timeout = setTimeout(() => {
      setPlaceLoading(true);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: `${q}, Kenya`,
          componentRestrictions: { country: "ke" },
        },
        (predictions, status) => {
          setPlaceLoading(false);
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setPlaceSuggestions([]);
            return;
          }
          setPlaceSuggestions(predictions);
        }
      );
    }, 280);

    return () => clearTimeout(timeout);
  }, [placeQuery, placesReady]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const user = await loadProfile();
        await Promise.all([loadFacilities(user), loadIncidents()]);
        showBanner("success", "Incident overview ready.");
      } catch (error) {
        showBanner("error", error.message || "Failed to load incident overview");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedFacilityId) {
      return;
    }
    setIncidentForm((prev) => ({
      ...prev,
      facility_id: prev.facility_id || String(selectedFacilityId),
    }));
  }, [selectedFacilityId]);

  const filteredFacilities = useMemo(() => facilities.filter(Boolean), [facilities]);

  const filteredIncidents = useMemo(() => {
    const list = incidents.filter(Boolean);
    if (!selectedFacilityId) {
      return list;
    }
    return list.filter((incident) => {
      const facilityId = incident.facility_id ?? incident.facility ?? "";
      return String(facilityId) === String(selectedFacilityId);
    });
  }, [incidents, selectedFacilityId]);

  const sortedIncidents = useMemo(() => {
    return [...filteredIncidents].sort((a, b) => new Date(b?.occurred_at || 0) - new Date(a?.occurred_at || 0));
  }, [filteredIncidents]);

  const recentIncidents = useMemo(() => sortedIncidents.slice(0, 5), [sortedIncidents]);

  const stats = useMemo(() => {
    const visible = sortedIncidents.length;
    const open = sortedIncidents.filter((incident) => (incident.follow_up_status || "open") === "open").length;
    const inProgress = sortedIncidents.filter((incident) => incident.follow_up_status === "in_progress").length;
    const resolved = sortedIncidents.filter((incident) => incident.follow_up_status === "resolved").length;
    return [
      { label: "Visible incidents", value: visible, note: "Current facility scope" },
      { label: "Open", value: open, note: "Waiting for follow-up" },
      { label: "In progress", value: inProgress, note: "Being handled" },
      { label: "Resolved", value: resolved, note: "Closed cases" },
    ];
  }, [sortedIncidents]);

  const previewCenter = useMemo(() => {
    const lat = parseCoord(incidentForm.latitude);
    const lng = parseCoord(incidentForm.longitude);
    if (lat === null || lng === null) {
      return DEFAULT_MAP_CENTER;
    }
    return [lat, lng];
  }, [incidentForm.latitude, incidentForm.longitude]);

  const selectedPosition = useMemo(() => {
    const lat = parseCoord(incidentForm.latitude);
    const lng = parseCoord(incidentForm.longitude);
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng };
  }, [incidentForm.latitude, incidentForm.longitude]);

  const setCoordinates = (lat, lng) => {
    setIncidentForm((prev) => ({
      ...prev,
      latitude: Number(lat).toFixed(6),
      longitude: Number(lng).toFixed(6),
    }));
  };

  const handlePlaceSuggestionSelect = (suggestion) => {
    if (!placesServiceRef.current || !window.google?.maps?.places) {
      setPlacesError("Google Places service is not ready.");
      return;
    }

    selectingRef.current = true;
    suppressNextSearchRef.current = true;
    setPlaceSuggestions([]);
    setPlaceLoading(false);
    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ["geometry", "formatted_address"],
      },
      (place, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
          setPlacesError("Could not fetch selected place details.");
          selectingRef.current = false;
          return;
        }

        const lat = place.geometry?.location?.lat?.();
        const lng = place.geometry?.location?.lng?.();
        if (typeof lat === "number" && typeof lng === "number") {
          setCoordinates(lat, lng);
        }

        setPlaceQuery(place.formatted_address || suggestion.description);
        selectingRef.current = false;
      }
    );
  };

  const createIncident = async (event) => {
    event.preventDefault();
    const facilityValue = incidentForm.facility_id || selectedFacilityId || "";
    const facilityId = facilityValue ? Number(facilityValue) : null;

    const payload = {
      facility: facilityId,
      incident_type: incidentForm.incident_type,
      ob_number: incidentForm.ob_number.trim(),
      contact_phone: incidentForm.contact_phone.trim(),
      description: incidentForm.description.trim(),
      latitude: incidentForm.latitude,
      longitude: incidentForm.longitude,
      occurred_at: incidentForm.occurred_at,
    };

    try {
      setSubmitting(true);
      const res = await apiFetch(`${INCIDENTS_API}/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to create incident"));
      }

      const createdIncident = data?.incident || (data?.id ? data : null);
      if (createdIncident) {
        setIncidents((prev) => [createdIncident, ...prev].filter(Boolean));
      } else {
        await loadIncidents();
      }

      setIncidentForm((prev) => ({
        ...defaultIncidentForm,
        facility_id: prev.facility_id || selectedFacilityId,
        occurred_at: getDefaultOccurredAt(),
      }));
      setPlaceQuery("");
      setPlaceSuggestions([]);
      showBanner("success", "Incident created successfully.");
    } catch (error) {
      showBanner("error", error.message || "Failed to create incident");
    } finally {
      setSubmitting(false);
    }
  };

  const bannerStyle = {
    ...styles.banner,
    ...(banner.type === "success" ? styles.bannerSuccess : {}),
    ...(banner.type === "error" ? styles.bannerError : {}),
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <div style={styles.header}>
        <div>
          <h1 style={{ ...styles.title, color: theme.text }}>Incident Overview</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Capture new incidents here, then move into the dedicated manager for deeper follow-up and queue handling.
          </p>
          {profile && <div style={styles.modeBadge}>{profile.is_staff ? "Admin View" : "User View"}</div>}
        </div>

        <div style={styles.headerControls}>
          <select
            style={styles.filterSelect}
            value={selectedFacilityId}
            onChange={(event) => {
              setSelectedFacilityId(event.target.value);
              setIncidentForm((prev) => ({ ...prev, facility_id: event.target.value }));
            }}
          >
            {isAdmin && <option value="">All Facilities</option>}
            {facilities.map((facility) => (
              <option key={facility.id} value={String(facility.id)}>
                {facility.name}
              </option>
            ))}
          </select>

          <button type="button" style={styles.secondaryButton} onClick={() => (window.location.href = "/incidents/manage")}>
            Manage incidents
          </button>
        </div>
      </div>

      {banner.text && <div style={bannerStyle}>{banner.text}</div>}

      <section style={styles.statsGrid}>
        {stats.map((stat) => (
          <article key={stat.label} style={styles.statCard}>
            <div style={styles.statValue}>{stat.value}</div>
            <div style={styles.statLabel}>{stat.label}</div>
            <div style={styles.statNote}>{stat.note}</div>
          </article>
        ))}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div>
            <h2 style={styles.cardTitle}>Add Incident</h2>
            <p style={styles.hint}>Incidents are linked to the selected facility and ready for follow-up in the incident manager.</p>
          </div>
        </div>

        <form onSubmit={createIncident} style={styles.formLayout}>
          <div style={styles.formFields}>
            <div>
              <label style={styles.label}>Facility</label>
              <select
                style={styles.input}
                value={incidentForm.facility_id || selectedFacilityId}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, facility_id: event.target.value }))}
                required
              >
                <option value="">Select facility</option>
                {filteredFacilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Incident Type</label>
              <select
                style={styles.input}
                value={incidentForm.incident_type}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, incident_type: event.target.value }))}
                required
              >
                {INCIDENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>OB Number</label>
              <input
                style={styles.input}
                value={incidentForm.ob_number}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, ob_number: event.target.value }))}
                placeholder="OB-2026-001"
                required
              />
            </div>

            <div>
              <label style={styles.label}>Reporter Phone</label>
              <input
                style={styles.input}
                value={incidentForm.contact_phone}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                placeholder="+2547XXXXXXXX"
              />
            </div>

            <div>
              <label style={styles.label}>Occurred At</label>
              <input
                style={styles.input}
                type="datetime-local"
                value={incidentForm.occurred_at}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, occurred_at: event.target.value }))}
                required
              />
            </div>

            <div style={styles.formFullWidth}>
              <label style={styles.label}>Description</label>
              <textarea
                style={{ ...styles.input, minHeight: "90px" }}
                value={incidentForm.description}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Brief incident summary"
                required
              />
            </div>

            <button type="submit" style={styles.primaryButton} disabled={submitting}>
              {submitting ? "Saving..." : "Save Incident"}
            </button>
          </div>

          <div style={styles.mapPanel}>
            <div>
              <label style={styles.label}>Place Search</label>
              <input
                style={styles.input}
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                placeholder="Search place or landmark"
              />
              {placesError && <div style={styles.placeStatus}>{placesError}</div>}
              {placeLoading && <div style={styles.placeStatus}>Searching...</div>}
              {placeSuggestions.length > 0 && (
                <div style={styles.suggestionList}>
                  {placeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.place_id}
                      type="button"
                      style={styles.suggestionItem}
                      onClick={() => handlePlaceSuggestionSelect(suggestion)}
                    >
                      {suggestion.description}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.mapSection}>
              <div style={styles.mapWrap}>
                <IncidentPreviewMap
                  ready={googleMapsReady}
                  center={previewCenter}
                  selectedPosition={selectedPosition}
                  onPick={setCoordinates}
                />
              </div>
              <p style={styles.mapHint}>Tip: click the map to set precise coordinates.</p>
            </div>
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div>
            <h2 style={styles.cardTitle}>Recent Incidents</h2>
            <p style={styles.hint}>Showing the five most recent incidents for this view.</p>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={() => (window.location.href = "/incidents/manage")}>
            Open full manager
          </button>
        </div>

        {loading ? (
          <p style={styles.muted}>Loading incidents...</p>
        ) : recentIncidents.length === 0 ? (
          <p style={styles.muted}>No incidents found for the selected facility.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>OB</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Proxy Phone</th>
                  <th style={styles.th}>Facility</th>
                  <th style={styles.th}>Occurred</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td style={styles.tdStrong}>{incident.ob_number}</td>
                    <td style={styles.td}>{incident.incident_type}</td>
                    <td style={styles.td}>{incident.proxy_phone_number || "-"}</td>
                    <td style={styles.td}>{incident.facility_name || incident.facility || "-"}</td>
                    <td style={styles.td}>{incident.occurred_at || "-"}</td>
                    <td style={styles.td}>{formatStatus(incident.follow_up_status || "open")}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.smallButton}
                        onClick={() => (window.location.href = `/incidents/manage?incident=${incident.id}`)}
                      >
                        Open manager
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    minHeight: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "32px",
    fontWeight: "700",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    margin: "0 0 10px",
    fontSize: "14px",
    maxWidth: "760px",
  },
  modeBadge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    backgroundColor: "rgba(14, 116, 144, 0.1)",
    color: "#0f766e",
    border: "1px solid rgba(14, 116, 144, 0.2)",
  },
  headerControls: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
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
  banner: {
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "500",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  statCard: {
    borderRadius: "14px",
    padding: "16px",
    backgroundColor: "#ffffff",
    border: "1px solid #dbeafe",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#0f172a",
  },
  statLabel: {
    marginTop: "8px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statNote: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#64748b",
  },
  card: {
    border: "1px solid #dbeafe",
    borderRadius: "14px",
    padding: "18px",
    backgroundColor: "#ffffff",
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    color: "#0f5132",
  },
  hint: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },
  formLayout: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
    alignItems: "start",
  },
  formFields: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "end",
  },
  formFullWidth: {
    gridColumn: "1 / -1",
  },
  mapPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#334155",
    marginBottom: "4px",
    display: "block",
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
    background: "linear-gradient(120deg, #0f766e 0%, #0d9488 100%)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    height: "42px",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "11px 14px",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
    height: "42px",
  },
  smallButton: {
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid #0f766e",
    backgroundColor: "#0f766e",
    color: "#fff",
    cursor: "pointer",
  },
  mapSection: {
    marginTop: "6px",
  },
  mapWrap: {
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    height: "360px",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapPlaceholder: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    fontSize: "14px",
  },
  mapHint: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#64748b",
  },
  suggestionList: {
    marginTop: "6px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    maxHeight: "180px",
    overflowY: "auto",
  },
  suggestionItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "13px",
    color: "#0f172a",
  },
  placeStatus: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#64748b",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: "600",
    color: "#475569",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
  },
  tdStrong: {
    padding: "10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontWeight: 700,
  },
  muted: {
    fontSize: "13px",
    color: "#64748b",
  },
};

export default IncidentsPage;
