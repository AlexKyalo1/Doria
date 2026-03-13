import React, { useEffect, useState } from "react";
import { useColorMode } from "../utils/useColorMode";
import { apiFetch } from "../utils/apiFetch";

const ProfileEditPage = () => {
  const { isDark } = useColorMode();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    first_name: "",
    last_name: "",
    last_login: "",
  });
  const [errors, setErrors] = useState({});
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const fetchProfile = async () => {
      setStatus("loading");
      try {
        const res = await apiFetch("http://127.0.0.1:8000/api/accounts/profile/update/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.status === 200) {
          setUser(data.user);
          setFormData({
            username: data.user.username || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
            location: data.user.location || "",
            bio: data.user.bio || "",
            first_name: data.user.first_name || "",
            last_name: data.user.last_name || "",
            last_login: data.user.last_login || "",
          });
          setStatus("success");
        } else {
          setStatus("error");
          showAlert("error", data.error || "Failed to load profile");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        showAlert("error", "Error connecting to server");
      }
    };
    fetchProfile();
  }, [token]);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: "", message: "" }), 3000);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = "Username is required";
    else if (formData.username.length < 3) newErrors.username = "Username must be at least 3 characters";
    else if (formData.username.length > 20) newErrors.username = "Username must be less than 20 characters";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!emailRegex.test(formData.email)) newErrors.email = "Please enter a valid email address";

    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/\s/g, ""))) newErrors.phone = "Enter a valid phone number";

    if (formData.bio && formData.bio.length > 200) newErrors.bio = "Bio must be less than 200 characters";

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showAlert("error", "Please fix the errors in the form");
      return;
    }

    setSaveStatus("loading");
    try {
      const res = await apiFetch("http://127.0.0.1:8000/api/accounts/profile/update/", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.status === 200) {
        setSaveStatus("success");
        setUser(data.user);
        showAlert("success", "Profile updated successfully!");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        showAlert("error", data.error || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      showAlert("error", "Error connecting to server");
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        location: user.location || "",
        bio: user.bio || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
      });
      setErrors({});
      showAlert("info", "Changes discarded");
    }
  };

  return (
    <div style={{ ...container, background: isDark ? "linear-gradient(135deg, #0b1220 0%, #111827 100%)" : container.background }}>
      {alert.show && <Alert type={alert.type} message={alert.message} />}

      <div style={{ ...card, backgroundColor: isDark ? "#111827" : card.backgroundColor, border: isDark ? "1px solid #374151" : "none" }}>
        <Header />
        {status === "success" && user && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <InputField label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} error={errors.first_name} />
                <InputField label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} error={errors.last_name} />
              </div>

              <InputField
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                required
                note="3-20 characters"
              />
              <InputField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <InputField label="Phone" name="phone" value={formData.phone} onChange={handleChange} error={errors.phone} />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <SaveButton loading={saveStatus === "loading"} />
                <CancelButton onClick={handleCancel} disabled={saveStatus === "loading"} />
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Header = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "16px",
      borderBottom: "2px solid #e8f5e9",
      paddingBottom: "12px",
    }}
  >
    <div
      style={{
        width: "36px",
        height: "36px",
        backgroundColor: "#0f5132",
        borderRadius: "8px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "18px",
      }}
    >
      {"\u270f\ufe0f"}
    </div>
    <div>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0f5132" }}>Edit Profile</h2>
      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>Update your personal information</p>
    </div>
  </div>
);

const InputField = ({ label, name, value, onChange, error, type = "text", required = false, note = "" }) => (
  <div>
    <label
      style={{
        display: "block",
        fontSize: "11px",
        fontWeight: "600",
        color: "#4b5563",
        marginBottom: "4px",
        textTransform: "uppercase",
        letterSpacing: "0.3px",
      }}
    >
      {label} {required && <span style={{ color: "#dc3545" }}>*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={`Enter ${label.toLowerCase()}`}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        border: `2px solid ${error ? "#dc3545" : "#e2e8f0"}`,
        fontSize: "14px",
        outline: "none",
        backgroundColor: error ? "#fff5f5" : "#ffffff",
      }}
    />
    {note && <p style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px" }}>{note}</p>}
    {error && <ErrorText message={error} />}
  </div>
);

const ErrorText = ({ message }) => (
  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#dc3545", display: "flex", alignItems: "center", gap: "4px" }}>
    {"\u26a0\ufe0f"} {message}
  </p>
);

const SaveButton = ({ loading }) => (
  <button
    type="submit"
    disabled={loading}
    style={{
      flex: 2,
      backgroundColor: loading ? "#94a3b8" : "#0f5132",
      color: "white",
      border: "none",
      padding: "12px",
      borderRadius: "8px",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      cursor: loading ? "not-allowed" : "pointer",
      opacity: loading ? 0.7 : 1,
    }}
  >
    {loading ? (
      <div
        style={{
          width: "16px",
          height: "16px",
          border: "2px solid white",
          borderTop: "2px solid transparent",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
    ) : (
      `${"\ud83d\udcbe"} Save Changes`
    )}
  </button>
);

const CancelButton = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      flex: 1,
      backgroundColor: "white",
      border: "2px solid #e2e8f0",
      color: "#4b5563",
      padding: "12px",
      borderRadius: "8px",
      fontWeight: "500",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }}
  >
    Cancel
  </button>
);

const Alert = ({ type, message }) => (
  <div
    style={{
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: 1000,
      animation: "slideIn 0.3s ease-out",
      backgroundColor: type === "success" ? "#d1e7dd" : type === "error" ? "#fdf1f0" : "#e8f5e9",
      borderLeft: `4px solid ${type === "success" ? "#0f5132" : type === "error" ? "#dc3545" : "#0f5132"}`,
      padding: "12px 16px",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minWidth: "280px",
    }}
  >
    <span style={{ fontSize: "20px" }}>
      {type === "success" ? "\u2714" : type === "error" ? "\u26a0\ufe0f" : "\u2139\ufe0f"}
    </span>
    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: type === "success" ? "#0f5132" : type === "error" ? "#842029" : "#0f5132" }}>
      {message}
    </p>
  </div>
);

const container = {
  minHeight: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "linear-gradient(135deg, #f4fdf6 0%, #e8f5e9 100%)",
  fontFamily: "'Inter', -apple-system, sans-serif",
  padding: "16px",
  boxSizing: "border-box",
};

const card = {
  backgroundColor: "white",
  padding: "32px",
  borderRadius: "16px",
  boxShadow: "0 10px 30px rgba(15, 81, 50, 0.15)",
  width: "520px",
  maxWidth: "100%",
  boxSizing: "border-box",
};

export default ProfileEditPage;
