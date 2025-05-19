import React from 'react';
import { MagnifyingGlassIcon, DocumentTextIcon, CpuChipIcon } from '@heroicons/react/24/outline';

function LandingPage({ authError, email, password, setEmail, setPassword, onEmailSignIn, onEmailSignUp, onGoogleSignIn }) {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-red-light to-brand-red px-4 py-16 sm:py-24">
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl font-bold text-neutral-dark">
            Demystifying Federal Bills in Seconds
          </h1>
          <p className="font-sans text-lg text-neutral-medium mb-8 max-w-xl mx-auto">
            Welcome to Legal‑Ease—your business tool for searching federal legislation, viewing amendments, and AI‑powered impact analysis.
          </p>
          <div className="bg-white rounded-lg shadow-lg p-10 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-semibold text-neutral-dark mb-6">Get Started</h2>
            <div className="space-y-5">
              {authError && <p className="text-red-500">{authError}</p>}
              <div>
                <label className="block text-sm font-medium text-neutral-dark mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-dark mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red transition"
                />
              </div>
              <button
                onClick={onEmailSignUp}
                className="w-full bg-brand-red text-white py-2.5 px-4 rounded-md font-semibold hover:bg-brand-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red transition duration-150 ease-in-out"
              >
                Sign Up
              </button>
              <button
                onClick={onEmailSignIn}
                className="w-full bg-white text-brand-red py-2.5 px-4 rounded-md font-semibold border border-brand-red hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red transition duration-150 ease-in-out"
              >
                Sign In
              </button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-neutral-medium uppercase tracking-wide">or</span>
                </div>
              </div>
              <button
                onClick={onGoogleSignIn}
                className="w-full bg-brand-red text-white py-2.5 px-4 rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-brand-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red transition duration-150 ease-in-out"
              >
                {/* Google Icon */}
                <svg className="w-5 h-5" viewBox="0 0 533.5 544.3">
                  <path fill="#4285F4" d="M533.5 278.4c0-18.1-1.4-36.4-4.2-54.1H272v102.4h146.9c-6.4 34.1-25.6 62.3-54.6 81.2v67.4h88.2c51.6-47.5 80-116.9 80-196.9z"/>
                  <path fill="#34A853" d="M272 544.3c73.6 0 135.4-24.4 180.6-66.5l-88.2-67.4c-24.5 16.4-56 26-92.4 26-71 0-131.1-47.9-152.6-112.3H31.7v70.7C77.9 479.1 169.3 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.3 324.1c-10.2-30.6-10.2-63.7 0-94.3V159.1H31.7c-37.1 73.4-37.1 163.6 0 237l87.6-71.9z"/>
                  <path fill="#EA4335" d="M272 107.4c39.2 0 74.5 13.5 102.2 40.1l76.4-76.4C408.9 24.7 344.5 0 272 0 169.3 0 77.9 65.2 31.7 159.1l87.6 70.7c21.5-64.4 81.6-112.3 152.6-112.3z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* Feature Callouts */}
      <section className="py-16 bg-neutral-bg-light">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-8 bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
            <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-brand-red opacity-80" />
            <h3 className="text-xl font-semibold mt-4 mb-2">Search Bills</h3>
            <p className="text-neutral-medium">Search and filter federal legislation instantly.</p>
          </div>
          <div className="text-center p-8 bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
            <DocumentTextIcon className="h-12 w-12 mx-auto text-brand-red opacity-80" />
            <h3 className="text-xl font-semibold mt-4 mb-2">View Amendments</h3>
            <p className="text-neutral-medium">Explore proposed law changes and updates.</p>
          </div>
          <div className="text-center p-8 bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
            <CpuChipIcon className="h-12 w-12 mx-auto text-brand-red opacity-80" />
            <h3 className="text-xl font-semibold mt-4 mb-2">AI Impact Analysis</h3>
            <p className="text-neutral-medium">Get AI‑generated summaries of bill impacts.</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default LandingPage;
