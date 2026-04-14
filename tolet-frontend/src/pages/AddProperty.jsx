import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  onAuthStateChanged,
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
} from "firebase/auth";
import LoginModal from "../components/LoginModal";

// ══════════════════════════════════════════════════
// STEP DEFINITIONS
// ══════════════════════════════════════════════════
const TOTAL_STEPS = 5;

const PROPERTY_KINDS = [
  { label: "Residential", icon: "🏠" },
  { label: "Commercial", icon: "🏢" },
  { label: "Paying Guest", icon: "🛏️" },
];

const PROPERTY_TYPES = [
  "1RK", "1BHK", "2BHK", "3BHK", "4BHK", "Studio",
  "Independent House", "Villa", "Penthouse",
];

const FACING_OPTIONS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"];
const FURNISHED_OPTIONS = ["Fully Furnished", "Semi-Furnished", "Unfurnished"];
const WATER_OPTIONS = ["Corporation", "Borewell", "Corporation + Borewell", "24/7 Corporation", "24/7 Corporation + Borewell", "Tanker", "Borewell + Tanker"];

const ALL_AMENITIES = [
  "Lift", "Gym", "Swimming Pool", "Security", "Power Backup",
  "Balcony", "Garden", "Clubhouse", "Intercom", "Terrace Access",
  "Visitor Parking", "Children's Play Area", "Washing Machine",
  "AC", "Geyser", "Modular Kitchen",
];

// ══════════════════════════════════════════════════
// CHENNAI LOCALITIES WITH LAT/LNG FOR GEO-VERIFICATION
// ══════════════════════════════════════════════════
const CHENNAI_LOCALITIES = [
  { name: "Ambattur",             lat: 13.1143, lng: 80.1548 },
  { name: "Anna Nagar",           lat: 13.0850, lng: 80.2101 },
  { name: "Velachery",            lat: 12.9815, lng: 80.2180 },
  { name: "Adyar",                lat: 13.0063, lng: 80.2574 },
  { name: "T Nagar",              lat: 13.0418, lng: 80.2341 },
  { name: "OMR (Thoraipakkam)",   lat: 12.9365, lng: 80.2281 },
  { name: "Porur",                lat: 13.0382, lng: 80.1565 },
  { name: "Guindy",               lat: 13.0067, lng: 80.2206 },
  { name: "Chromepet",            lat: 12.9516, lng: 80.1462 },
  { name: "Nungambakkam",         lat: 13.0569, lng: 80.2425 },
  { name: "Mylapore",             lat: 13.0368, lng: 80.2676 },
  { name: "Besant Nagar",         lat: 13.0002, lng: 80.2707 },
  { name: "Tambaram",             lat: 12.9249, lng: 80.1000 },
  { name: "Sholinganallur",       lat: 12.9010, lng: 80.2279 },
  { name: "Pallavaram",           lat: 12.9675, lng: 80.1491 },
  { name: "Perambur",             lat: 13.1117, lng: 80.2340 },
  { name: "Royapettah",           lat: 13.0530, lng: 80.2650 },
  { name: "Kodambakkam",          lat: 13.0500, lng: 80.2250 },
  { name: "Thiruvanmiyur",        lat: 12.9830, lng: 80.2640 },
  { name: "ECR",                  lat: 12.9350, lng: 80.2540 },
  { name: "KK Nagar",             lat: 13.0385, lng: 80.2120 },
  { name: "Ramapuram",            lat: 13.0318, lng: 80.1800 },
  { name: "Nesapakkam",           lat: 13.0380, lng: 80.1945 },
  { name: "Vadapalani",           lat: 13.0520, lng: 80.2120 },
  { name: "Saidapet",             lat: 13.0210, lng: 80.2280 },
  { name: "West KK Nagar",        lat: 13.0340, lng: 80.2040 },
  { name: "West Mambalam",        lat: 13.0380, lng: 80.2230 },
];

const LOCALITY_NAMES = CHENNAI_LOCALITIES.map((l) => l.name);

// ══════════════════════════════════════════════════
// GEO VERIFICATION UTILITIES
// ══════════════════════════════════════════════════

const MAX_DISTANCE_KM = 3;

function extractGpsFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const gps = parseExifGps(new Uint8Array(e.target.result));
        resolve(gps);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

function parseExifGps(data) {
  if (data[0] !== 0xFF || data[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < data.length - 1) {
    if (data[offset] !== 0xFF) break;
    const marker = data[offset + 1];
    if (marker === 0xE1) {
      const length = (data[offset + 2] << 8) | data[offset + 3];
      const exifBlock = data.slice(offset + 4, offset + 2 + length);
      return parseExifBlock(exifBlock);
    }
    const len = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + len;
  }
  return null;
}

function parseExifBlock(block) {
  if (
    block[0] !== 0x45 || block[1] !== 0x78 || block[2] !== 0x69 ||
    block[3] !== 0x66 || block[4] !== 0x00 || block[5] !== 0x00
  ) return null;

  const tiffStart = 6;
  const byteOrder = (block[tiffStart] << 8) | block[tiffStart + 1];
  const littleEndian = byteOrder === 0x4949;

  const read16 = (off) => {
    const a = block[tiffStart + off], b = block[tiffStart + off + 1];
    return littleEndian ? (b << 8) | a : (a << 8) | b;
  };
  const read32 = (off) => {
    const a = block[tiffStart + off], b = block[tiffStart + off + 1];
    const c = block[tiffStart + off + 2], d = block[tiffStart + off + 3];
    return littleEndian
      ? (d << 24) | (c << 16) | (b << 8) | a
      : (a << 24) | (b << 16) | (c << 8) | d;
  };

  const ifd0Offset = read32(4);
  const ifd0Count = read16(ifd0Offset);
  let gpsIfdOffset = null;
  for (let i = 0; i < ifd0Count; i++) {
    const entryOff = ifd0Offset + 2 + i * 12;
    const tag = read16(entryOff);
    if (tag === 0x8825) { gpsIfdOffset = read32(entryOff + 8); break; }
  }
  if (gpsIfdOffset === null) return null;

  const gpsCount = read16(gpsIfdOffset);
  const gpsEntries = {};
  for (let i = 0; i < gpsCount; i++) {
    const entryOff = gpsIfdOffset + 2 + i * 12;
    const tag = read16(entryOff);
    const type = read16(entryOff + 2);
    const count = read32(entryOff + 4);
    if (type === 2 && count <= 4) {
      gpsEntries[tag] = String.fromCharCode(block[tiffStart + entryOff + 8]);
    } else if (type === 5 && count === 3) {
      const valOffset = read32(entryOff + 8);
      const readRational = (o) => { const num = read32(o); const den = read32(o + 4); return den === 0 ? 0 : num / den; };
      gpsEntries[tag] = readRational(valOffset) + readRational(valOffset + 8) / 60 + readRational(valOffset + 16) / 3600;
    }
  }

  const latRef = gpsEntries[1], lat = gpsEntries[2];
  const lngRef = gpsEntries[3], lng = gpsEntries[4];
  if (lat === undefined || lng === undefined) return null;
  return { latitude: latRef === "S" ? -lat : lat, longitude: lngRef === "W" ? -lng : lng };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ══════════════════════════════════════════════════
// FRESH FORM STATE FACTORY
// ══════════════════════════════════════════════════
const freshForm = () => ({
  // Contact info — collected for both roles
  ownerName: "",
  ownerPhone: "",
  // Property details
  kind: "Residential",
  location: "",
  city: "Chennai",
  state: "Tamil Nadu",
  type: "",
  sqft: "",
  floor: "",
  totalFloors: "",
  facing: "",
  furnished: "",
  price: "",
  available_from: "",
  parking: false,
  pet_friendly: false,
  amenities: [],
  water_supply: "",
  nearby: "",
});

// ══════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════
export default function AddProperty() {
  const navigate = useNavigate();

  // ── Auth state ────────────────────────────────────────────────────
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // OTP state
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data();
            setUserData(data);
            setOtpPhone((data.phone || "").replace(/^\+91/, ""));
          }
        } catch (e) { console.error(e); }
      } else { setUserData(null); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const initRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    }
    return recaptchaRef.current;
  };

  const handleSendOtp = async () => {
    if (!otpPhone || otpPhone.length < 10) { setOtpError("Please enter a valid 10-digit phone number."); return; }
    setOtpError(""); setOtpInfo(""); setOtpSending(true);
    try {
      const appVerifier = initRecaptcha();
      const provider = new PhoneAuthProvider(auth);
      const vidId = await provider.verifyPhoneNumber("+91" + otpPhone, appVerifier);
      setVerificationId(vidId); setOtpInfo("OTP sent! Check your messages.");
    } catch (err) {
      if (err.code === "auth/provider-already-linked") {
        await setDoc(doc(db, "users", authUser.uid), { phoneVerified: true }, { merge: true });
        setUserData((prev) => ({ ...prev, phoneVerified: true }));
      } else if (err.code === "auth/too-many-requests") { setOtpError("Too many attempts. Please wait and try again.");
      } else { setOtpError("Failed to send OTP. Please try again."); }
    }
    setOtpSending(false);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 4) { setOtpError("Please enter the OTP you received."); return; }
    setOtpError(""); setOtpVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      await linkWithCredential(authUser, credential);
      await setDoc(doc(db, "users", authUser.uid), { phoneVerified: true, phone: "+91" + otpPhone }, { merge: true });
      setUserData((prev) => ({ ...prev, phoneVerified: true }));
    } catch (err) {
      if (err.code === "auth/invalid-verification-code") { setOtpError("Incorrect OTP. Please try again.");
      } else if (["auth/credential-already-in-use","auth/provider-already-linked","auth/account-exists-with-different-credential"].includes(err.code)) {
        await setDoc(doc(db, "users", authUser.uid), { phoneVerified: true, phone: "+91" + otpPhone }, { merge: true });
        setUserData((prev) => ({ ...prev, phoneVerified: true }));
      } else { setOtpError("Verification failed. Please try again."); }
    }
    setOtpVerifying(false);
  };

  // ── Form state ────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formRef = useRef(null);
  const [role, setRole] = useState(null);

  // ── Channel partner multi-listing state ───────────────────────────
  const [listingsCount, setListingsCount] = useState(0); // how many submitted this session
  const [showCpDecision, setShowCpDecision] = useState(false); // "finish or add again" screen

  // ── Geo-image state ───────────────────────────────────────────────
  const [geoImages, setGeoImages] = useState([]);
  const [geoResults, setGeoResults] = useState([]);
  const [geoVerifying, setGeoVerifying] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [geoVerified, setGeoVerified] = useState(false);

  const [form, setForm] = useState(freshForm());

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const toggleAmenity = (amenity) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  // ── Geo-verification handler ──────────────────────────────────────
  const verifyGeoImages = useCallback(async (files) => {
    if (!form.location) { setGeoError("Please select a locality first, then upload photos."); return; }
    const locality = CHENNAI_LOCALITIES.find((l) => l.name === form.location);
    if (!locality) { setGeoError("Locality coordinates not found. Please select a valid locality."); return; }

    setGeoVerifying(true); setGeoError(""); setGeoVerified(false);
    const results = [];

    for (const file of files) {
      const result = { name: file.name, status: "pending", distance: null, coords: null };
      const gps = await extractGpsFromFile(file);
      if (!gps) {
        result.status = "no_gps"; result.message = "No GPS data found in this image";
      } else {
        result.coords = gps;
        const dist = haversineKm(gps.latitude, gps.longitude, locality.lat, locality.lng);
        result.distance = dist;
        if (dist <= MAX_DISTANCE_KM) { result.status = "pass"; result.message = `${dist.toFixed(1)} km from ${form.location} centre — verified`; }
        else { result.status = "fail"; result.message = `${dist.toFixed(1)} km away — too far from ${form.location} (max ${MAX_DISTANCE_KM} km)`; }
      }
      results.push(result);
    }

    setGeoResults(results);
    const passCount = results.filter((r) => r.status === "pass").length;
    const noGpsCount = results.filter((r) => r.status === "no_gps").length;
    const failCount = results.filter((r) => r.status === "fail").length;

    if (passCount >= 3) { setGeoVerified(true); setGeoError(""); }
    else if (noGpsCount > 0 && failCount === 0 && passCount < 3) {
      setGeoError(`${noGpsCount} photo(s) have no GPS data. Please use your camera app (not gallery) to take photos at the property. Need at least 3 verified photos.`);
    } else if (failCount > 0) {
      setGeoError(`${failCount} photo(s) were taken too far from ${form.location}. Photos must be taken within ${MAX_DISTANCE_KM} km of the property location.`);
    } else {
      setGeoError(`Need at least 3 geotagged photos that match the property location. Got ${passCount} valid.`);
    }
    setGeoVerifying(false);
  }, [form.location]);

  const handleGeoFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setGeoImages(files); setGeoResults([]); setGeoVerified(false); setGeoError("");
    verifyGeoImages(files);
  };

  useEffect(() => {
    if (geoImages.length > 0 && form.location && role) {
      verifyGeoImages(geoImages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location]);

  // ── Validation ────────────────────────────────────────────────────
  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      // Contact info (both roles)
      if (!form.ownerName.trim()) errs.ownerName = "Please enter your name";
      if (!form.ownerPhone.trim() || form.ownerPhone.replace(/\D/g, "").length < 10)
        errs.ownerPhone = "Please enter a valid 10-digit phone number";
      if (!form.location.trim()) errs.location = "Please select a locality";
      // Geo photos — required for BOTH roles
      if (geoImages.length < 3) {
        errs.geoImages = "Upload at least 3 geotagged photos";
        setGeoError("Upload at least 3 geotagged photos");
      } else if (!geoVerified) {
        errs.geoImages = "Photos must pass geo-verification before proceeding";
        setGeoError("Photos must pass geo-verification. Ensure at least 3 photos match the selected locality.");
      }
    }
    if (s === 2) {
      if (!form.type) errs.type = "Please select property type";
      if (!form.sqft || isNaN(form.sqft) || Number(form.sqft) <= 0) errs.sqft = "Enter valid area";
      if (!form.floor.trim()) errs.floor = "Enter floor number";
      if (!form.totalFloors.trim()) errs.totalFloors = "Enter total floors";
      if (!form.facing) errs.facing = "Select facing direction";
      if (!form.furnished) errs.furnished = "Select furnishing status";
    }
    if (s === 3) {
      if (!form.price || isNaN(form.price) || Number(form.price) <= 0) errs.price = "Enter valid rent amount";
      if (!form.available_from) errs.available_from = "Select available date";
    }
    if (s === 4) {
      if (!form.water_supply) errs.water_supply = "Select water supply type";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => { setStep((s) => Math.max(s - 1, 1)); setErrors({}); };

  const getOrdinal = (n) => {
    const num = parseInt(n, 10); if (isNaN(num)) return "";
    const s = ["th", "st", "nd", "rd"]; const v = num % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const buildPropertyData = () => {
    const floorStr =
      form.floor === "0" || form.floor.toLowerCase() === "ground"
        ? `Ground of ${form.totalFloors}`
        : `${form.floor}${getOrdinal(form.floor)} of ${form.totalFloors}`;

    const nearbyArr = form.nearby.split(",").map((n) => n.trim()).filter(Boolean);

    const verifiedCoords = geoResults
      .filter((r) => r.status === "pass" && r.coords)
      .map((r) => ({ lat: r.coords.latitude, lng: r.coords.longitude, file: r.name, distKm: r.distance }));

    return {
      kind: form.kind,
      type: form.type,
      location: form.location,
      city: form.city,
      state: form.state,
      price: Number(form.price),
      nearby: nearbyArr,
      distance_railway_km: null,
      parking: form.parking,
      amenities: form.amenities,
      furnished: form.furnished,
      floor: floorStr,
      sqft: Number(form.sqft),
      facing: form.facing,
      water_supply: form.water_supply,
      pet_friendly: form.pet_friendly,
      available_from: form.available_from,
      // Contact info
      ownerName: form.ownerName.trim(),
      ownerPhone: form.ownerPhone.trim().startsWith("+91") ? form.ownerPhone.trim() : "+91" + form.ownerPhone.trim().replace(/\D/g,""),
      // Role & verification
      role: role,
      geoVerified: geoVerified,
      photoGpsCoords: verifiedCoords,
      createdAt: serverTimestamp(),
    };
  };

  // ── Submit to Firestore ───────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true); setSubmitError("");
    try {
      const propertyData = buildPropertyData();
      const docRef = await addDoc(collection(db, "properties"), propertyData);
      console.log("Property saved with ID:", docRef.id);

      setListingsCount((c) => c + 1);

      if (role === "channel_partner") {
        // Show the "finish or add another" decision screen
        setSubmitSuccess(false);
        setShowCpDecision(true);
      } else {
        setSubmitSuccess(true);
        setTimeout(() => navigate("/"), 2500);
      }
    } catch (err) {
      console.error("Firestore save failed:", err);
      setSubmitError("Failed to save property. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Channel Partner: add another property ─────────────────────────
  const handleAddAnother = () => {
    // Reset form but keep the role and listings count
    setForm(freshForm());
    setGeoImages([]); setGeoResults([]); setGeoVerified(false); setGeoError("");
    setStep(1); setErrors({}); setSubmitError("");
    setShowCpDecision(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepLabels = ["Basic Info", "Property Details", "Pricing", "Amenities", "Review"];

  // ══════════════════════════════════════════════════
  // GEO RESULT BADGE
  // ══════════════════════════════════════════════════
  const GeoResultBadge = ({ result }) => {
    const styles = {
      pass:   { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", icon: "✓" },
      fail:   { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", icon: "✗" },
      no_gps: { bg: "#fffbeb", border: "#fed7aa", color: "#d97706", icon: "⚠" },
    };
    const s = styles[result.status] || styles.no_gps;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{result.name}</div>
          <div style={{ fontSize: 11.5, color: s.color, fontWeight: 500, marginTop: 2 }}>{result.message}</div>
          {result.coords && (
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>
              GPS: {result.coords.latitude.toFixed(5)}, {result.coords.longitude.toFixed(5)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Auth loading ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#6b7280" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#006C47", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading...
        </div>
      </div>
    );
  }

  // ── Not logged in ─────────────────────────────────────────────────
  if (!authUser) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: "40px 36px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 16px 60px rgba(0,0,0,0.1)" }}>
          <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#006C47,#00a86b)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 26 }}>🏠</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1d2e", marginBottom: 8 }}>Sign in to List Property</h2>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>Landlords and Channel Partners need an account to list properties on Tolet.</p>
          <button onClick={() => setShowLoginModal(true)} style={{ background: "#006C47", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
            Sign Up / Log In
          </button>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer", marginTop: 14, fontFamily: "'DM Sans', sans-serif" }}>
            ← Back to Home
          </button>
        </div>
        <LoginModal isOpen={showLoginModal} onClose={async () => {
          setShowLoginModal(false);
          const user = auth.currentUser;
          if (user) {
            setAuthUser(user);
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) { const data = snap.data(); setUserData(data); setOtpPhone((data.phone || "").replace(/^\+91/, "")); }
          }
        }} />
      </div>
    );
  }

  // ── Phone OTP verification gate ───────────────────────────────────
  if (!userData?.phoneVerified) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
        <div id="recaptcha-container" />
        <div style={{ background: "#fff", borderRadius: 24, padding: "40px 36px", maxWidth: 440, width: "100%", boxShadow: "0 16px 60px rgba(0,0,0,0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#1a6fa8,#38bdf8)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26 }}>📱</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1d2e", marginBottom: 8 }}>Verify Your Phone</h2>
            <p style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.6 }}>A one-time verification is required before you can list a property.</p>
          </div>

          {otpError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>⚠️ {otpError}</div>}
          {otpInfo && <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>✓ {otpInfo}</div>}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>PHONE NUMBER</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", padding: "0 14px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "#374151", flexShrink: 0 }}>🇮🇳 +91</div>
              <input type="tel" placeholder="98765 43210" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} disabled={!!verificationId}
                style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: "#0f1d2e", background: verificationId ? "#f3f4f6" : "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, outline: "none" }} />
            </div>
          </div>

          {!verificationId ? (
            <button onClick={handleSendOtp} disabled={otpSending} style={{ width: "100%", background: "#006C47", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 600, cursor: otpSending ? "not-allowed" : "pointer", opacity: otpSending ? 0.6 : 1, fontFamily: "'DM Sans', sans-serif" }}>
              {otpSending ? "Sending OTP…" : "Send OTP"}
            </button>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>ENTER OTP</label>
                <input type="text" inputMode="numeric" placeholder="6-digit OTP" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{ width: "100%", padding: "12px 16px", fontSize: 18, fontWeight: 700, letterSpacing: 8, textAlign: "center", fontFamily: "'DM Sans', sans-serif", color: "#0f1d2e", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button onClick={handleVerifyOtp} disabled={otpVerifying} style={{ width: "100%", background: "#006C47", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 600, cursor: otpVerifying ? "not-allowed" : "pointer", opacity: otpVerifying ? 0.6 : 1, fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
                {otpVerifying ? "Verifying…" : "Verify & Continue"}
              </button>
              <button onClick={() => { setVerificationId(null); setOtpCode(""); setOtpInfo(""); setOtpError(""); recaptchaRef.current = null; }}
                style={{ width: "100%", background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Resend OTP
              </button>
            </>
          )}

          <button onClick={() => navigate("/")} style={{ display: "block", margin: "18px auto 0", background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back to Home</button>
        </div>
      </div>
    );
  }

  // ── Role selection gate ───────────────────────────────────────────
  if (!role) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap", padding: 32, background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>
        {[
          {
            id: "landlord", icon: "🏠", title: "Landlord", color: "#006C47",
            points: ["List your own property", "Geotagged photo verification", "Minimum 3 images required"],
          },
          {
            id: "channel_partner", icon: "🤝", title: "Channel Partner", color: "#1a6fa8",
            points: ["List multiple properties", "Geotagged photo verification", "Add another after submit"],
          },
        ].map((r) => (
          <div key={r.id} style={{ background: "#fff", borderRadius: 20, padding: 32, width: 280, boxShadow: "0 8px 32px rgba(0,0,0,0.08)", border: "1.5px solid #e5e7eb" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{r.icon}</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>{r.title}</h2>
            <ul style={{ margin: "0 0 20px", paddingLeft: 18, color: "#6b7280", fontSize: 13.5, lineHeight: 2 }}>
              {r.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <button onClick={() => setRole(r.id)} style={{ width: "100%", background: r.color, color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Continue as {r.title}
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ── Channel Partner decision screen (after submit) ─────────────────
  if (showCpDecision) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: "40px 36px", maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "0 16px 60px rgba(0,0,0,0.1)" }}>
          {/* Success badge */}
          <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#0d9488,#14b8a6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", animation: "successPop 0.5s ease" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Property Listed! 🎉
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 6, lineHeight: 1.6 }}>
            Successfully saved to Firestore.
          </p>
          {/* Listings counter */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 50, padding: "6px 18px", fontSize: 13, fontWeight: 600, color: "#0d9488", marginBottom: 28 }}>
            <span>🏠</span>
            {listingsCount} {listingsCount === 1 ? "property" : "properties"} listed this session
          </div>

          <p style={{ fontSize: 14, color: "#374151", fontWeight: 600, marginBottom: 20 }}>What would you like to do next?</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={handleAddAnother}
              style={{ width: "100%", background: "#1a6fa8", color: "#fff", border: "none", borderRadius: 14, padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.18s" }}
              onMouseOver={(e) => e.currentTarget.style.background = "#1558882"}
              onMouseOut={(e) => e.currentTarget.style.background = "#1a6fa8"}
            >
              <span style={{ fontSize: 18 }}>➕</span>
              Add Another Property
            </button>

            <button
              onClick={() => navigate("/")}
              style={{ width: "100%", background: "#f1f5f9", color: "#374151", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.18s" }}
            >
              <span style={{ fontSize: 18 }}>🏁</span>
              Finish & Go Home
            </button>
          </div>

          <style>{`
            @keyframes successPop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
          `}</style>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // MAIN FORM
  // ══════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f8fafc; }

        .ap-page { min-height: 100vh; display: flex; flex-direction: column; position: relative; overflow-x: hidden; }

        .ap-skyline-wrap { position: fixed; bottom: 0; left: 0; width: 100%; height: 55%; z-index: 0; pointer-events: none; overflow: hidden; opacity: 0.12; }
        .ap-skyline-track { display: flex; width: 200%; height: 100%; animation: skyScroll 60s linear infinite; }
        @keyframes skyScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ap-skyline-strip { flex: 0 0 50%; height: 100%; }
        .ap-skyline-strip svg { width: 100%; height: 100%; display: block; }
        .ap-skyline-wrap::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 60%; background: linear-gradient(to bottom, #f8fafc 0%, transparent 100%); pointer-events: none; }

        .ap-header { display: flex; align-items: center; gap: 10px; padding: 18px 32px; background: #fff; border-bottom: 1px solid #e9edf2; position: sticky; top: 0; z-index: 100; }
        .ap-header-logo { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .ap-header-logo-icon { width: 32px; height: 32px; background: #f0fdfa; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .ap-header-logo-text { font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: -0.02em; }

        /* Role badge in header */
        .ap-role-badge { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 50px; font-size: 12px; font-weight: 600; }
        .ap-role-badge.landlord { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .ap-role-badge.partner { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

        /* Session count badge for channel partner */
        .ap-session-badge { display: flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 50px; font-size: 12px; font-weight: 600; background: #fefce8; color: #854d0e; border: 1px solid #fde68a; margin-left: 8px; }

        .ap-title-section { position: relative; z-index: 1; padding: 32px 32px 0; max-width: 680px; margin: 0 auto; width: 100%; }
        .ap-page-title { font-size: 30px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; line-height: 1.1; }
        .ap-page-sub { font-size: 13px; color: #94a3b8; margin-top: 4px; font-weight: 400; }

        .ap-step-label-row { display: flex; justify-content: space-between; align-items: center; max-width: 680px; margin: 0 auto; width: 100%; padding: 0 32px; }
        .ap-step-heading { font-size: 19px; font-weight: 700; color: #1e293b; letter-spacing: -0.2px; position: relative; padding-bottom: 6px; }
        .ap-step-heading::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: #3b82f6; border-radius: 2px; }
        .ap-step-counter { font-size: 12px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 5px 14px; border-radius: 50px; }

        .ap-progress-bar { max-width: 680px; margin: 14px auto 0; width: 100%; padding: 0 32px; }
        .ap-progress-track { height: 4px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .ap-progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #0d9488); border-radius: 4px; transition: width 0.4s ease; }

        .ap-form-area { position: relative; z-index: 1; max-width: 680px; margin: 24px auto 0; width: 100%; padding: 0 32px 80px; flex: 1; }
        .ap-card { background: #fff; border-radius: 20px; padding: 32px 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.03); border: 1px solid #e9edf2; animation: cardSlide 0.3s ease; }
        @keyframes cardSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        /* Contact section banner */
        .ap-contact-banner {
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border: 1.5px solid #bae6fd;
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 24px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .ap-contact-banner-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
        .ap-contact-banner-text { font-size: 13px; color: #0369a1; line-height: 1.5; font-weight: 500; }
        .ap-contact-banner-text strong { color: #0c4a6e; }

        .ap-section-divider { display: flex; align-items: center; gap: 12px; margin: 24px 0 20px; }
        .ap-section-divider-line { flex: 1; height: 1px; background: #e5e7eb; }
        .ap-section-divider-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }

        .ap-field { margin-bottom: 20px; }
        .ap-field:last-child { margin-bottom: 0; }
        .ap-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; letter-spacing: 0.01em; }
        .ap-input, .ap-select {
          width: 100%; padding: 12px 16px; font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; color: #1e293b; background: #f9fafb;
          border: 1.5px solid #e5e7eb; border-radius: 12px; outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
        }
        .ap-input:focus, .ap-select:focus { border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .ap-input::placeholder { color: #9ca3af; }
        .ap-input.error, .ap-select.error { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.08); }
        .ap-error-msg { font-size: 12px; color: #ef4444; margin-top: 5px; font-weight: 500; }
        .ap-select {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M3 5L7 9L11 5' stroke='%23555' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 16px center; padding-right: 40px; cursor: pointer;
        }

        .ap-phone-row { display: flex; gap: 8px; }
        .ap-phone-prefix { display: flex; align-items: center; padding: 0 14px; background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 12px; font-size: 14px; font-weight: 600; color: #374151; flex-shrink: 0; white-space: nowrap; }

        .ap-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .ap-pills { display: flex; flex-wrap: wrap; gap: 10px; }
        .ap-pill { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; border: 1.5px solid #e5e7eb; background: #f9fafb; font-size: 13.5px; font-weight: 500; color: #475569; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.18s; }
        .ap-pill:hover { border-color: #3b82f6; background: #eff6ff; }
        .ap-pill.active { border-color: #3b82f6; background: #3b82f6; color: #fff; }
        .ap-pill-icon { font-size: 16px; }

        .ap-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #f9fafb; border-radius: 12px; border: 1.5px solid #e5e7eb; margin-bottom: 12px; cursor: pointer; transition: border-color 0.18s; }
        .ap-toggle-row:hover { border-color: #cbd5e1; }
        .ap-toggle-row.active { border-color: #3b82f6; background: #eff6ff; }
        .ap-toggle-label { font-size: 13.5px; font-weight: 500; color: #374151; }
        .ap-toggle-switch { width: 42px; height: 24px; border-radius: 12px; background: #d1d5db; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .ap-toggle-switch.on { background: #3b82f6; }
        .ap-toggle-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); transition: transform 0.2s; }
        .ap-toggle-switch.on .ap-toggle-knob { transform: translateX(18px); }

        .ap-amenity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .ap-amenity-chip { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: #f9fafb; font-size: 12.5px; font-weight: 500; color: #475569; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.18s; text-align: center; }
        .ap-amenity-chip:hover { border-color: #3b82f6; background: #eff6ff; }
        .ap-amenity-chip.active { border-color: #0d9488; background: #0d9488; color: #fff; }

        .ap-btn-row { display: flex; gap: 12px; margin-top: 28px; }
        .ap-btn-back { flex: 1; padding: 14px; border-radius: 12px; border: 1.5px solid #e5e7eb; background: #fff; font-size: 14px; font-weight: 600; color: #374151; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.18s; }
        .ap-btn-back:hover { border-color: #cbd5e1; background: #f9fafb; }
        .ap-btn-next { flex: 1.5; padding: 14px; border-radius: 12px; border: none; background: #3b82f6; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.18s; position: relative; overflow: hidden; }
        .ap-btn-next:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,130,246,0.3); }

        .ap-btn-submit { flex: 1.5; padding: 14px; border-radius: 12px; border: none; background: #0d9488; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.18s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ap-btn-submit:hover:not(:disabled) { background: #0f766e; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13,148,136,0.3); }
        .ap-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        .ap-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ap-submit-error { margin-top: 12px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; font-size: 13px; color: #b91c1c; font-weight: 500; }

        .ap-review-section { margin-bottom: 20px; }
        .ap-review-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .ap-review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ap-review-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; }
        .ap-review-item-label { font-size: 10.5px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
        .ap-review-item-value { font-size: 13.5px; font-weight: 600; color: #1e293b; }
        .ap-review-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .ap-review-tag { font-size: 11.5px; font-weight: 500; color: #0d9488; background: #f0fdfa; padding: 4px 10px; border-radius: 6px; border: 1px solid #ccfbf1; }

        /* Geo upload */
        .ap-geo-upload-box { border: 2px dashed #d1d5db; border-radius: 14px; padding: 24px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafbfc; }
        .ap-geo-upload-box:hover { border-color: #3b82f6; background: #f0f7ff; }
        .ap-geo-upload-box.verified { border-color: #22c55e; background: #f0fdf4; }
        .ap-geo-upload-box.error-state { border-color: #ef4444; background: #fef2f2; }
        .ap-geo-icon { font-size: 28px; margin-bottom: 8px; }
        .ap-geo-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .ap-geo-sub { font-size: 12px; color: #94a3b8; }
        .ap-geo-loading { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 14px; background: #f0f9ff; border-radius: 10px; border: 1px solid #bae6fd; font-size: 13px; color: #0369a1; font-weight: 500; }
        .ap-geo-loading .spinner { width: 14px; height: 14px; border: 2px solid #bae6fd; border-top-color: #0369a1; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .ap-geo-results { margin-top: 12px; }
        .ap-geo-success { margin-top: 10px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; font-size: 13px; color: #15803d; font-weight: 600; text-align: center; }
        .ap-geo-desc { font-size: 12.5px; color: #64748b; margin-bottom: 12px; line-height: 1.5; }

        .ap-success-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ap-success-icon { width: 64px; height: 64px; background: #0d9488; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: successPop 0.5s ease; }
        @keyframes successPop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .ap-success-title { font-size: 22px; font-weight: 700; color: #1e293b; }
        .ap-success-sub { font-size: 14px; color: #64748b; }

        .ap-footer { display: flex; justify-content: space-between; align-items: center; padding: 20px 32px; border-top: 1px solid #e9edf2; background: #fff; position: relative; z-index: 1; margin-top: auto; }
        .ap-footer-left { font-size: 10.5px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
        .ap-footer-links { display: flex; gap: 24px; }
        .ap-footer-link { font-size: 11px; color: #64748b; text-decoration: none; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .ap-footer-link:hover { color: #3b82f6; }

        @media (max-width: 700px) {
          .ap-title-section, .ap-form-area, .ap-progress-bar, .ap-step-label-row { padding-left: 20px; padding-right: 20px; }
          .ap-card { padding: 24px 20px; }
          .ap-amenity-grid { grid-template-columns: repeat(2, 1fr); }
          .ap-review-grid { grid-template-columns: 1fr; }
          .ap-page-title { font-size: 24px; }
          .ap-header { padding: 16px 20px; }
          .ap-footer { padding: 16px 20px; flex-direction: column; gap: 12px; text-align: center; }
          .ap-row { grid-template-columns: 1fr; }
          .ap-session-badge { display: none; }
        }
        @media (max-width: 480px) {
          .ap-amenity-grid { grid-template-columns: 1fr 1fr; }
          .ap-pills { gap: 8px; }
          .ap-pill { padding: 8px 14px; font-size: 12.5px; }
        }
      `}</style>

      <div className="ap-page" ref={formRef}>

        {/* Skyline BG */}
        <div className="ap-skyline-wrap">
          <div className="ap-skyline-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="ap-skyline-strip">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMax meet">
                  <defs>
                    <linearGradient id={`skyFade${copy}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="white" stopOpacity="1" />
                      <stop offset="50%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g fill="#94a3b8">
                    <rect x="0" y="310" width="55" height="190" /><rect x="40" y="270" width="40" height="230" />
                    <rect x="70" y="290" width="50" height="210" /><rect x="110" y="240" width="35" height="260" />
                    <rect x="195" y="310" width="50" height="190" /><rect x="340" y="320" width="45" height="180" />
                    <rect x="1060" y="305" width="45" height="195" /><rect x="1130" y="295" width="55" height="205" />
                    <rect x="1285" y="260" width="40" height="240" /><rect x="1385" y="310" width="55" height="190" />
                  </g>
                  <g fill="#64748b">
                    <rect x="210" y="210" width="60" height="290" /><rect x="295" y="180" width="55" height="320" />
                    <rect x="375" y="195" width="65" height="305" /><rect x="505" y="248" width="55" height="252" />
                    <rect x="610" y="140" width="50" height="360" /><rect x="682" y="120" width="62" height="380" />
                    <rect x="780" y="188" width="56" height="312" /><rect x="865" y="132" width="66" height="368" />
                    <rect x="1005" y="185" width="60" height="315" /><rect x="1190" y="195" width="45" height="305" />
                  </g>
                  <g fill="#475569">
                    <rect x="0" y="340" width="70" height="160" /><rect x="105" y="280" width="65" height="220" />
                    <rect x="240" y="345" width="55" height="155" /><rect x="328" y="290" width="72" height="210" />
                    <rect x="435" y="310" width="62" height="190" /><rect x="528" y="318" width="66" height="182" />
                    <rect x="630" y="335" width="46" height="165" /><rect x="732" y="305" width="56" height="195" />
                    <rect x="838" y="290" width="52" height="210" /><rect x="982" y="338" width="62" height="162" />
                    <rect x="1088" y="332" width="52" height="168" /><rect x="1232" y="322" width="66" height="178" />
                    <rect x="1348" y="338" width="52" height="162" />
                  </g>
                  <rect x="0" y="0" width="1440" height="500" fill={`url(#skyFade${copy})`} />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="ap-header">
          <div className="ap-header-logo" onClick={() => navigate("/")}>
            <div className="ap-header-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="ap-header-logo-text">Tolet AI</span>
          </div>

          {/* Role badge */}
          <div className={`ap-role-badge ${role === "landlord" ? "landlord" : "partner"}`}>
            {role === "landlord" ? "🏠 Landlord" : "🤝 Channel Partner"}
          </div>

          {/* Session count for channel partner */}
          {role === "channel_partner" && listingsCount > 0 && (
            <div className="ap-session-badge">
              🏠 {listingsCount} listed
            </div>
          )}
        </div>

        {/* Title */}
        <div className="ap-title-section">
          <h1 className="ap-page-title">Add Property</h1>
          <p className="ap-page-sub">
            {role === "channel_partner" && listingsCount > 0
              ? `Listing #${listingsCount + 1} this session`
              : "Your listing goes live instantly on Firestore"}
          </p>
        </div>

        {/* Step label + progress */}
        <div style={{ maxWidth: 680, margin: "24px auto 0", width: "100%", padding: "0 32px" }}>
          <div className="ap-step-label-row">
            <h2 className="ap-step-heading">{stepLabels[step - 1]}</h2>
            <span className="ap-step-counter">Step {step} of {TOTAL_STEPS}</span>
          </div>
        </div>

        <div className="ap-progress-bar">
          <div className="ap-progress-track">
            <div className="ap-progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        {/* Form area */}
        <div className="ap-form-area">
          <div className="ap-card">

            {/* ═══ STEP 1: Basic Information ═══ */}
            {step === 1 && (
              <>
                {/* ── Contact info banner ── */}
                <div className="ap-contact-banner">
                  <div className="ap-contact-banner-icon">👤</div>
                  <div className="ap-contact-banner-text">
                    <strong>Contact details are required</strong> — this information will be shown to prospective tenants so they can reach the right person.
                  </div>
                </div>

                {/* ── Name ── */}
                <div className="ap-field">
                  <label className="ap-label">
                    {role === "landlord" ? "Your Name (Owner)" : "Your Name (Agent / Partner)"}
                  </label>
                  <input
                    className={`ap-input${errors.ownerName ? " error" : ""}`}
                    placeholder={role === "landlord" ? "e.g. Rajesh Kumar" : "e.g. Priya Agencies"}
                    value={form.ownerName}
                    onChange={(e) => updateField("ownerName", e.target.value)}
                  />
                  {errors.ownerName && <div className="ap-error-msg">{errors.ownerName}</div>}
                </div>

                {/* ── Phone ── */}
                <div className="ap-field">
                  <label className="ap-label">Contact Phone Number</label>
                  <div className="ap-phone-row">
                    <div className="ap-phone-prefix">🇮🇳 +91</div>
                    <input
                      className={`ap-input${errors.ownerPhone ? " error" : ""}`}
                      type="tel"
                      placeholder="98765 43210"
                      value={form.ownerPhone}
                      onChange={(e) => updateField("ownerPhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      style={{ flex: 1 }}
                    />
                  </div>
                  {errors.ownerPhone && <div className="ap-error-msg">{errors.ownerPhone}</div>}
                </div>

                {/* ── Divider ── */}
                <div className="ap-section-divider">
                  <div className="ap-section-divider-line" />
                  <span className="ap-section-divider-label">Property Location</span>
                  <div className="ap-section-divider-line" />
                </div>

                {/* ── Property kind ── */}
                <div className="ap-field">
                  <label className="ap-label">What kind of property is it?</label>
                  <div className="ap-pills">
                    {PROPERTY_KINDS.map((k) => (
                      <button key={k.label} type="button" className={`ap-pill${form.kind === k.label ? " active" : ""}`} onClick={() => updateField("kind", k.label)}>
                        <span className="ap-pill-icon">{k.icon}</span>{k.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Locality ── */}
                <div className="ap-field">
                  <label className="ap-label">Area or Locality</label>
                  <select className={`ap-select${errors.location ? " error" : ""}`} value={form.location} onChange={(e) => updateField("location", e.target.value)}>
                    <option value="">Select locality in Chennai</option>
                    {LOCALITY_NAMES.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                  {errors.location && <div className="ap-error-msg">{errors.location}</div>}
                </div>

                <div className="ap-row">
                  <div className="ap-field">
                    <label className="ap-label">City</label>
                    <input className="ap-input" value={form.city} disabled style={{ opacity: 0.7 }} />
                  </div>
                  <div className="ap-field">
                    <label className="ap-label">State</label>
                    <input className="ap-input" value={form.state} disabled style={{ opacity: 0.7 }} />
                  </div>
                </div>

                {/* ── Geotagged Photos — required for BOTH roles ── */}
                <div className="ap-field">
                  <div className="ap-section-divider" style={{ marginTop: 4, marginBottom: 16 }}>
                    <div className="ap-section-divider-line" />
                    <span className="ap-section-divider-label">📍 Geo-Verified Photos</span>
                    <div className="ap-section-divider-line" />
                  </div>

                  <p className="ap-geo-desc">
                    Upload at least <strong>3 JPEG photos</strong> taken at the property using your phone camera app.
                    GPS coordinates must be within <strong>{MAX_DISTANCE_KM} km</strong> of <strong>{form.location || "the selected locality"}</strong>.
                    {role === "channel_partner" && " This helps verify the property exists at the stated location."}
                  </p>

                  <div
                    className={`ap-geo-upload-box ${geoVerified ? "verified" : ""} ${geoError && !geoVerifying ? "error-state" : ""}`}
                    onClick={() => document.getElementById("geo-file-input").click()}
                  >
                    <input
                      id="geo-file-input"
                      type="file"
                      accept="image/jpeg,image/jpg"
                      multiple
                      capture="environment"
                      onChange={handleGeoFileChange}
                      hidden
                    />
                    <div className="ap-geo-icon">
                      {geoVerifying ? "⏳" : geoVerified ? "✅" : "📷"}
                    </div>
                    <div className="ap-geo-title">
                      {geoVerifying
                        ? "Verifying GPS coordinates…"
                        : geoVerified
                        ? `${geoResults.filter((r) => r.status === "pass").length} photos verified ✓`
                        : "Tap to upload property photos"}
                    </div>
                    <div className="ap-geo-sub">JPEG only · GPS required · Within {MAX_DISTANCE_KM} km of locality</div>
                  </div>

                  {geoVerifying && (
                    <div className="ap-geo-loading">
                      <div className="spinner" />
                      <span>Reading EXIF GPS data from photos…</span>
                    </div>
                  )}

                  {!geoVerifying && geoResults.length > 0 && (
                    <div className="ap-geo-results">
                      {geoResults.map((r, i) => <GeoResultBadge key={i} result={r} />)}
                      {geoVerified && (
                        <div className="ap-geo-success">
                          ✅ Location verified — photos match {form.location}
                        </div>
                      )}
                    </div>
                  )}

                  {geoError && !geoVerifying && (
                    <div className="ap-error-msg" style={{ marginTop: 8 }}>{geoError}</div>
                  )}
                  {errors.geoImages && !geoError && (
                    <div className="ap-error-msg" style={{ marginTop: 8 }}>{errors.geoImages}</div>
                  )}
                </div>

                <div className="ap-btn-row">
                  <button className="ap-btn-back" onClick={() => navigate("/")}>Back</button>
                  <button className="ap-btn-next" onClick={nextStep}>Next Step</button>
                </div>
              </>
            )}

            {/* ═══ STEP 2: Property Details ═══ */}
            {step === 2 && (
              <>
                <div className="ap-field">
                  <label className="ap-label">Property Type</label>
                  <div className="ap-pills">
                    {PROPERTY_TYPES.map((t) => (
                      <button key={t} type="button" className={`ap-pill${form.type === t ? " active" : ""}`} onClick={() => updateField("type", t)}>{t}</button>
                    ))}
                  </div>
                  {errors.type && <div className="ap-error-msg">{errors.type}</div>}
                </div>

                <div className="ap-row">
                  <div className="ap-field">
                    <label className="ap-label">Area (sq.ft)</label>
                    <input className={`ap-input${errors.sqft ? " error" : ""}`} type="number" placeholder="e.g. 850" value={form.sqft} onChange={(e) => updateField("sqft", e.target.value)} />
                    {errors.sqft && <div className="ap-error-msg">{errors.sqft}</div>}
                  </div>
                  <div className="ap-field">
                    <label className="ap-label">Facing</label>
                    <select className={`ap-select${errors.facing ? " error" : ""}`} value={form.facing} onChange={(e) => updateField("facing", e.target.value)}>
                      <option value="">Select direction</option>
                      {FACING_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {errors.facing && <div className="ap-error-msg">{errors.facing}</div>}
                  </div>
                </div>

                <div className="ap-row">
                  <div className="ap-field">
                    <label className="ap-label">Floor Number</label>
                    <input className={`ap-input${errors.floor ? " error" : ""}`} placeholder="e.g. 3 or Ground" value={form.floor} onChange={(e) => updateField("floor", e.target.value)} />
                    {errors.floor && <div className="ap-error-msg">{errors.floor}</div>}
                  </div>
                  <div className="ap-field">
                    <label className="ap-label">Total Floors</label>
                    <input className={`ap-input${errors.totalFloors ? " error" : ""}`} type="number" placeholder="e.g. 8" value={form.totalFloors} onChange={(e) => updateField("totalFloors", e.target.value)} />
                    {errors.totalFloors && <div className="ap-error-msg">{errors.totalFloors}</div>}
                  </div>
                </div>

                <div className="ap-field">
                  <label className="ap-label">Furnishing</label>
                  <div className="ap-pills">
                    {FURNISHED_OPTIONS.map((f) => (
                      <button key={f} type="button" className={`ap-pill${form.furnished === f ? " active" : ""}`} onClick={() => updateField("furnished", f)}>{f}</button>
                    ))}
                  </div>
                  {errors.furnished && <div className="ap-error-msg">{errors.furnished}</div>}
                </div>

                <div className="ap-btn-row">
                  <button className="ap-btn-back" onClick={prevStep}>Back</button>
                  <button className="ap-btn-next" onClick={nextStep}>Next Step</button>
                </div>
              </>
            )}

            {/* ═══ STEP 3: Pricing & Availability ═══ */}
            {step === 3 && (
              <>
                <div className="ap-field">
                  <label className="ap-label">Monthly Rent (₹)</label>
                  <input className={`ap-input${errors.price ? " error" : ""}`} type="number" placeholder="e.g. 15000" value={form.price} onChange={(e) => updateField("price", e.target.value)} />
                  {errors.price && <div className="ap-error-msg">{errors.price}</div>}
                </div>

                <div className="ap-field">
                  <label className="ap-label">Available From</label>
                  <input className={`ap-input${errors.available_from ? " error" : ""}`} type="date" value={form.available_from} onChange={(e) => updateField("available_from", e.target.value)} />
                  {errors.available_from && <div className="ap-error-msg">{errors.available_from}</div>}
                </div>

                <div className="ap-field">
                  <label className="ap-label" style={{ marginBottom: 12 }}>Additional Features</label>
                  <div className={`ap-toggle-row${form.parking ? " active" : ""}`} onClick={() => updateField("parking", !form.parking)}>
                    <span className="ap-toggle-label">🅿️ Parking Available</span>
                    <div className={`ap-toggle-switch${form.parking ? " on" : ""}`}><div className="ap-toggle-knob" /></div>
                  </div>
                  <div className={`ap-toggle-row${form.pet_friendly ? " active" : ""}`} onClick={() => updateField("pet_friendly", !form.pet_friendly)}>
                    <span className="ap-toggle-label">🐾 Pet Friendly</span>
                    <div className={`ap-toggle-switch${form.pet_friendly ? " on" : ""}`}><div className="ap-toggle-knob" /></div>
                  </div>
                </div>

                <div className="ap-btn-row">
                  <button className="ap-btn-back" onClick={prevStep}>Back</button>
                  <button className="ap-btn-next" onClick={nextStep}>Next Step</button>
                </div>
              </>
            )}

            {/* ═══ STEP 4: Amenities & Features ═══ */}
            {step === 4 && (
              <>
                <div className="ap-field">
                  <label className="ap-label">Select Amenities</label>
                  <div className="ap-amenity-grid">
                    {ALL_AMENITIES.map((a) => (
                      <button key={a} type="button" className={`ap-amenity-chip${form.amenities.includes(a) ? " active" : ""}`} onClick={() => toggleAmenity(a)}>
                        {form.amenities.includes(a) ? "✓ " : ""}{a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ap-field">
                  <label className="ap-label">Water Supply</label>
                  <select className={`ap-select${errors.water_supply ? " error" : ""}`} value={form.water_supply} onChange={(e) => updateField("water_supply", e.target.value)}>
                    <option value="">Select water supply type</option>
                    {WATER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                  {errors.water_supply && <div className="ap-error-msg">{errors.water_supply}</div>}
                </div>

                <div className="ap-field">
                  <label className="ap-label">Nearby Landmarks (comma separated)</label>
                  <input className="ap-input" placeholder="e.g. Railway Station, Park, Hospital" value={form.nearby} onChange={(e) => updateField("nearby", e.target.value)} />
                </div>

                <div className="ap-btn-row">
                  <button className="ap-btn-back" onClick={prevStep}>Back</button>
                  <button className="ap-btn-next" onClick={nextStep}>Next Step</button>
                </div>
              </>
            )}

            {/* ═══ STEP 5: Review & Submit ═══ */}
            {step === 5 && (
              <>
                {/* Contact info review */}
                <div className="ap-review-section">
                  <div className="ap-review-title">Contact Information</div>
                  <div className="ap-review-grid">
                    {[
                      [role === "landlord" ? "Owner Name" : "Agent Name", form.ownerName || "—"],
                      ["Contact Phone", form.ownerPhone ? `+91 ${form.ownerPhone}` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="ap-review-item">
                        <span className="ap-review-item-label">{label}</span>
                        <span className="ap-review-item-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ap-review-section">
                  <div className="ap-review-title">Property Overview</div>
                  <div className="ap-review-grid">
                    {[
                      ["Type", form.type],
                      ["Location", `${form.location}, ${form.city}`],
                      ["Rent", `₹${Number(form.price).toLocaleString("en-IN")}/month`],
                      ["Area", `${form.sqft} sq.ft`],
                      ["Floor", `${form.floor} of ${form.totalFloors}`],
                      ["Facing", form.facing],
                      ["Furnished", form.furnished],
                      ["Available From", form.available_from],
                      ["Water Supply", form.water_supply],
                      ["Parking", form.parking ? "Yes ✅" : "No"],
                      ["Pet Friendly", form.pet_friendly ? "Yes 🐾" : "No"],
                      ["Category", form.kind],
                      ["Listed As", role === "landlord" ? "Landlord" : "Channel Partner"],
                    ].map(([label, value]) => (
                      <div key={label} className="ap-review-item">
                        <span className="ap-review-item-label">{label}</span>
                        <span className="ap-review-item-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geo-verification summary */}
                {geoResults.length > 0 && (
                  <div className="ap-review-section">
                    <div className="ap-review-title">Photo Geo-Verification</div>
                    <div style={{ padding: "12px 16px", borderRadius: 12, background: geoVerified ? "#f0fdf4" : "#fef2f2", border: `1px solid ${geoVerified ? "#bbf7d0" : "#fecaca"}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: geoVerified ? "#15803d" : "#dc2626", marginBottom: 6 }}>
                        {geoVerified ? "✅ Geo-Verified" : "⚠️ Verification Incomplete"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {geoResults.filter((r) => r.status === "pass").length} of {geoResults.length} photos within {MAX_DISTANCE_KM} km of {form.location}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {geoResults.map((r, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6, background: r.status === "pass" ? "#dcfce7" : r.status === "fail" ? "#fecaca" : "#fef3c7", color: r.status === "pass" ? "#15803d" : r.status === "fail" ? "#dc2626" : "#d97706" }}>
                            {r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "⚠"} {r.name.slice(0, 20)}{r.name.length > 20 ? "…" : ""}
                            {r.distance !== null ? ` (${r.distance.toFixed(1)}km)` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {form.amenities.length > 0 && (
                  <div className="ap-review-section">
                    <div className="ap-review-title">Amenities</div>
                    <div className="ap-review-tags">
                      {form.amenities.map((a) => <span key={a} className="ap-review-tag">✓ {a}</span>)}
                    </div>
                  </div>
                )}

                {form.nearby.trim() && (
                  <div className="ap-review-section">
                    <div className="ap-review-title">Nearby Landmarks</div>
                    <div className="ap-review-tags">
                      {form.nearby.split(",").filter(Boolean).map((n, i) => <span key={i} className="ap-review-tag">{n.trim()}</span>)}
                    </div>
                  </div>
                )}

                <div className="ap-btn-row">
                  <button className="ap-btn-back" onClick={prevStep} disabled={isSubmitting}>Back</button>
                  <button className="ap-btn-submit" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (<><div className="ap-spinner" />Saving to Firestore...</>) : role === "channel_partner" ? "Submit & Continue" : "Submit Property"}
                  </button>
                </div>

                {submitError && <div className="ap-submit-error">⚠️ {submitError}</div>}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ap-footer">
          <span className="ap-footer-left">© 2026 TOLET INDIA. ALL RIGHTS RESERVED.</span>
          <div className="ap-footer-links">
            <a href="#" className="ap-footer-link">ABOUT</a>
            <a href="#" className="ap-footer-link">TERMS</a>
            <a href="#" className="ap-footer-link">SUPPORT</a>
            <a href="#" className="ap-footer-link">PRIVACY</a>
          </div>
        </div>

        {/* Success overlay (landlord only) */}
        {submitSuccess && (
          <div className="ap-success-overlay">
            <div className="ap-success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="ap-success-title">Property Listed Successfully!</h2>
            <p className="ap-success-sub">Saved to Firestore · Redirecting you home...</p>
          </div>
        )}
      </div>
    </>
  );
}