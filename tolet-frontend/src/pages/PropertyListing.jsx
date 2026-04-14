import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// ══════════════════════════════════════════════════
// PROPERTY IMAGES — assign rotating Unsplash images
// ══════════════════════════════════════════════════
const ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&q=80",
];

const QUICK_INSIGHTS = [
  "2BHK under 15k near Velachery",
  "Luxury Flats in South Mumbai",
];

// ══════════════════════════════════════════════════
// FETCH ALL PROPERTIES FROM FIRESTORE
// ══════════════════════════════════════════════════
async function fetchFromFirestore() {
  const snapshot = await getDocs(collection(db, "properties"));
  return snapshot.docs.map((doc) => ({
    id: doc.id,       // Firestore auto-generated ID (string)
    ...doc.data(),    // all fields: type, location, price, etc.
  }));
}

// ══════════════════════════════════════════════════
// INTENT-BASED FILTER
// ══════════════════════════════════════════════════
function filterByIntent(intent, properties) {
  const {
    property_type,
    location,
    budget,
    amenities = [],
    nearby = [],
    avoid = [],
  } = intent;

  return properties.filter((p) => {
    if (property_type) {
      const typeMatch = p.type?.toLowerCase().includes(property_type.toLowerCase());
      if (!typeMatch) return false;
    }
    if (location) {
      const locationMatch = p.location?.toLowerCase().includes(location.toLowerCase());
      if (!locationMatch) return false;
    }
    if (budget && budget > 0) {
      if (p.price > budget) return false;
    }
    if (amenities.length > 0) {
      const propertyAmenities = (p.amenities || []).map((a) => a.toLowerCase());
      const hasParking = p.parking === true;
      for (const required of amenities) {
        const req = required.toLowerCase();
        if (req === "parking") {
          if (!hasParking && !propertyAmenities.includes("parking")) return false;
        } else {
          if (!propertyAmenities.includes(req)) return false;
        }
      }
    }
    if (nearby.length > 0) {
      const propertyNearby = (p.nearby || []).map((n) => n.toLowerCase());
      const hasNearby = nearby.some((n) =>
        propertyNearby.some((pn) => pn.includes(n.toLowerCase()))
      );
      if (!hasNearby) return false;
    }
    if (avoid.length > 0) {
      const searchable = [p.type, p.location, ...(p.nearby || []), ...(p.amenities || [])]
        .join(" ")
        .toLowerCase();
      const shouldAvoid = avoid.some((term) => searchable.includes(term.toLowerCase()));
      if (shouldAvoid) return false;
    }
    return true;
  });
}

// ══════════════════════════════════════════════════
// KEYWORD FALLBACK (used when Python API is down)
// ══════════════════════════════════════════════════
function keywordFallback(query, properties) {
  const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return properties.filter((p) => {
    const searchable = [
      p.type,
      p.location,
      String(p.price),
      ...(p.nearby || []),
      ...(p.amenities || []),
      p.parking ? "parking" : "",
    ]
      .join(" ")
      .toLowerCase();
    return tokens.some((token) => searchable.includes(token));
  });
}

// ══════════════════════════════════════════════════
// SEARCH + FILTER — calls Python backend, falls back to keyword
// ══════════════════════════════════════════════════
async function applySearch(query, allProperties) {
  // No query → return everything from Firestore
  if (!query || !query.trim()) return allProperties;

  try {
    const res = await fetch("http://127.0.0.1:8000/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();

    if (!data?.intent?.valid) {
      return keywordFallback(query, allProperties);
    }

    return filterByIntent(data.intent.intent, allProperties);
  } catch (err) {
    console.warn("Backend unavailable, falling back to keyword search:", err);
    return keywordFallback(query, allProperties);
  }
}

// ══════════════════════════════════════════════════
// SVG ICONS
// ══════════════════════════════════════════════════
const HeartIcon = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "#ef4444" : "none"} stroke={filled ? "#ef4444" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const TagIcon = ({ icon }) => {
  const icons = {
    type: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    location: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    nearby: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    parking: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><text x="8" y="17" fontSize="12" fill="#64748b" fontWeight="700">P</text></svg>,
    amenity: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    railway: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><rect x="4" y="3" width="16" height="16" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><line x1="9" y1="19" x2="6" y2="22"/><line x1="15" y1="19" x2="18" y2="22"/></svg>,
  };
  return icons[icon] || icons.amenity;
};

const LocationIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const SupportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ══════════════════════════════════════════════════
// PROPERTY CARD
// ══════════════════════════════════════════════════
function PropertyCard({ property, index }) {
  const [liked, setLiked] = useState(false);
  const image = ROOM_IMAGES[index % ROOM_IMAGES.length];
  const badge = index < 2 ? "AI TOP PICK" : "AVAILABLE";
  const badgeColor = index < 2 ? "#0d9488" : "#6366f1";

  return (
    <div style={styles.card}>
      <div style={styles.cardImageWrap}>
        <img src={image} alt={property.type} style={styles.cardImage} />
        <span style={{ ...styles.badge, backgroundColor: badgeColor }}>{badge}</span>
        <button style={styles.heartBtn} onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}>
          <HeartIcon filled={liked} />
        </button>
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitleRow}>
          <h3 style={styles.cardTitle}>{property.type}</h3>
          <div style={styles.priceWrap}>
            <span style={styles.price}>₹{Number(property.price).toLocaleString("en-IN")}</span>
            <span style={styles.priceLabel}>/MONTH</span>
          </div>
        </div>
        <div style={styles.locationRow}>
          <LocationIcon />
          <span style={styles.locationText}>{property.location}</span>
        </div>
        <div style={styles.tagsRow}>
          {(property.nearby || []).map((n, i) => (
            <span key={`n${i}`} style={styles.tag}>
              <TagIcon icon="nearby" />
              <span>{n.trim()}</span>
            </span>
          ))}
          {(property.amenities || []).map((a, i) => (
            <span key={`a${i}`} style={styles.tag}>
              <TagIcon icon="amenity" />
              <span>{a}</span>
            </span>
          ))}
        </div>
        <div style={styles.metaRow}>
          {property.parking && (
            <span style={styles.metaItem}>
              <TagIcon icon="parking" />
              <span>Parking</span>
            </span>
          )}
          {property.distance_railway_km && (
            <span style={styles.metaItem}>
              <TagIcon icon="railway" />
              <span>{property.distance_railway_km} km to Railway</span>
            </span>
          )}
        </div>
        <button style={styles.viewBtn}>View Details</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════
function Sidebar({ searchQuery, onGoHome, resultCount }) {
  return (
    <aside style={styles.sidebar}>
      <div style={{ ...styles.logoWrap, cursor: "pointer" }} onClick={onGoHome}>
        <div style={styles.logoIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <span style={styles.logoText}>Tolet AI</span>
      </div>

      <div style={styles.searchBubble}>
        <div style={styles.searchBubbleIcon}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <span style={styles.searchBubbleText}>{searchQuery}</span>
      </div>

      <div style={styles.sidebarSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>Direct Owner</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statNumber}>{resultCount}</span>
          <span style={styles.statLabel}>Listing</span>
        </div>
        <div style={styles.checkList}>
          {["Zero Brokerage", "Verified Landlords", "Limited Listing"].map((item) => (
            <div key={item} style={styles.checkItem}>
              <CheckIcon />
              <span style={styles.checkText}>{item}</span>
            </div>
          ))}
        </div>
        <button style={styles.browseDirectBtn}>Browse Direct</button>
        <span style={styles.priceNote}>₹ 99/ House</span>
      </div>

      <div style={styles.sidebarSection}>
        <div style={styles.sectionHeader}>
          <span style={{ ...styles.sectionBadge, background: "#f97316", color: "#fff" }}>Broker Property</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statNumber}>0</span>
          <span style={styles.statLabel}>Listing</span>
        </div>
        <div style={styles.checkList}>
          {["RERA Agents", "More Properties", "Full Support"].map((item) => (
            <div key={item} style={styles.checkItem}>
              <CheckIcon />
              <span style={styles.checkText}>{item}</span>
            </div>
          ))}
        </div>
        <button style={styles.browseBrokerBtn}>Browse Platform</button>
        <span style={styles.brokerNote}>Brokerage via Platform</span>
      </div>

      <div style={styles.quickInsights}>
        <span style={styles.quickTitle}>QUICK INSIGHTS</span>
        {QUICK_INSIGHTS.map((q, i) => (
          <div key={i} style={styles.quickItem}>{q}</div>
        ))}
      </div>

      <div style={styles.sidebarBottom}>
        <div style={styles.bottomLink}><SettingsIcon /><span>Settings</span></div>
        <div style={styles.bottomLink}><SupportIcon /><span>Support</span></div>
      </div>
    </aside>
  );
}

// ══════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════
export default function PropertyListing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get("q") || "";

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFirestoreError(false);

    const load = async () => {
      try {
        // 1. Fetch ALL properties from Firestore
        const allProperties = await fetchFromFirestore();

        // 2. Apply search/intent filter on top
        const results = await applySearch(searchQuery, allProperties);

        setProperties(results);
      } catch (err) {
        console.error("Firestore fetch error:", err);
        setFirestoreError(true);
        setProperties([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [searchQuery]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const goHome = () => navigate("/");

  return (
    <div style={styles.page}>
      {isMobile && (
        <button style={styles.hamburger} onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}

      {isMobile && sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      <div style={{
        ...styles.sidebarContainer,
        ...(isMobile ? {
          position: "fixed", top: 0,
          left: sidebarOpen ? 0 : -280,
          zIndex: 1000, transition: "left 0.3s ease", height: "100vh",
        } : {}),
      }}>
        <Sidebar
          searchQuery={searchQuery || "Search for your dream home"}
          onGoHome={goHome}
          resultCount={properties.length}
        />
      </div>

      <main style={{
        ...styles.main,
        ...(isMobile ? { marginLeft: 0, padding: "24px 16px", paddingTop: 64 } : {}),
      }}>
        <div style={styles.heading}>
          <h1 style={styles.h1}>Recommended Search for You</h1>
          <p style={styles.subtitle}>Based on Your Search</p>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <span style={styles.loadingText}>Fetching from Firestore...</span>
          </div>
        )}

        {/* Firestore connection error */}
        {!loading && firestoreError && (
          <div style={styles.emptyWrap}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={styles.emptyTitle}>Could not connect to Firestore</p>
            <p style={styles.emptyDesc}>Check your internet connection or Firebase config in firebase.js</p>
            <button style={styles.emptyBtn} onClick={() => window.location.reload()}>
              ↺ Retry
            </button>
          </div>
        )}

        {/* No results */}
        {!loading && !firestoreError && properties.length === 0 && (
          <div style={styles.emptyWrap}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <p style={styles.emptyTitle}>No properties found</p>
            <p style={styles.emptyDesc}>Try a different search like "2BHK Ambattur" or "parking Avadi"</p>
            <button style={styles.emptyBtn} onClick={goHome}>← Search Again</button>
          </div>
        )}

        {/* Property grid */}
        {!loading && !firestoreError && properties.length > 0 && (
          <div style={styles.grid}>
            {properties.map((p, i) => (
              <PropertyCard key={p.id} property={p} index={i} />
            ))}
          </div>
        )}

        <footer style={styles.footer}>
          <span style={styles.footerLeft}>© 2026 TOLET INDIA. ALL RIGHTS RESERVED.</span>
          <div style={styles.footerLinks}>
            <a href="#" style={styles.footerLink}>ABOUT</a>
            <a href="#" style={styles.footerLink}>TERMS</a>
            <a href="#" style={styles.footerLink}>SUPPORT</a>
          </div>
        </footer>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; background: #f8fafc; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════
const styles = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#f8fafc", position: "relative" },
  hamburger: { position: "fixed", top: 16, left: 16, zIndex: 1100, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 999 },
  sidebarContainer: { width: 260, flexShrink: 0 },
  sidebar: { width: 260, background: "#fff", borderRight: "1px solid #e9edf2", height: "100vh", position: "fixed", top: 0, left: 0, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 },
  logoWrap: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  logoIcon: { width: 32, height: 32, borderRadius: 8, background: "#f0fdfa", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { fontWeight: 700, fontSize: 16, color: "#1e293b", letterSpacing: "-0.02em" },
  searchBubble: { background: "#1e293b", borderRadius: 20, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 8 },
  searchBubbleIcon: { width: 24, height: 24, borderRadius: 12, background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  searchBubbleText: { color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.4, fontWeight: 400 },
  sidebarSection: { background: "#f8fafc", borderRadius: 14, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8 },
  sectionHeader: { display: "flex", alignItems: "center" },
  sectionBadge: { background: "#0d9488", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, letterSpacing: "0.03em" },
  statRow: { display: "flex", alignItems: "baseline", gap: 6 },
  statNumber: { fontSize: 28, fontWeight: 700, color: "#1e293b", lineHeight: 1 },
  statLabel: { fontSize: 12, color: "#64748b", fontWeight: 500 },
  checkList: { display: "flex", flexDirection: "column", gap: 4 },
  checkItem: { display: "flex", alignItems: "center", gap: 6 },
  checkText: { fontSize: 12, color: "#475569", fontWeight: 400 },
  browseDirectBtn: { background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "center", marginTop: 4, fontFamily: "'DM Sans', sans-serif" },
  priceNote: { fontSize: 10.5, color: "#94a3b8", textAlign: "center" },
  browseBrokerBtn: { background: "#1e293b", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "center", marginTop: 4, fontFamily: "'DM Sans', sans-serif" },
  brokerNote: { fontSize: 10.5, color: "#94a3b8", textAlign: "center" },
  quickInsights: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 },
  quickTitle: { fontSize: 10, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em" },
  quickItem: { fontSize: 12, color: "#475569", background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", cursor: "pointer" },
  sidebarBottom: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, borderTop: "1px solid #e9edf2" },
  bottomLink: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", cursor: "pointer", padding: "4px 0" },
  main: { flex: 1, marginLeft: 20, padding: "32px 40px", minHeight: "100vh", display: "flex", flexDirection: "column" },
  heading: { marginBottom: 28 },
  h1: { fontSize: 26, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 },
  subtitle: { fontSize: 13, color: "#94a3b8", fontWeight: 400, marginTop: 2 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24, flex: 1 },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "80px 0", flex: 1 },
  spinner: { width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { fontSize: 14, color: "#94a3b8", fontWeight: 500 },
  emptyWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "80px 0", flex: 1, textAlign: "center" },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: "#475569" },
  emptyDesc: { fontSize: 13, color: "#94a3b8", maxWidth: 300 },
  emptyBtn: { background: "#0d9488", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: "'DM Sans', sans-serif" },
  card: { background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)", transition: "box-shadow 0.2s, transform 0.2s", cursor: "pointer", display: "flex", flexDirection: "column" },
  cardImageWrap: { position: "relative", width: "100%", height: 180, overflow: "hidden" },
  cardImage: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  badge: { position: "absolute", top: 10, left: 10, color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "3px 10px", borderRadius: 6, letterSpacing: "0.06em", textTransform: "uppercase" },
  heartBtn: { position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" },
  cardBody: { padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  cardTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#1e293b", lineHeight: 1.2, margin: 0 },
  priceWrap: { display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0 },
  price: { fontSize: 16, fontWeight: 700, color: "#1e293b" },
  priceLabel: { fontSize: 8.5, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.04em" },
  locationRow: { display: "flex", alignItems: "center", gap: 4 },
  locationText: { fontSize: 11.5, color: "#94a3b8", fontWeight: 400 },
  tagsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b", background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", fontWeight: 500 },
  metaRow: { display: "flex", gap: 12, marginTop: 2 },
  metaItem: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b", fontWeight: 500 },
  viewBtn: { background: "#0d9488", color: "#fff", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "center", marginTop: "auto", transition: "background 0.15s", letterSpacing: "0.01em", fontFamily: "'DM Sans', sans-serif" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 40, paddingTop: 20, borderTop: "1px solid #e9edf2", flexWrap: "wrap", gap: 12 },
  footerLeft: { fontSize: 10.5, color: "#94a3b8", fontWeight: 500, letterSpacing: "0.04em" },
  footerLinks: { display: "flex", gap: 24 },
  footerLink: { fontSize: 11, color: "#64748b", textDecoration: "none", fontWeight: 500, letterSpacing: "0.04em" },
};