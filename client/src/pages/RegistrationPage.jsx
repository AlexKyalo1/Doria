import React, { useState } from "react";

const RegistrationPage = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("❌ Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, confirm_password: confirmPassword }),
      });

      const data = await res.json();

      if (res.status === 201) {
        setStatus("success");
        setMessage(`✅ Account created for ${data.user.username}!`);
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setShowModal(true);
      } else {
        // DRF returns a dict of field errors
        const errorMessages = Object.values(data)
            .flat()
            .join(" | "); // Join multiple errors

        setStatus("error");
        setMessage(`❌ ${errorMessages || "Registration failed"}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("❌ Error connecting to server");
    }
  };

  const getMessageColor = () => {
    if (status === "success") return "#0f5132"; // green
    if (status === "error") return "#842029";   // red
    return "#6c757d"; // neutral gray
  };

  // Hex pattern background style
  const hexPatternStyle = {
    position: "fixed",
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
      ),
      linear-gradient(135deg, #f8fdf9 0%, #eefaf2 100%)
    `,
    zIndex: -1,
  };

  return (
    <div style={{
      minHeight: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Arial, sans-serif",
      position: "relative",
    }}>
      {/* Hex pattern background */}
      <div style={hexPatternStyle}></div>
      
      <div style={{
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(5px)",
        padding: "40px",
        borderRadius: "15px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        width: "400px",
        border: "1px solid rgba(15, 81, 50, 0.1)",
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <h1 style={{
            color: "#0f5132",
            marginBottom: "10px",
            fontFamily: "Georgia, serif",
            letterSpacing: "2px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px"
          }}>
            🛡️ Doria
          </h1>
          <h2 style={{
            color: "#0f5132",
            marginBottom: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            fontSize: "24px",
            fontWeight: "600",
          }}>
            ✍️ Register
          </h2>
          <div style={{
            width: "50px",
            height: "2px",
            backgroundColor: "#0f5132",
            margin: "15px auto 0",
            opacity: 0.3,
          }}></div>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column" }}>
          <label htmlFor="username" style={{ 
            marginBottom: "5px",
            fontWeight: "500",
            color: "#1f2937",
            fontSize: "14px",
          }}>Username</label>
          <input
            id="username"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            style={{
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "15px",
              transition: "border-color 0.2s",
              outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "#0f5132"}
            onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
          />

          <label htmlFor="email" style={{ 
            marginBottom: "5px",
            fontWeight: "500",
            color: "#1f2937",
            fontSize: "14px",
          }}>Email</label>
          <input
            id="email"
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "15px",
              transition: "border-color 0.2s",
              outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "#0f5132"}
            onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
          />

          <label htmlFor="password" style={{ 
            marginBottom: "5px",
            fontWeight: "500",
            color: "#1f2937",
            fontSize: "14px",
          }}>Password</label>
          <input
            id="password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              padding: "12px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "15px",
              transition: "border-color 0.2s",
              outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "#0f5132"}
            onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
          />

          <label htmlFor="confirmPassword" style={{ 
            marginBottom: "5px",
            fontWeight: "500",
            color: "#1f2937",
            fontSize: "14px",
          }}>Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              padding: "12px",
              marginBottom: "25px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "15px",
              transition: "border-color 0.2s",
              outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "#0f5132"}
            onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
          />

          <button 
            type="submit" 
            style={{
              padding: "14px",
              backgroundColor: status === "loading" ? "#6c757d" : "#0f5132",
              color: "white",
              fontWeight: "600",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              cursor: status === "loading" ? "not-allowed" : "pointer",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 6px rgba(15, 81, 50, 0.2)",
            }}
            disabled={status === "loading"}
            onMouseEnter={(e) => {
              if (status !== "loading") {
                e.target.style.backgroundColor = "#0b5e3c";
                e.target.style.transform = "scale(1.02)";
              }
            }}
            onMouseLeave={(e) => {
              if (status !== "loading") {
                e.target.style.backgroundColor = "#0f5132";
                e.target.style.transform = "scale(1)";
              }
            }}
          >
            {status === "loading" ? (
              <div style={{
                border: "3px solid rgba(255,255,255,0.3)",
                borderTop: "3px solid white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                animation: "spin 1s linear infinite"
              }}></div>
            ) : "Register"}
          </button>
        </form>

        {message && !showModal && (
          <p style={{
            marginTop: "20px",
            padding: "10px",
            color: getMessageColor(),
            textAlign: "center",
            fontWeight: "500",
            backgroundColor: status === "success" ? "rgba(15, 81, 50, 0.1)" : 
                           status === "error" ? "rgba(132, 32, 41, 0.1)" : "transparent",
            borderRadius: "6px",
          }}>
            {message}
          </p>
        )}

        <p style={{
          marginTop: "20px",
          textAlign: "center",
          fontSize: "14px",
          color: "#6b7280",
        }}>
          Already have an account?{" "}
          <button
            onClick={() => window.location.href = "/login"}
            style={{
              background: "none",
              border: "none",
              color: "#0f5132",
              fontWeight: "600",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Sign in
          </button>
        </p>
      </div>

      {/* Success Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          animation: "fadeIn 0.3s",
          zIndex: 1000,
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "40px",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            animation: "scaleUp 0.4s ease",
            maxWidth: "400px",
            border: "1px solid rgba(15, 81, 50, 0.2)",
          }}>
            <div style={{
              fontSize: "60px",
              marginBottom: "20px",
            }}>🎖️</div>
            <h3 style={{ 
              color: "#0f5132",
              fontSize: "24px",
              marginBottom: "15px",
            }}>Registration Successful!</h3>
            {message && (
              <p style={{
                marginTop: "10px",
                color: "#0f5132",
                fontSize: "16px",
              }}>
                {message}
              </p>
            )}
            <button 
              onClick={() => {
                setShowModal(false);
                window.location.href = "/login";
              }} 
              style={{
                marginTop: "25px",
                padding: "12px 30px",
                backgroundColor: "#0f5132",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#0b5e3c";
                e.target.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#0f5132";
                e.target.style.transform = "scale(1)";
              }}
            >
              Proceed to Login
            </button>
          </div>
        </div>
      )}

      {/* Inline CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleUp {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default RegistrationPage;