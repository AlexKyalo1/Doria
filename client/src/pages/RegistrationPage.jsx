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
        width: "400px"
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
            gap: "8px"
          }}>
            ✍️ Register
          </h2>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column" }}>
          <label htmlFor="username" style={{ marginBottom: "5px" }}>Username</label>
          <input
            id="username"
            type="text"
            placeholder="Choose a username"
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

          <label htmlFor="email" style={{ marginBottom: "5px" }}>Email</label>
          <input
            id="email"
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
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
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "8px",
              border: "1px solid #ccc"
            }}
          />

          <label htmlFor="confirmPassword" style={{ marginBottom: "5px" }}>Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
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
            cursor: status === "loading" ? "not-allowed" : "pointer",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
          disabled={status === "loading"}>
            {status === "loading" ? (
              <div style={{
                border: "3px solid #f3f3f3",
                borderTop: "3px solid white",
                borderRadius: "50%",
                width: "16px",
                height: "16px",
                animation: "spin 1s linear infinite"
              }}></div>
            ) : "Register"}
          </button>
        </form>

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
            <h3 style={{ color: "#0f5132" }}>🎖️ Registration Successful!</h3>
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
