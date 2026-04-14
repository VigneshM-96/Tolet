import { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function LoginModal({ isOpen, onClose }) {
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [step, setStep] = useState("main");   // "main" | "google-complete"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  if (!isOpen) return null;

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const resetAllFields = () => {
    setName(""); setEmail(""); setPassword(""); setPhone("");
    setError(""); setInfo("");
    setPendingGoogleUser(null);
    setStep("main");
  };

  const switchMode = (m) => { setMode(m); resetAllFields(); };

  const handleClose = () => { resetAllFields(); setMode("signup"); onClose(); };

  // ── Email Sign Up ──────────────────────────────────────────────────
  const handleEmailSignUp = async () => {
    if (!name.trim())                         { setError("Please enter your name"); return; }
    if (!isValidEmail(email))                 { setError("Please enter a valid email"); return; }
    if (password.length < 6)                  { setError("Password must be at least 6 characters"); return; }
    if (!phone || phone.length < 10)          { setError("Please enter a valid 10-digit phone number"); return; }

    setError(""); setLoading(true);

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      sendEmailVerification(user).catch(() => {});

      await setDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        email: email.toLowerCase(),
        phone: "+91" + phone,
        roles: ["tenant"],
        uid: user.uid,
        emailVerified: user.emailVerified,
        authMethod: "password",
        phoneVerified: false,
        createdAt: new Date(),
        lastLogin: new Date(),
      });

      resetAllFields();
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setError("An account with this email already exists. Please log in.");
      else if (err.code === "auth/weak-password")   setError("Password is too weak.");
      else if (err.code === "auth/invalid-email")   setError("Invalid email address.");
      else setError("Signup failed. Please try again.");
    }
    setLoading(false);
  };

  // ── Email Log In ───────────────────────────────────────────────────
  const handleEmailLogIn = async () => {
    if (!isValidEmail(email)) { setError("Please enter a valid email"); return; }
    if (!password)            { setError("Please enter your password"); return; }

    setError(""); setLoading(true);

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Update lastLogin
      await setDoc(doc(db, "users", user.uid), { lastLogin: new Date(), emailVerified: user.emailVerified }, { merge: true });

      resetAllFields();
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential")
        setError("Incorrect password. Please try again.");
      else if (err.code === "auth/user-not-found")
        setError("No account found with this email.");
      else if (err.code === "auth/too-many-requests")
        setError("Too many failed attempts. Please try again later.");
      else
        setError("Login failed. Please try again.");
    }
    setLoading(false);
  };

  // ── Google Sign In ─────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError(""); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const snap = await getDoc(doc(db, "users", user.uid));

      if (mode === "login") {
        if (!snap.exists()) {
          setError("No account found. Please sign up first.");
          await signOut(auth);
          setLoading(false);
          return;
        }
        await setDoc(doc(db, "users", user.uid), { lastLogin: new Date() }, { merge: true });
        resetAllFields();
        onClose();
      } else {
        if (snap.exists()) {
          // Already has an account — just log them in
          await setDoc(doc(db, "users", user.uid), { lastLogin: new Date() }, { merge: true });
          resetAllFields();
          onClose();
        } else {
          // New Google user — collect phone to complete profile
          setPendingGoogleUser({ uid: user.uid, email: user.email.toLowerCase() });
          setName(user.displayName || "");
          setStep("google-complete");
        }
      }
    } catch (err) {
      console.error(err);
      if (err.code === "auth/popup-closed-by-user")   setError("");
      else if (err.code === "auth/popup-blocked")      setError("Popup blocked. Please allow popups and try again.");
      else                                             setError("Google sign-in failed. Please try again.");
    }
    setLoading(false);
  };

  // ── Complete Google Profile ────────────────────────────────────────
  const handleCompleteGoogleSignup = async () => {
    if (!name.trim())                { setError("Please enter your name"); return; }
    if (!phone || phone.length < 10) { setError("Please enter a valid 10-digit phone number"); return; }

    setError(""); setLoading(true);
    try {
      await setDoc(doc(db, "users", pendingGoogleUser.uid), {
        name: name.trim(),
        email: pendingGoogleUser.email,
        phone: "+91" + phone,
        roles: ["tenant"],
        uid: pendingGoogleUser.uid,
        emailVerified: true,
        authMethod: "google",
        phoneVerified: false,
        createdAt: new Date(),
        lastLogin: new Date(),
      });
      resetAllFields();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to create account. Please try again.");
    }
    setLoading(false);
  };

  // ── Forgot Password ────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!isValidEmail(email)) { setError("Please enter your email first"); return; }
    setError(""); setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset link sent! Check your email.");
    } catch {
      setError("Could not send reset email. Please check the address.");
    }
    setLoading(false);
  };

  const isSignup = mode === "signup";
  const isGoogleComplete = step === "google-complete";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        .lm-overlay {
          position: fixed; inset: 0;
          background: rgba(11,31,46,0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: lmFadeIn 0.25s ease;
          font-family: 'DM Sans', sans-serif;
        }
        @keyframes lmFadeIn { from{opacity:0} to{opacity:1} }

        .lm-modal {
          background: #fff; border-radius: 24px;
          padding: 32px 30px 26px;
          width: 100%; max-width: 420px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.25);
          position: relative;
          animation: lmSlideUp 0.3s ease;
          max-height: 94vh; overflow-y: auto;
        }
        @keyframes lmSlideUp {
          from{opacity:0;transform:translateY(20px) scale(0.98)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }

        .lm-close {
          position: absolute; top:16px; right:16px;
          width:34px; height:34px; border-radius:50%;
          background:#f3f4f6; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition: background 0.18s, transform 0.18s;
          color:#374151; z-index:2;
        }
        .lm-close:hover { background:#e5e7eb; transform:rotate(90deg); }

        .lm-logo-row {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; margin-bottom: 14px;
        }
        .lm-logo-dot {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg,#006C47,#00a86b);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 800; color: #fff;
          letter-spacing: -1px;
        }

        .lm-header { text-align: center; margin-bottom: 20px; }
        .lm-title {
          font-size: 22px; font-weight: 700; color: #0f1d2e;
          margin: 0 0 5px; letter-spacing: -0.3px;
        }
        .lm-subtitle { font-size: 13.5px; color: #6b7280; font-weight: 400; margin: 0; }

        .lm-tabs {
          display:flex; background:#f3f4f6; border-radius:12px;
          padding:4px; margin-bottom:22px; position:relative;
        }
        .lm-tab {
          flex:1; padding:10px;
          font-size:13.5px; font-weight:600; color:#6b7280;
          background:transparent; border:none; border-radius:9px;
          cursor:pointer; font-family:'DM Sans',sans-serif;
          transition:color 0.2s; position:relative; z-index:2;
        }
        .lm-tab.active { color:#0f1d2e; }
        .lm-tab-ind {
          position:absolute; top:4px; bottom:4px;
          width:calc(50% - 4px); background:#fff; border-radius:9px;
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
          transition:left 0.25s ease; z-index:1;
        }
        .lm-tab-ind.signup { left:4px; }
        .lm-tab-ind.login  { left:calc(50%); }

        .lm-field { margin-bottom:13px; }
        .lm-label {
          display:block; font-size:11.5px; font-weight:600;
          color:#374151; margin-bottom:6px; letter-spacing:0.3px;
        }
        .lm-input, .lm-select {
          width:100%; padding:12px 16px;
          font-size:14px; font-weight:500;
          font-family:'DM Sans',sans-serif; color:#0f1d2e;
          background:#f9fafb; border:1.5px solid #e5e7eb;
          border-radius:12px; outline:none;
          transition:border-color 0.18s,background 0.18s,box-shadow 0.18s;
          box-sizing:border-box;
        }
        .lm-input:focus,.lm-select:focus {
          border-color:#006C47; background:#fff;
          box-shadow:0 0 0 3px rgba(0,108,71,0.1);
        }
        .lm-input::placeholder { color:#9ca3af; }

        .lm-phone-wrap { display:flex; align-items:stretch; gap:8px; }
        .lm-phone-prefix {
          display:flex; align-items:center; padding:0 14px;
          background:#f9fafb; border:1.5px solid #e5e7eb;
          border-radius:12px; font-size:14px; font-weight:600;
          color:#374151; flex-shrink:0; white-space:nowrap;
        }
        .lm-phone-wrap .lm-input { flex:1; }

        .lm-error,.lm-info {
          font-size:13px; font-weight:500;
          padding:10px 14px; border-radius:10px;
          margin-bottom:14px;
          display:flex; align-items:flex-start; gap:8px;
          line-height:1.4;
        }
        .lm-error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
        .lm-info  { background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; }
        .lm-error svg,.lm-info svg { flex-shrink:0; margin-top:1px; }

        .lm-btn {
          width:100%; background:#006C47; color:#fff;
          font-size:15px; font-weight:600;
          font-family:'DM Sans',sans-serif;
          padding:13px; border:none; border-radius:12px;
          cursor:pointer; margin-top:6px;
          transition:background 0.18s,transform 0.15s,box-shadow 0.18s;
        }
        .lm-btn:hover:not(:disabled) {
          background:#005538; transform:translateY(-1px);
          box-shadow:0 6px 20px rgba(0,108,71,0.3);
        }
        .lm-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .lm-google-btn {
          width:100%; background:#fff; color:#374151;
          font-size:14px; font-weight:600;
          font-family:'DM Sans',sans-serif;
          padding:12px; border:1.5px solid #e5e7eb; border-radius:12px;
          cursor:pointer; display:flex; align-items:center;
          justify-content:center; gap:10px; margin-bottom:14px;
          transition:background 0.18s,border-color 0.18s,box-shadow 0.18s;
        }
        .lm-google-btn:hover:not(:disabled) {
          background:#f9fafb; border-color:#006C47;
          box-shadow:0 4px 12px rgba(0,0,0,0.05);
        }
        .lm-google-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .lm-divider {
          display:flex; align-items:center; gap:12px;
          margin:14px 0; color:#9ca3af;
          font-size:11.5px; font-weight:600;
          text-transform:uppercase; letter-spacing:0.5px;
        }
        .lm-divider::before,.lm-divider::after {
          content:''; flex:1; height:1px; background:#e5e7eb;
        }

        .lm-forgot {
          display:block; text-align:right;
          font-size:12px; font-weight:600; color:#006C47;
          background:none; border:none; cursor:pointer;
          padding:4px 0; margin-top:-6px; margin-bottom:8px;
          font-family:'DM Sans',sans-serif; margin-left:auto;
        }
        .lm-forgot:hover { text-decoration:underline; }

        .lm-roles-info {
          background:#f0fdf4; border:1px solid #bbf7d0;
          border-radius:12px; padding:12px 14px;
          margin-bottom:14px;
          display:flex; align-items:flex-start; gap:10px;
        }
        .lm-roles-info-text { font-size:12.5px; color:#065f46; line-height:1.5; }
        .lm-roles-info-text strong { display:block; font-weight:700; margin-bottom:2px; }
        .lm-role-chips {
          display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;
        }
        .lm-role-chip {
          font-size:11px; font-weight:700; padding:3px 10px;
          border-radius:50px; letter-spacing:0.3px;
        }
        .lm-role-chip.tenant   { background:#dbeafe; color:#1e40af; }
        .lm-role-chip.landlord { background:#dcfce7; color:#166534; }
        .lm-role-chip.broker   { background:#fef3c7; color:#92400e; }

        .lm-google-banner {
          background:#f0f9f4; border:1px solid #bbf7d0; color:#065f46;
          font-size:13px; padding:12px 14px; border-radius:10px;
          margin-bottom:16px; display:flex; align-items:center; gap:10px;
        }

        .lm-footer {
          text-align:center; font-size:12px; color:#9ca3af;
          margin-top:16px; line-height:1.5;
        }

        @media(max-width:480px){
          .lm-modal{padding:28px 22px 22px;border-radius:20px;}
          .lm-title{font-size:20px;}
        }
      `}</style>

      <div className="lm-overlay" onClick={handleClose}>
        <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
          <button className="lm-close" onClick={handleClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Logo */}
          <div className="lm-logo-row">
            <div className="lm-logo-dot">T</div>
          </div>

          <div className="lm-header">
            <h2 className="lm-title">
              {isGoogleComplete ? "Complete Your Profile" : "Welcome to Tolet"}
            </h2>
            <p className="lm-subtitle">
              {isGoogleComplete
                ? "Just a few more details to finish setting up your account"
                : isSignup
                  ? "One account. Search, list, and manage — all in one place."
                  : "Log in to access your account"}
            </p>
          </div>

          {/* Mode tabs */}
          {!isGoogleComplete && (
            <div className="lm-tabs">
              <div className={`lm-tab-ind ${isSignup ? "signup" : "login"}`} />
              <button className={`lm-tab${isSignup ? " active" : ""}`} onClick={() => switchMode("signup")}>Sign Up</button>
              <button className={`lm-tab${!isSignup ? " active" : ""}`} onClick={() => switchMode("login")}>Log In</button>
            </div>
          )}

          {/* Role info banner — signup only */}
          {isSignup && !isGoogleComplete && (
            <div className="lm-roles-info">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
              <div className="lm-roles-info-text">
                <strong>One account for everything</strong>
                After signing up you can act as any role from your profile.
                <div className="lm-role-chips">
                  <span className="lm-role-chip tenant">Tenant</span>
                  <span className="lm-role-chip landlord">Landlord</span>
                  <span className="lm-role-chip broker">Channel Partner</span>
                </div>
              </div>
            </div>
          )}

          {/* Error / Info */}
          {error && (
            <div className="lm-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
          {info && (
            <div className="lm-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
              {info}
            </div>
          )}

          {/* ─── Google Complete Profile ─── */}
          {isGoogleComplete ? (
            <>
              <div className="lm-google-banner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Signed in as {pendingGoogleUser?.email}
              </div>

              <div className="lm-field">
                <label className="lm-label">YOUR NAME</label>
                <input className="lm-input" type="text" placeholder="e.g. Arjun Kumar"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="lm-field">
                <label className="lm-label">PHONE NUMBER</label>
                <div className="lm-phone-wrap">
                  <div className="lm-phone-prefix">🇮🇳 +91</div>
                  <input className="lm-input" type="tel" placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                </div>
              </div>

              <button className="lm-btn" onClick={handleCompleteGoogleSignup} disabled={loading}>
                {loading ? "Creating account..." : "Complete Sign Up"}
              </button>
            </>
          ) : (
            <>
              {/* Google button */}
              <button className="lm-google-btn" onClick={handleGoogleSignIn} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                Continue with Google
              </button>

              <div className="lm-divider">or {isSignup ? "sign up" : "log in"} with email</div>

              {/* Name — signup only */}
              {isSignup && (
                <div className="lm-field">
                  <label className="lm-label">YOUR NAME</label>
                  <input className="lm-input" type="text" placeholder="e.g. Arjun Kumar"
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}

              <div className="lm-field">
                <label className="lm-label">EMAIL</label>
                <input className="lm-input" type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="lm-field">
                <label className="lm-label">PASSWORD</label>
                <input className="lm-input" type="password"
                  placeholder={isSignup ? "At least 6 characters" : "Your password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {!isSignup && (
                <button className="lm-forgot" onClick={handleForgotPassword}>Forgot password?</button>
              )}

              {/* Phone — signup only */}
              {isSignup && (
                <div className="lm-field">
                  <label className="lm-label">PHONE NUMBER</label>
                  <div className="lm-phone-wrap">
                    <div className="lm-phone-prefix">🇮🇳 +91</div>
                    <input className="lm-input" type="tel" placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </div>
                </div>
              )}

              <button className="lm-btn"
                onClick={isSignup ? handleEmailSignUp : handleEmailLogIn}
                disabled={loading}>
                {loading
                  ? (isSignup ? "Creating account..." : "Logging in...")
                  : (isSignup ? "Create Account" : "Log In")}
              </button>
            </>
          )}

          <p className="lm-footer">
            By continuing, you agree to our<br />
            <strong style={{ color: "#6b7280" }}>Terms of Service</strong> and <strong style={{ color: "#6b7280" }}>Privacy Policy</strong>
          </p>
        </div>
      </div>
    </>
  );
}
