import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getFrontendSettings } from "../utils/frontendSettings";

const API_BASE = "http://127.0.0.1:8000/api/accounts";

const InstitutionsPage = () => {
  const token = localStorage.getItem("access_token");

  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [members, setMembers] = useState([]);
  const [showInstitutionIds, setShowInstitutionIds] = useState(
    getFrontendSettings().showInstitutionIds
  );

  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "member" });

  const [status, setStatus] = useState("idle");
  const [detailStatus, setDetailStatus] = useState("idle");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  useEffect(() => {
    const onSettingsChange = () => {
      setShowInstitutionIds(getFrontendSettings().showInstitutionIds);
    };
    window.addEventListener("frontend-settings-changed", onSettingsChange);
    return () => {
      window.removeEventListener("frontend-settings-changed", onSettingsChange);
    };
  }, []);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const showAlert = (message, type = "info") => {
    setAlert({ show: true, type, message });
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setAlert({ show: false, type: "", message: "" });
    }, 5000);
  };

  const fetchInstitutionDetail = useCallback(
    async (institutionId) => {
      if (!institutionId) {
        setSelectedInstitution(null);
        setMembers([]);
        return;
      }

      setDetailStatus("loading");
      try {
        const [detailRes, membersRes] = await Promise.all([
          fetch(`${API_BASE}/institutions/${institutionId}/`, {
            method: "GET",
            headers,
          }),
          fetch(`${API_BASE}/institutions/${institutionId}/members/list/`, {
            method: "GET",
            headers,
          }),
        ]);

        const detailData = await detailRes.json();
        if (!detailRes.ok) {
          throw new Error(detailData.error || "Failed to load institution");
        }
        setSelectedInstitution(detailData.institution);

        const membersData = await membersRes.json();
        if (!membersRes.ok) {
          throw new Error(membersData.error || "Failed to load members");
        }
        setMembers(membersData.members || []);
        setDetailStatus("success");
      } catch (error) {
        setDetailStatus("error");
        showAlert(error.message || "Failed to load institution data", "error");
      }
    },
    [headers]
  );

  const fetchInstitutions = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await fetch(`${API_BASE}/institutions/`, {
        method: "GET",
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load institutions");
      }

      const list = data.institutions || [];
      setInstitutions(list);

      if (list.length > 0) {
        setSelectedInstitutionId((prev) => prev || list[0].id);
      } else {
        setSelectedInstitutionId("");
        setSelectedInstitution(null);
        setMembers([]);
      }

      setStatus("success");
      showAlert("Institutions loaded successfully", "success");
    } catch (error) {
      setStatus("error");
      showAlert(error.message || "Failed to load institutions", "error");
    }
  }, [headers]);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  useEffect(() => {
    fetchInstitutionDetail(selectedInstitutionId);
  }, [fetchInstitutionDetail, selectedInstitutionId]);

  const handleCreateInstitution = async (event) => {
    event.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/institutions/`, {
        method: "POST",
        headers,
        body: JSON.stringify(createForm),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create institution");
      }

      const created = data.institution;
      setCreateForm({ name: "", description: "" });
      setInstitutions((prev) => [created, ...prev]);
      setSelectedInstitutionId(created.id);
      showAlert("Institution created successfully", "success");
    } catch (error) {
      showAlert(error.message || "Failed to create institution", "error");
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!selectedInstitutionId) {
      showAlert("Select an institution first", "warning");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/institutions/${selectedInstitutionId}/members/`, {
        method: "POST",
        headers,
        body: JSON.stringify(memberForm),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      setMemberForm({ user_id: "", role: "member" });
      await fetchInstitutionDetail(selectedInstitutionId);
      showAlert(data.message || "Member added successfully", "success");
    } catch (error) {
      showAlert(error.message || "Failed to add member", "error");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedInstitutionId) {
      showAlert("Select an institution first", "warning");
      return;
    }

    if (!window.confirm("Are you sure you want to remove this member?")) {
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/institutions/${selectedInstitutionId}/members/${userId}/`,
        {
          method: "DELETE",
          headers,
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers((prev) => prev.filter((member) => member.user_id !== userId));
      showAlert(data.message || "Member removed successfully", "success");
    } catch (error) {
      showAlert(error.message || "Failed to remove member", "error");
    }
  };

  const handleDismissAlert = () => {
    setAlert({ show: false, type: "", message: "" });
  };

  const getAlertStyles = () => {
    const baseStyles = { ...styles.alert };
    switch (alert.type) {
      case "success":
        return { ...baseStyles, ...styles.alertSuccess };
      case "error":
        return { ...baseStyles, ...styles.alertError };
      case "warning":
        return { ...baseStyles, ...styles.alertWarning };
      default:
        return { ...baseStyles, ...styles.alertInfo };
    }
  };

  return (
    <div style={styles.page}>
      {/* Pop-up Alert */}
      {alert.show && (
        <div style={getAlertStyles()} role="alert">
          <div style={styles.alertContent}>
            <span style={styles.alertIcon}>
              {alert.type === "success" && "✓"}
              {alert.type === "error" && "⚠"}
              {alert.type === "warning" && "!"}
              {alert.type === "info" && "ℹ"}
            </span>
            <span style={styles.alertMessage}>{alert.message}</span>
            <button 
              style={styles.alertClose} 
              onClick={handleDismissAlert}
              aria-label="Close alert"
            >
              ✕
            </button>
          </div>
          <div style={styles.alertProgress}></div>
        </div>
      )}

      <div style={styles.headerRow}>
        <h1 style={styles.title}>Institutions</h1>
        <div style={styles.headerActions}>
          <button 
            onClick={fetchInstitutions} 
            style={styles.refreshButton}
            disabled={status === "loading"}
          >
            <span style={styles.buttonIcon}>↻</span>
            {status === "loading" ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Create Institution</h2>
          </div>
          <form onSubmit={handleCreateInstitution} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Institution Name</label>
              <input
                style={styles.input}
                placeholder="e.g., Acme Corp"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                placeholder="Describe the institution's purpose..."
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows="4"
              />
            </div>
            <button type="submit" style={styles.primaryButton}>
              <span style={styles.buttonIcon}>+</span>
              Create Institution
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>My Institutions</h2>
            <span style={styles.badge}>{institutions.length}</span>
          </div>
          
          {status === "loading" && (
            <div style={styles.loadingState}>
              <div style={styles.spinner}></div>
              <p>Loading institutions...</p>
            </div>
          )}
          
          {institutions.length === 0 && status !== "loading" && (
            <div style={styles.emptyState}>
              <p style={styles.emptyStateText}>No institutions yet.</p>
              <p style={styles.emptyStateSubtext}>Create your first institution to get started.</p>
            </div>
          )}
          
          <div style={styles.list}>
            {institutions.map((institution) => (
              <button
                key={institution.id}
                style={{
                  ...styles.listItem,
                  ...(selectedInstitutionId === institution.id ? styles.listItemActive : {}),
                }}
                onClick={() => setSelectedInstitutionId(institution.id)}
              >
                <div style={styles.itemContent}>
                  <span style={styles.itemName}>{institution.name}</span>
                  {showInstitutionIds && (
                    <span style={styles.itemMeta}>ID: {institution.id}</span>
                  )}
                </div>
                {selectedInstitutionId === institution.id && (
                  <span style={styles.checkIcon}>✓</span>
                )}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Members</h2>
          {selectedInstitution && (
            <span style={styles.selectedBadge}>{selectedInstitution.name}</span>
          )}
        </div>

        {!selectedInstitution ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyStateText}>No institution selected</p>
            <p style={styles.emptyStateSubtext}>Select an institution to manage members.</p>
          </div>
        ) : (
          <>
            {detailStatus === "loading" ? (
              <div style={styles.loadingState}>
                <div style={styles.spinner}></div>
                <p>Loading members...</p>
              </div>
            ) : (
              <>
                <form onSubmit={handleAddMember} style={styles.memberForm}>
                  <div style={styles.memberFormGroup}>
                    <input
                      style={styles.input}
                      placeholder="Enter user HashID"
                      value={memberForm.user_id}
                      onChange={(event) =>
                        setMemberForm((prev) => ({ ...prev, user_id: event.target.value.trim() }))
                      }
                      required
                    />
                    <select
                      style={styles.select}
                      value={memberForm.role}
                      onChange={(event) =>
                        setMemberForm((prev) => ({ ...prev, role: event.target.value }))
                      }
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" style={styles.primaryButton}>
                      <span style={styles.buttonIcon}>+</span>
                      Add
                    </button>
                  </div>
                </form>

                {members.length === 0 ? (
                  <div style={styles.emptyState}>
                    <p style={styles.emptyStateText}>No members yet</p>
                    <p style={styles.emptyStateSubtext}>Add members to this institution.</p>
                  </div>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Username</th>
                          {showInstitutionIds && <th style={styles.th}>User HashID</th>}
                          <th style={styles.th}>Role</th>
                          <th style={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.user_id} style={styles.tableRow}>
                            <td style={styles.td}>
                              <div style={styles.userInfo}>
                                <span style={styles.userAvatar}>
                                  {member.username?.charAt(0).toUpperCase()}
                                </span>
                                {member.username}
                              </div>
                            </td>
                            {showInstitutionIds && <td style={styles.td}>{member.user_id}</td>}
                            <td style={styles.td}>
                              <span style={{
                                ...styles.roleBadge,
                                ...(member.role === "admin" ? styles.roleAdmin : styles.roleMember)
                              }}>
                                {member.role}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                style={styles.iconButton}
                                onClick={() => handleRemoveMember(member.user_id)}
                                title="Remove member"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "24px 0",
    position: "relative",
  },
  // Pop-up Alert Styles
  alert: {
    position: "fixed",
    top: "24px",
    right: "24px",
    zIndex: 1000,
    minWidth: "320px",
    maxWidth: "400px",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    animation: "slideInRight 0.3s ease, fadeOut 0.3s ease 4.7s",
    overflow: "hidden",
  },
  alertSuccess: {
    backgroundColor: "#e8f5e9",
    border: "1px solid #a5d6a7",
    color: "#1b5e20",
  },
  alertError: {
    backgroundColor: "#ffebee",
    border: "1px solid #ffcdd2",
    color: "#b71c1c",
  },
  alertWarning: {
    backgroundColor: "#fff3e0",
    border: "1px solid #ffe0b2",
    color: "#bf360c",
  },
  alertInfo: {
    backgroundColor: "#e3f2fd",
    border: "1px solid #bbdefb",
    color: "#0d47a1",
  },
  alertContent: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    position: "relative",
    zIndex: 1,
  },
  alertIcon: {
    fontSize: "20px",
    fontWeight: "600",
  },
  alertMessage: {
    flex: 1,
    fontSize: "14px",
    fontWeight: "500",
  },
  alertClose: {
    background: "none",
    border: "none",
    fontSize: "16px",
    cursor: "pointer",
    color: "inherit",
    opacity: 0.7,
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
  },
  alertProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: "3px",
    backgroundColor: "currentColor",
    opacity: 0.3,
    animation: "progress 5s linear forwards",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "600",
    color: "#0f5132",
    letterSpacing: "-0.5px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: "24px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e2f0e8",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(15, 81, 50, 0.08)",
    transition: "box-shadow 0.3s ease",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#0f5132",
  },
  badge: {
    backgroundColor: "#e8f5e9",
    color: "#0f5132",
    padding: "4px 8px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  selectedBadge: {
    backgroundColor: "#0f5132",
    color: "white",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  memberForm: {
    marginBottom: "20px",
  },
  memberFormGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 120px auto",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#2f5f46",
  },
  input: {
    border: "1px solid #d1e0d8",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    transition: "all 0.2s ease",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    border: "1px solid #d1e0d8",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    resize: "vertical",
    transition: "all 0.2s ease",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    border: "1px solid #d1e0d8",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
    transition: "all 0.2s ease",
    outline: "none",
    backgroundColor: "white",
    cursor: "pointer",
    width: "100%",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    backgroundColor: "#0f5132",
    color: "white",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 2px 8px rgba(15, 81, 50, 0.2)",
  },
  refreshButton: {
    border: "1px solid #0f5132",
    borderRadius: "10px",
    backgroundColor: "white",
    color: "#0f5132",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  iconButton: {
    border: "none",
    background: "none",
    color: "#9a2b2b",
    fontSize: "16px",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "6px",
    transition: "all 0.2s ease",
    opacity: 0.7,
  },
  buttonIcon: {
    fontSize: "16px",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    color: "#567564",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e2f0e8",
    borderTopColor: "#0f5132",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "12px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    backgroundColor: "#f8fdf9",
    borderRadius: "12px",
  },
  emptyStateText: {
    margin: 0,
    color: "#0f5132",
    fontSize: "16px",
    fontWeight: "500",
  },
  emptyStateSubtext: {
    margin: "8px 0 0",
    color: "#567564",
    fontSize: "14px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  listItem: {
    border: "1px solid #e2f0e8",
    borderRadius: "10px",
    textAlign: "left",
    padding: "12px",
    cursor: "pointer",
    backgroundColor: "white",
    transition: "all 0.2s ease",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  listItemActive: {
    backgroundColor: "#f0fdf4",
    borderColor: "#0f5132",
    boxShadow: "0 2px 8px rgba(15, 81, 50, 0.1)",
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    display: "block",
    fontWeight: "500",
    color: "#1d3f2d",
    fontSize: "14px",
    marginBottom: "4px",
  },
  itemMeta: {
    display: "block",
    color: "#567564",
    fontSize: "11px",
  },
  checkIcon: {
    color: "#0f5132",
    fontSize: "16px",
    fontWeight: "600",
  },
  selectedInfo: {
    marginTop: 0,
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#f0fdf4",
    borderRadius: "10px",
    fontSize: "14px",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "10px",
    border: "1px solid #e2f0e8",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    backgroundColor: "#f8fdf9",
    padding: "12px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#0f5132",
    borderBottom: "2px solid #d1e0d8",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e2f0e8",
    color: "#1d3f2d",
  },
  tableRow: {
    transition: "background-color 0.2s ease",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  userAvatar: {
    width: "28px",
    height: "28px",
    backgroundColor: "#e8f5e9",
    color: "#0f5132",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "600",
  },
  roleBadge: {
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    display: "inline-block",
  },
  roleAdmin: {
    backgroundColor: "#fff3e0",
    color: "#bf360c",
  },
  roleMember: {
    backgroundColor: "#e8f5e9",
    color: "#0f5132",
  },
};

// Add keyframe animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
  @keyframes progress {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
document.head.appendChild(styleSheet);

export default InstitutionsPage;