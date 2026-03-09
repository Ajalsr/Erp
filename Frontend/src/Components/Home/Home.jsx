import { useState } from "react";
import {
  FaBox, FaShoppingCart, FaTruck, FaFileInvoice,
  FaChartLine, FaUser, FaBell, FaDollarSign,
  FaExclamationTriangle, FaArrowUp, FaEye, FaPlus,
  FaCheckCircle, FaTimesCircle, FaFire, FaLayerGroup
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats] = useState({
    totalItems: 156,
    pendingOrders: 12,
    outboundPending: 5,
    lowStock: 8,
    totalRevenue: "245,600.50",
    thisMonthRevenue: "45,200.75",
    activeCustomers: 48,
    pendingInvoices: 7,
  });

  const [recentActivities] = useState([
    { id: 1, type: "sale", description: "New sale order #SO-2023-156 created", user: "John Doe", time: "10 mins ago", icon: "cart" },
    { id: 2, type: "outbound", description: "Outbound #OB-2023-045 approved", user: "Sarah Smith", time: "25 mins ago", icon: "truck" },
    { id: 3, type: "item", description: "Low stock alert: Storage Cabinet", user: "System", time: "1 hour ago", icon: "box" },
    { id: 4, type: "invoice", description: "Invoice #INV-2023-089 sent", user: "Mike Johnson", time: "2 hours ago", icon: "invoice" },
    { id: 5, type: "customer", description: "New customer registered: TechCorp", user: "System", time: "3 hours ago", icon: "user" },
  ]);

  const [lowStockItems] = useState([
    { id: 1, name: "Storage Cabinet", code: "ITM001", currentStock: 5, minStock: 10, status: "critical" },
    { id: 2, name: "Office Chair", code: "ITM003", currentStock: 8, minStock: 15, status: "warning" },
    { id: 3, name: "LED Bulb 15W", code: "ITM004", currentStock: 15, minStock: 20, status: "warning" },
    { id: 4, name: "Area Rug", code: "ITM002", currentStock: 3, minStock: 10, status: "critical" },
  ]);

  const [pendingApprovals, setPendingApprovals] = useState([
    { id: 1, type: "outbound_cancel", item: "Office Chair", requestBy: "John Doe", time: "2 hours ago" },
    { id: 2, type: "outbound_cancel", item: "Storage Cabinet", requestBy: "Sarah Smith", time: "4 hours ago" },
    { id: 3, type: "new_item", item: "New Product Addition", requestBy: "Mike Johnson", time: "1 day ago" },
  ]);

  const [recentOrders] = useState([
    { id: "SO-2023-156", customer: "ABC Corporation", amount: "45,000.00", status: "open", date: "Today" },
    { id: "SO-2023-155", customer: "XYZ Ltd", amount: "28,500.00", status: "completed", date: "Yesterday" },
    { id: "SO-2023-154", customer: "Global Industries", amount: "62,000.00", status: "completed", date: "2 days ago" },
    { id: "SO-2023-153", customer: "Tech Solutions", amount: "15,750.00", status: "open", date: "3 days ago" },
  ]);

  const quickActions = [
    { title: "New Sale Order", icon: <FaShoppingCart />, color: "#2563eb", bg: "#eff6ff", path: "/sale-order/new" },
    { title: "Create Outbound", icon: <FaTruck />, color: "#059669", bg: "#ecfdf5", path: "/outbound" },
    { title: "Add New Item", icon: <FaBox />, color: "#7c3aed", bg: "#f5f3ff", path: "/Items/Items/New" },
    { title: "Create Invoice", icon: <FaFileInvoice />, color: "#d97706", bg: "#fffbeb", path: "/invoices/new" },
  ];

  const activityIconMap = {
    cart: { icon: <FaShoppingCart />, color: "#2563eb", bg: "#eff6ff" },
    truck: { icon: <FaTruck />, color: "#059669", bg: "#ecfdf5" },
    box: { icon: <FaBox />, color: "#7c3aed", bg: "#f5f3ff" },
    invoice: { icon: <FaFileInvoice />, color: "#d97706", bg: "#fffbeb" },
    user: { icon: <FaUser />, color: "#0891b2", bg: "#ecfeff" },
  };

  const handleApprove = (id) => setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
  const handleReject = (id) => setPendingApprovals((prev) => prev.filter((a) => a.id !== id));

  // Mini sparkline bars (static decoration)
  const sparkline = [40, 65, 50, 80, 60, 90, 75];

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f8fafc",
      padding: "28px 32px",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "32px",
    },
    greeting: {
      fontSize: "22px",
      fontWeight: "700",
      color: "#0f172a",
      margin: 0,
    },
    subGreeting: {
      fontSize: "13px",
      color: "#94a3b8",
      marginTop: "3px",
    },
    headerRight: {
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },
    bellBtn: {
      position: "relative",
      background: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "10px 12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      color: "#64748b",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    },
    badge: {
      position: "absolute",
      top: "-4px",
      right: "-4px",
      background: "#ef4444",
      color: "white",
      borderRadius: "999px",
      fontSize: "10px",
      fontWeight: "700",
      padding: "1px 5px",
      border: "2px solid #f8fafc",
    },
    avatar: {
      width: "40px",
      height: "40px",
      borderRadius: "12px",
      background: "linear-gradient(135deg, #2563eb, #7c3aed)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontWeight: "700",
      fontSize: "14px",
    },
    userInfo: { lineHeight: "1.3" },
    userName: { fontWeight: "600", fontSize: "14px", color: "#0f172a" },
    userRole: { fontSize: "12px", color: "#94a3b8" },

    // Stat cards
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "20px",
      marginBottom: "28px",
    },
    statCard: {
      background: "white",
      borderRadius: "16px",
      padding: "22px",
      border: "1px solid #f1f5f9",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      position: "relative",
      overflow: "hidden",
    },
    statTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "16px",
    },
    statLabel: { fontSize: "12px", color: "#94a3b8", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.06em" },
    statValue: { fontSize: "28px", fontWeight: "800", color: "#0f172a", marginTop: "6px", lineHeight: 1 },
    statIconBox: {
      width: "44px", height: "44px", borderRadius: "12px",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
    },
    statFooter: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginTop: "4px" },
    trendUp: { color: "#10b981", display: "flex", alignItems: "center", gap: "3px", fontWeight: "600" },
    viewLink: { color: "#2563eb", fontWeight: "500", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", padding: 0, fontSize: "12px" },

    // Quick actions
    sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#0f172a", marginBottom: "14px" },
    quickGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "14px",
      marginBottom: "28px",
    },
    quickCard: {
      borderRadius: "14px",
      padding: "18px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      border: "1px solid #f1f5f9",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      background: "white",
    },
    quickLeft: { display: "flex", alignItems: "center", gap: "12px" },
    quickIconBox: { width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" },
    quickTitle: { fontSize: "13px", fontWeight: "600", color: "#1e293b" },
    plusBtn: {
      width: "28px", height: "28px", borderRadius: "8px", background: "#f1f5f9",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#64748b",
    },

    // Two column grid
    twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" },
    card: {
      background: "white", borderRadius: "16px", padding: "22px",
      border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" },
    cardTitle: { fontSize: "14px", fontWeight: "700", color: "#0f172a" },
    viewAll: { fontSize: "12px", color: "#2563eb", fontWeight: "500", cursor: "pointer", background: "none", border: "none", padding: 0 },

    // Activity row
    activityRow: {
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 10px", borderRadius: "10px",
      transition: "background 0.1s",
    },
    activityDesc: { fontSize: "13px", color: "#1e293b", fontWeight: "500", lineHeight: "1.4" },
    activityMeta: { fontSize: "11px", color: "#94a3b8", marginTop: "2px" },
    activityViewBtn: { marginLeft: "auto", fontSize: "11px", color: "#2563eb", fontWeight: "600", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" },

    // Approval card
    approvalCard: {
      border: "1px solid #f1f5f9", borderRadius: "12px", padding: "14px 16px", marginBottom: "10px",
    },
    approvalTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" },
    approvalName: { fontSize: "13px", fontWeight: "600", color: "#0f172a" },
    approvalType: { fontSize: "11px", color: "#94a3b8", marginTop: "2px" },
    approvalTime: { fontSize: "11px", color: "#cbd5e1" },
    approvalBottom: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    approvalBy: { fontSize: "12px", color: "#64748b" },
    approveBtn: {
      display: "flex", alignItems: "center", gap: "4px",
      background: "#ecfdf5", color: "#059669", border: "none", borderRadius: "8px",
      padding: "5px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
    },
    rejectBtn: {
      display: "flex", alignItems: "center", gap: "4px",
      background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: "8px",
      padding: "5px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer",
    },
    btnGroup: { display: "flex", gap: "8px" },

    // Low stock row
    stockRow: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 10px", borderRadius: "10px",
    },
    stockLeft: { display: "flex", alignItems: "center", gap: "12px" },
    stockName: { fontSize: "13px", fontWeight: "600", color: "#1e293b" },
    stockCode: { fontSize: "11px", color: "#94a3b8", marginTop: "1px" },
    stockRight: { textAlign: "right" },
    stockNumbers: { fontSize: "13px", fontWeight: "700" },
    pill: { fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "999px", display: "inline-block", marginTop: "3px" },

    // Order row
    orderRow: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", borderRadius: "12px", border: "1px solid #f1f5f9", marginBottom: "8px",
      background: "#fafafa",
    },
    orderId: { fontSize: "13px", fontWeight: "700", color: "#1e293b" },
    orderCustomer: { fontSize: "11px", color: "#94a3b8", marginTop: "1px" },
    orderAmount: { fontSize: "14px", fontWeight: "800", color: "#0f172a" },
    orderDate: { fontSize: "11px", color: "#94a3b8", textAlign: "right", marginTop: "1px" },
    orderBtnGroup: { display: "flex", gap: "8px", marginTop: "8px" },
    orderBtn: { fontSize: "11px", fontWeight: "600", color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 },
    statusPill: { fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", display: "inline-block" },

    // Revenue section
    revenueGrid: {
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "4px",
    },
    revCard: {
      borderRadius: "14px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px",
    },
    revTop: { display: "flex", alignItems: "center", gap: "10px" },
    revIconBox: { width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" },
    revLabel: { fontSize: "12px", color: "#64748b", fontWeight: "500" },
    revValue: { fontSize: "22px", fontWeight: "800", color: "#0f172a" },
    revTrend: { fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" },

    // Sparkline
    sparkContainer: { display: "flex", alignItems: "flex-end", gap: "3px", height: "32px", marginTop: "4px" },
    sparkBar: { flex: 1, borderRadius: "3px 3px 0 0", minWidth: "6px" },
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <p style={styles.greeting}>Good morning, John 👋</p>
          <p style={styles.subGreeting}>Here's what's happening in your workspace today.</p>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.bellBtn}>
            <FaBell size={15} />
            <span style={styles.badge}>3</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={styles.avatar}>JD</div>
            <div style={styles.userInfo}>
              <p style={styles.userName}>John Doe</p>
              <p style={styles.userRole}>Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        {[
          { label: "Total Items", value: stats.totalItems, icon: <FaLayerGroup />, iconColor: "#2563eb", iconBg: "#eff6ff", footer: <button style={styles.viewLink} onClick={() => navigate("/Items")}><FaEye size={10}/> View all items</button> },
          { label: "Pending Orders", value: stats.pendingOrders, icon: <FaShoppingCart />, iconColor: "#d97706", iconBg: "#fffbeb", footer: <span style={styles.trendUp}><FaArrowUp size={10}/> 12% this month</span> },
          { label: "Outbound Pending", value: stats.outboundPending, icon: <FaTruck />, iconColor: "#059669", iconBg: "#ecfdf5", footer: <button style={styles.viewLink} onClick={() => navigate("/outbound")}><FaEye size={10}/> Manage outbound</button> },
          { label: "Low Stock Alerts", value: stats.lowStock, icon: <FaExclamationTriangle />, iconColor: "#ef4444", iconBg: "#fef2f2", footer: <button style={{ ...styles.viewLink, color: "#ef4444" }} onClick={() => navigate("/Items?filter=low-stock")}><FaEye size={10}/> View details</button> },
        ].map((card, i) => (
          <div key={i} style={styles.statCard}>
            <div style={styles.statTop}>
              <div>
                <p style={styles.statLabel}>{card.label}</p>
                <p style={styles.statValue}>{card.value}</p>
              </div>
              <div style={{ ...styles.statIconBox, background: card.iconBg, color: card.iconColor }}>
                {card.icon}
              </div>
            </div>
            <div style={styles.statFooter}>{card.footer}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <p style={styles.sectionTitle}>Quick Actions</p>
      <div style={styles.quickGrid}>
        {quickActions.map((action, i) => (
          <div
            key={i}
            style={styles.quickCard}
            onClick={() => navigate(action.path)}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={styles.quickLeft}>
              <div style={{ ...styles.quickIconBox, background: action.bg, color: action.color }}>{action.icon}</div>
              <span style={styles.quickTitle}>{action.title}</span>
            </div>
            <div style={styles.plusBtn}><FaPlus size={10} /></div>
          </div>
        ))}
      </div>

      {/* Recent Activities + Pending Approvals */}
      <div style={styles.twoCol}>
        {/* Recent Activities */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Recent Activities</span>
            <button style={styles.viewAll}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recentActivities.map((a) => {
              const meta = activityIconMap[a.icon] || activityIconMap.box;
              return (
                <div key={a.id} style={styles.activityRow}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={styles.activityDesc}>{a.description}</p>
                    <p style={styles.activityMeta}>{a.user} · {a.time}</p>
                  </div>
                  <button style={styles.activityViewBtn} onClick={() => navigate("/")}>View</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Pending Approvals</span>
            <span style={{ background: "#fef2f2", color: "#ef4444", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px" }}>
              {pendingApprovals.length} pending
            </span>
          </div>
          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
              <FaBell size={28} style={{ marginBottom: "8px", opacity: 0.3 }} />
              <p style={{ fontSize: "13px" }}>All caught up!</p>
            </div>
          ) : (
            pendingApprovals.map((ap) => (
              <div key={ap.id} style={styles.approvalCard}>
                <div style={styles.approvalTop}>
                  <div>
                    <p style={styles.approvalName}>{ap.item}</p>
                    <p style={styles.approvalType}>{ap.type === "outbound_cancel" ? "Outbound Cancellation" : "New Item Request"}</p>
                  </div>
                  <span style={styles.approvalTime}>{ap.time}</span>
                </div>
                <div style={styles.approvalBottom}>
                  <span style={styles.approvalBy}>By <strong>{ap.requestBy}</strong></span>
                  <div style={styles.btnGroup}>
                    <button style={styles.approveBtn} onClick={() => handleApprove(ap.id)}>
                      <FaCheckCircle size={11} /> Approve
                    </button>
                    <button style={styles.rejectBtn} onClick={() => handleReject(ap.id)}>
                      <FaTimesCircle size={11} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Low Stock + Recent Orders */}
      <div style={styles.twoCol}>
        {/* Low Stock */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Low Stock Items</span>
            <button style={styles.viewAll} onClick={() => navigate("/Items?filter=low-stock")}>View all →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {lowStockItems.map((item) => {
              const isCritical = item.status === "critical";
              const pct = Math.round((item.currentStock / item.minStock) * 100);
              return (
                <div key={item.id} style={styles.stockRow}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={styles.stockLeft}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isCritical ? "#fef2f2" : "#fffbeb", color: isCritical ? "#ef4444" : "#d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                      <FaBox />
                    </div>
                    <div>
                      <p style={styles.stockName}>{item.name}</p>
                      <p style={styles.stockCode}>{item.code}</p>
                    </div>
                  </div>
                  <div style={styles.stockRight}>
                    <p style={{ ...styles.stockNumbers, color: isCritical ? "#ef4444" : "#d97706" }}>{item.currentStock} / {item.minStock}</p>
                    <div style={{ ...styles.pill, background: isCritical ? "#fef2f2" : "#fffbeb", color: isCritical ? "#ef4444" : "#d97706" }}>
                      {isCritical ? "Critical" : "Warning"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Orders */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Recent Orders</span>
            <button style={styles.viewAll} onClick={() => navigate("/sale-orders")}>View all →</button>
          </div>
          <div>
            {recentOrders.map((order) => {
              const isOpen = order.status === "open";
              return (
                <div key={order.id} style={styles.orderRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={styles.orderId}>{order.id}</p>
                        <p style={styles.orderCustomer}>{order.customer}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={styles.orderAmount}>AED {order.amount}</p>
                        <p style={styles.orderDate}>{order.date}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <span style={{ ...styles.statusPill, background: isOpen ? "#eff6ff" : "#ecfdf5", color: isOpen ? "#2563eb" : "#059669" }}>
                        {isOpen ? "Open" : "Completed"}
                      </span>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button style={styles.orderBtn} onClick={() => navigate(`/sale-orders/${order.id}`)}>View</button>
                        {isOpen && <button style={{ ...styles.orderBtn, color: "#059669" }} onClick={() => navigate(`/outbound?so=${order.id}`)}>Outbound</button>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Revenue Overview</span>
          <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#94a3b8" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }} /> This Month</span>
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e2e8f0", display: "inline-block" }} /> Last Month</span>
          </div>
        </div>
        <div style={styles.revenueGrid}>
          {[
            { label: "Total Revenue", value: `AED ${stats.totalRevenue}`, icon: <FaDollarSign />, iconColor: "#2563eb", iconBg: "#eff6ff", cardBg: "#f8faff", trend: null },
            { label: "This Month", value: `AED ${stats.thisMonthRevenue}`, icon: <FaChartLine />, iconColor: "#059669", iconBg: "#ecfdf5", cardBg: "#f0fdf8", trend: { label: "+18% vs last month", color: "#059669" } },
            { label: "Active Customers", value: stats.activeCustomers, icon: <FaUser />, iconColor: "#7c3aed", iconBg: "#f5f3ff", cardBg: "#faf5ff", trend: { label: "+5 this month", color: "#7c3aed" } },
          ].map((rev, i) => (
            <div key={i} style={{ ...styles.revCard, background: rev.cardBg }}>
              <div style={styles.revTop}>
                <div style={{ ...styles.revIconBox, background: rev.iconBg, color: rev.iconColor }}>{rev.icon}</div>
                <p style={styles.revLabel}>{rev.label}</p>
              </div>
              <p style={styles.revValue}>{rev.value}</p>
              {rev.trend && (
                <p style={{ ...styles.revTrend, color: rev.trend.color }}>
                  <FaFire size={10} /> {rev.trend.label}
                </p>
              )}
              {/* Sparkline decoration */}
              <div style={styles.sparkContainer}>
                {sparkline.map((h, si) => (
                  <div key={si} style={{ ...styles.sparkBar, height: `${h}%`, background: rev.iconColor, opacity: si === sparkline.length - 1 ? 1 : 0.25 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}