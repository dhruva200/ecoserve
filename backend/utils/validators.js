// Backend Email & Password Validation Rules
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) {
    return { valid: false, message: 'Email ID is required.' };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return {
      valid: false,
      message: 'Please enter a valid email address (e.g. name@domain.com).',
    };
  }
  return { valid: true, email: clean };
}

export function validatePassword(password) {
  const pw = String(password || '');
  if (!pw) {
    return { valid: false, message: 'Password is required.' };
  }
  if (pw.length < 6) {
    return {
      valid: false,
      message: 'Password must be at least 6 characters long.',
    };
  }
  return { valid: true };
}
