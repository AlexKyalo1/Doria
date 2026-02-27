import React, { useEffect, useState } from "react";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const fetchProfile = async () => {
      setStatus("loading");
      try {
        const res = await fetch("http://127.0.0.1:8000/api/accounts/profile/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (res.status === 200) {
          setUser(data.user);
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to load profile");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("❌ Error connecting to server");
      }
    };

    fetchProfile();
  }, [token]);

  // Sample additional fields - replace with your actual user data structure
  const userFields = {
    phone: user?.phone || "-",
    location: user?.location || "-",
    memberSince: user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : "-",
    lastLogin: user?.last_login ? new Date(user.last_login).toLocaleDateString() : "-",
    first_name: user?.fisrt_name || "-",
    last_name: user?.last_name || "-",
    // Add more fields as needed
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(135deg, #f4fdf6 0%, #e8f5e9 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "16px"
    }}>
      <div style={{
        backgroundColor: "white",
        padding: "32px",
        borderRadius: "20px",
        boxShadow: "0 15px 30px rgba(15, 81, 50, 0.15)",
        width: "520px",
        maxWidth: "100%",
        animation: "slideUp 0.4s ease-out"
      }}>
        {/* Compact Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "2px solid #e8f5e9"
        }}>
          <div style={{
            width: "48px",
            height: "48px",
            backgroundColor: "#0f5132",
            borderRadius: "12px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0 4px 8px rgba(15, 81, 50, 0.2)"
          }}>
            <span style={{ fontSize: "24px" }}>🛡️</span>
          </div>
          <div>
            <h1 style={{
              color: "#0f5132",
              margin: 0,
              fontSize: "24px",
              fontWeight: "600",
              letterSpacing: "0.5px"
            }}>
              Profile Information
            </h1>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "13px",
              color: "#6b7280"
            }}>Manage your account details</p>
          </div>
        </div>

        {/* Status Messages */}
        {status === "loading" && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            padding: "24px",
            backgroundColor: "#f8faf8",
            borderRadius: "12px"
          }}>
            <div style={{
              width: "24px",
              height: "24px",
              border: "3px solid #e8f5e9",
              borderTop: "3px solid #0f5132",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <p style={{ color: "#0f5132", margin: 0, fontWeight: "500" }}>Loading profile...</p>
          </div>
        )}

        {status === "error" && (
          <div style={{
            backgroundColor: "#fdf1f0",
            padding: "16px",
            borderRadius: "10px",
            marginBottom: "16px"
          }}>
            <p style={{
              color: "#842029",
              margin: 0,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <span>⚠️</span>
              {message}
            </p>
          </div>
        )}

        {status === "success" && user && (
          <div>
            {/* Compact Info Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "20px"
            }}>
              {/* Username - Full width on mobile, half on desktop */}
              <div style={{
                gridColumn: "span 2",
                backgroundColor: "#f8faf8",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #d0e6d2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>👤</span>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>
                      Username
                    </p>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0f5132" }}>
                      {user.username} : {user.first_name} {user.last_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div style={{
                backgroundColor: "#f8faf8",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #d0e6d2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>📧</span>
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ margin: "0 0 2px 0", fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>
                      Email
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#1f2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div style={{
                backgroundColor: "#f8faf8",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #d0e6d2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>📱</span>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>
                      Phone
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#1f2937" }}>
                      {userFields.phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div style={{
                backgroundColor: "#f8faf8",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #d0e6d2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>📍</span>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>
                      Location
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#1f2937" }}>
                      {userFields.location}
                    </p>
                  </div>
                </div>
              </div>

              {/* Member Since */}
              <div style={{
                backgroundColor: "#f8faf8",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #d0e6d2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>📅</span>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>
                      Member Since
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#1f2937" }}>
                      {userFields.memberSince}
                    </p>
                  </div>
                </div>
              </div>

              {/* Last Login */}
              <div style={{
                backgroundColor: "#f8faf8",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #d0e6d2"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>⏱️</span>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>
                      Last Login
                    </p>
                    <p style={{ margin: 0, fontSize: "13px", color: "#1f2937" }}>
                      {userFields.lastLogin}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Badge and Actions Row */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderTop: "1px solid #e8f5e9"
            }}>
              <span style={{
                backgroundColor: "#d1e7dd",
                color: "#0f5132",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <span>✓</span>
                Active
              </span>

              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{
                  backgroundColor: "transparent",
                  border: "1px solid #0f5132",
                  color: "#0f5132",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#0f5132";
                  e.target.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "transparent";
                  e.target.style.color = "#0f5132";
                }}>
                  <span>✏️</span>
                  Edit
                </button>
                <button style={{
                  backgroundColor: "transparent",
                  border: "1px solid #6b7280",
                  color: "#6b7280",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "transparent";
                }}>
                  Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;