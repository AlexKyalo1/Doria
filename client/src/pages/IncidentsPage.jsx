import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColorMode } from "../utils/useColorMode";

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
  institution_id: "",
  facility_id: "",
  incident_type: "robbery",
  ob_number: "",
  description: "",
  latitude: "",
  longitude: "",
  occurred_at: getDefaultOccurredAt(),
};

const parseCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  const { theme, isDark } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
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

  const setCoordinates = (lat, lng) => {
    setIncidentForm((prev) => ({
      ...prev,
      latitude: Number(lat).toFixed(6),
      longitude: Number(lng).toFixed(6),
    }));
  };

  const getErrorMessage = (data, fallback) => {
    if (!data) {
      return fallback;
    }

    if (typeof data.error === "string") {
      return data.error;
    }

    const firstKey = Object.keys(data)[0];
    if (!firstKey) {
      return fallback;
    }

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

    if (list.length > 0) {
      const defaultInstitutionId = String(list[0].id);
      setSelectedInstitutionId((prev) => (prev ? String(prev) : defaultInstitutionId));
      setIncidentForm((prev) => ({
        ...prev,
        institution_id: prev.institution_id || defaultInstitutionId,
      }));
    }
  };

  const loadFacilities = async () => {
    const res = await fetch(`${SECURITY_API}/facilities/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load facilities"));
    }

    const list = Array.isArray(data) ? data.filter(Boolean) : Array.isArray(data.facilities) ? data.facilities.filter(Boolean) : [];
    setFacilities(list);
  };

  const loadIncidents = async () => {
    const res = await fetch(`${INCIDENTS_API}/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load incidents"));
    }

    const list = Array.isArray(data) ? data.filter(Boolean) : Array.isArray(data.incidents) ? data.incidents.filter(Boolean) : [];
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
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
        await Promise.all([loadInstitutions(user), loadFacilities(), loadIncidents()]);
        showBanner("success", "Incident workspace ready.");
      } catch (error) {
        showBanner("error", error.message || "Failed to load incident workspace");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedInstitutionId) {
      return;
    }
    setIncidentForm((prev) => ({
      ...prev,
      institution_id: prev.institution_id || String(selectedInstitutionId),
    }));
  }, [selectedInstitutionId]);


  const filteredFacilities = useMemo(() => {
    const list = facilities.filter(Boolean);
    if (!selectedInstitutionId) {
      return list;
    }
    return list.filter((facility) => facility.institution_id == null || String(facility.institution_id) === String(selectedInstitutionId));
  }, [facilities, selectedInstitutionId]);

  const filteredIncidents = useMemo(() => {
    const list = incidents.filter(Boolean);
    if (!selectedInstitutionId) {
      return list;
    }
    return list.filter((incident) => incident.institution_id == null || String(incident.institution_id) === String(selectedInstitutionId));
  }, [incidents, selectedInstitutionId]);

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

    const institutionValue = incidentForm.institution_id || selectedInstitutionId || institutions[0]?.id || "";
    const facilityValue = incidentForm.facility_id;
    const institutionId = Number(institutionValue);
    const facilityId = facilityValue ? Number(facilityValue) : null;

    
    const payload = {
      institution: institutionId,
      facility: facilityId,
      incident_type: incidentForm.incident_type,
      ob_number: incidentForm.ob_number.trim(),
      description: incidentForm.description.trim(),
      latitude: incidentForm.latitude,
      longitude: incidentForm.longitude,
      occurred_at: incidentForm.occurred_at,
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${INCIDENTS_API}/`, {
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
        institution_id: prev.institution_id || selectedInstitutionId,
        occurred_at: getDefaultOccurredAt(),
      }));
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
          <h1 style={{ ...styles.title, color: theme.text }}>Incident Management</h1>
          {profile && <div style={styles.modeBadge}>{profile.is_staff ? "Admin View" : "User View"}</div>}
        </div>

        <div style={styles.headerControls}>
          <select
            style={styles.filterSelect}
            value={selectedInstitutionId}
            onChange={(event) => {
              setSelectedInstitutionId(event.target.value);
              setIncidentForm((prev) => ({ ...prev, institution_id: event.target.value, facility_id: "" }));
            }}
          >
            <option value="">All Institutions</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={String(institution.id)}>
                {institution.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {banner.text && <div style={bannerStyle}>{banner.text}</div>}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Add Incident</h2>
        <p style={styles.hint}>Incidents are linked to the selected institution.</p>
        <form onSubmit={createIncident} style={styles.formLayout}>
          <div style={styles.formFields}>
            <div>
              <label style={styles.label}>Institution</label>
              <select
                style={styles.input}
                value={incidentForm.institution_id || selectedInstitutionId}
                onChange={(event) =>
                  setIncidentForm((prev) => ({
                    ...prev,
                    institution_id: event.target.value,
                    facility_id: "",
                  }))
                }
                required
              >
                <option value="">Select institution</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={String(institution.id)}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Facility (optional)</label>
              <select
                style={styles.input}
                value={incidentForm.facility_id}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, facility_id: event.target.value }))}
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
              <label style={styles.label}>Occurred At</label>
              <input
                style={styles.input}
                type="datetime-local"
                value={incidentForm.occurred_at}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, occurred_at: event.target.value }))}
                required
              />
            </div><div style={styles.formFullWidth}>
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
        <h2 style={styles.cardTitle}>Recent Incidents</h2>
        {loading ? (
          <p style={styles.muted}>Loading incidents...</p>
        ) : filteredIncidents.length === 0 ? (
          <p style={styles.muted}>No incidents found for the selected institution.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>OB</th>
                  <th style={styles.th}>Facility</th>
                  <th style={styles.th}>Occurred</th>
                  <th style={styles.th}>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td style={styles.td}>{incident.incident_type}</td>
                    <td style={styles.td}>{incident.ob_number}</td>
                    <td style={styles.td}>{incident.facility_name || incident.facility || "-"}</td>
                    <td style={styles.td}>{incident.occurred_at || "-"}</td>
                    <td style={styles.td}>
                      {incident.latitude}, {incident.longitude}
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
    padding: "24px",
    minHeight: "100vh",
  },
  formFields: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "end",
  },
  mapPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    margin: "0 0 8px 0",
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
    backgroundColor: "rgba(14, 116, 144, 0.1)",
    color: "#0f766e",
    border: "1px solid rgba(14, 116, 144, 0.2)",
  },
  headerControls: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
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
  card: {
    border: "1px solid #dbeafe",
    borderRadius: "14px",
    padding: "18px",
    backgroundColor: "#ffffff",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    color: "#0f5132",
  },
  hint: {
    margin: "0 0 10px",
    fontSize: "12px",
    color: "#64748b",
  },
  formLayout: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
    alignItems: "start",
  },
  formFullWidth: {
    gridColumn: "1 / -1",
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
  muted: {
    fontSize: "13px",
    color: "#64748b",
  },
};

export default IncidentsPage;






























