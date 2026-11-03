export interface ProfileValues {
  displayName: string;
  email: string;
}

export interface ProfileErrors {
  displayName?: string;
  email?: string;
}

export const DISPLAY_NAME_MAX = 100;
export const EMAIL_MAX = 320;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The same rules the API applies, so most mistakes are caught before a request is made. */
export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};
  const displayName = values.displayName.trim();
  const email = values.email.trim();
  if (!displayName) {
    errors.displayName = 'Enter the name to show for your account.';
  } else if (displayName.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Use at most ${DISPLAY_NAME_MAX} characters.`;
  }
  if (!email) {
    errors.email = 'Enter your e-mail address.';
  } else if (email.length > EMAIL_MAX) {
    errors.email = `Use at most ${EMAIL_MAX} characters.`;
  } else if (!EMAIL_SHAPE.test(email)) {
    errors.email = 'Enter an e-mail address such as name@example.com.';
  }
  return errors;
}

export function hasErrors(errors: ProfileErrors): boolean {
  return Boolean(errors.displayName || errors.email);
}

export function trimmed(values: ProfileValues): ProfileValues {
  return { displayName: values.displayName.trim(), email: values.email.trim() };
}

export function isUnchanged(a: ProfileValues, b: ProfileValues): boolean {
  const left = trimmed(a);
  const right = trimmed(b);
  return left.displayName === right.displayName && left.email === right.email;
}
