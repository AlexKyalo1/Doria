import React, { useEffect, useState } from "react";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      setStatus("loading");
      try {
        const res = await fetch("http://127.0.0.1:8000/api/accounts/profile/", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // important for session cookies
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
  }, []);

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
        width: "400px",
        textAlign: "center"
      }}>
        <h1 style={{
          color: "#0f5132",
          marginBottom: "20px",
          fontFamily: "Georgia, serif",
          letterSpacing: "2px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px"
        }}>
          🛡️ Doria Profile
        </h1>

        {status === "loading" && <p>Loading profile...</p>}
        {status === "error" && <p style={{ color: "#842029" }}>{message}</p>}
        {status === "success" && user && (
          <div>
            <p><strong>👤 Username:</strong> {user.username}</p>
            <p><strong>📧 Email:</strong> {user.email}</p>
            {/* Add more fields if your serializer exposes them */}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
