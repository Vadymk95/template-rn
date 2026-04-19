import type { Href } from 'expo-router';

/** Typed deep links / in-app paths — prefer these over raw string `href`s. */
export const HREF = {
    home: '/' as Href
} as const;
