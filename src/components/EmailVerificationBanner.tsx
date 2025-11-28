import { useAuth } from '../context/AuthContext';

export default function EmailVerificationBanner() {
  const { user } = useAuth();

  // Email verification is not used with application-level authentication
  // Always return null to hide this banner
  return null;

  const handleResend = async () => {
    setSending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Please verify your email address ({user.email}). Check your inbox for the verification email.
            </p>
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
            {sent && (
              <p className="text-sm text-green-600 mt-1">Verification email sent! Check your inbox.</p>
            )}
          </div>
        </div>
        <button
          onClick={handleResend}
          disabled={sending || sent}
          className="ml-4 text-sm font-medium text-yellow-700 hover:text-yellow-600 disabled:opacity-50"
        >
          {sending ? 'Sending...' : sent ? 'Sent!' : 'Resend Email'}
        </button>
      </div>
    </div>
  );
}

