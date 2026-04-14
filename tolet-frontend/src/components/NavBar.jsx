import { useState, useEffect } from "react";
import toletLogo from '../assets/toletlogo.png';
import LoginModal from "./LoginModal";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut, sendEmailVerification } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const ChevronDown = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.25s ease",
      display: "inline-block",
      marginLeft: "3px",
      verticalAlign: "middle",
    }}
  >
    <path d="M3 5L7 9L11 5" stroke="#555" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const productsDropdown = [
  { label: "Rental Insights", icon: "📊" },
  { label: "Smart Search", icon: "🔍" },
  { label: "Lease Manager", icon: "📄" },
  { label: "AI Valuation", icon: "🤖" },
];



export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(
  () => sessionStorage.getItem("verifyBannerDismissed") === "true"
);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            setUserData(null);
          }
        } catch (e) {
          console.error(e);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest(".products-menu")) setDropdownOpen(false);
      if (!e.target.closest(".user-menu")) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNavClick = (e, sectionId) => {
    e.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("verifyBannerDismissed");
      await signOut(auth);
      setUserMenuOpen(false);
      setMobileOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResendVerification = async () => {
    try {
      if (authUser) {
        await sendEmailVerification(authUser);
        alert("Verification email sent! Please check your inbox.");
      }
    } catch (e) {
      console.error(e);
      alert("Could not send verification email. Please try again later.");
    }
  };

  // Resolve the best display name from Firestore data → Google displayName → email prefix
  const displayName = userData?.name
    || authUser?.displayName
    || authUser?.email?.split("@")[0]
    || "Me";

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const showVerifyBanner =
    userData &&
    authUser &&
    !authUser.emailVerified &&
    userData.authMethod === "password" &&
    !verifyBannerDismissed;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .navbar-wrapper {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 40px);
          max-width: 1200px;
          z-index: 9999;
          font-family: 'DM Sans', sans-serif;
        }

        .navbar {
          background: #ffffff;
          border-radius: 50px;
          padding: 0 10px 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 58px;
          box-shadow: ${scrolled
            ? "0 8px 40px rgba(0,0,0,0.13), 0 2px 12px rgba(0,0,0,0.07)"
            : "0 4px 24px rgba(0,0,0,0.09), 0 1px 6px rgba(0,0,0,0.05)"};
          transition: box-shadow 0.3s ease;
          gap: 12px;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .nav-logo-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          margin-left: 10px;
        }
        .nav-logo-title {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 18px;
          line-height: 21.6px;
          color: #0f1d2e;
        }
        .nav-logo-sub {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          font-size: 10px;
          line-height: 16px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #000000;
          margin-top: 5px;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
          list-style: none;
          flex: 1;
          justify-content: flex-end;
          padding-right: 16px;
        }
        .nav-links li a, .nav-link-btn {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          text-decoration: none;
          padding: 7px 13px;
          border-radius: 50px;
          transition: background 0.18s, color 0.18s;
          cursor: pointer;
          background: none;
          border: none;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          gap: 2px;
          white-space: nowrap;
        }
        .nav-links li a:hover, .nav-link-btn:hover {
          background: #f0f6ff;
          color: #1a6fa8;
        }

        .products-menu { position: relative; }
        .dropdown-panel {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.13);
          padding: 8px;
          min-width: 200px;
          animation: dropIn 0.2s ease;
          z-index: 100;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          text-decoration: none;
        }
        .dropdown-item:hover { background: #f0f6ff; color: #1a6fa8; }
        .dropdown-item span.icon { font-size: 16px; width: 24px; text-align: center; }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .btn-list {
          background: #006C47;
          color: #fff !important;
          font-size: 13.5px;
          font-weight: 600;
          padding: 9px 18px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
          white-space: nowrap;
          position: relative;
          overflow: hidden;
        }
        .btn-list::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 120px;
          height: 100%;
          background: linear-gradient(120deg,transparent 0%,rgba(255,255,255,0.15) 40%,rgba(255,255,255,0.55) 50%,rgba(255,255,255,0.15) 60%,transparent 100%);
          transform: skewX(-20deg);
        }
        .btn-list:hover::before { animation: shineMove 1.2s ease forwards; }
        @keyframes shineMove {
          0% { left: -100%; }
          100% { left: 150%; }
        }

        .btn-login {
          font-size: 14px;
          font-weight: 600;
          color: #0f1d2e;
          background: none;
          border: 1.5px solid #e5e7eb;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          padding: 8px 18px;
          border-radius: 50px;
          transition: background 0.18s, color 0.18s, border-color 0.18s;
        }
        .btn-login:hover {
          background: #f9fafb;
          border-color: #006C47;
          color: #006C47;
        }

        .user-menu { position: relative; }
        .user-chip {
          display: flex;
          align-items: center;
          gap: 9px;
          background: #f9fafb;
          border: 1.5px solid #e5e7eb;
          padding: 5px 12px 5px 5px;
          border-radius: 50px;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
        }
        .user-chip:hover {
          background: #fff;
          border-color: #006C47;
          box-shadow: 0 4px 14px rgba(0,108,71,0.12);
        }
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #006C47;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .user-chip-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.2;
        }
        .user-chip-name {
          font-size: 13px;
          font-weight: 600;
          color: #0f1d2e;
          max-width: 110px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-chip-role {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .user-panel {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.13);
          padding: 12px;
          min-width: 280px;
          animation: userDropIn 0.2s ease;
          z-index: 100;
        }
        @keyframes userDropIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .user-panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 8px 14px;
          border-bottom: 1px solid #f3f4f6;
          margin-bottom: 8px;
        }
        .user-panel-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #006C47;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .user-panel-info { flex: 1; min-width: 0; }
        .user-panel-name {
          font-size: 14.5px;
          font-weight: 700;
          color: #0f1d2e;
          margin: 0 0 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-panel-email {
          font-size: 11.5px;
          color: #6b7280;
          font-family: 'Inter', sans-serif;
          margin: 0 0 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-panel-role-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 3px 10px;
          border-radius: 50px;
        }
        .user-panel-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 500;
          color: #374151;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .user-panel-item:hover { background: #f9fafb; color: #0f1d2e; }
        .user-panel-item.logout { color: #dc2626; }
        .user-panel-item.logout:hover { background: #fef2f2; }

        .verify-banner {
          position: fixed;
          top: 82px;
          left: 50%;
          transform: translateX(-50%);
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          padding: 10px 18px;
          border-radius: 50px;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 9998;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          font-family: 'DM Sans', sans-serif;
          max-width: calc(100% - 40px);
        }
        .verify-banner-btn {
          background: #f59e0b;
          color: #fff;
          border: none;
          padding: 5px 12px;
          border-radius: 50px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .verify-banner-btn:hover { background: #d97706; }
        .verify-banner-close {
          background: none;
          border: none;
          color: #92400e;
          cursor: pointer;
          padding: 0;
          display: flex;
        }

        .mobile-burger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          flex-direction: column;
          gap: 4px;
        }
        .mobile-burger span {
          display: block;
          width: 22px;
          height: 2px;
          background: #374151;
          border-radius: 2px;
        }

        .mobile-menu {
          display: none;
          position: fixed;
          top: 82px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 40px);
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.14);
          padding: 16px;
          z-index: 9998;
          animation: dropIn 0.2s ease;
        }
        .mobile-menu.open { display: block; }
        .mobile-menu a, .mobile-menu button {
          display: block;
          width: 100%;
          text-align: left;
          font-size: 15px;
          font-weight: 500;
          color: #374151;
          padding: 12px 16px;
          border-radius: 12px;
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.15s;
        }
        .mobile-menu a:hover, .mobile-menu button:hover {
          background: #f0f6ff;
          color: #1a6fa8;
        }
        .mobile-menu .mobile-cta {
          background: #16a34a;
          color: #fff;
          text-align: center;
          border-radius: 50px;
          margin-top: 8px;
        }
        .mobile-user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: #f9fafb;
          border-radius: 14px;
          margin-bottom: 10px;
        }
        .mobile-logout { color: #dc2626 !important; font-weight: 600 !important; }

        @media (max-width: 768px) {
          .nav-links { display: none; }
          .nav-actions { display: none; }
          .mobile-burger { display: flex; }
          .navbar-wrapper { top: 10px; width: calc(100% - 24px); }
        }
      `}</style>

      <div className="navbar-wrapper">
        <nav className="navbar">
          <a href="/" className="nav-logo">
            <img src={toletLogo} alt="Tolet Logo" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
            <div className="nav-logo-text">
              <span className="nav-logo-title">Tolet</span>
              <span className="nav-logo-sub">AI Rental Platform</span>
            </div>
          </a>

          <ul className="nav-links">
            <li><a href="#tenants" onClick={(e) => handleNavClick(e, "tenants")}>For Tenants</a></li>
            <li><a href="#landlords" onClick={(e) => handleNavClick(e, "landlords")}>For Landlords</a></li>
            <li><a href="#agents" onClick={(e) => handleNavClick(e, "agents")}>For Channel Partners</a></li>
            {/* <li className="products-menu">
              <button className="nav-link-btn" onClick={() => setDropdownOpen((v) => !v)} aria-expanded={dropdownOpen} aria-haspopup="true">
                Our Products <ChevronDown open={dropdownOpen} />
              </button>
              {dropdownOpen && (
                <div className="dropdown-panel">
                  {productsDropdown.map((item) => (
                    <a key={item.label} href="#" className="dropdown-item">
                      <span className="icon">{item.icon}</span>
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </li> */}
          </ul>

          <div className="nav-actions">
            <a href="/list-property" className="btn-list">List Your Property</a>

            {userData ? (
              <div className="user-menu">
                <button className="user-chip" onClick={() => setUserMenuOpen((v) => !v)}>
                  <div className="user-avatar">{getInitials(displayName)}</div>
                  <div className="user-chip-text">
                    <span className="user-chip-name">{displayName}</span>
                  </div>
                  <ChevronDown open={userMenuOpen} />
                </button>

                {userMenuOpen && (
                  <div className="user-panel">
                    <div className="user-panel-header">
                      <div className="user-panel-avatar">{getInitials(displayName)}</div>
                      <div className="user-panel-info">
                        <p className="user-panel-name">{displayName}</p>
                      </div>
                    </div>
                    
                    <button className="user-panel-item logout" onClick={handleLogout}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn-login" onClick={() => setOpen(true)}>
                Sign Up / Log In
              </button>
            )}
          </div>

          <button className="mobile-burger" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </nav>

        {/* Email verification banner */}
        {showVerifyBanner && (
          <div className="verify-banner">
            <span>📧 Please verify your email</span>
            <button className="verify-banner-btn" onClick={handleResendVerification}>Resend</button>
            <button className="verify-banner-close" onClick={() => {
  setVerifyBannerDismissed(true);
  sessionStorage.setItem("verifyBannerDismissed", "true");
}} aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
          {userData && (
            <div className="mobile-user-card">
              <div className="user-panel-avatar">{getInitials(displayName)}</div>
              <div className="user-panel-info">
                <p className="user-panel-name">{displayName}</p>
              </div>
            </div>
          )}
          <a href="#tenants" onClick={(e) => handleNavClick(e, "tenants")}>For Tenants</a>
          <a href="#landlords" onClick={(e) => handleNavClick(e, "landlords")}>For Landlords</a>
          <a href="#agents" onClick={(e) => handleNavClick(e, "agents")}>For Channel Partners</a>
          <a href="/products">Our Products</a>
          <a href="/list-property" className="mobile-cta">List Your Property</a>
          {userData ? (
            <button className="mobile-logout" onClick={handleLogout}>Logout</button>
          ) : (
            <button onClick={() => setOpen(true)}>Sign Up / Log In</button>
          )}
        </div>
      </div>
      <LoginModal
        isOpen={open}
        onClose={async () => {
          setOpen(false);
          const user = auth.currentUser;
          if (user) {
            try {
              const snap = await getDoc(doc(db, "users", user.uid));
              if (snap.exists()) {
                setUserData(snap.data());
                setAuthUser(user);
              }
            } catch (e) {
              console.error(e);
            }
          }
        }}
      />
    </>
  );
}