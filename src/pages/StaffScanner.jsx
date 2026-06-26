import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Html5Qrcode } from "html5-qrcode";

export default function StaffScanner() {
  const { profile, signOut } = useAuth();
  const [mode, setMode] = useState("points"); // points | voucher
  const [scanning, setScanning] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [cups, setCups] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [staffMembers, setStaffMembers] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  async function fetchStaffMembers() {
    if (!profile?.branch_id) return;
    const { data } = await supabase
      .from("staff_members")
      .select("*")
      .eq("branch_id", profile.branch_id)
      .eq("active", true)
      .order("name");
    setStaffMembers(data || []);
  }

  useEffect(() => {
    if (scanning) startScanner();
    else stopScanner();
    return () => stopScanner();
  }, [scanning]);

  async function startScanner() {
    html5QrRef.current = new Html5Qrcode("qr-reader");
    try {
      await html5QrRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {},
      );
    } catch (err) {
      setErrorMsg(
        "Unable to access the camera. Please grand camera permissions.",
      );
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch (_) {}
      html5QrRef.current = null;
    }
  }

  async function onScanSuccess(scannedValue) {
    await stopScanner();
    setScanning(false);

    if (scannedValue.startsWith("VOUCHER:")) {
      const voucherId = scannedValue.replace("VOUCHER:", "");
      await handleScanVoucher(voucherId);
    } else {
      await handleScanCustomer(scannedValue);
    }
  }

  // Scan Customer QR (Add Points)
  async function handleScanCustomer(customerId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", customerId)
      .eq("role", "customer")
      .single();

    if (error || !data) {
      setErrorMsg("Customer data not found. Please try again.");
      return;
    }

    setCustomer(data);
    setVoucher(null);
    setErrorMsg("");
  }

  // Scan Voucher QR
  async function handleScanVoucher(voucherId) {
    const { data, error } = await supabase
      .from("vouchers")
      .select("*, customer:customer_id(name, phone)")
      .eq("id", voucherId)
      .single();

    if (error || !data) {
      setErrorMsg("Voucher not found. Please try again.");
      return;
    }

    if (data.status === "used") {
      setErrorMsg("❌ This voucher has already been used!");
      return;
    }

    setVoucher(data);
    setCustomer(null);
    setErrorMsg("");
  }

  // Add Points Process
  async function handleAddPoints() {
    if (!customer) return;
    if (!selectedStaff) {
      setErrorMsg("Please select a staff member first.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.rpc("add_points", {
      p_customer_id: customer.id,
      p_staff_id: profile.id,
      p_cups: cups,
      p_staff_name: selectedStaff,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("An error occurred. Please try again.");
      return;
    }

    if (data.redeemed) {
      setSuccessMsg(`🎉 Added ${cups} points! Customer gets 1 FREE cup!`);
    } else {
      setSuccessMsg(
        `✅ Added ${cups} points successfully! (${data.points_before} → ${data.points_after} pts)`,
      );
    }

    setTimeout(() => {
      setCustomer(null);
      setCups(1);
      setSelectedStaff("");
      setSuccessMsg("");
    }, 3000);
  }

  // Redeem Voucher Process
  async function handleUseVoucher() {
    if (!voucher) return;
    if (!selectedStaff) {
      setErrorMsg("Please select a staff member first.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase.rpc("use_voucher", {
      p_voucher_id: voucher.id,
      p_staff_id: profile.id,
    });

    setLoading(false);

    if (error || !data.success) {
      setErrorMsg(data?.message || "An error occurred. Please try again.");
      return;
    }

    setSuccessMsg(
      `✅ Voucher redeemed! 1 Free drink rewarded to ${voucher.customer?.name} 🎉`,
    );

    setTimeout(() => {
      setVoucher(null);
      setSelectedStaff("");
      setSuccessMsg("");
    }, 3000);
  }

  function resetAll() {
    setCustomer(null);
    setVoucher(null);
    setErrorMsg("");
    setSelectedStaff("");
    setCups(1);
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <p style={styles.role}>Staff Account 👨‍💼</p>
          <h2 style={styles.name}>{profile?.name}</h2>
          <p style={styles.branch}>
            📍 {profile?.branches?.name || "No Branch Assigned"}
          </p>
        </div>
        <button onClick={signOut} style={styles.signOutBtn}>
          Sign Out
        </button>
      </div>

      {/* Mode Tab */}
      <div style={styles.modeRow}>
        <button
          onClick={() => {
            setMode("points");
            resetAll();
          }}
          style={{
            ...styles.modeBtn,
            ...(mode === "points" ? styles.modeBtnActive : {}),
          }}
        >
          ☕ Add Points
        </button>
        <button
          onClick={() => {
            setMode("voucher");
            resetAll();
          }}
          style={{
            ...styles.modeBtn,
            ...(mode === "voucher" ? styles.modeBtnVoucher : {}),
          }}
        >
          🎁 Free Drink
        </button>
      </div>

      {/* Alerts */}
      {successMsg && <div style={styles.successAlert}>{successMsg}</div>}
      {errorMsg && <div style={styles.errorAlert}>{errorMsg}</div>}

      {/* ===== Camera Area ===== */}
      {!customer && !voucher && (
        <div style={styles.scanCard}>
          {!scanning && (
            <>
              <div style={styles.scanIcon}>
                {mode === "points" ? "📷" : "🎁"}
              </div>
              <p style={styles.scanTitle}>
                {mode === "points" ? "Scan Customer QR" : "Scan Voucher QR"}
              </p>
              <p style={styles.scanSubtitle}>
                {mode === "points"
                  ? "Tap the button below to launch scanner"
                  : "Scan the QR from customer's 'Free Reward' tab"}
              </p>
              <button
                onClick={() => setScanning(true)}
                style={{
                  ...styles.scanBtn,
                  background:
                    mode === "voucher"
                      ? "linear-gradient(135deg, #b85c38 0%, #a34a27 100%)"
                      : "linear-gradient(135deg, #4e3629 0%, #3d2516 100%)",
                }}
              >
                Open Camera Scanner
              </button>
            </>
          )}
          {scanning && (
            <div style={styles.cameraWrap}>
              <div id="qr-reader" ref={scannerRef} style={styles.qrReader} />
              <button
                onClick={() => setScanning(false)}
                style={styles.cancelBtn}
              >
                ✕ Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== Points Mode Card ===== */}
      {customer && (
        <div style={styles.customerCard}>
          <p style={styles.customerLabel}>Customer Info Verified ✅</p>
          <h3 style={styles.customerName}>{customer.name}</h3>
          <p style={styles.customerPhone}>
            📞 {customer.phone || "No phone number"}
          </p>

          <div style={styles.pointsBadge}>
            <span style={styles.pointsNum}>{customer.points}</span>
            <span style={styles.pointsText}> / 10 Points</span>
            <div style={styles.progressBg}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(customer.points / 10) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Staff Assignment */}
          <div style={styles.staffSection}>
            <p style={styles.staffLabel}>Attending Barista / Staff</p>
            {staffMembers.length > 0 ? (
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                style={styles.staffSelect}
              >
                <option value="">-- Select Staff Name --</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                placeholder="Enter staff name"
                style={styles.staffInput}
              />
            )}
          </div>

          {/* Cup Counter */}
          <div style={styles.cupsSection}>
            <p style={styles.cupsLabel}>Cups Purchased Today</p>
            <div style={styles.cupsControl}>
              <button
                onClick={() => setCups((c) => Math.max(1, c - 1))}
                style={styles.cupsBtn}
              >
                −
              </button>
              <span style={styles.cupsNum}>{cups}</span>
              <button
                onClick={() => setCups((c) => Math.min(10, c + 1))}
                style={styles.cupsBtn}
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleAddPoints}
            disabled={loading}
            style={{ ...styles.addBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? "Processing..."
              : `☕ Add ${cups} ${cups > 1 ? "Points" : "Point"}`}
          </button>
          <button onClick={resetAll} style={styles.rescanBtn}>
            Scan Another Code
          </button>
        </div>
      )}

      {/* ===== Voucher Mode Card ===== */}
      {voucher && (
        <div style={styles.customerCard}>
          <div style={styles.voucherFoundBadge}>🎁 Voucher Found!</div>
          <h3 style={styles.customerName}>{voucher.customer?.name}</h3>
          <p style={styles.customerPhone}>
            📞 {voucher.customer?.phone || "No phone number"}
          </p>

          <div style={styles.voucherDetailCard}>
            <p style={styles.voucherDetailIcon}>☕</p>
            <p style={styles.voucherDetailTitle}>1 Free Complementary Drink</p>
            <p style={styles.voucherDetailSub}>
              Issued on{" "}
              {new Date(voucher.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Staff Assignment */}
          <div style={styles.staffSection}>
            <p style={styles.staffLabel}>Attending Barista / Staff</p>
            {staffMembers.length > 0 ? (
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                style={styles.staffSelect}
              >
                <option value="">-- Select Staff Name --</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                placeholder="Enter staff name"
                style={styles.staffInput}
              />
            )}
          </div>

          <button
            onClick={handleUseVoucher}
            disabled={loading}
            style={{ ...styles.voucherConfirmBtn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Processing..." : "✅ Confirm Free Reward"}
          </button>
          <button onClick={resetAll} style={styles.rescanBtn}>
            Scan Another Code
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#faf8f5",
    padding: "20px",
    width: "100%",
    maxWidth: "480px",
    margin: "0 auto",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Roboto, Helvetica, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  role: { color: "#8a7e72", margin: 0, fontSize: "13px", fontWeight: "500" },
  name: {
    color: "#2b1a11",
    margin: "4px 0",
    fontSize: "22px",
    fontWeight: "bold",
  },
  branch: { color: "#634832", margin: 0, fontSize: "13px", fontWeight: "600" },
  signOutBtn: {
    background: "none",
    border: "1.5px solid #decbba",
    borderRadius: "8px",
    padding: "8px 14px",
    cursor: "pointer",
    color: "#8a7e72",
    fontSize: "13px",
    fontWeight: "500",
  },

  // Mode Tab
  modeRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
  },
  modeBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    border: "1.5px solid #decbba",
    background: "white",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    color: "#7a6a5c",
    transition: "all 0.2s ease",
  },
  modeBtnActive: {
    background: "linear-gradient(135deg, #5c4033 0%, #3d2516 100%)",
    color: "white",
    border: "none",
  },
  modeBtnVoucher: {
    background: "linear-gradient(135deg, #b85c38 0%, #a34a27 100%)",
    color: "white",
    border: "none",
  },

  successAlert: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "16px",
    fontWeight: "600",
    textAlign: "center",
  },
  errorAlert: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "16px",
    textAlign: "center",
    fontWeight: "500",
  },

  // Scan Card
  scanCard: {
    background: "white",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 4px 14px rgba(61,37,22,0.05)",
    minHeight: "65vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px 24px",
    width: "100%",
    boxSizing: "border-box",
  },
  scanIcon: { fontSize: "64px", marginBottom: "16px" },
  scanTitle: {
    color: "#2b1a11",
    fontSize: "22px",
    fontWeight: "bold",
    margin: "0 0 8px",
    textAlign: "center",
  },
  scanSubtitle: {
    color: "#8a7e72",
    margin: "0 0 32px",
    fontSize: "14px",
    textAlign: "center",
    lineHeight: "1.4",
  },
  scanBtn: {
    color: "white",
    border: "none",
    borderRadius: "14px",
    padding: "18px 0",
    fontSize: "17px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  cameraWrap: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
  qrReader: { width: "100%", borderRadius: "12px", overflow: "hidden" },
  cancelBtn: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "none",
    borderRadius: "12px",
    padding: "14px 0",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
  },

  // Customer Card
  customerCard: {
    background: "white",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 4px 14px rgba(61,37,22,0.05)",
  },
  customerLabel: {
    color: "#166534",
    fontSize: "13px",
    fontWeight: "600",
    margin: "0 0 4px",
  },
  customerName: {
    color: "#2b1a11",
    fontSize: "26px",
    fontWeight: "bold",
    margin: "0 0 4px",
  },
  customerPhone: { color: "#8a7e72", fontSize: "14px", margin: "0 0 20px" },

  pointsBadge: {
    background: "linear-gradient(135deg, #5c4033 0%, #3d2516 100%)",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "center",
    marginBottom: "20px",
    color: "white",
    boxShadow: "0 4px 12px rgba(61,37,22,0.15)",
  },
  pointsNum: { fontSize: "52px", fontWeight: "bold" },
  pointsText: { fontSize: "18px", opacity: 0.8 },
  progressBg: {
    background: "rgba(255,255,255,0.25)",
    borderRadius: "999px",
    height: "8px",
    marginTop: "12px",
  },
  progressFill: {
    background: "#decbba",
    borderRadius: "999px",
    height: "8px",
    transition: "width 0.5s ease",
  },

  // Voucher Found
  voucherFoundBadge: {
    background: "linear-gradient(135deg, #b85c38 0%, #a34a27 100%)",
    color: "white",
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: "bold",
    display: "inline-block",
    marginBottom: "12px",
  },
  voucherDetailCard: {
    background: "linear-gradient(135deg, #2b1a11 0%, #1c100a 100%)",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "center",
    marginBottom: "20px",
    color: "white",
  },
  voucherDetailIcon: { fontSize: "40px", margin: "0 0 8px" },
  voucherDetailTitle: { fontSize: "20px", fontWeight: "bold", margin: 0 },
  voucherDetailSub: { fontSize: "13px", opacity: 0.6, margin: "6px 0 0" },

  // Staff Section
  staffSection: { marginBottom: "20px" },
  staffLabel: {
    fontWeight: "600",
    marginBottom: "8px",
    color: "#4e3629",
    fontSize: "14px",
  },
  staffSelect: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1.5px solid #decbba",
    fontSize: "15px",
    background: "white",
    color: "#2b1a11",
  },
  staffInput: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1.5px solid #decbba",
    fontSize: "15px",
    boxSizing: "border-box",
    color: "#2b1a11",
  },

  // Cups
  cupsSection: { marginBottom: "20px" },
  cupsLabel: {
    fontWeight: "600",
    marginBottom: "12px",
    color: "#4e3629",
    fontSize: "14px",
    textAlign: "center",
  },
  cupsControl: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "28px",
  },
  cupsBtn: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "2px solid #5c4033",
    background: "white",
    color: "#5c4033",
    fontSize: "24px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "all 0.15s ease",
  },
  cupsNum: {
    fontSize: "44px",
    fontWeight: "bold",
    color: "#2b1a11",
    minWidth: "56px",
    textAlign: "center",
  },

  addBtn: {
    width: "100%",
    padding: "18px",
    background: "linear-gradient(135deg, #5c4033 0%, #3d2516 100%)",
    color: "white",
    border: "none",
    borderRadius: "14px",
    fontSize: "17px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "12px",
    boxShadow: "0 4px 12px rgba(61,37,22,0.15)",
  },
  voucherConfirmBtn: {
    width: "100%",
    padding: "18px",
    background: "linear-gradient(135deg, #b85c38 0%, #a34a27 100%)",
    color: "white",
    border: "none",
    borderRadius: "14px",
    fontSize: "17px",
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: "12px",
    boxShadow: "0 4px 12px rgba(184,92,56,0.15)",
  },
  rescanBtn: {
    width: "100%",
    padding: "14px",
    background: "#f5ece4",
    color: "#E46A25",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    cursor: "pointer",
    fontWeight: "600",
  },
};
