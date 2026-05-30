import React, { useMemo, useState } from 'react';
import { containsProfanity } from '../utils/profanityFilter';
import {
  confirmPhoneCode,
  sendPhoneCode,
  signInAsGuest,
  signInWithApple,
  signInWithGoogle,
  supportsFirebaseAuth,
  type ClientAuthSession,
} from '../services/authService';

interface LoginScreenProps {
  onLogin: (session: ClientAuthSession, displayName: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const hasFirebase = useMemo(() => supportsFirebaseAuth(), []);

  const validateName = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name to join the conversation.');
      return null;
    }
    if (containsProfanity(trimmedName)) {
      setError('Please choose a more appropriate display name.');
      return null;
    }
    return trimmedName;
  };

  const handleAuth = async (runner: () => Promise<ClientAuthSession>) => {
    const displayName = validateName();
    if (!displayName) return;
    setIsLoading(true);
    setError('');
    try {
      const session = await runner();
      onLogin(session, displayName);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => handleAuth(() => signInAsGuest(name.trim()));
  const handleGoogleLogin = () => handleAuth(() => signInWithGoogle(name.trim()));
  const handleAppleLogin = () => handleAuth(() => signInWithApple(name.trim()));

  const handleSendPhoneCode = async () => {
    const displayName = validateName();
    if (!displayName) return;
    if (!phoneNumber.trim()) {
      setError('Enter a phone number to continue with phone sign-in.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await sendPhoneCode(phoneNumber.trim(), 'talk-phone-recaptcha');
      setAwaitingCode(true);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPhoneCode = () => handleAuth(() => confirmPhoneCode(phoneCode.trim(), name.trim()));

  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[100svh] p-4">
      <div className="text-center mb-10">
        <h1 className="text-6xl sm:text-8xl font-black font-display tracking-tight text-gray-100">T.A.L.K</h1>
        <p className="text-lg sm:text-xl text-gray-400 mt-2">Tactically Analyzing Language for Knowledge</p>
      </div>
      <div className="w-full bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-8 space-y-5">
        <h2 className="text-2xl font-bold text-center text-gray-100 font-display">Choose How You Enter</h2>

        {error && <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center">{error}</div>}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            autoCapitalize="words"
            className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-amber-400 transition-shadow duration-200"
          />
        </div>

        <div className="grid gap-3">
          <button
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 text-white font-bold py-3 px-4 rounded-lg text-lg disabled:opacity-60"
          >
            Continue as Guest
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || !hasFirebase}
            className="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            Continue with Google
          </button>

          <button
            onClick={handleAppleLogin}
            disabled={isLoading || !hasFirebase}
            className="w-full bg-black border border-white/20 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            Continue with Apple
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-200">Continue with Phone Number</p>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+1 555 123 4567"
            className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500"
            disabled={awaitingCode}
          />
          {awaitingCode && (
            <input
              type="text"
              value={phoneCode}
              onChange={(event) => setPhoneCode(event.target.value)}
              placeholder="Verification code"
              className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500"
            />
          )}
          <button
            onClick={awaitingCode ? handleConfirmPhoneCode : handleSendPhoneCode}
            disabled={isLoading || !hasFirebase}
            className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {awaitingCode ? 'Confirm Code' : 'Send Verification Code'}
          </button>
          <div id="talk-phone-recaptcha" />
          {!hasFirebase && (
            <p className="text-xs text-amber-200">
              Firebase auth is not configured in this environment. Guest mode remains available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
