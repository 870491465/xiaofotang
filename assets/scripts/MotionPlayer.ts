import { Sprite, SpriteFrame, UIOpacity } from 'cc';
export type MotionName = 'pray' | 'incense' | 'sit_down' | 'stand_up' | 'wooden_fish' | 'stand_idle' | 'meditate_idle';
export interface MotionClip { frames: SpriteFrame[]; durations: number[]; loop: boolean; events: { frame: number; name: string }[]; }
export interface PlayOptions {
    loop?: boolean; startFrame?: number; gap?: number; transition?: number;
    onEvent?: (name: string, frame: number) => void; onComplete?: () => void;
}
/** One clock, one Sprite, no schedule/setTimeout/listeners. Internal frame numbers are zero based. */
export class MotionPlayer {
    action: MotionName = 'stand_idle'; frame = 0; speed = 1; paused = false; playing = false; gap = 0;
    private elapsed = 0; private gapLeft = 0; private generation = 0;
    private options: PlayOptions = {}; private settle: ((completed: boolean) => void) | null = null;
    private fadeLeft = 0; private fadeDuration = 0;
    constructor(readonly sprite: Sprite, public clips: Record<MotionName, MotionClip>, private opacity: UIOpacity) { }
    replaceClips(clips: Record<MotionName, MotionClip>): void { this.stop(); this.clips = clips; this.show('stand_idle'); }
    get frameCount(): number { return this.clips[this.action].frames.length; }
    get duration(): number { return this.clips[this.action].durations.reduce((a, b) => a + b, 0); }
    show(action: MotionName, frame = 0, transition = 0): void {
        this.stop(); this.action = action; this.frame = Math.max(0, Math.min(frame, this.frameCount - 1));
        this.apply(); this.fadeDuration = this.fadeLeft = transition; this.opacity.opacity = transition ? 180 : 255;
    }
    play(action: MotionName, options: PlayOptions = {}): Promise<boolean> {
        this.show(action, options.startFrame ?? 0, options.transition ?? 0.1);
        this.options = options; this.gap = options.gap ?? 0; this.playing = true; this.paused = false;
        const promise = new Promise<boolean>(resolve => { this.settle = resolve; }); this.emit(); return promise;
    }
    stop(): void {
        ++this.generation; this.playing = false; this.paused = false;
        this.elapsed = 0; this.gapLeft = 0; this.fadeLeft = 0; this.opacity.opacity = 255;
        this.options = {}; const settle = this.settle; this.settle = null; settle?.(false);
    }
    seek(frame: number): void {
        this.paused = true; this.frame = (frame + this.frameCount) % this.frameCount;
        this.elapsed = 0; this.gapLeft = 0; this.apply(); // Scrubbing never emits gameplay events.
    }
    update(dt: number): void {
        if (this.paused) return;
        if (this.fadeLeft > 0) {
            this.fadeLeft = Math.max(0, this.fadeLeft - dt);
            this.opacity.opacity = Math.round(255 - 75 * this.fadeLeft / this.fadeDuration);
        }
        if (!this.playing) return;
        const version = this.generation; let left = Math.max(0, dt) * this.speed;
        while (left > 0 && this.playing && version === this.generation) {
            if (this.gapLeft > 0) {
                const used = Math.min(left, this.gapLeft); this.gapLeft -= used; left -= used;
                if (this.gapLeft > 1e-8) return;
                this.frame = 0; this.apply(); this.emit(); if (version !== this.generation) return;
            }
            const duration = this.clips[this.action].durations[this.frame];
            const used = Math.min(left, Math.max(0, duration - this.elapsed)); left -= used; this.elapsed += used;
            if (this.elapsed + 1e-8 < duration) return;
            this.elapsed = 0;
            if (this.frame + 1 < this.frameCount) { ++this.frame; this.apply(); this.emit(); }
            else if (this.options.loop ?? this.clips[this.action].loop) {
                this.gapLeft = this.gap;
                if (this.gapLeft <= 0) { this.frame = 0; this.apply(); this.emit(); }
            } else {
                this.playing = false; const complete = this.options.onComplete, settle = this.settle;
                this.options = {}; this.settle = null; settle?.(true); complete?.();
            }
        }
    }
    private apply(): void { this.sprite.spriteFrame = this.clips[this.action].frames[this.frame]; }
    private emit(): void {
        for (const event of this.clips[this.action].events) if (event.frame === this.frame) this.options.onEvent?.(event.name, this.frame + 1);
    }
}
/** Follows manifest order and nonuniform durations; two idle images follow the five action groups. */
export function motionClips(manifest: any, frames: SpriteFrame[], usePrayAsStanding = true): Record<MotionName, MotionClip> {
    const result = {} as Record<MotionName, MotionClip>; let offset = 0;
    for (const key of Object.keys(manifest)) {
        const spec = manifest[key]; if (!Array.isArray(spec.frames)) continue;
        const clip = spec.frames.map(() => frames[offset++]);
        if (clip.some((f: SpriteFrame) => !f || f.originalSize.width !== 512 || f.originalSize.height !== 768)) throw new Error(`人物帧缺失或画布不是512×768: ${key}`);
        const event = manifest.events?.[key];
        result[key as MotionName] = { frames: clip, durations: spec.frame_duration_ms.map((ms: number) => ms / 1000), loop: spec.loop,
            events: event ? [{ frame: event.after_frame ?? event.frame - 1, name: event.event }] : [] };
        if (result[key as MotionName].durations.length !== clip.length || result[key as MotionName].durations.some(n => !(n > 0))) throw new Error(`动作时长无效: ${key}`);
    }
    for (const key of ['stand_idle', 'meditate_idle'] as const) {
        const f = frames[offset++]; if (!f || f.originalSize.width !== 512 || f.originalSize.height !== 768) throw new Error(`待机帧缺失: ${key}`);
        result[key] = { frames: [f], durations: [1], events: [], loop: false };
    }
    if (offset !== frames.length) throw new Error('人物帧数量与manifest不符');
    // The supplied stand_idle is barefoot. Reuse the existing shod, arms-down pray endpoint.
    // Keep the public action name stand_idle, with no pray events or completion attached.
    if (usePrayAsStanding) result.stand_idle = { frames: [result.pray.frames[0]], durations: [1], events: [], loop: false };
    return result;
}
