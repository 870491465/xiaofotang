import { CONFIG } from './CourtyardConfig';
import { MotionName } from './MotionPlayer';

export interface FrameRegistration { scale: number; x: number; y: number; }
export interface CharacterProfile {
    id: 'male' | 'female';
    registration: Partial<Record<MotionName, FrameRegistration>>;
    seat: { x: number; y: number };
    incense: { x: number; y: number };
    fish: { malletX: number; malletY: number; fishX: number; fishY: number };
}
const femaleStanding = 643 / 608;
export const FEMALE_PROFILE: CharacterProfile = {
    id: 'female',
    registration: {
        stand_idle: { scale: femaleStanding, x: 2 - 4 * femaleStanding, y: 5 * femaleStanding - 3 },
        pray: { scale: femaleStanding, x: 2 - 4 * femaleStanding, y: 5 * femaleStanding - 3 },
    },
    seat: { x: 238, y: 686 }, incense: { x: 385, y: 280 }, fish: CONFIG.woodenFishContact,
};
// Full-canvas optical registration, one fixed transform per WHOLE clip, never per-frame Fit.
// Male source upright heights: idle644, pray621, incense628; seated idle442, fish414.
const malePray = 644 / 621, maleIncense = 644 / 628, maleFish = 442 / 414;
export const MALE_PROFILE: CharacterProfile = {
    id: 'male',
    registration: {
        pray: { scale: malePray, x: 1.5 - 0.5 * malePray, y: 4 * malePray - 3 },
        incense: { scale: maleIncense, x: 1.5 + 1.5 * maleIncense, y: 2 * maleIncense - 3 },
        wooden_fish: { scale: maleFish, x: -28 + 36 * maleFish, y: 4 * maleFish - 3 },
    },
    seat: { x: 228, y: 686 }, incense: { x: 397, y: 242 },
    fish: { malletX: 405, malletY: 586, fishX: 54, fishY: 100 },
};
const IDENTITY: FrameRegistration = { scale: 1, x: 0, y: 0 };
export function registration(profile: CharacterProfile, action: MotionName): FrameRegistration {
    return profile.registration[action] || IDENTITY;
}
