import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [branches, setBranches] = useState([]);
  const [stats, setStats] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("month");
  const [staffMembers, setStaffMembers] = useState([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffBranch, setNewStaffBranch] = useState("");
  const [activeTab, setActiveTab] = useState("report");
  const [customers, setCustomers] = useState([]);
  const [searchPhone, setSearchPhone] = useState("");
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    fetchBranches();
    fetchStaffMembers();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filterBranch, filterPeriod]);

  async function fetchBranches() {
    const { data } = await supabase.from("branches").select("*");
    setBranches(data || []);
  }

  async function fetchStaffMembers() {
    const { data } = await supabase
      .from("staff_members")
      .select("*, branches(name)")
      .order("branch_id")
      .order("name");
    setStaffMembers(data || []);
  }

  function getPeriodFilter() {
    const now = new Date();
    if (filterPeriod === "day") {
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
    }
    if (filterPeriod === "month") {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    if (filterPeriod === "year") {
      return new Date(now.getFullYear(), 0, 1).toISOString();
    }
    return null;
  }

  async function fetchStats() {
    let query = supabase
      .from("transactions")
      .select("*, branches(name), staff:staff_id(name)")
      .order("created_at", { ascending: false });

    const periodStart = getPeriodFilter();
    if (periodStart) query = query.gte("created_at", periodStart);
    if (filterBranch !== "all") query = query.eq("branch_id", filterBranch);

    const { data } = await query;
    setTransactions(data || []);

    const totalCups = data?.reduce((sum, tx) => sum + tx.cups_added, 0) || 0;
    const totalRedeemed = data?.filter((tx) => tx.redeemed).length || 0;
    const totalTx = data?.length || 0;

    const branchMap = {};
    data?.forEach((tx) => {
      const name = tx.branches?.name || "Unassigned";
      if (!branchMap[name]) branchMap[name] = { cups: 0, tx: 0, redeemed: 0 };
      branchMap[name].cups += tx.cups_added;
      branchMap[name].tx += 1;
      branchMap[name].redeemed += tx.redeemed ? 1 : 0;
    });

    setStats({ totalCups, totalRedeemed, totalTx, branchMap });
  }

  async function addStaffMember() {
    if (!newStaffName || !newStaffBranch) return;
    await supabase.from("staff_members").insert({
      name: newStaffName,
      branch_id: newStaffBranch,
    });
    setNewStaffName("");
    setNewStaffBranch("");
    fetchStaffMembers();
  }

  async function removeStaffMember(id) {
    await supabase.from("staff_members").update({ active: false }).eq("id", id);
    fetchStaffMembers();
  }
  async function fetchCustomers(phone = "") {
    let query = supabase
      .from("profiles")
      .select("*")
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    if (phone) {
      query = query.ilike("phone", `%${phone}%`);
    }

    const { data } = await query.limit(20);
    setCustomers(data || []);
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      setResetMsg("Password must be at least 6 characters long.");
      return;
    }

    setResetLoading(true);
    const { data, error } = await supabase.rpc("admin_reset_password", {
      p_user_id: resetUserId,
      p_new_password: newPassword,
    });

    setResetLoading(false);

    if (error || !data.success) {
      setResetMsg("An error occurred. Please try again.");
      return;
    }

    setResetMsg("✅ Password reset successfully!");
    setTimeout(() => {
      setResetUserId(null);
      setNewPassword("");
      setResetMsg("");
    }, 2000);
  }

  function exportCSV() {
    if (!transactions.length) return;

    const headers = [
      "Date",
      "Time",
      "Branch Name",
      "Staff Name",
      "Cups Amount",
      "Status",
    ];
    const rows = transactions.map((tx) => {
      const date = new Date(tx.created_at);
      return [
        date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tx.branches?.name || "Unassigned",
        tx.staff_name || tx.staff?.name || "Unassigned",
        tx.cups_added,
        tx.redeemed ? "Redeemed Free Cup" : "Earned Points",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Report_${periodLabels[filterPeriod]}_${new Date().toLocaleDateString("en-US")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const periodLabels = { day: "Today", month: "This Month", year: "This Year" };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <p style={styles.role}>Admin 👑</p>
          <h2 style={styles.name}>{profile?.name}</h2>
        </div>
        <button onClick={signOut} style={styles.signOutBtn}>
          Sign Out
        </button>
      </div>

      {/* Tab Row */}
      <div style={styles.tabRow}>
        <button
          onClick={() => setActiveTab("report")}
          style={{
            ...styles.tabBtn,
            ...(activeTab === "report" ? styles.tabBtnActive : {}),
          }}
        >
          📊 Reports
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          style={{
            ...styles.tabBtn,
            ...(activeTab === "staff" ? styles.tabBtnActive : {}),
          }}
        >
          👥 Staff Management
        </button>
        <button
          onClick={() => {
            setActiveTab("customer");
            fetchCustomers();
          }}
          style={{
            ...styles.tabBtn,
            ...(activeTab === "customer" ? styles.tabBtnActive : {}),
          }}
        >
          🧑 Customer
        </button>
      </div>

      {/* ===== Tab: Reports ===== */}
      {activeTab === "report" && (
        <>
          {/* Filters */}
          <div style={styles.card}>
            <div style={styles.filterGroup}>
              <p style={styles.filterLabel}>Time Period</p>
              <div style={styles.btnGroup}>
                {["day", "month", "year"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilterPeriod(p)}
                    style={{
                      ...styles.filterBtn,
                      ...(filterPeriod === p ? styles.filterBtnActive : {}),
                    }}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...styles.filterGroup, marginTop: "12px" }}>
              <p style={styles.filterLabel}>Branch</p>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total Cups</p>
              <p style={styles.statNum}>{stats.totalCups || 0}</p>
              <p style={styles.statSub}>☕ Cups</p>
            </div>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Transactions</p>
              <p style={styles.statNum}>{stats.totalTx || 0}</p>
              <p style={styles.statSub}>Times</p>
            </div>
            <div style={{ ...styles.statCard, ...styles.statCardHighlight }}>
              <p style={styles.statLabelLight}>Redeemed</p>
              <p style={styles.statNumLight}>{stats.totalRedeemed || 0}</p>
              <p style={styles.statSubLight}>🎁 Free</p>
            </div>
          </div>

          {/* Branch Breakdown */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Statistics by Branch</h3>
            {stats.branchMap &&
              Object.entries(stats.branchMap).map(([name, data]) => (
                <div key={name} style={styles.branchRow}>
                  <div>
                    <p style={styles.branchName}>📍 {name}</p>
                    <p style={styles.branchSub}>
                      {data.tx} tx · {data.redeemed} free rewards
                    </p>
                  </div>
                  <div style={styles.branchCups}>{data.cups} ☕</div>
                </div>
              ))}
            {(!stats.branchMap ||
              Object.keys(stats.branchMap).length === 0) && (
              <p style={styles.emptyText}>No data available for this period.</p>
            )}
          </div>

          {/* Transaction List */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Recent Transactions</h3>
              <button onClick={exportCSV} style={styles.exportBtn}>
                📥 Export CSV
              </button>
            </div>
            {transactions.slice(0, 20).map((tx) => (
              <div key={tx.id} style={styles.txRow}>
                <div>
                  <p style={styles.txBranch}>📍 {tx.branches?.name}</p>
                  <p style={styles.txStaff}>
                    👤 {tx.staff_name || tx.staff?.name || "N/A"}
                  </p>
                  <p style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleString("en-US")}
                  </p>
                  {tx.redeemed && (
                    <p style={styles.txRedeem}>🎁 Redeemed 1 Free Cup</p>
                  )}
                </div>
                <div style={styles.txCups}>+{tx.cups_added} ☕</div>
              </div>
            ))}
            {transactions.length === 0 && (
              <p style={styles.emptyText}>No data available for this period.</p>
            )}
          </div>
        </>
      )}

      {/* ===== Tab: Staff Management ===== */}
      {activeTab === "staff" && (
        <>
          {/* Add Staff */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Add New Staff</h3>
            <input
              type="text"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="Staff Full Name"
              style={{ ...styles.input, marginBottom: "10px" }}
            />
            <select
              value={newStaffBranch}
              onChange={(e) => setNewStaffBranch(e.target.value)}
              style={{ ...styles.select, marginBottom: "12px" }}
            >
              <option value="">-- Select Branch --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button onClick={addStaffMember} style={styles.addStaffBtn}>
              + Add Staff Member
            </button>
          </div>

          {/* Staff List by Branch */}
          {branches.map((branch) => {
            const branchStaff = staffMembers.filter(
              (s) => s.branch_id === branch.id && s.active,
            );
            return (
              <div key={branch.id} style={styles.card}>
                <h3 style={styles.cardTitle}>📍 {branch.name}</h3>
                {branchStaff.length === 0 ? (
                  <p style={styles.emptyText}>
                    No staff members in this branch yet.
                  </p>
                ) : (
                  branchStaff.map((s) => (
                    <div key={s.id} style={styles.staffRow}>
                      <div style={styles.staffAvatar}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <p style={styles.staffName}>{s.name}</p>
                      <button
                        onClick={() => removeStaffMember(s.id)}
                        style={styles.removeBtn}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </>
      )}
      {/* ===== Tab: Customers ===== */}
      {activeTab === "customer" && (
        <>
          {/* Reset Password Modal */}
          {resetUserId && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalCard}>
                <h3 style={styles.modalTitle}>🔑 Reset Password</h3>
                <p style={styles.modalSub}>Set new password for customer</p>

                {resetMsg && (
                  <div
                    style={{
                      ...styles.modalMsg,
                      color: resetMsg.includes("✅") ? "#38a169" : "#e53e3e",
                      background: resetMsg.includes("✅")
                        ? "#f0fff4"
                        : "#fff0f0",
                    }}
                  >
                    {resetMsg}
                  </div>
                )}

                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (at least 6 chars)"
                  style={{ ...styles.input, marginBottom: "12px" }}
                />

                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  style={{
                    ...styles.addStaffBtn,
                    marginBottom: "10px",
                    opacity: resetLoading ? 0.7 : 1,
                  }}
                >
                  {resetLoading ? "Resetting..." : "Confirm Reset Password"}
                </button>

                <button
                  onClick={() => {
                    setResetUserId(null);
                    setNewPassword("");
                    setResetMsg("");
                  }}
                  style={styles.cancelModalBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search Customer */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🧑 Manage Customers</h3>
            <div style={styles.searchRow}>
              <input
                type="tel"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="Search by phone number"
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                onClick={() => fetchCustomers(searchPhone)}
                style={styles.searchBtn}
              >
                Search
              </button>
            </div>
          </div>

          {/* Customer List */}
          <div style={styles.card}>
            {customers.length === 0 ? (
              <p style={styles.emptyText}>No customer data found.</p>
            ) : (
              customers.map((c) => (
                <div key={c.id} style={styles.customerRow}>
                  <div style={styles.customerAvatar}>
                    {c.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={styles.customerName}>{c.name}</p>
                    <p style={styles.customerPhone}>📞 {c.phone || "N/A"}</p>
                    <div style={styles.customerStats}>
                      <span style={styles.customerPointBadge}>
                        ☕ {c.points} Points
                      </span>
                      <span style={styles.customerCupBadge}>
                        🥤 {c.total_cups} Cups
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setResetUserId(c.id);
                      setResetMsg("");
                    }}
                    style={styles.resetBtn}
                  >
                    🔑 Reset
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#faf6f0", // Clean cafe style cream white
    padding: "20px",
    maxWidth: "480px",
    margin: "0 auto",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  role: { color: "#8c7662", margin: 0, fontSize: "13px", fontWeight: "600" },
  name: {
    color: "#3d2a1c",
    margin: "4px 0",
    fontSize: "22px",
    fontWeight: "bold",
  },
  signOutBtn: {
    background: "white",
    border: "1.5px solid #e1d6cb",
    borderRadius: "8px",
    padding: "8px 14px",
    cursor: "pointer",
    color: "#8c7662",
    fontSize: "13px",
    fontWeight: "600",
  },
  tabRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
  },
  tabBtn: {
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    border: "1.5px solid #e1d6cb",
    background: "white",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    color: "#8c7662",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, #e46a25 0%, #be5117 100%)", // Replaced blue with clean orange
    color: "white",
    border: "none",
    boxShadow: "0 4px 12px rgba(228, 106, 37, 0.2)",
  },
  card: {
    background: "white",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "16px",
    boxShadow: "0 4px 16px rgba(61,42,28,0.04)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#3d2a1c",
    margin: "0 0 16px",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  filterLabel: {
    fontSize: "12px",
    color: "#8c7662",
    fontWeight: "600",
    margin: 0,
  },
  btnGroup: { display: "flex", gap: "8px" },
  filterBtn: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1.5px solid #e1d6cb",
    background: "white",
    fontSize: "13px",
    cursor: "pointer",
    color: "#8c7662",
    fontWeight: "500",
  },
  filterBtnActive: {
    background: "#3d2a1c", // Changed sub-options status to dark brown
    color: "white",
    border: "none",
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1.5px solid #e1d6cb",
    fontSize: "14px",
    background: "white",
    width: "100%",
    color: "#3d2a1c",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "10px",
    marginBottom: "16px",
  },
  statCard: {
    background: "white",
    borderRadius: "14px",
    padding: "16px 12px",
    textAlign: "center",
    boxShadow: "0 4px 16px rgba(61,42,28,0.04)",
  },
  statCardHighlight: {
    background: "linear-gradient(135deg, #e46a25 0%, #be5117 100%)", // Highlighted free rewards with primary orange color
  },
  statLabel: {
    fontSize: "11px",
    color: "#8c7662",
    margin: "0 0 4px",
    fontWeight: "600",
  },
  statLabelLight: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.85)",
    margin: "0 0 4px",
    fontWeight: "600",
  },
  statNum: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#3d2a1c",
    margin: 0,
  },
  statNumLight: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "white",
    margin: 0,
  },
  statSub: { fontSize: "11px", color: "#baa28c", margin: "2px 0 0" },
  statSubLight: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.75)",
    margin: "2px 0 0",
  },
  branchRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #fcfaf7",
  },
  branchName: {
    margin: 0,
    fontWeight: "600",
    fontSize: "14px",
    color: "#3d2a1c",
  },
  branchSub: { margin: "2px 0 0", color: "#8c7662", fontSize: "12px" },
  branchCups: { fontSize: "20px", fontWeight: "bold", color: "#e46a25" },
  txRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #fcfaf7",
  },
  txBranch: {
    margin: 0,
    fontWeight: "600",
    fontSize: "13px",
    color: "#3d2a1c",
  },
  txStaff: {
    margin: "2px 0 0",
    color: "#e46a25",
    fontSize: "12px",
    fontWeight: "600",
  },
  txDate: { margin: "2px 0 0", color: "#baa28c", fontSize: "11px" },
  txRedeem: {
    margin: "2px 0 0",
    color: "#be5117",
    fontSize: "11px",
    fontWeight: "600",
  },
  txCups: { fontSize: "18px", fontWeight: "bold", color: "#e46a25" },
  exportBtn: {
    background: "#3d2a1c",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1.5px solid #e1d6cb",
    fontSize: "15px",
    boxSizing: "border-box",
    outline: "none",
    color: "#3d2a1c",
  },
  addStaffBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #e46a25 0%, #be5117 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(228, 106, 37, 0.2)",
  },
  staffRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid #fcfaf7",
  },
  staffAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#3d2a1c",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "16px",
    flexShrink: 0,
  },
  staffName: {
    margin: 0,
    fontWeight: "600",
    fontSize: "15px",
    flex: 1,
    color: "#3d2a1c",
  },
  removeBtn: {
    background: "#fee2e2",
    color: "#e53e3e",
    border: "none",
    borderRadius: "8px",
    padding: "6px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  emptyText: {
    color: "#baa28c",
    textAlign: "center",
    padding: "16px 0",
    fontSize: "14px",
  },
  searchRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  searchBtn: {
    padding: "12px 16px",
    background: "linear-gradient(135deg, #e46a25 0%, #be5117 100%)", // Harmonized with the orange cafe theme
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  customerRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  customerAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #e46a25 0%, #be5117 100%)", // Harmonized with the orange cafe theme
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "18px",
    flexShrink: 0,
  },
  customerName: { margin: 0, fontWeight: "600", fontSize: "15px" },
  customerPhone: { margin: "2px 0 4px", color: "#888", fontSize: "12px" },
  customerStats: { display: "flex", gap: "6px" },
  customerPointBadge: {
    background: "#fdf2e9", // Warm soft orange background
    color: "#be5117",
    borderRadius: "6px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: "600",
  },
  customerCupBadge: {
    background: "#fff7ed",
    color: "#E46A25",
    borderRadius: "6px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: "600",
  },
  resetBtn: {
    background: "#fff0f0",
    color: "#e53e3e",
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
  },
  modalCard: {
    background: "white",
    borderRadius: "20px",
    padding: "28px",
    width: "100%",
    maxWidth: "340px",
  },
  modalTitle: { fontSize: "20px", fontWeight: "bold", margin: "0 0 4px" },
  modalSub: { color: "#888", fontSize: "14px", margin: "0 0 16px" },
  modalMsg: {
    padding: "10px",
    borderRadius: "8px",
    fontSize: "14px",
    marginBottom: "12px",
    textAlign: "center",
    fontWeight: "600",
  },
  cancelModalBtn: {
    width: "100%",
    padding: "12px",
    background: "#f5f5f5",
    color: "#888",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    cursor: "pointer",
  },
};
