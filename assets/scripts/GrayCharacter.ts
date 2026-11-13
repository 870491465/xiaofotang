import { Node, tween, Tween, Vec3 } from 'cc';
import { node, shape, PALETTE as P } from './GrayUI';
import { CONFIG } from './CourtyardConfig';

export interface Pose { hip: number; lean: number; handX: number; handY: number; together: number; seated: number; strike: number; }
export interface CharacterAnimator {
    readonly root: Node;
    readonly action: string;
    poseTo(name: string, duration: number, pose: Partial<Pose>): Promise<void>;
    idle(): void; prepareIncense(): void; breathe(time: number): void; holdIncense(incense: Node): void;
    setMeditating?(value: boolean): void;
    releaseIncense(parent: Node): void; setMallet(visible: boolean): void;
    strike(contact: () => void): boolean; stop(): void;
}
const standing = (): Pose => ({ hip: 160, lean: 0, handX: 65, handY: 50, together: 0, seated: 0, strike: 0 });

/** Replace this adapter with a SpriteFrame animator; gameplay never accesses its joints. */
export class GrayCharacter implements CharacterAnimator {
    readonly root: Node;
    action = '站立待机';
    private body: Node; private head: Node; private hands: Node;
    private arms: { shoulder: Node; elbow: Node; hand: Node; side: number }[] = [];
    private legs: Node[] = []; private folded: Node;
    private mallet: Node; private incense: Node | null = null;
    private pose = standing(); private strikeClock = { value: 0 }; private hitting = false;
    private resolvePose: (() => void) | null = null;
    constructor(parent: Node, x: number, y: number) {
        this.root = node(parent, '人物_动画适配器', x, y);
        for (const side of [-1, 1]) {
            const leg = node(this.root, '髋关节_腿', side * 28, 160);
            shape(leg, '腿', 0, -70, 40, 140, P.wood);
            shape(this.root, '固定脚掌', side * 32, 10, 65, 23, P.ink); this.legs.push(leg);
        }
        this.folded = shape(this.root, '盘腿', 0, 28, 200, 58, P.robe, true); this.folded.active = false;
        this.body = node(this.root, '髋部_上身枢轴', 0, 160);
        shape(this.body, '躯干', 0, 78, 115, 165, P.robe);
        this.head = shape(this.body, '头', 0, 210, 88, 100, P.skin, true);
        shape(this.head, '发髻', -10, 38, 82, 35, P.ink, true);
        shape(this.head, '侧脸_耳', 42, -4, 16, 25, P.skin, true);
        for (const side of [-1, 1]) {
            const shoulder = node(this.body, '肩关节', side * 48, 135);
            shape(shoulder, '上臂', 0, -43, 30, 86, P.robe);
            const elbow = node(shoulder, '肘关节', 0, -86);
            shape(elbow, '前臂', 0, -43, 25, 86, P.skin);
            const hand = shape(elbow, '手掌', 0, -86, 28, 32, P.skin, true);
            this.arms.push({ shoulder, elbow, hand, side });
        }
        this.hands = node(this.body, '持香定位点');
        const grip = node(this.arms[1].hand, '木槌_握点', 0, 0);
        shape(grip, '木槌柄', 34, 0, 82, 12, P.wood);
        shape(grip, '木槌头', 76, 0, 29, 36, P.wood, true);
        this.mallet = grip; this.mallet.active = false; this.render();
    }
    private render(): void {
        const p = this.pose;
        this.body.setPosition(0, p.hip); this.body.angle = p.lean;
        this.folded.active = p.seated > 0.6;
        this.legs.forEach((leg, i) => {
            leg.active = p.seated < 0.65; leg.setPosition((i ? 1 : -1) * 28, p.hip);
            leg.angle = (i ? -1 : 1) * p.seated * 65;
        });
        this.root.children.filter(n => n.name === '固定脚掌').forEach(n => n.active = p.seated < 0.4);
        for (const arm of this.arms) {
            const s = arm.side;
            let hx = s * p.handX; let hy = p.handY;
            if (this.mallet.active && s === 1) { hx = 98; hy = 65 - p.strike * 45; }
            const dx = hx - s * 48, dy = hy - 135;
            const d = Math.min(171.9, Math.max(10, Math.hypot(dx, dy)));
            const a = Math.atan2(dy, dx) + (s < 0 ? -1 : 1) * Math.acos(d / 172);
            arm.shoulder.angle = a * 180 / Math.PI + 90;
            const ex = s * 48 + Math.cos(a) * 86, ey = 135 + Math.sin(a) * 86;
            arm.elbow.angle = Math.atan2(hy - ey, hx - ex) * 180 / Math.PI + 90 - arm.shoulder.angle;
            if (s === 1) this.mallet.angle = -arm.shoulder.angle - arm.elbow.angle;
            // Grip remains attached to the actual hand throughout a strike.
        }
        this.hands.setPosition(0, p.handY + 12);
    }
    poseTo(name: string, duration: number, target: Partial<Pose>): Promise<void> {
        this.action = name;
        return new Promise(resolve => {
            this.resolvePose = resolve;
            tween(this.pose).to(duration, target, { easing: 'sineInOut', onUpdate: () => this.render() })
                .call(() => { this.resolvePose = null; resolve(); }).start();
        });
    }
    idle(): void { this.stop(); Object.assign(this.pose, standing()); this.action = '站立待机'; this.setMallet(false); this.render(); }
    prepareIncense(): void {
        this.idle(); Object.assign(this.pose, { handX: 7, handY: 35 }); this.action = '双手持香准备'; this.render();
    }
    breathe(time: number): void {
        this.head.setPosition(0, 210 + Math.sin(time * 2 * Math.PI / CONFIG.breathPeriod) * 1.5);
    }
    holdIncense(incense: Node): void { this.incense = incense; incense.setParent(this.hands); incense.setPosition(0, 0); }
    releaseIncense(parent: Node): void {
        if (!this.incense) return;
        const world = this.incense.worldPosition.clone();
        this.incense.setParent(parent); this.incense.worldPosition = world; this.incense = null;
    }
    setMallet(visible: boolean): void { this.mallet.active = visible; if (visible) this.action = '坐姿持槌'; this.render(); }
    strike(contact: () => void): boolean {
        if (this.hitting) return false; this.hitting = true; this.action = '坐姿敲击';
        tween(this.strikeClock).to(CONFIG.strikeDown, { value: 1 }, { onUpdate: () => { this.pose.strike = this.strikeClock.value; this.render(); } })
            .call(contact).to(CONFIG.strikeUp, { value: 0 }, { easing: 'quadOut', onUpdate: () => { this.pose.strike = this.strikeClock.value; this.render(); } })
            .call(() => { this.hitting = false; this.action = '坐姿持槌'; }).start(); return true;
    }
    stop(): void {
        Tween.stopAllByTarget(this.pose); Tween.stopAllByTarget(this.strikeClock);
        this.resolvePose?.(); this.resolvePose = null; this.hitting = false;
        this.strikeClock.value = 0; this.pose.strike = 0; this.head.setPosition(new Vec3(0, 210)); this.render();
    }
}
