import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function phoneToEmail(phone) {
    const cleaned = phone.replace(/\D/g, "");
    return `${cleaned}@cafe.com`;
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 8 || cleaned.length > 15) {
      setError("Please enter a valid phone number.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password,
      options: {
        data: { name, phone: cleaned, role: "customer" },
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        setError("This phone number is already registered. Please sign in.");
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    navigate("/login");
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>☕</div>
        <h1 style={styles.title}>Create Account</h1>
        <p style={styles.subtitle}>Start collecting rewards with us today!</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleRegister} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 020 XXXXXXXX"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              minLength={6}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p style={styles.loginText}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #2B1810 0%, #140B07 100%)",
    padding: "20px",
    fontFamily: "'Segoe UI', Roboto, sans-serif",
  },
  card: {
    background: "white",
    borderRadius: "24px",
    padding: "40px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
    textAlign: "center",
  },
  logo: { fontSize: "50px", marginBottom: "10px" },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#2B1810",
    margin: "0",
  },
  subtitle: { color: "#777", marginBottom: "30px", fontSize: "14px" },
  error: {
    background: "#fff5f5",
    color: "#e53e3e",
    padding: "12px",
    borderRadius: "10px",
    marginBottom: "20px",
    fontSize: "14px",
    border: "1px solid #fed7d7",
    textAlign: "left",
  },
  form: { textAlign: "left" },
  field: { marginBottom: "22px" },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: "600",
    color: "#444",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1.5px solid #e2e8f0",
    fontSize: "16px",
    boxSizing: "border-box",
    background: "#f8fafc",
    outline: "none",
  },
  button: {
    width: "100%",
    padding: "15px",
    background: "linear-gradient(135deg, #E46A25 0%, #C25218 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "10px",
    boxShadow: "0 4px 12px rgba(228, 106, 37, 0.3)",
  },
  loginText: { marginTop: "24px", color: "#777", fontSize: "14px" },
  link: { color: "#E46A25", fontWeight: "bold", textDecoration: "none" },
};
