import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { ACCOUNTS_API_BASE } from "../utils/apiBase";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showForgotPasswordHelp, setShowForgotPasswordHelp] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await apiFetch(`${ACCOUNTS_API_BASE}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.status === 200) {
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);

        setStatus("success");
        setMessage("Login successful.");
        setUsername("");
        setPassword("");
        setShowPassword(false);
        setShowModal(true);
      } else {
        setStatus("error");
        setMessage(data.error ? `Login failed: ${data.error}` : "Login failed.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Error connecting to server.");
    }
  };

  useEffect(() => {
    if (!showModal) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowModal(false);
      navigate("/profile");
    }, 3000);

    return () => clearTimeout(timer);
  }, [showModal, navigate]);

  const getMessageColor = () => {
    if (status === "success") return "#0f5132";
    if (status === "error") return "#842029";
    return "#6c757d";
  };

  const hexPatternStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={hexPatternStyle}></div>
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(5px)",
          padding: "28px",
          borderRadius: "14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          width: "320px",
          border: "1px solid rgba(15, 81, 50, 0.1)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h1
            style={{
              color: "#0f5132",
              marginBottom: "10px",
              fontFamily: "Georgia, serif",
              letterSpacing: "1.5px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Doria
          </h1>

          <h2
            style={{
              color: "#0f5132",
              marginBottom: "0",
              fontSize: "1.35rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Login
          </h2>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column" }}>
          <label htmlFor="username" style={{ marginBottom: "5px" }}>
            Username
          </label>
          <input
            id="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            style={{
              padding: "10px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
          <label htmlFor="password" style={{ marginBottom: "5px" }}>
            Password
          </label>
          <div
            style={{
              position: "relative",
              marginBottom: "16px",
            }}
          >
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                padding: "10px 64px 10px 10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "none",
                color: "#0f5132",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="submit"
            style={{
              padding: "12px",
              backgroundColor: status === "loading" ? "#6c757d" : "#0f5132",
              color: "white",
              fontWeight: "bold",
              border: "none",
              borderRadius: "8px",
              cursor: status === "loading" ? "not-allowed" : "pointer",
            }}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Logging in..." : "Login"}
          </button>
        </form>

        {message && !showModal ? (
          <p
            style={{
              marginTop: "16px",
              padding: "10px 12px",
              color: getMessageColor(),
              textAlign: "center",
              fontWeight: "600",
              backgroundColor:
                status === "success"
                  ? "rgba(15, 81, 50, 0.1)"
                  : status === "error"
                    ? "rgba(132, 32, 41, 0.1)"
                    : "transparent",
              borderRadius: "8px",
            }}
          >
            {message}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/register")}
            style={{
              background: "none",
              border: "none",
              color: "#0f5132",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setShowForgotPasswordHelp(true)}
            style={{
              background: "none",
              border: "none",
              color: "#842029",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Forgot Password?
          </button>
        </div>
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            animation: "fadeIn 0.5s",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "12px",
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              animation: "scaleUp 0.4s ease",
            }}
          >
            <h3 style={{ color: "#0f5132" }}>Login Successful</h3>
            {message && (
              <p
                style={{
                  marginTop: "15px",
                  color: getMessageColor(),
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {message}
              </p>
            )}
            <button
              onClick={() => setShowModal(false)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                backgroundColor: "#0f5132",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showForgotPasswordHelp && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ color: "#0f5132", marginTop: 0 }}>Password recovery</h3>
            <p style={{ color: "#334155", lineHeight: 1.5 }}>
              Email reset is not configured for this installation yet, so Doria cannot send
              password recovery links automatically.
            </p>
            <p style={{ color: "#334155", lineHeight: 1.5, marginBottom: "10px" }}>
              For now, use one of these safe recovery options:
            </p>
            <ul style={{ color: "#334155", paddingLeft: "20px", lineHeight: 1.6 }}>
              <li>Ask a system admin to reset the password from Django admin.</li>
              <li>On the server, run <code>python manage.py changepassword &lt;username&gt;</code>.</li>
              <li>After SMTP is configured, we can add standard email reset links.</li>
            </ul>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => setShowForgotPasswordHelp(false)}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "#0f5132",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
        `}
      </style>
    </div>
  );
};

export default LoginPage;
