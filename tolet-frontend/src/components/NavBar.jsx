import { useState, useEffect } from "react";
import toletLogo from '../assets/toletlogo.png';

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
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest(".products-menu")) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

        /* LEFT — logo */
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
  letter-spacing: 0px;
  vertical-align: middle;
  color: #0f1d2e;
}

.nav-logo-sub {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  font-size: 10px;
  line-height: 16px;
  letter-spacing: 1px;
  vertical-align: middle;
  text-transform: uppercase;
  color: #000000;
  margin-top: 5px;
  margin-left: 0;
}

        /* CENTER nav links */
        .nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
          list-style: none;
          flex: 1;
           justify-content: flex-end;  /* change from center to flex-end */
  padding-right: 16px;         /* add this */
        }
        .nav-links li a,
        .nav-link-btn {
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
        .nav-links li a:hover,
        .nav-link-btn:hover {
          background: #f0f6ff;
          color: #1a6fa8;
        }

        /* Products dropdown */
        .products-menu {
          position: relative;
        }
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
        .dropdown-item:hover {
          background: #f0f6ff;
          color: #1a6fa8;
        }
        .dropdown-item span.icon {
          font-size: 16px;
          width: 24px;
          text-align: center;
        }

        /* RIGHT actions */
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
  overflow: hidden; /* important - clips the shine line */
}

/* The shine line */
.btn-list::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 120px;
  height: 100%;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 40%,
    rgba(255, 255, 255, 0.55) 50%,
    rgba(255, 255, 255, 0.15) 60%,
    transparent 100%
  );
  transform: skewX(-20deg);
  transition: none;
}

/* Trigger shine on hover */
.btn-list:hover::before {
  animation: shineMove 1.2s ease forwards;
}

@keyframes shineMove {
  0%   { left: -100%; }
  100% { left: 150%; }
}

        /* Login */
        .btn-login {
          font-size: 14px;
          font-weight: 600;
          color: #0f1d2e;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          padding: 9px 14px;
          border-radius: 50px;
          transition: background 0.18s, color 0.18s;
          text-decoration: none;
        }
        .btn-login:hover {
          background: #f3f4f6;
          color: #1a6fa8;
        }

        /* Mobile burger */
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
          transition: all 0.25s;
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
          animation: greenGlow 2.2s ease-in-out infinite;
        }

        @media (max-width: 768px) {
          .nav-links { display: none; }
          .nav-actions { display: none; }
          .mobile-burger { display: flex; }
          .navbar-wrapper { top: 10px; width: calc(100% - 24px); }
        }
      `}</style>

      <div className="navbar-wrapper">
        <nav className="navbar">
          {/* LEFT: Logo */}
          <a href="/" className="nav-logo">
  <img src={toletLogo} alt="Tolet Logo" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
  <div className="nav-logo-text">
    <span className="nav-logo-title">Tolet</span>
    <span className="nav-logo-sub">AI Rental Platform</span>
  </div>
</a>

          {/* CENTER: Nav Links */}
          <ul className="nav-links">
            <li><a href="/tenants">For Tenants</a></li>
            <li><a href="/landlords">For Landlords</a></li>
            <li><a href="/agents">For Agents</a></li>
            <li className="products-menu">
              <button
                className="nav-link-btn"
                onClick={() => setDropdownOpen((v) => !v)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
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
            </li>
          </ul>

          {/* RIGHT: Actions */}
          <div className="nav-actions">
            <a href="/list-property" className="btn-list">
              List Your Proerty
            </a>
            <a href="/login" className="btn-login">Login</a>
          </div>

          {/* Mobile burger */}
          <button
            className="mobile-burger"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </nav>

        {/* Mobile dropdown */}
        <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
          <a href="/tenants">For Tenants</a>
          <a href="/landlords">For Landlords</a>
          <a href="/agents">For Agents</a>
          <a href="/products">Our Products</a>
          <a href="/list-property" className="mobile-cta">List Your Property</a>
          <a href="/login">Login</a>
        </div>
      </div>
    </>
  );
}