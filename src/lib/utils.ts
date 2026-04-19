import { clsx, type ClassValue } from 'clsx';

// NativeWind resolves utility conflicts itself at the CSS-interop layer,
// so `tailwind-merge` is not needed on native the way it is on the web.
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
