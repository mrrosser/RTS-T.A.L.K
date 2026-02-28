import React, { useState } from 'react';
import { containsProfanity } from '../utils/profanityFilter';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name to join the conversation.');
      return;
    }
    if (containsProfanity(trimmedName)) {
      setError('Please choose a more appropriate display name.');
      return;
    }
    onLogin(trimmedName);
  };

  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[100svh] p-4">
        <div className="text-center mb-10">
            <h1 className="text-6xl sm:text-8xl font-black font-display tracking-tight text-gray-100">T.A.L.K</h1>
            <p className="text-lg sm:text-xl text-gray-400 mt-2">Tactically Altering Language for Knowledge</p>
        </div>
      <div className="w-full bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-100 font-display">Join a Session</h2>
        
        {error && <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center">{error}</div>}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">Your Display Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Enter your name..."
            autoCapitalize="words"
            className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-amber-400 transition-shadow duration-200"
          />
        </div>
        
        <button
          onClick={handleJoin}
          className="w-full bg-gradient-to-r from-amber-600 via-purple-600 to-amber-600 bg-[length:200%_auto] hover:bg-[position:100%_0] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-purple-500 text-white font-bold py-3 px-4 rounded-lg text-lg transition-all duration-500 transform hover:scale-105 shadow-lg hover:shadow-purple-500/30"
        >
          Continue as Guest
        </button>

        <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative bg-[#0d0d1a] px-2 text-sm text-gray-500">OR</div>
        </div>

        <button
          disabled
          className="w-full bg-gray-900/50 text-white/50 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3 cursor-not-allowed border border-gray-700"
          title="Google Sign-In Coming Soon"
        >
            <svg className="w-6 h-6" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.23,4.142-4.082,5.571l6.19,5.238C41.346,34.773,44,29.865,44,24C44,22.659,43.862,21.35,43.611,20.083z"></p>
            </svg>
            Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;