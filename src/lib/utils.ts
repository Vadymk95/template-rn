import { clsx, type ClassValue } from 'clsx';

// `cn` only joins class names; it resolves no conflicts (there is no `tailwind-merge`). On web the
// browser picks between two classes for the same property by stylesheet order, not by the order
// they are written in here, so a node must never carry two colour classes: give each state one.
export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
