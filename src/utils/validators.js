// Frontend Email & Password Validation Rules
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateAuthInput({ name, email, password, isSignup = false }) {
  if (isSignup && (!name || name.trim().length < 2)) {
    return 'Please enter a valid Kitchen or NGO name (at least 2 characters).';
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return 'Please enter a valid email address (e.g. kitchen@govindas.in).';
  }

  const pw = String(password || '');
  if (pw.length < 6) {
    return 'Password must be at least 6 characters long.';
  }

  return null;
}
