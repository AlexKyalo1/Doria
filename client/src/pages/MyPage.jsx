import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

const MyPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("http://127.0.0.1:8000/api/items/")
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{
      padding: "40px",
      backgroundColor: "#f4fdf6",
      minHeight: "90vh",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{ color: "#0f5132", marginBottom: "20px" }}>Welcome to Home Page</h1>

      {loading ? (
        <p style={{ color: "#0f5132" }}>Loading items...</p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "20px"
        }}>
          {items.map(item => (
            <div key={item.id} style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "10px",
              boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
              textAlign: "center",
              color: "#0f5132",
              fontWeight: "bold"
            }}>
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPage;