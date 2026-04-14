import { useState, useEffect, useRef } from "react";
import NavBar from "../components/NavBar";
import LoginModal from "../components/LoginModal";
import cloudsBg from "../assets/mainbg.png";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const featurePills = [
  "Automated Rent Collection","AI Matched Property","Rent Comparison Chart",
  "Screen Tenants, Landlords","E-Signed Agreement","Rera Agents",
];

const placeholderPhrases = [
  "2BHK from KK Nagar",
  "3BHK near Anna Nagar with parking",
  "1BHK under ₹15,000 in Velachery",
  "Pet-friendly flat in T Nagar",
  "Furnished studio near OMR",
  "Independent house in Adyar",
];

const directOwnerFeatures = [
  { num: 1, title: "No Brokerage", sub: "Saves your Money" },
  { num: 2, title: "AI Matches Your Search", sub: "Platform Sourced verified Direct owners" },
  { num: 3, title: "E-Signed Agreement", sub: "Legal Protection" },
  { num: 4, title: "Owner Background check", sub: "Safe Your Deposit" },
  { num: 5, title: "Detailed Property Information", sub: "Quick Your need" },
];

const brokerFeatures = [
  { num: 1, title: "RERA Verified Agent", sub: "Trust Built" },
  { num: 2, title: "Pay Brokerage Through Platform", sub: "Discover high-end inventory and exclusive developer units." },
  { num: 3, title: "Top Rated Broker Optimization", sub: "Score and Review Based" },
  { num: 4, title: "Full Support Move in", sub: "Broker handles paperwork, registration" },
  { num: 5, title: "Mediate With Landlords", sub: "Tension Free from Landlord" },
];

const landlordFeatures = [
  { title: "AI-powered tenant matching", desc: "Our neural networks analyze tenant preferences to suggest your home to the perfect matches." },
  { title: "Background Screens for Tenant", desc: "Verified identity, employment, and rental history checks to protect your property and peace of mind." },
  { title: "Automated Rent Collection", desc: "Set-and-forget monthly collection with auto-reminders, receipts, and instant bank transfers." },
  { title: "VR Virtual Videos", desc: "Immersive 360° walkthroughs let prospective tenants tour your property remotely anytime." },
  { title: "Property Valuation", desc: "AI-driven market analysis benchmarks your property against 4M+ data points for optimal pricing." },
  { title: "Avoid Fake calls", desc: "Smart call screening filters out spam and unverified enquiries so only genuine leads reach you." },
];

const listingSteps = [
  { num: 1, title: "Create account", desc: "Simple 30-second signup with your professional credentials.", active: true },
  { num: 2, title: "Add details", desc: "Upload photos and specs. Our AI enhances your descriptions automatically.", active: false },
  { num: 3, title: "Free For Listing", desc: "Transparent one-time listing fee with no hidden recurring costs.", active: false },
  { num: 4, title: "Receive inquiries", desc: "Sit back as Tolet matches and funnels pre-vetted leads to you.", active: false },
];

const agentFeatures = [
  { title: "Qualified leads", desc: "AI Match Tenant Requirement With Your listing" },
  { title: "Verified Tenants", desc: "Background Screening for Tenants Option" },
  { title: "Secure Commission", desc: "Brokerage Collected through Platform and dispose to you automatically" },
  { title: "Broker Dashboard", desc: "Track Listing Leads deal pipeline and Everything in a place" },
  { title: "Full Support Scope", desc: "Score Based Services" },
];

function FeatureList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {items.map((f, idx) => (
        <div
          key={f.num}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "12px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: "28px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              border: "1.5px solid #d6e4ed",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: 700, color: "#3a6880",
              background: "#fff", fontFamily: "'Raleway', sans-serif",
              flexShrink: 0,
            }}>
              {f.num}
            </div>
            {idx < items.length - 1 && (
              <div style={{ width: "1.5px", flex: 1, minHeight: "16px", background: "#d6e4ed", marginTop: "2px" }} />
            )}
          </div>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start",
            justifyContent: "flex-start",
            paddingTop: "4px",
            paddingBottom: idx < items.length - 1 ? "16px" : "0",
            flex: 1,
            minWidth: 0,
          }}>
            <p style={{
              margin: "0 0 3px 0",
              fontSize: "14px", fontWeight: 700, color: "#0b1f2e",
              fontFamily: "'Raleway', sans-serif",
              textAlign: "left", lineHeight: "1.3",
            }}>
              {f.title}
            </p>
            <p style={{
              margin: 0,
              fontSize: "13.5px", color: "#4a6d7f",
              fontFamily: "'Inter', sans-serif",
              textAlign: "left", lineHeight: "1.5",
            }}>
              {f.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [heroVisible, setHeroVisible] = useState(false);
  const [visible, setVisible] = useState({});
  const [searchError, setSearchError] = useState("");
  const refs = useRef({});
  const inputRef = useRef(null);

  const [typedText, setTypedText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const phraseIdx = useRef(0);
  const charIdx = useRef(0);
  const isDeleting = useRef(false);
  const pauseRef = useRef(false);

  // ── Auth state ────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const navigate = useNavigate();

  // Keep isLoggedIn in sync with Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return unsub;
  }, []);

  /**
   * guardedAction — runs `action` immediately if logged in,
   * otherwise opens LoginModal and replays `action` after login.
   */
  const guardedAction = (action) => {
    if (isLoggedIn) {
      action();
    } else {
      setPendingAction(() => action);
      setShowLoginModal(true);
    }
  };

  /**
   * saveSearchHistory — if logged in, records the query in Firestore.
   * Guests search freely and nothing is stored.
   */
  const saveSearchHistory = async (query) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, "users", user.uid, "searchHistory"), {
        query,
        searchedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to save search history:", e);
    }
  };

  const handleModalClose = () => {
    setShowLoginModal(false);
    if (pendingAction && auth.currentUser) pendingAction();
    setPendingAction(null);
  };

  // ── Search ────────────────────────────────────────────────────────
  const handleSearch = () => {
    if (!query.trim()) {
      setSearchError("Please ask something or search your home");
      if (inputRef.current) inputRef.current.focus();
      setTimeout(() => setSearchError(""), 3000);
      return;
    }
    const q = query.trim();
    setSearchError("");
    saveSearchHistory(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // ── Plus button ───────────────────────────────────────────────────
  const handlePlusClick = () => {
    guardedAction(() => {
      // TODO: open post / add listing flow
      navigate("/list-property");
    });
  };

  // ── Typing animation ──────────────────────────────────────────────
  useEffect(() => {
    if (query || isFocused) { setTypedText(""); return; }

    const tick = () => {
      const current = placeholderPhrases[phraseIdx.current];
      if (pauseRef.current) return;

      if (!isDeleting.current) {
        charIdx.current++;
        setTypedText(current.slice(0, charIdx.current));
        if (charIdx.current === current.length) {
          pauseRef.current = true;
          setTimeout(() => { pauseRef.current = false; isDeleting.current = true; }, 1800);
        }
      } else {
        charIdx.current--;
        setTypedText(current.slice(0, charIdx.current));
        if (charIdx.current === 0) {
          isDeleting.current = false;
          phraseIdx.current = (phraseIdx.current + 1) % placeholderPhrases.length;
        }
      }
    };

    const speed = isDeleting.current ? 35 : 65;
    const timer = setInterval(tick, speed);
    return () => clearInterval(timer);
  }, [query, isFocused, typedText]);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) setVisible((p) => ({ ...p, [e.target.dataset.key]: true }));
      }),
      { threshold: 0.1 }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const rf = (key) => (el) => { refs.current[key] = el; };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=Inter:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Raleway', sans-serif; background: #fff; overflow-x: hidden; }

        .hero-page {
          position: relative; min-height: 100vh; min-height: 100dvh;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; overflow: hidden;
        }
        .hero-page::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(175deg,#d6edfa 0%,#b8dcf5 40%,#a4d0f0 100%);
          z-index: 0;
        }
        .bg-clouds {
          position: absolute; inset: 0;
          background-image: url('${cloudsBg}');
          background-size: cover; background-position: center top;
          opacity: 0.55; z-index: 1;
        }

        .bg-skyline-wrap {
          position: absolute; bottom: 0; left: 0;
          width: 100%; height: 70%;
          z-index: 2; pointer-events: none; overflow: hidden; opacity: 0.2;
        }
        .bg-skyline-track {
          display: flex; width: 200%; height: 100%;
          animation: skyScroll 60s linear infinite;
        }
        @keyframes skyScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .bg-skyline-strip { flex: 0 0 50%; height: 100%; }
        .bg-skyline-strip svg { width: 100%; height: 100%; display: block; }
        .bg-skyline-wrap::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 55%;
          background: linear-gradient(to bottom,rgba(180,220,245,1) 0%,transparent 100%);
          pointer-events: none;
        }

        .hero-content {
          position: relative; z-index: 10;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 120px 24px 60px;
          width: 100%; max-width: 860px; margin: 0 auto;
        }

        .anim { opacity: 0; transform: translateY(22px); }
        .anim.v { opacity: 1; transform: translateY(0); }

        .hero-badge {
          display: inline-flex; align-items: center;
          background: #1a8fd1; color: #fff; font-size: 13px; font-weight: 600;
          font-family: 'Raleway', sans-serif; padding: 7px 20px; border-radius: 50px;
          margin-bottom: 28px; letter-spacing: .3px;
          box-shadow: 0 2px 12px rgba(26,143,209,.35);
          transition: opacity .6s ease .1s, transform .6s ease .1s;
        }

        .hero-title {
          font-size: clamp(36px,7vw,72px); font-weight: 800;
          line-height: 1.0;
          color: #0b3a5e; letter-spacing: -1px; font-family: 'Raleway', sans-serif;
          margin-bottom: 0;
          transition: opacity .6s ease .25s, transform .6s ease .25s;
        }
        .hero-title-italic {
          font-size: clamp(36px,7vw,72px); font-weight: 800; font-style: italic;
          line-height: 1.0;
          color: #0b3a5e; letter-spacing: -1px;
          margin-bottom: 14px;
          display: block; font-family: 'Raleway', sans-serif;
          transition: opacity .6s ease .35s, transform .6s ease .35s;
        }

        .hero-sub {
          font-size: 16px; font-weight: 500; color: #3a6880; margin-bottom: 28px;
          font-family: 'Inter', sans-serif;
          transition: opacity .6s ease .45s, transform .6s ease .45s;
        }
        .search-card {
          width: 100%; max-width: 750px; background: #fff; border-radius: 18px;
          padding: 14px 16px; box-shadow: 0 8px 32px rgba(10,60,100,.13); margin-bottom: 12px;
          transition: opacity .6s ease .55s, transform .6s ease .55s;
        }
        .search-card.has-error {
          box-shadow: 0 8px 32px rgba(10,60,100,.13), 0 0 0 2px #ef4444;
        }
        .search-input-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .search-input {
          border: none; outline: none; font-size: 15px; font-weight: 500;
          color: #0b3a5e; font-family: 'Inter', sans-serif; background: transparent;
        }
        .search-input::placeholder { color: #9ab5c7; }

        .search-input-wrap {
          flex: 1; position: relative; min-width: 0; overflow: hidden;
        }
        .search-input-wrap .search-input {
          width: 100%; display: block; position: relative; z-index: 2; background: transparent;
          padding: 6px 0;
        }
        .typing-placeholder {
          position: absolute; left: 0; top: 0; bottom: 0;
          right: 0;
          display: flex; align-items: center;
          font-size: 15px; font-weight: 500; color: #9ab5c7;
          font-family: 'Inter', sans-serif;
          pointer-events: none; z-index: 1;
          white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
          padding: 6px 0;
        }
        .typing-cursor {
          font-weight: 300; color: #1a8fd1;
          animation: cursorBlink 1s steps(1) infinite;
          margin-left: 1px;
        }
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .search-error-msg {
          font-size: 13px; color: #ef4444; font-weight: 500;
          font-family: 'Inter', sans-serif;
          margin-bottom: 24px; min-height: 20px;
          display: flex; align-items: center; gap: 6px;
          animation: errorSlide 0.3s ease;
        }
        .search-error-msg svg { flex-shrink: 0; }
        @keyframes errorSlide {
          0% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .search-sparkle { color: #1a8fd1; font-size: 18px; flex-shrink: 0; display: inline-block; animation: sparkleRotate 4s ease-in-out infinite; }
        @keyframes sparkleRotate {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(360deg); }
          100% { transform: rotate(360deg); }
        }
        .search-btn {
          background: #1a8fd1; color: #fff; border: none; border-radius: 10px;
          padding: 9px 20px; font-size: 14px; font-weight: 700; cursor: pointer;
          font-family: 'Raleway', sans-serif; flex-shrink: 0;
          position: relative; overflow: hidden;
          transition: background .18s, transform .15s;
        }
        .search-btn::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 120px; height: 100%;
          background: linear-gradient(120deg,transparent 0%,rgba(255,255,255,.1) 40%,rgba(255,255,255,.45) 50%,rgba(255,255,255,.1) 60%,transparent 100%);
          transform: skewX(-20deg);
          animation: searchShimmer 2.5s ease-in-out infinite;
        }
        @keyframes searchShimmer {
          0% { left: -100%; }
          60% { left: 150%; }
          100% { left: 150%; }
        }
        .search-btn:hover { background: #0e78b5; transform: translateY(-1px); }
        .plus-btn {
          width: 32px; height: 32px; border-radius: 8px; background: #1a8fd1;
          color: #fff; border: none; font-size: 20px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .18s, transform .15s;
        }
        .plus-btn:hover { background: #0e78b5; transform: scale(1.08); }
        .feature-pills-grid {
          display: flex; flex-wrap: wrap; gap: 12px;
          justify-content: center; max-width: 780px;
          transition: opacity .6s ease .7s, transform .6s ease .7s;
        }
        .feature-pill {
          background: rgba(11,139,224,0.7); color: #fff; font-size: 14px; font-weight: 600;
          font-family: 'Raleway', sans-serif; padding: 12px 24px; border-radius: 50px;
          border: none; outline: none; cursor: pointer; white-space: nowrap;
          position: relative; overflow: hidden;
          transition: transform .2s, box-shadow .2s;
        }
        .feature-pill::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 120px; height: 100%;
          background: linear-gradient(120deg,transparent 0%,rgba(255,255,255,.15) 40%,rgba(255,255,255,.55) 50%,rgba(255,255,255,.15) 60%,transparent 100%);
          transform: skewX(-20deg);
        }
        .feature-pill:hover::before { animation: shine 1.2s ease forwards; }
        .feature-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(11,139,224,.35); }
        @keyframes shine { 0%{left:-100%} 100%{left:150%} }

        .tp-section { background: #fff; padding: 80px 24px; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; }
        .tp-inner { max-width: 1100px; margin: 0 auto; width: 100%; }
        .tp-badge {
          display: inline-block; background: #e8faf4; color: #00c27a;
          font-size: 11px; font-weight: 700; font-family: 'Raleway', sans-serif;
          padding: 5px 14px; border-radius: 50px; margin-bottom: 20px;
          letter-spacing: .5px; text-transform: uppercase;
        }
        .tp-title {
          font-size: clamp(30px,5vw,52px); font-weight: 800; color: #0b1f2e;
          line-height: 1.1; margin-bottom: 4px; letter-spacing: -1px;
          font-family: 'Raleway', sans-serif;
        }
        .tp-title-italic { font-style: italic; color: #1a8fd1; }
        .tp-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px; }
        .tp-card {
          background: #fff; border: 1.5px solid #e8eef3; border-radius: 20px;
          padding: 28px;
          display: flex; flex-direction: column; align-items: flex-start; gap: 20px;
          opacity: 0; transform: translateY(30px);
          transition: box-shadow .25s, transform .25s;
          width: 100%;
        }
        .tp-card.v { opacity: 1; transform: translateY(0); }
        .tp-card:hover { box-shadow: 0 12px 48px rgba(10,60,100,.1); transform: translateY(-3px); }
        .tp-card-header { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; }
        .tp-card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .tp-card-icon.blue  { background: #e8f4fb; }
        .tp-card-icon.green { background: #e8faf4; }
        .tp-card-badge {
          font-size: 11px; font-weight: 700; font-family: 'Raleway', sans-serif;
          padding: 4px 12px; border-radius: 50px; letter-spacing: .5px; text-transform: uppercase;
        }
        .tp-card-badge.blue  { background: #e8f4fb; color: #1a8fd1; }
        .tp-card-badge.green { background: #e8faf4; color: #00c27a; }
        .tp-card-body { width: 100%; text-align: left; }
        .tp-card-title {
          font-size: 22px; font-weight: 800; color: #0b1f2e;
          margin: 0 0 4px; letter-spacing: -.3px; font-family: 'Raleway', sans-serif;
          text-align: left;
        }
        .tp-card-desc {
          font-size: 13.5px; color: #4a6d7f; line-height: 1.6;
          margin: 0; font-family: 'Inter', sans-serif; text-align: left;
        }
        .tp-btn-blue, .tp-btn-dark {
          width: 100%; border: none; border-radius: 12px; padding: 16px;
          font-size: 15px; font-weight: 700; font-family: 'Raleway', sans-serif;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: auto; position: relative; overflow: hidden;
          transition: background .18s, transform .15s, box-shadow .18s;
        }
        .tp-btn-blue { background: #1a8fd1; color: #fff; }
        .tp-btn-dark { background: #006C47; color: #fff; }
        .tp-btn-blue::before, .tp-btn-dark::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 120px; height: 100%;
          background: linear-gradient(120deg,transparent 0%,rgba(255,255,255,.15) 40%,rgba(255,255,255,.5) 50%,rgba(255,255,255,.15) 60%,transparent 100%);
          transform: skewX(-20deg);
        }
        .tp-btn-blue:hover::before, .tp-btn-dark:hover::before { animation: shine 1.2s ease forwards; }
        .tp-btn-blue:hover { background: #0e78b5; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,143,209,.3); }
        .tp-btn-dark:hover { background: #005538; transform: translateY(-1px); box-shadow: 0 0 16px rgba(0,108,71,.4); }

        .ll-section { background: #f8fbfd; padding: 80px 24px; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; }
        .ll-outer { max-width: 1100px; margin: 0 auto; width: 100%; }
        .ll-heading-row { width: 100%; margin-bottom: 40px; }
        .ll-inner {
          max-width: 1100px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
          align-items: start;
        }
        .ll-left { display: flex; flex-direction: column; align-items: flex-start; }
        .ll-badge {
          display: inline-block; background: #e8f4fb; color: #1a8fd1;
          font-size: 11px; font-weight: 700; font-family: 'Raleway', sans-serif;
          padding: 5px 14px; border-radius: 50px; margin-bottom: 18px;
          letter-spacing: .5px; text-transform: uppercase;
        }
        .ll-title {
          font-size: clamp(28px,4.5vw,50px); font-weight: 800; color: #0b1f2e;
          line-height: 1.1; letter-spacing: -1px; margin: 0 0 4px;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ll-title-blue {
          font-size: clamp(28px,4.5vw,50px); font-weight: 800; font-style: italic;
          color: #1a8fd1; line-height: 1.1; letter-spacing: -1px;
          margin: 0 0 0; display: block;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ll-features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 20px; }
        .ll-feature-item {
          display: flex; flex-direction: column; align-items: flex-start; gap: 5px;
          opacity: 0; transform: translateY(20px);
          transition: opacity .5s ease, transform .5s ease;
          text-align: left;
        }
        .ll-feature-item.v { opacity: 1; transform: translateY(0); }
        .ll-feat-icon {
          width: 34px; height: 34px; background: #e8f4fb; border-radius: 8px;
          display: flex; align-items: center; justify-content: center; margin-bottom: 4px; flex-shrink: 0;
        }
        .ll-feature-title {
          font-size: 14px; font-weight: 700; color: #0b1f2e; margin: 0;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ll-feature-desc {
          font-size: 13.5px; color: #4a6d7f; line-height: 1.55; margin: 0;
          font-family: 'Inter', sans-serif; text-align: left;
        }

        .ll-right { display: flex; flex-direction: column; gap: 20px; }
        .ll-how-title {
          font-size: 20px; font-weight: 800; color: #0b1f2e;
          letter-spacing: -.3px; margin: 0 0 4px;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ll-steps { display: flex; flex-direction: column; }
        .ll-step { display: flex; flex-direction: row; align-items: flex-start; gap: 16px; }
        .ll-step-col { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 34px; }
        .ll-step-num {
          width: 34px; height: 34px; border-radius: 50%;
          background: #1a8fd1; color: #fff; font-size: 14px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          font-family: 'Raleway', sans-serif;
        }
        .ll-step-num.outline { background: #fff; color: #3a6880; border: 1.5px solid #d6e4ed; }
        .ll-step-line { width: 1.5px; flex: 1; min-height: 16px; background: #d6e4ed; margin-top: 3px; }
        .ll-step:last-child .ll-step-line { display: none; }
        .ll-step-body {
          display: flex; flex-direction: column; align-items: flex-start;
          padding-top: 5px; padding-bottom: 22px; flex: 1; text-align: left;
        }
        .ll-step:last-child .ll-step-body { padding-bottom: 0; }
        .ll-step-title {
          font-size: 14px; font-weight: 700; color: #0b1f2e; margin: 0 0 3px;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ll-step-desc {
          font-size: 13.5px; color: #4a6d7f; margin: 0; line-height: 1.55;
          font-family: 'Inter', sans-serif; text-align: left;
        }
        .ll-btn {
          background: #1a8fd1; color: #fff; border: none; border-radius: 12px;
          padding: 16px 28px; font-size: 15px; font-weight: 700;
          font-family: 'Raleway', sans-serif; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; position: relative; overflow: hidden;
          transition: background .18s, transform .15s, box-shadow .18s;
        }
        .ll-btn::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 120px; height: 100%;
          background: linear-gradient(120deg,transparent 0%,rgba(255,255,255,.15) 40%,rgba(255,255,255,.5) 50%,rgba(255,255,255,.15) 60%,transparent 100%);
          transform: skewX(-20deg);
        }
        .ll-btn:hover::before { animation: shine 1.2s ease forwards; }
        .ll-btn:hover { background: #0e78b5; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(26,143,209,.3); }
        .ll-trust { font-size: 11.5px; color: #b0c8d6; text-align: center; margin: 0; font-family: 'Inter', sans-serif; }
        .ll-pricing-card { background: #e8f4fb; border-radius: 16px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 14px; margin-top: 12px; }
        .ll-pricing-icon { width: 40px; height: 40px; background: #1a8fd1; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ll-pricing-title { font-size: 14px; font-weight: 700; color: #0b3a5e; margin: 0 0 4px; font-family: 'Raleway', sans-serif; text-align: left; }
        .ll-pricing-desc  { font-size: 13.5px; color: #4a6d7f; margin: 0; line-height: 1.55; font-family: 'Inter', sans-serif; text-align: left; }

        .ag-section { background: #fff; padding: 80px 24px 0; position: relative; overflow: hidden; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; }
        .ag-glow-orb {
          position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
          width: 900px; height: 420px;
          background: radial-gradient(ellipse at center,rgba(26,143,209,.35) 0%,rgba(26,143,209,.18) 35%,rgba(26,143,209,.07) 60%,transparent 75%);
          pointer-events: none; z-index: 0;
          animation: orbPulse 3s ease-in-out infinite;
        }
        @keyframes orbPulse {
          0%,100% { opacity:.75; transform:translateX(-50%) scale(1); }
          50%      { opacity:1;   transform:translateX(-50%) scale(1.1); }
        }
        .ag-inner { max-width: 1100px; margin: 0 auto; position: relative; z-index: 1; width: 100%; }
        .ag-badge {
          display: inline-block; background: #fff4e8; color: #f07b2a;
          font-size: 11px; font-weight: 700; font-family: 'Raleway', sans-serif;
          padding: 5px 14px; border-radius: 50px; margin-bottom: 18px;
          letter-spacing: .5px; text-transform: uppercase;
        }
        .ag-title {
          font-size: clamp(26px,4vw,46px); font-weight: 800; color: #0b1f2e;
          line-height: 1.1; letter-spacing: -1px; margin: 0 0 4px;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ag-title-blue {
          font-size: clamp(24px,3.8vw,42px); font-weight: 800; font-style: italic;
          color: #1a8fd1; line-height: 1.15; letter-spacing: -1px;
          margin: 0 0 48px; display: block;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ag-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 16px; }
        .ag-grid-bottom {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
          margin-bottom: 48px; max-width: 740px; margin-left: auto; margin-right: auto;
        }
        .ag-card {
          border: 1.5px solid #e8eef3; border-radius: 14px; padding: 20px; background: #fff;
          display: flex; flex-direction: column; align-items: flex-start;
          opacity: 0; transform: translateY(24px);
          transition: box-shadow .2s, border-color .2s, transform .2s;
        }
        .ag-card.v { opacity: 1; transform: translateY(0); }
        .ag-card:hover { box-shadow: 0 4px 24px rgba(10,60,100,.1); border-color: #c8dff0; transform: translateY(-2px); }
        .ag-card-title {
          font-size: 14px; font-weight: 700; color: #0b1f2e; margin: 0 0 6px;
          font-family: 'Raleway', sans-serif; text-align: left;
        }
        .ag-card-desc {
          font-size: 13.5px; color: #4a6d7f; line-height: 1.55; margin: 0;
          font-family: 'Inter', sans-serif; text-align: left;
        }
        .ag-cta-wrap { display: flex; justify-content: center; margin-bottom: 90px; position: relative; z-index: 2; }
        .ag-btn {
          background: #1a8fd1; color: #fff; border: none; border-radius: 50px;
          padding: 16px 36px; font-size: 15px; font-weight: 700;
          font-family: 'Raleway', sans-serif; cursor: pointer;
          display: flex; align-items: center; gap: 10px;
          position: relative; overflow: hidden;
          transition: background .18s, transform .15s, box-shadow .18s;
          animation: btnGlow 2.5s ease-in-out infinite;
        }
        .ag-btn::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 120px; height: 100%;
          background: linear-gradient(120deg,transparent 0%,rgba(255,255,255,.15) 40%,rgba(255,255,255,.5) 50%,rgba(255,255,255,.15) 60%,transparent 100%);
          transform: skewX(-20deg);
        }
        .ag-btn:hover::before { animation: shine 1.2s ease forwards; }
        .ag-btn:hover { background: #0e78b5; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(26,143,209,.5); animation: none; }
        @keyframes btnGlow {
          0%,100% { box-shadow: 0 4px 20px rgba(26,143,209,.38); }
          50%      { box-shadow: 0 4px 40px rgba(26,143,209,.7),0 0 70px rgba(26,143,209,.28); }
        }

        .site-footer {
          background: #fff; border-top: 1px solid #e8eef3;
          padding: 24px 32px; display: flex; align-items: center; justify-content: space-between;
          position: relative; z-index: 1; margin-top: auto;
        }
        .footer-copy { font-size: 11.5px; color: #b0c8d6; font-weight: 500; text-transform: uppercase; letter-spacing: .3px; font-family: 'Inter', sans-serif; }
        .footer-links { display: flex; gap: 28px; }
        .footer-link { font-size: 12px; color: #7a97aa; font-weight: 600; text-decoration: none; text-transform: uppercase; letter-spacing: .4px; font-family: 'Raleway', sans-serif; transition: color .18s; }
        .footer-link:hover { color: #1a8fd1; }

        .reveal { opacity: 0; transform: translateY(28px); transition: opacity .6s ease, transform .6s ease; }
        .reveal.v { opacity: 1; transform: translateY(0); }

        @media (max-width: 1024px) {
          .hero-content { padding: 110px 20px 50px; }
          .tp-section { padding: 60px 20px; }
          .ll-inner { gap: 40px; }
          .ag-grid { gap: 12px; }
          .ag-grid-bottom { gap: 12px; }
        }
        @media (max-width: 780px) {
          .ll-inner { grid-template-columns: 1fr; gap: 40px; }
          .ll-section { padding: 60px 20px; }
          .tp-cards { gap: 20px; }
          .ag-section { padding: 60px 20px 0; }
        }
        @media (max-width: 680px) {
          .tp-cards { grid-template-columns: 1fr; }
          .tp-section { padding: 50px 16px; min-height: auto; }
          .ag-grid { grid-template-columns: 1fr; }
          .ag-grid-bottom { grid-template-columns: 1fr; max-width: 100%; }
          .ag-section { padding: 50px 16px 0; min-height: auto; }
          .hero-content { padding: 100px 16px 40px; }
          .hero-title { font-size: clamp(32px,10vw,48px); }
          .hero-title-italic { font-size: clamp(32px,10vw,48px); }
          .hero-sub { font-size: 14px; margin-bottom: 20px; }
          .hero-badge { font-size: 11px; padding: 6px 16px; margin-bottom: 20px; }
          .feature-pill { font-size: 12px; padding: 10px 16px; }
          .feature-pills-grid { gap: 8px; }
          .search-card { padding: 12px 14px; margin-bottom: 8px; }
          .search-btn { padding: 8px 16px; font-size: 13px; }
          .bg-skyline-wrap { height: 92%; opacity: 0.32; }
          .ll-section { padding: 50px 16px; min-height: auto; }
          .ll-features-grid { gap: 20px 16px; }
        }
        @media (max-width: 520px) {
          .site-footer { flex-direction: column; gap: 16px; text-align: center; padding: 20px 16px; }
          .footer-links { flex-wrap: wrap; justify-content: center; gap: 16px; }
          .ll-features-grid { grid-template-columns: 1fr; }
          .hero-content { padding: 90px 14px 32px; }
          .hero-title { font-size: clamp(28px,9vw,40px); }
          .hero-title-italic { font-size: clamp(28px,9vw,40px); margin-bottom: 10px; }
          .hero-sub { font-size: 13px; }
          .hero-badge { font-size: 10.5px; padding: 5px 14px; }
          .search-card { border-radius: 14px; padding: 10px 12px; margin-bottom: 6px; }
          .search-input { font-size: 13px; }
          .typing-placeholder { font-size: 13px; }
          .search-btn { padding: 7px 14px; font-size: 12px; }
          .plus-btn { width: 28px; height: 28px; font-size: 18px; }
          .feature-pill { font-size: 11px; padding: 8px 14px; }
          .feature-pills-grid { gap: 6px; }
          .bg-skyline-wrap { height: 95%; opacity: 0.38; }
          .tp-title { font-size: clamp(26px,7vw,36px); }
          .tp-section { padding: 40px 14px; }
          .tp-card { padding: 20px; gap: 16px; }
          .tp-card-title { font-size: 18px; }
          .ll-title { font-size: clamp(24px,7vw,36px); }
          .ll-title-blue { font-size: clamp(24px,7vw,36px); }
          .ll-section { padding: 40px 14px; }
          .ag-title { font-size: clamp(22px,6vw,34px); }
          .ag-title-blue { font-size: clamp(20px,5.5vw,30px); margin-bottom: 28px; }
          .ag-section { padding: 40px 14px 0; }
          .ag-card { padding: 16px; }
          .ag-cta-wrap { margin-bottom: 60px; }
          .ag-btn { padding: 14px 28px; font-size: 14px; }
        }
        @media (max-width: 360px) {
          .hero-content { padding: 80px 12px 28px; }
          .hero-title { font-size: 26px; }
          .hero-title-italic { font-size: 26px; }
          .feature-pill { font-size: 10.5px; padding: 7px 12px; }
          .tp-card { padding: 16px; }
        }
      `}</style>

      {/* ── LoginModal — single instance, controlled by guardedAction ── */}
      <LoginModal isOpen={showLoginModal} onClose={handleModalClose} />

      <NavBar />

      {/* HERO */}
      <div className="hero-page" id="tenants">
        <div className="bg-clouds" />
        <div className="bg-skyline-wrap">
          <div className="bg-skyline-track">
            {[0,1].map((copy) => (
              <div key={copy} className="bg-skyline-strip">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMax meet">
                  <defs>
                    <linearGradient id={`fade${copy}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="white" stopOpacity="1"/>
                      <stop offset="50%" stopColor="white" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <g fill="#4a5568">
                    <rect x="0" y="310" width="55" height="190"/><rect x="40" y="270" width="40" height="230"/>
                    <rect x="70" y="290" width="50" height="210"/><rect x="110" y="240" width="35" height="260"/>
                    <rect x="135" y="280" width="45" height="220"/><rect x="170" y="260" width="30" height="240"/>
                    <rect x="195" y="310" width="50" height="190"/><rect x="340" y="320" width="45" height="180"/>
                    <rect x="380" y="280" width="30" height="220"/><rect x="1060" y="305" width="45" height="195"/>
                    <rect x="1100" y="270" width="35" height="230"/><rect x="1130" y="295" width="55" height="205"/>
                    <rect x="1240" y="295" width="50" height="205"/><rect x="1285" y="260" width="40" height="240"/>
                    <rect x="1315" y="285" width="55" height="215"/><rect x="1360" y="240" width="35" height="260"/>
                    <rect x="1385" y="310" width="55" height="190"/>
                  </g>
                  <g fill="#2d3748">
                    <rect x="210" y="210" width="60" height="290"/><rect x="260" y="245" width="45" height="255"/>
                    <rect x="295" y="180" width="55" height="320"/><rect x="340" y="220" width="40" height="280"/>
                    <rect x="375" y="195" width="65" height="305"/><rect x="430" y="235" width="50" height="265"/>
                    <rect x="470" y="205" width="40" height="295"/><rect x="505" y="248" width="55" height="252"/>
                    <rect x="610" y="140" width="50" height="360"/><rect x="652" y="165" width="38" height="335"/>
                    <rect x="682" y="120" width="62" height="380"/><rect x="738" y="152" width="48" height="348"/>
                    <rect x="780" y="188" width="56" height="312"/><rect x="830" y="165" width="42" height="335"/>
                    <rect x="865" y="132" width="66" height="368"/><rect x="915" y="200" width="56" height="300"/>
                    <rect x="965" y="222" width="46" height="278"/><rect x="1005" y="185" width="60" height="315"/>
                    <rect x="1058" y="232" width="42" height="268"/><rect x="1095" y="208" width="55" height="292"/>
                    <rect x="1145" y="228" width="50" height="272"/><rect x="1190" y="195" width="45" height="305"/>
                    <rect x="1230" y="240" width="62" height="260"/>
                  </g>
                  <g fill="#1a202c">
                    <rect x="0" y="340" width="70" height="160"/><rect x="58" y="305" width="55" height="195"/>
                    <rect x="105" y="280" width="65" height="220"/><rect x="155" y="358" width="50" height="142"/>
                    <rect x="195" y="325" width="60" height="175"/><rect x="240" y="345" width="55" height="155"/>
                    <rect x="288" y="312" width="48" height="188"/><rect x="328" y="290" width="72" height="210"/>
                    <rect x="390" y="332" width="52" height="168"/><rect x="435" y="310" width="62" height="190"/>
                    <rect x="488" y="348" width="46" height="152"/><rect x="528" y="318" width="66" height="182"/>
                    <rect x="582" y="300" width="56" height="200"/><rect x="630" y="335" width="46" height="165"/>
                    <rect x="668" y="278" width="72" height="222"/><rect x="732" y="305" width="56" height="195"/>
                    <rect x="782" y="318" width="62" height="182"/><rect x="838" y="290" width="52" height="210"/>
                    <rect x="882" y="332" width="66" height="168"/><rect x="938" y="310" width="52" height="190"/>
                    <rect x="982" y="338" width="62" height="162"/><rect x="1038" y="320" width="56" height="180"/>
                    <rect x="1088" y="332" width="52" height="168"/><rect x="1135" y="318" width="62" height="182"/>
                    <rect x="1188" y="348" width="46" height="152"/><rect x="1232" y="322" width="66" height="178"/>
                    <rect x="1295" y="308" width="56" height="192"/><rect x="1348" y="338" width="52" height="162"/>
                    <rect x="1395" y="355" width="45" height="145"/>
                  </g>
                  <rect x="0" y="0" width="1440" height="500" fill={`url(#fade${copy})`}/>
                </svg>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-content">
          <span className={`hero-badge anim${heroVisible?" v":""}`}>Automated Rental Searching Platform</span>
          <h1 className={`hero-title anim${heroVisible?" v":""}`}>Find Your Home</h1>
          <span className={`hero-title-italic anim${heroVisible?" v":""}`}>Through Conversation</span>
          <p className={`hero-sub anim${heroVisible?" v":""}`}>Listing Your Rental Property is Fast and Easy with AI</p>

          <div className={`search-card anim${heroVisible?" v":""}${searchError?" has-error":""}`}>
            <div className="search-input-row">
              <div className="search-input-wrap">
                <input
                  ref={inputRef}
                  className="search-input"
                  placeholder=""
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (searchError) setSearchError(""); }}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                />
                {!query && !isFocused && !searchError && (
                  <span className="typing-placeholder">
                    {typedText}
                    <span className="typing-cursor">|</span>
                  </span>
                )}
                {!query && !isFocused && searchError && (
                  <span className="typing-placeholder" style={{ color: "#ef4444" }}>
                    Please ask something or search your home
                  </span>
                )}
              </div>
              <span className="search-sparkle">&#10022;</span>
              {/* ── auth-guarded Search ── */}
              <button className="search-btn" onClick={handleSearch}>Search</button>
            </div>
            {/* ── auth-guarded + button ── */}
            <button className="plus-btn" onClick={handlePlusClick}>+</button>
          </div>

          <div className="search-error-msg" style={{ visibility: searchError ? "visible" : "hidden" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {searchError}
          </div>

          <div className={`feature-pills-grid anim${heroVisible?" v":""}`}>
            {featurePills.map((pill)=>(
              <button key={pill} className="feature-pill">{pill}</button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2 */}
      <section className="tp-section">
        <div className="tp-inner">
          <div ref={rf("tph")} data-key="tph" className={`reveal${visible["tph"]?" v":""}`} style={{textAlign:"left"}}>
            <span className="tp-badge">Tenant Flow</span>
            <h2 className="tp-title">Two paths.</h2>
            <h2 className="tp-title">One <span className="tp-title-italic">intelligent</span> Platform.</h2>
          </div>
          <div className="tp-cards">
            <div ref={rf("tc1")} data-key="tc1" className={`tp-card${visible["tc1"]?" v":""}`} style={{transition:"opacity .6s ease .1s,transform .6s ease .1s,box-shadow .25s"}}>
              <div className="tp-card-header">
                <div className="tp-card-icon blue">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a8fd1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <span className="tp-card-badge blue">No Brokerage</span>
              </div>
              <div className="tp-card-body">
                <h3 className="tp-card-title">Direct Owner</h3>
                <p className="tp-card-desc">Cut out the middleman and deal directly with homeowners verified by our AI.</p>
              </div>
              <FeatureList items={directOwnerFeatures}/>
              {/* ── auth-guarded ── */}
              <button className="tp-btn-blue" onClick={() => guardedAction(() => navigate("/search?type=direct"))}>
                Explore Direct Listings &#8594;
              </button>
            </div>

            <div ref={rf("tc2")} data-key="tc2" className={`tp-card${visible["tc2"]?" v":""}`} style={{transition:"opacity .6s ease .22s,transform .6s ease .22s,box-shadow .25s"}}>
              <div className="tp-card-header">
                <div className="tp-card-icon green">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c27a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><line x1="9" y1="22" x2="9" y2="12"/><line x1="15" y1="22" x2="15" y2="16"/>
                  </svg>
                </div>
                <span className="tp-card-badge green">RERA Verified</span>
              </div>
              <div className="tp-card-body">
                <h3 className="tp-card-title">Broker Property</h3>
                <p className="tp-card-desc">Full-service assistance from premium, background-checked property consultants.</p>
              </div>
              <FeatureList items={brokerFeatures}/>
              {/* ── auth-guarded ── */}
              <button className="tp-btn-dark" onClick={() => guardedAction(() => navigate("/search?type=broker"))}>
                Connect with Brokers
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="ll-section" id="landlords">
        <div className="ll-outer">
          <div ref={rf("llh")} data-key="llh" className={`ll-heading-row reveal${visible["llh"]?" v":""}`} style={{textAlign:"left"}}>
            <span className="ll-badge">For Landlords</span>
            <h2 className="ll-title">List your property.</h2>
            <span className="ll-title-blue">Reach thousands.</span>
          </div>
          <div className="ll-inner">
            <div className="ll-left">
              <div className="ll-features-grid">
                {landlordFeatures.map((f,i)=>(
                  <div key={i} ref={rf(`llf${i}`)} data-key={`llf${i}`} className={`ll-feature-item${visible[`llf${i}`]?" v":""}`} style={{transitionDelay:`${i*.08}s`}}>
                    <div className="ll-feat-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a8fd1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <p className="ll-feature-title">{f.title}</p>
                    <p className="ll-feature-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="ll-right">
              <h3 className="ll-how-title">How to List Your Property</h3>
              <div className="ll-steps">
                {listingSteps.map((s)=>(
                  <div key={s.num} className="ll-step">
                    <div className="ll-step-col">
                      <div className={`ll-step-num${s.active?"":" outline"}`}>{s.num}</div>
                      <div className="ll-step-line"/>
                    </div>
                    <div className="ll-step-body">
                      <p className="ll-step-title">{s.title}</p>
                      <p className="ll-step-desc">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* ── auth-guarded ── */}
              <button className="ll-btn" onClick={() => guardedAction(() => navigate("/list-property"))}>
                List Your Property &#8594;
              </button>
              <p className="ll-trust">Trusted by leading asset managers across the country</p>
              <div className="ll-pricing-card">
                <div className="ll-pricing-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <div>
                  <p className="ll-pricing-title">Smart Pricing Assist</p>
                  <p className="ll-pricing-desc">AI analyzes 4M+ data points to suggest the optimal rent for your area.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className="ag-section" id="agents">
        <div className="ag-glow-orb"/>
        <div className="ag-inner">
          <div ref={rf("agh")} data-key="agh" className={`reveal${visible["agh"]?" v":""}`} style={{textAlign:"left"}}>
            <span className="ag-badge">For Agents</span>
            <h2 className="ag-title">Grow with Verified Leads</h2>
            <span className="ag-title-blue">Get Qualified tenants and Earn More</span>
          </div>
          <div className="ag-grid">
            {agentFeatures.slice(0,3).map((f,i)=>(
              <div key={i} ref={rf(`agc${i}`)} data-key={`agc${i}`} className={`ag-card${visible[`agc${i}`]?" v":""}`} style={{transition:`opacity .5s ease ${i*.1}s,transform .5s ease ${i*.1}s,box-shadow .2s,border-color .2s`}}>
                <p className="ag-card-title">{f.title}</p>
                <p className="ag-card-desc">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="ag-grid-bottom">
            {agentFeatures.slice(3).map((f,i)=>(
              <div key={i} ref={rf(`agb${i}`)} data-key={`agb${i}`} className={`ag-card${visible[`agb${i}`]?" v":""}`} style={{transition:`opacity .5s ease ${(i+3)*.1}s,transform .5s ease ${(i+3)*.1}s,box-shadow .2s`}}>
                <p className="ag-card-title">{f.title}</p>
                <p className="ag-card-desc">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="ag-cta-wrap">
            {/* ── auth-guarded ── */}
            <button className="ag-btn" onClick={() => guardedAction(() => navigate("/list-property"))}>
              Registered As a Rera Broker &#8594;
            </button>
          </div>
        </div>
        <footer className="site-footer">
          <span className="footer-copy">&#169; 2026 Tolet India. All rights reserved.</span>
          <nav className="footer-links">
            <a className="footer-link" href="#">About</a>
            <a className="footer-link" href="#">Terms</a>
            <a className="footer-link" href="#">Support</a>
            <a className="footer-link" href="#">Privacy</a>
          </nav>
        </footer>
      </section>
    </>
  );
}