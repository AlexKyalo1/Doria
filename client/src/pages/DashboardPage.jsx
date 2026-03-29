import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { ACCOUNTS_API_BASE as API_BASE } from "../utils/apiBase";

import { useColorMode } from "../utils/useColorMode";

const DashboardPage = () => {
  const { theme, isDark } = useColorMode();
  const token = localStorage.getItem("access_token");

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [profileRes, institutionsRes] = await Promise.all([
          apiFetch(`${API_BASE}/profile/`, { method: "GET", headers }),
          apiFetch(`${API_BASE}/institutions/`, { method: "GET", headers }),
        ]);

        const profileData = await profileRes.json();
        const institutionData = await institutionsRes.json();

        if (profileRes.ok) {
          setProfile(profileData.user || null);
        }
        if (institutionsRes.ok) {
          setInstitutions(institutionData.institutions || []);
        }
      } catch {
        // Keep graceful fallback cards.
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadDashboard();
    } else {
      setLoading(false);
    }
  }, [token]);

  const firstName = profile?.first_name || profile?.username || "there";
  const institutionCount = institutions.length;
  const totalMembers = institutions.reduce((total, institution) => {
    const count = institution.members_count || 0;
    return total + count;
  }, 0);
  const createdByYou = institutions.filter((institution) => institution.is_owner).length;

  const stats = useMemo(
    () => [
      {
        title: "Institutions",
        value: institutionCount,
        note: "Total organizations you belong to",
        icon: "\ud83c\udfdb\ufe0f",
      },
      {
        title: "Owned by You",
        value: createdByYou,
        note: "Institutions where you are owner",
        icon: "\ud83d\udc51",
      },
      {
        title: "Known Members",
        value: totalMembers,
        note: "Combined member count (where available)",
        icon: "\ud83d\udc65",
      },
      {
        title: "Profile Status",
        value: profile ? "Active" : "Unavailable",
        note: profile ? "Profile data loaded successfully" : "Could not load profile data",
        icon: profile ? "\u2713" : "\u26a0\ufe0f",
      },
    ],
    [createdByYou, institutionCount, profile, totalMembers]
  );

  const quickActions = [
    { label: "5-Min Site Tour", path: "/demo-guide", icon: "\u23f1\ufe0f" },
    { label: "Create Institution", path: "/institutions", icon: "+" },
    { label: "Manage Members", path: "/institutions", icon: "\ud83d\udc65" },
    { label: "AI Insights", path: "/ai/insights", icon: "\ud83e\udde0" },
    { label: "API Platform", path: "/api-platform", icon: "\ud83d\udd17" },
    { label: "Edit Profile", path: "/profile/update", icon: "\u270e" },
    { label: "Frontend Settings", path: "/settings", icon: "\u2699\ufe0f" },
    { label: "Billing", path: "/billing", icon: "\ud83d\udcb3" },
  ];

  const openPath = (path) => {
    window.location.href = path;
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <section style={{ ...styles.hero, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <p style={{ ...styles.overline, color: theme.mutedText }}>Overview</p>
        <h1 style={{ ...styles.heroTitle, color: theme.text }}>Welcome back, {firstName}</h1>
        <p style={{ ...styles.heroText, color: theme.mutedText }}>
          {loading
            ? "Loading your dashboard..."
            : "Here is a quick snapshot of your institutions and account activity."}
        </p>
      </section>

      <section style={styles.grid}>
        {stats.map((stat) => (
          <article key={stat.title} style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div style={styles.cardTop}>
              <span style={styles.cardIcon}>{stat.icon}</span>
              <span style={{ ...styles.cardTitle, color: theme.mutedText }}>{stat.title}</span>
            </div>
            <div style={{ ...styles.cardValue, color: theme.text }}>{stat.value}</div>
            <div style={{ ...styles.cardNote, color: theme.mutedText }}>{stat.note}</div>
          </article>
        ))}
      </section>

      <section style={{ ...styles.actionsWrap, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <h2 style={{ ...styles.actionsTitle, color: theme.text }}>Quick Actions</h2>
        <div style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              style={{
                ...styles.actionButton,
                backgroundColor: isDark ? "#0f172a" : "#f8faf8",
                borderColor: theme.cardBorder,
                color: theme.text,
              }}
              onClick={() => openPath(action.path)}
            >
              <span style={styles.actionIcon}>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    minHeight: "100%",
  },
  hero: {
    border: "1px solid #d0e6d2",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 6px 18px rgba(15, 81, 50, 0.08)",
  },
  overline: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 600,
  },
  heroTitle: {
    margin: "8px 0 6px",
    fontSize: "30px",
    lineHeight: 1.2,
  },
  heroText: {
    margin: 0,
    fontSize: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
  },
  card: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 4px 12px rgba(15, 81, 50, 0.06)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  cardIcon: {
    fontSize: "16px",
  },
  cardTitle: {
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  cardValue: {
    fontSize: "30px",
    fontWeight: 700,
    lineHeight: 1.1,
    marginBottom: "6px",
  },
  cardNote: {
    fontSize: "12px",
    lineHeight: 1.4,
  },
  actionsWrap: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "16px",
  },
  actionsTitle: {
    margin: "0 0 10px",
    fontSize: "17px",
    fontWeight: 600,
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
  },
  actionButton: {
    border: "1px solid #d0e6d2",
    borderRadius: "12px",
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  actionIcon: {
    fontSize: "15px",
    width: "20px",
    textAlign: "center",
  },
};

export default DashboardPage;


