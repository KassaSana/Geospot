// Input checks shared by the login, sign-up and password reset screens

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_USERNAME_LENGTH = 30;

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// The reason a new password can't be used, or null if it's fine
export function newPasswordProblem(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.trim() !== password) {
    return "Password can't start or end with a space.";
  }
  return null;
}
