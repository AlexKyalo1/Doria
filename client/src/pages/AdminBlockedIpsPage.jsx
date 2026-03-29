import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { SECURITY_API_BASE as SECURITY_API } from "../utils/apiBase";
import { useColorMode } from "../utils/useColorMode";

const AdminBlockedIpsPage = () => {
  const { theme } = useColorMode();
  const token = localStorage.getItem("access_token");
  const [blockedIps, setBlockedIps] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingIds, setWorkingIds] = useState({});

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const loadBlockedIps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${SECURITY_API}/blocked-ips/?status=${encodeURIComponent(statusFilter)}`, {
        method: "GET",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load blocked IPs");
      }
      setBlockedIps(data.blocked_ips || []);
    } catch (err) {
      setBlockedIps([]);
      setError(err.message || "Failed to load blocked IPs");
    } finally {
      setLoading(false);
    }
  }, [headers, statusFilter]);

  useEffect(() => {
    loadBlockedIps();
  }, [loadBlockedIps]);

  const unblockIp = async (block) => {
    const confirmed = window.confirm(`Unblock ${block.ip_address}?`);
    if (!confirmed) return;

    setWorkingIds((prev) => ({ ...prev, [block.id]: true }));
    try {
      const res = await apiFetch(`${SECURITY_API}/blocked-ips/${block.id}/unblock/`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unblock IP");
      }

      setBlockedIps((prev) => prev.filter((item) => item.id !== block.id));
    } catch (err) {
      window.alert(err.message || "Failed to unblock IP");
    } finally {
      setWorkingIds((prev) => ({ ...prev, [block.id]: false }));
    }
  };

  const stats = useMemo(() => {
    const active = blockedIps.filter((item) => item.active).length;
    const inactive = blockedIps.length - active;
    const uniqueStatuses = new Set(blockedIps.map((item) => item.trigger_status)).size;
    return { total: blockedIps.length, active, inactive, statuses: uniqueStatuses };
  }, [blockedIps]);

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <div style={styles.header}>
        <div>
          <h1 style={{ ...styles.title, color: theme.text }}>IP Security Control</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>Review temporary bans and release IPs from the frontend.</p>
        </div>
        <div style={styles.headerActions}>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ ...styles.select, borderColor: theme.cardBorder, backgroundColor: theme.cardBg, color: theme.text }}
          >
            <option value="active">Active blocks</option>
            <option value="inactive">Inactive blocks</option>
            <option value="all">All records</option>
          </select>
          <button type="button" onClick={loadBlockedIps} style={styles.refreshButton}>
            Refresh
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.statLabel}>Records</div>
          <div style={{ ...styles.statValue, color: theme.text }}>{stats.total}</div>
        </div>
        <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.statLabel}>Active</div>
          <div style={{ ...styles.statValue, color: "#b91c1c" }}>{stats.active}</div>
        </div>
        <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.statLabel}>Inactive</div>
          <div style={{ ...styles.statValue, color: "#166534" }}>{stats.inactive}</div>
        </div>
        <div style={{ ...styles.statCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.statLabel}>Trigger codes</div>
          <div style={{ ...styles.statValue, color: theme.text }}>{stats.statuses}</div>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={{ ...styles.tableWrap, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        {loading ? (
          <div style={{ ...styles.emptyState, color: theme.mutedText }}>Loading blocked IPs...</div>
        ) : blockedIps.length === 0 ? (
          <div style={{ ...styles.emptyState, color: theme.mutedText }}>No blocked IP records for this filter.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>IP Address</th>
                <th style={styles.th}>Status Code</th>
                <th style={styles.th}>Hits</th>
                <th style={styles.th}>Reason</th>
                <th style={styles.th}>Last Path</th>
                <th style={styles.th}>Expires</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.map((block) => (
                <tr key={block.id}>
                  <td style={styles.td}>{block.ip_address}</td>
                  <td style={styles.td}>{block.trigger_status}</td>
                  <td style={styles.td}>{block.hit_count}</td>
                  <td style={styles.td}>{block.reason}</td>
                  <td style={styles.td}>{block.last_path || "-"}</td>
                  <td style={styles.td}>{new Date(block.expires_at).toLocaleString()}</td>
                  <td style={styles.td}>
                    {block.active ? (
                      <button
                        type="button"
                        onClick={() => unblockIp(block)}
                        disabled={Boolean(workingIds[block.id])}
                        style={styles.unblockButton}
                      >
                        {workingIds[block.id] ? "Unblocking..." : "Unblock"}
                      </button>
                    ) : (
                      <span style={styles.inactiveBadge}>Released</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "24px",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 700,
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: "14px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 14px",
    minWidth: "170px",
  },
  refreshButton: {
    border: "none",
    borderRadius: "12px",
    padding: "10px 16px",
    backgroundColor: "#0f5132",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "16px",
  },
  statLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: "8px",
    fontWeight: 600,
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 700,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "12px 16px",
    borderRadius: "12px",
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: "12px",
    textTransform: "uppercase",
    color: "#475569",
    backgroundColor: "rgba(15, 81, 50, 0.05)",
  },
  td: {
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: "14px",
    color: "#0f172a",
    verticalAlign: "top",
  },
  unblockButton: {
    border: "none",
    borderRadius: "10px",
    padding: "8px 12px",
    backgroundColor: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  inactiveBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 700,
  },
  emptyState: {
    padding: "32px 20px",
    textAlign: "center",
  },
};

export default AdminBlockedIpsPage;
