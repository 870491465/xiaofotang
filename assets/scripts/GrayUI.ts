import { Color, Graphics, Label, Node, UITransform, Button } from 'cc';
export const PALETTE = { cream: '#F3EBD8', wood: '#967254', ink: '#594B3D', green: '#899B80', pale: '#D9DFC9', skin: '#D8B496', robe: '#91A392' };
export function node(parent: Node, name: string, x = 0, y = 0, w = 100, h = 100): Node {
    const n = new Node(name); n.layer = 1 << 25; parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h); n.setPosition(x, y); return n;
}
export function shape(parent: Node, name: string, x: number, y: number, w: number, h: number, color: string, ellipse = false): Node {
    const n = node(parent, name, x, y, w, h); const g = n.addComponent(Graphics);
    g.fillColor = new Color(color); g.strokeColor = new Color(PALETTE.ink); g.lineWidth = 3;
    if (ellipse) g.ellipse(0, 0, w / 2, h / 2); else g.roundRect(-w / 2, -h / 2, w, h, Math.min(18, w / 4, h / 4));
    g.fill(); g.stroke(); return n;
}
export function text(parent: Node, value: string, x: number, y: number, size = 30, w = 800, h = 64): Label {
    const n = node(parent, value, x, y, w, h); const l = n.addComponent(Label);
    l.string = value; l.fontSize = size; l.lineHeight = size * 1.35; l.color = new Color(PALETTE.ink);
    l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER; return l;
}
export function button(parent: Node, title: string, x: number, y: number, w: number, action: () => void): Button {
    const n = shape(parent, title, x, y, w, 76, PALETTE.pale); const b = n.addComponent(Button);
    const label = text(n, title, 0, 0, 29, w - 8); label.node.name = 'Title';
    n.on(Button.EventType.CLICK, action); return b;
}
export function enable(b: Button, value: boolean): void {
    b.interactable = value; b.node.setScale(value ? 1 : 0.96, value ? 1 : 0.96, 1);
    b.node.getComponent(Graphics)!.fillColor = new Color(value ? PALETTE.pale : '#C6C0B2');
    const g = b.node.getComponent(Graphics)!; const w = b.node.getComponent(UITransform)!.width;
    g.clear(); g.roundRect(-w / 2, -38, w, 76, 18); g.fill(); g.stroke();
}
