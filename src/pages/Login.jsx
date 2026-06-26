import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import logoImg from "../assets/Logo_Pun.png"; // Adjust the path to your logo file

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function phoneToEmail(phone) {
    const cleaned = phone.replace(/\D/g, "");
    return `${cleaned}@cafe.com`;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });

    if (error) {
      setError("Invalid phone number or password.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "customer") navigate("/dashboard");
    else if (profile?.role === "staff" || profile?.role === "admin")
      navigate("/scanner");
    else navigate("/");
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img src={logoImg} alt="Pun Cafe Logo" style={styles.logoImage} />
        </div>
        <h1 style={styles.title}>Pun Cafe</h1>
        <p style={styles.subtitle}>Sign in to earn & loyalty loyalty points</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
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
              placeholder="Enter your password"
              required
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={styles.registerText}>
          Don't have an account?{" "}
          <Link to="/register" style={styles.link}>
            Sign Up Now
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
    background: "#ffffff",
    borderRadius: "24px",
    padding: "40px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
    textAlign: "center",
  },
  logoContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "16px",
  },
  logoImage: {
    width: "100px",
    height: "100px",
    borderRadius: "20px",
    objectFit: "cover",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
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
    transition: "all 0.3s ease",
    outline: "none",
    background: "#f8fafc",
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
  registerText: { marginTop: "24px", color: "#777", fontSize: "14px" },
  link: { color: "#E46A25", fontWeight: "bold", textDecoration: "none" },
};
