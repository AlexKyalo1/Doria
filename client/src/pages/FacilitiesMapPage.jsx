import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorMode } from "../utils/useColorMode";

const ACCOUNTS_API = "http://127.0.0.1:8000/api/accounts";
const SECURITY_API = "http://127.0.0.1:8000/api/security";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const DEFAULT_MAP_CENTER = [-1.286389, 36.817223];

const parseCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getFacilityTypeIcon = (type) => {
  const icons = {
    police_station: "PS",
    police_post: "PP",
    dci: "DCI",
    administration: "AP",
  };
  return icons[type] || "LOC";
};

const FacilitiesDistanceMap = ({
  ready,
  center,
  facilities,
  fromId,
  toId,
  selectedFacilityId,
  onMarkerSelect,
  isDark,
}) => {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const markerEntriesRef = useRef([]);
  const lineRef = useRef(null);

  const markerIcon = useCallback((facilityId) => {
    const isFrom = facilityId === fromId;
    const isTo = facilityId === toId;
    const isSelected = facilityId === selectedFacilityId;

    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: isFrom || isTo || isSelected ? 10 : 7,
      fillColor: isFrom ? "#3b82f6" : isTo ? "#8b5cf6" : isSelected ? "#ef4444" : "#10b981",
      fillOpacity: 0.95,
      strokeColor: isFrom ? "#2563eb" : isTo ? "#7c3aed" : isSelected ? "#dc2626" : "#059669",
      strokeWeight: 2,
    };
  }, [fromId, toId, selectedFacilityId]);

  useEffect(() => {
    if (!ready || !window.google?.maps || !hostRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(hostRef.current, {
        center: { lat: center[0], lng: center[1] },
        zoom: 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: isDark
          ? [
              { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
              { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
              { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            ]
          : null,
      });
    }

    mapRef.current.setCenter({ lat: center[0], lng: center[1] });
  }, [ready, center, isDark]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    markerEntriesRef.current.forEach((entry) => entry.marker.setMap(null));
    markerEntriesRef.current = facilities.map((facility) => {
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: facility.lat, lng: facility.lng },
        title: facility.name,
        icon: markerIcon(facility.id),
      });

      marker.addListener("click", () => onMarkerSelect(facility));
      return { id: facility.id, marker };
    });
  }, [facilities, onMarkerSelect, markerIcon]);

  useEffect(() => {
    if (!window.google?.maps) {
      return;
    }

    markerEntriesRef.current.forEach((entry) => {
      entry.marker.setIcon(markerIcon(entry.id));
    });
  }, [fromId, toId, selectedFacilityId, markerIcon]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || facilities.length === 0) {
      return;
    }

    if (facilities.length === 1) {
      mapRef.current.setCenter({ lat: facilities[0].lat, lng: facilities[0].lng });
      mapRef.current.setZoom(11);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    facilities.forEach((facility) => bounds.extend({ lat: facility.lat, lng: facility.lng }));
    mapRef.current.fitBounds(bounds, 40);
  }, [facilities]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    if (lineRef.current) {
      lineRef.current.setMap(null);
      lineRef.current = null;
    }

    const fromFacility = facilities.find((item) => item.id === fromId);
    const toFacility = facilities.find((item) => item.id === toId);
    if (!fromFacility || !toFacility) {
      return;
    }

    lineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path: [
        { lat: fromFacility.lat, lng: fromFacility.lng },
        { lat: toFacility.lat, lng: toFacility.lng },
      ],
      strokeColor: "#ef4444",
      strokeOpacity: 0.95,
      strokeWeight: 4,
    });
  }, [facilities, fromId, toId]);

  if (!ready) {
    return <div style={styles.mapFallback}>Google map preview will appear once Maps loads.</div>;
  }

  return <div ref={hostRef} style={styles.map} />;
};

const FacilitiesMapPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme, isDark } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedFacility, setSelectedFacility] = useState(null);
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
      setSelectedInstitutionId((prev) => prev || list[0].id);
    }
  };

  const loadFacilities = async () => {
    const res = await fetch(`${SECURITY_API}/facilities/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load facilities"));
    }

    setFacilities(data.facilities || []);
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
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const user = await loadProfile();
        await Promise.all([loadInstitutions(user), loadFacilities()]);
        showBanner("success", "Map loaded successfully.");
      } catch (error) {
        showBanner("error", error.message || "Failed to load map");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredFacilities = useMemo(() => {
    if (!selectedInstitutionId) {
      return facilities;
    }
    return facilities.filter((facility) => facility.institution_id === selectedInstitutionId);
  }, [facilities, selectedInstitutionId]);

  const mappableFacilities = useMemo(
    () =>
      filteredFacilities
        .map((facility) => {
          const lat = parseCoord(facility.latitude);
          const lng = parseCoord(facility.longitude);
          if (lat === null || lng === null) {
            return null;
          }
          return { ...facility, lat, lng };
        })
        .filter(Boolean),
    [filteredFacilities]
  );

  const mapCenter = useMemo(() => {
    if (mappableFacilities.length === 0) {
      return DEFAULT_MAP_CENTER;
    }

    const totals = mappableFacilities.reduce(
      (acc, item) => ({ lat: acc.lat + item.lat, lng: acc.lng + item.lng }),
      { lat: 0, lng: 0 }
    );

    return [totals.lat / mappableFacilities.length, totals.lng / mappableFacilities.length];
  }, [mappableFacilities]);

  const handleMarkerSelect = (facility) => {
    setSelectedFacility(facility);
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
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>

      <div style={styles.header}>
        <div>
          <h1 style={{ ...styles.title, color: theme.text }}>Facility Distance Map</h1>
          {profile && <div style={styles.modeBadge}>{profile.is_staff ? "Admin View" : "User View"}</div>}
        </div>

        <div style={styles.headerControls}>
          <select
            style={styles.filterSelect}
            value={selectedInstitutionId}
            onChange={(event) => {
              setSelectedInstitutionId(event.target.value);
              setSelectedFacility(null);
              setDistanceResult(null);
              setDistanceForm({ from_id: "", to_id: "" });
            }}
          >
            <option value="">All Institutions</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {banner.text && <div style={bannerStyle}>{banner.text}</div>}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{mappableFacilities.length}</div>
          <div style={styles.statLabel}>Facilities on Map</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{filteredFacilities.length - mappableFacilities.length}</div>
          <div style={styles.statLabel}>Missing Coordinates</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{filteredFacilities.filter((f) => f.active).length}</div>
          <div style={styles.statLabel}>Active Facilities</div>
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
          fromId={distanceForm.from_id}
          toId={distanceForm.to_id}
          selectedFacilityId={selectedFacility?.id}
          onMarkerSelect={handleMarkerSelect}
          isDark={isDark}
        />
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Distance Calculator</h2>
        <p style={styles.hint}>Tip: click markers in sequence (From then To), or use dropdowns below.</p>
        <form onSubmit={calculateDistance} style={styles.formGrid}>
          <div>
            <label style={styles.label}>From</label>
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
            <label style={styles.label}>To</label>
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
          <button type="submit" style={styles.primaryButton}>Calculate Distance</button>
        </form>

        {distanceResult && (
          <div style={styles.resultBox}>
            <strong>{distanceResult.distance_km} km</strong>
            <div>{distanceResult.from.name} to {distanceResult.to.name}</div>
          </div>
        )}
      </section>

      {selectedFacility && (
        <div style={styles.bottomSheet}>
          <div style={styles.sheetHandle} />
          <div style={styles.sheetHeader}>
            <div style={styles.modalTitle}>
              <span style={styles.modalIcon}>{getFacilityTypeIcon(selectedFacility.facility_type)}</span>
              <h3 style={styles.modalName}>{selectedFacility.name}</h3>
            </div>
            <button style={styles.modalClose} onClick={() => setSelectedFacility(null)}>
              x
            </button>
          </div>

          <div style={styles.modalBody}>
            <div style={styles.modalGrid}>
              <div style={styles.modalItem}>
                <span style={styles.modalLabel}>Type</span>
                <span style={styles.modalValue}>{selectedFacility.facility_type.replace("_", " ").toUpperCase()}</span>
              </div>
              <div style={styles.modalItem}>
                <span style={styles.modalLabel}>County</span>
                <span style={styles.modalValue}>{selectedFacility.county}</span>
              </div>
              <div style={styles.modalItem}>
                <span style={styles.modalLabel}>Sub-county</span>
                <span style={styles.modalValue}>{selectedFacility.sub_county || "-"}</span>
              </div>
              <div style={styles.modalItem}>
                <span style={styles.modalLabel}>Status</span>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: selectedFacility.active ? "#10b981" : "#ef4444",
                  }}
                >
                  {selectedFacility.active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>

            <div style={styles.modalCoordinates}>
              <div style={styles.modalLabel}>Coordinates</div>
              <div style={styles.coordBox}>
                <span>Lat: {selectedFacility.latitude}</span>
                <span>Lng: {selectedFacility.longitude}</span>
              </div>
            </div>
          </div>
        </div>
      )}
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
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    color: "#3b82f6",
    border: "1px solid rgba(59, 130, 246, 0.2)",
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
    padding: "14px",
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
  formGrid: {
    display: "grid",
    gap: "10px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    alignItems: "end",
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
    background: "linear-gradient(120deg, #166534 0%, #15803d 100%)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    height: "42px",
  },
  resultBox: {
    marginTop: "12px",
    padding: "12px",
    borderRadius: "10px",
    backgroundColor: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#14532d",
  },
  bottomSheet: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "12px",
    width: "min(920px, calc(100% - 24px))",
    backgroundColor: "white",
    borderRadius: "18px",
    boxShadow: "0 20px 45px rgba(2, 6, 23, 0.28)",
    border: "1px solid #dbeafe",
    zIndex: 2000,
    animation: "slideUp 0.25s ease-out",
    overflow: "hidden",
  },
  sheetHandle: {
    width: "60px",
    height: "6px",
    borderRadius: "999px",
    backgroundColor: "#cbd5e1",
    margin: "10px auto 4px",
  },
  sheetHeader: {
    padding: "10px 20px 14px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  modalIcon: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
    minWidth: "30px",
  },
  modalName: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#0f172a",
  },
  modalClose: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "24px",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "24px",
  },
  modalItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  modalLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  modalValue: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#0f172a",
  },
  statusBadge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    color: "white",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.5px",
  },
  modalCoordinates: {
    backgroundColor: "#f8fafc",
    borderRadius: "12px",
    padding: "16px",
  },
  coordBox: {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#0f172a",
  },
};

export default FacilitiesMapPage;










