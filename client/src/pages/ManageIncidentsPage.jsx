import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColorMode } from "../utils/useColorMode";
import { apiFetch } from "../utils/apiFetch";
import {
  ACCOUNTS_API_BASE as ACCOUNTS_API,
  INCIDENTS_API_BASE as INCIDENTS_API,
  SECURITY_API_BASE as SECURITY_API,
} from "../utils/apiBase";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const INCIDENT_TYPES = [
  { value: "", label: "All types" },
  { value: "robbery", label: "Robbery" },
  { value: "assault", label: "Assault" },
  { value: "accident", label: "Accident" },
  { value: "missing_person", label: "Missing Person" },
  { value: "murder", label: "Murder" },
  { value: "theft", label: "Theft" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const defaultUpdateForm = {
  status: "open",
  note: "",
  action_taken: "",
  assigned_to_name: "",
  next_step: "",
  due_at: "",
};

const toDateTimeLocalValue = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const parseCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const ResponseDirectionsMap = ({ ready, origin, destination, onRouteComputed }) => {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!ready || !window.google?.maps || !hostRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(hostRef.current, {
        center: destination || origin || { lat: -1.286389, lng: 36.817223 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#0f766e",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
    }
  }, [ready, destination, origin]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }
    window.google.maps.event.trigger(mapRef.current, "resize");
    if (destination) {
      mapRef.current.panTo(destination);
    } else if (origin) {
      mapRef.current.panTo(origin);
    }
  }, [destination, origin, ready]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    if (origin) {
      const originMarker = new window.google.maps.Marker({
        map: mapRef.current,
        position: origin,
        label: "A",
        title: "Response origin",
      });
      markersRef.current.push(originMarker);
      bounds.extend(origin);
    }
    if (destination) {
      const destinationMarker = new window.google.maps.Marker({
        map: mapRef.current,
        position: destination,
        label: "B",
        title: "Incident location",
      });
      markersRef.current.push(destinationMarker);
      bounds.extend(destination);
    }

    if (!origin || !destination || !directionsServiceRef.current || !directionsRendererRef.current) {
      directionsRendererRef.current?.setDirections({ routes: [] });
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, 40);
      }
      onRouteComputed(null);
      return;
    }

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          directionsRendererRef.current.setDirections(result);
          const leg = result.routes?.[0]?.legs?.[0];
          onRouteComputed(
            leg
              ? {
                  distanceText: leg.distance?.text || "",
                  durationText: leg.duration?.text || "",
                }
              : null
          );
        } else {
          directionsRendererRef.current.setDirections({ routes: [] });
          if (!bounds.isEmpty()) {
            mapRef.current.fitBounds(bounds, 40);
          }
          onRouteComputed(null);
        }
      }
    );
  }, [destination, onRouteComputed, origin]);

  if (!ready) {
    return <div style={styles.responseMapPlaceholder}>Route preview will appear once Google Maps loads.</div>;
  }

  return <div ref={hostRef} style={styles.responseMap} />;
};

const ManageIncidentsPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [institutions, setInstitutions] = useState([]);
  const [updateForm, setUpdateForm] = useState(defaultUpdateForm);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateSaving, setUpdateSaving] = useState(false);
  const [shareForm, setShareForm] = useState({ institutionId: "", accessLevel: "contributor" });
  const [shareMessage, setShareMessage] = useState("");
  const [shareSaving, setShareSaving] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [routeSummary, setRouteSummary] = useState(null);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [newsQuery, setNewsQuery] = useState("");
  const [newsLinks, setNewsLinks] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMessage, setNewsMessage] = useState("");
  const [newsReloadToken, setNewsReloadToken] = useState(0);
  const incidentParamHandledRef = useRef(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

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

  const showBanner = (type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner({ type: "", text: "" }), 3500);
  };

  const replaceIncidentInState = (incidentId, nextIncident) => {
    setIncidents((prev) => prev.map((item) => (item.id === incidentId ? { ...item, ...nextIncident } : item)));
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
      setSelectedFacilityId((prev) => (prev ? String(prev) : String(list[0].id)));
    }
  };

  const loadInstitutions = async () => {
    const res = await apiFetch(`${ACCOUNTS_API}/institutions/`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(data, "Failed to load institutions"));
    }

    const list = Array.isArray(data?.institutions) ? data.institutions.filter(Boolean) : [];
    setInstitutions(list);
    return list;
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
    return list;
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const user = await loadProfile();
        await Promise.all([loadFacilities(user), loadIncidents(), loadInstitutions()]);
        showBanner("success", "Incident manager ready.");
      } catch (error) {
        showBanner("error", error.message || "Failed to load incident manager");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const sortedIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const left = new Date(b?.occurred_at || 0).getTime();
      const right = new Date(a?.occurred_at || 0).getTime();
      return left - right;
    });
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return sortedIncidents.filter((incident) => {
      const facilityId = incident.facility_id ?? incident.facility ?? "";
      const status = incident.follow_up_status || "open";
      const haystack = [
        incident.ob_number,
        incident.description,
        incident.incident_type,
        incident.facility_name,
        incident.facility,
        incident.follow_up_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (selectedFacilityId && String(facilityId) !== String(selectedFacilityId)) {
        return false;
      }

      if (statusFilter && status !== statusFilter) {
        return false;
      }

      if (typeFilter && incident.incident_type !== typeFilter) {
        return false;
      }

      if (query && !haystack.includes(query)) {
        return false;
      }

      return true;
    });
  }, [searchTerm, selectedFacilityId, sortedIncidents, statusFilter, typeFilter]);

  useEffect(() => {
    if (!filteredIncidents.length) {
      setSelectedIncidentId("");
      return;
    }

    if (selectedIncidentId && filteredIncidents.some((incident) => String(incident.id) === String(selectedIncidentId))) {
      return;
    }

    setSelectedIncidentId(String(filteredIncidents[0].id));
  }, [filteredIncidents, selectedIncidentId]);

  useEffect(() => {
    if (incidentParamHandledRef.current || incidents.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const incidentId = params.get("incident");
    if (!incidentId) {
      return;
    }

    const match = incidents.find((item) => String(item.id) === String(incidentId));
    if (match) {
      incidentParamHandledRef.current = true;
      setSelectedIncidentId(String(match.id));
    }
  }, [incidents]);

  const selectedIncident = useMemo(() => {
    return filteredIncidents.find((incident) => String(incident.id) === String(selectedIncidentId)) || null;
  }, [filteredIncidents, selectedIncidentId]);

  const selectedFacility = useMemo(() => {
    if (!selectedIncident) {
      return null;
    }
    return (
      facilities.find((facility) => String(facility.id) === String(selectedIncident.facility_id ?? selectedIncident.facility)) || null
    );
  }, [facilities, selectedIncident]);

  const responseOrigin = useMemo(() => {
    if (!selectedFacility) {
      return null;
    }
    const lat = parseCoord(selectedFacility.latitude);
    const lng = parseCoord(selectedFacility.longitude);
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng };
  }, [selectedFacility]);

  const responseDestination = useMemo(() => {
    if (!selectedIncident) {
      return null;
    }
    const lat = parseCoord(selectedIncident.latitude);
    const lng = parseCoord(selectedIncident.longitude);
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng };
  }, [selectedIncident]);

  const openDirectionsUrl = useMemo(() => {
    if (!responseDestination) {
      return "";
    }
    const destination = `${responseDestination.lat},${responseDestination.lng}`;
    const origin = responseOrigin ? `${responseOrigin.lat},${responseOrigin.lng}` : "";
    const params = new URLSearchParams({
      api: "1",
      destination,
      travelmode: "driving",
    });
    if (origin) {
      params.set("origin", origin);
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [responseDestination, responseOrigin]);

  useEffect(() => {
    if (!selectedIncident) {
      setUpdateForm(defaultUpdateForm);
      setUpdateMessage("");
      return;
    }

    const latestUpdate = Array.isArray(selectedIncident.updates) ? selectedIncident.updates[0] : null;
    setUpdateForm({
      status: selectedIncident.follow_up_status || "open",
      note: "",
      action_taken: "",
      assigned_to_name: latestUpdate?.assigned_to_name || "",
      next_step: "",
      due_at: latestUpdate?.due_at ? toDateTimeLocalValue(latestUpdate.due_at) : "",
    });
    setUpdateMessage("");
  }, [selectedIncident]);

  useEffect(() => {
    if (!selectedIncident) {
      setShareForm({ institutionId: "", accessLevel: "contributor" });
      setShareMessage("");
      setCommentBody("");
      setCommentMessage("");
      setNewsQuery("");
      setNewsLinks([]);
      setNewsMessage("");
      return;
    }

    setShareMessage("");
    setCommentMessage("");
  }, [selectedIncident]);

  useEffect(() => {
    if (!selectedIncident) {
      return;
    }

    const loadNewsLinks = async () => {
      setNewsLoading(true);
      setNewsMessage("");
      try {
        const res = await apiFetch(`${INCIDENTS_API}/${selectedIncident.id}/news-links/`, {
          method: "POST",
          headers,
          body: JSON.stringify({ limit: 5 }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(getErrorMessage(data, "Failed to load related news"));
        }
        setNewsQuery(data.query || "");
        setNewsLinks(Array.isArray(data.articles) ? data.articles : []);
        if (!Array.isArray(data.articles) || data.articles.length === 0) {
          setNewsMessage("No matching published news links found for this incident yet.");
        }
      } catch (error) {
        setNewsQuery("");
        setNewsLinks([]);
        setNewsMessage(error.message || "Failed to load related news");
      } finally {
        setNewsLoading(false);
      }
    };

    loadNewsLinks();
  }, [headers, newsReloadToken, selectedIncident]);

  const incidentInstitutionIds = useMemo(() => {
    if (!selectedIncident) {
      return new Set();
    }

    const ids = new Set();
    if (selectedIncident.institution_hash) {
      ids.add(String(selectedIncident.institution_hash));
    }
    (selectedIncident.collaboration || []).forEach((entry) => {
      if (entry?.institution_id) {
        ids.add(String(entry.institution_id));
      }
    });
    return ids;
  }, [selectedIncident]);

  const shareableInstitutions = useMemo(() => {
    return institutions.filter((institution) => !incidentInstitutionIds.has(String(institution.id)));
  }, [incidentInstitutionIds, institutions]);

  const stats = useMemo(() => {
    const total = filteredIncidents.length;
    const open = filteredIncidents.filter((incident) => (incident.follow_up_status || "open") === "open").length;
    const inProgress = filteredIncidents.filter((incident) => incident.follow_up_status === "in_progress").length;
    const resolved = filteredIncidents.filter((incident) => incident.follow_up_status === "resolved").length;

    return [
      { label: "Visible incidents", value: total, note: "Current filtered queue" },
      { label: "Open", value: open, note: "Awaiting action" },
      { label: "In progress", value: inProgress, note: "Active follow-up" },
      { label: "Resolved", value: resolved, note: "Closed out" },
    ];
  }, [filteredIncidents]);

  const saveUpdate = async () => {
    if (!selectedIncident) {
      return;
    }

    setUpdateSaving(true);
    setUpdateMessage("Saving...");
    try {
      const res = await apiFetch(`${INCIDENTS_API}/${selectedIncident.id}/updates/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...updateForm,
          due_at: updateForm.due_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save incident update");
      }

      replaceIncidentInState(selectedIncident.id, data);
      setUpdateForm((prev) => ({
        ...prev,
        note: "",
        action_taken: "",
        next_step: "",
      }));
      setUpdateMessage("Incident update saved.");
      showBanner("success", `Updated ${selectedIncident.ob_number}.`);
    } catch (error) {
      setUpdateMessage(error.message || "Failed to save");
    } finally {
      setUpdateSaving(false);
    }
  };

  const shareIncident = async () => {
    if (!selectedIncident || !shareForm.institutionId) {
      setShareMessage("Choose an institution first.");
      return;
    }

    setShareSaving(true);
    setShareMessage("Sharing incident...");
    try {
      const res = await apiFetch(`${INCIDENTS_API}/${selectedIncident.id}/collaborators/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          institution_id: shareForm.institutionId,
          access_level: shareForm.accessLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to share incident"));
      }

      replaceIncidentInState(selectedIncident.id, data);
      setShareForm({ institutionId: "", accessLevel: shareForm.accessLevel });
      setShareMessage("Institution added to the incident.");
      showBanner("success", `Shared ${selectedIncident.ob_number} for collaboration.`);
    } catch (error) {
      setShareMessage(error.message || "Failed to share incident");
    } finally {
      setShareSaving(false);
    }
  };

  const saveComment = async () => {
    if (!selectedIncident || !commentBody.trim()) {
      setCommentMessage("Add a note before saving.");
      return;
    }

    setCommentSaving(true);
    setCommentMessage("Saving collaboration note...");
    try {
      const res = await apiFetch(`${INCIDENTS_API}/${selectedIncident.id}/comments/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to save collaboration note"));
      }

      replaceIncidentInState(selectedIncident.id, data);
      setCommentBody("");
      setCommentMessage("Collaboration note saved.");
      showBanner("success", `Added a note to ${selectedIncident.ob_number}.`);
    } catch (error) {
      setCommentMessage(error.message || "Failed to save collaboration note");
    } finally {
      setCommentSaving(false);
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
          <h1 style={{ ...styles.title, color: theme.text }}>Incident Manager</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Work through the full incident queue with filters, structured updates, and a full activity trail.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={() => (window.location.href = "/incidents/area-intelligence")}>
            Open area intelligence
          </button>
          <button type="button" style={styles.secondaryButton} onClick={() => (window.location.href = "/incidents")}>
            Back to overview
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

      <section style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <div>
            <label style={styles.label}>Facility</label>
            <select style={styles.input} value={selectedFacilityId} onChange={(event) => setSelectedFacilityId(event.target.value)}>
              {profile?.is_staff && <option value="">All facilities</option>}
              {!profile?.is_staff && facilities.length === 0 && <option value="">No facility</option>}
              {facilities.map((facility) => (
                <option key={facility.id} value={String(facility.id)}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Search</label>
            <input
              style={styles.input}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="OB number, description, facility"
            />
          </div>

          <div>
            <label style={styles.label}>Type</label>
            <select style={styles.input} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {INCIDENT_TYPES.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Status</label>
            <select style={styles.input} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section style={styles.workspaceGrid}>
        <div style={styles.tableCard}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.cardTitle}>Incident Queue</h2>
              <p style={styles.hint}>Select a row to review and update the case.</p>
            </div>
            <div style={styles.queueActions}>
              <div style={styles.queueCount}>{loading ? "Loading..." : `${filteredIncidents.length} incidents`}</div>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setQueueCollapsed((prev) => !prev)}
              >
                {queueCollapsed ? "Expand queue" : "Collapse queue"}
              </button>
            </div>
          </div>

          {queueCollapsed && selectedIncident ? (
            <div style={styles.queueSummary}>
              <strong>{selectedIncident.ob_number}</strong>
              <span>{selectedIncident.incident_type}</span>
              <span>{selectedIncident.facility_name || selectedIncident.facility || "No facility"}</span>
              <span>{formatStatus(selectedIncident.follow_up_status || "open")}</span>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <p style={styles.muted}>No incidents match the current filters.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>OB</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Facility</th>
                    <th style={styles.th}>Occurred</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((incident) => {
                    const active = String(incident.id) === String(selectedIncidentId);
                    return (
                      <tr
                        key={incident.id}
                        style={active ? styles.activeRow : undefined}
                        onClick={() => {
                          setSelectedIncidentId(String(incident.id));
                          setQueueCollapsed(true);
                        }}
                      >
                        <td style={styles.tdStrong}>{incident.ob_number}</td>
                        <td style={styles.td}>{incident.incident_type}</td>
                        <td style={styles.td}>{incident.facility_name || incident.facility || "-"}</td>
                        <td style={styles.td}>{incident.occurred_at || "-"}</td>
                        <td style={styles.td}>
                          <span style={statusBadgeStyle(incident.follow_up_status || "open")}>
                            {formatStatus(incident.follow_up_status || "open")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section style={styles.detailCard}>
          {!selectedIncident ? (
            <div style={styles.emptyState}>
              <h3 style={styles.emptyTitle}>No incident selected</h3>
              <p style={styles.muted}>Choose an incident from the queue to review its follow-up history and update status.</p>
            </div>
          ) : (
            <>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.cardTitle}>Case Detail</h2>
                  <p style={styles.hint}>Anchor every action to the official OB reference.</p>
                </div>
                <span style={statusBadgeStyle(selectedIncident.follow_up_status || "open")}>
                  {formatStatus(selectedIncident.follow_up_status || "open")}
                </span>
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>OB Number</span>
                  <span style={styles.detailValue}>{selectedIncident.ob_number || "-"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Type</span>
                  <span style={styles.detailValue}>{selectedIncident.incident_type || "-"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Facility</span>
                  <span style={styles.detailValue}>{selectedIncident.facility_name || selectedIncident.facility || "-"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Occurred</span>
                  <span style={styles.detailValue}>{selectedIncident.occurred_at || "-"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Last Updated By</span>
                  <span style={styles.detailValue}>{selectedIncident.follow_up_by_name || "No updates yet"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Last Updated At</span>
                  <span style={styles.detailValue}>{formatDateTime(selectedIncident.follow_up_at)}</span>
                </div>
              </div>

              <div style={styles.descriptionCard}>
                <div style={styles.detailLabel}>Description</div>
                <p style={styles.descriptionText}>{selectedIncident.description || "No description captured."}</p>
              </div>

              <div style={styles.newsCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.timelineTitle}>AI News Leads</h3>
                    <p style={styles.hint}>Published news links can help investigators connect this case to external reporting.</p>
                  </div>
                  <button type="button" style={styles.secondaryButton} onClick={() => setNewsReloadToken((prev) => prev + 1)} disabled={newsLoading}>
                    {newsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                {newsQuery ? <div style={styles.newsQuery}>Query: {newsQuery}</div> : null}
                {newsMessage ? <p style={styles.muted}>{newsMessage}</p> : null}
                {newsLinks.length > 0 ? (
                  <div style={styles.timelineList}>
                    {newsLinks.map((item) => (
                      <article key={item.link} style={styles.timelineEntry}>
                        <div style={styles.timelineTop}>
                          <span style={styles.timelinePill}>{item.matching_signal || "Lead"}</span>
                          <span style={styles.timelineMeta}>{item.source || "News"} | {formatDateTime(item.published_at)}</span>
                        </div>
                        <a href={item.link} target="_blank" rel="noreferrer" style={styles.newsLink}>
                          {item.title}
                        </a>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={styles.collaborationCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.timelineTitle}>Institution Collaboration</h3>
                    <p style={styles.hint}>Share the case with partner institutions and keep ownership visible.</p>
                  </div>
                </div>

                <div style={styles.collaborationList}>
                  <div style={styles.collaborationChip}>
                    <span style={styles.collaborationName}>Owning institution</span>
                    <span style={styles.collaborationMeta}>
                      {selectedIncident.institution_name || "Linked through facility"}
                    </span>
                  </div>
                  {(selectedIncident.collaboration || []).map((entry) => (
                    <div key={entry.id} style={styles.collaborationChip}>
                      <span style={styles.collaborationName}>{entry.institution_name}</span>
                      <span style={styles.collaborationMeta}>
                        {formatAccessLevel(entry.access_level)} | shared by {entry.shared_by_name || "Unknown user"}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={styles.inlineGrid}>
                  <div>
                    <label style={styles.label}>Add institution</label>
                    <select
                      style={styles.input}
                      value={shareForm.institutionId}
                      onChange={(event) => setShareForm((prev) => ({ ...prev, institutionId: event.target.value }))}
                    >
                      <option value="">Select institution</option>
                      {shareableInstitutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Access level</label>
                    <select
                      style={styles.input}
                      value={shareForm.accessLevel}
                      onChange={(event) => setShareForm((prev) => ({ ...prev, accessLevel: event.target.value }))}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="contributor">Contributor</option>
                      <option value="lead">Lead</option>
                    </select>
                  </div>
                </div>
                {shareMessage && <div style={styles.message}>{shareMessage}</div>}
                <div style={styles.actionRow}>
                  <div />
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={shareIncident}
                    disabled={shareSaving || shareableInstitutions.length === 0}
                  >
                    {shareSaving ? "Sharing..." : "Share incident"}
                  </button>
                </div>
              </div>

              <div style={styles.responseCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.timelineTitle}>Response</h3>
                    <p style={styles.hint}>Keep the queue visible while giving responders a quick route to the scene.</p>
                  </div>
                </div>
                <div style={styles.responseMetaGrid}>
                  <div style={styles.responseMetaItem}>
                    <span style={styles.detailLabel}>Response Origin</span>
                    <span style={styles.detailValue}>{selectedFacility?.name || "No facility linked"}</span>
                  </div>
                  <div style={styles.responseMetaItem}>
                    <span style={styles.detailLabel}>Route Distance</span>
                    <span style={styles.detailValue}>{routeSummary?.distanceText || "Not available"}</span>
                  </div>
                  <div style={styles.responseMetaItem}>
                    <span style={styles.detailLabel}>Estimated Time</span>
                    <span style={styles.detailValue}>{routeSummary?.durationText || "Not available"}</span>
                  </div>
                </div>
                <div style={styles.responseMapWrap}>
                  <ResponseDirectionsMap
                    ready={googleMapsReady}
                    origin={responseOrigin}
                    destination={responseDestination}
                    onRouteComputed={setRouteSummary}
                  />
                </div>
                <div style={styles.actionRow}>
                  <button type="button" style={styles.secondaryButton} onClick={() => (window.location.href = "/facilities/map")}>
                    Open map
                  </button>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => {
                      if (openDirectionsUrl) {
                        window.open(openDirectionsUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    disabled={!openDirectionsUrl}
                  >
                    Open directions
                  </button>
                </div>
              </div>

              <div style={styles.formBlock}>
                <div>
                  <label style={styles.label}>Collaboration note</label>
                  <textarea
                    style={styles.textarea}
                    rows={4}
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder="Capture what your institution did, decided, or needs from partners."
                  />
                </div>
                {commentMessage && <div style={styles.message}>{commentMessage}</div>}
                <div style={styles.actionRow}>
                  <div />
                  <button type="button" style={styles.secondaryButton} onClick={saveComment} disabled={commentSaving}>
                    {commentSaving ? "Saving..." : "Save collaboration note"}
                  </button>
                </div>
              </div>

              <div style={styles.timelineCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.timelineTitle}>Collaboration Notes</h3>
                    <p style={styles.hint}>Separate case notes keep discussion visible without overwriting updates.</p>
                  </div>
                </div>

                {(selectedIncident.comments || []).length === 0 ? (
                  <p style={styles.muted}>No collaboration notes yet.</p>
                ) : (
                  <div style={styles.timelineList}>
                    {selectedIncident.comments.map((comment) => (
                      <article key={comment.id} style={styles.timelineEntry}>
                        <div style={styles.timelineTop}>
                          <span style={styles.timelinePill}>Comment</span>
                          <span style={styles.timelineMeta}>
                            {comment.created_by_name || "Unknown user"} | {formatActorContext(comment)} | {formatDateTime(comment.created_at)}
                          </span>
                        </div>
                        <p style={styles.timelineText}>{comment.body}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div style={styles.formBlock}>
                <div>
                  <label style={styles.label}>Update status</label>
                  <select
                    style={styles.input}
                    value={updateForm.status}
                    onChange={(event) => setUpdateForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>What changed</label>
                  <textarea
                    style={styles.textarea}
                    rows={4}
                    value={updateForm.note}
                    onChange={(event) => setUpdateForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Summarize the latest case movement or decision."
                  />
                </div>
                <div>
                  <label style={styles.label}>Action taken</label>
                  <textarea
                    style={styles.textarea}
                    rows={4}
                    value={updateForm.action_taken}
                    onChange={(event) => setUpdateForm((prev) => ({ ...prev, action_taken: event.target.value }))}
                    placeholder="Interviews done, referral sent, evidence collected, call placed, etc."
                  />
                </div>
                <div style={styles.inlineGrid}>
                  <div>
                    <label style={styles.label}>Assigned to</label>
                    <input
                      style={styles.input}
                      value={updateForm.assigned_to_name}
                      onChange={(event) => setUpdateForm((prev) => ({ ...prev, assigned_to_name: event.target.value }))}
                      placeholder="Officer, team, or department"
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Next action due</label>
                    <input
                      style={styles.input}
                      type="datetime-local"
                      value={updateForm.due_at}
                      onChange={(event) => setUpdateForm((prev) => ({ ...prev, due_at: event.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label style={styles.label}>Next step</label>
                  <textarea
                    style={styles.textarea}
                    rows={3}
                    value={updateForm.next_step}
                    onChange={(event) => setUpdateForm((prev) => ({ ...prev, next_step: event.target.value }))}
                    placeholder="What should happen next, and what are we waiting on?"
                  />
                </div>
                {updateMessage && <div style={styles.message}>{updateMessage}</div>}
                <div style={styles.actionRow}>
                  <div />
                  <button type="button" style={styles.primaryButton} onClick={saveUpdate} disabled={updateSaving}>
                    {updateSaving ? "Saving..." : "Save update"}
                  </button>
                </div>
              </div>

              <div style={styles.timelineCard}>
                <div style={styles.sectionHead}>
                  <div>
                    <h3 style={styles.timelineTitle}>Collaboration Timeline</h3>
                    <p style={styles.hint}>This audit trail shows who changed, commented on, or shared the incident.</p>
                  </div>
                </div>

                {(selectedIncident.activity || []).length === 0 ? (
                  <p style={styles.muted}>No collaboration activity yet.</p>
                ) : (
                  <div style={styles.timelineList}>
                    {selectedIncident.activity.map((entry) => (
                      <article key={entry.id} style={styles.timelineEntry}>
                        <div style={styles.timelineTop}>
                          <span style={styles.timelinePill}>{formatActivityLabel(entry.action_type)}</span>
                          <span style={styles.timelineMeta}>
                            {entry.actor_name || "Unknown user"} | {formatActorContext(entry)} | {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                        <p style={styles.timelineText}>{entry.summary}</p>
                        {entry.metadata?.note && <p style={styles.timelineText}><strong>Note:</strong> {entry.metadata.note}</p>}
                        {entry.metadata?.body && <p style={styles.timelineText}><strong>Comment:</strong> {entry.metadata.body}</p>}
                        {entry.metadata?.action_taken && <p style={styles.timelineText}><strong>Action:</strong> {entry.metadata.action_taken}</p>}
                        {entry.metadata?.assigned_to_name && <p style={styles.timelineText}><strong>Assigned to:</strong> {entry.metadata.assigned_to_name}</p>}
                        {entry.metadata?.next_step && <p style={styles.timelineText}><strong>Next step:</strong> {entry.metadata.next_step}</p>}
                        {entry.metadata?.due_at && <p style={styles.timelineText}><strong>Due:</strong> {formatDateTime(entry.metadata.due_at)}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </div>
  );
};

const formatAccessLevel = (value) => {
  if (value === "lead") {
    return "Lead";
  }
  if (value === "viewer") {
    return "Viewer";
  }
  return "Contributor";
};

const formatActivityLabel = (value) => {
  if (value === "institution_shared") {
    return "Shared";
  }
  if (value === "comment_added") {
    return "Comment";
  }
  if (value === "follow_up_changed") {
    return "Follow-up";
  }
  if (value === "location_updated") {
    return "Map";
  }
  return "Update";
};

const formatActorContext = (entry) => {
  const parts = [entry.actor_institution_name, entry.actor_facility_name].filter(Boolean);
  return parts.join(" / ") || "Institution not captured";
};

const formatStatus = (value) => {
  if (value === "in_progress") {
    return "In Progress";
  }
  if (value === "resolved") {
    return "Resolved";
  }
  return "Open";
};

const statusBadgeStyle = (value) => {
  const palette =
    value === "resolved"
      ? { bg: "#dcfce7", text: "#166534", border: "#86efac" }
      : value === "in_progress"
        ? { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" }
        : { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    backgroundColor: palette.bg,
    color: palette.text,
    border: `1px solid ${palette.border}`,
  };
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
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 700,
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: "14px",
    maxWidth: "720px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
  },
  banner: {
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 500,
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
  filterCard: {
    borderRadius: "14px",
    padding: "18px",
    backgroundColor: "#ffffff",
    border: "1px solid #dbeafe",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  workspaceGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
  },
  tableCard: {
    borderRadius: "14px",
    padding: "18px",
    backgroundColor: "#ffffff",
    border: "1px solid #dbeafe",
  },
  detailCard: {
    borderRadius: "14px",
    padding: "18px",
    backgroundColor: "#ffffff",
    border: "1px solid #dbeafe",
    display: "grid",
    gap: "16px",
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#0f5132",
  },
  hint: {
    margin: "6px 0 0",
    fontSize: "12px",
    color: "#64748b",
  },
  queueCount: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "6px 10px",
  },
  queueActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  queueSummary: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #dbeafe",
    backgroundColor: "#f0fdf4",
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: 600,
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
    fontWeight: 700,
    color: "#475569",
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    cursor: "pointer",
  },
  tdStrong: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  activeRow: {
    backgroundColor: "#f0fdf4",
  },
  emptyState: {
    display: "grid",
    gap: "8px",
  },
  emptyTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#0f172a",
  },
  muted: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  detailItem: {
    display: "grid",
    gap: "4px",
  },
  detailLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  detailValue: {
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: 600,
  },
  descriptionCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px",
    backgroundColor: "#f8fafc",
    marginBottom: "16px",
  },
  newsCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px",
    backgroundColor: "#f8fafc",
    marginBottom: "16px",
    display: "grid",
    gap: "12px",
  },
  newsQuery: {
    fontSize: "12px",
    color: "#475569",
    fontWeight: 600,
  },
  newsLink: {
    color: "#0f766e",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
  },
  descriptionText: {
    margin: "8px 0 0",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#0f172a",
  },
  collaborationCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px",
    backgroundColor: "#f8fafc",
    marginBottom: "16px",
    display: "grid",
    gap: "12px",
  },
  collaborationList: {
    display: "grid",
    gap: "10px",
  },
  collaborationChip: {
    display: "grid",
    gap: "4px",
    borderRadius: "12px",
    padding: "12px",
    backgroundColor: "#ffffff",
    border: "1px solid #dbeafe",
  },
  collaborationName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#0f172a",
  },
  collaborationMeta: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 600,
  },
  responseCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px",
    backgroundColor: "#f8fafc",
    marginBottom: "16px",
  },
  responseMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
    marginBottom: "12px",
  },
  responseMetaItem: {
    display: "grid",
    gap: "4px",
  },
  responseMapWrap: {
    border: "1px solid #dbeafe",
    borderRadius: "12px",
    overflow: "hidden",
    height: "220px",
    backgroundColor: "#fff",
    marginBottom: "12px",
  },
  responseMap: {
    width: "100%",
    height: "100%",
  },
  responseMapPlaceholder: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
    padding: "12px",
  },
  formBlock: {
    display: "grid",
    gap: "12px",
  },
  inlineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
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
    backgroundColor: "#fff",
  },
  textarea: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
  },
  message: {
    fontSize: "12px",
    color: "#475569",
  },
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "11px 14px",
    background: "linear-gradient(120deg, #0f766e 0%, #0d9488 100%)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "11px 14px",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  },
  timelineCard: {
    marginTop: "18px",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "18px",
  },
  timelineTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#0f172a",
  },
  timelineList: {
    display: "grid",
    gap: "12px",
  },
  timelineEntry: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "12px 14px",
    backgroundColor: "#f8fafc",
  },
  timelineTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  timelineMeta: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 600,
  },
  timelinePill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    backgroundColor: "#ecfeff",
    color: "#155e75",
    border: "1px solid #a5f3fc",
  },
  timelineText: {
    margin: "6px 0 0",
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#0f172a",
  },
};

export default ManageIncidentsPage;
