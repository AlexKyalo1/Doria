﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColorMode } from "../utils/useColorMode";
import { apiFetch } from "../utils/apiFetch";

const ACCOUNTS_API = "http://127.0.0.1:8000/api/accounts";
const SECURITY_API = "http://127.0.0.1:8000/api/security";
const KENYA_ADMIN_CSV = "/data/kenya_counties_subcounties.csv";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const DEFAULT_MAP_CENTER = [-1.286389, 36.817223];

const defaultFacilityForm = {
  institution_id: "",
  name: "",
  facility_type: "police_station",
  county: "",
  sub_county: "",
  latitude: "",
  longitude: "",
  active: true,
};

const parseCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const FacilityPreviewMap = ({ ready, center, selectedPosition, onPick }) => {
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
        zoom: 8,
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
          fillColor: "#3b82f6",
          fillOpacity: 0.95,
          strokeColor: "#1d4ed8",
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

const FacilitiesPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme, isDark } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [counties, setCounties] = useState([]);
  const [subCountyByCounty, setSubCountyByCounty] = useState({});
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [facilityForm, setFacilityForm] = useState(defaultFacilityForm);
  const [customSubCounty, setCustomSubCounty] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [facilityMemberFacility, setFacilityMemberFacility] = useState(null);
  const [facilityMembers, setFacilityMembers] = useState([]);
  const [facilityMembersLoading, setFacilityMembersLoading] = useState(false);
  const [facilityMembersError, setFacilityMembersError] = useState("");
  const [facilityMemberUserId, setFacilityMemberUserId] = useState("");
  const [facilityMemberRole, setFacilityMemberRole] = useState("member");
  const [facilityMemberMessage, setFacilityMemberMessage] = useState("");
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

  const isAdmin = Boolean(profile?.is_staff);

  const showBanner = (type, text) => {
    setBanner({ type, text });
  };
  const loadFacilityMembers = async (facility) => {
    if (!facility?.id) return;
    setFacilityMembersLoading(true);
    setFacilityMembersError("");
    try {
      const res = await apiFetch(`${ACCOUNTS_API}/facilities/${facility.id}/members/list/`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to load facility members"));
      }
      setFacilityMembers(Array.isArray(data.members) ? data.members : []);
    } catch (error) {
      setFacilityMembersError(error.message || "Failed to load facility members");
    } finally {
      setFacilityMembersLoading(false);
    }
  };

  const openFacilityMembers = async (facility) => {
    setFacilityMemberFacility(facility);
    setFacilityMembers([]);
    setFacilityMemberUserId("");
    setFacilityMemberRole("member");
    setFacilityMemberMessage("");
    await loadFacilityMembers(facility);
  };

  const closeFacilityMembers = () => {
    setFacilityMemberFacility(null);
    setFacilityMembers([]);
    setFacilityMembersError("");
    setFacilityMemberMessage("");
    setFacilityMembersLoading(false);
  };

  const addFacilityMember = async () => {
    if (!facilityMemberFacility?.id || !facilityMemberUserId) {
      setFacilityMemberMessage("User ID is required");
      return;
    }
    setFacilityMemberMessage("Saving...");
    try {
      const res = await apiFetch(
        `${ACCOUNTS_API}/facilities/${facilityMemberFacility.id}/members/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            user_id: facilityMemberUserId.trim(),
            role: facilityMemberRole,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to add member"));
      }
      setFacilityMemberMessage("Member saved");
      setFacilityMemberUserId("");
      await loadFacilityMembers(facilityMemberFacility);
    } catch (error) {
      setFacilityMemberMessage(error.message || "Failed to add member");
    }
  };

  const removeFacilityMember = async (member) => {
    if (!facilityMemberFacility?.id || !member?.user_id) return;
    setFacilityMemberMessage("Removing...");
    try {
      const res = await apiFetch(
        `${ACCOUNTS_API}/facilities/${facilityMemberFacility.id}/members/${member.user_id}/`,
        {
          method: "DELETE",
          headers,
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to remove member"));
      }
      setFacilityMemberMessage("Member removed");
      await loadFacilityMembers(facilityMemberFacility);
    } catch (error) {
      setFacilityMemberMessage(error.message || "Failed to remove member");
    }
  };

  const setCoordinates = (lat, lng) => {
    setFacilityForm((prev) => ({
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

  const parseKenyaAdminCsv = (csvText) => {
    const rows = csvText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length < 2) {
      return { counties: [], subCountyByCounty: {} };
    }

    const mapping = {};

    for (let i = 1; i < rows.length; i += 1) {
      const [countyRaw, subCountyRaw] = rows[i].split(",");
      const county = (countyRaw || "").trim();
      const subCounty = (subCountyRaw || "").trim();

      if (!county || !subCounty) {
        continue;
      }

      if (!mapping[county]) {
        mapping[county] = new Set();
      }
      mapping[county].add(subCounty);
    }

    const countyList = Object.keys(mapping).sort((a, b) => a.localeCompare(b));
    const normalizedMap = {};
    countyList.forEach((county) => {
      normalizedMap[county] = Array.from(mapping[county]).sort((a, b) => a.localeCompare(b));
    });

    return { counties: countyList, subCountyByCounty: normalizedMap };
  };

  const loadAdminGeography = async () => {
    const res = await apiFetch(KENYA_ADMIN_CSV);
    if (!res.ok) {
      throw new Error("Failed to load counties and sub-counties CSV");
    }

    const csvText = await res.text();
    const parsed = parseKenyaAdminCsv(csvText);
    setCounties(parsed.counties);
    setSubCountyByCounty(parsed.subCountyByCounty);
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

  const loadInstitutions = async (user) => {
    const scope = user?.is_staff ? "?scope=all" : "";
    const res = await apiFetch(`${ACCOUNTS_API}/institutions/${scope}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load institutions"));
    }

    const list = data.institutions || [];
    setInstitutions(list);

    if (list.length > 0) {
      const defaultInstitution = selectedInstitutionId ? String(selectedInstitutionId) : String(list[0].id);
      setSelectedInstitutionId(defaultInstitution);
      setFacilityForm((prev) => ({ ...prev, institution_id: prev.institution_id || defaultInstitution }));
    }
  };

  const loadFacilities = async () => {
    const res = await apiFetch(`${SECURITY_API}/facilities/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load facilities"));
    }

    const list = Array.isArray(data) ? data.filter(Boolean) : Array.isArray(data.facilities) ? data.facilities.filter(Boolean) : [];
    setFacilities(list);
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
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const user = await loadProfile();
        await Promise.all([loadInstitutions(user), loadFacilities(), loadAdminGeography()]);
        showBanner("success", "Facilities workspace is ready.");
      } catch (error) {
        showBanner("error", error.message || "Failed to initialize facilities page");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
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

  const subCountyOptions = useMemo(() => {
    if (!facilityForm.county) {
      return [];
    }

    return subCountyByCounty[facilityForm.county] || [];
  }, [facilityForm.county, subCountyByCounty]);

  const allowedInstitutionIds = useMemo(() => {
    return new Set(institutions.map((institution) => String(institution.id)));
  }, [institutions]);

  const filteredFacilities = useMemo(() => {
    const list = facilities.filter(Boolean);
    const scoped = list.filter((facility) => {
      const facilityInstitutionId = facility.institution_id;
      if (!isAdmin) {
        if (!facilityInstitutionId) return false;
        return allowedInstitutionIds.has(String(facilityInstitutionId));
      }
      return true;
    });

    if (!selectedInstitutionId) {
      return scoped;
    }

    return scoped.filter((facility) =>
      facility.institution_id == null ||
      String(facility.institution_id) === String(selectedInstitutionId)
    );
  }, [facilities, selectedInstitutionId, isAdmin, allowedInstitutionIds]);

  const previewCenter = useMemo(() => {
    const lat = parseCoord(facilityForm.latitude);
    const lng = parseCoord(facilityForm.longitude);
    if (lat === null || lng === null) {
      return DEFAULT_MAP_CENTER;
    }
    return [lat, lng];
  }, [facilityForm.latitude, facilityForm.longitude]);

  const selectedPosition = useMemo(() => {
    const lat = parseCoord(facilityForm.latitude);
    const lng = parseCoord(facilityForm.longitude);
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng };
  }, [facilityForm.latitude, facilityForm.longitude]);

  const manageableCount = useMemo(() => facilities.filter(Boolean).filter((item) => item.active).length, [facilities]);

  const handleCountyChange = (value) => {
    setFacilityForm((prev) => ({ ...prev, county: value, sub_county: "" }));
    setCustomSubCounty("");
  };
  const handlePlaceSuggestionSelect = (suggestion) => {
    if (!placesServiceRef.current || !window.google?.maps?.places) {
      setPlacesError("Google Places service is not ready.");
      return;
    }

    selectingRef.current = true;
    suppressNextSearchRef.current = true;
    setPlaceSuggestions([]); // Close dropdown immediately
    setPlaceLoading(false);
    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ["geometry", "formatted_address", "address_components"],
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

        const components = place.address_components || [];
        const findComponent = (type) =>
          components.find((item) => item.types?.includes(type))?.long_name || "";

        const countyCandidate =
          findComponent("administrative_area_level_2") || findComponent("administrative_area_level_1");
        const subCountyCandidate =
          findComponent("administrative_area_level_3") ||
          findComponent("sublocality_level_1") ||
          findComponent("locality");

        setFacilityForm((prev) => ({
          ...prev,
          county: countyCandidate || prev.county,
          sub_county: subCountyCandidate || prev.sub_county,
        }));

        setPlaceQuery(suggestion.description || "");
        setPlacesError("");
        selectingRef.current = false;
      }
    );
  };

  
  const deleteFacility = async (facility) => {
    if (!facility?.id) {
      showBanner("error", "Missing facility id.");
      return;
    }

    const confirmed = window.confirm(`Delete facility "${facility.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      const res = await apiFetch(`${SECURITY_API}/facilities/${facility.id}/`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch (error) {
          data = null;
        }
        throw new Error(getErrorMessage(data, "Failed to delete facility"));
      }

      setFacilities((prev) => prev.filter((item) => item?.id !== facility.id));
      showBanner("success", "Facility deleted successfully.");
    } catch (error) {
      showBanner("error", error.message || "Failed to delete facility");
    }
  };
  const createFacility = async (event) => {
    event.preventDefault();

    const payload = {
      ...facilityForm,
      institution_id: facilityForm.institution_id || selectedInstitutionId,
      sub_county: customSubCounty.trim() || facilityForm.sub_county,
    };

    if (!payload.institution_id) {
      showBanner("error", "Select an institution before creating a facility.");
      return;
    }

    if (!payload.county) {
      showBanner("error", "Select a county.");
      return;
    }

    if (!payload.latitude || !payload.longitude) {
      showBanner("error", "Set the location using the map or place search.");
      return;
    }

    try {
      const res = await apiFetch(`${SECURITY_API}/facilities/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to create facility"));
      }

      const createdFacility = data?.facility || (data?.id ? data : null);
      if (createdFacility) {
        setFacilities((prev) => [createdFacility, ...prev].filter(Boolean));
      } else {
        await loadFacilities();
      }
      setFacilityForm((prev) => ({ ...defaultFacilityForm, institution_id: payload.institution_id }));
      setCustomSubCounty("");
      setPlaceQuery("");
      setPlaceSuggestions([]);
      showBanner("success", "Facility created successfully.");
    } catch (error) {
      showBanner("error", error.message || "Failed to create facility");
    }
  };

  const bannerStyle = {
    ...styles.banner,
    ...(banner.type === "success" ? styles.bannerSuccess : {}),
    ...(banner.type === "error" ? styles.bannerError : {}),
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <section
        style={{
          ...styles.hero,
          background: isDark
            ? "linear-gradient(135deg, #102a43 0%, #243b53 50%, #334e68 100%)"
            : "linear-gradient(135deg, #e6fffa 0%, #d9f99d 45%, #dcfce7 100%)",
          borderColor: theme.cardBorder,
        }}
      >
        <div>
          <p style={styles.heroTag}>Operations</p>
          <h1 style={{ ...styles.title, color: isDark ? "#f0f9ff" : "#14532d" }}>Facilities Control Room</h1>
          <p style={{ ...styles.subtitle, color: isDark ? "#dbeafe" : "#166534" }}>
            Create and maintain facility records with map-based location preview.
          </p>
        </div>
        <div style={styles.statsRow}>
          <article style={styles.statCard}>
            <span style={styles.statLabel}>Facilities</span>
            <span style={styles.statValue}>{facilities.length}</span>
          </article>
          <article style={styles.statCard}>
            <span style={styles.statLabel}>Active</span>
            <span style={styles.statValue}>{manageableCount}</span>
          </article>
          <article style={styles.statCard}>
            <span style={styles.statLabel}>Institutions</span>
            <span style={styles.statValue}>{institutions.length}</span>
          </article>
        </div>
      </section>

      {profile && (
        <div style={styles.modeInfo}>
          {isAdmin
            ? "Admin mode: full cross-institution visibility and management is enabled."
            : "User mode: you can manage facilities only where you are owner/admin."}
        </div>
      )}

      {banner.text && <div style={bannerStyle}>{banner.text}</div>}

      <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <h2 style={styles.cardTitle}>Create Facility</h2>
        <form onSubmit={createFacility} style={styles.form}>
          <label style={styles.label}>Institution</label>
          <select
            style={styles.input}
            value={facilityForm.institution_id}
            onChange={(event) => {
              const institutionId = event.target.value;
              setFacilityForm((prev) => ({ ...prev, institution_id: institutionId }));
              setSelectedInstitutionId(institutionId);
            }}
            required
          >
            <option value="">Select institution</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={String(institution.id)}>
                {institution.name}
              </option>
            ))}
          </select>

          <div style={styles.formContainer}>
            <div style={styles.formFields}>
              <label style={styles.label}>Facility Name</label>
              <input
                style={styles.input}
                placeholder="Example: Embakasi Police Station"
                value={facilityForm.name}
                onChange={(event) => setFacilityForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />

              <label style={styles.label}>Suggested Place Search</label>
              <div style={styles.autocompleteWrap}>
                <input
                  style={styles.input}
                  placeholder="Type place name, road, landmark..."
                  value={placeQuery}
                  onChange={(event) => setPlaceQuery(event.target.value)}
                  autoComplete="off"
                />
                {(placeLoading || placeSuggestions.length > 0) && (
                  <div style={styles.autocompleteList}>
                    {placeLoading && <div style={styles.autocompleteItemMuted}>Searching places...</div>}
                    {!placeLoading &&
                      placeSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.place_id}`}
                          type="button"
                          style={styles.autocompleteItem}
                          onClick={() => handlePlaceSuggestionSelect(suggestion)}
                        >
                          <span style={styles.autocompletePrimary}>{suggestion.description}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {placesError && <p style={styles.errorHint}>{placesError}</p>}

              <label style={styles.label}>Facility Type</label>
              <select
                style={styles.input}
                value={facilityForm.facility_type}
                onChange={(event) => setFacilityForm((prev) => ({ ...prev, facility_type: event.target.value }))}
                required
              >
                <option value="police_station">Police Station</option>
                <option value="police_post">Police Post</option>
                <option value="dci">DCI Office</option>
                <option value="administration">Administration Police</option>
                <option value="administration">Office(Institution Branch)</option>
              </select>

              <div style={styles.row}>
                <div>
                  <label style={styles.label}>County</label>
                  <select
                    style={styles.input}
                    value={facilityForm.county}
                    onChange={(event) => handleCountyChange(event.target.value)}
                    required
                  >
                    <option value="">Select county</option>
                    {counties.map((county) => (
                      <option key={county} value={county}>
                        {county}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Sub-county</label>
                  <select
                    style={styles.input}
                    value={facilityForm.sub_county}
                    onChange={(event) => setFacilityForm((prev) => ({ ...prev, sub_county: event.target.value }))}
                    disabled={!facilityForm.county}
                  >
                    <option value="">Select sub-county</option>
                    {subCountyOptions.map((subCounty) => (
                      <option key={subCounty} value={subCounty}>
                        {subCounty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={styles.label}>Custom Sub-county (Optional)</label>
              <input
                style={styles.input}
                placeholder="Use this if the sub-county is not in list"
                value={customSubCounty}
                onChange={(event) => setCustomSubCounty(event.target.value)}
              />

              <div style={{ ...styles.row, display: 'none' }}>
                <div>
                  <label style={styles.label}>Latitude</label>
                  <input
                    style={styles.input}
                    placeholder="-1.286389"
                    value={facilityForm.latitude}
                    onChange={(event) => setFacilityForm((prev) => ({ ...prev, latitude: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={styles.label}>Longitude</label>
                  <input
                    style={styles.input}
                    placeholder="36.817223"
                    value={facilityForm.longitude}
                    onChange={(event) => setFacilityForm((prev) => ({ ...prev, longitude: event.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            <div style={styles.mapSection}>
              <label style={styles.label}>Location Preview</label>
              <div style={{ ...styles.mapWrap, height: "400px" }}>
                <FacilityPreviewMap
                  ready={googleMapsReady}
                  center={previewCenter}
                  selectedPosition={selectedPosition}
                  onPick={setCoordinates}
                />
              </div>
              <p style={styles.mapHint}>Tip: click map to set precise coordinates.</p>
            </div>
          </div>

          <button type="submit" style={styles.primaryButton}>Save Facility</button>
        </form>
      </section>

      <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div style={styles.listHeader}>
          <h2 style={styles.cardTitle}>Registered Facilities</h2>
          <select
            style={{ ...styles.input, minWidth: "260px" }}
            value={selectedInstitutionId}
            onChange={(event) => setSelectedInstitutionId(event.target.value)}
          >
            {isAdmin && <option value="">All institutions</option>}
            {institutions.map((institution) => (
              <option key={institution.id} value={String(institution.id)}>
                {institution.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p style={styles.muted}>Loading facilities...</p>
        ) : filteredFacilities.length === 0 ? (
          <p style={styles.muted}>No facilities found for the selected scope.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>County</th>
                  <th style={styles.th}>Sub-county</th>
                  <th style={styles.th}>Coordinates</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map((facility) => (
                  <tr key={facility.id}>
                    <td style={styles.td}>{facility.name}</td>
                    <td style={styles.td}>{facility.facility_type}</td>
                    <td style={styles.td}>{facility.county}</td>
                    <td style={styles.td}>{facility.sub_county || "-"}</td>
                    <td style={styles.td}>{facility.latitude}, {facility.longitude}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.smallButton}
                        onClick={() => openFacilityMembers(facility)}
                      >
                        Members
                      </button>
                      <button
                        type="button"
                        style={styles.deleteButton}
                        onClick={() => deleteFacility(facility)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {facilityMemberFacility && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                Facility Members: {facilityMemberFacility.name}
              </h3>
              <button style={styles.modalClose} onClick={closeFacilityMembers}>&times;</button>
            </div>
            <div style={styles.modalBody}>
              {facilityMembersError && (
                <div style={styles.modalMessage}>{facilityMembersError}</div>
              )}
              <div style={styles.modalRow}>
                <label style={styles.modalLabel}>User ID</label>
                <input
                  style={styles.input}
                  value={facilityMemberUserId}
                  onChange={(event) => setFacilityMemberUserId(event.target.value)}
                  placeholder="User hash ID"
                />
              </div>
              <div style={styles.modalRow}>
                <label style={styles.modalLabel}>Role</label>
                <select
                  style={styles.input}
                  value={facilityMemberRole}
                  onChange={(event) => setFacilityMemberRole(event.target.value)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => loadFacilityMembers(facilityMemberFacility)}
                  disabled={facilityMembersLoading}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={addFacilityMember}
                  disabled={facilityMembersLoading}
                >
                  Add Member
                </button>
              </div>
              {facilityMemberMessage && (
                <div style={styles.modalMessage}>{facilityMemberMessage}</div>
              )}
              <div style={{ ...styles.tableWrap, marginTop: "12px" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>User</th>
                      <th style={styles.th}>Role</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilityMembersLoading ? (
                      <tr>
                        <td style={styles.td} colSpan={3}>Loading...</td>
                      </tr>
                    ) : facilityMembers.length === 0 ? (
                      <tr>
                        <td style={styles.td} colSpan={3}>No members yet.</td>
                      </tr>
                    ) : (
                      facilityMembers.map((member) => (
                        <tr key={member.user_id}>
                          <td style={styles.td}>{member.username || member.user_id}</td>
                          <td style={styles.td}>{member.role}</td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={styles.deleteButton}
                              onClick={() => removeFacilityMember(member)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
    gap: "16px",
  },
  hero: {
    border: "1px solid #cbd5e1",
    borderRadius: "18px",
    padding: "20px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  heroTag: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0",
    fontSize: "30px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    fontSize: "14px",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(95px, 130px))",
    gap: "10px",
  },
  statCard: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    borderRadius: "12px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#334155",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#0f172a",
  },
  modeInfo: {
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
  },
  banner: {
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid transparent",
  },
  bannerSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#86efac",
    color: "#166534",
  },
  bannerError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    color: "#991b1b",
  },
  mapHint: {
    fontSize: "12px",
    color: "#64748b",
    margin: "6px 0 0",
    fontWeight: 600,
  },
  mapWrap: {
    height: "420px",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid #cbd5e1",
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
    fontSize: "13px",
  },
  card: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "16px",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
    color: "#0f5132",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  formContainer: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  formFields: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  mapSection: {
    flex: 1,
    minWidth: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#334155",
    marginTop: "4px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  autocompleteWrap: {
    position: "relative",
  },
  autocompleteList: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    maxHeight: "220px",
    overflowY: "auto",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    backgroundColor: "#ffffff",
    zIndex: 30,
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.12)",
  },
  autocompleteItem: {
    border: "none",
    background: "transparent",
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
  },
  autocompleteItemMuted: {
    padding: "10px 12px",
    color: "#64748b",
    fontSize: "13px",
  },
  autocompletePrimary: {
    fontSize: "13px",
    color: "#0f172a",
    lineHeight: 1.35,
  },
  errorHint: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#b91c1c",
  },
  primaryButton: {
    marginTop: "10px",
    border: "none",
    borderRadius: "10px",
    padding: "11px 14px",
    background: "linear-gradient(120deg, #166534 0%, #15803d 100%)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    borderRadius: "10px",
    padding: "10px 12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  smallButton: {
    border: "1px solid #d1fae5",
    backgroundColor: "#ecfdf5",
    color: "#065f46",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    marginRight: "8px",
  },
  deleteButton: {
    border: "1px solid #fecaca",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  listHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "10px",
    border: "1px solid #dcfce7",
    marginTop: "10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "680px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#166534",
    backgroundColor: "#f0fdf4",
  },
  td: {
    padding: "10px 12px",
    fontSize: "13px",
    color: "#334155",
    borderTop: "1px solid #ecfdf5",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: "16px",
  },
  modalCard: {
    width: "min(720px, 95vw)",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0",
  },
  modalTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
  },
  modalClose: {
    border: "none",
    background: "transparent",
    fontSize: "20px",
    cursor: "pointer",
    color: "#64748b",
  },
  modalBody: {
    padding: "16px 20px",
  },
  modalRow: {
    display: "grid",
    gap: "8px",
    marginBottom: "12px",
  },
  modalLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#64748b",
    fontWeight: 700,
  },
  modalMessage: {
    marginTop: "10px",
    fontSize: "13px",
    color: "#0f172a",
  },
  modalActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "6px",
  },};

export default FacilitiesPage;



































