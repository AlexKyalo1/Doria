import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";


const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {

      const res = await apiFetch("http://127.0.0.1:8000/api/accounts/token/", {
        method: "POST",        
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        

      });

      const data = await res.json();

      if (res.status === 200) {
        // Store the access token
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);        

        setStatus("success");
        setMessage(`✅ Login successful!`);
        setUsername("");
        setPassword("");
        setShowModal(true); // show modal on success
      } else {
        setStatus("error");
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("❌ Error connecting to server");
    }
  };

  // Auto-close modal after 3 seconds
  useEffect(() => {
    if (showModal) {
      const timer = setTimeout(() => {
        setShowModal(false);
        navigate("/profile");   // 🔥 redirect here
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showModal, navigate]);

  const getMessageColor = () => {
    if (status === "success") return "#0f5132"; // green
    if (status === "error") return "#842029";   // red
    return "#6c757d"; // neutral gray
  };

  return (
    <div style={{
      minHeight: "90vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f4fdf6",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        backgroundColor: "white",
        padding: "40px",
        borderRadius: "15px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: "350px"
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
            <span role="img" aria-label="shield">🛡️</span> Doria
          </h1>

          <h2 style={{
            color: "#0f5132",
            marginBottom: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px"
          }}>
            <span role="img" aria-label="lock">🔒</span> Login
          </h2>
        </div>



        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column" }}>
          <label htmlFor="username" style={{ marginBottom: "5px" }}>Username</label>
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
              marginBottom: "15px",
              borderRadius: "8px",
              border: "1px solid #ccc"
            }}
          />
          <label htmlFor="password" style={{ marginBottom: "5px" }}>Password</label>
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              padding: "10px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "1px solid #ccc"
            }}
          />
          <button type="submit" style={{
            padding: "12px",
            backgroundColor: status === "loading" ? "#6c757d" : "#0f5132",
            color: "white",
            fontWeight: "bold",
            border: "none",
            borderRadius: "8px",
            cursor: status === "loading" ? "not-allowed" : "pointer"
          }}
          disabled={status === "loading"}>
            {status === "loading" ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Convenience buttons */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "20px"
        }}>
          <button style={{
            background: "none",
            border: "none",
            color: "#0f5132",
            cursor: "pointer",
            fontWeight: "bold"
          }}>
            Register
          </button>
          <button style={{
            background: "none",
            border: "none",
            color: "#842029",
            cursor: "pointer",
            fontWeight: "bold"
          }}>
            Forgot Password?
          </button>
        </div>

      </div>

      {/* Success Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          animation: "fadeIn 0.5s"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "12px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            animation: "scaleUp 0.4s ease"
          }}>
            <h3 style={{ color: "#0f5132" }}>🎉 Login Successful!</h3>
            {message && (
              <p style={{
                marginTop: "15px",
                color: getMessageColor(),
                textAlign: "center",
                fontWeight: "bold"
              }}>
                {message}
              </p>
            )}
            <button onClick={() => setShowModal(false)} style={{
              marginTop: "20px",
              padding: "10px 20px",
              backgroundColor: "#0f5132",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer"
            }}>
              Close
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
        `}
      </style>
    </div>
  );
};

export default LoginPage;
