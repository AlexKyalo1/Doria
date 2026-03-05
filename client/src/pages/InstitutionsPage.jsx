import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api/accounts";

const InstitutionsPage = () => {
  const token = localStorage.getItem("access_token");

  const [institutions, setInstitutions] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [members, setMembers] = useState([]);

  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "member" });

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchInstitutionDetail = useCallback(
    async (institutionId) => {
      if (!institutionId) {
        setSelectedInstitution(null);
        setMembers([]);
        return;
      }

      try {
        const detailRes = await fetch(`${API_BASE}/institutions/${institutionId}/`, {
          method: "GET",
          headers,
        });
        const detailData = await detailRes.json();
        if (!detailRes.ok) {
          throw new Error(detailData.error || "Failed to load institution");
        }
        setSelectedInstitution(detailData.institution);

        const membersRes = await fetch(`${API_BASE}/institutions/${institutionId}/members/list/`, {
          method: "GET",
          headers,
        });
        const membersData = await membersRes.json();
        if (!membersRes.ok) {
          throw new Error(membersData.error || "Failed to load members");
        }
        setMembers(membersData.members || []);
      } catch (error) {
        setMessage(error.message || "Failed to load institution data");
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
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Failed to load institutions");
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
      setMessage("Institution created");
    } catch (error) {
      setMessage(error.message || "Failed to create institution");
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!selectedInstitutionId) {
      setMessage("Select an institution first");
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
      setMessage(data.message || "Member added");
    } catch (error) {
      setMessage(error.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedInstitutionId) {
      setMessage("Select an institution first");
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
      setMessage(data.message || "Member removed");
    } catch (error) {
      setMessage(error.message || "Failed to remove member");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Institutions</h1>
        <button onClick={fetchInstitutions} style={styles.refreshButton}>Refresh</button>
      </div>

      {message && <p style={styles.message}>{message}</p>}

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Create Institution</h2>
          <form onSubmit={handleCreateInstitution} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Institution name"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <textarea
              style={styles.textarea}
              placeholder="Description"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <button type="submit" style={styles.primaryButton}>Create</button>
          </form>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>My Institutions</h2>
          {status === "loading" && <p>Loading institutions...</p>}
          {institutions.length === 0 && status !== "loading" && <p>No institutions yet.</p>}
          <div style={styles.list}>
            {institutions.map((institution) => (
              <button
                key={institution.id}
                style={{
                  ...styles.listItem,
                  backgroundColor:
                    selectedInstitutionId === institution.id ? "#d8f0df" : "#ffffff",
                }}
                onClick={() => setSelectedInstitutionId(institution.id)}
              >
                <span style={styles.itemName}>{institution.name}</span>
                <span style={styles.itemMeta}>ID: {institution.id}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Members</h2>

        {!selectedInstitution ? (
          <p>Select an institution to manage members.</p>
        ) : (
          <>
            <p style={styles.selectedInfo}>
              Selected: <strong>{selectedInstitution.name}</strong>
            </p>

            <form onSubmit={handleAddMember} style={styles.memberForm}>
              <input
                style={styles.input}
                placeholder="User HashID"
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
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" style={styles.primaryButton}>Add Member</button>
            </form>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Username</th>
                    <th style={styles.th}>User HashID</th>
                    <th style={styles.th}>Role</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.user_id}>
                      <td style={styles.td}>{member.username}</td>
                      <td style={styles.td}>{member.user_id}</td>
                      <td style={styles.td}>{member.role}</td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.dangerButton}
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    gap: "16px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    color: "#0f5132",
  },
  message: {
    margin: 0,
    color: "#2f6f4e",
    backgroundColor: "#eaf7ef",
    border: "1px solid #c7e7d3",
    borderRadius: "8px",
    padding: "10px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #d6eadf",
    padding: "16px",
  },
  cardTitle: {
    margin: "0 0 10px 0",
    color: "#0f5132",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  memberForm: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: "10px",
    marginBottom: "12px",
  },
  input: {
    border: "1px solid #b8d9c5",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "14px",
  },
  textarea: {
    border: "1px solid #b8d9c5",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "14px",
    minHeight: "90px",
    resize: "vertical",
  },
  select: {
    border: "1px solid #b8d9c5",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "14px",
  },
  primaryButton: {
    border: "none",
    borderRadius: "8px",
    backgroundColor: "#0f5132",
    color: "white",
    padding: "10px 14px",
    cursor: "pointer",
  },
  refreshButton: {
    border: "1px solid #0f5132",
    borderRadius: "8px",
    backgroundColor: "white",
    color: "#0f5132",
    padding: "8px 12px",
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #a82929",
    borderRadius: "8px",
    backgroundColor: "#fff5f5",
    color: "#a82929",
    padding: "6px 10px",
    cursor: "pointer",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  listItem: {
    border: "1px solid #d7eadd",
    borderRadius: "8px",
    textAlign: "left",
    padding: "10px",
    cursor: "pointer",
  },
  itemName: {
    display: "block",
    fontWeight: "600",
    color: "#1d3f2d",
  },
  itemMeta: {
    display: "block",
    marginTop: "4px",
    color: "#567564",
    fontSize: "12px",
  },
  selectedInfo: {
    marginTop: 0,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    borderBottom: "1px solid #cde2d4",
    padding: "8px",
    fontSize: "13px",
    color: "#2f5f46",
  },
  td: {
    borderBottom: "1px solid #e2f0e8",
    padding: "8px",
    fontSize: "14px",
  },
};

export default InstitutionsPage;