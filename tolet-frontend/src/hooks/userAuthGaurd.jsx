import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

/**
 * useAuthGuard
 * Returns { isLoggedIn, showLoginModal, guardedAction, closeModal }
 *
 * Usage:
 *   const { guardedAction, showLoginModal, closeModal } = useAuthGuard();
 *   <button onClick={() => guardedAction(() => navigate("/post"))}>Post</button>
 *   <LoginModal isOpen={showLoginModal} onClose={closeModal} />
 */
export function useAuthGuard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return unsub;
  }, []);

  /**
   * Wrap any action with an auth check.
   * If logged in  → runs the action immediately.
   * If logged out → opens LoginModal; runs the action after login.
   */
  const guardedAction = (action) => {
    if (isLoggedIn) {
      action();
    } else {
      // Store the action so we can replay it after login succeeds
      setPendingAction(() => action);
      setShowLoginModal(true);
    }
  };

  const closeModal = () => {
    setShowLoginModal(false);
    // If login succeeded (user is now logged in) run the pending action
    if (pendingAction && auth.currentUser) {
      pendingAction();
    }
    setPendingAction(null);
  };

  return { isLoggedIn, showLoginModal, guardedAction, closeModal };
}