/** All times are seconds; debug speed never changes these production defaults. */
export const CONFIG = {
    // Legacy gray-rig timings. Current character frame timings come from animation_manifest.json.
    incenseStages: [0.55, 0.65, 0.45, 0.55, 0.7, 0.55],
    bowStages: [0.55, 0.35, 0.65, 0.4, 0.65, 0.4],
    sitDuration: 0.7,
    breathPeriod: 6,
    incenseLifetime: 180,
    incenseSmoke: { height: 180, segments: 24, width: 3.2, opacity: 160, drift: 9, flow: 0.7 },
    meritFeedback: { poolSize: 3, duration: 1.1, rise: 80 },
    // Frame5 lower-right mallet edge meets the fish's upper-left slope after moving the furniture.
    woodenFishContact: { malletX: 429, malletY: 582, fishX: 54, fishY: 100 },
    autoInterval: 1,
    strikeDown: 0.075,
    strikeUp: 0.17,
};
export enum PlayState { Idle = '待机', Transition = '动作过渡', Incense = '上香近景', Bow = '礼拜', Meditation = '打坐', Fish = '敲木鱼' }
