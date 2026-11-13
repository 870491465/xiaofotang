import { _decorator, AudioClip, AudioSource, BlockInputEvents, Button, Canvas, Color, Component, Game, Graphics, JsonAsset, Label, Mask, Node, ResolutionPolicy, SpriteFrame, Tween, UIOpacity, UITransform, Vec3, assetManager, game, sys, tween, view } from 'cc';
import { CONFIG, PlayState } from './CourtyardConfig';
import { button, enable, node, PALETTE as P, shape, text } from './GrayUI';
import { ArtCharacter } from './ArtCharacter';
import { QuietArt, ArtIncense, ArtNavButton, ArtWoodfish } from './QuietArt';
import { MotionClip, MotionName, motionClips } from './MotionPlayer';
import { CHARACTER_STORAGE, CharacterId, HomeView } from './HomeView';
import { CharacterProfile, FEMALE_PROFILE, MALE_PROFILE } from './CharacterProfile';
const { ccclass, property } = _decorator;

@ccclass('Courtyard')
export class Courtyard extends Component {
    @property(AudioClip) woodfishClip: AudioClip | null = null;
    @property(AudioClip) chimeClip: AudioClip | null = null;
    @property(AudioClip) incenseClip: AudioClip | null = null;
    @property(AudioClip) ambienceClip: AudioClip | null = null;
    @property([SpriteFrame]) artwork: SpriteFrame[] = [];
    @property([SpriteFrame]) motionFrames: SpriteFrame[] = [];
    @property(JsonAsset) motionManifest: JsonAsset | null = null;
    @property([SpriteFrame]) homeArtwork: SpriteFrame[] = [];
    @property(JsonAsset) homeLayout: JsonAsset | null = null;
    @property([SpriteFrame]) maleMotionFrames: SpriteFrame[] = [];
    @property(JsonAsset) maleMotionManifest: JsonAsset | null = null;
    selectedCharacter: CharacterId = 'male';
    private home: HomeView | null = null; private navigationEpoch = 0; private loadingCharacter = false;
    private characterProfile: CharacterProfile = FEMALE_PROFILE;
    state = PlayState.Idle;
    private world!: Node; private ui!: Node; private modal!: Node; private closeView!: Node;
    private actor!: ArtCharacter; private closeActor!: ArtCharacter; private clips!: Record<MotionName, MotionClip>;
    private audio!: AudioSource; private ceremony!: AudioSource; private ambience!: AudioSource;
    private nav: Button[] = []; private modalButtons: Button[] = []; private closeButtons: Button[] = [];
    private status!: Label; private debug!: Node; private debugLabel!: Label; private toast!: Label;
    private fish!: Node; private fishHit!: Button; private ring!: Graphics; private breath!: Graphics;
    private mainSticks!: Node; private closeSticks!: Node; private smokeMain!: Graphics; private smokeClose!: Graphics;
    private flames: Node[] = [];
    private meritPool: { root: Node; opacity: UIOpacity }[] = []; private meritCursor = 0;
    private busy = false; private seated = false; private epoch = 0;
    private meditationElapsed = 0; private meditating = false;
    private lastClock = Date.now(); private burnUntil = 0; private auto = false; private backgrounded = false;
    private interval = CONFIG.autoInterval; private speed = 1; private phase = 0; private rippleAge = 99;
    private sound = true; private ambient = true; private lastEvent = '准备好了'; private lastSound = '尚无音效事件';
    private safeTop = 80; private safeBottom = 100;
    private art!: QuietArt; private overlay!: Node; private toolbar!: Node; private titlePlate!: Node;
    private artNav: ArtNavButton[] = []; private selectedEntry = -1;
    private incense!: ArtIncense; private closeIncense!: ArtIncense; private woodfish!: ArtWoodfish;
    private stateLabel!: Label; private timerLabel!: Label; private statusPlate!: Node; private bell!: Node;
    private debugPreview = false; private debugAction = 0; private showBaseline = false; private showContact = false;
    private malletContact!: Node; private fishHitPoint!: Node;
    private mainGuides!: Graphics; private closeGuides!: Graphics; private inserts = 0; private offering = false;
    private readonly debugActions: MotionName[] = ['stand_idle', 'pray', 'incense', 'sit_down', 'meditate_idle', 'stand_up', 'wooden_fish'];

    onLoad(): void {
        view.setDesignResolutionSize(1080, 1920, ResolutionPolicy.FIXED_WIDTH);
        this.art = new QuietArt(this.artwork);
        if (!this.motionManifest) throw new Error('缺少人物 animation_manifest 绑定');
        this.clips = motionClips(this.motionManifest.json, this.motionFrames);
        const canvas = this.node.getComponent(Canvas)!;
        // Art composition and safe-area UI use separate roots.
        canvas.node.getComponent(UITransform)!.setContentSize(1080, 1920);
        this.audio = node(this.node, '音效').addComponent(AudioSource);
        this.ceremony = node(this.node, '礼拜与插香音效').addComponent(AudioSource);
        this.ambience = node(this.node, '环境音').addComponent(AudioSource); this.ambience.loop = true; this.ambience.volume = 0.22;
        this.world = node(this.node, 'SceneRoot'); this.drawCourtyard();
        this.makeFish();
        this.actor = new ArtCharacter(this.world, this.clips);
        const contact = CONFIG.woodenFishContact;
        this.malletContact = node(this.actor.visual, 'MalletContact', contact.malletX - 256, 704 - contact.malletY);
        this.fishHitPoint = node(this.fish, 'FishHitPoint', (contact.fishX - 317 / 2) * 205 / 317, (263 / 2 - contact.fishY) * 205 / 317);
        this.placeWoodfish();
        this.mainGuides = node(this.world, '动作校准辅助_默认关闭').addComponent(Graphics);
        this.ui = node(this.node, 'UIRoot'); this.overlay = node(this.node, 'OverlayRoot');
        this.titlePlate = this.art.sprite(this.ui, 'title_plate', 0, 0, 520);
        this.titlePlate.name = 'TitlePlate';
        const titleLabel = text(this.titlePlate, '小院静一静', 0, -32, 45, 370); titleLabel.isBold = true; titleLabel.node.name = 'TitleLabel';
        const settingsButton = this.art.sprite(this.ui, 'settings_button', 0, 0, 124); settingsButton.name = '设置入口';
        settingsButton.addComponent(Button); settingsButton.on(Button.EventType.CLICK, () => this.settings());
        this.statusPlate = this.art.sprite(this.ui, 'status_plate', 115, -130, 250);
        this.statusPlate.name = 'StatusPanel';
        this.stateLabel = text(this.statusPlate, '站立待机', 0, 20, 30, 220, 50);
        this.stateLabel.isBold = true;
        this.timerLabel = text(this.statusPlate, '未计时', 0, -25, 27, 220, 45);
        this.status = text(this.ui, '风轻轻，心慢慢', 0, -580, 30);
        this.toast = text(this.ui, '', 0, -670, 34); this.toast.node.addComponent(UIOpacity);
        this.toolbar = node(this.ui, 'BottomToolbar'); this.art.sprite(this.toolbar, 'toolbar_plate', 0, 0, 1040);
        const icons = ['icon_incense', 'icon_pray', 'icon_meditate', 'icon_wooden_fish'] as const;
        ['烧香', '拜佛', '打坐', '敲木鱼'].forEach((title, i) => {
            const slot = i === 0 ? 1 : i === 1 ? 0 : i;
            const entry = new ArtNavButton(this.toolbar, this.art, title, icons[i], -348 + slot * 232, () => void this.enter(i));
            this.artNav.push(entry); this.nav.push(entry.button);
        });
        const debugToggle = text(this.ui, '调试', 0, 0, 22, 96, 48).node;
        debugToggle.name = '调试入口'; debugToggle.addComponent(Button); debugToggle.addComponent(UIOpacity).opacity = 160;
        debugToggle.on(Button.EventType.CLICK, () => this.toggleDebug());
        this.modal = node(this.overlay, 'ExistingGameplayPanels');
        this.closeView = node(this.overlay, '上香近景'); this.makeCloseView(); this.closeView.active = false;
        this.debug = node(this.overlay, 'DebugPanel'); this.makeDebug(); this.debug.active = false;
        if (this.homeArtwork.length) {
            if (!this.homeLayout) throw new Error('首页缺少 layout_reference 绑定');
            try { this.selectedCharacter = sys.localStorage.getItem(CHARACTER_STORAGE) === 'female' ? 'female' : 'male'; } catch { this.selectedCharacter = 'male'; }
            this.home = new HomeView(this.node, this.homeArtwork, this.homeLayout.json, this.selectedCharacter,
                id => this.selectCharacter(id), () => void this.enterTemple(), () => this.settings());
            // Settings overlays must remain above HomeRoot. Existing courtyard layers stay intact.
            this.home.root.setSiblingIndex(this.node.children.indexOf(this.overlay));
            const back = button(this.ui, '首页', 0, 0, 150, () => this.returnHome()); back.node.name = 'HomeButton';
            this.returnHome();
        }
        this.resize(); view.on('canvas-resize', this.resize, this);
        game.on(Game.EVENT_HIDE, this.onHide, this); game.on(Game.EVENT_SHOW, this.onShow, this);
        this.syncAmbience(); this.refresh();
    }
    private resize(): void {
        // getSafeAreaRect already returns UI coordinates in 3.8.8, not screen pixels.
        const safe = sys.getSafeAreaRect(false); const visible = view.getVisibleSize();
        this.safeTop = Math.max(24, visible.height - safe.y - safe.height + 16);
        this.safeBottom = Math.max(24, safe.y + 16);
        const halfW = visible.width / 2, halfH = visible.height / 2;
        const leftInset = Math.max(16, safe.x + 16);
        const rightInset = Math.max(16, visible.width - safe.x - safe.width + 16);
        const uiScale = Math.min(1, (visible.width - leftInset - rightInset) / 1040);
        this.titlePlate.setScale(uiScale, uiScale, 1);
        this.titlePlate.setPosition(-halfW + leftInset + 260 * uiScale, halfH - this.safeTop - 100 * uiScale);
        this.ui.getChildByName('设置入口')!.setPosition(halfW - rightInset - 62 * uiScale, halfH - this.safeTop - 70 * uiScale);
        this.ui.getChildByName('设置入口')!.setScale(uiScale, uiScale, 1);
        this.ui.getChildByName('调试入口')!.setPosition(-halfW + leftInset + 44, halfH - this.safeTop - 230 * uiScale);
        const toolbarHeight = 1040 * 255 / 840 * uiScale;
        const toolbarY = -halfH + this.safeBottom + toolbarHeight / 2;
        this.toolbar.setScale(uiScale, uiScale, 1); this.toolbar.setPosition((leftInset - rightInset) / 2, toolbarY);
        const toolbarTop = toolbarY + toolbarHeight / 2;
        this.modal.setPosition(0, toolbarTop + 840);
        this.status.node.setPosition(0, toolbarTop + 245); this.toast.node.setPosition(0, toolbarTop + 245);
        const sceneScale = visible.width > visible.height ? Math.min(1, visible.height / 1920) : Math.max(visible.width / 1080, visible.height / 1920);
        this.world.setScale(sceneScale, sceneScale, 1);
        const cover = Math.max(visible.width / 1080, visible.height / (1080 * 1672 / 941));
        this.world.getChildByName('Background')!.setScale(cover / sceneScale, cover / sceneScale, 1);
        this.statusPlate.setPosition(115 * sceneScale, -130 * sceneScale);
        const closeScale = Math.min(1, visible.width / 1080, visible.height / 1920);
        this.closeView.setScale(closeScale, closeScale, 1);
        this.closeView.getChildByName('近景底色')!.setScale(visible.width / (1080 * closeScale), visible.height / (1920 * closeScale), 1);
        // Keep the control panel above the contact markers instead of covering them.
        const debugScale = Math.min(0.7, (visible.height - 80) / 1050, (visible.width - 48) / 1000);
        this.debug.setScale(debugScale, debugScale, 1);
        this.debug.setPosition(halfW - 500 * debugScale - 24, halfH - 600 * debugScale - 24);
        this.ui.getChildByName('HomeButton')?.setPosition(halfW - rightInset - 95, halfH - this.safeTop - 210);
        this.home?.resize();
    }
    private selectCharacter(id: CharacterId): void {
        if (id !== 'male' && id !== 'female') return;
        this.selectedCharacter = id;
        try { sys.localStorage.setItem(CHARACTER_STORAGE, id); } catch { console.warn('角色选择无法写入本地存储'); }
    }
    private async prepareCharacter(id: CharacterId): Promise<Record<MotionName, MotionClip>> {
        const frames = id === 'female' ? this.motionFrames : this.maleMotionFrames;
        const manifest = id === 'female' ? this.motionManifest : this.maleMotionManifest;
        if (!manifest || frames.length !== 42 || frames.some(f => !f)) {
            throw new Error(id === 'male' ? '缺少男角色完整动作包，请选择女角色或补充素材' : '女角色动作资源不完整，请检查绑定');
        }
        const clips = motionClips(manifest.json, frames, id === 'female');
        for (const name of this.debugActions) if (!clips[name]?.frames.length) throw new Error(`角色动作缺失：${name}`);
        // All seven actions must be ready before hiding home, never fall back to the other gender.
        await new Promise<void>((resolve, reject) => {
            assetManager.loadAny(frames.map(frame => ({ uuid: frame.uuid })), (error: Error | null) => error ? reject(error) : resolve());
        });
        return clips;
    }
    private async enterTemple(): Promise<void> {
        if (!this.home?.root.active || this.loadingCharacter) return;
        const token = ++this.navigationEpoch, id = this.selectedCharacter;
        this.loadingCharacter = true; this.home.message.string = ''; this.home.setLoading(true);
        try {
            const clips = await this.prepareCharacter(id);
            if (token !== this.navigationEpoch || !this.home.root.active) return;
            this.reset(); this.debug.active = false;
            this.characterProfile = id === 'male' ? MALE_PROFILE : FEMALE_PROFILE;
            this.clips = clips; this.actor.useClips(clips, this.characterProfile); this.closeActor.useClips(clips, this.characterProfile);
            this.applyCharacterLayout();
            this.home.root.active = false; this.world.active = true; this.ui.active = true;
            this.lastClock = Date.now(); this.event(`${id === 'male' ? '男' : '女'}角色进入佛堂`);
        } catch (error) {
            if (token !== this.navigationEpoch) return;
            this.home.message.string = error instanceof Error ? error.message : '动作加载失败，请重试';
            console.warn('[首页角色加载]', error);
        } finally {
            if (token === this.navigationEpoch) { this.loadingCharacter = false; this.home.setLoading(false); }
        }
    }
    private returnHome(): void {
        if (!this.home) return;
        ++this.navigationEpoch; this.loadingCharacter = false;
        this.reset(); this.debug.active = false;
        const settings = this.overlay.getChildByName('SettingsPanel');
        if (settings) { settings.active = false; settings.destroy(); }
        this.world.active = false; this.ui.active = false; this.closeView.active = false;
        this.home.select(this.selectedCharacter); this.home.setLoading(false); this.home.root.active = true;
    }
    private applyCharacterLayout(): void {
        const p = this.characterProfile, c = p.fish;
        this.malletContact.setPosition(c.malletX - 256, 704 - c.malletY);
        this.fishHitPoint.setPosition((c.fishX - 317 / 2) * 205 / 317, (263 / 2 - c.fishY) * 205 / 317);
        this.placeWoodfish();
        const cushion = this.world.getChildByName('StrawCushion')!, width = cushion.getComponent(UITransform)!.width;
        const seat = this.actor.pointForAction(this.world, 'meditate_idle', p.seat.x, p.seat.y);
        cushion.setPosition(seat.x, seat.y - (206 / 2 - 72) * width / 346);
        const hand = this.closeActor.pointForAction(this.closeView, 'incense', p.incense.x, p.incense.y);
        this.closeIncense.root.setPosition(hand.x, hand.y + 7.2 - this.closeIncense.mouthY);
    }
    private drawCourtyard(): void {
        this.art.sprite(this.world, 'temple_background', 0, 0, 1080).name = 'Background';
        // Coordinates are converted from the 941x1672 reference around its center.
        this.incense = new ArtIncense(this.world, this.art, 4, 120, 238);
        this.mainSticks = this.incense.group;
        this.mainSticks.setScale(0.52, 0.52, 1); this.mainSticks.setPosition(0, -8);
        this.smokeMain = node(this.world, '主院细烟', 4, 120 + this.incense.mouthY - 18 + 142).addComponent(Graphics);
        for (const x of [-225, 233]) {
            const holder = this.art.sprite(this.world, 'candle_holder', x, 178, 85);
            holder.name = x < 0 ? 'CandleLeft' : 'CandleRight';
            const flame = this.art.sprite(holder, 'flame', 0, 50, 26, undefined, 0.5, 0);
            flame.name = 'Flame';
            flame.addComponent(UIOpacity).opacity = 230; this.flames.push(flame);
        }
        this.bell = node(this.world, 'WindBell_顶部轴', -348, 816);
        this.art.sprite(this.bell, 'wind_bell', 0, 0, 105, undefined, 0.5, 1);
        // Align to the robe/hip contact center x238, not the 512px canvas center or the knees.
        // Seat center is the hip contact patch y686, not the lowest outline/sole baseline y704.
        // Cushion's concentric seat center is source=(173,72).
        const cushionWidth = 390;
        this.art.sprite(this.world, 'cushion_straw', -135 + (238 - 256) * 1.1,
            -470 + (704 - 686) * 1.1 - (206 / 2 - 72) * cushionWidth / 346, cushionWidth).name = 'StrawCushion';
        this.breath = node(this.world, '呼吸圆环', -135, -250).addComponent(Graphics);
    }
    private makeFish(): void {
        this.woodfish = new ArtWoodfish(this.world, this.art, () => {
            if (this.state === PlayState.Fish && !this.busy && !this.auto) this.hit();
        });
        this.fish = this.woodfish.fish; this.fishHit = this.woodfish.hit; this.ring = this.woodfish.ring;
    }
    private makeCloseView(): void {
        shape(this.closeView, '近景底色', 0, 0, 1080, 1920, P.cream).addComponent(BlockInputEvents);
        text(this.closeView, '拈香 · 静心', 0, 780, 45);
        text(this.closeView, '双手持香，慢慢完成一次仪式', 0, 680, 28);
        const upperBody = node(this.closeView, 'UpperBodyClip_桌面遮住下身', 0, 0, 1080, 1100);
        upperBody.getComponent(UITransform)!.setAnchorPoint(0.5, 45 / 1100);
        upperBody.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
        this.closeActor = new ArtCharacter(upperBody, this.clips, -180, -500, 1.35);
        shape(this.closeView, '近景供桌', 0, -135, 1050, 180, P.wood);
        const hand = this.closeActor.pointForAction(this.closeView, 'incense', 385, 280);
        this.closeIncense = new ArtIncense(this.closeView, this.art, hand.x, 0, 300);
        this.closeIncense.root.setPosition(hand.x, hand.y + 7.2 - this.closeIncense.mouthY);
        this.closeSticks = this.closeIncense.group; this.closeSticks.active = false;
        this.closeSticks.setScale(0.64, 0.64, 1); this.closeSticks.setPosition(0, -10);
        this.smokeClose = node(this.closeView, '近景细烟', hand.x, hand.y + 82).addComponent(Graphics);
        this.closeGuides = node(this.closeView, '插香校准辅助_默认关闭').addComponent(Graphics);
        button(this.closeView, '调试', 410, 800, 150, () => this.toggleDebug());
        this.closeButtons.push(button(this.closeView, '上香', 120, -700, 300, () => void this.enter(0)));
        this.closeButtons.push(button(this.closeView, '返回', -260, -700, 220, () => void this.enter(-1)));
        text(this.closeView, '持香动作 · 每次三支香 · 本序列不含取香过程', 0, -815, 24);
    }
    private event(value: string): void { this.lastEvent = value; console.info('[小院动作]', value); }
    private playSound(kind: 'woodfish' | 'chime' | 'incense'): void {
        const clip = kind === 'woodfish' ? this.woodfishClip : kind === 'incense' ? this.incenseClip : this.chimeClip;
        this.lastSound = `${kind} 接触事件${this.sound ? (clip ? ' · 播放' : ' · 未接入音频') : ' · 已静音'}`;
        console.info('[小院音效]', this.lastSound);
        if (this.sound && clip) {
            const source = kind === 'woodfish' ? this.audio : this.ceremony;
            source.stop(); source.clip = clip; source.loop = false; source.volume = 0.65; source.play();
        }
    }
    private syncAmbience(): void {
        this.ambience.stop();
        if (this.ambient && this.ambienceClip) { this.ambience.clip = this.ambienceClip; this.ambience.play(); }
    }
    private lock(state: PlayState): number { this.busy = true; this.state = state; this.refresh(); return ++this.epoch; }
    private refresh(): void {
        this.artNav.forEach((b, i) => b.setState(!this.busy, this.state !== PlayState.Idle && this.selectedEntry === i));
        this.modalButtons.forEach(b => enable(b, !this.busy));
        this.closeButtons.forEach(b => enable(b, !this.busy));
        this.fishHit.interactable = this.state === PlayState.Fish && !this.busy;
        this.woodfish.focus.opacity = this.state === PlayState.Fish ? 120 : 0;
    }
    private clearControls(): void {
        this.modal.children.slice().forEach(child => { child.active = false; child.destroy(); }); this.modalButtons = [];
        Tween.stopAllByTarget(this.toast.node.getComponent(UIOpacity)!); this.toast.string = '';
    }
    private showMerit(kind: 'pray' | 'incense' | 'fish'): void {
        if (this.debugPreview) return;
        // Reuse three labels: rapid/manual/automatic hits can never leave an unbounded queue.
        if (!this.meritPool.length) {
            const layer = node(this.ui, 'MeritFeedback');
            for (let i = 0; i < CONFIG.meritFeedback.poolSize; i++) {
                const root = node(layer, `Merit_${i}`, 0, 0, 240, 64);
                const shadow = text(root, '功德+1', 1, -2, 40, 240, 64);
                shadow.isBold = true; shadow.color = new Color(255, 244, 206, 240);
                const label = text(root, '功德+1', 0, 0, 40, 240, 64);
                label.isBold = true; label.color = new Color(143, 94, 36, 255);
                const opacity = root.addComponent(UIOpacity); root.active = false;
                this.meritPool.push({ root, opacity });
            }
        }
        const effect = this.meritPool[this.meritCursor++ % this.meritPool.length];
        Tween.stopAllByTarget(effect.root); Tween.stopAllByTarget(effect.opacity);
        let at: Vec3;
        if (kind === 'fish') {
            at = this.inSpace(this.ui, this.fishHitPoint); at.x += 70; at.y += 90;
        } else if (kind === 'incense') {
            const world = this.incense.root.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(0, 185));
            at = this.ui.getComponent(UITransform)!.convertToNodeSpaceAR(world);
        } else at = this.actor.pointForAction(this.ui, 'stand_idle', 256, 35);
        effect.root.setPosition(at); effect.root.setScale(0.92, 0.92, 1);
        effect.opacity.opacity = 255; effect.root.active = true;
        const cfg = CONFIG.meritFeedback;
        tween(effect.root).to(0.16, { position: new Vec3(at.x, at.y + 14), scale: Vec3.ONE }, { easing: 'sineOut' })
            .to(cfg.duration - 0.16, { position: new Vec3(at.x, at.y + cfg.rise) }, { easing: 'sineOut' })
            .call(() => { effect.root.active = false; }).start();
        tween(effect.opacity).delay(0.35).to(cfg.duration - 0.35, { opacity: 0 }).start();
    }
    private clearMerit(): void {
        for (const effect of this.meritPool) {
            Tween.stopAllByTarget(effect.root); Tween.stopAllByTarget(effect.opacity); effect.root.active = false;
        }
    }
    /** A single transition gate owns all finite animations. No input queues. */
    async enter(which: number): Promise<void> {
        if (this.home?.root.active || this.busy || (which === 2 && this.meditating)) return;
        this.logPose(`before enter ${which}`);
        this.selectedEntry = which;
        const previous = this.state; const token = this.lock(PlayState.Transition);
        this.clearMerit();
        this.tickClock();
        this.auto = false; this.meditating = false; this.meditationElapsed = 0; this.offering = false;
        this.actor.stop(); this.closeActor.stop(); this.clearControls(); this.ring.clear(); this.breath.clear();
        this.audio.stop(); this.ceremony.stop();
        Tween.stopAllByTarget(this.mainSticks); this.mainSticks.angle = 0; this.mainSticks.active = true;
        this.configureWoodfish(false);
        this.rippleAge = 99; Tween.stopAllByTarget(this.fish); this.fish.setScale(1, 1, 1);
        this.closeView.active = false; this.world.active = true; this.ui.active = true;
        if (this.seated && which !== 2 && which !== 3) {
            this.event('起身（坐下倒放原型）'); const done = await this.actor.play('stand_up', { loop: false });
            if (!done || token !== this.epoch) return; this.seated = false;
        }
        if (!this.seated) this.actor.idle();
        this.actor.home();
        this.incense.root.setSiblingIndex(1);
        if (which === 0) {
            this.state = PlayState.Incense;
            // One altar standing position, calibrated once before playback; same scene/Sprite.
            this.alignIncensePose();
            this.modalButtons.push(button(this.modal, '返回蒲团', 410, -685, 220, () => void this.enter(-1)));
            this.event('到供桌站位，自动上香');
            const done = await this.offer(token);
            if (!done || token !== this.epoch || this.state !== PlayState.Incense) return;
        } else if (which === 1) {
            this.state = PlayState.Bow; this.status.string = '合掌，缓缓礼拜'; this.event('pray 单次播放');
            const done = await this.actor.play('pray', { loop: false });
            if (!done || token !== this.epoch) return;
            this.playSound('chime'); this.event('礼拜完成'); this.actor.idle(); this.showMerit('pray'); this.state = PlayState.Idle;
        } else if (which === 2) {
            if (!this.seated) {
                this.event('坐下打坐'); const done = await this.actor.play('sit_down', { loop: false });
                if (!done || token !== this.epoch || this.state !== PlayState.Transition) return;
            }
            this.seated = true; this.actor.meditate(); this.state = PlayState.Meditation;
            this.meditating = true; this.meditationElapsed = 0; this.lastClock = Date.now();
            this.event('开始正向计时，点击其他玩法结束打坐');
        } else if (which === 3) {
            if (!this.seated) {
                this.event('sit_down → 持槌'); const done = await this.actor.play('sit_down', { loop: false });
                if (!done || token !== this.epoch) return;
            }
            this.seated = true; this.actor.fishRest(); this.configureWoodfish(true); this.state = PlayState.Fish; this.fishControls();
        } else { this.state = PlayState.Idle; this.event(previous === PlayState.Incense ? '返回院落，燃香继续' : '回到待机'); }
        this.busy = false; this.refresh(); this.logPose(`after enter ${which}`);
        if (this.state === PlayState.Idle) this.status.string = '风轻轻，心慢慢';
    }
    private fishControls(): void {
        this.clearControls(); this.status.string = '轻点木鱼，随动作落槌';
        const modeButton = button(this.modal, this.auto ? '自动 · 切为手动' : '手动 · 切为自动', 410, -585, 220, () => {
            this.auto = !this.auto;
            if (this.auto) this.actor.autoFish(this.interval, () => this.fishContact());
            else this.actor.fishRest();
            this.fishControls(); this.refresh();
        });
        const modeLabel = modeButton.node.getChildByName('Title')!.getComponent(Label)!;
        modeLabel.fontSize = 24; modeLabel.lineHeight = 32; modeLabel.overflow = Label.Overflow.SHRINK; modeLabel.enableWrapText = false;
        this.modalButtons.push(modeButton);
        this.modalButtons.push(button(this.modal, '起身', 410, -685, 220, () => void this.enter(-1)));
    }
    private hit(): void {
        if (this.state !== PlayState.Fish || this.busy) return;
        this.actor.strike(() => this.fishContact());
    }
    private fishContact(): void {
        if (this.state !== PlayState.Fish || this.busy || this.debugPreview) return;
        this.playSound('woodfish'); this.event('wooden_fish_contact · 第5帧'); this.rippleAge = 0;
        this.showMerit('fish');
        Tween.stopAllByTarget(this.fish);
        // A one-pixel tap response; size and scale never change.
        tween(this.fish).to(0.035, { position: new Vec3(0, 89, 0) }).to(0.06, { position: new Vec3(0, 90, 0) }).start();
    }
    private configureWoodfish(active: boolean): void {
        this.woodfish.stop(); this.woodfish.pivot.active = !active;
    }
    private logPose(label: string): void {
        console.info('[CharacterTransform]', label, JSON.stringify({ main: this.actor.snapshot(), close: this.closeActor.snapshot(),
            scenePosition: this.world.position, sceneScale: this.world.scale, state: this.state }));
    }
    private inSpace(space: Node, point: Node): Vec3 {
        return space.getComponent(UITransform)!.convertToNodeSpaceAR(point.worldPosition);
    }
    private placeWoodfish(): void {
        // Frame5 lower-right head edge touches the fish's upper-left slope; whole group moves together.
        // Both are transformed into SceneRoot space, with no change to the character or frame timing.
        this.woodfish.root.setScale(0.72, 0.72, 1);
        const contact = this.characterProfile.fish;
        const hand = this.actor.pointForAction(this.world, 'wooden_fish', contact.malletX, contact.malletY);
        const fish = this.inSpace(this.world, this.fishHitPoint), origin = this.woodfish.root.position;
        this.woodfish.root.setPosition(origin.x + hand.x - fish.x, origin.y + hand.y - fish.y);
    }
    private alignIncensePose(): void {
        // Frame5 incense lower endpoint is source (385,280). Use SceneRoot coordinates for both.
        // Keep this standing position throughout the ritual; never chase the burner per frame.
        const point = this.characterProfile.incense;
        const hand = this.actor.pointForAction(this.world, 'incense', point.x, point.y);
        const target = this.incense.root.getComponent(UITransform)!.convertToWorldSpaceAR(new Vec3(0, this.incense.mouthY - 7.2));
        const mouth = this.world.getComponent(UITransform)!.convertToNodeSpaceAR(target);
        const base = this.actor.root.position;
        this.actor.root.setPosition(base.x + mouth.x - hand.x, base.y + mouth.y - hand.y);
    }
    private async offer(token: number): Promise<boolean> {
        if (token !== this.epoch || this.state !== PlayState.Incense) return false;
        this.inserts = 0; this.offering = true; this.refresh();
        this.mainSticks.active = false; Tween.stopAllByTarget(this.mainSticks);
        this.mainSticks.angle = -25;
        const done = await this.actor.play('incense', { loop: false, onEvent: name => {
            if (token !== this.epoch || this.state !== PlayState.Incense || name !== 'insert_incense' || this.inserts !== 0) return;
            ++this.inserts; this.mainSticks.active = true; ArtIncense.lit(this.mainSticks, true);
            this.burnUntil = Date.now() + CONFIG.incenseLifetime * 1000;
            this.event('insert_incense · 第5→6帧 · 本次1次');
            this.playSound('incense');
            tween(this.mainSticks).to(0.18, { angle: 0 }, { easing: 'sineOut' }).start();
        } });
        if (!done || token !== this.epoch || this.state !== PlayState.Incense) return false;
        this.actor.idle(); this.offering = false; this.incense.root.setSiblingIndex(1);
        this.showMerit('incense');
        this.event('上香完成，燃香计时'); return true;
    }
    private settings(): void {
        if (this.busy || this.loadingCharacter || this.overlay.getChildByName('SettingsPanel')) return;
        const overlay = node(this.overlay, 'SettingsPanel');
        const visible = view.getVisibleSize();
        node(overlay, '全屏输入遮罩', 0, 0, visible.width, visible.height).addComponent(BlockInputEvents);
        shape(overlay, '设置底板', 0, 0, 950, 650, P.cream).addComponent(BlockInputEvents);
        text(overlay, '留一点安静', 0, 235, 40);
        const fx = button(overlay, '', 0, 100, 540, () => {
            this.sound = !this.sound;
            if (!this.sound) { this.audio.stop(); this.ceremony.stop(); }
            update();
        });
        const bg = button(overlay, '', 0, -20, 540, () => { this.ambient = !this.ambient; this.syncAmbience(); update(); });
        const update = () => {
            fx.node.getChildByName('Title')!.getComponent(Label)!.string = `音效：${this.sound ? '开' : '关'}`;
            bg.node.getChildByName('Title')!.getComponent(Label)!.string = `环境声：${this.ambient ? '开' : '关'}`;
        }; update();
        button(overlay, this.home?.root.active ? '返回首页' : '返回小院', 0, -210, 330, () => overlay.destroy());
    }
    private makeDebug(): void {
        shape(this.debug, '调试底板', 0, 75, 1000, 1050, '#E0D7C3').addComponent(BlockInputEvents);
        this.debugLabel = text(this.debug, '', 0, 390, 24, 950, 240);
        button(this.debug, '计时 ×1 / ×20', -260, 175, 360, () => { this.tickClock(); this.speed = this.speed === 1 ? 20 : 1; });
        button(this.debug, '自动间隔', 230, 175, 350, () => {
            const options = [0.3, 0.5, 1, 1.5]; this.interval = options[(options.indexOf(this.interval) + 1) % options.length];
            if (this.auto) this.actor.player.gap = Math.max(0, this.interval - this.actor.player.duration);
        });
        button(this.debug, '重置场景', -240, 65, 320, () => this.reset());
        button(this.debug, '收起', 240, 65, 320, () => this.hideDebug());
        button(this.debug, '选择动作', -250, -55, 360, () => { this.debugAction = (this.debugAction + 1) % this.debugActions.length; this.previewMotion(); });
        button(this.debug, '播放 / 暂停', 250, -55, 320, () => {
            const target = this.debugTarget();
            if (!target.player.playing) this.previewMotion(); else target.player.paused = !target.player.paused;
        });
        button(this.debug, '上一帧', -340, -165, 220, () => this.stepMotion(-1));
        button(this.debug, '下一帧', -90, -165, 220, () => this.stepMotion(1));
        button(this.debug, '速度 0.5 / 1', 270, -165, 330, () => {
            const rate = this.debugTarget().player.speed === 1 ? 0.5 : 1;
            this.actor.player.speed = rate; this.closeActor.player.speed = rate;
        });
        button(this.debug, '人物基线', -250, -275, 360, () => { this.showBaseline = !this.showBaseline; });
        button(this.debug, '接触 / 插香点', 250, -275, 360, () => { this.showContact = !this.showContact; });
        text(this.debug, '步帧为隔离预览；插香事件见上方记录', 0, -385, 24);
    }
    private debugTarget(): ArtCharacter { return this.closeView.active ? this.closeActor : this.actor; }
    private toggleDebug(): void {
        if (this.debug.active) this.hideDebug(); else this.debug.active = true;
    }
    private hideDebug(): void {
        if (this.debugPreview) this.reset();
        else { this.actor.player.paused = false; this.closeActor.player.paused = false; }
        this.debug.active = false;
    }
    private previewMotion(): void {
        const rate = this.debugTarget().player.speed, baseline = this.showBaseline, contact = this.showContact;
        this.reset(); this.debugPreview = true; this.busy = true; this.state = PlayState.Transition;
        this.actor.player.speed = rate; this.closeActor.player.speed = rate;
        this.showBaseline = baseline; this.showContact = contact;
        const action = this.debugActions[this.debugAction];
        this.configureWoodfish(action === 'wooden_fish');
        if (action === 'incense') this.alignIncensePose();
        void this.debugTarget().play(action, { loop: action === 'wooden_fish', onEvent: name => this.event(`调试事件 ${name}`), onComplete: () => this.event(`调试 ${action} 完成`) });
        this.refresh();
    }
    private stepMotion(delta: number): void {
        if (!this.debugPreview) this.previewMotion();
        const target = this.debugTarget(); target.player.seek(target.player.frame + delta);
    }
    private reset(): void {
        this.clearMerit();
        ++this.epoch; this.actor.stop(); this.closeActor.stop(); this.actor.idle(); this.closeActor.idle();
        this.audio.stop(); this.ceremony.stop();
        this.actor.home(); this.offering = false; Tween.stopAllByTarget(this.mainSticks); this.mainSticks.angle = 0;
        this.incense.root.setSiblingIndex(1);
        this.auto = false; this.meditating = false; this.meditationElapsed = 0; this.burnUntil = 0;
        this.debugPreview = false; this.inserts = 0; this.showBaseline = false; this.showContact = false;
        this.actor.player.speed = 1; this.closeActor.player.speed = 1; this.configureWoodfish(false);
        Tween.stopAllByTarget(this.closeSticks);
        this.busy = false; this.seated = false; this.state = PlayState.Idle; this.speed = 1; this.interval = CONFIG.autoInterval;
        this.mainSticks.active = true; ArtIncense.lit(this.mainSticks, false);
        this.closeSticks.setParent(this.closeIncense.clip); this.closeSticks.active = false;
        this.smokeMain.clear(); this.smokeClose.clear(); this.ring.clear(); this.breath.clear(); this.rippleAge = 99;
        Tween.stopAllByTarget(this.fish); this.fish.setScale(1, 1, 1);
        this.world.active = true; this.ui.active = true; this.closeView.active = false;
        this.clearControls(); this.status.string = '风轻轻，心慢慢'; this.event('场景已重置'); this.refresh();
    }
    private tickClock(): void {
        const now = Date.now(); const elapsed = Math.max(0, (now - this.lastClock) / 1000); this.lastClock = now;
        if (this.meditating) this.meditationElapsed += elapsed * this.speed;
    }
    private onHide(): void { this.tickClock(); this.backgrounded = true; this.clearMerit(); this.ambience.pause(); this.audio.stop(); this.ceremony.stop(); }
    private onShow(): void { this.tickClock(); this.backgrounded = false; this.syncAmbience(); }
    update(dt: number): void {
        if (this.home?.root.active) { this.lastClock = Date.now(); return; }
        this.phase += Math.min(dt, 0.1); this.tickClock(); const now = Date.now();
        if (this.backgrounded) return;
        this.actor.update(Math.min(dt, 0.1)); this.closeActor.update(Math.min(dt, 0.1));
        // Keep the whole burner behind the hands throughout the ritual.
        // ArtIncense clips ONLY the fixed sticks below the front lip; never occlude the character.
        if (this.world.children.indexOf(this.incense.root) !== 1) this.incense.root.setSiblingIndex(1);
        this.flames.forEach((f, i) => {
            f.angle = Math.sin(this.phase * 2 + i) * 2; f.setScale(1, 1 + Math.sin(this.phase * 3 + i) * 0.035, 1);
            f.getComponent(UIOpacity)!.opacity = 222 + Math.round(Math.sin(this.phase * 2.1 + i) * 20);
        });
        this.bell.angle = Math.sin(this.phase * 0.65) * 1.2;
        const burning = this.burnUntil > now;
        this.mainSticks.active = !(this.offering && this.inserts === 0); ArtIncense.lit(this.mainSticks, burning);
        const closeLit = burning && this.closeSticks.active;
        ArtIncense.lit(this.closeSticks, closeLit);
        this.smoke(this.smokeMain, burning && this.mainSticks.active, this.mainSticks);
        this.smoke(this.smokeClose, closeLit, this.closeSticks);
        if (this.meditating) {
            this.actor.breathe(this.phase);
            this.breath.clear(); this.breath.lineWidth = 3; this.breath.strokeColor = new Color(137, 155, 128, 40);
            this.breath.circle(0, 0, 155 + Math.sin(this.phase * Math.PI * 2 / CONFIG.breathPeriod) * 7); this.breath.stroke();
        }
        this.status.node.active = this.state !== PlayState.Idle && this.state !== PlayState.Incense && this.state !== PlayState.Fish && !this.meditating;
        this.stateLabel.string = this.meditating ? '静坐中' : this.state === PlayState.Idle ? '站立待机' : this.state === PlayState.Fish ? '敲木鱼' : this.state === PlayState.Incense ? '供桌上香' : this.state === PlayState.Bow ? '合掌礼拜' : '准备中';
        const elapsedSeconds = Math.floor(this.meditationElapsed);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const elapsedTime = `${elapsedMinutes < 10 ? '0' : ''}${elapsedMinutes}:${('0' + elapsedSeconds % 60).slice(-2)}`;
        this.timerLabel.string = this.meditating ? elapsedTime : this.state === PlayState.Fish ? (this.auto ? '自动' : '手动') : this.state === PlayState.Incense ? (this.offering ? '仪式中' : this.inserts > 0 ? '上香完成' : '待上香') : '未计时';
        this.rippleAge += dt; this.ring.clear();
        if (this.rippleAge < 0.6) {
            this.ring.strokeColor = new Color(137, 155, 128, Math.round(100 * (1 - this.rippleAge / 0.6)));
            this.ring.lineWidth = 3; this.ring.ellipse(0, 0, 65 + this.rippleAge * 110, 40 + this.rippleAge * 55); this.ring.stroke();
        }
        if (this.debug.active) {
            const actor = this.debugTarget(), player = actor.player;
            this.debugLabel.string = `玩法：${this.state} ｜ 动作：${actor.action} ｜ 帧 ${player.frame + 1}/${player.frameCount}\n${player.paused ? '暂停' : player.playing ? '播放' : '停帧'} ×${player.speed} ｜ 选择：${this.debugActions[this.debugAction]}\n最近动作：${this.lastEvent}\n音效：${this.lastSound}\ninsert_incense：${this.inserts}次 ｜ 燃香 ${Math.max(0, Math.ceil((this.burnUntil - now) / 1000))}s\n打坐 ×${this.speed} ｜ 自动间隔 ${this.interval}s`;
        }
        this.drawGuides(this.mainGuides, this.actor, false); this.drawGuides(this.closeGuides, this.closeActor, true);
    }
    private drawGuides(g: Graphics, actor: ArtCharacter, close: boolean): void {
        g.clear(); if (!this.debug.active) return;
        g.lineWidth = 2;
        if (this.showBaseline) {
            g.strokeColor = new Color(74, 151, 101, 220);
            const base = actor.pointIn(g.node.parent!, 256, 704), half = 256 * actor.root.scale.x;
            g.moveTo(base.x - 12, base.y); g.lineTo(base.x + 12, base.y);
            g.moveTo(base.x, base.y - 12); g.lineTo(base.x, base.y + 12); g.stroke();
            g.moveTo(base.x - half, base.y); g.lineTo(base.x + half, base.y); g.stroke();
        }
        if (this.showContact) {
            const isIncense = close || actor.action === 'incense' || this.state === PlayState.Incense;
            const point = this.characterProfile.incense;
            const p = isIncense ? actor.pointIn(g.node.parent!, point.x, point.y) : this.inSpace(g.node.parent!, this.malletContact);
            g.strokeColor = new Color(205, 95, 54, 220); g.circle(p.x, p.y, 9); g.stroke();
            const burner = close ? this.closeIncense : this.incense;
            const target = isIncense ? new Vec3(burner.root.position.x, burner.root.position.y + burner.mouthY) :
                this.inSpace(g.node.parent!, this.fishHitPoint);
            g.strokeColor = new Color(74, 151, 101, 220); g.circle(target.x, target.y, 7); g.stroke();
            g.moveTo(p.x, p.y); g.lineTo(target.x, target.y); g.stroke();
        }
    }
    private smoke(g: Graphics, burning: boolean, sticks: Node): void {
        g.clear(); if (!burning || !g.node.activeInHierarchy) return;
        // Outside the stick Mask and above the character: never disappear behind the hands/head.
        g.node.setPosition(0, 0);
        const siblings = g.node.parent!.children;
        if (siblings.indexOf(g.node) !== siblings.length - 1) g.node.setSiblingIndex(siblings.length - 1);
        const cfg = CONFIG.incenseSmoke, space = g.node.getComponent(UITransform)!;
        const imageScale = 142 / 258; // Lit image 160x258, displayed at height142 before group scaling.
        for (const [i, sourceX] of [28, 80, 131].entries()) {
            const tipWorld = sticks.getComponent(UITransform)!.convertToWorldSpaceAR(
                new Vec3((sourceX - 80) * imageScale, (258 - 32) * imageScale));
            const tip = space.convertToNodeSpaceAR(tipWorld);
            let previous = tip;
            for (let step = 1; step <= cfg.segments; step++) {
                const t = step / cfg.segments, y = t * cfg.height;
                // Phase travels upward; the root remains attached to the glowing tip.
                const bend = Math.sin(y * 0.04 - this.phase * cfg.flow + i * 0.8) * cfg.drift * t;
                const point = new Vec3(tip.x + bend, tip.y + y);
                const fade = Math.pow(1 - (step - 0.5) / cfg.segments, 1.3);
                // Narrow shadow + warm pale core stay visible over both wood and the golden statue.
                g.strokeColor = new Color(91, 102, 91, Math.round(48 * fade)); g.lineWidth = cfg.width + 2;
                g.moveTo(previous.x, previous.y); g.lineTo(point.x, point.y); g.stroke();
                g.strokeColor = new Color(224, 222, 207, Math.round(cfg.opacity * fade)); g.lineWidth = cfg.width;
                g.moveTo(previous.x, previous.y); g.lineTo(point.x, point.y); g.stroke();
                previous = point;
            }
        }
    }
    onDestroy(): void {
        ++this.navigationEpoch;
        this.clearMerit();
        ++this.epoch; this.actor?.stop(); this.closeActor?.stop();
        if (this.fish) Tween.stopAllByTarget(this.fish);
        if (this.toast) Tween.stopAllByTarget(this.toast.node.getComponent(UIOpacity)!);
        if (this.closeSticks) Tween.stopAllByTarget(this.closeSticks);
        if (this.mainSticks) Tween.stopAllByTarget(this.mainSticks);
        this.artNav.forEach(b => b.stop());
        game.off(Game.EVENT_HIDE, this.onHide, this); game.off(Game.EVENT_SHOW, this.onShow, this);
        view.off('canvas-resize', this.resize, this);
    }
}
