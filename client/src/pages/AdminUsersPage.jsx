import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useColorMode } from "../utils/useColorMode";
import { apiFetch } from "../utils/apiFetch";

const API_BASE = "http://127.0.0.1:8000/api/accounts";

const AdminUsersPage = () => {
  const { theme } = useColorMode();
  const token = localStorage.getItem("access_token");

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUsers, setUpdatingUsers] = useState({});
  const [deletingUsers, setDeletingUsers] = useState({});
  const [impersonatingUsers, setImpersonatingUsers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    is_staff: false,
    is_active: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const inputBorder = theme.inputBorder || theme.cardBorder;
  const inputBg = theme.inputBg || theme.cardBg;
  const borderLight = theme.borderLight || theme.cardBorder;

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchUsers = useCallback(
    async (query = "") => {
      setLoading(true);
      setError("");
      try {
        const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
        const res = await apiFetch(`${API_BASE}/admin/users/${q}`, {
          method: "GET",
          headers,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load users");
        }

        setUsers(data.users || []);
      } catch (err) {
        setError(err.message || "Failed to load users");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [headers]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!token) return;

    const fetchCurrentUser = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/profile/`, {
          method: "GET",
          headers,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
        }
      } catch {
        // ignore
      }
    };

    fetchCurrentUser();
  }, [token, headers]);

  const updateUser = async (userId, payload) => {
    setUpdatingUsers((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await apiFetch(`${API_BASE}/admin/users/${userId}/`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      setUsers((prev) => prev.map((user) => (user.id === userId ? data.user : user)));
      return { ok: true };
    } catch (err) {
      alert(`Failed to update user: ${err.message}`);
      return { ok: false };
    } finally {
      setUpdatingUsers((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const deleteUser = async (userId, username) => {
    const confirmed = window.confirm(`Delete user "${username}"?`);
    if (!confirmed) return;

    setDeletingUsers((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await apiFetch(`${API_BASE}/admin/users/${userId}/`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`);
    } finally {
      setDeletingUsers((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const impersonateUser = async (userId, username) => {
    const confirmed = window.confirm(`Login as "${username}"?`);
    if (!confirmed) return;

    setImpersonatingUsers((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await apiFetch(`${API_BASE}/admin/users/${userId}/impersonate/`, {
        method: "POST",
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to impersonate user");
      }

      if (!localStorage.getItem("impersonator_access_token")) {
        localStorage.setItem("impersonator_access_token", localStorage.getItem("access_token") || "");
        localStorage.setItem("impersonator_refresh_token", localStorage.getItem("refresh_token") || "");
        if (currentUser) {
          localStorage.setItem("impersonator_user", JSON.stringify(currentUser));
        }
      }

      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("impersonated_user", JSON.stringify(data.impersonated_user || { username }));

      window.location.href = "/profile";
    } catch (err) {
      alert(`Failed to impersonate user: ${err.message}`);
    } finally {
      setImpersonatingUsers((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    fetchUsers(search);
  };

  const handleClearSearch = () => {
    setSearch("");
    fetchUsers();
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const filteredUsers = useMemo(() => {
    let filtered = users;
    if (filterStatus === "active") filtered = filtered.filter((u) => u.is_active);
    if (filterStatus === "inactive") filtered = filtered.filter((u) => !u.is_active);
    if (filterStatus === "staff") filtered = filtered.filter((u) => u.is_staff);
    return filtered;
  }, [users, filterStatus]);

  const toggleAllSelection = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
      return;
    }
    setSelectedUsers(filteredUsers.map((u) => u.id));
  };

  const bulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    const confirmed = window.confirm(`Delete ${selectedUsers.length} selected users?`);
    if (!confirmed) return;

    for (const id of selectedUsers) {
      const user = users.find((u) => u.id === id);
      if (user) {
        // eslint-disable-next-line no-await-in-loop
        await deleteUser(id, user.username);
      }
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      is_staff: Boolean(user.is_staff),
      is_active: Boolean(user.is_active),
    });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setSavingEdit(false);
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editingUser) return;

    setSavingEdit(true);
    const result = await updateUser(editingUser.id, editForm);
    if (result.ok) {
      closeEditModal();
    } else {
      setSavingEdit(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      staff: users.filter((u) => u.is_staff).length,
      inactive: users.filter((u) => !u.is_active).length,
    }),
    [users]
  );

  return (
    <div className="admin-dashboard">
      <style>{`
        .admin-dashboard {
          padding: 24px;
          background: ${theme.pageBg};
          min-height: 100vh;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .dashboard-header { margin-bottom: 24px; }
        .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .header-title h1 { font-size: 28px; font-weight: 600; color: ${theme.text}; margin: 0 0 4px 0; }
        .header-title p { font-size: 14px; color: ${theme.mutedText}; margin: 0; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-item { background: ${theme.cardBg}; border: 1px solid ${theme.cardBorder}; border-radius: 18px; padding: 18px 20px; }
        .stat-label { font-size: 13px; font-weight: 500; color: ${theme.mutedText}; text-transform: uppercase; margin-bottom: 8px; }
        .stat-value { font-size: 32px; font-weight: 600; color: #0f5132; line-height: 1; }

        .search-section { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-wrapper { flex: 1; min-width: 320px; }
        .search-container { position: relative; width: 100%; }
        .search-input {
          width: 100%; height: 48px; padding: 0 16px 0 48px; border: 1.5px solid ${inputBorder};
          border-radius: 14px; font-size: 15px; background: ${inputBg}; color: ${theme.text}; box-sizing: border-box;
        }
        .search-input:focus { border-color: #0f5132; box-shadow: 0 0 0 4px rgba(15, 81, 50, 0.1); outline: none; }
        .search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 18px; }
        .search-clear {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%); border: none; background: none;
          cursor: pointer; font-size: 18px; color: #94a3b8; width: 30px; height: 30px;
        }

        .action-buttons { display: flex; gap: 10px; }
        .btn {
          height: 48px; padding: 0 24px; border-radius: 14px; font-size: 15px; font-weight: 500;
          border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-primary { background: #0f5132; color: white; }
        .btn-secondary { background: transparent; border: 1.5px solid ${inputBorder}; color: ${theme.text}; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-sm { height: 40px; padding: 0 18px; border-radius: 12px; font-size: 14px; }

        .filter-section { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .filter-label { font-size: 14px; font-weight: 500; color: ${theme.mutedText}; }
        .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip {
          padding: 8px 18px; border-radius: 999px; font-size: 14px; font-weight: 500; cursor: pointer;
          border: 1.5px solid ${inputBorder}; background: ${theme.cardBg}; color: ${theme.text};
        }
        .chip.active { background: #0f5132; border-color: #0f5132; color: white; }

        .error-banner {
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 16px; padding: 16px 20px;
          margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; color: #991b1b;
        }

        .table-container {
          background: ${theme.cardBg}; border: 1px solid ${theme.cardBorder}; border-radius: 20px; overflow: hidden; margin-top: 20px;
        }
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th {
          text-align: left; padding: 16px 20px; background: rgba(15,81,50,0.04); color: #0f5132;
          font-weight: 600; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid ${theme.cardBorder};
        }
        .modern-table td { padding: 16px 20px; color: ${theme.text}; border-bottom: 1px solid ${borderLight}; font-size: 14px; }
        .modern-table tbody tr:hover { background: rgba(15,81,50,0.02); }

        .user-info { display: flex; align-items: center; gap: 12px; }
        .user-avatar {
          width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #0f5132, #1e7e4a);
          color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;
        }
        .user-details { display: flex; flex-direction: column; gap: 4px; }
        .user-name { font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .user-email { font-size: 12px; color: ${theme.mutedText}; }
        .badge { padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; }
        .badge.admin { background: #fbbf24; color: #78350f; }
        .badge.staff { background: #e2e8f0; color: #475569; }

        .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute; cursor: pointer; inset: 0; background-color: #e2e8f0; transition: .2s; border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute; content: ""; height: 20px; width: 20px; left: 2px; bottom: 2px; background: white; transition: .2s; border-radius: 50%;
        }
        input:checked + .toggle-slider { background-color: #0f5132; }
        input:checked + .toggle-slider:before { transform: translateX(20px); }

        .row-actions { display: flex; gap: 8px; }
        .icon-btn {
          width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; cursor: pointer; font-size: 16px;
        }
        .icon-btn.edit:hover { background: #e6f7e6; color: #0f5132; }
        .icon-btn.delete:hover { background: #fee2e2; color: #ef4444; }

        .checkbox { width: 18px; height: 18px; border-radius: 6px; cursor: pointer; accent-color: #0f5132; }

        .results-meta { margin-top: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: ${theme.mutedText}; }
        .selected-info { background: rgba(15, 81, 50, 0.1); color: #0f5132; padding: 6px 14px; border-radius: 999px; font-weight: 500; }

        .empty-state { text-align: center; padding: 60px 20px; }

        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .modal {
          width: min(560px, 100%); background: ${theme.cardBg}; border: 1px solid ${theme.cardBorder}; border-radius: 18px;
          box-shadow: 0 20px 40px rgba(2, 6, 23, 0.35); overflow: hidden;
        }
        .modal-header {
          padding: 16px 18px; border-bottom: 1px solid ${theme.cardBorder}; display: flex; align-items: center; justify-content: space-between;
        }
        .modal-title { margin: 0; color: ${theme.text}; font-size: 18px; font-weight: 600; }
        .modal-close {
          border: none; background: transparent; color: ${theme.mutedText}; font-size: 22px; cursor: pointer; line-height: 1;
        }
        .modal-body { padding: 16px 18px; display: grid; gap: 12px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field { display: grid; gap: 6px; }
        .field label { font-size: 12px; color: ${theme.mutedText}; font-weight: 600; }
        .field input {
          height: 40px; border-radius: 10px; border: 1px solid ${inputBorder}; background: ${inputBg}; color: ${theme.text};
          padding: 0 10px; font-size: 14px;
        }
        .check-row { display: flex; gap: 16px; align-items: center; }
        .modal-actions {
          padding: 14px 18px; border-top: 1px solid ${theme.cardBorder}; display: flex; justify-content: flex-end; gap: 10px;
        }

        @media (max-width: 768px) {
          .admin-dashboard { padding: 16px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .search-section { flex-direction: column; align-items: stretch; }
          .search-wrapper { min-width: 100%; }
          .form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dashboard-header">
        <div className="header-top">
          <div className="header-title">
            <h1>User Management</h1>
            <p>Manage users, permissions, and account status</p>
          </div>
          {selectedUsers.length > 0 && (
            <button className="btn btn-danger" onClick={bulkDelete}>
              {"\ud83d\uddd1\ufe0f"} Delete {selectedUsers.length} Selected
            </button>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-item"><div className="stat-label">Total Users</div><div className="stat-value">{stats.total}</div></div>
          <div className="stat-item"><div className="stat-label">Active</div><div className="stat-value">{stats.active}</div></div>
          <div className="stat-item"><div className="stat-label">Inactive</div><div className="stat-value">{stats.inactive}</div></div>
          <div className="stat-item"><div className="stat-label">Staff</div><div className="stat-value">{stats.staff}</div></div>
        </div>

        <div className="search-section">
          <div className="search-wrapper">
            <div className="search-container">
              <span className="search-icon">{"\ud83d\udd0d"}</span>
              <form onSubmit={handleSearch} style={{ margin: 0 }}>
                <input
                  type="text"
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username"
                />
              </form>
              {search && (
                <button className="search-clear" onClick={handleClearSearch} type="button">
                  {"\u2715"}
                </button>
              )}
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
            <button className="btn btn-secondary" onClick={handleClearSearch}>Reset</button>
          </div>
        </div>

        <div className="filter-section">
          <span className="filter-label">Filter by:</span>
          <div className="filter-chips">
            <button className={`chip ${filterStatus === "all" ? "active" : ""}`} onClick={() => setFilterStatus("all")}>All Users</button>
            <button className={`chip ${filterStatus === "active" ? "active" : ""}`} onClick={() => setFilterStatus("active")}>Active</button>
            <button className={`chip ${filterStatus === "inactive" ? "active" : ""}`} onClick={() => setFilterStatus("inactive")}>Inactive</button>
            <button className={`chip ${filterStatus === "staff" ? "active" : ""}`} onClick={() => setFilterStatus("staff")}>Staff</button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{"\u26a0\ufe0f"} {error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchUsers(search)}>Try Again</button>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div style={{ padding: 20, color: theme.mutedText }}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 44 }}>{"\ud83d\udc65"}</div>
            <div style={{ color: theme.text, fontWeight: 600, marginTop: 10 }}>No users found</div>
          </div>
        ) : (
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                    onChange={toggleAllSelection}
                  />
                </th>
                <th>User</th>
                <th style={{ width: 100 }}>Role</th>
                <th style={{ width: 100 }}>Staff</th>
                <th style={{ width: 100 }}>Active</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isUpdating = updatingUsers[user.id];
                const isDeleting = deletingUsers[user.id];
                return (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        disabled={isDeleting}
                      />
                    </td>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">{(user.username || "U")[0].toUpperCase()}</div>
                        <div className="user-details">
                          <span className="user-name">
                            {user.username}
                            {user.is_superuser && <span className="badge admin">ADMIN</span>}
                            {user.is_staff && !user.is_superuser && <span className="badge staff">STAFF</span>}
                          </span>
                          <span className="user-email">{user.email || "No email provided"}</span>
                        </div>
                      </div>
                    </td>
                    <td>{user.is_superuser ? "Super Admin" : user.is_staff ? "Staff" : "Standard"}</td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(user.is_staff)}
                          onChange={(e) => updateUser(user.id, { is_staff: e.target.checked })}
                          disabled={isUpdating || isDeleting || user.is_superuser}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(user.is_active)}
                          onChange={(e) => updateUser(user.id, { is_active: e.target.checked })}
                          disabled={isUpdating || isDeleting}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn edit" onClick={() => openEditModal(user)} title="Edit user" disabled={isDeleting}>
                          {"\u270e"}
                        </button>
                        {!user.is_superuser && (
                          <button
                            className="icon-btn impersonate"
                            onClick={() => impersonateUser(user.id, user.username)}
                            disabled={isUpdating || isDeleting || impersonatingUsers[user.id]}
                            title="Login as user"
                          >
                            {impersonatingUsers[user.id] ? "..." : "\u21aa"}
                          </button>
                        )}
                        <button
                          className="icon-btn delete"
                          onClick={() => deleteUser(user.id, user.username)}
                          disabled={isUpdating || isDeleting || user.is_superuser}
                          title="Delete user"
                        >
                          {isDeleting ? "..." : "\ud83d\uddd1\ufe0f"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filteredUsers.length > 0 && (
        <div className="results-meta">
          <span>Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users</span>
          {selectedUsers.length > 0 && (
            <span className="selected-info">{selectedUsers.length} selected</span>
          )}
        </div>
      )}

      {editingUser && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit User: {editingUser.username}</h3>
              <button type="button" className="modal-close" onClick={closeEditModal}>{"\u00d7"}</button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>First Name</label>
                    <input
                      value={editForm.first_name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Last Name</label>
                    <input
                      value={editForm.last_name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="check-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.is_staff}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, is_staff: e.target.checked }))}
                      disabled={editingUser.is_superuser}
                    /> {" "}
                    Staff Access
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    /> {" "}
                    Active Account
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={closeEditModal} disabled={savingEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;


















