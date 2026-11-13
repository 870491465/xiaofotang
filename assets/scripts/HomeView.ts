import { Button, Color, Label, Node, Sprite, SpriteFrame, UITransform, sys, view } from 'cc';
import { node, text } from './GrayUI';

export type CharacterId = 'male' | 'female';
export const HOME_KEYS = ['home_background', 'male_stand', 'female_stand', 'selection_panel', 'card_normal',
    'card_selected', 'enter_button', 'selected_badge', 'name_plate', 'title_plate', 'section_title_plate', 'settings_button'] as const;
export const CHARACTER_STORAGE = 'quietCourtyard.selectedCharacter';

/** One assembled home view; reference coordinates are 941x1672, origin at top left. */
export class HomeView {
    readonly root: Node; readonly content: Node; readonly background: Node;
    readonly cards: { id: CharacterId; root: Node; sprite: Sprite; badge: Node; button: Button; character: Node }[] = [];
    readonly enterButton: Button; readonly enterLabel: Label; readonly message: Label;
    selected: CharacterId; loading = false;
    constructor(parent: Node, private frames: SpriteFrame[], private layout: any,
        selected: CharacterId, onSelect: (id: CharacterId) => void, onEnter: () => void, onSettings: () => void) {
        if (frames.length !== HOME_KEYS.length || frames.some(f => !f)) throw new Error('首页素材不完整，请检查 homeArtwork 绑定');
        this.selected = selected;
        this.root = node(parent, 'HomeRoot');
        this.background = this.image(this.root, 'home_background', 0, 0, 941, 1672); this.background.name = 'HomeBackground';
        this.content = node(this.root, 'HomeContent', 0, 0, 941, 1672);
        const title = this.at('title', 'title_plate'); this.caption(title, layout.text.title, -22, 48, 280);
        const subtitle = text(this.content, layout.text.subtitle, 0, 836 - 220, 38, 790, 70); subtitle.node.name = 'HomeSubtitle';
        const settings = this.at('settings', 'settings_button'); settings.addComponent(Button);
        settings.on(Button.EventType.CLICK, () => { if (!this.loading) onSettings(); });
        this.at('panel', 'selection_panel');
        const heading = this.at('section_heading', 'section_title_plate'); this.caption(heading, layout.text.section_heading, -7, 38, 180);
        for (const id of ['male', 'female'] as CharacterId[]) {
            const card = this.at(`card_${id}`, 'card_normal'); const button = card.addComponent(Button);
            card.name = `CharacterCard_${id}`;
            const rect = this.rect(`character_${id}`), k = rect[2] / 512;
            const character = this.image(this.content, `${id}_stand`, rect[0] + rect[2] / 2 - 941 / 2,
                1672 / 2 - (rect[1] + 704 * k), 512, 768);
            character.name = `HomeCharacter_${id}`;
            character.getComponent(UITransform)!.setAnchorPoint(0.5, 64 / 768); character.setScale(k, k, 1);
            const name = this.at(`name_${id}`, 'name_plate'); this.caption(name, layout.text[`name_${id}`], 0, 36, 220);
            // Same upper-right offset for either card; only the selected one is visible.
            const badge = this.image(card, 'selected_badge', 126, 304.5, 67, 67); badge.name = 'SelectedBadge';
            this.cards.push({ id, root: card, sprite: card.getComponent(Sprite)!, badge, button, character });
            card.on(Button.EventType.CLICK, () => {
                if (this.loading) return;
                this.select(id); onSelect(id);
            });
        }
        const enter = this.at('enter', 'enter_button'); this.enterButton = enter.addComponent(Button);
        this.enterLabel = this.caption(enter, `${layout.text.enter}  →`, 0, 46, 460);
        enter.on(Button.EventType.CLICK, () => { if (!this.loading) onEnter(); });
        this.message = text(this.content, '', 0, 836 - 1577, 20, 760, 28);
        this.message.overflow = Label.Overflow.SHRINK; this.message.enableWrapText = false;
        this.message.color = new Color(135, 75, 42, 255); this.message.node.name = 'HomeMessage';
        this.select(selected); this.resize();
    }
    private frame(key: string): SpriteFrame { return this.frames[HOME_KEYS.indexOf(key as any)]; }
    private image(parent: Node, key: string, x: number, y: number, width: number, height: number): Node {
        const n = node(parent, key, x, y, width, height), s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM; s.trim = false; s.spriteFrame = this.frame(key); return n;
    }
    private rect(id: string): number[] {
        const spec = this.layout.male_selected.find((s: any) => s.id === id);
        if (!spec) throw new Error(`首页布局缺少 ${id}`); return spec.rect_top_left_xywh;
    }
    private at(id: string, key: string): Node {
        const r = this.rect(id), n = this.image(this.content, key, r[0] + r[2] / 2 - 470.5, 836 - r[1] - r[3] / 2, r[2], r[3]);
        n.name = id; return n;
    }
    private caption(parent: Node, value: string, y: number, size: number, width: number): Label {
        const l = text(parent, value, 0, y, size, width, 80);
        l.isBold = true; l.enableWrapText = false; l.overflow = Label.Overflow.SHRINK; l.node.name = 'Caption'; return l;
    }
    select(id: CharacterId): void {
        if (id !== 'male' && id !== 'female') return;
        this.selected = id; this.message && (this.message.string = '');
        for (const card of this.cards) {
            card.sprite.spriteFrame = this.frame(card.id === id ? 'card_selected' : 'card_normal');
            card.badge.active = card.id === id;
        }
    }
    setLoading(value: boolean): void {
        this.loading = value; this.enterButton.interactable = !value;
        this.cards.forEach(c => { c.button.interactable = !value; });
        this.enterLabel.string = value ? '正在准备…' : `${this.layout.text.enter}  →`;
    }
    resize(): void {
        const visible = view.getVisibleSize(), safe = sys.getSafeAreaRect(false), margin = 16;
        this.root.getComponent(UITransform)!.setContentSize(visible.width, visible.height);
        const cover = Math.max(visible.width / 941, visible.height / 1672);
        this.background.setScale(cover, cover, 1);
        const fit = Math.min((safe.width - margin * 2) / 941, (safe.height - margin * 2) / 1672);
        this.content.setScale(fit, fit, 1);
        this.content.setPosition(safe.x + safe.width / 2 - visible.width / 2, safe.y + safe.height / 2 - visible.height / 2);
    }
}
