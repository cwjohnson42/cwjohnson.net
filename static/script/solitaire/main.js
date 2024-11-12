import { games } from "./games.js";

const H = '♥';
const D = '♦';
const C = '♣';
const S = '♠';

const RED = new Set([H, D]);
const BLK = new Set([C, S]);

const suits = [H, D, C, S];
const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function rankToString(rank) {
    switch (rank) {
        case 1: return "A";
        case 11: return "J";
        case 12: return "Q";
        case 13: return "K";
        default: return rank.toString();
    }
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function make_deck(style = "french") {
    return Array.from(
        function* () {
            for (let suit of suits) {
                for (let rank of ranks) {
                    yield new Card(rank, suit, false);
                }
            }
        }()
    );
}

function shuffle(deck) {
    for (let [idx, card] of deck.entries()) {
        const idx_new = rand(idx, deck.length);
        deck[idx] = deck[idx_new];
        deck[idx_new] = card;
    }
}

class Game {
    constructor(rules) {
        const deck = make_deck();
        shuffle(deck);
        this.tableau = [
            new Pile(deck.slice(0, 1), rules.tableau, true || {}),
            new Pile(deck.slice(1, 3), rules.tableau, true || {}),
            new Pile(deck.slice(3, 6), rules.tableau, true || {}),
            new Pile(deck.slice(6, 10), rules.tableau, true || {}),
            new Pile(deck.slice(10, 15), rules.tableau, true || {}),
            new Pile(deck.slice(15, 21), rules.tableau, true || {}),
            new Pile(deck.slice(21, 28), rules.tableau, true || {}),
        ];
        this.stock = new Pile(deck.slice(28), rules.stock);
        this.foundations = [
            new Pile([], rules.foundations || {}),
            new Pile([], rules.foundations || {}),
            new Pile([], rules.foundations || {}),
            new Pile([], rules.foundations || {}),
        ];
        this.waste = new Pile([], rules.waste || {});
    }

    draw() {
        if (this.stock.cards.length === 0) {
            while (this.waste.cards.length > 0) {
                this.stock.cards.push(Object.assign(this.waste.cards.pop(), {up: false}));
            }
            return true;
        }
        let modified = false;
        for (let idx = 0; idx < 3; idx++) {
            const c = this.stock.cards.pop();
            if (c === undefined) {
                break;
            }
            c.up = true;
            this.waste.cards.push(c);
            modified = true;
        }
        return modified;
    }

    moveable(target) {
        switch (target.name) {
            case "waste":
                return this.waste.moveable(target.card);
            case "foundations":
                return this.foundations[target.pile].moveable(target.card);
            case "tableau":
                return this.tableau[target.pile].moveable(target.card);
            default:
                return false;
        }
    }

    move(target, dest) {
        let src_pile;
        switch (target.name) {
            case "waste":
                src_pile = this.waste;
                break;
            case "foundations":
                src_pile = this.foundations[target.pile];
                break;
            case "tableau":
                src_pile = this.tableau[target.pile];
                break;
            default:
                return false;
        }
        if (dest.add(src_pile.cards.slice(target.card))) {
            src_pile.remove(target.card);
            return true;
        }
        return false;
    }

    automove(target) {
        if (!this.moveable(target)) {
            return false;
        }
        for (const foundation of this.foundations) {
            if (this.move(target, foundation)) {
                return true;
            }
        }
        for (const pile of this.tableau) {
            if (this.move(target, pile)) {
                return true;
            }
        }
        return false;
    }
}

class Pile {
    constructor(cards, rules, flip_top = false) {
        this.cards = cards;
        this.rules = rules;
        this.flip_top = flip_top;
        if (this.flip_top && this.cards.length) {
            this.cards.at(-1).up = true;
        }
    }

    valid_suits(card1, card2) {
        /* Checks that card2's suit is compatible with card1's suit according to the stacking rules */

        switch(this.rules.stack.suit) {
            case 'same':
                return card1.suit === card2.suit;
            case 'different':
                return card1.suit !== card2.suit;
            case 'color-same':
                return (
                       RED.has(card1.suit) && RED.has(card2.suit)
                    || BLK.has(card1.suit) && BLK.has(card2.suit)
                );
            case 'color-alt':
                return (
                       RED.has(card1.suit) && BLK.has(card2.suit)
                    || BLK.has(card1.suit) && RED.has(card2.suit)
                );
        }
    }

    valid_ranks(card1, card2) {
        /* Checks that card2's rank is compatible with card1's rank according to the stacking rules */

        switch(this.rules.stack.rank) {
            case 'same':
                return card1.rank === card2.rank;
            case 'asc':
                return card1.rank - card2.rank === -1;
            case 'desc':
                return card1.rank - card2.rank === 1;
        }
    }

    valid_stack(stack) {
        /* Checks that card2 is allowed to be stacked on card1 */

        for (let idx = 0; idx < stack.length - 1; idx++) {
            if (
                   !this.valid_suits(stack[idx], stack[idx+1])
                || !this.valid_ranks(stack[idx], stack[idx+1])
                || !stack[idx].up
            ) {
                return false;
            }
        }
        return true;
    }

    moveable(idx) {
        const stack = this.cards.slice(idx);
        if (stack.length > (this.rules.remove?.limit || Number.MAX_VALUE)) {
            return false;
        }
        return this.valid_stack(stack);
    }

    add(stack) {
        if (this.rules.add === undefined) {
            return false;
        }
        if (stack.length > (this.rules.add?.limit || Number.MAX_VALUE)) {
            return false;
        }
        if (this.cards.length) {
            if (!this.valid_stack([this.cards.at(-1)].concat(stack))) {
                return false;
            }
        } else if (!this.valid_stack(stack)) {
            return false;
        } else if (this.rules.add.empty && this.rules.add.empty !== stack[0].rank) {
            return false;
        }
        this.cards = this.cards.concat(stack);
        return true;
    }

    remove(idx) {
        this.cards.splice(idx);
        if (this.flip_top && this.cards.length) {
            this.cards.at(-1).up = true;
        }
    }
}

class Card {
    constructor(rank, suit, up) {
        this.rank = rank;
        this.suit = suit;
        this.up = up;
    }
}

class View {
    constructor(variant) {
        this.game = new Game(games[variant].rules);
        this.handlers = {};
        this.s = {
            table: {
                w: 1000,
                h: 800,
                style: "green",
            },
            card: {
                w: 100,         // width
                h: 140,         // height
                r: 10,          // corner radius
                s: "default",   // style
            },
        };
        const style = games[variant].style;

        this.vstock = new PileView(this.game.stock, style.stock, this.s.card);
        this.vwaste = new PileView(this.game.waste, style.waste, this.s.card);
        this.vfoundations = Array.from(PileView.makePileViews(this.game.foundations, style.foundations, this.s.card));
        this.vtableau = Array.from(PileView.makePileViews(this.game.tableau, style.tableau, this.s.card));

        this.grabbed = null;
        this.vgrabbed = null;
        this.dragging = false;
    }

    attach(canvas) {
        this.canvas = canvas;
        this.register("click", this.onClick);
        this.register("dblclick", this.onDblClick);
        this.register("mousedown", this.onMouseDown);
        this.draw();
    }

    register(event_type, handler) {
        if (!this.canvas || this.canvas === undefined) {
            console.error("This view has not been bound to a canvas.");
        }
        if (!this.handlers[event_type] || !this.handlers[event_type].length) {
            this.canvas.addEventListener(event_type, this);
        }
        this.handlers[event_type] = (this.handlers[event_type] || []).concat([handler]);
    }

    unregister(event_type, handler) {
        const handlers = this.handlers[event_type];
        if (handlers === undefined) {
            return;
        }
        const idx = handlers.indexOf(handler);
        if (idx > -1) {
            this.handlers[event_type].splice(idx, 1);
        }
        if (this.handlers[event_type].length === 0) {
            this.canvas.removeEventListener(event_type, this);
        }
    }

    draw() {
        if (!this.canvas || this.canvas === undefined) {
            console.error("This view has not been bound to a canvas.");
        }
        let ctx = this.canvas.getContext("2d");

        ctx.fillStyle = this.s.table.style;
        ctx.fillRect(0, 0, this.s.table.w, this.s.table.h);
        ctx.fill();

        // Draw cards on table
        this.vstock.draw(ctx);
        this.vwaste.draw(ctx, this.getDragged("waste"));
        for (let idx = 0; idx < this.vfoundations.length; idx++) {
            this.vfoundations[idx].draw(ctx, this.getDragged("foundations", idx));
        }
        for (let idx = 0; idx < this.vtableau.length; idx++) {
            this.vtableau[idx].draw(ctx, this.getDragged("tableau", idx));
        }

        // Draw cards being dragged, if any
        if (this.vgrabbed) {
            this.vgrabbed.draw(ctx);
        }
    }

    getDragged(name, pile) {
        if (!this.dragging) {
            return null;
        }
        if (this.grabbed?.name !== name) {
            return null;
        }
        if (this.grabbed.pile !== pile) {
            return null;
        }
        return this.grabbed.card;
    }

    handleEvent(event) {
        const handlers = this.handlers[event.type];
        for (const handler of handlers) {
            handler.call(this, event);
        }
    }

    onClick(e) {
        const target = this.vstock.intersect(e.offsetX, e.offsetY);
        if (target === -1) {
            if (this.game.draw()) {
                this.draw();
            }
        } else if (target === 0) {
            if (this.game.draw()) {
                this.draw();
            }
        }
    }

    onDblClick(e) {
        const target = this.findTarget(e.offsetX, e.offsetY);
        if (!target) {
            return;
        }
        if (this.game.automove(target)) {
            this.draw();
        }
    }

    onMouseDown(e) {
        const target = this.findTarget(e.offsetX, e.offsetY);
        if (!target) {
            return;
        }
        if (!this.game.moveable(target)) {
            return;
        }
        let source_view;
        switch (target.name) {
            case "waste":
                source_view = this.vwaste;
                break;
            case "foundations":
                source_view = this.vfoundations[target.pile];
                break;
            case "tableau":
                source_view = this.vtableau[target.pile];
                break;
            default:
                return;
        };
        const pile = new Pile(source_view.pile.cards.slice(target.card), {});
        this.vgrabbed = new PileView(pile, Object.assign({}, source_view.s), this.s.card);
        this.grabbed = target;

        this.register('mousemove', this.onMouseMove);
        this.register('mouseleave', this.onMouseLeave);
        this.register('mouseup', this.onMouseUp);
    }

    onMouseUp(e) {
        this.stopDrag(e);
    }

    onMouseLeave(e) {
        this.stopDrag(e);
    }

    onMouseMove(e) {
        if (this.grabbed === null) {
            console.error('uh oh');
            return;
        }
        this.dragging = true;
        this.vgrabbed.s.x = e.offsetX - this.s.card.w / 2;
        this.vgrabbed.s.y = e.offsetY - this.s.card.h / 2;
        this.draw();
    }

    stopDrag(e) {

        this.unregister('mousemove', this.onMouseMove);
        this.unregister('mouseup', this.onMouseUp);
        this.unregister('mouseleave', this.onMouseLeave);
        const target = this.findTarget(e.offsetX, e.offsetY);
        if (target !== null) {
            let source_view;
            switch (target.name) {
                case "waste":
                    source_view = this.vwaste;
                    break;
                case "foundations":
                    source_view = this.vfoundations[target.pile];
                    break;
                case "tableau":
                    source_view = this.vtableau[target.pile];
                    break;
                default:
                    return;
            };
            this.game.move(this.grabbed, source_view.pile);
        }

        this.grabbed = null;
        this.vgrabbed = null;
        this.dragging = false;
        this.draw();
    }

    findTarget(x, y) {
        for (let idx = this.vtableau.length - 1; idx >= 0; idx--) {
            const card = this.vtableau[idx].intersect(x, y);
            if (card !== null) {
                return {name: 'tableau', pile: idx, card: card};
            }
        }
        for (let idx = this.vfoundations.length - 1; idx >= 0; idx--) {
            const card = this.vfoundations[idx].intersect(x, y);
            if (card !== null) {
                return {name: 'foundations', pile: idx, card: card};
            }
        }
        const card = this.vwaste.intersect(x, y);
        if (card !== null) {
            return {name: 'waste', card: card};
        }
        return null;
    }
}

class PileView {
    constructor(pile, style, card_style) {
        this.pile = pile
        this.s = style
        this.cs = card_style
    }

    static *makePileViews(piles, style, card_style) {
        /* Given a collection of piles, create a view for each pile */

        for (let idx = 0; idx < piles.length; idx++) {
            let x;
            let y;
            if (style.orientation === "vertical") {
                x = style.x;
                y = style.y + (card_style.h + style.pad) * idx;
            } else {
                x = style.x + (card_style.w + style.pad) * idx;
                y = style.y;
            }
            yield new PileView(piles[idx], {
                x: x,
                y: y,
                peek: style.peek,
                spread: style.spread,
            }, card_style);
        }
    }

    draw(ctx, until = null) {
        const cards = this.visibleCards(until);
        if (cards.length <= 0) {
            this.drawEmpty(ctx);
            return;
        }
        for (let idx = 0; idx < cards.length; idx++) {
            const x = this.s.x + this.s.spread.x * idx;
            const y = this.s.y + this.s.spread.y * idx;
            drawCard(ctx, cards[idx], this.cs, x, y);
        }
    }

    drawEmpty(ctx) {
        const s = this.cs;
        ctx.save();
        ctx.translate(this.s.x, this.s.y);
        ctx.beginPath();
        ctx.moveTo(0, 0 + s.r);
        ctx.arcTo(0, s.h, s.r, s.h, s.r);
        ctx.arcTo(s.w, s.h, s.w, s.h - s.r, s.r);
        ctx.arcTo(s.w, 0, s.w - s.r, 0, s.r);
        ctx.arcTo(0, 0, 0, s.r, s.r);
        ctx.strokeStyle = "#003d00";
        ctx.stroke();
        ctx.restore();
    }

    visibleCards(until = null) {
        until = until === null ? this.pile.cards.length : Math.min(this.pile.cards.length, this.pile.cards.length + until);
        const start = this.s.peek ? Math.max(0, (this.pile.cards.length - this.s.peek)) : 0;
        return this.pile.cards.slice(start, until);
    }

    intersect(x, y) {
        // TODO: Make each card its own view with a predefined path and use CanvasRenderingContext2D.isPointInPath() to check intersection.
        const cards = this.visibleCards();
        if (cards.length === 0) {
            if (
                   x >= this.s.x && x <= this.s.x + this.cs.w
                && y >= this.s.y && y <= this.s.y + this.cs.h
            ) {
                return 0;
            }
        }
        for (let idx = cards.length - 1; idx >= 0; idx--) {
            const px = this.s.x + this.s.spread.x * idx;
            const py = this.s.y + this.s.spread.y * idx;
            if (
                   x >= px && x <= px + this.cs.w
                && y >= py && y <= py + this.cs.h
            ) {
                return idx - cards.length;
            }
        }
        return null;
    }
}

function drawCard(ctx, card, s, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, 0 + s.r);
    ctx.arcTo(0, s.h, s.r, s.h, s.r);
    ctx.arcTo(s.w, s.h, s.w, s.h - s.r, s.r);
    ctx.arcTo(s.w, 0, s.w - s.r, 0, s.r);
    ctx.arcTo(0, 0, 0, s.r, s.r);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2.0;
    ctx.clip();
    ctx.fillStyle = card.up ? "white" : "blue";
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.stroke();
    if (card.up) {
        ctx.font = "24px serif";
        ctx.fillStyle = card.suit === '♣' || card.suit === '♠' ? "black" : "red";
        ctx.fillText(`${rankToString(card.rank)}${card.suit}`, 5, 25);
        ctx.rotate(Math.PI);
        ctx.fillText(`${rankToString(card.rank)}${card.suit}`, -(s.w - 5), -(s.h - 25));
    }
    ctx.restore();
}
let v = new View("klondike");

window.addEventListener("load", () => {
    const canvas = document.getElementById("canvas");
    if (!canvas) {
        return;
    }
    v.attach(canvas);
});
