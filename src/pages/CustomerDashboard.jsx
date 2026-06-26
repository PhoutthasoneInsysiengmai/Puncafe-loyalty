import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { QRCodeSVG as QRCode } from "qrcode.react";

export default function CustomerDashboard() {
  const { user, profile, signOut } = useAuth();
  const [points, setPoints] = useState(0);
  const [totalCups, setTotalCups] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [redeemAlert, setRedeemAlert] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeTab, setActiveTab] = useState("points"); // points | voucher | history

  async function fetchTransactions() {
    const { data } = await supabase
      .from("transactions")
      .select(`*, branches(name), staff:staff_id(name)`)
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setTransactions(data || []);

    // เช็ค redeemed ล่าสุด
    if (data && data.length > 0) {
      const latest = data[0];
      const isJustRedeemed =
        latest.redeemed === true &&
        new Date() - new Date(latest.created_at) < 10000;
      if (isJustRedeemed) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 8000);
      }
    }
  }

  async function fetchVouchers() {
    const { data } = await supabase
      .from("vouchers")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    setVouchers(data || []);
  }

  useEffect(() => {
    if (!profile) return;
    setPoints(profile.points);
    setTotalCups(profile.total_cups);
    fetchTransactions();
    fetchVouchers();

    const channel = supabase
      .channel("profile-points")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setPoints(payload.new.points);
          setTotalCups(payload.new.total_cups);
          fetchTransactions();
          fetchVouchers(); // ← ดึง Voucher ใหม่ด้วย
        },
      )
      .subscribe();

    // Realtime Voucher — อัปเดตตอนพนักงานสแกนใช้
    const voucherChannel = supabase
      .channel("voucher-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vouchers",
          filter: `customer_id=eq.${user.id}`,
        },
        () => {
          fetchVouchers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(voucherChannel);
    };
  }, [profile]);

  const progressPercent = (points / 10) * 100;
  const pendingVouchers = vouchers.filter((v) => v.status === "pending");
  const usedVouchers = vouchers.filter((v) => v.status === "used");

  return (
    <div style={styles.container}>
      {/* Celebration Overlay */}
      {showCelebration && (
        <div style={styles.celebrationOverlay}>
          <div style={styles.celebrationCard}>
            <div style={styles.confettiRow}>
              {"Congratulations".split("").map((e, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "28px",
                    animation: `bounce 0.6s ease ${i * 0.1}s infinite alternate`,
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
            <div style={styles.celebrationEmoji}>☕</div>
            <h2 style={styles.celebrationTitle}>10 Cups Reached!</h2>
            <p style={styles.celebrationText}>
              You have earned 1 FREE reward drink.
            </p>
            <div style={styles.celebrationBadge}>🎁 1 FREE Cup!</div>
            <p style={styles.celebrationSub}>
              View your QR Voucher in the "Rewards" tab
            </p>
            <button
              onClick={() => {
                setShowCelebration(false);
                setActiveTab("voucher");
              }}
              style={styles.celebrationBtn}
            >
              View Voucher Now 🎊
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <p style={styles.greeting}>Welcome Back 👋</p>
          <h2 style={styles.name}>{profile?.name}</h2>
        </div>
        <button onClick={signOut} style={styles.signOutBtn}>
          Sign Out
        </button>
      </div>

      {/* Tab */}
      <div style={styles.tabRow}>
        <button
          onClick={() => setActiveTab("points")}
          style={{
            ...styles.tabBtn,
            ...(activeTab === "points" ? styles.tabBtnActive : {}),
          }}
        >
          ☕ Points
        </button>
        <button
          onClick={() => setActiveTab("voucher")}
          style={{
            ...styles.tabBtn,
            ...(activeTab === "voucher" ? styles.tabBtnActive : {}),
          }}
        >
          🎁 Rewards
          {pendingVouchers.length > 0 && (
            <span style={styles.badge}>{pendingVouchers.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={{
            ...styles.tabBtn,
            ...(activeTab === "history" ? styles.tabBtnActive : {}),
          }}
        >
          📋 History
        </button>
      </div>

      {/* ===== Tab: แต้ม ===== */}
      {activeTab === "points" && (
        <>
          {redeemAlert && (
            <div style={styles.redeemAlert}>
              🎉 Congratulations! You've claimed 1 FREE cup!
            </div>
          )}

          {/* Points Card */}
          <div style={styles.pointsCard}>
            <p style={styles.pointsLabel}>Loyalty Points</p>
            <div style={styles.pointsRow}>
              <span style={styles.pointsNumber}>{points}</span>
              <span style={styles.pointsMax}>/10</span>
            </div>
            <div style={styles.progressBg}>
              <div
                style={{ ...styles.progressFill, width: `${progressPercent}%` }}
              />
            </div>
            <p style={styles.progressText}>
              Only <b>{10 - points}</b> more points = ☕ 1 FREE Drink!
            </p>
            <div style={styles.cupsRow}>
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} style={styles.cupIcon}>
                  {i < points ? "☕" : "⬜"}
                </span>
              ))}
            </div>
            <p style={styles.totalCups}>Total purchased: {totalCups} cups</p>
          </div>

          {/* QR Code */}
          <div style={styles.qrCard}>
            <p style={styles.qrTitle}>Your QR Code</p>
            <p style={styles.qrSubtitle}>
              Show this to the barista to collect points
            </p>
            <div style={styles.qrBox}>
              <QRCode
                value={user?.id || ""}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>
        </>
      )}

      {/* ===== Tab: แก้วฟรี ===== */}
      {activeTab === "voucher" && (
        <>
          {/* Voucher ที่ยังไม่ได้ใช้ */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🎁 Available Vouchers</h3>
            {pendingVouchers.length === 0 ? (
              <div style={styles.emptyVoucher}>
                <p style={styles.emptyIcon}>☕</p>
                <p style={styles.emptyText}>No vouchers available</p>
                <p style={styles.emptySubText}>
                  Collect 10 points to get a free drink!
                </p>
              </div>
            ) : (
              pendingVouchers.map((v) => (
                <div key={v.id} style={styles.voucherCard}>
                  <div style={styles.voucherHeader}>
                    <div>
                      <p style={styles.voucherTitle}>☕ 1 FREE Drink</p>
                      <p style={styles.voucherDate}>
                        Issued on{" "}
                        {new Date(v.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div style={styles.voucherBadgePending}>Active</div>
                  </div>
                  <p style={styles.voucherInstruction}>
                    Present this QR code to the barista to claim your free drink
                  </p>
                  <div style={styles.voucherQR}>
                    <QRCode
                      value={`VOUCHER:${v.id}`}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Voucher ที่ใช้แล้ว */}
          {usedVouchers.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>✅ Redeemed</h3>
              {usedVouchers.map((v) => (
                <div key={v.id} style={styles.voucherUsedRow}>
                  <div>
                    <p style={styles.voucherUsedTitle}>☕ 1 FREE Drink</p>
                    <p style={styles.voucherUsedDate}>
                      Used on{" "}
                      {new Date(v.used_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div style={styles.voucherBadgeUsed}>Redeemed</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== Tab: ประวัติ ===== */}
      {activeTab === "history" && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📋 Point History</h3>
          {transactions.length === 0 ? (
            <p style={styles.emptyText}>No transaction history yet</p>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} style={styles.txRow}>
                <div>
                  <p style={styles.txBranch}>📍 {tx.branches?.name}</p>
                  <p style={styles.txStaff}>
                    👤 Staff: {tx.staff_name || tx.staff?.name || "Unknown"}
                  </p>
                  <p style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {tx.redeemed && (
                    <p style={styles.txRedeem}>🎉 Earned 1 FREE Drink reward</p>
                  )}
                </div>
                <div style={styles.txPoints}>+{tx.cups_added} Pts</div>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          from { transform: translateY(0px); }
          to   { transform: translateY(-10px); }
        }
        @keyframes popIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8f9fa",
    padding: "20px",
    maxWidth: "480px",
    margin: "0 auto",
    fontFamily: "'Segoe UI', Roboto, sans-serif",
  },

  // Celebration
  celebrationOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
  },
  celebrationCard: {
    background: "white",
    borderRadius: "28px",
    padding: "36px 28px",
    textAlign: "center",
    maxWidth: "320px",
    width: "100%",
    animation: "popIn 0.4s ease",
  },
  confettiRow: {
    display: "flex",
    justifyContent: "center",
    gap: "4px",
    marginBottom: "16px",
  },
  celebrationEmoji: {
    fontSize: "80px",
    marginBottom: "12px",
    display: "block",
  },
  celebrationTitle: {
    fontSize: "30px",
    fontWeight: "bold",
    color: "#2B1810",
    margin: "0 0 8px",
  },
  celebrationText: { color: "#777", fontSize: "15px", margin: "0 0 20px" },
  celebrationBadge: {
    background: "linear-gradient(135deg, #E46A25 0%, #C25218 100%)",
    color: "white",
    fontSize: "26px",
    fontWeight: "bold",
    padding: "18px",
    borderRadius: "16px",
    marginBottom: "14px",
  },
  celebrationSub: { color: "#999", fontSize: "13px", margin: "0 0 24px" },
  celebrationBtn: {
    width: "100%",
    padding: "16px",
    background: "linear-gradient(135deg, #2B1810 0%, #4A2E22 100%)",
    color: "white",
    border: "none",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  // Header
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  greeting: { color: "#777", margin: 0, fontSize: "14px" },
  name: { color: "#2B1810", margin: 0, fontSize: "22px", fontWeight: "bold" },
  signOutBtn: {
    background: "none",
    border: "1.5px solid #d1d5db",
    borderRadius: "10px",
    padding: "8px 16px",
    cursor: "pointer",
    color: "#666",
    fontSize: "13px",
    fontWeight: "600",
  },

  // Tab
  tabRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  tabBtn: {
    flex: 1,
    padding: "10px 8px",
    borderRadius: "12px",
    border: "1.5px solid #ddd",
    background: "white",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    color: "#666",
    position: "relative",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, #2B1810 0%, #4A2E22 100%)",
    color: "white",
    border: "none",
  },
  badge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    background: "#E46A25",
    color: "white",
    borderRadius: "50%",
    width: "18px",
    height: "18px",
    fontSize: "11px",
    fontWeight: "bold",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // Points Card
  redeemAlert: {
    background: "linear-gradient(135deg, #f6d365, #fda085)",
    color: "white",
    padding: "16px",
    borderRadius: "14px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "15px",
    marginBottom: "20px",
  },
  pointsCard: {
    background: "linear-gradient(135deg, #2B1810 0%, #4A2E22 100%)",
    borderRadius: "24px",
    padding: "24px",
    color: "white",
    marginBottom: "16px",
  },
  pointsLabel: { margin: "0 0 8px", opacity: 0.8, fontSize: "14px" },
  pointsRow: { display: "flex", alignItems: "baseline", gap: "4px" },
  pointsNumber: {
    fontSize: "64px",
    fontWeight: "bold",
    lineHeight: 1,
    color: "#E46A25",
  },
  pointsMax: { fontSize: "24px", opacity: 0.7 },
  progressBg: {
    background: "rgba(255,255,255,0.15)",
    borderRadius: "999px",
    height: "10px",
    margin: "16px 0 8px",
  },
  progressFill: {
    background: "#E46A25",
    borderRadius: "999px",
    height: "10px",
    transition: "width 0.5s ease",
  },
  progressText: { fontSize: "13px", opacity: 0.9, margin: "0 0 12px" },
  cupsRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  cupIcon: { fontSize: "20px" },
  totalCups: { margin: 0, opacity: 0.7, fontSize: "13px" },

  // QR Card
  qrCard: {
    background: "white",
    borderRadius: "24px",
    padding: "24px",
    textAlign: "center",
    marginBottom: "16px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  },
  qrTitle: {
    fontWeight: "bold",
    fontSize: "18px",
    margin: "0 0 4px",
    color: "#2B1810",
  },
  qrSubtitle: { color: "#777", fontSize: "13px", margin: "0 0 16px" },
  qrBox: {
    display: "inline-block",
    padding: "10px",
    background: "#f8f9fa",
    borderRadius: "16px",
  },

  // Card
  card: {
    background: "white",
    borderRadius: "24px",
    padding: "24px",
    marginBottom: "16px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  },
  cardTitle: {
    margin: "0 0 16px",
    fontSize: "18px",
    color: "#2B1810",
    fontWeight: "bold",
  },

  // Voucher
  emptyVoucher: { textAlign: "center", padding: "20px 0" },
  emptyIcon: { fontSize: "48px", margin: "0 0 8px" },
  emptyText: { color: "#bbb", fontSize: "15px", margin: 0 },
  emptySubText: { color: "#ccc", fontSize: "13px", marginTop: "4px" },

  voucherCard: {
    background: "linear-gradient(135deg, #2B1810 0%, #4A2E22 100%)",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "12px",
    color: "white",
    textAlign: "center",
  },
  voucherHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
    textAlign: "left",
  },
  voucherTitle: { fontSize: "20px", fontWeight: "bold", margin: 0 },
  voucherDate: { fontSize: "12px", opacity: 0.7, margin: "4px 0 0" },
  voucherBadgePending: {
    background: "#E46A25",
    color: "white",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "bold",
    flexShrink: 0,
  },
  voucherInstruction: { fontSize: "13px", opacity: 0.8, marginBottom: "16px" },
  voucherQR: {
    background: "white",
    borderRadius: "16px",
    padding: "12px",
    display: "inline-block",
  },

  voucherUsedRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f0f0f0",
    opacity: 0.6,
  },
  voucherUsedTitle: { margin: 0, fontWeight: "600", fontSize: "14px" },
  voucherUsedDate: { margin: "2px 0 0", color: "#aaa", fontSize: "12px" },
  voucherBadgeUsed: {
    background: "#e2e8f0",
    color: "#64748b",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  // History
  txRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  txBranch: { margin: 0, fontWeight: "600", fontSize: "14px", color: "#333" },
  txStaff: { margin: "2px 0 0", color: "#888", fontSize: "12px" },
  txDate: { margin: "4px 0 0", color: "#94a3b8", fontSize: "12px" },
  txRedeem: {
    margin: "4px 0 0",
    color: "#E46A25",
    fontSize: "12px",
    fontWeight: "600",
  },
  txPoints: {
    background: "#fff7ed",
    color: "#E46A25",
    fontWeight: "bold",
    padding: "6px 14px",
    borderRadius: "10px",
    fontSize: "14px",
  },
};
