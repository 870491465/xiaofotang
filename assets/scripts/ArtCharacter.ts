import { Component, Node, Sprite, UIOpacity, UITransform, Vec3, Tween } from 'cc';
import { node } from './GrayUI';
import { MotionClip, MotionName, MotionPlayer, PlayOptions } from './MotionPlayer';
import { CharacterProfile, FEMALE_PROFILE, registration } from './CharacterProfile';

/** Existing adapter, now a single fixed full-canvas Sprite for every motion. */
export class ArtCharacter {
    readonly root: Node; readonly visual: Node; readonly player: MotionPlayer; readonly sprite: Sprite;
    private opacity: UIOpacity;
    private homePosition: Vec3;
    private registered: MotionName | null = null;
    private profile: CharacterProfile = FEMALE_PROFILE;
    constructor(parent: Node, clips: Record<MotionName, MotionClip>, x = -135, y = -470, scale = 1.1) {
        this.root = node(parent, 'CharacterRoot', x, y, 512, 768);
        this.root.getComponent(UITransform)!.setAnchorPoint(0.5, 64 / 768); this.root.setScale(scale, scale, 1);
        this.homePosition = this.root.position.clone();
        this.visual = node(this.root, 'CharacterVisual_序列帧', 0, 0, 512, 768);
        this.visual.getComponent(UITransform)!.setAnchorPoint(0.5, 64 / 768);
        this.sprite = this.visual.addComponent(Sprite); this.sprite.sizeMode = Sprite.SizeMode.CUSTOM; this.sprite.trim = false;
        this.opacity = this.visual.addComponent(UIOpacity);
        this.player = new MotionPlayer(this.sprite, clips, this.opacity); this.idle();
    }
    get action(): string { return this.player.action; }
    useClips(clips: Record<MotionName, MotionClip>, profile: CharacterProfile = this.profile): void {
        this.stop(); this.profile = profile; this.registered = null; this.player.replaceClips(clips); this.idle();
    }
    play(action: MotionName, options: PlayOptions = {}): Promise<boolean> { this.register(action); return this.player.play(action, options); }
    idle(): void { this.register('stand_idle'); this.player.show('stand_idle'); }
    meditate(): void { this.register('meditate_idle'); this.player.show('meditate_idle', 0, 0.1); }
    fishRest(): void { this.register('wooden_fish'); this.player.show('wooden_fish', 0, 0.1); }
    private register(action: MotionName): void {
        if (action === this.registered) return;
        this.registered = action;
        const r = registration(this.profile, action);
        this.visual.setScale(r.scale, r.scale, 1);
        this.visual.setPosition(r.x, r.y);
    }
    home(): void { this.root.setPosition(this.homePosition); }
    strike(contact: () => void): boolean {
        if (this.player.playing) return false;
        void this.play('wooden_fish', { startFrame: 3, loop: false, transition: 0,
            onEvent: name => { if (name === 'wooden_fish_contact') contact(); } }); return true;
    }
    autoFish(interval: number, contact: () => void): void {
        const duration = this.player.clips.wooden_fish.durations.reduce((a, b) => a + b, 0);
        void this.play('wooden_fish', { loop: true, gap: Math.max(0, interval - duration),
            onEvent: name => { if (name === 'wooden_fish_contact') contact(); } });
    }
    update(dt: number): void { this.register(this.player.action); this.player.update(dt); }
    breathe(time: number): void {
        // Ring + tiny opacity breathing: never scale/move the whole person or feet.
        if (this.action === 'meditate_idle') this.opacity.opacity = 253 + Math.round(Math.sin(time * Math.PI / 3) * 2);
    }
    /** Source pixels (top-left origin) -> explicit common UI coordinate space. */
    pointIn(space: Node, x: number, y: number): Vec3 {
        const world = this.visual.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(x - 256, 704 - y));
        return space.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    }
    pointInParent(x: number, y: number): Vec3 { return this.pointIn(this.root.parent!, x, y); }
    /** Calibrate a future action without borrowing the currently displayed idle registration. */
    pointForAction(space: Node, action: MotionName, x: number, y: number): Vec3 {
        const r = registration(this.profile, action);
        const local = new Vec3((x - 256) * r.scale + r.x, (704 - y) * r.scale + r.y);
        const world = this.root.getComponent(UITransform)!.convertToWorldSpaceAR(local);
        return space.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    }
    snapshot(): object {
        const f = this.sprite.spriteFrame!, ui = this.visual.getComponent(UITransform)!;
        const drivers = []; let current: Node | null = this.visual;
        while (current) {
            drivers.push({ node: current.name, position: current.position.clone(), scale: current.scale.clone(),
                components: current.getComponents(Component).map(c => c.constructor.name),
                tweens: Tween.getRunningCount(current) });
            current = current.parent;
        }
        return { parent: this.root.parent?.name, position: this.root.position.clone(), scale: this.root.scale.clone(),
            visual: { parent: this.visual.parent?.name, position: this.visual.position.clone(), scale: this.visual.scale.clone(),
                width: ui.width, height: ui.height, anchor: ui.anchorPoint, frame: f.name,
                originalSize: f.originalSize, rect: f.rect, offset: f.offset, sizeMode: this.sprite.sizeMode, trim: this.sprite.trim },
            drivers };
    }
    stop(): void { this.player.stop(); Tween.stopAllByTarget(this.root); Tween.stopAllByTarget(this.visual); }
}
