export function hasVerifiedPhone(user: {
  phone?: string | null;
  phoneVerified?: boolean;
  PhoneIdentity?: { phoneE164: string } | null;
}): boolean {
  return Boolean(user.phoneVerified && user.phone && user.PhoneIdentity?.phoneE164 === user.phone);
}

export function withVerifiedPhone<T extends { phone?: string | null; phoneVerified?: boolean; PhoneIdentity?: { phoneE164: string } | null }>(user: T) {
  const { PhoneIdentity, ...publicFields } = user;
  return { ...publicFields, phoneVerified: hasVerifiedPhone(user) };
}
