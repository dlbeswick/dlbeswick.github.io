/*
 * Copyright (c) 2021 David Beswick.
 *
 * This file is part of cards-mp
 * (see https://github.com/dlbeswick/cards-mp).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
import * as array from './array.js';
import { assert } from './assert.js';
import * as dom from "./dom.js";
import { MoveCards, MoveChips } from './game.js';
import * as it from './iterator.js';
const HighDetail = false;
function cardFaceUp(isSecretContainer, wc) {
    let faceUp;
    if (wc.faceUpIsConscious)
        faceUp = wc.faceUp;
    else
        faceUp = !isSecretContainer;
    return wc.withFaceUp(faceUp);
}
class UIElement {
    constructor(element) {
        this.element = element;
        this.events = new dom.EventListeners(this.element);
    }
    destroy() {
        this.events.removeAll();
        this.element.remove();
    }
}
/*
  Elements that hold other containers or UIActionables.
*/
export class UIContainer extends UIElement {
    constructor(element) {
        super(element);
        this.children = [];
    }
    add(child) {
        this.element.appendChild(child.element);
        this.children.push(child);
    }
    // Note that it's possible for there to be no UICard present for a card, even if all cards are on the playfield as is
    // typical.
    //
    // For example, the "single slot" view of stock may logically contain the card but a UICard will only have been
    // created for the top card.
    uiMovablesForSlots(slots) {
        return this.children.flatMap(c => c.uiMovablesForSlots(slots));
    }
    destroy() {
        super.destroy();
        for (const child of this.children)
            child.destroy();
        this.children = [];
    }
    with(f) {
        f(this);
        return this;
    }
}
export class UIContainerDiv extends UIContainer {
    constructor() {
        super(document.createElement("div"));
        this.element.classList.add("container");
    }
}
export class UIContainerFlex extends UIContainerDiv {
    constructor(direction = 'row', grow = '', klass = "container-flex") {
        super();
        this.element.classList.add(klass);
        this.element.style.display = 'flex';
        this.element.style.direction = 'ltr';
        if (grow)
            this.element.style.flexGrow = "1";
        if (direction == 'aware')
            this.element.classList.add("flex");
        else if (direction == 'aware-reverse')
            this.element.classList.add("flex-reverse");
        else
            this.element.style.flexDirection = direction;
    }
}
export class UISlotRoot extends UIContainer {
    constructor() {
        super(document.createElement("div"));
        dom.demandById("playfield").appendChild(this.element);
    }
}
/*
  Elements that can be clicked, touched, can have cards moved to and from them, etc.
*/
class UIActionable extends UIElement {
    constructor(element, idCnt, selection, owner, viewer, playfield, notifierSlot) {
        assert(idCnt);
        super(element);
        this.idCnt = idCnt;
        this.owner = owner;
        this.viewer = viewer;
        this.selection = selection;
        this._playfield = playfield;
        this.notifierSlot = notifierSlot;
        this.eventsPlayfield = new dom.EventListeners(this.notifierSlot.eventTarget);
    }
    init() {
        this.eventsPlayfield.add("playfieldchange", (e) => { this.onPlayfieldUpdate(e.playfield_); return true; });
        this.events.add("click", this.onClick.bind(this));
        return this;
    }
    destroy() {
        super.destroy();
        this.eventsPlayfield.removeAll();
    }
    isViewableBy(viewer) {
        return this.owner == null || viewer == this.owner;
    }
    get isSecret() { return this.owner != null; }
    onPlayfieldUpdate(playfield) {
        this._playfield = playfield;
    }
}
/*
  Shows one card slot.
*/
class UISlotCard extends UIActionable {
    constructor(element, idCnt, selection, owner, viewer, playfield, idSlot, notifierSlot, images, actionLongPress = 'flip', selectionMode = 'single') {
        super(element, idCnt, selection, owner, viewer, playfield, notifierSlot);
        this.images = images;
        this.actionLongPress = actionLongPress;
        this.selectionMode = selectionMode;
        this.children = [];
        this.idSlot = idSlot;
        this.element.classList.add("slot");
        this.eventsSlot = new dom.EventListeners(notifierSlot.slot(this.idCnt, this.idSlot));
        this.eventsSlot.add("slotchange", (e) => {
            this.change(e.playfield_, e.playfield.containerCard(e.idCnt).hasSlot(e.idCnt, e.idSlot) ?
                e.playfield.containerCard(e.idCnt).slot(e.idSlot) : undefined, e.playfield_.containerCard(e.idCnt).slot(e.idSlot));
            return true;
        });
    }
    uiMovablesForSlots(slots) {
        return Array.from(slots).some(s => this.slot().is(s)) ? this.children : [];
    }
    onClick() {
        if (!this.selection.active() && this.selectionMode == 'all-on-space')
            this.selection.select(this.children);
        else
            this.selection.finalize(this.onAction.bind(this), UICard);
        return true;
    }
    destroy() {
        super.destroy();
        for (const child of this.children)
            child.destroy();
        this.eventsSlot.removeAll();
    }
    slot() {
        return this._playfield.containerCard(this.idCnt).slot(this.idSlot);
    }
    onCardClicked(uicard) {
        if (this.selectionMode == 'all-proceeding') {
            const selectedIdx = this.children.indexOf(uicard);
            if (selectedIdx != -1) {
                this.selection.select(this.children.slice(selectedIdx));
            }
        }
        else {
            this.selection.select([uicard]);
        }
    }
    onAction(uiCards) {
        const cardsSrc = uiCards.map(ui => ui.wcard);
        assert(cardsSrc.length, "Source cards empty");
        const slotSrc = uiCards[0].uislot.slot();
        const slotDst = this.slot();
        const move = (() => {
            if (slotSrc.is(slotDst)) {
                // case 1: same slot. Only possible outcome is move to end, otherwise drop target would be UICard.
                return new MoveCards(this._playfield.sequence, cardsSrc, slotSrc.id, slotSrc.id);
            }
            else {
                // case 2: diff slot. Always flip face-up, unless a human player has deliberately flipped it up or down before.
                return new MoveCards(this._playfield.sequence, cardsSrc.map(wc => cardFaceUp(slotDst.container(this._playfield).secret, wc)), slotSrc.id, slotDst.id);
            }
        })();
        this.notifierSlot.move(move);
    }
}
/*
  Shows the topmost card of a single slot and a card count.
*/
export class UISlotSingle extends UISlotCard {
    constructor(idCnt, selection, owner, viewer, playfield, idSlot, notifierSlot, images, cardWidth, cardHeight, actionLongPress = 'flip', action) {
        super(document.createElement("div"), idCnt, selection, owner, viewer, playfield, idSlot, notifierSlot, images, actionLongPress);
        this.cardWidth = cardWidth;
        this.cardHeight = cardHeight;
        this.element.classList.add("slot-single");
        this.element.style.width = cardWidth.toString() + 'px';
        this.count = document.createElement("label");
        this.element.appendChild(this.count);
        this.elCard = this.spaceMake();
        this.element.appendChild(this.elCard);
        if (action) {
            const btn = document.createElement("button");
            btn.innerText = action[0];
            btn.addEventListener("click", () => {
                btn.disabled = !action[1]();
            });
            this.element.appendChild(btn);
        }
    }
    spaceMake() {
        const space = document.createElement("div");
        space.style.width = this.cardWidth + 'px';
        space.style.height = this.cardHeight + 'px';
        return space;
    }
    change(playfield_, slot, slot_) {
        if (slot_.isEmpty()) {
            const space = this.spaceMake();
            this.elCard.replaceWith(space);
            this.elCard = space;
            this.children = [];
        }
        else {
            const card = new UICard(slot_.top(), this, false, this.viewer, this.selection, this.notifierSlot, this.images, this.cardWidth, this.cardHeight).init();
            this.elCard.replaceWith(card.element);
            this.elCard = card.element;
            this.children[0] = card;
        }
        this.count.innerText = slot_.length().toString();
    }
}
/*
  Shows a single slot as a fan of cards.
*/
export class UISlotSpread extends UISlotCard {
    constructor(idCnt, selection, owner, viewer, playfield, idSlot, notifierSlot, images, cardWidth, cardHeight, width, classesSlot, classesCard, actionLongPress = 'flip', selectionMode = 'single') {
        super(document.createElement("div"), idCnt, selection, owner, viewer, playfield, idSlot, notifierSlot, images, actionLongPress, selectionMode);
        classesSlot = classesSlot || ['slot', 'slot-overlap'];
        classesCard = classesCard || ['card'];
        this.classesCard = classesCard;
        if (width)
            this.element.style.width = width;
        this.element.classList.add(...classesSlot);
        this.containerEl = this.element;
        this.cardWidth = cardWidth;
        this.cardHeight = cardHeight;
    }
    change(playfield_, slot, slot_) {
        var _a;
        const cards_ = Array.from(slot_);
        let idx = this.children.length - 1;
        while (idx > cards_.length - 1) {
            this.children[idx--].destroy();
        }
        this.children.length = cards_.length;
        idx = this.children.length - 1;
        while (idx >= 0) {
            const wcard = cards_[idx];
            const child = this.children[idx];
            if (!child || !child.wcard.equals(wcard)) {
                const uicard = new UICard(wcard, this, true, this.viewer, this.selection, this.notifierSlot, this.images, this.cardWidth, this.cardHeight, this.classesCard);
                uicard.init();
                if (HighDetail) {
                    // Keep it +1 just in case transitions ever need to avoid
                    // overlaying the same card (then they can -1).
                    uicard.element.style.zIndex = (idx + 1).toString();
                }
                this.children[idx] = uicard;
                if (child)
                    child.element.replaceWith(uicard.element);
                else
                    this.containerEl.insertBefore(uicard.element, (_a = this.children[idx + 1]) === null || _a === void 0 ? void 0 : _a.element);
            }
            --idx;
        }
    }
}
/*
  UI elements that can visualise ContainerSlots.
*/
class UIContainerSlots extends UIActionable {
    constructor(element, idCnt, selection, owner, viewer, playfield, notifierSlot) {
        super(element, idCnt, selection, owner, viewer, playfield, notifierSlot);
        this.eventsContainer = new dom.EventListeners(this.notifierSlot.container(this.idCnt));
        this.eventsContainer.add("containerchange", (e) => {
            this.change(e.playfield_, e.playfield.containerCard(e.idCnt), e.playfield_.containerCard(e.idCnt));
            return true;
        });
    }
    destroy() {
        super.destroy();
        this.eventsContainer.removeAll();
    }
}
/*
  A UI element that can visualise a whole ContainerSlot by displaying multiple UISlotSpreads within it, and allowing
  new slots to be created.
*/
export class UIContainerSlotsMulti extends UIContainerSlots {
    constructor(idCnt, selection, owner, viewer, playfield, notifierSlot, images, cardWidth, cardHeight, height, actionLongPress = 'flip') {
        super(document.createElement("div"), idCnt, selection, owner, viewer, playfield, notifierSlot);
        this.images = images;
        this.cardWidth = cardWidth;
        this.cardHeight = cardHeight;
        this.actionLongPress = actionLongPress;
        this.children = [];
        this.element.classList.add("slot");
        this.element.classList.add("slot-multi");
        this.element.style.minHeight = height;
    }
    uiMovablesForSlots(slots) {
        return this.children.flatMap(uis => uis.uiMovablesForSlots(slots));
    }
    onClick() {
        this.selection.finalize(this.onAction.bind(this), UICard);
        return true;
    }
    onAction(selected) {
        var _a, _b;
        const cardsSrc = selected.map(ui => ui.wcard);
        const cardsDst = cardsSrc.map(wc => cardFaceUp(false, wc));
        const slotSrc = selected[0].uislot.slot();
        const cnt = this._playfield.containerCard(this.idCnt);
        const slotNewId = [cnt.id, ((_b = (_a = this.children[this.children.length - 1]) === null || _a === void 0 ? void 0 : _a.idSlot) !== null && _b !== void 0 ? _b : -1) + 1];
        const move = new MoveCards(this._playfield.sequence, cardsDst, slotSrc.id, slotNewId, undefined, [slotNewId]);
        this.notifierSlot.move(move);
    }
    change(playfield_, cnt, cnt_) {
        // Note, this only catches additions and deletions.
        // If the contents of any of the slots in a container have changed, then it won't be corrected here.
        // That must be picked up by a lot change event.
        const removed = it.filter(cnt, slot => !cnt_.hasSlot(slot.idCnt, slot.idSlot));
        for (const slot of removed) {
            const ui = this.children.find(ui => ui.slot().is(slot));
            if (ui) {
                ui.destroy();
                this.children = array.remove(this.children, ui);
            }
        }
        for (const slot of cnt_) {
            const ui = this.children.find(ui => ui.slot().is(slot));
            if (!ui) {
                const uislot = new UISlotSpread(cnt.id, this.selection, this.owner, this.viewer, playfield_, slot.idSlot, this.notifierSlot, this.images, this.cardWidth, this.cardHeight, `${this.cardWidth}px`, ['slot', 'slot-overlap-vert'], undefined, this.actionLongPress);
                uislot.init();
                uislot.change(playfield_, cnt.hasSlot(slot.idCnt, slot.idSlot) ? cnt.slot(slot.idSlot) : undefined, slot);
                this.element.appendChild(uislot.element);
                this.children.push(uislot);
            }
        }
    }
}
export class UIMovable extends UIElement {
    constructor(el, selection, dropTarget) {
        super(el);
        this.wasMouseDown = false;
        this._isInPlay = true;
        this.selection = selection;
        this.dropTarget = dropTarget;
    }
    isInPlay() { return this._isInPlay; }
    removeFromPlay() {
        if (this.selection.includes(this))
            this.selection.deselect([this]);
        this._isInPlay = false;
    }
    init() {
        this.eventsImg = new dom.EventListeners(this.interactionElement);
        function lpMouseUp(self) {
            if (self.timerPress) {
                cancel(self);
                self.onClick();
            }
            return true;
        }
        function lpMouseDown(self) {
            const pf = self.playfield();
            self.timerPress = window.setTimeout(() => {
                cancel(self);
                //          window.alert("longpress")
                self.timerPress = undefined;
                self.onLongPress(pf);
            }, 500);
            return true;
        }
        function cancel(self) {
            self.touch = undefined;
            self.wasMouseDown = false;
            if (self.timerPress) {
                clearTimeout(self.timerPress);
                self.timerPress = undefined;
            }
            return true;
        }
        assert(this.eventsImg, "Failed to call init");
        // Touch events here must both allow longpress and not block scrolling. "touchstart" return true, so 
        // mouse events will also then be processed by the browser. This code must ignore them where required.
        // Using 'preventDefault' in touchstart would block scrolling.
        // Also, note that 'mousedown/mouseup' isn't actually sent until the user lifts their finger.
        //
        // A weird sequence takes place on WebKit, watch out for this:
        // 1. User longpresses.
        // 2. Card flips.
        // 3. New card element gets no touch events, no mouseup, mousedown, etc, just like other browsers.
        // 4. Unlike other browsers, as soon as the user lifts their finger then "mousedown" and "mouseup" are sent,
        //    immediately selecting the new element.
        this.eventsImg.add("mousedown", () => {
            if (!this.touch && this.selection.lastTouchedId != this.itemId) {
                this.wasMouseDown = true;
                lpMouseDown(this);
            }
            return false;
        });
        this.eventsImg.add("mouseup", () => {
            if (this.wasMouseDown && this.selection.lastTouchedId != this.itemId) {
                lpMouseUp(this);
                this.wasMouseDown = false;
            }
            else {
                this.selection.lastTouchedId = "";
            }
            return false;
        });
        this.eventsImg.add("mouseout", () => cancel(this));
        this.eventsImg.add("touchstart", (e) => {
            // This unfortunate variable is the fix for that weird WebKit behaviour described above.
            this.selection.lastTouchedId = this.itemId;
            this.touch = e.touches[0];
            lpMouseDown(this);
        }, { "passive": true });
        this.eventsImg.add("touchmove", (e) => {
            if (!this.touch || Math.abs(e.touches[0].screenY - this.touch.screenY) > 5)
                cancel(this);
        }, { "passive": true });
        this.eventsImg.add("touchend", () => {
            if (this.touch)
                lpMouseUp(this);
            this.selection.lastTouchedId = "";
            return false;
        });
        // Stop slots acting on mouse events that this element has acted on.
        this.eventsImg.add("click", () => !(this.dropTarget || !this.selection.active() || this.selection.includes(this)));
        return this;
    }
    destroy() {
        var _a;
        super.destroy();
        (_a = this.eventsImg) === null || _a === void 0 ? void 0 : _a.removeAll();
    }
    onSelect() {
        this.element.classList.add("selected");
    }
    onDeselect() {
        this.element.classList.remove("selected");
    }
    fadeTo(start, end, msDuration, onFinish = (e) => { }) {
        const filterEnd = ` opacity(${end})`;
        if (this.element.animate) {
            const anim = this.element.animate([
                { filter: ` opacity(${start})` },
                { filter: filterEnd }
            ], {
                duration: msDuration,
                easing: 'ease-in-out'
            });
            anim.addEventListener("finish", onFinish);
        }
        else {
            onFinish(undefined);
        }
    }
    animateTo(start, end, zIndexEnd, msDuration, onFinish = (e) => { }) {
        var _a, _b;
        // Cards can't be interacted with anymore after animating. They will be replaced with new cards at the end of the
        // animation.
        (_a = this.eventsImg) === null || _a === void 0 ? void 0 : _a.removeAll();
        if (this.selection.includes(this))
            this.selection.deselect([this]);
        const kfEnd = {
            ...(HighDetail ? { zIndex: zIndexEnd.toString() } : {}),
            transform: `translate(${end[0] - start[0]}px, ${end[1] - start[1]}px)`
        };
        const finish = () => {
            this.element.style.transform = kfEnd.transform;
            if (kfEnd.zIndex) {
                this.element.style.zIndex = kfEnd.zIndex;
            }
        };
        if (this.element.animate) {
            this.events.removeAll();
            (_b = this.eventsImg) === null || _b === void 0 ? void 0 : _b.removeAll();
            this.element.style.position = 'absolute';
            this.element.style.left = start[0] + 'px';
            this.element.style.top = start[1] + 'px';
            document.body.appendChild(this.element);
            this.element.animate([
                { ...(HighDetail ? { zIndex: this.element.style.zIndex || '0' } : {}),
                    transform: 'translate(0px, 0px)' },
                kfEnd
            ], {
                duration: msDuration,
                easing: 'ease-in-out'
            }).addEventListener("finish", (e) => {
                finish();
                onFinish(e);
            });
        }
        else {
            finish();
            onFinish();
        }
    }
    coordsAbsolute() {
        const rectThis = this.element.getBoundingClientRect();
        return [rectThis.left + window.pageXOffset, rectThis.top + window.pageYOffset];
    }
    // playfield: Playfield at the time the longpress was started
    onLongPress(playfield) { }
    onClick() { }
}
export class UISlotChip extends UIActionable {
    constructor(idCnt, selection, owner, viewer, playfield, notifierSlot, idSlot, cardWidth) {
        super(document.createElement("div"), idCnt, selection, owner, viewer, playfield, notifierSlot);
        this.children = [];
        this.idSlot = idSlot;
        this.cardWidth = cardWidth;
        this.count = document.createElement("label");
        this.element.appendChild(this.count);
        this.element.classList.add("slot");
        this.element.classList.add("slot-overlap");
        this.element.classList.add("slot-chip");
        this.eventsSlot = new dom.EventListeners(notifierSlot.slot(this.idCnt, this.idSlot));
        this.eventsSlot.add("slotchange", (e) => {
            this.change(e.playfield_, e.playfield.containerChip(e.idCnt).slot(e.idSlot), e.playfield_.containerChip(e.idCnt).slot(e.idSlot));
            return true;
        });
    }
    uiMovablesForSlots(slots) {
        return Array.from(slots).some(s => this.slot().is(s)) ? this.children : [];
    }
    change(playfield_, slot, slot_) {
        var _a;
        const chips_ = Array.from(slot_);
        let idx = this.children.length - 1;
        while (idx > chips_.length - 1) {
            this.children[idx--].destroy();
        }
        this.children.length = chips_.length;
        idx = this.children.length - 1;
        while (idx >= 0) {
            const chip = chips_[idx];
            const child = this.children[idx];
            if (!child || !child.chip.is(chip)) {
                const uichip = new UIChip(this.selection, chip, this, this.cardWidth);
                uichip.init();
                if (HighDetail) {
                    // Keep it +1 just in case transitions ever need to avoid
                    // overlaying the same chip (then they can -1).
                    uichip.element.style.zIndex = (idx + 1).toString();
                }
                this.children[idx] = uichip;
                this.element.insertBefore(uichip.element, (_a = this.children[idx + 1]) === null || _a === void 0 ? void 0 : _a.element);
            }
            --idx;
        }
        this.count.innerText = '฿' + this.children.map(ui => ui.chip.value).reduce((a, b) => a + b, 0);
    }
    destroy() {
        super.destroy();
        for (const child of this.children)
            child.destroy();
        this.eventsSlot.removeAll();
    }
    slot() {
        return this._playfield.containerChip(this.idCnt).slot(this.idSlot);
    }
    top() {
        return this.children[this.children.length - 1];
    }
    onClick() {
        var _a;
        if (this.selection.active())
            this.selection.finalize(this.onAction.bind(this), UIChip);
        else {
            const valueToSelect = (_a = this.top()) === null || _a === void 0 ? void 0 : _a.chip.value;
            this.selection.select(this.children.filter(ui => ui.chip.value == valueToSelect));
        }
        return true;
    }
    onAction(selected) {
        assert(selected.every(ui => ui.uislot.slot() == selected[0].uislot.slot()), "Chip selection has different slots");
        const slotSrc = selected[0].uislot.slot();
        const toMove = selected;
        const chipsSrc = toMove.map(ui => ui.chip);
        const slotDst = this.slot();
        if (!slotSrc.is(slotDst)) {
            this.notifierSlot.move(new MoveChips(this._playfield.sequence, chipsSrc, slotSrc.id, slotDst.id));
        }
    }
}
export class UIChip extends UIMovable {
    constructor(selection, chip, uislot, cardWidth) {
        super(document.createElement("div"), selection, true);
        this.uislot = uislot;
        this.chip = chip;
        this.element.classList.add("chip");
        this.img = document.createElement("div");
        this.img.style.width = cardWidth * 0.75 + 'px';
        this.img.style.height = cardWidth * 0.75 + 'px';
        this.img.style.content = "url(img/chips.svg#" + this.chip.value + ")";
        this.element.appendChild(this.img);
    }
    playfield() {
        return this.uislot._playfield;
    }
    is(rhs) {
        return this.chip.is(rhs.chip);
    }
    equalsVisually(rhs) {
        return true;
    }
    onClick() {
        if (this.selection.active())
            this.uislot.onClick();
        else
            this.selection.select([this]);
    }
    get itemId() { return this.chip.id.toString(); }
    get interactionElement() { return this.img; }
    get locationImportance() { return 0; }
}
/*
  Assumptions: 1->1 UICard->Card on given Playfield
*/
export class UICard extends UIMovable {
    constructor(wcard, uislot, dropTarget, viewer, selection, notifierSlot, images, cardWidth, cardHeight, classesCard = ["card"]) {
        super(document.createElement("div"), selection, dropTarget);
        this.wcard = wcard;
        this.uislot = uislot;
        this.notifierSlot = notifierSlot;
        this.element.classList.add(...classesCard);
        this.faceUp = wcard.faceUp && (this.uislot.isViewableBy(viewer) || wcard.faceUpIsConscious);
        this.img = this.faceUp ?
            images.card(wcard.card.suit, wcard.card.rank) :
            images.cardBack.cloneNode();
        if (wcard.turned) {
            this.element.classList.add('turned');
        }
        this.img.style.width = cardWidth + 'px';
        this.img.style.height = cardHeight + 'px';
        this.element.appendChild(this.img);
    }
    playfield() {
        return this.uislot._playfield;
    }
    equalsVisually(rhs) {
        return this.wcard.card.is(rhs.wcard.card) && this.faceUp == rhs.faceUp;
    }
    is(rhs) {
        return this.wcard.is(rhs.wcard);
    }
    doMove(uicards) {
        assert(uicards.length, "Move of no cards");
        const cardsSrc = uicards.map(ui => ui.wcard);
        const slotSrc = uicards[0].uislot.slot();
        const slotDst = this.uislot.slot();
        const move = (() => {
            if (slotSrc.is(slotDst)) {
                return new MoveCards(this.playfield().sequence, cardsSrc, slotSrc.id, slotSrc.id, this.wcard);
            }
            else {
                return new MoveCards(this.playfield().sequence, cardsSrc.map(wc => cardFaceUp(slotDst.container(this.playfield()).secret, wc)), slotSrc.id, slotDst.id, this.wcard);
            }
        })();
        this.notifierSlot.move(move);
    }
    onClick() {
        // This logic is necessary to allow non-drop targets (single slot) to have this action fall through to the slot.
        if (this.dropTarget && this.selection.active() && !this.selection.includes(this)) {
            this.selection.finalize(this.doMove.bind(this), UICard);
        }
        else if (this.selection.active() && this.selection.includes(this)) {
            this.selection.deselect();
        }
        else if (!this.selection.active()) {
            this.uislot.onCardClicked(this);
        }
    }
    onLongPress(playfield) {
        // Playfield may have changed since press was initiated
        if (playfield == this.uislot._playfield) {
            if (this.uislot.actionLongPress == 'flip') {
                this.flip();
            }
            else if (this.uislot.actionLongPress == 'turn') {
                this.turn();
            }
            else {
                assert("Unknown longpress action", this.uislot.actionLongPress);
            }
        }
    }
    flip() {
        const move = new MoveCards(this.playfield().sequence, [this.wcard.withFaceStateConscious(!this.wcard.faceUp, this.wcard.faceUp)], this.uislot.slot().id, this.uislot.slot().id, this.uislot.slot().next(this.wcard));
        this.notifierSlot.move(move);
    }
    turn() {
        const move = new MoveCards(this.playfield().sequence, [this.wcard.withTurned(!this.wcard.turned)], this.uislot.slot().id, this.uislot.slot().id, this.uislot.slot().next(this.wcard));
        this.notifierSlot.move(move);
    }
    get itemId() { return this.wcard.id.toString(); }
    get interactionElement() { return this.img; }
    get locationImportance() {
        if (this.uislot.isSecret)
            return 0;
        else
            return 1;
    }
}
export class Selection {
    constructor() {
        this.selected = [];
        this.lastTouchedId = "";
    }
    select(selects) {
        const deselects = this.selected.filter(s => !selects.includes(s));
        const newselects = selects.filter(s => !this.selected.includes(s));
        this.deselect(deselects);
        this.selected = selects;
        for (const s of newselects)
            s.onSelect();
    }
    deselect(selects = this.selected) {
        assert(selects.every(s => this.selected.includes(s)), "Deselect of unselected elem");
        for (const s of selects)
            s.onDeselect();
        this.selected = this.selected.filter(s => !selects.includes(s));
    }
    finalize(func, klass) {
        if (this.selected.length > 0) {
            if (this.isConsistent()) {
                if (this.selected.every(s => s instanceof klass)) {
                    if (this.selected.length > 0)
                        func(this.selected);
                }
            }
            else {
                console.debug("Some elements of selection inconsistent with current playfield, selection not finalized");
            }
            this.deselect(this.selected);
        }
    }
    includes(s) {
        return this.selected.includes(s);
    }
    active() {
        return this.selected.length > 0;
    }
    isConsistent() {
        return this.selected.every(m => m.isInPlay());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi90cy91aS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0JHO0FBQ0gsT0FBTyxLQUFLLEtBQUssTUFBTSxZQUFZLENBQUE7QUFDbkMsT0FBTyxFQUFFLE1BQU0sRUFBVyxNQUFNLGFBQWEsQ0FBQTtBQUM3QyxPQUFPLEtBQUssR0FBRyxNQUFNLFVBQVUsQ0FBQTtBQUMvQixPQUFPLEVBQ21CLFNBQVMsRUFBRSxTQUFTLEVBQzFCLE1BQU0sV0FBVyxDQUFBO0FBRXJDLE9BQU8sS0FBSyxFQUFFLE1BQU0sZUFBZSxDQUFBO0FBR25DLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUV4QixTQUFTLFVBQVUsQ0FBQyxpQkFBMEIsRUFBRSxFQUFhO0lBQzNELElBQUksTUFBTSxDQUFBO0lBQ1YsSUFBSSxFQUFFLENBQUMsaUJBQWlCO1FBQ3RCLE1BQU0sR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFBOztRQUVsQixNQUFNLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQTtJQUM3QixPQUFPLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUE7QUFDOUIsQ0FBQztBQUVELE1BQWUsU0FBUztJQUl0QixZQUFZLE9BQW9CO1FBQzlCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFBO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQTtJQUNwRCxDQUFDO0lBRUQsT0FBTztRQUNMLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUE7UUFDdkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQTtJQUN2QixDQUFDO0NBQ0Y7QUFFRDs7RUFFRTtBQUNGLE1BQU0sT0FBZ0IsV0FBWSxTQUFRLFNBQVM7SUFHakQsWUFBWSxPQUFvQjtRQUM5QixLQUFL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LENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLEtBQUssQ0FBQyxFQUFFO29CQUNoRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUM7d0JBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBZSxDQUFDLENBQUE7aUJBQzdCO2FBQ0Y7aUJBQU07Z0JBQ0wsT0FBTyxDQUFDLEtBQUssQ0FBQyx5RkFBeUYsQ0FBQyxDQUFBO2FBQ3pHO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7U0FDN0I7SUFDSCxDQUFDO0lBRUQsUUFBUSxDQUFDLENBQVk7UUFDbkIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUNsQyxDQUFDO0lBRUQsTUFBTTtRQUNKLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQ2pDLENBQUM7SUFFTyxZQUFZO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTtJQUMvQyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQ29weXJpZ2h0IChjKSAyMDIxIERhdmlkIEJlc3dpY2suXG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgY2FyZHMtbXAgXG4gKiAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kbGJlc3dpY2svY2FyZHMtbXApLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG4gKiBpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhc1xuICogcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlXG4gKiBMaWNlbnNlLCBvciAoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuICogYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2ZcbiAqIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcbiAqIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuICogYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiAqL1xuaW1wb3J0ICogYXMgYXJyYXkgZnJvbSAnLi9hcnJheS5qcydcbmltcG9ydCB7IGFzc2VydCwgYXNzZXJ0ZiB9IGZyb20gJy4vYXNzZXJ0LmpzJ1xuaW1wb3J0ICogYXMgZG9tIGZyb20gXCIuL2RvbS5qc1wiXG5pbXBvcnQgeyBDYXJkLCBDaGlwLCBDb250YWluZXJTbG90Q2FyZCwgRXZlbnRDb250YWluZXJDaGFuZ2UsIEV2ZW50TWFwTm90aWZpZXJTbG90LCBFdmVudFBsYXlmaWVsZENoYW5nZSxcbiAgICAgICAgIEV2ZW50U2xvdENoYW5nZSwgTW92ZUNhcmRzLCBNb3ZlQ2hpcHMsIE5vdGlmaWVyU2xvdCwgUGxheWVyLCBQbGF5ZmllbGQsIFNsb3QsIFNsb3RDYXJkLCBTbG90Q2hpcCxcbiAgICAgICAgIFdvcmxkQ2FyZCB9IGZyb20gJy4vZ2FtZS5qcydcbmltcG9ydCB7IEltYWdlcyB9IGZyb20gJy4vaW1hZ2VzLmpzJ1xuaW1wb3J0ICogYXMgaXQgZnJvbSAnLi9pdGVyYXRvci5qcydcbmltcG9ydCB7IFZlY3RvciB9IGZyb20gJy4vbWF0aC5qcydcblxuY29uc3QgSGlnaERldGFpbCA9IGZhbHNlXG5cbmZ1bmN0aW9uIGNhcmRGYWNlVXAoaXNTZWNyZXRDb250YWluZXI6IGJvb2xlYW4sIHdjOiBXb3JsZENhcmQpIHtcbiAgbGV0IGZhY2VVcFxuICBpZiAod2MuZmFjZVVwSXNDb25zY2lvdXMpXG4gICAgZmFjZVVwID0gd2MuZmFjZVVwXG4gIGVsc2VcbiAgICBmYWNlVXAgPSAhaXNTZWNyZXRDb250YWluZXJcbiAgcmV0dXJuIHdjLndpdGhGYWNlVXAoZmFjZVVwKVxufVxuXG5hYnN0cmFjdCBjbGFzcyBVSUVsZW1lbnQge1xuICByZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudFxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgZXZlbnRzOiBkb20uRXZlbnRMaXN0ZW5lcnNcblxuICBjb25zdHJ1Y3RvcihlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnRcbiAgICB0aGlzLmV2ZW50cyA9IG5ldyBkb20uRXZlbnRMaXN0ZW5lcnModGhpcy5lbGVtZW50KVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmV2ZW50cy5yZW1vdmVBbGwoKVxuICAgIHRoaXMuZWxlbWVudC5yZW1vdmUoKVxuICB9XG59XG5cbi8qXG4gIEVsZW1lbnRzIHRoYXQgaG9sZCBvdGhlciBjb250YWluZXJzIG9yIFVJQWN0aW9uYWJsZXMuXG4qL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFVJQ29udGFpbmVyIGV4dGVuZHMgVUlFbGVtZW50IHtcbiAgcHJpdmF0ZSBjaGlsZHJlbjogQXJyYXk8VUlBY3Rpb25hYmxlfFVJQ29udGFpbmVyPiA9IFtdXG5cbiAgY29uc3RydWN0b3IoZWxlbWVudDogSFRNTEVsZW1lbnQpIHtcbiAgICBzdXBlcihlbGVtZW50KVxuICB9XG4gIFxuICBhZGQoY2hpbGQ6IFVJQWN0aW9uYWJsZXxVSUNvbnRhaW5lcik6IHZvaWQge1xuICAgIHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZC5lbGVtZW50KVxuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChjaGlsZClcbiAgfVxuXG4gIC8vIE5vdGUgdGhhdCBpdCdzIHBvc3NpYmxlIGZvciB0aGVyZSB0byBiZSBubyBVSUNhcmQgcHJlc2VudCBmb3IgYSBjYXJkLCBldmVuIGlmIGFsbCBjYXJkcyBhcmUgb24gdGhlIHBsYXlmaWVsZCBhcyBpc1xuICAvLyB0eXBpY2FsLlxuICAvL1xuICAvLyBGb3IgZXhhbXBsZSwgdGhlIFwic2luZ2xlIHNsb3RcIiB2aWV3IG9mIHN0b2NrIG1heSBsb2dpY2FsbHkgY29udGFpbiB0aGUgY2FyZCBidXQgYSBVSUNhcmQgd2lsbCBvbmx5IGhhdmUgYmVlblxuICAvLyBjcmVhdGVkIGZvciB0aGUgdG9wIGNhcmQuXG4gIHVpTW92YWJsZXNGb3JTbG90cyhzbG90czogU2xvdFtdKTogVUlNb3ZhYmxlW10ge1xuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmZsYXRNYXAoYyA9PiBjLnVpTW92YWJsZXNGb3JTbG90cyhzbG90cykpXG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHN1cGVyLmRlc3Ryb3koKVxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbilcbiAgICAgIGNoaWxkLmRlc3Ryb3koKVxuICAgIHRoaXMuY2hpbGRyZW4gPSBbXVxuICB9XG5cbiAgd2l0aChmOiAoY250OiB0aGlzKSA9PiB2b2lkKTogdGhpcyB7XG4gICAgZih0aGlzKVxuICAgIHJldHVybiB0aGlzXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFVJQ29udGFpbmVyRGl2IGV4dGVuZHMgVUlDb250YWluZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKVxuICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKFwiY29udGFpbmVyXCIpXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFVJQ29udGFpbmVyRmxleCBleHRlbmRzIFVJQ29udGFpbmVyRGl2IHtcbiAgY29uc3RydWN0b3IoZGlyZWN0aW9uOiBzdHJpbmd8dW5kZWZpbmVkPSdyb3cnLCBncm93OiBib29sZWFufHN0cmluZz0nJywga2xhc3M9XCJjb250YWluZXItZmxleFwiKSB7XG4gICAgc3VwZXIoKVxuICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKGtsYXNzKVxuICAgIHRoaXMuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnXG4gICAgdGhpcy5lbGVtZW50LnN0eWxlLmRpcmVjdGlvbiA9ICdsdHInXG4gICAgaWYgKGdyb3cpXG4gICAgICB0aGlzLmVsZW1lbnQuc3R5bGUuZmxleEdyb3cgPSBcIjFcIlxuICAgIGlmIChkaXJlY3Rpb24gPT0gJ2F3YXJlJylcbiAgICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKFwiZmxleFwiKVxuICAgIGVsc2UgaWYgKGRpcmVjdGlvbiA9PSAnYXdhcmUtcmV2ZXJzZScpXG4gICAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZChcImZsZXgtcmV2ZXJzZVwiKVxuICAgIGVsc2VcbiAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5mbGV4RGlyZWN0aW9uID0gZGlyZWN0aW9uXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFVJU2xvdFJvb3QgZXh0ZW5kcyBVSUNvbnRhaW5lciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIikpXG4gICAgZG9tLmRlbWFuZEJ5SWQoXCJwbGF5ZmllbGRcIikuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KVxuICB9XG59XG5cbi8qXG4gIEVsZW1lbnRzIHRoYXQgY2FuIGJlIGNsaWNrZWQsIHRvdWNoZWQsIGNhbiBoYXZlIGNhcmRzIG1vdmVkIHRvIGFuZCBmcm9tIHRoZW0sIGV0Yy5cbiovXG5hYnN0cmFjdCBjbGFzcyBVSUFjdGlvbmFibGUgZXh0ZW5kcyBVSUVsZW1lbnQge1xuICByZWFkb25seSBpZENudDogc3RyaW5nXG4gIHByb3RlY3RlZCByZWFkb25seSBvd25lcjogUGxheWVyfG51bGxcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IHZpZXdlcjogUGxheWVyXG4gIHByb3RlY3RlZCByZWFkb25seSBzZWxlY3Rpb246IFNlbGVjdGlvblxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgbm90aWZpZXJTbG90OiBOb3RpZmllclNsb3RcbiAgcHJpdmF0ZSByZWFkb25seSBldmVudHNQbGF5ZmllbGQ6IGRvbS5FdmVudExpc3RlbmVyc1xuICBfcGxheWZpZWxkOiBQbGF5ZmllbGRcbiAgXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBpZENudDogc3RyaW5nLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgb3duZXI6IFBsYXllcnxudWxsLCB2aWV3ZXI6IFBsYXllcixcbiAgICAgICAgICAgICAgcGxheWZpZWxkOiBQbGF5ZmllbGQsIG5vdGlmaWVyU2xvdDogTm90aWZpZXJTbG90KSB7XG5cbiAgICBhc3NlcnQoaWRDbnQpXG4gICAgXG4gICAgc3VwZXIoZWxlbWVudClcbiAgICB0aGlzLmlkQ250ID0gaWRDbnRcbiAgICB0aGlzLm93bmVyID0gb3duZXJcbiAgICB0aGlzLnZpZXdlciA9IHZpZXdlclxuICAgIHRoaXMuc2VsZWN0aW9uID0gc2VsZWN0aW9uXG4gICAgdGhpcy5fcGxheWZpZWxkID0gcGxheWZpZWxkXG4gICAgdGhpcy5ub3RpZmllclNsb3QgPSBub3RpZmllclNsb3RcbiAgICB0aGlzLmV2ZW50c1BsYXlmaWVsZCA9IG5ldyBkb20uRXZlbnRMaXN0ZW5lcnModGhpcy5ub3RpZmllclNsb3QuZXZlbnRUYXJnZXQgYXMgRXZlbnRUYXJnZXQpXG4gIH1cblxuICBpbml0KCk6IHRoaXMge1xuICAgIHRoaXMuZXZlbnRzUGxheWZpZWxkLmFkZChcbiAgICAgIFwicGxheWZpZWxkY2hhbmdlXCIsXG4gICAgICAoZTogRXZlbnRQbGF5ZmllbGRDaGFuZ2UpID0+IHsgdGhpcy5vblBsYXlmaWVsZFVwZGF0ZShlLnBsYXlmaWVsZF8pOyByZXR1cm4gdHJ1ZSB9XG4gICAgKVxuICAgIFxuICAgIHRoaXMuZXZlbnRzLmFkZChcImNsaWNrXCIsIHRoaXMub25DbGljay5iaW5kKHRoaXMpKVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBhYnN0cmFjdCB1aU1vdmFibGVzRm9yU2xvdHMoc2xvdHM6IFNsb3RbXSk6IFVJTW92YWJsZVtdXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBvbkFjdGlvbihzZWxlY3RlZDogcmVhZG9ubHkgVUlNb3ZhYmxlW10pOiB2b2lkXG5cbiAgZGVzdHJveSgpIHtcbiAgICBzdXBlci5kZXN0cm95KClcbiAgICB0aGlzLmV2ZW50c1BsYXlmaWVsZC5yZW1vdmVBbGwoKVxuICB9XG4gIFxuICBpc1ZpZXdhYmxlQnkodmlld2VyOiBQbGF5ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5vd25lciA9PSBudWxsIHx8IHZpZXdlciA9PSB0aGlzLm93bmVyXG4gIH1cblxuICBnZXQgaXNTZWNyZXQoKSB7IHJldHVybiB0aGlzLm93bmVyICE9IG51bGwgfVxuICBcbiAgYWJzdHJhY3Qgb25DbGljaygpOiBib29sZWFuXG5cbiAgb25QbGF5ZmllbGRVcGRhdGUocGxheWZpZWxkOiBQbGF5ZmllbGQpIHtcbiAgICB0aGlzLl9wbGF5ZmllbGQgPSBwbGF5ZmllbGRcbiAgfVxufVxuXG4vKlxuICBTaG93cyBvbmUgY2FyZCBzbG90LlxuKi9cbmFic3RyYWN0IGNsYXNzIFVJU2xvdENhcmQgZXh0ZW5kcyBVSUFjdGlvbmFibGUge1xuICBpZFNsb3Q6IG51bWJlclxuICBwcm90ZWN0ZWQgY2hpbGRyZW46IFVJQ2FyZFtdID0gW11cbiAgcHJpdmF0ZSByZWFkb25seSBldmVudHNTbG90OiBkb20uRXZlbnRMaXN0ZW5lcnNcbiAgXG4gIGNvbnN0cnVjdG9yKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBpZENudDogc3RyaW5nLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgb3duZXI6IFBsYXllcnxudWxsLCB2aWV3ZXI6IFBsYXllcixcbiAgICAgICAgICAgICAgcGxheWZpZWxkOiBQbGF5ZmllbGQsIGlkU2xvdDogbnVtYmVyLCBub3RpZmllclNsb3Q6IE5vdGlmaWVyU2xvdCwgcmVhZG9ubHkgaW1hZ2VzOiBJbWFnZXMsXG4gICAgICAgICAgICAgIHJlYWRvbmx5IGFjdGlvbkxvbmdQcmVzcz0nZmxpcCcsIHByaXZhdGUgcmVhZG9ubHkgc2VsZWN0aW9uTW9kZT0nc2luZ2xlJykge1xuXG4gICAgc3VwZXIoZWxlbWVudCwgaWRDbnQsIHNlbGVjdGlvbiwgb3duZXIsIHZpZXdlciwgcGxheWZpZWxkLCBub3RpZmllclNsb3QpXG4gICAgXG4gICAgdGhpcy5pZFNsb3QgPSBpZFNsb3RcblxuICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKFwic2xvdFwiKVxuICAgIFxuICAgIHRoaXMuZXZlbnRzU2xvdCA9IG5ldyBkb20uRXZlbnRMaXN0ZW5lcnMobm90aWZpZXJTbG90LnNsb3QodGhpcy5pZENudCwgdGhpcy5pZFNsb3QpIGFzIEV2ZW50VGFyZ2V0KVxuICAgIHRoaXMuZXZlbnRzU2xvdC5hZGQoXG4gICAgICBcInNsb3RjaGFuZ2VcIixcbiAgICAgIChlOiBFdmVudFNsb3RDaGFuZ2UpID0+IHtcbiAgICAgICAgdGhpcy5jaGFuZ2UoXG4gICAgICAgICAgZS5wbGF5ZmllbGRfLFxuICAgICAgICAgIGUucGxheWZpZWxkLmNvbnRhaW5lckNhcmQoZS5pZENudCkuaGFzU2xvdChlLmlkQ250LCBlLmlkU2xvdCkgP1xuICAgICAgICAgICAgZS5wbGF5ZmllbGQuY29udGFpbmVyQ2FyZChlLmlkQ250KS5zbG90KGUuaWRTbG90KSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBlLnBsYXlmaWVsZF8uY29udGFpbmVyQ2FyZChlLmlkQ250KS5zbG90KGUuaWRTbG90KVxuICAgICAgICApXG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIClcbiAgfVxuXG4gIGFic3RyYWN0IGNoYW5nZShwbGF5ZmllbGRfOiBQbGF5ZmllbGQsIHNsb3Q6IFNsb3RDYXJkfHVuZGVmaW5lZCwgc2xvdF86IFNsb3RDYXJkKTogdm9pZFxuICBcbiAgdWlNb3ZhYmxlc0ZvclNsb3RzKHNsb3RzOiBTbG90W10pOiBVSU1vdmFibGVbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2xvdHMpLnNvbWUocyA9PiB0aGlzLnNsb3QoKS5pcyhzKSkgPyB0aGlzLmNoaWxkcmVuIDogW11cbiAgfVxuICBcbiAgb25DbGljaygpIHtcbiAgICBpZiAoIXRoaXMuc2VsZWN0aW9uLmFjdGl2ZSgpICYmIHRoaXMuc2VsZWN0aW9uTW9kZSA9PSAnYWxsLW9uLXNwYWNlJylcbiAgICAgIHRoaXMuc2VsZWN0aW9uLnNlbGVjdCh0aGlzLmNoaWxkcmVuKVxuICAgIGVsc2VcbiAgICAgIHRoaXMuc2VsZWN0aW9uLmZpbmFsaXplKHRoaXMub25BY3Rpb24uYmluZCh0aGlzKSwgVUlDYXJkKVxuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgXG4gIGRlc3Ryb3koKSB7XG4gICAgc3VwZXIuZGVzdHJveSgpXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKVxuICAgICAgY2hpbGQuZGVzdHJveSgpXG4gICAgdGhpcy5ldmVudHNTbG90LnJlbW92ZUFsbCgpXG4gIH1cbiAgXG4gIHNsb3QoKTogU2xvdENhcmQge1xuICAgIHJldHVybiB0aGlzLl9wbGF5ZmllbGQuY29udGFpbmVyQ2FyZCh0aGlzLmlkQ250KS5zbG90KHRoaXMuaWRTbG90KVxuICB9XG4gIFxuICBvbkNhcmRDbGlja2VkKHVpY2FyZDogVUlDYXJkKSB7XG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uTW9kZSA9PSAnYWxsLXByb2NlZWRpbmcnKSB7XG4gICAgICBjb25zdCBzZWxlY3RlZElkeCA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZih1aWNhcmQpXG4gICAgICBpZiAoc2VsZWN0ZWRJZHggIT0gLTEpIHtcbiAgICAgICAgdGhpcy5zZWxlY3Rpb24uc2VsZWN0KHRoaXMuY2hpbGRyZW4uc2xpY2Uoc2VsZWN0ZWRJZHgpKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbGVjdGlvbi5zZWxlY3QoW3VpY2FyZF0pXG4gICAgfVxuICB9XG4gIFxuICBwcm90ZWN0ZWQgb25BY3Rpb24odWlDYXJkczogcmVhZG9ubHkgVUlDYXJkW10pIHtcbiAgICBjb25zdCBjYXJkc1NyYyA9IHVpQ2FyZHMubWFwKHVpID0+IHVpLndjYXJkKVxuICAgIGFzc2VydChjYXJkc1NyYy5sZW5ndGgsIFwiU291cmNlIGNhcmRzIGVtcHR5XCIpXG4gICAgY29uc3Qgc2xvdFNyYyA9IHVpQ2FyZHNbMF0udWlzbG90LnNsb3QoKVxuICAgIGNvbnN0IHNsb3REc3QgPSB0aGlzLnNsb3QoKVxuICAgIFxuICAgIGNvbnN0IG1vdmUgPSAoKCkgPT4ge1xuICAgICAgaWYgKHNsb3RTcmMuaXMoc2xvdERzdCkpIHtcbiAgICAgICAgLy8gY2FzZSAxOiBzYW1lIHNsb3QuIE9ubHkgcG9zc2libGUgb3V0Y29tZSBpcyBtb3ZlIHRvIGVuZCwgb3RoZXJ3aXNlIGRyb3AgdGFyZ2V0IHdvdWxkIGJlIFVJQ2FyZC5cbiAgICAgICAgcmV0dXJuIG5ldyBNb3ZlQ2FyZHModGhpcy5fcGxheWZpZWxkLnNlcXVlbmNlLCBjYXJkc1NyYywgc2xvdFNyYy5pZCwgc2xvdFNyYy5pZClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNhc2UgMjogZGlmZiBzbG90LiBBbHdheXMgZmxpcCBmYWNlLXVwLCB1bmxlc3MgYSBodW1hbiBwbGF5ZXIgaGFzIGRlbGliZXJhdGVseSBmbGlwcGVkIGl0IHVwIG9yIGRvd24gYmVmb3JlLlxuICAgICAgICByZXR1cm4gbmV3IE1vdmVDYXJkcyhcbiAgICAgICAgICB0aGlzLl9wbGF5ZmllbGQuc2VxdWVuY2UsXG4gICAgICAgICAgY2FyZHNTcmMubWFwKHdjID0+IGNhcmRGYWNlVXAoc2xvdERzdC5jb250YWluZXIodGhpcy5fcGxheWZpZWxkKS5zZWNyZXQsIHdjKSksXG4gICAgICAgICAgc2xvdFNyYy5pZCxcbiAgICAgICAgICBzbG90RHN0LmlkXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9KSgpXG4gICAgXG4gICAgXG4gICAgdGhpcy5ub3RpZmllclNsb3QubW92ZShtb3ZlKVxuICB9XG59XG5cbi8qXG4gIFNob3dzIHRoZSB0b3Btb3N0IGNhcmQgb2YgYSBzaW5nbGUgc2xvdCBhbmQgYSBjYXJkIGNvdW50LlxuKi9cbmV4cG9ydCBjbGFzcyBVSVNsb3RTaW5nbGUgZXh0ZW5kcyBVSVNsb3RDYXJkIHtcbiAgcmVhZG9ubHkgY291bnQ6IEhUTUxFbGVtZW50XG4gIHByaXZhdGUgZWxDYXJkOiBIVE1MRWxlbWVudDtcbiAgXG4gIGNvbnN0cnVjdG9yKGlkQ250OiBzdHJpbmcsIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBvd25lcjogUGxheWVyfG51bGwsIHZpZXdlcjogUGxheWVyLCBwbGF5ZmllbGQ6IFBsYXlmaWVsZCxcbiAgICAgICAgICAgICAgaWRTbG90OiBudW1iZXIsIG5vdGlmaWVyU2xvdDogTm90aWZpZXJTbG90LCBpbWFnZXM6IEltYWdlcywgcHJpdmF0ZSByZWFkb25seSBjYXJkV2lkdGg6IG51bWJlcixcbiAgICAgICAgICAgICAgcHJpdmF0ZSByZWFkb25seSBjYXJkSGVpZ2h0OiBudW1iZXIsIGFjdGlvbkxvbmdQcmVzcz0nZmxpcCcsIGFjdGlvbj86IFtzdHJpbmcsICgpID0+IGJvb2xlYW5dKSB7XG4gICAgc3VwZXIoZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKSwgaWRDbnQsIHNlbGVjdGlvbiwgb3duZXIsIHZpZXdlciwgcGxheWZpZWxkLCBpZFNsb3QsIG5vdGlmaWVyU2xvdCxcbiAgICAgICAgICBpbWFnZXMsIGFjdGlvbkxvbmdQcmVzcylcbiAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZChcInNsb3Qtc2luZ2xlXCIpXG4gICAgdGhpcy5lbGVtZW50LnN0eWxlLndpZHRoID0gY2FyZFdpZHRoLnRvU3RyaW5nKCkrJ3B4J1xuICAgIHRoaXMuY291bnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGFiZWxcIilcbiAgICB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5jb3VudClcbiAgICBcbiAgICB0aGlzLmVsQ2FyZCA9IHRoaXMuc3BhY2VNYWtlKClcbiAgICB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5lbENhcmQpXG5cbiAgICBpZiAoYWN0aW9uKSB7XG4gICAgICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG4gICAgICBidG4uaW5uZXJUZXh0ID0gYWN0aW9uWzBdXG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgYnRuLmRpc2FibGVkID0gIWFjdGlvblsxXSgpXG4gICAgICB9KVxuICAgICAgdGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKGJ0bilcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNwYWNlTWFrZSgpIHtcbiAgICBjb25zdCBzcGFjZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbiAgICBzcGFjZS5zdHlsZS53aWR0aCA9IHRoaXMuY2FyZFdpZHRoKydweCdcbiAgICBzcGFjZS5zdHlsZS5oZWlnaHQgPSB0aGlzLmNhcmRIZWlnaHQrJ3B4J1xuICAgIHJldHVybiBzcGFjZVxuICB9XG4gIFxuICBjaGFuZ2UocGxheWZpZWxkXzogUGxheWZpZWxkLCBzbG90OiBTbG90Q2FyZHx1bmRlZmluZWQsIHNsb3RfOiBTbG90Q2FyZCk6IHZvaWQge1xuICAgIGlmIChzbG90Xy5pc0VtcHR5KCkpIHtcbiAgICAgIGNvbnN0IHNwYWNlID0gdGhpcy5zcGFjZU1ha2UoKVxuICAgICAgdGhpcy5lbENhcmQucmVwbGFjZVdpdGgoc3BhY2UpXG4gICAgICB0aGlzLmVsQ2FyZCA9IHNwYWNlXG4gICAgICB0aGlzLmNoaWxkcmVuID0gW11cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY2FyZCA9IG5ldyBVSUNhcmQoXG4gICAgICAgIHNsb3RfLnRvcCgpLCB0aGlzLCBmYWxzZSwgdGhpcy52aWV3ZXIsIHRoaXMuc2VsZWN0aW9uLCB0aGlzLm5vdGlmaWVyU2xvdCwgdGhpcy5pbWFnZXMsXG4gICAgICAgIHRoaXMuY2FyZFdpZHRoLCB0aGlzLmNhcmRIZWlnaHRcbiAgICAgICkuaW5pdCgpXG4gICAgICB0aGlzLmVsQ2FyZC5yZXBsYWNlV2l0aChjYXJkLmVsZW1lbnQpXG4gICAgICB0aGlzLmVsQ2FyZCA9IGNhcmQuZWxlbWVudFxuICAgICAgdGhpcy5jaGlsZHJlblswXSA9IGNhcmRcbiAgICB9XG4gICAgXG4gICAgdGhpcy5jb3VudC5pbm5lclRleHQgPSBzbG90Xy5sZW5ndGgoKS50b1N0cmluZygpXG4gIH1cbn1cblxuLypcbiAgU2hvd3MgYSBzaW5nbGUgc2xvdCBhcyBhIGZhbiBvZiBjYXJkcy5cbiovXG5leHBvcnQgY2xhc3MgVUlTbG90U3ByZWFkIGV4dGVuZHMgVUlTbG90Q2FyZCB7XG4gIHByaXZhdGUgY2xhc3Nlc0NhcmQ6IHN0cmluZ1tdXG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50XG4gIHByaXZhdGUgY2FyZFdpZHRoOiBudW1iZXJcbiAgcHJpdmF0ZSBjYXJkSGVpZ2h0OiBudW1iZXJcbiAgXG4gIGNvbnN0cnVjdG9yKGlkQ250OiBzdHJpbmcsIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBvd25lcjogUGxheWVyfG51bGwsIHZpZXdlcjogUGxheWVyLCBwbGF5ZmllbGQ6IFBsYXlmaWVsZCwgaWRTbG90OiBudW1iZXIsXG4gICAgICAgICAgICAgIG5vdGlmaWVyU2xvdDogTm90aWZpZXJTbG90LCBpbWFnZXM6IEltYWdlcywgY2FyZFdpZHRoOiBudW1iZXIsIGNhcmRIZWlnaHQ6IG51bWJlcixcbiAgICAgICAgICAgICAgd2lkdGg/OiBzdHJpbmcsIGNsYXNzZXNTbG90Pzogc3RyaW5nW10sIGNsYXNzZXNDYXJkPzogc3RyaW5nW10sIGFjdGlvbkxvbmdQcmVzcz0nZmxpcCcsXG4gICAgICAgICAgICAgIHNlbGVjdGlvbk1vZGU9J3NpbmdsZScpIHtcbiAgICBcbiAgICBzdXBlcihkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLCBpZENudCwgc2VsZWN0aW9uLCBvd25lciwgdmlld2VyLCBwbGF5ZmllbGQsIGlkU2xvdCwgbm90aWZpZXJTbG90LCBpbWFnZXMsXG4gICAgICAgICAgYWN0aW9uTG9uZ1ByZXNzLCBzZWxlY3Rpb25Nb2RlKVxuICAgIGNsYXNzZXNTbG90ID0gY2xhc3Nlc1Nsb3QgfHwgWydzbG90JywgJ3Nsb3Qtb3ZlcmxhcCddXG4gICAgY2xhc3Nlc0NhcmQgPSBjbGFzc2VzQ2FyZCB8fCBbJ2NhcmQnXVxuICAgIHRoaXMuY2xhc3Nlc0NhcmQgPSBjbGFzc2VzQ2FyZFxuICAgIGlmICh3aWR0aClcbiAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS53aWR0aCA9IHdpZHRoXG4gICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uY2xhc3Nlc1Nsb3QpXG4gICAgdGhpcy5jb250YWluZXJFbCA9IHRoaXMuZWxlbWVudFxuICAgIHRoaXMuY2FyZFdpZHRoID0gY2FyZFdpZHRoXG4gICAgdGhpcy5jYXJkSGVpZ2h0ID0gY2FyZEhlaWdodFxuICB9XG5cbiAgY2hhbmdlKHBsYXlmaWVsZF86IFBsYXlmaWVsZCwgc2xvdDogU2xvdENhcmR8dW5kZWZpbmVkLCBzbG90XzogU2xvdENhcmQpOiB2b2lkIHtcbiAgICBjb25zdCBjYXJkc18gPSBBcnJheS5mcm9tKHNsb3RfKVxuXG4gICAgbGV0IGlkeCA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoIC0gMVxuICAgIHdoaWxlIChpZHggPiBjYXJkc18ubGVuZ3RoIC0gMSkge1xuICAgICAgdGhpcy5jaGlsZHJlbltpZHgtLV0uZGVzdHJveSgpXG4gICAgfVxuICAgIFxuICAgIHRoaXMuY2hpbGRyZW4ubGVuZ3RoID0gY2FyZHNfLmxlbmd0aFxuICAgIGlkeCA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoIC0gMVxuXG4gICAgd2hpbGUgKGlkeCA+PSAwKSB7XG4gICAgICBjb25zdCB3Y2FyZCA9IGNhcmRzX1tpZHhdXG4gICAgICBjb25zdCBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baWR4XVxuICAgICAgaWYgKCFjaGlsZCB8fCAhY2hpbGQud2NhcmQuZXF1YWxzKHdjYXJkKSkge1xuICAgICAgICBjb25zdCB1aWNhcmQgPSBuZXcgVUlDYXJkKHdjYXJkLCB0aGlzLCB0cnVlLCB0aGlzLnZpZXdlciwgdGhpcy5zZWxlY3Rpb24sIHRoaXMubm90aWZpZXJTbG90LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaW1hZ2VzLCB0aGlzLmNhcmRXaWR0aCwgdGhpcy5jYXJkSGVpZ2h0LCB0aGlzLmNsYXNzZXNDYXJkKVxuICAgICAgICB1aWNhcmQuaW5pdCgpXG4gICAgICAgIGlmIChIaWdoRGV0YWlsKSB7XG4gICAgICAgICAgLy8gS2VlcCBpdCArMSBqdXN0IGluIGNhc2UgdHJhbnNpdGlvbnMgZXZlciBuZWVkIHRvIGF2b2lkXG4gICAgICAgICAgLy8gb3ZlcmxheWluZyB0aGUgc2FtZSBjYXJkICh0aGVuIHRoZXkgY2FuIC0xKS5cbiAgICAgICAgICB1aWNhcmQuZWxlbWVudC5zdHlsZS56SW5kZXggPSAoaWR4KzEpLnRvU3RyaW5nKCkgXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jaGlsZHJlbltpZHhdID0gdWljYXJkXG4gICAgICAgIGlmIChjaGlsZClcbiAgICAgICAgICBjaGlsZC5lbGVtZW50LnJlcGxhY2VXaXRoKHVpY2FyZC5lbGVtZW50KVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5jb250YWluZXJFbC5pbnNlcnRCZWZvcmUodWljYXJkLmVsZW1lbnQsIHRoaXMuY2hpbGRyZW5baWR4KzFdPy5lbGVtZW50KVxuICAgICAgfVxuICAgICAgLS1pZHhcbiAgICB9XG4gIH1cbn1cblxuLypcbiAgVUkgZWxlbWVudHMgdGhhdCBjYW4gdmlzdWFsaXNlIENvbnRhaW5lclNsb3RzLlxuKi9cbmFic3RyYWN0IGNsYXNzIFVJQ29udGFpbmVyU2xvdHMgZXh0ZW5kcyBVSUFjdGlvbmFibGUge1xuICBwcml2YXRlIHJlYWRvbmx5IGV2ZW50c0NvbnRhaW5lcjogZG9tLkV2ZW50TGlzdGVuZXJzXG4gIFxuICBjb25zdHJ1Y3RvcihlbGVtZW50OiBIVE1MRWxlbWVudCwgaWRDbnQ6IHN0cmluZywgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIG93bmVyOiBQbGF5ZXJ8bnVsbCwgdmlld2VyOiBQbGF5ZXIsXG4gICAgICAgICAgICAgIHBsYXlmaWVsZDogUGxheWZpZWxkLCBub3RpZmllclNsb3Q6IE5vdGlmaWVyU2xvdCkge1xuICAgIHN1cGVyKGVsZW1lbnQsIGlkQ250LCBzZWxlY3Rpb24sIG93bmVyLCB2aWV3ZXIsIHBsYXlmaWVsZCwgbm90aWZpZXJTbG90KVxuXG4gICAgdGhpcy5ldmVudHNDb250YWluZXIgPSBuZXcgZG9tLkV2ZW50TGlzdGVuZXJzKHRoaXMubm90aWZpZXJTbG90LmNvbnRhaW5lcih0aGlzLmlkQ250KSBhcyBFdmVudFRhcmdldClcbiAgICB0aGlzLmV2ZW50c0NvbnRhaW5lci5hZGQoXG4gICAgICBcImNvbnRhaW5lcmNoYW5nZVwiLFxuICAgICAgKGU6IEV2ZW50Q29udGFpbmVyQ2hhbmdlKSA9PiB7XG4gICAgICAgIHRoaXMuY2hhbmdlKGUucGxheWZpZWxkXywgZS5wbGF5ZmllbGQuY29udGFpbmVyQ2FyZChlLmlkQ250KSwgZS5wbGF5ZmllbGRfLmNvbnRhaW5lckNhcmQoZS5pZENudCkpXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgKVxuICB9XG5cbiAgYWJzdHJhY3QgY2hhbmdlKHBsYXlmaWVsZF86IFBsYXlmaWVsZCwgY250OiBDb250YWluZXJTbG90Q2FyZCwgY250XzogQ29udGFpbmVyU2xvdENhcmQpOiB2b2lkXG5cbiAgZGVzdHJveSgpIHtcbiAgICBzdXBlci5kZXN0cm95KClcbiAgICB0aGlzLmV2ZW50c0NvbnRhaW5lci5yZW1vdmVBbGwoKVxuICB9XG59XG5cbi8qXG4gIEEgVUkgZWxlbWVudCB0aGF0IGNhbiB2aXN1YWxpc2UgYSB3aG9sZSBDb250YWluZXJTbG90IGJ5IGRpc3BsYXlpbmcgbXVsdGlwbGUgVUlTbG90U3ByZWFkcyB3aXRoaW4gaXQsIGFuZCBhbGxvd2luZ1xuICBuZXcgc2xvdHMgdG8gYmUgY3JlYXRlZC5cbiovXG5leHBvcnQgY2xhc3MgVUlDb250YWluZXJTbG90c011bHRpIGV4dGVuZHMgVUlDb250YWluZXJTbG90cyB7XG4gIHByaXZhdGUgY2hpbGRyZW46IFVJU2xvdENhcmRbXSA9IFtdXG4gIFxuICBjb25zdHJ1Y3RvcihpZENudDogc3RyaW5nLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgb3duZXI6IFBsYXllcnxudWxsLCB2aWV3ZXI6IFBsYXllciwgcGxheWZpZWxkOiBQbGF5ZmllbGQsXG4gICAgICAgICAgICAgIG5vdGlmaWVyU2xvdDogTm90aWZpZXJTbG90LCBwcml2YXRlIHJlYWRvbmx5IGltYWdlczogSW1hZ2VzLCBwcml2YXRlIHJlYWRvbmx5IGNhcmRXaWR0aDogbnVtYmVyLFxuICAgICAgICAgICAgICBwcml2YXRlIHJlYWRvbmx5IGNhcmRIZWlnaHQ6IG51bWJlciwgaGVpZ2h0OiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgYWN0aW9uTG9uZ1ByZXNzPSdmbGlwJykge1xuICAgIHN1cGVyKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksIGlkQ250LCBzZWxlY3Rpb24sIG93bmVyLCB2aWV3ZXIsIHBsYXlmaWVsZCwgbm90aWZpZXJTbG90KVxuXG4gICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJzbG90XCIpXG4gICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJzbG90LW11bHRpXCIpXG4gICAgdGhpcy5lbGVtZW50LnN0eWxlLm1pbkhlaWdodCA9IGhlaWdodFxuICB9XG5cbiAgdWlNb3ZhYmxlc0ZvclNsb3RzKHNsb3RzOiBTbG90W10pOiBVSU1vdmFibGVbXSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4uZmxhdE1hcCh1aXMgPT4gdWlzLnVpTW92YWJsZXNGb3JTbG90cyhzbG90cykpXG4gIH1cbiAgXG4gIG9uQ2xpY2soKSB7XG4gICAgdGhpcy5zZWxlY3Rpb24uZmluYWxpemUodGhpcy5vbkFjdGlvbi5iaW5kKHRoaXMpLCBVSUNhcmQpXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBcbiAgb25BY3Rpb24oc2VsZWN0ZWQ6IHJlYWRvbmx5IFVJQ2FyZFtdKSB7XG4gICAgY29uc3QgY2FyZHNTcmMgPSBzZWxlY3RlZC5tYXAodWkgPT4gdWkud2NhcmQpXG4gICAgY29uc3QgY2FyZHNEc3QgPSBjYXJkc1NyYy5tYXAod2MgPT4gY2FyZEZhY2VVcChmYWxzZSwgd2MpKVxuICAgIGNvbnN0IHNsb3RTcmMgPSBzZWxlY3RlZFswXS51aXNsb3Quc2xvdCgpXG4gICAgY29uc3QgY250OiBDb250YWluZXJTbG90Q2FyZCA9IHRoaXMuX3BsYXlmaWVsZC5jb250YWluZXJDYXJkKHRoaXMuaWRDbnQpXG4gICAgY29uc3Qgc2xvdE5ld0lkID0gW2NudC5pZCwgKHRoaXMuY2hpbGRyZW5bdGhpcy5jaGlsZHJlbi5sZW5ndGgtMV0/LmlkU2xvdCA/PyAtMSkgKyAxXSBhcyBbc3RyaW5nLCBudW1iZXJdXG5cbiAgICBjb25zdCBtb3ZlID0gbmV3IE1vdmVDYXJkcyh0aGlzLl9wbGF5ZmllbGQuc2VxdWVuY2UsIGNhcmRzRHN0LCBzbG90U3JjLmlkLCBzbG90TmV3SWQsIHVuZGVmaW5lZCwgW3Nsb3ROZXdJZF0pXG4gICAgdGhpcy5ub3RpZmllclNsb3QubW92ZShtb3ZlKVxuICB9XG4gIFxuICBjaGFuZ2UocGxheWZpZWxkXzogUGxheWZpZWxkLCBjbnQ6IENvbnRhaW5lclNsb3RDYXJkLCBjbnRfOiBDb250YWluZXJTbG90Q2FyZCk6IHZvaWQge1xuICAgIC8vIE5vdGUsIHRoaXMgb25seSBjYXRjaGVzIGFkZGl0aW9ucyBhbmQgZGVsZXRpb25zLlxuICAgIC8vIElmIHRoZSBjb250ZW50cyBvZiBhbnkgb2YgdGhlIHNsb3RzIGluIGEgY29udGFpbmVyIGhhdmUgY2hhbmdlZCwgdGhlbiBpdCB3b24ndCBiZSBjb3JyZWN0ZWQgaGVyZS5cbiAgICAvLyBUaGF0IG11c3QgYmUgcGlja2VkIHVwIGJ5IGEgbG90IGNoYW5nZSBldmVudC5cbiAgICBjb25zdCByZW1vdmVkID0gaXQuZmlsdGVyKGNudCwgc2xvdCA9PiAhY250Xy5oYXNTbG90KHNsb3QuaWRDbnQsIHNsb3QuaWRTbG90KSlcbiAgICBcbiAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgcmVtb3ZlZCkge1xuICAgICAgY29uc3QgdWkgPSB0aGlzLmNoaWxkcmVuLmZpbmQodWkgPT4gdWkuc2xvdCgpLmlzKHNsb3QpKVxuICAgICAgaWYgKHVpKSB7XG4gICAgICAgIHVpLmRlc3Ryb3koKVxuICAgICAgICB0aGlzLmNoaWxkcmVuID0gYXJyYXkucmVtb3ZlKHRoaXMuY2hpbGRyZW4sIHVpKVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgY250Xykge1xuICAgICAgY29uc3QgdWkgPSB0aGlzLmNoaWxkcmVuLmZpbmQodWkgPT4gdWkuc2xvdCgpLmlzKHNsb3QpKVxuICAgICAgaWYgKCF1aSkge1xuICAgICAgICBjb25zdCB1aXNsb3QgPSBuZXcgVUlTbG90U3ByZWFkKFxuICAgICAgICAgIGNudC5pZCxcbiAgICAgICAgICB0aGlzLnNlbGVjdGlvbixcbiAgICAgICAgICB0aGlzLm93bmVyLFxuICAgICAgICAgIHRoaXMudmlld2VyLFxuICAgICAgICAgIHBsYXlmaWVsZF8sXG4gICAgICAgICAgc2xvdC5pZFNsb3QsXG4gICAgICAgICAgdGhpcy5ub3RpZmllclNsb3QsXG4gICAgICAgICAgdGhpcy5pbWFnZXMsXG4gICAgICAgICAgdGhpcy5jYXJkV2lkdGgsXG4gICAgICAgICAgdGhpcy5jYXJkSGVpZ2h0LFxuICAgICAgICAgIGAke3RoaXMuY2FyZFdpZHRofXB4YCxcbiAgICAgICAgICBbJ3Nsb3QnLCAnc2xvdC1vdmVybGFwLXZlcnQnXSxcbiAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgdGhpcy5hY3Rpb25Mb25nUHJlc3NcbiAgICAgICAgKVxuXG4gICAgICAgIHVpc2xvdC5pbml0KClcbiAgICAgICAgdWlzbG90LmNoYW5nZShwbGF5ZmllbGRfLCBjbnQuaGFzU2xvdChzbG90LmlkQ250LCBzbG90LmlkU2xvdCkgPyBjbnQuc2xvdChzbG90LmlkU2xvdCkgOiB1bmRlZmluZWQsIHNsb3QpXG4gICAgICAgIHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCh1aXNsb3QuZWxlbWVudClcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKHVpc2xvdClcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFVJTW92YWJsZSBleHRlbmRzIFVJRWxlbWVudCB7XG4gIHByb3RlY3RlZCByZWFkb25seSBzZWxlY3Rpb246IFNlbGVjdGlvblxuICBwcm90ZWN0ZWQgcmVhZG9ubHkgZHJvcFRhcmdldDogYm9vbGVhblxuICBwcml2YXRlIGV2ZW50c0ltZz86IGRvbS5FdmVudExpc3RlbmVyc1xuICBwcml2YXRlIHRpbWVyUHJlc3M/OiBudW1iZXJcbiAgcHJpdmF0ZSB0b3VjaD86IFRvdWNoXG4gIHByaXZhdGUgd2FzTW91c2VEb3duID0gZmFsc2VcbiAgcHJpdmF0ZSBfaXNJblBsYXk6IGJvb2xlYW4gPSB0cnVlXG4gIFxuICBjb25zdHJ1Y3RvcihlbDogSFRNTEVsZW1lbnQsIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBkcm9wVGFyZ2V0OiBib29sZWFuKSB7XG4gICAgc3VwZXIoZWwpXG4gICAgdGhpcy5zZWxlY3Rpb24gPSBzZWxlY3Rpb25cbiAgICB0aGlzLmRyb3BUYXJnZXQgPSBkcm9wVGFyZ2V0XG4gIH1cbiAgXG4gIGFic3RyYWN0IGVxdWFsc1Zpc3VhbGx5KHJoczogdGhpcyk6IGJvb2xlYW5cbiAgYWJzdHJhY3QgaXMocmhzOiB0aGlzKTogYm9vbGVhblxuXG4gIC8vIFRoZSByZWxhdGl2ZSBpbXBvcnRhbmNlIG9mIHRoaXMgbW92YWJsZSdzIGxvY2F0aW9uIGluIHRlcm1zIG9mIHBsYXllcidzIGludGVyZXN0IGluIHRoZSBnYW1lIHN0YXRlLlxuICAvLyBJLmUuIGlmIGluIGEgcGxheWVyJ3Mgc2VjcmV0IGhhbmQsIHRoZW4gaXQgaGFzIGEgdmVyeSBsb3cgaW1wb3J0YW50IGFzIG90aGVycyBjYW4ndCBzZWUgaXQgYW55d2F5LCBhbmQgYW55IG1vdmVzXG4gIC8vIG1hZGUgd2lsbCBiZSB2aXNpYmxlIHRvIHRoZSBwbGF5ZXIgd2hvc2UgaGFuZCBpdCBpcy5cbiAgLy8gVXNlZCB0byBkZXRlcm1pbmUgd2hhdCBraW5kcyBvZiBzb3VuZHMgdG8gcGxheSB3aGVuIHRoZSBlbGVtZW50IG1vdmVzIGFyb3VuZC5cbiAgYWJzdHJhY3QgZ2V0IGxvY2F0aW9uSW1wb3J0YW5jZSgpOiBudW1iZXJcblxuICBpc0luUGxheSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2lzSW5QbGF5IH1cbiAgcmVtb3ZlRnJvbVBsYXkoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uLmluY2x1ZGVzKHRoaXMpKVxuICAgICAgdGhpcy5zZWxlY3Rpb24uZGVzZWxlY3QoW3RoaXNdKVxuICAgIHRoaXMuX2lzSW5QbGF5ID0gZmFsc2VcbiAgfVxuICBcbiAgcHJvdGVjdGVkIGFic3RyYWN0IHBsYXlmaWVsZCgpOiBQbGF5ZmllbGRcbiAgXG4gIGluaXQoKTogdGhpcyB7XG4gICAgdGhpcy5ldmVudHNJbWcgPSBuZXcgZG9tLkV2ZW50TGlzdGVuZXJzKHRoaXMuaW50ZXJhY3Rpb25FbGVtZW50KVxuXG4gICAgZnVuY3Rpb24gbHBNb3VzZVVwKHNlbGY6IFVJTW92YWJsZSkge1xuICAgICAgaWYgKHNlbGYudGltZXJQcmVzcykge1xuICAgICAgICBjYW5jZWwoc2VsZilcbiAgICAgICAgc2VsZi5vbkNsaWNrKClcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGxwTW91c2VEb3duKHNlbGY6IFVJTW92YWJsZSkge1xuICAgICAgY29uc3QgcGYgPSBzZWxmLnBsYXlmaWVsZCgpXG4gICAgICBzZWxmLnRpbWVyUHJlc3MgPSB3aW5kb3cuc2V0VGltZW91dChcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIGNhbmNlbChzZWxmKVxuLy8gICAgICAgICAgd2luZG93LmFsZXJ0KFwibG9uZ3ByZXNzXCIpXG4gICAgICAgICAgc2VsZi50aW1lclByZXNzID0gdW5kZWZpbmVkXG4gICAgICAgICAgc2VsZi5vbkxvbmdQcmVzcyhwZilcbiAgICAgICAgfSwgNTAwKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gY2FuY2VsKHNlbGY6IFVJTW92YWJsZSkge1xuICAgICAgc2VsZi50b3VjaCA9IHVuZGVmaW5lZFxuICAgICAgc2VsZi53YXNNb3VzZURvd24gPSBmYWxzZVxuICAgICAgaWYgKHNlbGYudGltZXJQcmVzcykge1xuICAgICAgICBjbGVhclRpbWVvdXQoc2VsZi50aW1lclByZXNzKVxuICAgICAgICBzZWxmLnRpbWVyUHJlc3MgPSB1bmRlZmluZWRcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgYXNzZXJ0KHRoaXMuZXZlbnRzSW1nLCBcIkZhaWxlZCB0byBjYWxsIGluaXRcIilcbiAgICBcbiAgICAvLyBUb3VjaCBldmVudHMgaGVyZSBtdXN0IGJvdGggYWxsb3cgbG9uZ3ByZXNzIGFuZCBub3QgYmxvY2sgc2Nyb2xsaW5nLiBcInRvdWNoc3RhcnRcIiByZXR1cm4gdHJ1ZSwgc28gXG4gICAgLy8gbW91c2UgZXZlbnRzIHdpbGwgYWxzbyB0aGVuIGJlIHByb2Nlc3NlZCBieSB0aGUgYnJvd3Nlci4gVGhpcyBjb2RlIG11c3QgaWdub3JlIHRoZW0gd2hlcmUgcmVxdWlyZWQuXG4gICAgLy8gVXNpbmcgJ3ByZXZlbnREZWZhdWx0JyBpbiB0b3VjaHN0YXJ0IHdvdWxkIGJsb2NrIHNjcm9sbGluZy5cbiAgICAvLyBBbHNvLCBub3RlIHRoYXQgJ21vdXNlZG93bi9tb3VzZXVwJyBpc24ndCBhY3R1YWxseSBzZW50IHVudGlsIHRoZSB1c2VyIGxpZnRzIHRoZWlyIGZpbmdlci5cbiAgICAvL1xuICAgIC8vIEEgd2VpcmQgc2VxdWVuY2UgdGFrZXMgcGxhY2Ugb24gV2ViS2l0LCB3YXRjaCBvdXQgZm9yIHRoaXM6XG4gICAgLy8gMS4gVXNlciBsb25ncHJlc3Nlcy5cbiAgICAvLyAyLiBDYXJkIGZsaXBzLlxuICAgIC8vIDMuIE5ldyBjYXJkIGVsZW1lbnQgZ2V0cyBubyB0b3VjaCBldmVudHMsIG5vIG1vdXNldXAsIG1vdXNlZG93biwgZXRjLCBqdXN0IGxpa2Ugb3RoZXIgYnJvd3NlcnMuXG4gICAgLy8gNC4gVW5saWtlIG90aGVyIGJyb3dzZXJzLCBhcyBzb29uIGFzIHRoZSB1c2VyIGxpZnRzIHRoZWlyIGZpbmdlciB0aGVuIFwibW91c2Vkb3duXCIgYW5kIFwibW91c2V1cFwiIGFyZSBzZW50LFxuICAgIC8vICAgIGltbWVkaWF0ZWx5IHNlbGVjdGluZyB0aGUgbmV3IGVsZW1lbnQuXG4gICAgdGhpcy5ldmVudHNJbWcuYWRkKFwibW91c2Vkb3duXCIsICgpID0+IHtcbiAgICAgIGlmICghdGhpcy50b3VjaCAmJiB0aGlzLnNlbGVjdGlvbi5sYXN0VG91Y2hlZElkICE9IHRoaXMuaXRlbUlkKSB7XG4gICAgICAgIHRoaXMud2FzTW91c2VEb3duID0gdHJ1ZVxuICAgICAgICBscE1vdXNlRG93bih0aGlzKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfSApXG4gICAgXG4gICAgdGhpcy5ldmVudHNJbWcuYWRkKFwibW91c2V1cFwiLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy53YXNNb3VzZURvd24gJiYgdGhpcy5zZWxlY3Rpb24ubGFzdFRvdWNoZWRJZCAhPSB0aGlzLml0ZW1JZCkge1xuICAgICAgICBscE1vdXNlVXAodGhpcylcbiAgICAgICAgdGhpcy53YXNNb3VzZURvd24gPSBmYWxzZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZWxlY3Rpb24ubGFzdFRvdWNoZWRJZCA9IFwiXCJcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH0pXG4gICAgdGhpcy5ldmVudHNJbWcuYWRkKFwibW91c2VvdXRcIiwgKCkgPT4gY2FuY2VsKHRoaXMpKVxuICAgIFxuICAgIHRoaXMuZXZlbnRzSW1nLmFkZChcbiAgICAgIFwidG91Y2hzdGFydFwiLFxuICAgICAgKGU6IFRvdWNoRXZlbnQpID0+IHtcbiAgICAgICAgLy8gVGhpcyB1bmZvcnR1bmF0ZSB2YXJpYWJsZSBpcyB0aGUgZml4IGZvciB0aGF0IHdlaXJkIFdlYktpdCBiZWhhdmlvdXIgZGVzY3JpYmVkIGFib3ZlLlxuICAgICAgICB0aGlzLnNlbGVjdGlvbi5sYXN0VG91Y2hlZElkID0gdGhpcy5pdGVtSWRcbiAgICAgICAgdGhpcy50b3VjaCA9IGUudG91Y2hlc1swXVxuICAgICAgICBscE1vdXNlRG93bih0aGlzKVxuICAgICAgfSxcbiAgICAgIHtcInBhc3NpdmVcIjogdHJ1ZX1cbiAgICApXG4gICAgXG4gICAgdGhpcy5ldmVudHNJbWcuYWRkKFxuICAgICAgXCJ0b3VjaG1vdmVcIixcbiAgICAgIChlOiBUb3VjaEV2ZW50KSA9PiB7XG4gICAgICAgIGlmICghdGhpcy50b3VjaCB8fCBNYXRoLmFicyhlLnRvdWNoZXNbMF0uc2NyZWVuWSAtIHRoaXMudG91Y2guc2NyZWVuWSkgPiA1KVxuICAgICAgICAgIGNhbmNlbCh0aGlzKVxuICAgICAgfSxcbiAgICAgIHtcInBhc3NpdmVcIjogdHJ1ZX1cbiAgICApXG4gICAgXG4gICAgdGhpcy5ldmVudHNJbWcuYWRkKFwidG91Y2hlbmRcIiwgKCkgPT4ge1xuICAgICAgaWYgKHRoaXMudG91Y2gpXG4gICAgICAgIGxwTW91c2VVcCh0aGlzKVxuICAgICAgXG4gICAgICB0aGlzLnNlbGVjdGlvbi5sYXN0VG91Y2hlZElkID0gXCJcIlxuXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9KVxuXG4gICAgLy8gU3RvcCBzbG90cyBhY3Rpbmcgb24gbW91c2UgZXZlbnRzIHRoYXQgdGhpcyBlbGVtZW50IGhhcyBhY3RlZCBvbi5cbiAgICB0aGlzLmV2ZW50c0ltZy5hZGQoXCJjbGlja1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAoKSA9PiAhKHRoaXMuZHJvcFRhcmdldCB8fCAhdGhpcy5zZWxlY3Rpb24uYWN0aXZlKCkgfHwgdGhpcy5zZWxlY3Rpb24uaW5jbHVkZXModGhpcykpKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgc3VwZXIuZGVzdHJveSgpXG4gICAgdGhpcy5ldmVudHNJbWc/LnJlbW92ZUFsbCgpXG4gIH1cblxuICBvblNlbGVjdCgpIHtcbiAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZChcInNlbGVjdGVkXCIpXG4gIH1cblxuICBvbkRlc2VsZWN0KCkge1xuICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKFwic2VsZWN0ZWRcIilcbiAgfVxuXG4gIGZhZGVUbyhzdGFydDogc3RyaW5nLCBlbmQ6IHN0cmluZywgbXNEdXJhdGlvbjogbnVtYmVyLCBvbkZpbmlzaDogKGU/OiBFdmVudCkgPT4gdm9pZCA9IChlKSA9PiB7fSkge1xuICAgIFxuICAgIGNvbnN0IGZpbHRlckVuZCA9IGAgb3BhY2l0eSgke2VuZH0pYFxuICAgIFxuICAgIGlmICh0aGlzLmVsZW1lbnQuYW5pbWF0ZSkge1xuICAgICAgY29uc3QgYW5pbSA9IHRoaXMuZWxlbWVudC5hbmltYXRlKFxuICAgICAgICBbXG4gICAgICAgICAgeyBmaWx0ZXI6IGAgb3BhY2l0eSgke3N0YXJ0fSlgIH0sXG4gICAgICAgICAgeyBmaWx0ZXI6IGZpbHRlckVuZCB9XG4gICAgICAgIF0sXG4gICAgICAgIHtcbiAgICAgICAgICBkdXJhdGlvbjogbXNEdXJhdGlvbixcbiAgICAgICAgICBlYXNpbmc6ICdlYXNlLWluLW91dCdcbiAgICAgICAgfVxuICAgICAgKVxuICAgICAgYW5pbS5hZGRFdmVudExpc3RlbmVyKFwiZmluaXNoXCIsIG9uRmluaXNoKVxuICAgIH0gZWxzZSB7XG4gICAgICBvbkZpbmlzaCh1bmRlZmluZWQpXG4gICAgfVxuICB9XG4gIFxuICBhbmltYXRlVG8oc3RhcnQ6IFZlY3RvciwgZW5kOiBWZWN0b3IsIHpJbmRleEVuZDogbnVtYmVyLCBtc0R1cmF0aW9uOiBudW1iZXIsXG4gICAgICAgICAgICBvbkZpbmlzaDogKGU/OiBFdmVudCkgPT4gdm9pZCA9IChlKSA9PiB7fSkge1xuXG4gICAgLy8gQ2FyZHMgY2FuJ3QgYmUgaW50ZXJhY3RlZCB3aXRoIGFueW1vcmUgYWZ0ZXIgYW5pbWF0aW5nLiBUaGV5IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBuZXcgY2FyZHMgYXQgdGhlIGVuZCBvZiB0aGVcbiAgICAvLyBhbmltYXRpb24uXG4gICAgdGhpcy5ldmVudHNJbWc/LnJlbW92ZUFsbCgpXG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uLmluY2x1ZGVzKHRoaXMpKVxuICAgICAgdGhpcy5zZWxlY3Rpb24uZGVzZWxlY3QoW3RoaXNdKVxuXG4gICAgY29uc3Qga2ZFbmQgPSB7XG4gICAgICAuLi4oSGlnaERldGFpbCA/IHt6SW5kZXg6IHpJbmRleEVuZC50b1N0cmluZygpfSA6IHt9KSxcbiAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZSgke2VuZFswXS1zdGFydFswXX1weCwgJHtlbmRbMV0gLSBzdGFydFsxXX1weClgXG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGZpbmlzaCA9ICgpID0+IHtcbiAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gPSBrZkVuZC50cmFuc2Zvcm1cbiAgICAgIGlmIChrZkVuZC56SW5kZXgpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnpJbmRleCA9IGtmRW5kLnpJbmRleFxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAodGhpcy5lbGVtZW50LmFuaW1hdGUpIHtcbiAgICAgIHRoaXMuZXZlbnRzLnJlbW92ZUFsbCgpXG4gICAgICB0aGlzLmV2ZW50c0ltZz8ucmVtb3ZlQWxsKClcbiAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSdcbiAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5sZWZ0ID0gc3RhcnRbMF0rJ3B4J1xuICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLnRvcCA9IHN0YXJ0WzFdKydweCdcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KVxuICAgICAgdGhpcy5lbGVtZW50LmFuaW1hdGUoXG4gICAgICAgIFtcbiAgICAgICAgICB7IC4uLihIaWdoRGV0YWlsID8ge3pJbmRleDogdGhpcy5lbGVtZW50LnN0eWxlLnpJbmRleCB8fCAnMCd9IDoge30pLFxuICAgICAgICAgICAgdHJhbnNmb3JtOiAndHJhbnNsYXRlKDBweCwgMHB4KScgfSxcbiAgICAgICAgICBrZkVuZFxuICAgICAgICBdLFxuICAgICAgICB7XG4gICAgICAgICAgZHVyYXRpb246IG1zRHVyYXRpb24sXG4gICAgICAgICAgZWFzaW5nOiAnZWFzZS1pbi1vdXQnXG4gICAgICAgIH1cbiAgICAgICkuYWRkRXZlbnRMaXN0ZW5lcihcImZpbmlzaFwiLCAoZSkgPT4ge1xuICAgICAgICBmaW5pc2goKVxuICAgICAgICBvbkZpbmlzaChlKVxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgZmluaXNoKClcbiAgICAgIG9uRmluaXNoKClcbiAgICB9XG4gIH1cbiAgXG4gIGNvb3Jkc0Fic29sdXRlKCk6IFZlY3RvciB7XG4gICAgY29uc3QgcmVjdFRoaXMgPSB0aGlzLmVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgICByZXR1cm4gW3JlY3RUaGlzLmxlZnQgKyB3aW5kb3cucGFnZVhPZmZzZXQsIHJlY3RUaGlzLnRvcCArIHdpbmRvdy5wYWdlWU9mZnNldF1cbiAgfVxuXG4gIC8vIHBsYXlmaWVsZDogUGxheWZpZWxkIGF0IHRoZSB0aW1lIHRoZSBsb25ncHJlc3Mgd2FzIHN0YXJ0ZWRcbiAgcHJvdGVjdGVkIG9uTG9uZ1ByZXNzKHBsYXlmaWVsZDogUGxheWZpZWxkKSB7fVxuICBcbiAgcHJvdGVjdGVkIG9uQ2xpY2soKSB7fVxuXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBnZXQgaXRlbUlkKCk6IHN0cmluZ1xuXG4gIC8vIEZGIGFuZCBDaHJvbWUgYXJlIGhhcHB5IHRvIGFsbG93IHRoZSB1c2VyIHRvIHNlbGVjdCB2aXNpYmxlIGVsZW1lbnRzIHRoYXQgZXh0ZW5kZWQgYmV5b25kIHRoZSBib3VuZHMgb2YgdGhlaXJcbiAgLy8gcGFyZW50LCBhcyB0aGUgY2FyZHMgaW4gYSBzdGFjayBhcmUuXG4gIC8vIFdlYktpdCBzZWVtcyB0byBoYXZlIHByb2JsZW0gd2l0aCB0aGF0LCBob3dldmVyLiBUaGlzIG1ldGhvZCBzaG91bGQgZ2VuZXJhbGx5IHJldHVybiB0aGUgb3ZlcmZsb3dpbmcgY2hpbGQgZWxlbWVudFxuICAvLyB0byBnZXQgYXJvdW5kIHRoaXMgaXNzdWUuXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBnZXQgaW50ZXJhY3Rpb25FbGVtZW50KCk6IEhUTUxFbGVtZW50XG59XG5cbmV4cG9ydCBjbGFzcyBVSVNsb3RDaGlwIGV4dGVuZHMgVUlBY3Rpb25hYmxlIHtcbiAgcmVhZG9ubHkgaWRTbG90OiBudW1iZXJcbiAgcHJvdGVjdGVkIGNoaWxkcmVuOiBVSUNoaXBbXSA9IFtdXG4gIHByaXZhdGUgcmVhZG9ubHkgY2FyZFdpZHRoOiBudW1iZXJcbiAgcHJpdmF0ZSByZWFkb25seSBldmVudHNTbG90OiBkb20uRXZlbnRMaXN0ZW5lcnNcbiAgcHJpdmF0ZSByZWFkb25seSBjb3VudDogSFRNTExhYmVsRWxlbWVudFxuICBcbiAgY29uc3RydWN0b3IoaWRDbnQ6IHN0cmluZywgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIG93bmVyOiBQbGF5ZXJ8bnVsbCwgdmlld2VyOiBQbGF5ZXIsXG4gICAgICAgICAgICAgIHBsYXlmaWVsZDogUGxheWZpZWxkLCBub3RpZmllclNsb3Q6IE5vdGlmaWVyU2xvdCwgaWRTbG90OiBudW1iZXIsIGNhcmRXaWR0aDogbnVtYmVyKSB7XG5cbiAgICBzdXBlcihkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLCBpZENudCwgc2VsZWN0aW9uLCBvd25lciwgdmlld2VyLCBwbGF5ZmllbGQsIG5vdGlmaWVyU2xvdClcbiAgICBcbiAgICB0aGlzLmlkU2xvdCA9IGlkU2xvdFxuICAgIHRoaXMuY2FyZFdpZHRoID0gY2FyZFdpZHRoXG5cbiAgICB0aGlzLmNvdW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxhYmVsXCIpXG4gICAgdGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuY291bnQpXG4gICAgXG4gICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJzbG90XCIpXG4gICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJzbG90LW92ZXJsYXBcIilcbiAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZChcInNsb3QtY2hpcFwiKVxuXG4gICAgdGhpcy5ldmVudHNTbG90ID0gbmV3IGRvbS5FdmVudExpc3RlbmVycyhub3RpZmllclNsb3Quc2xvdCh0aGlzLmlkQ250LCB0aGlzLmlkU2xvdCkgYXMgRXZlbnRUYXJnZXQpXG4gICAgdGhpcy5ldmVudHNTbG90LmFkZChcbiAgICAgIFwic2xvdGNoYW5nZVwiLFxuICAgICAgKGU6IEV2ZW50U2xvdENoYW5nZSkgPT4ge1xuICAgICAgICB0aGlzLmNoYW5nZShlLnBsYXlmaWVsZF8sIGUucGxheWZpZWxkLmNvbnRhaW5lckNoaXAoZS5pZENudCkuc2xvdChlLmlkU2xvdCksXG4gICAgICAgICAgICAgICAgICAgIGUucGxheWZpZWxkXy5jb250YWluZXJDaGlwKGUuaWRDbnQpLnNsb3QoZS5pZFNsb3QpKVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIClcbiAgfVxuXG4gIHVpTW92YWJsZXNGb3JTbG90cyhzbG90czogU2xvdFtdKTogVUlNb3ZhYmxlW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHNsb3RzKS5zb21lKHMgPT4gdGhpcy5zbG90KCkuaXMocykpID8gdGhpcy5jaGlsZHJlbiA6IFtdXG4gIH1cbiAgXG4gIGNoYW5nZShwbGF5ZmllbGRfOiBQbGF5ZmllbGQsIHNsb3Q6IFNsb3RDaGlwfHVuZGVmaW5lZCwgc2xvdF86IFNsb3RDaGlwKTogdm9pZCB7XG4gICAgY29uc3QgY2hpcHNfID0gQXJyYXkuZnJvbShzbG90XylcblxuICAgIGxldCBpZHggPSB0aGlzLmNoaWxkcmVuLmxlbmd0aCAtIDFcbiAgICB3aGlsZSAoaWR4ID4gY2hpcHNfLmxlbmd0aCAtIDEpIHtcbiAgICAgIHRoaXMuY2hpbGRyZW5baWR4LS1dLmRlc3Ryb3koKVxuICAgIH1cbiAgICBcbiAgICB0aGlzLmNoaWxkcmVuLmxlbmd0aCA9IGNoaXBzXy5sZW5ndGhcbiAgICBpZHggPSB0aGlzLmNoaWxkcmVuLmxlbmd0aCAtIDFcblxuICAgIHdoaWxlIChpZHggPj0gMCkge1xuICAgICAgY29uc3QgY2hpcCA9IGNoaXBzX1tpZHhdXG4gICAgICBjb25zdCBjaGlsZCA9IHRoaXMuY2hpbGRyZW5baWR4XVxuICAgICAgaWYgKCFjaGlsZCB8fCAhY2hpbGQuY2hpcC5pcyhjaGlwKSkge1xuICAgICAgICBjb25zdCB1aWNoaXAgPSBuZXcgVUlDaGlwKHRoaXMuc2VsZWN0aW9uLCBjaGlwLCB0aGlzLCB0aGlzLmNhcmRXaWR0aClcbiAgICAgICAgdWljaGlwLmluaXQoKVxuICAgICAgICBcbiAgICAgICAgaWYgKEhpZ2hEZXRhaWwpIHtcbiAgICAgICAgICAvLyBLZWVwIGl0ICsxIGp1c3QgaW4gY2FzZSB0cmFuc2l0aW9ucyBldmVyIG5lZWQgdG8gYXZvaWRcbiAgICAgICAgICAvLyBvdmVybGF5aW5nIHRoZSBzYW1lIGNoaXAgKHRoZW4gdGhleSBjYW4gLTEpLlxuICAgICAgICAgIHVpY2hpcC5lbGVtZW50LnN0eWxlLnpJbmRleCA9IChpZHgrMSkudG9TdHJpbmcoKVxuICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgdGhpcy5jaGlsZHJlbltpZHhdID0gdWljaGlwXG4gICAgICAgIHRoaXMuZWxlbWVudC5pbnNlcnRCZWZvcmUodWljaGlwLmVsZW1lbnQsIHRoaXMuY2hpbGRyZW5baWR4KzFdPy5lbGVtZW50KVxuICAgICAgfVxuICAgICAgLS1pZHhcbiAgICB9XG4gICAgdGhpcy5jb3VudC5pbm5lclRleHQgPSAn4Li/JyArIHRoaXMuY2hpbGRyZW4ubWFwKHVpID0+IHVpLmNoaXAudmFsdWUpLnJlZHVjZSgoYSxiKSA9PiBhICsgYiwgMClcbiAgfVxuICBcbiAgZGVzdHJveSgpIHtcbiAgICBzdXBlci5kZXN0cm95KClcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pXG4gICAgICBjaGlsZC5kZXN0cm95KClcbiAgICB0aGlzLmV2ZW50c1Nsb3QucmVtb3ZlQWxsKClcbiAgfVxuICBcbiAgc2xvdCgpOiBTbG90Q2hpcCB7XG4gICAgcmV0dXJuIHRoaXMuX3BsYXlmaWVsZC5jb250YWluZXJDaGlwKHRoaXMuaWRDbnQpLnNsb3QodGhpcy5pZFNsb3QpXG4gIH1cblxuICB0b3AoKTogVUlDaGlwfHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW5bdGhpcy5jaGlsZHJlbi5sZW5ndGgtMV1cbiAgfVxuICBcbiAgb25DbGljaygpIHtcbiAgICBpZiAodGhpcy5zZWxlY3Rpb24uYWN0aXZlKCkpXG4gICAgICB0aGlzLnNlbGVjdGlvbi5maW5hbGl6ZSh0aGlzLm9uQWN0aW9uLmJpbmQodGhpcyksIFVJQ2hpcClcbiAgICBlbHNlIHtcbiAgICAgIGNvbnN0IHZhbHVlVG9TZWxlY3QgPSB0aGlzLnRvcCgpPy5jaGlwLnZhbHVlXG4gICAgICB0aGlzLnNlbGVjdGlvbi5zZWxlY3QodGhpcy5jaGlsZHJlbi5maWx0ZXIodWkgPT4gdWkuY2hpcC52YWx1ZSA9PSB2YWx1ZVRvU2VsZWN0KSlcbiAgICB9XG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICBcbiAgcHJvdGVjdGVkIG9uQWN0aW9uKHNlbGVjdGVkOiByZWFkb25seSBVSUNoaXBbXSkge1xuICAgIGFzc2VydChzZWxlY3RlZC5ldmVyeSh1aSA9PiB1aS51aXNsb3Quc2xvdCgpID09IHNlbGVjdGVkWzBdLnVpc2xvdC5zbG90KCkpLCBcIkNoaXAgc2VsZWN0aW9uIGhhcyBkaWZmZXJlbnQgc2xvdHNcIilcbiAgICBjb25zdCBzbG90U3JjID0gc2VsZWN0ZWRbMF0udWlzbG90LnNsb3QoKVxuICAgIGNvbnN0IHRvTW92ZSA9IHNlbGVjdGVkXG4gICAgY29uc3QgY2hpcHNTcmMgPSB0b01vdmUubWFwKHVpID0+IHVpLmNoaXApXG4gICAgY29uc3Qgc2xvdERzdCA9IHRoaXMuc2xvdCgpXG4gICAgaWYgKCFzbG90U3JjLmlzKHNsb3REc3QpKSB7XG4gICAgICB0aGlzLm5vdGlmaWVyU2xvdC5tb3ZlKG5ldyBNb3ZlQ2hpcHModGhpcy5fcGxheWZpZWxkLnNlcXVlbmNlLCBjaGlwc1NyYywgc2xvdFNyYy5pZCwgc2xvdERzdC5pZCkpXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBVSUNoaXAgZXh0ZW5kcyBVSU1vdmFibGUge1xuICByZWFkb25seSBjaGlwOiBDaGlwXG4gIHJlYWRvbmx5IHVpc2xvdDogVUlTbG90Q2hpcFxuICByZWFkb25seSBpbWc6IEhUTUxEaXZFbGVtZW50XG5cbiAgY29uc3RydWN0b3Ioc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGNoaXA6IENoaXAsIHVpc2xvdDogVUlTbG90Q2hpcCwgY2FyZFdpZHRoOiBudW1iZXIpIHtcbiAgICBzdXBlcihkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLCBzZWxlY3Rpb24sIHRydWUpXG4gICAgdGhpcy51aXNsb3QgPSB1aXNsb3RcbiAgICB0aGlzLmNoaXAgPSBjaGlwXG5cbiAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZChcImNoaXBcIilcblxuICAgIHRoaXMuaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgIHRoaXMuaW1nLnN0eWxlLndpZHRoID0gY2FyZFdpZHRoICogMC43NSArICdweCdcbiAgICB0aGlzLmltZy5zdHlsZS5oZWlnaHQgPSBjYXJkV2lkdGggKiAwLjc1ICsgJ3B4J1xuICAgIHRoaXMuaW1nLnN0eWxlLmNvbnRlbnQgPSBcInVybChpbWcvY2hpcHMuc3ZnI1wiICsgdGhpcy5jaGlwLnZhbHVlICsgXCIpXCJcbiAgICB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5pbWcpXG4gIH1cblxuICBwcm90ZWN0ZWQgcGxheWZpZWxkKCk6IFBsYXlmaWVsZCB7XG4gICAgcmV0dXJuIHRoaXMudWlzbG90Ll9wbGF5ZmllbGRcbiAgfVxuICBcbiAgaXMocmhzOiBVSUNoaXApIHtcbiAgICByZXR1cm4gdGhpcy5jaGlwLmlzKHJocy5jaGlwKVxuICB9XG5cbiAgZXF1YWxzVmlzdWFsbHkocmhzOiBVSUNoaXApIHtcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgcHJvdGVjdGVkIG9uQ2xpY2soKSB7XG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uLmFjdGl2ZSgpKVxuICAgICAgdGhpcy51aXNsb3Qub25DbGljaygpXG4gICAgZWxzZVxuICAgICAgdGhpcy5zZWxlY3Rpb24uc2VsZWN0KFt0aGlzXSlcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXQgaXRlbUlkKCkgeyByZXR1cm4gdGhpcy5jaGlwLmlkLnRvU3RyaW5nKCkgfVxuICBwcm90ZWN0ZWQgZ2V0IGludGVyYWN0aW9uRWxlbWVudCgpIHsgcmV0dXJuIHRoaXMuaW1nIH1cbiAgZ2V0IGxvY2F0aW9uSW1wb3J0YW5jZSgpIHsgcmV0dXJuIDAgfVxufVxuXG4vKlxuICBBc3N1bXB0aW9uczogMS0+MSBVSUNhcmQtPkNhcmQgb24gZ2l2ZW4gUGxheWZpZWxkXG4qL1xuZXhwb3J0IGNsYXNzIFVJQ2FyZCBleHRlbmRzIFVJTW92YWJsZSB7XG4gIHJlYWRvbmx5IHdjYXJkOiBXb3JsZENhcmRcbiAgcmVhZG9ubHkgdWlzbG90OiBVSVNsb3RDYXJkXG4gIHByaXZhdGUgcmVhZG9ubHkgZmFjZVVwOiBib29sZWFuXG4gIHByaXZhdGUgbm90aWZpZXJTbG90OiBOb3RpZmllclNsb3RcbiAgcHJpdmF0ZSByZWFkb25seSBpbWc6IEhUTUxEaXZFbGVtZW50XG4gIFxuICBjb25zdHJ1Y3Rvcih3Y2FyZDogV29ybGRDYXJkLCB1aXNsb3Q6IFVJU2xvdENhcmQsIGRyb3BUYXJnZXQ6IGJvb2xlYW4sIHZpZXdlcjogUGxheWVyLCBzZWxlY3Rpb246IFNlbGVjdGlvbixcbiAgICAgICAgICAgICAgbm90aWZpZXJTbG90OiBOb3RpZmllclNsb3QsIGltYWdlczogSW1hZ2VzLFxuICAgICAgICAgICAgICBjYXJkV2lkdGg6IG51bWJlciwgY2FyZEhlaWdodDogbnVtYmVyLCBjbGFzc2VzQ2FyZD1bXCJjYXJkXCJdKSB7XG4gICAgc3VwZXIoZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKSwgc2VsZWN0aW9uLCBkcm9wVGFyZ2V0KVxuICAgIHRoaXMud2NhcmQgPSB3Y2FyZFxuICAgIHRoaXMudWlzbG90ID0gdWlzbG90XG4gICAgdGhpcy5ub3RpZmllclNsb3QgPSBub3RpZmllclNsb3RcbiAgICB0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5jbGFzc2VzQ2FyZClcbiAgICB0aGlzLmZhY2VVcCA9IHdjYXJkLmZhY2VVcCAmJiAodGhpcy51aXNsb3QuaXNWaWV3YWJsZUJ5KHZpZXdlcikgfHwgd2NhcmQuZmFjZVVwSXNDb25zY2lvdXMpXG5cbiAgICB0aGlzLmltZyA9IHRoaXMuZmFjZVVwID9cbiAgICAgIGltYWdlcy5jYXJkKHdjYXJkLmNhcmQuc3VpdCwgd2NhcmQuY2FyZC5yYW5rKSA6XG4gICAgICBpbWFnZXMuY2FyZEJhY2suY2xvbmVOb2RlKCkgYXMgSFRNTERpdkVsZW1lbnRcblxuICAgIGlmICh3Y2FyZC50dXJuZWQpIHtcbiAgICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCd0dXJuZWQnKVxuICAgIH1cbiAgICBcbiAgICB0aGlzLmltZy5zdHlsZS53aWR0aCA9IGNhcmRXaWR0aCArICdweCdcbiAgICB0aGlzLmltZy5zdHlsZS5oZWlnaHQgPSBjYXJkSGVpZ2h0ICsgJ3B4J1xuXG4gICAgdGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuaW1nKVxuICB9XG5cbiAgcHJvdGVjdGVkIHBsYXlmaWVsZCgpOiBQbGF5ZmllbGQge1xuICAgIHJldHVybiB0aGlzLnVpc2xvdC5fcGxheWZpZWxkXG4gIH1cbiAgXG4gIGVxdWFsc1Zpc3VhbGx5KHJoczogdGhpcykge1xuICAgIHJldHVybiB0aGlzLndjYXJkLmNhcmQuaXMocmhzLndjYXJkLmNhcmQpICYmIHRoaXMuZmFjZVVwID09IHJocy5mYWNlVXBcbiAgfVxuXG4gIGlzKHJoczogdGhpcyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLndjYXJkLmlzKHJocy53Y2FyZClcbiAgfVxuICBcbiAgcHJpdmF0ZSBkb01vdmUodWljYXJkczogcmVhZG9ubHkgVUlDYXJkW10pIHtcbiAgICBhc3NlcnQodWljYXJkcy5sZW5ndGgsIFwiTW92ZSBvZiBubyBjYXJkc1wiKVxuICAgIGNvbnN0IGNhcmRzU3JjID0gdWljYXJkcy5tYXAodWkgPT4gdWkud2NhcmQpXG4gICAgY29uc3Qgc2xvdFNyYyA9IHVpY2FyZHNbMF0udWlzbG90LnNsb3QoKVxuICAgIGNvbnN0IHNsb3REc3QgPSB0aGlzLnVpc2xvdC5zbG90KClcblxuICAgIGNvbnN0IG1vdmUgPSAoKCkgPT4ge1xuICAgICAgaWYgKHNsb3RTcmMuaXMoc2xvdERzdCkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNb3ZlQ2FyZHModGhpcy5wbGF5ZmllbGQoKS5zZXF1ZW5jZSwgY2FyZHNTcmMsIHNsb3RTcmMuaWQsIHNsb3RTcmMuaWQsIHRoaXMud2NhcmQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IE1vdmVDYXJkcyhcbiAgICAgICAgICB0aGlzLnBsYXlmaWVsZCgpLnNlcXVlbmNlLCBcbiAgICAgICAgICBjYXJkc1NyYy5tYXAod2MgPT4gY2FyZEZhY2VVcChzbG90RHN0LmNvbnRhaW5lcih0aGlzLnBsYXlmaWVsZCgpKS5zZWNyZXQsIHdjKSksXG4gICAgICAgICAgc2xvdFNyYy5pZCxcbiAgICAgICAgICBzbG90RHN0LmlkLFxuICAgICAgICAgIHRoaXMud2NhcmRcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0pKClcbiAgICBcbiAgICB0aGlzLm5vdGlmaWVyU2xvdC5tb3ZlKG1vdmUpXG4gIH1cbiAgXG4gIHByb3RlY3RlZCBvbkNsaWNrKCkge1xuICAgIC8vIFRoaXMgbG9naWMgaXMgbmVjZXNzYXJ5IHRvIGFsbG93IG5vbi1kcm9wIHRhcmdldHMgKHNpbmdsZSBzbG90KSB0byBoYXZlIHRoaXMgYWN0aW9uIGZhbGwgdGhyb3VnaCB0byB0aGUgc2xvdC5cbiAgICBpZiAodGhpcy5kcm9wVGFyZ2V0ICYmIHRoaXMuc2VsZWN0aW9uLmFjdGl2ZSgpICYmICF0aGlzLnNlbGVjdGlvbi5pbmNsdWRlcyh0aGlzKSkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uZmluYWxpemUodGhpcy5kb01vdmUuYmluZCh0aGlzKSwgVUlDYXJkKVxuICAgIH0gZWxzZSBpZiAodGhpcy5zZWxlY3Rpb24uYWN0aXZlKCkgJiYgdGhpcy5zZWxlY3Rpb24uaW5jbHVkZXModGhpcykpIHtcbiAgICAgIHRoaXMuc2VsZWN0aW9uLmRlc2VsZWN0KClcbiAgICB9IGVsc2UgaWYgKCF0aGlzLnNlbGVjdGlvbi5hY3RpdmUoKSkge1xuICAgICAgdGhpcy51aXNsb3Qub25DYXJkQ2xpY2tlZCh0aGlzKVxuICAgIH1cbiAgfVxuICBcbiAgcHJvdGVjdGVkIG9uTG9uZ1ByZXNzKHBsYXlmaWVsZDogUGxheWZpZWxkKSB7XG4gICAgLy8gUGxheWZpZWxkIG1heSBoYXZlIGNoYW5nZWQgc2luY2UgcHJlc3Mgd2FzIGluaXRpYXRlZFxuICAgIGlmIChwbGF5ZmllbGQgPT0gdGhpcy51aXNsb3QuX3BsYXlmaWVsZCkge1xuICAgICAgaWYgKHRoaXMudWlzbG90LmFjdGlvbkxvbmdQcmVzcyA9PSAnZmxpcCcpIHtcbiAgICAgICAgdGhpcy5mbGlwKClcbiAgICAgIH0gZWxzZSBpZiAodGhpcy51aXNsb3QuYWN0aW9uTG9uZ1ByZXNzID09ICd0dXJuJykge1xuICAgICAgICB0aGlzLnR1cm4oKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXNzZXJ0KFwiVW5rbm93biBsb25ncHJlc3MgYWN0aW9uXCIsIHRoaXMudWlzbG90LmFjdGlvbkxvbmdQcmVzcylcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZmxpcCgpIHtcbiAgICBjb25zdCBtb3ZlID0gbmV3IE1vdmVDYXJkcyhcbiAgICAgIHRoaXMucGxheWZpZWxkKCkuc2VxdWVuY2UsXG4gICAgICBbdGhpcy53Y2FyZC53aXRoRmFjZVN0YXRlQ29uc2Npb3VzKCF0aGlzLndjYXJkLmZhY2VVcCwgdGhpcy53Y2FyZC5mYWNlVXApXSxcbiAgICAgIHRoaXMudWlzbG90LnNsb3QoKS5pZCxcbiAgICAgIHRoaXMudWlzbG90LnNsb3QoKS5pZCxcbiAgICAgIHRoaXMudWlzbG90LnNsb3QoKS5uZXh0KHRoaXMud2NhcmQpXG4gICAgKVxuICAgIHRoaXMubm90aWZpZXJTbG90Lm1vdmUobW92ZSlcbiAgfVxuICBcbiAgcHJpdmF0ZSB0dXJuKCkge1xuICAgIGNvbnN0IG1vdmUgPSBuZXcgTW92ZUNhcmRzKFxuICAgICAgdGhpcy5wbGF5ZmllbGQoKS5zZXF1ZW5jZSxcbiAgICAgIFt0aGlzLndjYXJkLndpdGhUdXJuZWQoIXRoaXMud2NhcmQudHVybmVkKV0sXG4gICAgICB0aGlzLnVpc2xvdC5zbG90KCkuaWQsXG4gICAgICB0aGlzLnVpc2xvdC5zbG90KCkuaWQsXG4gICAgICB0aGlzLnVpc2xvdC5zbG90KCkubmV4dCh0aGlzLndjYXJkKVxuICAgIClcbiAgICB0aGlzLm5vdGlmaWVyU2xvdC5tb3ZlKG1vdmUpXG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0IGl0ZW1JZCgpIHsgcmV0dXJuIHRoaXMud2NhcmQuaWQudG9TdHJpbmcoKSB9XG4gIHByb3RlY3RlZCBnZXQgaW50ZXJhY3Rpb25FbGVtZW50KCkgeyByZXR1cm4gdGhpcy5pbWcgfVxuICBnZXQgbG9jYXRpb25JbXBvcnRhbmNlKCkge1xuICAgIGlmICh0aGlzLnVpc2xvdC5pc1NlY3JldClcbiAgICAgIHJldHVybiAwXG4gICAgZWxzZVxuICAgICAgcmV0dXJuIDFcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uIHtcbiAgcHJpdmF0ZSBzZWxlY3RlZDogcmVhZG9ubHkgVUlNb3ZhYmxlW10gPSBbXVxuICBsYXN0VG91Y2hlZElkID0gXCJcIlxuXG4gIHNlbGVjdChzZWxlY3RzOiByZWFkb25seSBVSU1vdmFibGVbXSkge1xuICAgIGNvbnN0IGRlc2VsZWN0cyA9IHRoaXMuc2VsZWN0ZWQuZmlsdGVyKHMgPT4gIXNlbGVjdHMuaW5jbHVkZXMocykpXG4gICAgY29uc3QgbmV3c2VsZWN0cyA9IHNlbGVjdHMuZmlsdGVyKHMgPT4gIXRoaXMuc2VsZWN0ZWQuaW5jbHVkZXMocykpXG4gICAgdGhpcy5kZXNlbGVjdChkZXNlbGVjdHMpXG4gICAgdGhpcy5zZWxlY3RlZCA9IHNlbGVjdHNcbiAgICBmb3IgKGNvbnN0IHMgb2YgbmV3c2VsZWN0cykgcy5vblNlbGVjdCgpXG4gIH1cblxuICBkZXNlbGVjdChzZWxlY3RzOiByZWFkb25seSBVSU1vdmFibGVbXT10aGlzLnNlbGVjdGVkKSB7XG4gICAgYXNzZXJ0KHNlbGVjdHMuZXZlcnkocyA9PiB0aGlzLnNlbGVjdGVkLmluY2x1ZGVzKHMpKSwgXCJEZXNlbGVjdCBvZiB1bnNlbGVjdGVkIGVsZW1cIilcbiAgICBmb3IgKGNvbnN0IHMgb2Ygc2VsZWN0cykgcy5vbkRlc2VsZWN0KClcbiAgICB0aGlzLnNlbGVjdGVkID0gdGhpcy5zZWxlY3RlZC5maWx0ZXIocyA9PiAhc2VsZWN0cy5pbmNsdWRlcyhzKSlcbiAgfVxuXG4gIGZpbmFsaXplPFQgZXh0ZW5kcyBVSU1vdmFibGU+KGZ1bmM6IChzZWxlY3RlZDogcmVhZG9ubHkgVFtdKSA9PiB2b2lkLCBrbGFzczogbmV3ICguLi5hcmdzOiBhbnkpID0+IFQpIHtcbiAgICBpZiAodGhpcy5zZWxlY3RlZC5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAodGhpcy5pc0NvbnNpc3RlbnQoKSkge1xuICAgICAgICBpZiAodGhpcy5zZWxlY3RlZC5ldmVyeShzID0+IHMgaW5zdGFuY2VvZiBrbGFzcykpIHtcbiAgICAgICAgICBpZiAodGhpcy5zZWxlY3RlZC5sZW5ndGggPiAwKVxuICAgICAgICAgICAgZnVuYyh0aGlzLnNlbGVjdGVkIGFzIFRbXSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5kZWJ1ZyhcIlNvbWUgZWxlbWVudHMgb2Ygc2VsZWN0aW9uIGluY29uc2lzdGVudCB3aXRoIGN1cnJlbnQgcGxheWZpZWxkLCBzZWxlY3Rpb24gbm90IGZpbmFsaXplZFwiKVxuICAgICAgfVxuICAgICAgXG4gICAgICB0aGlzLmRlc2VsZWN0KHRoaXMuc2VsZWN0ZWQpXG4gICAgfVxuICB9XG5cbiAgaW5jbHVkZXMoczogVUlNb3ZhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWQuaW5jbHVkZXMocylcbiAgfVxuXG4gIGFjdGl2ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZC5sZW5ndGggPiAwXG4gIH1cblxuICBwcml2YXRlIGlzQ29uc2lzdGVudCgpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RlZC5ldmVyeShtID0+IG0uaXNJblBsYXkoKSlcbiAgfVxufVxuIl19