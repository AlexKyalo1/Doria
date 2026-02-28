import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const logoContainer = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#0f5132",
  };
  return (
    <div style={containerStyle}>
      {/* Simple background lines */}
      <div style={linesOverlayStyle}></div>
      
      <header style={headerStyle}>
       <h1 style={logoStyle}>
          <span style={logoContainer}>
            🛡️ Doria
          </span>
        </h1>

        <nav aria-label="Main Navigation" style={navContainer}>
          <button
            style={navLoginButton}
            onClick={() => navigate("/login")}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
          >
            Login
          </button>

          <button
            style={navRegisterButton}
            onClick={() => navigate("/register")}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#0b5e3c")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#0f5132")}
          >
            Register
          </button>
        </nav>
      </header>

      <main style={mainStyle} id="main-content" tabIndex="-1">
        <div style={contentWrapperStyle}>
          <span style={badgeStyle}>✨ Welcome to Doria</span>
          
          <h2 style={headlineStyle}>
            Tambua <span style={accentStyle}>•</span> Chambua <span style={accentStyle}>•</span> Tatua
          </h2>

          <p style={descriptionStyle}>
            Discover insights, analyze information, and solve problems —
            all in one powerful platform.
          </p>

          <div style={blockButtonContainer}>
            <button
              style={secondaryBlockButton}
              onClick={() => navigate("/login")}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#e6f7ec";
                e.target.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "transparent";
                e.target.style.transform = "scale(1)";
              }}
            >
              Sign Back In →
            </button>
            <button
              style={primaryBlockButton}
              onClick={() => navigate("/register")}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#0b5e3c";
                e.target.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#198754";
                e.target.style.transform = "scale(1)";
              }}
            >
              Create Account
            </button>            
          </div>

          <div style={trustBadgesStyle}>
            <span style={trustItemStyle}>🔒 Secure</span>
            <span style={trustItemStyle}>⚡ Fast</span>
            <span style={trustItemStyle}>💡 Smart</span>
          </div>
        </div>
      </main>

      <footer style={footerStyle}>
        © {new Date().getFullYear()} Doria. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;

/* ================= STYLES ================= */

const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  background: "linear-gradient(135deg, #f8fdf9 0%, #eefaf2 100%)",
  position: "relative",
  overflow: "hidden",
};

// Simple diagonal lines overlay
const linesOverlayStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: `
    /* Hex pattern like tactical mesh */
    repeating-linear-gradient(
      45deg,
      rgba(15, 81, 50, 0.03) 0px,
      rgba(15, 81, 50, 0.03) 2px,
      transparent 2px,
      transparent 12px
    ),
    repeating-linear-gradient(
      -45deg,
      rgba(15, 81, 50, 0.03) 0px,
      rgba(15, 81, 50, 0.03) 2px,
      transparent 2px,
      transparent 12px
    )
  `,
  pointerEvents: "none",
  zIndex: 0,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 40px",
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(15, 81, 50, 0.1)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const logoStyle = {
  margin: 0,
  fontSize: "24px",
  fontWeight: "700",
  color: "#0f5132",
  letterSpacing: "-0.5px",
};

const navContainer = {
  display: "flex",
  gap: "12px",
};

const navLoginButton = {
  backgroundColor: "transparent",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  color: "#1f2937",
  fontWeight: "500",
  fontSize: "15px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const navRegisterButton = {
  backgroundColor: "#0f5132",
  color: "white",
  border: "none",
  padding: "8px 20px",
  borderRadius: "8px",
  fontWeight: "600",
  fontSize: "15px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 2px 4px rgba(15, 81, 50, 0.2)",
};

const mainStyle = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "40px 20px",
  position: "relative", // To appear above the lines
  zIndex: 1,
};

const contentWrapperStyle = {
  maxWidth: "600px",
  textAlign: "center",
  position: "relative", // To appear above the lines
};

const badgeStyle = {
  display: "inline-block",
  backgroundColor: "rgba(25, 135, 84, 0.1)",
  color: "#0f5132",
  padding: "6px 16px",
  borderRadius: "30px",
  fontSize: "14px",
  fontWeight: "500",
  marginBottom: "20px",
};

const headlineStyle = {
  fontSize: "32px",
  marginBottom: "20px",
  color: "#0f5132",
  fontWeight: "700",
  lineHeight: "1.3",
};

const accentStyle = {
  color: "#198754",
  margin: "0 4px",
};

const descriptionStyle = {
  fontSize: "18px",
  lineHeight: "1.6",
  maxWidth: "500px",
  margin: "0 auto 40px",
  color: "#4b5563",
};

const blockButtonContainer = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
  maxWidth: "320px",
  margin: "0 auto 40px",
};

const primaryBlockButton = {
  width: "100%",
  padding: "16px",
  backgroundColor: "#198754",
  color: "white",
  border: "none",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 6px rgba(25, 135, 84, 0.2)",
};

const secondaryBlockButton = {
  width: "100%",
  padding: "16px",
  backgroundColor: "transparent",
  color: "#0f5132",
  border: "2px solid #0f5132",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const trustBadgesStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "24px",
  marginTop: "20px",
};

const trustItemStyle = {
  fontSize: "14px",
  color: "#6b7280",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

const footerStyle = {
  textAlign: "center",
  padding: "24px",
  fontSize: "14px",
  color: "#9ca3af",
  borderTop: "1px solid rgba(15, 81, 50, 0.1)",
  position: "relative", // To appear above the lines
  zIndex: 1,
};