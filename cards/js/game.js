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
import { assert, assertf } from './assert.js';
import * as array from './array.js';
import * as dom from './dom.js'; // remove this
import * as it from './iterator.js';
export var ConflictResolution;
(function (ConflictResolution) {
    ConflictResolution[ConflictResolution["LEFT_STAY"] = 0] = "LEFT_STAY";
    ConflictResolution[ConflictResolution["RIGHT_STAY"] = 1] = "RIGHT_STAY";
    ConflictResolution[ConflictResolution["BOTH_STAY"] = 2] = "BOTH_STAY";
    ConflictResolution[ConflictResolution["BOTH_REMOVE"] = 3] = "BOTH_REMOVE";
})(ConflictResolution || (ConflictResolution = {}));
export class MoveItems {
    constructor(turnSequence, items, idSource, idDest, destBeforeItem, slotsNew = [], timestamp = new Date().getTime()
    // tbd: ordering? I.e. move 5 cards into deck, have them all order correctly.
    ) {
        this.turnSequence = turnSequence;
        this.items = items;
        this.idSource = idSource;
        this.idDest = idDest;
        this.destBeforeItem = destBeforeItem;
        this.slotsNew = slotsNew;
        this.timestamp = timestamp;
    }
    apply(playfield) {
        assert(playfield.sequence == this.turnSequence);
        // "Invalid" moves are ignored. How can a move be invalid? One way:
        // 1. Client receives a move in a previous turn that generates a conflict.
        // 2. Conflict resolution invalidates moves in the proceeding turns.
        // 3. Client receives a move having a cause/effect relationship with an invalidated move, from a client who hasn't
        //    yet assimilated the conflict resolution.
        //
        // It would be better to detect this case in some other way, to avoid the need for this logic.
        // Re-write sequence numbers?
        // Version turns?
        const allNewSlotsNotExisting = this.slotsNew.length == 0 ||
            this.slotsNew.every(([idCnt, id]) => !playfield.container(idCnt).hasSlot(idCnt, id));
        // tbd: check "before"
        const moveToNewSlot = this.slotsNew.some(([idCnt, id]) => this.idDest[0] == idCnt && this.idDest[1] == id);
        if (allNewSlotsNotExisting && (moveToNewSlot || this.isValid(playfield)))
            return this.doApply(playfield);
        else {
            console.error("Invalid move discarded during apply", this, playfield);
            return playfield.withTurnSequence(this.turnSequence);
        }
    }
    // Two moves conflict if:
    // * They use any of the same cards.
    // * They create the same slot.
    isConflictingWith(rhs) {
        return rhs !== this &&
            (rhs.items.some(ri => this.items.some(li => li.is(ri))) ||
                rhs.slotsNew.some(rs => this.slotsNew.some(ls => array.equals(ls, rs))));
    }
    resolveConflictWith(rhs) {
        if (this === rhs) {
            return ConflictResolution.BOTH_STAY;
        }
        else if (this.isConflictingWith(rhs)) {
            if (this.timestamp == rhs.timestamp)
                return ConflictResolution.BOTH_REMOVE;
            else
                return this.timestamp < rhs.timestamp ? ConflictResolution.LEFT_STAY : ConflictResolution.RIGHT_STAY;
        }
        else {
            return ConflictResolution.BOTH_STAY;
        }
    }
    // Doesn't include new slots
    get slotsChanged() {
        if (array.equals(this.idSource, this.idDest))
            return [this.idSource];
        else
            return [this.idSource, this.idDest];
    }
    serialize() {
        var _a;
        return {
            turnSequence: this.turnSequence,
            items: this.items.map(c => c.serialize()),
            idSource: this.idSource,
            idDest: this.idDest,
            destBeforeItem: (_a = this.destBeforeItem) === null || _a === void 0 ? void 0 : _a.serialize(),
            slotsNew: this.slotsNew,
            timestamp: this.timestamp
        };
    }
}
export class MoveCards extends MoveItems {
    // Note: TypeScript inherits superclass constructors
    isValid(pf) {
        const src = pf.containerCard(this.idSource[0]).slot(this.idSource[1]);
        const dst = pf.containerCard(this.idDest[0]).slot(this.idDest[1]);
        // Note: the absence of the dstBeforeItem in the target slot doesn't have to invalidate the move.
        // TBD: use an index instead of dstBefore item
        return this.items.every(i => src.hasItem(i) &&
            (src.is(dst) || !dst.hasItem(i)));
    }
    makeSlotsNew() {
        return this.slotsNew.map(([idCnt, id]) => new SlotCard(idCnt, id));
    }
    doApply(playfield) {
        return playfield.withMoveCards(this);
    }
    serialize() {
        return { ...super.serialize(), type: "MoveCards" };
    }
    static fromSerialized(s) {
        return new MoveCards(s.turnSequence, s.items.map((e) => WorldCard.fromSerialized(e)), s.idSource, s.idDest, s.destBeforeItem ? WorldCard.fromSerialized(s.destBeforeItem) : undefined, s.slotsNew, s.timestamp);
    }
}
export class MoveChips extends MoveItems {
    // Note: TypeScript inherits superclass constructors
    isValid(pf) {
        const src = pf.containerChip(this.idSource[0]).slot(this.idSource[1]);
        const dst = pf.containerChip(this.idDest[0]).slot(this.idDest[1]);
        return this.items.every(i => src.hasItem(i) &&
            (src.is(dst) || !dst.hasItem(i)));
    }
    makeSlotsNew() {
        return this.slotsNew.map(([idCnt, id]) => new SlotChip(idCnt, id));
    }
    doApply(playfield) {
        return playfield.withMoveChips(this);
    }
    serialize() {
        return { ...super.serialize(), type: "MoveChips" };
    }
    static fromSerialized(s) {
        return new MoveChips(s.turnSequence, s.items.map((e) => Chip.fromSerialized(e)), s.idSource, s.idDest, s.destBeforeItem ? Chip.fromSerialized(s.destBeforeItem) : undefined, s.slotsNew, s.timestamp);
    }
}
export function deserializeMove(s) {
    if (s.type == "MoveCards")
        return MoveCards.fromSerialized(s);
    else if (s.type == "MoveChips")
        return MoveChips.fromSerialized(s);
    else
        throw new Error("Unknown type " + s.type);
}
export function aryIdEquals(lhs, rhs) {
    if (lhs.length != rhs.length)
        return false;
    for (let i = 0; i < lhs.length; ++i)
        if (!lhs[i].is(rhs[i]))
            return false;
    return true;
}
function fsort_id(a, b) {
    return a.id.localeCompare(b.id);
}
class IdentifiedByVal {
    is(rhs) {
        return this.isId(rhs.id);
    }
    isId(id) {
        return this.id == id;
    }
    serialize() {
        return { id: this.id };
    }
}
class IdentifiedVar extends IdentifiedByVal {
    constructor(id) {
        super();
        this._id = id;
    }
    get id() {
        return this._id;
    }
}
class ContainerSlotAny extends IdentifiedVar {
}
class ContainerSlot extends ContainerSlotAny {
    constructor(id, construct, slots, secret) {
        super(id);
        this.slots = [];
        this.slots = slots;
        this.secret = secret;
        this.construct = construct;
    }
    serialize() {
        return { ...super.serialize(), slots: this.slots.map(s => s.serialize()), secret: this.secret };
    }
    first() {
        assert(this.slots, "No first of empty slot");
        return this.slots[0];
    }
    add(slots) {
        return this.construct(this.id, this.slots.concat(slots), this.secret);
    }
    slot(id) {
        const slot = this.slots.find(s => s.isId(this.id, id));
        assert(slot, "No slot of id", this.id, id);
        return slot;
    }
    clear() {
        return this.construct(this.id, [], this.secret);
    }
    isEmpty() {
        return this.slots.every(s => s.isEmpty());
    }
    hasSlot(idCnt, id) {
        return this.isId(idCnt) && this.slots.some(s => s.isId(idCnt, id));
    }
    lengthSlots() {
        return this.slots.length;
    }
    length() {
        return this.slots.reduce((a, s) => a + s.length(), 0);
    }
    withMove(move) {
        // Create any new slots in the move for the container.
        const slotsNew = move.makeSlotsNew().filter(s => this.isId(s.idCnt));
        assert(slotsNew.every(s => !this.hasSlot(s.idCnt, s.idSlot)), "Container already has new slot");
        return this.construct(this.id, this.slots.concat(slotsNew).map(s => s.withMove(move)), this.secret);
    }
    allItems() {
        return this.slots.reduce((agg, s) => agg.concat(Array.from(s)), []);
    }
    [Symbol.iterator]() {
        return this.slots[Symbol.iterator]();
    }
}
// Note: idSlot is only unique within a container
export class Slot {
    constructor(idCnt, idSlot) {
        this.idSlot = idSlot;
        this.idCnt = idCnt;
    }
    static sort(lhs, rhs) {
        return lhs.idCnt.localeCompare(rhs.idCnt) || lhs.idSlot - rhs.idSlot;
    }
    is(rhs) {
        return this.isId(rhs.idCnt, rhs.idSlot);
    }
    isId(idCnt, idSlot) {
        return this.idSlot == idSlot && this.idCnt == idCnt;
    }
    get id() { return [this.idCnt, this.idSlot]; }
    serialize() {
        return { idSlot: this.idSlot, idCnt: this.idCnt };
    }
}
// A Slot that holds Items
class SlotItem extends Slot {
    constructor(id, construct, idCnt, items) {
        super(idCnt, id);
        this.items = items;
        this.construct = construct;
    }
    serialize() {
        return { ...super.serialize(), items: this.items.map(c => c.serialize()), idCnt: this.idCnt };
    }
    // Assuming the slot is sorted, then returns the first item higher then the given item by the given ordering, if
    // any such item exists.
    //
    // The given item need not be in the slot.
    itemAfter(item, compareFn) {
        return this.items.find(i => compareFn(i, item) > 0);
    }
    // Get the item following the given one, if any.
    next(item) {
        for (let i = 0; i < this.items.length; ++i) {
            if (this.items[i].is(item))
                return this.items[i + 1];
        }
        assert(false, "Item not in slot as expected");
        return undefined;
    }
    add(items, before) {
        const idx = (() => {
            if (before) {
                const result = this.items.findIndex(i => i.is(before));
                assert(result != -1, "No 'before' elem", before);
                return result;
            }
            else {
                return this.items.length;
            }
        })();
        assert(items.every(i => !this.items.some(i2 => i.is(i2))), "Re-add of item to slot");
        assertf(() => idx >= 0 && idx <= this.items.length);
        return this.construct(this.idCnt, this.idSlot, this.items.slice(0, idx).concat(items).concat(this.items.slice(idx)));
    }
    remove(items) {
        if (items.length) {
            assertf(() => items.every(i => this.items.some(i2 => i2.is(i))), "Some items to be removed not found in slot");
            return this.construct(this.idCnt, this.idSlot, this.items.filter(i => !items.some(i2 => i2.is(i))));
        }
        else {
            return this;
        }
    }
    replace(item, item_) {
        const idx = this.items.findIndex(i => i.is(item));
        assertf(() => idx != -1, "Item to be replaced not found in slot");
        return this.construct(this.idCnt, this.idSlot, this.items.slice(0, idx).concat([item_]).concat(this.items.slice(idx + 1)));
    }
    top() {
        assertf(() => !this.isEmpty());
        return this.items[this.items.length - 1];
    }
    isEmpty() {
        return this.items.length == 0;
    }
    item(idx) {
        assertf(() => idx >= 0 && idx < this.items.length);
        return this.items[idx];
    }
    length() {
        return this.items.length;
    }
    hasItem(item) {
        return this.items.some(i => i.is(item));
    }
    map(f) {
        return this.construct(this.idCnt, this.idSlot, this.items.map(f));
    }
    withMove(move) {
        let result = this;
        // A move may have the same slot as both a source and a destination.
        // The card state may have changed.
        if (this.isId(...move.idSource))
            result = result.remove(move.items);
        if (this.isId(...move.idDest)) {
            if (move.destBeforeItem && !this.hasItem(move.destBeforeItem)) {
                console.error("Dest slot doesn't have beforeItem", this, move);
                result = result.add(move.items);
            }
            else {
                result = result.add(move.items, move.destBeforeItem);
            }
        }
        return result;
    }
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
}
export class SlotCard extends SlotItem {
    constructor(idCnt, id, cards = []) {
        super(id, (idCnt, id, cards) => new SlotCard(idCnt, id, cards), idCnt, cards);
    }
    static fromSerialized(serialized) {
        return new SlotCard(serialized.idCnt, serialized.idSlot, serialized.items.map((c) => WorldCard.fromSerialized(c)));
    }
    container(playfield) {
        return playfield.containerCard(this.idCnt);
    }
    findById(id) {
        return this.items.find(i => i.isId(id));
    }
}
export class ContainerSlotCard extends ContainerSlot {
    constructor(id, slots = [], secret = false) {
        super(id, (id, slots, secret) => new ContainerSlotCard(id, slots, secret), slots, secret);
    }
    static fromSerialized(s) {
        return new ContainerSlotCard(s.id, s.slots.map((c) => SlotCard.fromSerialized(c)), s.secret);
    }
}
export class Player extends IdentifiedVar {
    constructor(id, idCnts) {
        super(id);
        this.idCnts = idCnts;
    }
    multipleAssignmentPossible() { return false; }
}
export class PlayerSpectator extends Player {
    constructor() {
        super("spectator", []);
    }
    multipleAssignmentPossible() { return true; }
}
var Suit;
(function (Suit) {
    Suit[Suit["CLUB"] = 0] = "CLUB";
    Suit[Suit["DIAMOND"] = 1] = "DIAMOND";
    Suit[Suit["HEART"] = 2] = "HEART";
    Suit[Suit["SPADE"] = 3] = "SPADE";
})(Suit || (Suit = {}));
var Color;
(function (Color) {
    Color[Color["BLACK"] = 0] = "BLACK";
    Color[Color["RED"] = 1] = "RED";
})(Color || (Color = {}));
export class Card extends IdentifiedVar {
    constructor(rank, suit, id) {
        super(id);
        this.suit = suit;
        this.rank = rank;
    }
    static fromSerialized(serialized) {
        return new Card(serialized.rank, serialized.suit, serialized.id);
    }
    color() {
        if (this.suit == Suit.CLUB || this.suit == Suit.SPADE)
            return Color.BLACK;
        else
            return Color.RED;
    }
    rankValue(aceHigh) {
        return this.rank == 0 && aceHigh ? 13 : this.rank;
    }
    serialize() {
        return {
            ...super.serialize(),
            suit: this.suit,
            rank: this.rank
        };
    }
}
export class WorldCard extends IdentifiedVar {
    constructor(card, faceUp, faceUpIsConscious = false, turned = false, id = card.id) {
        super(id);
        this.card = card;
        this.faceUp = faceUp;
        this.faceUpIsConscious = faceUpIsConscious;
        this.turned = turned;
    }
    static fromSerialized(serialized) {
        return new WorldCard(Card.fromSerialized(serialized.card), serialized.faceUp, serialized.faceUpIsConscious, serialized.turned);
    }
    equals(rhs) {
        return this.card.is(rhs.card) &&
            this.faceUp == rhs.faceUp &&
            this.faceUpIsConscious == rhs.faceUpIsConscious &&
            this.turned == rhs.turned;
    }
    withFaceUp(faceUp) {
        return new WorldCard(this.card, faceUp, this.faceUpIsConscious, this.turned);
    }
    withFaceStateConscious(faceUp, conscious) {
        return new WorldCard(this.card, faceUp, conscious, this.turned);
    }
    withTurned(turned) {
        return new WorldCard(this.card, this.faceUp, this.faceUpIsConscious, turned);
    }
    serialize() {
        return {
            card: this.card.serialize(),
            faceUp: this.faceUp,
            faceUpIsConscious: this.faceUpIsConscious,
            turned: this.turned
        };
    }
}
function deck52() {
    const result = [];
    for (let suit = 0; suit < 4; ++suit) {
        for (let rank = 0; rank < 13; ++rank) {
            result.push(new Card(rank, suit, rank + '_' + suit));
        }
    }
    return result;
}
function deck51NoDeuce() {
    return deck52().filter(c => c.suit != Suit.SPADE && c.rank != 1);
}
function shuffled(deck) {
    const result = [];
    while (deck.length) {
        const idx = Math.floor(Math.random() * deck.length);
        result.push(deck[idx]);
        deck = deck.slice(0, idx).concat(deck.slice(idx + 1));
    }
    return result;
}
function orderColorAlternate(c) {
    switch (c.suit) {
        case Suit.CLUB: return 0;
        case Suit.DIAMOND: return 1;
        case Suit.SPADE: return 2;
        case Suit.HEART: return 3;
        default: throw new Error("Unknown suit " + c.suit);
    }
}
function orderColorAlternateRank(aceHigh, a, b) {
    return orderColorAlternate(a) - orderColorAlternate(b) || a.rankValue(aceHigh) - b.rankValue(aceHigh);
}
function orderColorAlternateRankW(aceHigh, a, b) {
    return orderColorAlternateRank(aceHigh, a.card, b.card);
}
export class EventMove extends Event {
    constructor(move, localAction) {
        super('gamemove');
        this.move = move;
        this.localAction = localAction;
    }
}
export class EventContainerChange extends Event {
    constructor(playfield, playfield_, idCnt) {
        super('containerchange');
        this.playfield = playfield;
        this.playfield_ = playfield_;
        this.idCnt = idCnt;
    }
}
export class EventSlotChange extends Event {
    constructor(playfield, playfield_, idCnt, idSlot) {
        super('slotchange');
        this.playfield = playfield;
        this.playfield_ = playfield_;
        this.idCnt = idCnt;
        this.idSlot = idSlot;
    }
}
export class EventPingBack extends Event {
    constructor(secs) {
        super('pingback');
        this.secs = secs;
    }
}
export class EventPeerUpdate extends Event {
    constructor(peers) {
        super('peerupdate');
        this.peers = peers;
    }
}
export class EventPlayfieldChange extends Event {
    constructor(playfield, playfield_) {
        super('playfieldchange');
        this.playfield = playfield;
        this.playfield_ = playfield_;
    }
}
function newEventTarget() {
    // Should be 'new EventTarget()', but iOS doesn't support that.
    return document.createElement('div');
}
export class NotifierSlot {
    constructor() {
        this.eventTarget = newEventTarget();
        this.events = new Map();
        this.preSlotUpdates = [];
        this.postSlotUpdates = [];
    }
    container(idCnt) {
        let result = this.events.get(idCnt);
        if (!result) {
            result = newEventTarget();
            this.events.set(idCnt, result);
        }
        return result;
    }
    slot(idCnt, idSlot) {
        const key = idCnt + "-" + idSlot;
        let result = this.events.get(key);
        if (!result) {
            result = newEventTarget();
            this.events.set(key, result);
        }
        return result;
    }
    registerPreSlotUpdate(func) {
        this.preSlotUpdates.push(func);
    }
    registerPostSlotUpdate(func) {
        this.postSlotUpdates.push(func);
    }
    move(move, localAction = true) {
        this.eventTarget.dispatchEvent(new EventMove(move, localAction));
    }
    slotsUpdate(playfield, playfield_, slotsChanged, localAction) {
        // Note: slotsChanged may include new slots not in the old playfield
        const oldSlots = it.flatMap(slotsChanged, ([idCnt, id]) => playfield.container(idCnt).hasSlot(idCnt, id) ? [playfield.container(idCnt).slot(id)] : []);
        const preSlotChangeInfo = this.preSlotUpdates.map(f => f(Array.from(oldSlots), localAction));
        for (const [idCnt, id] of slotsChanged) {
            this.slot(idCnt, id).dispatchEvent(new EventSlotChange(playfield, playfield_, idCnt, id));
        }
        const newSlots = it.map(slotsChanged, ([idCnt, id]) => playfield_.container(idCnt).slot(id));
        for (const result of preSlotChangeInfo)
            for (const f of this.postSlotUpdates)
                f(Array.from(newSlots), result, localAction);
    }
}
export class Chip extends IdentifiedVar {
    constructor(id, value) {
        super(id);
        this.value = value;
    }
    serialize() {
        return { ...super.serialize(), value: this.value };
    }
    static fromSerialized(s) {
        return new Chip(s.id, s.value);
    }
}
export class SlotChip extends SlotItem {
    constructor(idCnt, id, chips = []) {
        super(id, (idCnt, id, chips) => new SlotChip(idCnt, id, chips), idCnt, chips);
    }
    static fromSerialized(serialized) {
        return new SlotChip(serialized.idCnt, serialized.idSlot, serialized.items.map((c) => Chip.fromSerialized(c)));
    }
    container(playfield) {
        return playfield.containerChip(this.idCnt);
    }
}
class ContainerSlotChip extends ContainerSlot {
    constructor(id, slots = [], secret = false) {
        super(id, (id, slots, secret = false) => new ContainerSlotChip(id, slots, secret), slots, secret);
    }
    static fromSerialized(s) {
        return new ContainerSlotChip(s.id, s.slots.map((c) => SlotChip.fromSerialized(c)), s.secret);
    }
}
export class Playfield {
    constructor(sequence, containers, containersChip) {
        this.sequence = sequence;
        this.containers = containers;
        this.containersChip = containersChip;
        assert(sequence != NaN);
    }
    static fromSerialized(serialized) {
        return new Playfield(serialized.sequence, serialized.containers.map((s) => ContainerSlotCard.fromSerialized(s)), serialized.containersChip.map((s) => ContainerSlotChip.fromSerialized(s)));
    }
    serialize() {
        return { sequence: this.sequence, containers: this.containers.map(s => s.serialize()),
            containersChip: this.containersChip.map(s => s.serialize()) };
    }
    withTurnSequence(turnSequence) {
        return new Playfield(turnSequence, this.containers, this.containersChip);
    }
    withMoveCards(move) {
        return new Playfield(move.turnSequence, this.containers.map(cnt => cnt.withMove(move)), this.containersChip);
    }
    withMoveChips(move) {
        return new Playfield(move.turnSequence, this.containers, this.containersChip.map(cnt => cnt.withMove(move)));
    }
    containerCard(id) {
        const cnt = this.containers.find(c => c.isId(id));
        assertf(() => cnt);
        return cnt;
    }
    containerChip(id) {
        const cnt = this.containersChip.find(c => c.isId(id));
        assertf(() => cnt);
        return cnt;
    }
    container(id) {
        let cnt = this.containers.find(c => c.isId(id));
        if (!cnt)
            cnt = this.containersChip.find(c => c.isId(id));
        assertf(() => cnt);
        return cnt;
    }
}
export class PeerPlayer extends IdentifiedVar {
    constructor(id, conns, player, onReconnect) {
        super(id);
        this.conns = conns;
        this.onReconnect = onReconnect;
        this.connecting = true;
        this.consistency = 0;
        this.consistencyReported = 0;
        this.conns = conns;
        this.player = player;
    }
    get consistent() { return this.consistency == this.consistencyReported; }
    keepConnected(timeout = 10000, failTimeout = 2000, reconnects = 0) {
        if (this.open()) {
            window.setTimeout(() => this.keepConnected(timeout, 2000, 0), timeout);
        }
        else {
            if (reconnects < 30) {
                console.log("Lost peer connection, trying to reconnect", this.id, reconnects, failTimeout);
                this.err = undefined;
                this.conns.connect(this.id, this.player, (peerPlayer, conn) => { this.onOpened(conn); this.onReconnect(peerPlayer); }, {});
                window.setTimeout(() => this.keepConnected(timeout, failTimeout, ++reconnects), failTimeout);
            }
            else {
                console.warn(`Can't reconnect to peer ${this.id} after ${reconnects} tries`);
                this.conns.onPeerLost(this);
            }
        }
    }
    connectingGet() { return this.connecting; }
    onOpened(conn) {
        const firstConnection = this.conn === undefined;
        this.conn = conn;
        this.connecting = false;
        this.err = undefined;
        if (firstConnection)
            this.keepConnected();
    }
    onOpenFailed(err) {
        this.connecting = false;
        this.err = err;
    }
    open() {
        var _a;
        return (_a = this.conn) === null || _a === void 0 ? void 0 : _a.open;
    }
    status() {
        return this.err ? 'Error' :
            this.connectingGet() ? 'Connecting...' :
                this.open() ? 'Connected' :
                    'Disconnected';
    }
    playerGet() { return this.player; }
    playerChange(player) { this.player = player; }
    send(data) {
        assert(this.open());
        console.debug('Send to ' + this.id, data);
        this.conn.send(data);
    }
    serialize() {
        return { ...super.serialize(), player: this.player.id };
    }
}
export class Connections {
    constructor(onReconnect) {
        this.onReconnect = onReconnect;
        this.events = document.createElement("div");
        this.registering = false;
        this.peers = new Map();
    }
    registrantId() {
        var _a;
        return (_a = this.registrant) === null || _a === void 0 ? void 0 : _a.id;
    }
    register(id, onPeerConnect, onReceive, playerDefault, registrantPlayerGet, maxPlayersGet) {
        var _a;
        assertf(() => id);
        assertf(() => !this.registering);
        if (this.registrant) {
            if (id == this.registrant.id) {
                if (this.registrant.disconnected) {
                    dom.demandById("peerjs-status").innerHTML = "Re-registering"; // move this
                    this.registrant.reconnect();
                }
            }
            else {
                dom.demandById("peerjs-status").innerHTML = "Re-registering";
                this.registrant.disconnect();
                this.registrant = null;
                this.register(id, onPeerConnect, onReceive, playerDefault, registrantPlayerGet, maxPlayersGet);
            }
            return;
        }
        this.registering = true;
        const host = dom.demandById("peerjs-host", HTMLInputElement).value.split('/')[0];
        const path = dom.demandById("peerjs-host", HTMLInputElement).value.split('/')[1];
        const connection = host ? { host: host.split(':')[0], port: (_a = host.split(':')[1]) !== null && _a !== void 0 ? _a : 9000, path: path !== null && path !== void 0 ? path : '/' } : undefined;
        const registrant = new Peer(id, connection);
        registrant.on('error', (err) => {
            var _a;
            this.registering = false;
            if (err.type != 'peer-unavailable') {
                this.registrant = null;
                dom.demandById("peerjs-status").innerHTML = "Unregistered";
                throw new Error(`${err.type} ${err}`);
            }
            else {
                // ?
                const idPeer = err.toString().slice("Error: Could not connect to peer ".length);
                (_a = this.peerById(idPeer)) === null || _a === void 0 ? void 0 : _a.onOpenFailed(err.toString());
                this.events.dispatchEvent(new EventPeerUpdate(Array.from(this.peers.values())));
                console.log("Registrant error", err.type, err);
            }
        });
        console.log("Registering as " + id);
        registrant.on('close', (id) => {
            dom.demandById("peerjs-status").innerHTML = "Unregistered";
            this.registrant = null;
        });
        registrant.on('open', (id) => {
            this.registering = false;
            this.registrant = registrant;
            dom.demandById("peerjs-status").innerHTML = "Registered";
        });
        registrant.on('connection', (conn) => {
            console.log("Peer connected to us", conn);
            {
                const peerPlayer = this.peerById(conn.peer);
                if (!peerPlayer || !peerPlayer.open()) {
                    this.connect(conn.peer, playerDefault, (peer, _) => onPeerConnect(conn.metadata, peer), {});
                }
            }
            conn.on('data', (data) => {
                const peer = this.peerById(conn.peer);
                console.debug('Received from ' + conn.peer + ' in state open=' + (peer === null || peer === void 0 ? void 0 : peer.open()), data);
                peer && peer.open() && onReceive(data, peer);
            });
            conn.on('error', (e) => {
                const peer = this.peerById(conn.peer);
                peer && this.onPeerError(peer, e);
            });
        });
    }
    peerById(id) {
        return this.peers.get(id);
    }
    peerByPlayer(player) {
        return Array.from(this.peers.values()).find((p) => p.playerGet() === player);
    }
    connectYom(idPeer, playerForPeer) {
        this.connect(idPeer, playerForPeer, () => { }, 'yom');
    }
    connect(idPeer, playerDefault, onConnect, metadata) {
        assertf(() => idPeer);
        if (this.registrant) {
            if (this.registrant.id == idPeer)
                throw new Error("Can't connect to your own id");
            const peerPlayer = this.peers.get(idPeer);
            if (peerPlayer === null || peerPlayer === void 0 ? void 0 : peerPlayer.open()) {
                console.log("Peer connection already open", idPeer);
            }
            else if (peerPlayer === null || peerPlayer === void 0 ? void 0 : peerPlayer.connectingGet()) {
                console.log("Peer already connecting", idPeer);
            }
            else {
                let peerPlayer = this.peers.get(idPeer);
                if (!peerPlayer) {
                    peerPlayer = new PeerPlayer(idPeer, this, playerDefault, this.onReconnect);
                    this.peers.set(idPeer, peerPlayer);
                }
                console.log("Attempting " + (peerPlayer.connectingGet() ? '' : "re-") + "connection to peer", idPeer);
                const conn = this.registrant.connect(idPeer, {
                    reliable: true,
                    metadata: metadata
                });
                conn.on('open', () => {
                    console.log("Peer opened", conn);
                    assert(peerPlayer);
                    peerPlayer.onOpened(conn);
                    onConnect && onConnect(peerPlayer, conn);
                    this.events.dispatchEvent(new EventPeerUpdate(Array.from(this.peers.values())));
                    function ping(secs) {
                        assert(peerPlayer);
                        if (peerPlayer.open()) {
                            peerPlayer.send({ ping: { secs: secs } });
                            window.setTimeout(() => ping(secs + 30), 30000);
                        }
                    }
                    ping(0);
                    conn.on('error', (err) => {
                        assert(peerPlayer);
                        peerPlayer.onOpenFailed(err);
                        this.onPeerError(peerPlayer, err);
                    });
                });
            }
        }
        else {
            throw new Error("Not registered");
        }
    }
    broadcast(data, exclusions = []) {
        for (const [id, peer] of this.peers) {
            if (peer.open() && !exclusions.some(p => p.is(peer)))
                peer.send(data);
        }
    }
    onPeerError(peer, error) {
        console.log('Peer connection error', peer.id, error);
        this.events.dispatchEvent(new EventPeerUpdate(Array.from(this.peers.values())));
    }
    onPeerLost(peer) {
        this.peers.delete(peer.id);
        this.events.dispatchEvent(new EventPeerUpdate(Array.from(this.peers.values())));
    }
    onPeerUpdate(registrantPlayer) {
        const peers = this.peersGet().map((p) => p.serialize());
        this.broadcast({
            peerUpdate: {
                peerPlayers: peers.concat([{ id: this.registrantId(), player: registrantPlayer.id }])
            }
        });
        this.events.dispatchEvent(new EventPeerUpdate(Array.from(this.peers.values())));
    }
    peersGet() { return Array.from(this.peers.values()); }
}
export class Game extends IdentifiedVar {
    constructor(id, description, makeUi, players) {
        super(id);
        this.description = description;
        this.makeUi = makeUi;
        this.description = description;
        this.makeUi = makeUi;
        this.players = players.concat([new PlayerSpectator()]);
    }
    decks() {
        return [
            ["Standard 52", deck52()],
            ["No deuce 51", deck51NoDeuce()]
        ];
    }
    *deal(players, playfield) {
    }
    playfieldNewHand(players, playfieldOld) {
        const pf = this.playfield(players);
        return new Playfield(0, pf.containers, playfieldOld.containersChip);
    }
    playersActive() {
        return this.players.filter(p => p.idCnts.length != 0);
    }
    spectator() {
        return this.players[this.players.length - 1];
    }
    *dealEach(players, playfieldIn, cnt, ordering) {
        let pf = playfieldIn;
        for (let i = 0; i < cnt; ++i)
            for (const p of this.playersActive().slice(0, players)) {
                const slotSrc = pf.containerCard('stock').slot(0);
                const slotDst = pf.containerCard(p.idCnts[0]).slot(0);
                const move = new MoveCards(pf.sequence, [slotSrc.top().withFaceUp(true)], slotSrc.id, slotDst.id, slotDst.itemAfter(slotSrc.top(), ordering));
                pf = pf.withMoveCards(move);
                yield move;
            }
    }
}
export class GameGinRummy extends Game {
    constructor(makeUi) {
        super("gin-rummy", "Gin Rummy", makeUi, [new Player('Player 1', ['p0']), new Player('Player 2', ['p1'])]);
    }
    deal(players, playfield) {
        return this.dealEach(players, playfield, 10, orderColorAlternateRankW.bind(null, false));
    }
    playfield(players) {
        return new Playfield(0, [new ContainerSlotCard("p0", [new SlotCard("p0", 0)]),
            new ContainerSlotCard("p1", [new SlotCard("p1", 0)]),
            new ContainerSlotCard("waste", [new SlotCard("waste", 0)]),
            new ContainerSlotCard("stock", [new SlotCard("stock", 0, shuffled(deck52()).map(c => new WorldCard(c, false)))])
        ], []);
    }
}
export class GameDummy extends Game {
    constructor(makeUi) {
        super("dummy", "Dummy / 500 Rum", makeUi, [new Player('Player 1', ['p0']), new Player('Player 2', ['p1'])]);
    }
    deal(players, playfield) {
        return this.dealEach(players, playfield, 13, orderColorAlternateRankW.bind(null, false));
    }
    playfield(players) {
        return new Playfield(0, [new ContainerSlotCard("p0", [new SlotCard("p0", 0)]),
            new ContainerSlotCard("p1", [new SlotCard("p1", 0)]),
            new ContainerSlotCard("p0-meld", []),
            new ContainerSlotCard("waste", [new SlotCard("waste", 0)]),
            new ContainerSlotCard("p1-meld", []),
            new ContainerSlotCard("stock", [new SlotCard("stock", 0, shuffled(deck52()).map(c => new WorldCard(c, false)))])
        ], []);
    }
}
export class GamePoker extends Game {
    constructor(makeUi) {
        super("poker", "Poker", makeUi, array.range(8).map((_, i) => new Player('Player ' + (i + 1), ['p' + i, `p${i}-chip`])));
    }
    playfield(players) {
        const deck = shuffled(deck52());
        const chips = (id, base) => [new SlotChip(id, 0, array.range(3).map((_, i) => new Chip(i + 80 + 100 * base, 100))),
            new SlotChip(id, 1, array.range(6).map((_, i) => new Chip(i + 60 + 100 * base, 50))),
            new SlotChip(id, 2, array.range(10).map((_, i) => new Chip(i + 40 + 100 * base, 20))),
            new SlotChip(id, 3, array.range(20).map((_, i) => new Chip(i + 20 + 100 * base, 10)))
        ];
        return new Playfield(0, this.players.map(p => new ContainerSlotCard(p.idCnts[0], [new SlotCard(p.idCnts[0], 0)])).concat([new ContainerSlotCard("waste", [new SlotCard("waste", 0)], true),
            new ContainerSlotCard("community", [new SlotCard("community", 0)]),
            new ContainerSlotCard("stock", [new SlotCard("stock", 0, deck.map(c => new WorldCard(c, false)))])]), this.players.map((p, idx) => new ContainerSlotChip(p.idCnts[1], chips(p.idCnts[1], idx))).concat([new ContainerSlotChip("ante", array.range(4).map((_, i) => new SlotChip("ante", i)))]));
    }
}
export class GamePokerChinese extends Game {
    constructor(makeUi) {
        super("poker-chinese", "Chinese Poker", makeUi, array.range(4).map((_, i) => new Player('Player ' + (i + 1), ['p' + i, `p${i}-chip`])));
    }
    deal(players, playfield) {
        return this.dealEach(players, playfield, 13, orderColorAlternateRankW.bind(null, true));
    }
    playfield(players) {
        const chips = (id, base) => [new SlotChip(id, 0, array.range(3).map((_, i) => new Chip(i + 80 + 100 * base, 100))),
            new SlotChip(id, 1, array.range(6).map((_, i) => new Chip(i + 60 + 100 * base, 50))),
            new SlotChip(id, 2, array.range(10).map((_, i) => new Chip(i + 40 + 100 * base, 20))),
            new SlotChip(id, 3, array.range(20).map((_, i) => new Chip(i + 20 + 100 * base, 10)))
        ];
        return new Playfield(0, this.players.flatMap(p => [
            new ContainerSlotCard(p.idCnts[0], [new SlotCard(p.idCnts[0], 0)]),
            new ContainerSlotCard(p.idCnts[0] + "-show", array.range(3).map((_, i) => new SlotCard(p.idCnts[0] + "-show", i))),
        ]).concat([
            new ContainerSlotCard("stock", [new SlotCard("stock", 0, shuffled(deck52()).map(c => new WorldCard(c, false)))])
        ]), this.players.map((p, idx) => new ContainerSlotChip(p.idCnts[1], chips(p.idCnts[1], idx))).concat([new ContainerSlotChip("ante", array.range(4).map((_, i) => new SlotChip("ante", i)))]));
    }
}
export class GameHearts extends Game {
    constructor(makeUi) {
        super("hearts", "Hearts", makeUi, array.range(4).map((_, i) => new Player('Player ' + (i + 1), ['p' + i, `p${i}-trick`])));
    }
    deal(players, playfield) {
        const numCards = playfield.containerCard("stock").length();
        return this.dealEach(players, playfield, numCards / players, orderColorAlternateRankW.bind(null, false));
    }
    playfield(players) {
        const deck = shuffled(players == 3 ? deck51NoDeuce() : deck52());
        return new Playfield(0, this.
            players.
            flatMap(p => [
            new ContainerSlotCard(p.idCnts[0], [new SlotCard(p.idCnts[0], 0)]),
            new ContainerSlotCard(p.idCnts[1], [new SlotCard(p.idCnts[1], 0)]),
        ]).
            concat([
            new ContainerSlotCard("trick", [new SlotCard("trick", 0)]),
            new ContainerSlotCard("stock", [new SlotCard("stock", 0, deck.map(c => new WorldCard(c, false)))])
        ]), []);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3RzL2dhbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWtCRztBQUNILE9BQU8sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sYUFBYSxDQUFBO0FBQzdDLE9BQU8sS0FBSyxLQUFLLE1BQU0sWUFBWSxDQUFBO0FBQ25DLE9BQU8sS0FBSyxHQUFHLE1BQU0sVUFBVSxDQUFBLENBQUMsY0FBYztBQUM5QyxPQUFPLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQTtBQUVuQyxNQUFNLENBQU4sSUFBWSxrQkFLWDtBQUxELFdBQVksa0JBQWtCO0lBQzVCLHFFQUFTLENBQUE7SUFDVCx1RUFBVSxDQUFBO0lBQ1YscUVBQVMsQ0FBQTtJQUNULHlFQUFXLENBQUE7QUFDYixDQUFDLEVBTFcsa0JBQWtCLEtBQWxCLGtCQUFrQixRQUs3QjtBQWlCRCxNQUFNLE9BQWdCLFNBQVM7SUFFN0IsWUFDVyxZQUFvQixFQUNwQixLQUFVLEVBQ1YsUUFBMEIsRUFDMUIsTUFBd0IsRUFDeEIsY0FBa0IsRUFDbEIsV0FBK0IsRUFBRSxFQUNqQyxZQUFZLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFO0lBQ3pDLDZFQUE2RTs7UUFQcEUsaUJBQVksR0FBWixZQUFZLENBQVE7UUFDcEIsVUFBSyxHQUFMLEtBQUssQ0FBSztRQUNWLGFBQVEsR0FBUixRQUFRLENBQWtCO1FBQzFCLFdBQU0sR0FBTixNQUFNLENBQWtCO1FBQ3hCLG1CQUFjLEdBQWQsY0FBYyxDQUFJO1FBQ2xCLGFBQVEsR0FBUixRQUFRLENBQXlCO1FBQ2pDLGNBQVMsR0FBVCxTQUFTLENBQXVCO0lBRXhDLENBQUM7SUFJSixLQUFLLENBQUMsU0FBb0I7UUFDeEIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFBO1FBRS9DLG1FQUFtRTtRQUNu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QUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDdkQsQ0FBQztJQUVELFFBQVEsQ0FBQyxJQUFxQjtRQUM1QixzREFBc0Q7UUFDdEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7UUFDcEUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFBO1FBRS9GLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUE7SUFDckcsQ0FBQztJQUVELFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBUyxDQUFDLENBQUE7SUFDNUUsQ0FBQztJQUVELENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNmLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQTtJQUN0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LFNBQVMsQ0FBQyxPQUFlO1FBQ3ZCLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQTtRQUVoRSxPQUFPLElBQUksU0FBUyxDQUNsQixDQUFDLEVBQ0QsSUFBSTtZQUNGLE9BQU87WUFDUCxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNYLElBQUksaUJBQWlCLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsRSxJQUFJLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbkUsQ0FBQztZQUNGLE1BQU0sQ0FBQztZQUNMLElBQUksaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUQsSUFBSSxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbkcsQ0FBQyxFQUNKLEVBQUUsQ0FDSCxDQUFBO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAoYykgMjAyMSBEYXZpZCBCZXN3aWNrLlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIGNhcmRzLW1wIFxuICogKHNlZSBodHRwczovL2dpdGh1Yi5jb20vZGxiZXN3aWNrL2NhcmRzLW1wKS5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuICogaXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXNcbiAqIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZVxuICogTGljZW5zZSwgb3IgKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG4gKiBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2VcbiAqIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cbmltcG9ydCB7IGFzc2VydCwgYXNzZXJ0ZiB9IGZyb20gJy4vYXNzZXJ0LmpzJ1xuaW1wb3J0ICogYXMgYXJyYXkgZnJvbSAnLi9hcnJheS5qcydcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuL2RvbS5qcycgLy8gcmVtb3ZlIHRoaXNcbmltcG9ydCAqIGFzIGl0IGZyb20gJy4vaXRlcmF0b3IuanMnXG5cbmV4cG9ydCBlbnVtIENvbmZsaWN0UmVzb2x1dGlvbiB7XG4gIExFRlRfU1RBWSxcbiAgUklHSFRfU1RBWSxcbiAgQk9USF9TVEFZLFxuICBCT1RIX1JFTU9WRVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1vdmVJdGVtc0FueSAge1xuICByZWFkb25seSB0dXJuU2VxdWVuY2U6IG51bWJlclxuICByZWFkb25seSBpdGVtczogSXRlbVNsb3RbXVxuICByZWFkb25seSBpZFNvdXJjZTogW3N0cmluZywgbnVtYmVyXVxuICByZWFkb25seSBpZERlc3Q6IFtzdHJpbmcsIG51bWJlcl1cbiAgcmVhZG9ubHkgZGVzdEJlZm9yZUl0ZW0/OiBJdGVtU2xvdFxuICByZWFkb25seSBzbG90c0NoYW5nZWQ6IFtzdHJpbmcsIG51bWJlcl1bXVxuICByZWFkb25seSBzbG90c05ldzogW3N0cmluZywgbnVtYmVyXVtdXG4gIHJlYWRvbmx5IHRpbWVzdGFtcDogbnVtYmVyXG4gIHNlcmlhbGl6ZSgpOiBhbnlcbiAgaXNDb25mbGljdGluZ1dpdGgocmhzOiB0aGlzKTogYm9vbGVhblxuICByZXNvbHZlQ29uZmxpY3RXaXRoKHJoczogdGhpcyk6IENvbmZsaWN0UmVzb2x1dGlvblxuICBhcHBseShwbGF5ZmllbGQ6IFBsYXlmaWVsZCk6IFBsYXlmaWVsZFxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgTW92ZUl0ZW1zPFMgZXh0ZW5kcyBTbG90SXRlbTxUPiwgVCBleHRlbmRzIEl0ZW1TbG90PiBpbXBsZW1lbnRzIE1vdmVJdGVtc0FueSB7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgdHVyblNlcXVlbmNlOiBudW1iZXIsXG4gICAgcmVhZG9ubHkgaXRlbXM6IFRbXSxcbiAgICByZWFkb25seSBpZFNvdXJjZTogW3N0cmluZywgbnVtYmVyXSxcbiAgICByZWFkb25seSBpZERlc3Q6IFtzdHJpbmcsIG51bWJlcl0sXG4gICAgcmVhZG9ubHkgZGVzdEJlZm9yZUl0ZW0/OiBULFxuICAgIHJlYWRvbmx5IHNsb3RzTmV3OiBbc3RyaW5nLCBudW1iZXJdW10gPSBbXSxcbiAgICByZWFkb25seSB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgIC8vIHRiZDogb3JkZXJpbmc/IEkuZS4gbW92ZSA1IGNhcmRzIGludG8gZGVjaywgaGF2ZSB0aGVtIGFsbCBvcmRlciBjb3JyZWN0bHkuXG4gICkge31cblxuICBhYnN0cmFjdCBpc1ZhbGlkKHBmOiBQbGF5ZmllbGQpOiBib29sZWFuXG4gIFxuICBhcHBseShwbGF5ZmllbGQ6IFBsYXlmaWVsZCk6IFBsYXlmaWVsZCB7XG4gICAgYXNzZXJ0KHBsYXlmaWVsZC5zZXF1ZW5jZSA9PSB0aGlzLnR1cm5TZXF1ZW5jZSlcbiAgICBcbiAgICAvLyBcIkludmFsaWRcIiBtb3ZlcyBhcmUgaWdub3JlZC4gSG93IGNhbiBhIG1vdmUgYmUgaW52YWxpZD8gT25lIHdheTpcbiAgICAvLyAxLiBDbGllbnQgcmVjZWl2ZXMgYSBtb3ZlIGluIGEgcHJldmlvdXMgdHVybiB0aGF0IGdlbmVyYXRlcyBhIGNvbmZsaWN0LlxuICAgIC8vIDIuIENvbmZsaWN0IHJlc29sdXRpb24gaW52YWxpZGF0ZXMgbW92ZXMgaW4gdGhlIHByb2NlZWRpbmcgdHVybnMuXG4gICAgLy8gMy4gQ2xpZW50IHJlY2VpdmVzIGEgbW92ZSBoYXZpbmcgYSBjYXVzZS9lZmZlY3QgcmVsYXRpb25zaGlwIHdpdGggYW4gaW52YWxpZGF0ZWQgbW92ZSwgZnJvbSBhIGNsaWVudCB3aG8gaGFzbid0XG4gICAgLy8gICAgeWV0IGFzc2ltaWxhdGVkIHRoZSBjb25mbGljdCByZXNvbHV0aW9uLlxuICAgIC8vXG4gICAgLy8gSXQgd291bGQgYmUgYmV0dGVyIHRvIGRldGVjdCB0aGlzIGNhc2UgaW4gc29tZSBvdGhlciB3YXksIHRvIGF2b2lkIHRoZSBuZWVkIGZvciB0aGlzIGxvZ2ljLlxuICAgIC8vIFJlLXdyaXRlIHNlcXVlbmNlIG51bWJlcnM/XG4gICAgLy8gVmVyc2lvbiB0dXJucz9cbiAgICBjb25zdCBhbGxOZXdTbG90c05vdEV4aXN0aW5nID1cbiAgICAgIHRoaXMuc2xvdHNOZXcubGVuZ3RoID09IDAgfHxcbiAgICAgIHRoaXMuc2xvdHNOZXcuZXZlcnkoKFtpZENudCwgaWRdKSA9PiAhcGxheWZpZWxkLmNvbnRhaW5lcihpZENudCkuaGFzU2xvdChpZENudCwgaWQpKVxuXG4gICAgLy8gdGJkOiBjaGVjayBcImJlZm9yZVwiXG4gICAgXG4gICAgY29uc3QgbW92ZVRvTmV3U2xvdCA9IHRoaXMuc2xvdHNOZXcuc29tZSgoW2lkQ250LCBpZF0pID0+IHRoaXMuaWREZXN0WzBdID09IGlkQ250ICYmIHRoaXMuaWREZXN0WzFdID09IGlkKTtcbiAgICBcbiAgICBpZiAoYWxsTmV3U2xvdHNOb3RFeGlzdGluZyAmJiAobW92ZVRvTmV3U2xvdCB8fCB0aGlzLmlzVmFsaWQocGxheWZpZWxkKSkpXG4gICAgICByZXR1cm4gdGhpcy5kb0FwcGx5KHBsYXlmaWVsZClcbiAgICBlbHNlIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJJbnZhbGlkIG1vdmUgZGlzY2FyZGVkIGR1cmluZyBhcHBseVwiLCB0aGlzLCBwbGF5ZmllbGQpXG4gICAgICByZXR1cm4gcGxheWZpZWxkLndpdGhUdXJuU2VxdWVuY2UodGhpcy50dXJuU2VxdWVuY2UpXG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGFic3RyYWN0IGRvQXBwbHkocGxheWZpZWxkOiBQbGF5ZmllbGQpOiBQbGF5ZmllbGRcbiAgXG4gIC8vIFR3byBtb3ZlcyBjb25mbGljdCBpZjpcbiAgLy8gKiBUaGV5IHVzZSBhbnkgb2YgdGhlIHNhbWUgY2FyZHMuXG4gIC8vICogVGhleSBjcmVhdGUgdGhlIHNhbWUgc2xvdC5cbiAgaXNDb25mbGljdGluZ1dpdGgocmhzOiB0aGlzKSB7XG4gICAgcmV0dXJuIHJocyAhPT0gdGhpcyAmJlxuICAgICAgKHJocy5pdGVtcy5zb21lKHJpID0+IHRoaXMuaXRlbXMuc29tZShsaSA9PiBsaS5pcyhyaSkpKSB8fFxuICAgICAgICByaHMuc2xvdHNOZXcuc29tZShycyA9PiB0aGlzLnNsb3RzTmV3LnNvbWUobHMgPT4gYXJyYXkuZXF1YWxzKGxzLCBycykpKSlcbiAgfVxuICBcbiAgcmVzb2x2ZUNvbmZsaWN0V2l0aChyaHM6IHRoaXMpOiBDb25mbGljdFJlc29sdXRpb24ge1xuICAgIGlmICh0aGlzID09PSByaHMpIHtcbiAgICAgIHJldHVybiBDb25mbGljdFJlc29sdXRpb24uQk9USF9TVEFZXG4gICAgfSBlbHNlIGlmICh0aGlzLmlzQ29uZmxpY3RpbmdXaXRoKHJocykpIHtcbiAgICAgIGlmICh0aGlzLnRpbWVzdGFtcCA9PSByaHMudGltZXN0YW1wKVxuICAgICAgICByZXR1cm4gQ29uZmxpY3RSZXNvbHV0aW9uLkJPVEhfUkVNT1ZFXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiB0aGlzLnRpbWVzdGFtcCA8IHJocy50aW1lc3RhbXAgPyBDb25mbGljdFJlc29sdXRpb24uTEVGVF9TVEFZIDogQ29uZmxpY3RSZXNvbHV0aW9uLlJJR0hUX1NUQVlcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIENvbmZsaWN0UmVzb2x1dGlvbi5CT1RIX1NUQVlcbiAgICB9XG4gIH1cblxuICAvLyBEb2Vzbid0IGluY2x1ZGUgbmV3IHNsb3RzXG4gIGdldCBzbG90c0NoYW5nZWQoKTogW3N0cmluZyxudW1iZXJdW10ge1xuICAgIGlmIChhcnJheS5lcXVhbHModGhpcy5pZFNvdXJjZSwgdGhpcy5pZERlc3QpKVxuICAgICAgcmV0dXJuIFt0aGlzLmlkU291cmNlXVxuICAgIGVsc2VcbiAgICAgIHJldHVybiBbdGhpcy5pZFNvdXJjZSwgdGhpcy5pZERlc3RdXG4gIH1cblxuICBhYnN0cmFjdCBtYWtlU2xvdHNOZXcoKTogU1tdXG4gIFxuICBzZXJpYWxpemUoKTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAgdHVyblNlcXVlbmNlOiB0aGlzLnR1cm5TZXF1ZW5jZSxcbiAgICAgIGl0ZW1zOiB0aGlzLml0ZW1zLm1hcChjID0+IGMuc2VyaWFsaXplKCkpLFxuICAgICAgaWRTb3VyY2U6IHRoaXMuaWRTb3VyY2UsXG4gICAgICBpZERlc3Q6IHRoaXMuaWREZXN0LFxuICAgICAgZGVzdEJlZm9yZUl0ZW06IHRoaXMuZGVzdEJlZm9yZUl0ZW0/LnNlcmlhbGl6ZSgpLFxuICAgICAgc2xvdHNOZXc6IHRoaXMuc2xvdHNOZXcsXG4gICAgICB0aW1lc3RhbXA6IHRoaXMudGltZXN0YW1wXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlQ2FyZHMgZXh0ZW5kcyBNb3ZlSXRlbXM8U2xvdENhcmQsIFdvcmxkQ2FyZD4ge1xuICAvLyBOb3RlOiBUeXBlU2NyaXB0IGluaGVyaXRzIHN1cGVyY2xhc3MgY29uc3RydWN0b3JzXG4gIFxuICBpc1ZhbGlkKHBmOiBQbGF5ZmllbGQpIHtcbiAgICBjb25zdCBzcmMgPSBwZi5jb250YWluZXJDYXJkKHRoaXMuaWRTb3VyY2VbMF0pLnNsb3QodGhpcy5pZFNvdXJjZVsxXSlcbiAgICBjb25zdCBkc3QgPSBwZi5jb250YWluZXJDYXJkKHRoaXMuaWREZXN0WzBdKS5zbG90KHRoaXMuaWREZXN0WzFdKVxuXG4gICAgLy8gTm90ZTogdGhlIGFic2VuY2Ugb2YgdGhlIGRzdEJlZm9yZUl0ZW0gaW4gdGhlIHRhcmdldCBzbG90IGRvZXNuJ3QgaGF2ZSB0byBpbnZhbGlkYXRlIHRoZSBtb3ZlLlxuICAgIC8vIFRCRDogdXNlIGFuIGluZGV4IGluc3RlYWQgb2YgZHN0QmVmb3JlIGl0ZW1cbiAgICByZXR1cm4gdGhpcy5pdGVtcy5ldmVyeShpID0+XG4gICAgICBzcmMuaGFzSXRlbShpKSAmJlxuICAgICAgKHNyYy5pcyhkc3QpIHx8ICFkc3QuaGFzSXRlbShpKSlcbiAgICApXG4gIH1cbiAgXG4gIG1ha2VTbG90c05ldygpOiBTbG90Q2FyZFtdIHtcbiAgICByZXR1cm4gdGhpcy5zbG90c05ldy5tYXAoKFtpZENudCwgaWRdKSA9PiBuZXcgU2xvdENhcmQoaWRDbnQsIGlkKSlcbiAgfVxuICBcbiAgcHJvdGVjdGVkIGRvQXBwbHkocGxheWZpZWxkOiBQbGF5ZmllbGQpOiBQbGF5ZmllbGQge1xuICAgIHJldHVybiBwbGF5ZmllbGQud2l0aE1vdmVDYXJkcyh0aGlzKVxuICB9XG4gIFxuICBzZXJpYWxpemUoKTogYW55IHtcbiAgICByZXR1cm4gey4uLnN1cGVyLnNlcmlhbGl6ZSgpLCB0eXBlOiBcIk1vdmVDYXJkc1wiIH1cbiAgfVxuICBcbiAgc3RhdGljIGZyb21TZXJpYWxpemVkKHM6IGFueSkge1xuICAgIHJldHVybiBuZXcgTW92ZUNhcmRzKFxuICAgICAgcy50dXJuU2VxdWVuY2UsXG4gICAgICBzLml0ZW1zLm1hcCgoZTogYW55KSA9PiBXb3JsZENhcmQuZnJvbVNlcmlhbGl6ZWQoZSkpLFxuICAgICAgcy5pZFNvdXJjZSxcbiAgICAgIHMuaWREZXN0LFxuICAgICAgcy5kZXN0QmVmb3JlSXRlbSA/IFdvcmxkQ2FyZC5mcm9tU2VyaWFsaXplZChzLmRlc3RCZWZvcmVJdGVtKSA6IHVuZGVmaW5lZCxcbiAgICAgIHMuc2xvdHNOZXcsXG4gICAgICBzLnRpbWVzdGFtcFxuICAgIClcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTW92ZUNoaXBzIGV4dGVuZHMgTW92ZUl0ZW1zPFNsb3RDaGlwLCBDaGlwPiB7XG4gIC8vIE5vdGU6IFR5cGVTY3JpcHQgaW5oZXJpdHMgc3VwZXJjbGFzcyBjb25zdHJ1Y3RvcnNcbiAgXG4gIGlzVmFsaWQocGY6IFBsYXlmaWVsZCkge1xuICAgIGNvbnN0IHNyYyA9IHBmLmNvbnRhaW5lckNoaXAodGhpcy5pZFNvdXJjZVswXSkuc2xvdCh0aGlzLmlkU291cmNlWzFdKVxuICAgIGNvbnN0IGRzdCA9IHBmLmNvbnRhaW5lckNoaXAodGhpcy5pZERlc3RbMF0pLnNsb3QodGhpcy5pZERlc3RbMV0pXG4gICAgXG4gICAgcmV0dXJuIHRoaXMuaXRlbXMuZXZlcnkoaSA9PlxuICAgICAgc3JjLmhhc0l0ZW0oaSkgJiZcbiAgICAgIChzcmMuaXMoZHN0KSB8fCAhZHN0Lmhhc0l0ZW0oaSkpXG4gICAgKVxuICB9XG4gIFxuICBtYWtlU2xvdHNOZXcoKTogU2xvdENoaXBbXSB7XG4gICAgcmV0dXJuIHRoaXMuc2xvdHNOZXcubWFwKChbaWRDbnQsIGlkXSkgPT4gbmV3IFNsb3RDaGlwKGlkQ250LCBpZCkpXG4gIH1cbiAgXG4gIHByb3RlY3RlZCBkb0FwcGx5KHBsYXlmaWVsZDogUGxheWZpZWxkKTogUGxheWZpZWxkIHtcbiAgICByZXR1cm4gcGxheWZpZWxkLndpdGhNb3ZlQ2hpcHModGhpcylcbiAgfVxuICBcbiAgc2VyaWFsaXplKCk6IGFueSB7XG4gICAgcmV0dXJuIHsuLi5zdXBlci5zZXJpYWxpemUoKSwgdHlwZTogXCJNb3ZlQ2hpcHNcIiB9XG4gIH1cbiAgXG4gIHN0YXRpYyBmcm9tU2VyaWFsaXplZChzOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IE1vdmVDaGlwcyhcbiAgICAgIHMudHVyblNlcXVlbmNlLFxuICAgICAgcy5pdGVtcy5tYXAoKGU6IGFueSkgPT4gQ2hpcC5mcm9tU2VyaWFsaXplZChlKSksXG4gICAgICBzLmlkU291cmNlLFxuICAgICAgcy5pZERlc3QsXG4gICAgICBzLmRlc3RCZWZvcmVJdGVtID8gQ2hpcC5mcm9tU2VyaWFsaXplZChzLmRlc3RCZWZvcmVJdGVtKSA6IHVuZGVmaW5lZCxcbiAgICAgIHMuc2xvdHNOZXcsXG4gICAgICBzLnRpbWVzdGFtcFxuICAgIClcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVzZXJpYWxpemVNb3ZlKHM6IGFueSkge1xuICBpZiAocy50eXBlID09IFwiTW92ZUNhcmRzXCIpXG4gICAgcmV0dXJuIE1vdmVDYXJkcy5mcm9tU2VyaWFsaXplZChzKVxuICBlbHNlIGlmIChzLnR5cGUgPT0gXCJNb3ZlQ2hpcHNcIilcbiAgICByZXR1cm4gTW92ZUNoaXBzLmZyb21TZXJpYWxpemVkKHMpXG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHR5cGUgXCIgKyBzLnR5cGUpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcnlJZEVxdWFsczxUIGV4dGVuZHMgSWRlbnRpZmllZD4obGhzOiBUW10sIHJoczogVFtdKSB7XG4gIGlmIChsaHMubGVuZ3RoICE9IHJocy5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlXG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaHMubGVuZ3RoOyArK2kpXG4gICAgaWYgKCFsaHNbaV0uaXMocmhzW2ldKSlcbiAgICAgIHJldHVybiBmYWxzZVxuICBcbiAgcmV0dXJuIHRydWVcbn1cblxuaW50ZXJmYWNlIElkZW50aWZpZWQge1xuICBpcyhyaHM6IHRoaXMpOiBib29sZWFuXG4gIHNlcmlhbGl6ZSgpOiBhbnlcbn1cblxuZnVuY3Rpb24gZnNvcnRfaWQ8SWRUeXBlIGV4dGVuZHMgc3RyaW5nPihhOiBJZGVudGlmaWVkQnlWYWw8SWRUeXBlPiwgYjogSWRlbnRpZmllZEJ5VmFsPElkVHlwZT4pOiBudW1iZXIge1xuICByZXR1cm4gYS5pZC5sb2NhbGVDb21wYXJlKGIuaWQpXG59XG5cbmFic3RyYWN0IGNsYXNzIElkZW50aWZpZWRCeVZhbDxJZFR5cGU+IGltcGxlbWVudHMgSWRlbnRpZmllZCB7XG4gIGFic3RyYWN0IGdldCBpZCgpOiBJZFR5cGVcbiAgXG4gIGlzKHJoczogdGhpcyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmlzSWQocmhzLmlkKVxuICB9XG4gIFxuICBpc0lkKGlkOiBJZFR5cGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5pZCA9PSBpZFxuICB9XG5cbiAgc2VyaWFsaXplKCk6IGFueSB7XG4gICAgcmV0dXJuIHsgaWQ6IHRoaXMuaWQgfVxuICB9XG59XG5cbmFic3RyYWN0IGNsYXNzIElkZW50aWZpZWRWYXI8SWRUeXBlPXN0cmluZz4gZXh0ZW5kcyBJZGVudGlmaWVkQnlWYWw8SWRUeXBlPiB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2lkOiBJZFR5cGVcblxuICBjb25zdHJ1Y3RvcihpZDogSWRUeXBlKSB7XG4gICAgc3VwZXIoKVxuICAgIHRoaXMuX2lkID0gaWRcbiAgfVxuXG4gIGdldCBpZCgpOiBJZFR5cGUge1xuICAgIHJldHVybiB0aGlzLl9pZFxuICB9XG59XG5cbmFic3RyYWN0IGNsYXNzIENvbnRhaW5lclNsb3RBbnkgZXh0ZW5kcyBJZGVudGlmaWVkVmFyIHtcbiAgYWJzdHJhY3Qgc2xvdChpZDogbnVtYmVyKTogU2xvdFxuICBhYnN0cmFjdCBoYXNTbG90KGlkQ250OiBzdHJpbmcsIGlkOiBudW1iZXIpOiBib29sZWFuXG4gIGFic3RyYWN0IGlzRW1wdHkoKTogYm9vbGVhblxufVxuXG5hYnN0cmFjdCBjbGFzcyBDb250YWluZXJTbG90PFMgZXh0ZW5kcyBTbG90SXRlbTxUPiwgVCBleHRlbmRzIEl0ZW1TbG90PiBleHRlbmRzIENvbnRhaW5lclNsb3RBbnkge1xuXG4gIHJlYWRvbmx5IHNlY3JldDogYm9vbGVhblxuICBwcml2YXRlIHJlYWRvbmx5IHNsb3RzOiByZWFkb25seSBTW10gPSBbXVxuICBwcml2YXRlIHJlYWRvbmx5IGNvbnN0cnVjdDooaWQ6IHN0cmluZyxzbG90czogcmVhZG9ubHkgU1tdLHNlY3JldDogYm9vbGVhbikgPT4gdGhpc1xuICBcbiAgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgY29uc3RydWN0OihpZDogc3RyaW5nLCBzbG90czogcmVhZG9ubHkgU1tdLCBzZWNyZXQ6IGJvb2xlYW4pID0+IGFueSwgc2xvdHM6IHJlYWRvbmx5IFNbXSxcbiAgICAgICAgICAgICAgc2VjcmV0OiBib29sZWFuKSB7XG4gICAgc3VwZXIoaWQpXG4gICAgdGhpcy5zbG90cyA9IHNsb3RzXG4gICAgdGhpcy5zZWNyZXQgPSBzZWNyZXRcbiAgICB0aGlzLmNvbnN0cnVjdCA9IGNvbnN0cnVjdFxuICB9XG5cbiAgc2VyaWFsaXplKCk6IGFueSB7XG4gICAgcmV0dXJuIHsgLi4uc3VwZXIuc2VyaWFsaXplKCksIHNsb3RzOiB0aGlzLnNsb3RzLm1hcChzID0+IHMuc2VyaWFsaXplKCkpLCBzZWNyZXQ6IHRoaXMuc2VjcmV0IH1cbiAgfVxuXG4gIGZpcnN0KCk6IFMge1xuICAgIGFzc2VydCh0aGlzLnNsb3RzLCBcIk5vIGZpcnN0IG9mIGVtcHR5IHNsb3RcIilcbiAgICByZXR1cm4gdGhpcy5zbG90c1swXVxuICB9XG4gIFxuICBhZGQoc2xvdHM6IFNbXSk6IHRoaXMge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdCh0aGlzLmlkLCB0aGlzLnNsb3RzLmNvbmNhdChzbG90cyksIHRoaXMuc2VjcmV0KVxuICB9XG5cbiAgc2xvdChpZDogbnVtYmVyKTogUyB7XG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuc2xvdHMuZmluZChzID0+IHMuaXNJZCh0aGlzLmlkLCBpZCkpXG4gICAgYXNzZXJ0KHNsb3QsIFwiTm8gc2xvdCBvZiBpZFwiLCB0aGlzLmlkLCBpZClcbiAgICByZXR1cm4gc2xvdFxuICB9XG4gIFxuICBjbGVhcigpOiB0aGlzIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3QodGhpcy5pZCwgW10sIHRoaXMuc2VjcmV0KVxuICB9XG4gIFxuICBpc0VtcHR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnNsb3RzLmV2ZXJ5KHMgPT4gcy5pc0VtcHR5KCkpXG4gIH1cbiAgXG4gIGhhc1Nsb3QoaWRDbnQ6IHN0cmluZywgaWQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmlzSWQoaWRDbnQpICYmIHRoaXMuc2xvdHMuc29tZShzID0+IHMuaXNJZChpZENudCwgaWQpKVxuICB9XG4gIFxuICBsZW5ndGhTbG90cygpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnNsb3RzLmxlbmd0aFxuICB9XG4gIFxuICBsZW5ndGgoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5zbG90cy5yZWR1Y2UoKGEsIHMpID0+IGEgKyBzLmxlbmd0aCgpLCAwKVxuICB9XG4gIFxuICB3aXRoTW92ZShtb3ZlOiBNb3ZlSXRlbXM8UywgVD4pOiB0aGlzIHtcbiAgICAvLyBDcmVhdGUgYW55IG5ldyBzbG90cyBpbiB0aGUgbW92ZSBmb3IgdGhlIGNvbnRhaW5lci5cbiAgICBjb25zdCBzbG90c05ldyA9IG1vdmUubWFrZVNsb3RzTmV3KCkuZmlsdGVyKHMgPT4gdGhpcy5pc0lkKHMuaWRDbnQpKVxuICAgIGFzc2VydChzbG90c05ldy5ldmVyeShzID0+ICF0aGlzLmhhc1Nsb3Qocy5pZENudCwgcy5pZFNsb3QpKSwgXCJDb250YWluZXIgYWxyZWFkeSBoYXMgbmV3IHNsb3RcIilcbiAgICBcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3QodGhpcy5pZCwgdGhpcy5zbG90cy5jb25jYXQoc2xvdHNOZXcpLm1hcChzID0+IHMud2l0aE1vdmUobW92ZSkpLCB0aGlzLnNlY3JldClcbiAgfVxuXG4gIGFsbEl0ZW1zKCk6IFRbXSB7XG4gICAgcmV0dXJuIHRoaXMuc2xvdHMucmVkdWNlKChhZ2csIHMpID0+IGFnZy5jb25jYXQoQXJyYXkuZnJvbShzKSksIFtdIGFzIFRbXSlcbiAgfVxuICBcbiAgW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmF0b3I8Uz4ge1xuICAgIHJldHVybiB0aGlzLnNsb3RzW1N5bWJvbC5pdGVyYXRvcl0oKVxuICB9XG59XG5cbi8vIE5vdGU6IGlkU2xvdCBpcyBvbmx5IHVuaXF1ZSB3aXRoaW4gYSBjb250YWluZXJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBTbG90IGltcGxlbWVudHMgSWRlbnRpZmllZCB7XG4gIHJlYWRvbmx5IGlkU2xvdDogbnVtYmVyXG4gIHJlYWRvbmx5IGlkQ250OiBzdHJpbmdcblxuICBzdGF0aWMgc29ydChsaHM6IFNsb3QsIHJoczogU2xvdCkge1xuICAgIHJldHVybiBsaHMuaWRDbnQubG9jYWxlQ29tcGFyZShyaHMuaWRDbnQpIHx8IGxocy5pZFNsb3QgLSByaHMuaWRTbG90XG4gIH1cbiAgXG4gIGNvbnN0cnVjdG9yKGlkQ250OiBzdHJpbmcsIGlkU2xvdDogbnVtYmVyKSB7XG4gICAgdGhpcy5pZFNsb3QgPSBpZFNsb3RcbiAgICB0aGlzLmlkQ250ID0gaWRDbnRcbiAgfVxuICBcbiAgYWJzdHJhY3QgaXNFbXB0eSgpOiBib29sZWFuXG4gIGFic3RyYWN0IGxlbmd0aCgpOiBudW1iZXJcblxuICBpcyhyaHM6IFNsb3QpIHtcbiAgICByZXR1cm4gdGhpcy5pc0lkKHJocy5pZENudCwgcmhzLmlkU2xvdClcbiAgfVxuXG4gIGlzSWQoaWRDbnQ6IHN0cmluZywgaWRTbG90OiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pZFNsb3QgPT0gaWRTbG90ICYmIHRoaXMuaWRDbnQgPT0gaWRDbnRcbiAgfVxuXG4gIGdldCBpZCgpOiBbc3RyaW5nLCBudW1iZXJdIHsgcmV0dXJuIFt0aGlzLmlkQ250LCB0aGlzLmlkU2xvdF0gfVxuICBcbiAgc2VyaWFsaXplKCk6IGFueSB7XG4gICAgcmV0dXJuIHsgaWRTbG90OiB0aGlzLmlkU2xvdCwgaWRDbnQ6IHRoaXMuaWRDbnQgfVxuICB9XG59XG5cbi8vIEFuIEl0ZW0gaGVsZCBieSBhIFNsb3RcbmV4cG9ydCBpbnRlcmZhY2UgSXRlbVNsb3QgZXh0ZW5kcyBJZGVudGlmaWVkIHtcbiAgc2VyaWFsaXplKCk6IGFueVxufVxuXG4vLyBBIFNsb3QgdGhhdCBob2xkcyBJdGVtc1xuYWJzdHJhY3QgY2xhc3MgU2xvdEl0ZW08VCBleHRlbmRzIEl0ZW1TbG90PiBleHRlbmRzIFNsb3QgaW1wbGVtZW50cyBJdGVyYWJsZTxUPiB7XG4gIHByb3RlY3RlZCByZWFkb25seSBpdGVtczogcmVhZG9ubHkgVFtdXG4gIHByaXZhdGUgcmVhZG9ubHkgY29uc3RydWN0OiAoYjogc3RyaW5nLCBhOiBudW1iZXIsIGM6IHJlYWRvbmx5IFRbXSkgPT4gdGhpc1xuXG4gIGNvbnN0cnVjdG9yKGlkOiBudW1iZXIsXG4gICAgICAgICAgICAgIGNvbnN0cnVjdDogKGI6IHN0cmluZywgYTogbnVtYmVyLCBjOiByZWFkb25seSBUW10pID0+IGFueSwgaWRDbnQ6IHN0cmluZywgaXRlbXM6IHJlYWRvbmx5IFRbXSkge1xuICAgIFxuICAgIHN1cGVyKGlkQ250LCBpZClcbiAgICB0aGlzLml0ZW1zID0gaXRlbXNcbiAgICB0aGlzLmNvbnN0cnVjdCA9IGNvbnN0cnVjdFxuICB9XG5cbiAgc2VyaWFsaXplKCkge1xuICAgIHJldHVybiB7IC4uLnN1cGVyLnNlcmlhbGl6ZSgpLCBpdGVtczogdGhpcy5pdGVtcy5tYXAoYyA9PiBjLnNlcmlhbGl6ZSgpKSwgaWRDbnQ6IHRoaXMuaWRDbnQgfVxuICB9XG5cbiAgLy8gQXNzdW1pbmcgdGhlIHNsb3QgaXMgc29ydGVkLCB0aGVuIHJldHVybnMgdGhlIGZpcnN0IGl0ZW0gaGlnaGVyIHRoZW4gdGhlIGdpdmVuIGl0ZW0gYnkgdGhlIGdpdmVuIG9yZGVyaW5nLCBpZlxuICAvLyBhbnkgc3VjaCBpdGVtIGV4aXN0cy5cbiAgLy9cbiAgLy8gVGhlIGdpdmVuIGl0ZW0gbmVlZCBub3QgYmUgaW4gdGhlIHNsb3QuXG4gIGl0ZW1BZnRlcihpdGVtOiBULCBjb21wYXJlRm46KGE6IFQsIGI6IFQpID0+IG51bWJlcik6IFR8dW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5maW5kKGkgPT4gY29tcGFyZUZuKGksIGl0ZW0pID4gMClcbiAgfVxuXG4gIC8vIEdldCB0aGUgaXRlbSBmb2xsb3dpbmcgdGhlIGdpdmVuIG9uZSwgaWYgYW55LlxuICBuZXh0KGl0ZW06IFQpOiBUfHVuZGVmaW5lZCB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLml0ZW1zLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAodGhpcy5pdGVtc1tpXS5pcyhpdGVtKSlcbiAgICAgICAgcmV0dXJuIHRoaXMuaXRlbXNbaSsxXVxuICAgIH1cblxuICAgIGFzc2VydChmYWxzZSwgXCJJdGVtIG5vdCBpbiBzbG90IGFzIGV4cGVjdGVkXCIpXG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuICB9XG4gIFxuICBhZGQoaXRlbXM6IFRbXSwgYmVmb3JlPzogVCk6IHRoaXMge1xuICAgIGNvbnN0IGlkeCA9ICgoKSA9PiB7XG4gICAgICBpZiAoYmVmb3JlKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuaXRlbXMuZmluZEluZGV4KGkgPT4gaS5pcyhiZWZvcmUpKVxuICAgICAgICBhc3NlcnQocmVzdWx0ICE9IC0xLCBcIk5vICdiZWZvcmUnIGVsZW1cIiwgYmVmb3JlKVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5pdGVtcy5sZW5ndGhcbiAgICAgIH1cbiAgICB9KSgpXG4gICAgXG4gICAgYXNzZXJ0KGl0ZW1zLmV2ZXJ5KGkgPT4gIXRoaXMuaXRlbXMuc29tZShpMiA9PiBpLmlzKGkyKSkpLCBcIlJlLWFkZCBvZiBpdGVtIHRvIHNsb3RcIilcbiAgICBhc3NlcnRmKCgpID0+IGlkeCA+PSAwICYmIGlkeCA8PSB0aGlzLml0ZW1zLmxlbmd0aClcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3QodGhpcy5pZENudCwgdGhpcy5pZFNsb3QsIHRoaXMuaXRlbXMuc2xpY2UoMCwgaWR4KS5jb25jYXQoaXRlbXMpLmNvbmNhdCh0aGlzLml0ZW1zLnNsaWNlKGlkeCkpKVxuICB9XG5cbiAgcmVtb3ZlKGl0ZW1zOiBUW10pOiB0aGlzIHtcbiAgICBpZiAoaXRlbXMubGVuZ3RoKSB7XG4gICAgICBhc3NlcnRmKCgpID0+IGl0ZW1zLmV2ZXJ5KGkgPT4gdGhpcy5pdGVtcy5zb21lKGkyID0+IGkyLmlzKGkpKSksIFwiU29tZSBpdGVtcyB0byBiZSByZW1vdmVkIG5vdCBmb3VuZCBpbiBzbG90XCIpXG4gICAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3QodGhpcy5pZENudCwgdGhpcy5pZFNsb3QsIHRoaXMuaXRlbXMuZmlsdGVyKGkgPT4gIWl0ZW1zLnNvbWUoaTIgPT4gaTIuaXMoaSkpKSlcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG4gIH1cblxuICByZXBsYWNlKGl0ZW06IFQsIGl0ZW1fOiBUKTogdGhpcyB7XG4gICAgY29uc3QgaWR4ID0gdGhpcy5pdGVtcy5maW5kSW5kZXgoaSA9PiBpLmlzKGl0ZW0pKVxuICAgIGFzc2VydGYoKCkgPT4gaWR4ICE9IC0xLCBcIkl0ZW0gdG8gYmUgcmVwbGFjZWQgbm90IGZvdW5kIGluIHNsb3RcIilcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3QodGhpcy5pZENudCwgdGhpcy5pZFNsb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaXRlbXMuc2xpY2UoMCwgaWR4KS5jb25jYXQoW2l0ZW1fXSkuY29uY2F0KHRoaXMuaXRlbXMuc2xpY2UoaWR4KzEpKSlcbiAgfVxuXG4gIHRvcCgpOiBUIHtcbiAgICBhc3NlcnRmKCgpID0+ICF0aGlzLmlzRW1wdHkoKSlcbiAgICByZXR1cm4gdGhpcy5pdGVtc1t0aGlzLml0ZW1zLmxlbmd0aC0xXVxuICB9XG5cbiAgaXNFbXB0eSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5sZW5ndGggPT0gMFxuICB9XG5cbiAgaXRlbShpZHg6IG51bWJlcik6IFQge1xuICAgIGFzc2VydGYoKCkgPT4gaWR4ID49IDAgJiYgaWR4IDwgdGhpcy5pdGVtcy5sZW5ndGgpXG4gICAgcmV0dXJuIHRoaXMuaXRlbXNbaWR4XVxuICB9XG5cbiAgbGVuZ3RoKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuaXRlbXMubGVuZ3RoXG4gIH1cblxuICBoYXNJdGVtKGl0ZW06IFQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5zb21lKGkgPT4gaS5pcyhpdGVtKSlcbiAgfVxuXG4gIG1hcChmOiAoYzogVCkgPT4gVCk6IHRoaXMge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdCh0aGlzLmlkQ250LCB0aGlzLmlkU2xvdCwgdGhpcy5pdGVtcy5tYXAoZikpXG4gIH1cbiAgXG4gIHdpdGhNb3ZlKG1vdmU6IE1vdmVJdGVtczx0aGlzLCBUPikge1xuICAgIGxldCByZXN1bHQgPSB0aGlzXG5cbiAgICAvLyBBIG1vdmUgbWF5IGhhdmUgdGhlIHNhbWUgc2xvdCBhcyBib3RoIGEgc291cmNlIGFuZCBhIGRlc3RpbmF0aW9uLlxuICAgIC8vIFRoZSBjYXJkIHN0YXRlIG1heSBoYXZlIGNoYW5nZWQuXG4gICAgaWYgKHRoaXMuaXNJZCguLi5tb3ZlLmlkU291cmNlKSlcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZW1vdmUobW92ZS5pdGVtcylcbiAgICBpZiAodGhpcy5pc0lkKC4uLm1vdmUuaWREZXN0KSkge1xuICAgICAgaWYgKG1vdmUuZGVzdEJlZm9yZUl0ZW0gJiYgIXRoaXMuaGFzSXRlbShtb3ZlLmRlc3RCZWZvcmVJdGVtKSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRGVzdCBzbG90IGRvZXNuJ3QgaGF2ZSBiZWZvcmVJdGVtXCIsIHRoaXMsIG1vdmUpXG4gICAgICAgIHJlc3VsdCA9IHJlc3VsdC5hZGQobW92ZS5pdGVtcylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IHJlc3VsdC5hZGQobW92ZS5pdGVtcywgbW92ZS5kZXN0QmVmb3JlSXRlbSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cbiAgXG4gIFtTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhdG9yPFQ+IHtcbiAgICByZXR1cm4gdGhpcy5pdGVtc1tTeW1ib2wuaXRlcmF0b3JdKClcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU2xvdENhcmQgZXh0ZW5kcyBTbG90SXRlbTxXb3JsZENhcmQ+IHtcbiAgY29uc3RydWN0b3IoaWRDbnQ6IHN0cmluZywgaWQ6IG51bWJlciwgY2FyZHM6IHJlYWRvbmx5IFdvcmxkQ2FyZFtdID0gW10pIHtcbiAgICBzdXBlcihpZCwgKGlkQ250LGlkLGNhcmRzKSA9PiBuZXcgU2xvdENhcmQoaWRDbnQsIGlkLCBjYXJkcyksIGlkQ250LCBjYXJkcylcbiAgfVxuXG4gIHN0YXRpYyBmcm9tU2VyaWFsaXplZChzZXJpYWxpemVkOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IFNsb3RDYXJkKHNlcmlhbGl6ZWQuaWRDbnQsIHNlcmlhbGl6ZWQuaWRTbG90LCBzZXJpYWxpemVkLml0ZW1zLm1hcCgoYzogYW55KSA9PiBXb3JsZENhcmQuZnJvbVNlcmlhbGl6ZWQoYykpKVxuICB9XG5cbiAgY29udGFpbmVyKHBsYXlmaWVsZDogUGxheWZpZWxkKTogQ29udGFpbmVyU2xvdENhcmQge1xuICAgIHJldHVybiBwbGF5ZmllbGQuY29udGFpbmVyQ2FyZCh0aGlzLmlkQ250KVxuICB9XG5cbiAgZmluZEJ5SWQoaWQ6IHN0cmluZyk6IFdvcmxkQ2FyZHx1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmZpbmQoaSA9PiBpLmlzSWQoaWQpKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb250YWluZXJTbG90Q2FyZCBleHRlbmRzIENvbnRhaW5lclNsb3Q8U2xvdENhcmQsIFdvcmxkQ2FyZD4ge1xuICBjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCBzbG90czogcmVhZG9ubHkgU2xvdENhcmRbXT1bXSwgc2VjcmV0PWZhbHNlKSB7XG4gICAgc3VwZXIoaWQsIChpZCxzbG90cyxzZWNyZXQpID0+IG5ldyBDb250YWluZXJTbG90Q2FyZChpZCxzbG90cyxzZWNyZXQpLCBzbG90cywgc2VjcmV0KVxuICB9XG4gIFxuICBzdGF0aWMgZnJvbVNlcmlhbGl6ZWQoczogYW55KSB7XG4gICAgcmV0dXJuIG5ldyBDb250YWluZXJTbG90Q2FyZChzLmlkLCBzLnNsb3RzLm1hcCgoYzogYW55KSA9PiBTbG90Q2FyZC5mcm9tU2VyaWFsaXplZChjKSksIHMuc2VjcmV0KVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQbGF5ZXIgZXh0ZW5kcyBJZGVudGlmaWVkVmFyIHtcbiAgcmVhZG9ubHkgaWRDbnRzOiBzdHJpbmdbXVxuICBcbiAgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgaWRDbnRzOiBzdHJpbmdbXSkge1xuICAgIHN1cGVyKGlkKVxuICAgIHRoaXMuaWRDbnRzID0gaWRDbnRzXG4gIH1cblxuICBtdWx0aXBsZUFzc2lnbm1lbnRQb3NzaWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBsYXllclNwZWN0YXRvciBleHRlbmRzIFBsYXllciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwic3BlY3RhdG9yXCIsIFtdKVxuICB9XG5cbiAgbXVsdGlwbGVBc3NpZ25tZW50UG9zc2libGUoKTogYm9vbGVhbiB7IHJldHVybiB0cnVlIH1cbn1cblxuZW51bSBTdWl0IHtcbiAgQ0xVQj0wLFxuICBESUFNT05ELFxuICBIRUFSVCxcbiAgU1BBREVcbn1cblxuZW51bSBDb2xvciB7XG4gIEJMQUNLPTAsXG4gIFJFRD0xXG59XG5cbmV4cG9ydCBjbGFzcyBDYXJkIGV4dGVuZHMgSWRlbnRpZmllZFZhciB7XG4gIHJlYWRvbmx5IHN1aXQ6IG51bWJlclxuICByZWFkb25seSByYW5rOiBudW1iZXJcbiAgICBcbiAgY29uc3RydWN0b3IocmFuazogbnVtYmVyLCBzdWl0OiBudW1iZXIsIGlkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihpZClcbiAgICB0aGlzLnN1aXQgPSBzdWl0XG4gICAgdGhpcy5yYW5rID0gcmFua1xuICB9XG5cbiAgc3RhdGljIGZyb21TZXJpYWxpemVkKHNlcmlhbGl6ZWQ6IGFueSkge1xuICAgIHJldHVybiBuZXcgQ2FyZChzZXJpYWxpemVkLnJhbmssIHNlcmlhbGl6ZWQuc3VpdCwgc2VyaWFsaXplZC5pZClcbiAgfVxuXG4gIGNvbG9yKCk6IENvbG9yIHtcbiAgICBpZiAodGhpcy5zdWl0ID09IFN1aXQuQ0xVQiB8fCB0aGlzLnN1aXQgPT0gU3VpdC5TUEFERSlcbiAgICAgIHJldHVybiBDb2xvci5CTEFDS1xuICAgIGVsc2VcbiAgICAgIHJldHVybiBDb2xvci5SRURcbiAgfVxuXG4gIHJhbmtWYWx1ZShhY2VIaWdoOiBib29sZWFuKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5yYW5rID09IDAgJiYgYWNlSGlnaCA/IDEzIDogdGhpcy5yYW5rXG4gIH1cbiAgXG4gIHNlcmlhbGl6ZSgpOiBhbnkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi5zdXBlci5zZXJpYWxpemUoKSxcbiAgICAgIHN1aXQ6IHRoaXMuc3VpdCxcbiAgICAgIHJhbms6IHRoaXMucmFua1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ybGRDYXJkIGV4dGVuZHMgSWRlbnRpZmllZFZhcjxzdHJpbmc+IHtcbiAgcmVhZG9ubHkgY2FyZDogQ2FyZFxuICByZWFkb25seSBmYWNlVXA6IGJvb2xlYW5cbiAgcmVhZG9ubHkgZmFjZVVwSXNDb25zY2lvdXM6IGJvb2xlYW5cbiAgcmVhZG9ubHkgdHVybmVkOiBib29sZWFuXG5cbiAgY29uc3RydWN0b3IoY2FyZDogQ2FyZCwgZmFjZVVwOiBib29sZWFuLCBmYWNlVXBJc0NvbnNjaW91cz1mYWxzZSwgdHVybmVkPWZhbHNlLCBpZD1jYXJkLmlkKSB7XG4gICAgc3VwZXIoaWQpXG4gICAgdGhpcy5jYXJkID0gY2FyZFxuICAgIHRoaXMuZmFjZVVwID0gZmFjZVVwXG4gICAgdGhpcy5mYWNlVXBJc0NvbnNjaW91cyA9IGZhY2VVcElzQ29uc2Npb3VzXG4gICAgdGhpcy50dXJuZWQgPSB0dXJuZWRcbiAgfVxuXG4gIHN0YXRpYyBmcm9tU2VyaWFsaXplZChzZXJpYWxpemVkOiBhbnkpIHtcbiAgICByZXR1cm4gbmV3IFdvcmxkQ2FyZChDYXJkLmZyb21TZXJpYWxpemVkKHNlcmlhbGl6ZWQuY2FyZCksIHNlcmlhbGl6ZWQuZmFjZVVwLCBzZXJpYWxpemVkLmZhY2VVcElzQ29uc2Npb3VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWFsaXplZC50dXJuZWQpXG4gIH1cblxuICBlcXVhbHMocmhzOiBXb3JsZENhcmQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5jYXJkLmlzKHJocy5jYXJkKSAmJlxuICAgICAgdGhpcy5mYWNlVXAgPT0gcmhzLmZhY2VVcCAmJlxuICAgICAgdGhpcy5mYWNlVXBJc0NvbnNjaW91cyA9PSByaHMuZmFjZVVwSXNDb25zY2lvdXMgJiZcbiAgICAgIHRoaXMudHVybmVkID09IHJocy50dXJuZWRcbiAgfVxuXG4gIHdpdGhGYWNlVXAoZmFjZVVwOiBib29sZWFuKSB7XG4gICAgcmV0dXJuIG5ldyBXb3JsZENhcmQodGhpcy5jYXJkLCBmYWNlVXAsIHRoaXMuZmFjZVVwSXNDb25zY2lvdXMsIHRoaXMudHVybmVkKVxuICB9XG5cbiAgd2l0aEZhY2VTdGF0ZUNvbnNjaW91cyhmYWNlVXA6IGJvb2xlYW4sIGNvbnNjaW91czogYm9vbGVhbikge1xuICAgIHJldHVybiBuZXcgV29ybGRDYXJkKHRoaXMuY2FyZCwgZmFjZVVwLCBjb25zY2lvdXMsIHRoaXMudHVybmVkKVxuICB9XG4gIFxuICB3aXRoVHVybmVkKHR1cm5lZDogYm9vbGVhbikge1xuICAgIHJldHVybiBuZXcgV29ybGRDYXJkKHRoaXMuY2FyZCwgdGhpcy5mYWNlVXAsIHRoaXMuZmFjZVVwSXNDb25zY2lvdXMsIHR1cm5lZClcbiAgfVxuICBcbiAgc2VyaWFsaXplKCk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNhcmQ6IHRoaXMuY2FyZC5zZXJpYWxpemUoKSxcbiAgICAgIGZhY2VVcDogdGhpcy5mYWNlVXAsXG4gICAgICBmYWNlVXBJc0NvbnNjaW91czogdGhpcy5mYWNlVXBJc0NvbnNjaW91cyxcbiAgICAgIHR1cm5lZDogdGhpcy50dXJuZWRcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVjazUyKCkge1xuICBjb25zdCByZXN1bHQ6IENhcmRbXSA9IFtdXG4gIFxuICBmb3IgKGxldCBzdWl0ID0gMDsgc3VpdCA8IDQ7ICsrc3VpdCkge1xuICAgIGZvciAobGV0IHJhbmsgPSAwOyByYW5rIDwgMTM7ICsrcmFuaykge1xuICAgICAgcmVzdWx0LnB1c2gobmV3IENhcmQocmFuaywgc3VpdCwgcmFuaysnXycrc3VpdCkpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBkZWNrNTFOb0RldWNlKCkge1xuICByZXR1cm4gZGVjazUyKCkuZmlsdGVyKGMgPT4gYy5zdWl0ICE9IFN1aXQuU1BBREUgJiYgYy5yYW5rICE9IDEpXG59XG5cbmZ1bmN0aW9uIHNodWZmbGVkKGRlY2s6IENhcmRbXSk6IENhcmRbXSB7XG4gIGNvbnN0IHJlc3VsdDogQ2FyZFtdID0gW11cbiAgXG4gIHdoaWxlIChkZWNrLmxlbmd0aCkge1xuICAgIGNvbnN0IGlkeCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGRlY2subGVuZ3RoKVxuICAgIHJlc3VsdC5wdXNoKGRlY2tbaWR4XSlcbiAgICBkZWNrID0gZGVjay5zbGljZSgwLGlkeCkuY29uY2F0KGRlY2suc2xpY2UoaWR4KzEpKVxuICB9XG4gIFxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIG9yZGVyQ29sb3JBbHRlcm5hdGUoYzogQ2FyZCk6IG51bWJlciB7XG4gIHN3aXRjaCAoYy5zdWl0KSB7XG4gICAgY2FzZSBTdWl0LkNMVUI6IHJldHVybiAwXG4gICAgY2FzZSBTdWl0LkRJQU1PTkQ6IHJldHVybiAxXG4gICAgY2FzZSBTdWl0LlNQQURFOiByZXR1cm4gMlxuICAgIGNhc2UgU3VpdC5IRUFSVDogcmV0dXJuIDNcbiAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHN1aXQgXCIgKyBjLnN1aXQpXG4gIH1cbn1cblxuZnVuY3Rpb24gb3JkZXJDb2xvckFsdGVybmF0ZVJhbmsoYWNlSGlnaDogYm9vbGVhbiwgYTogQ2FyZCwgYjogQ2FyZCk6IG51bWJlciB7XG4gIHJldHVybiBvcmRlckNvbG9yQWx0ZXJuYXRlKGEpIC0gb3JkZXJDb2xvckFsdGVybmF0ZShiKSB8fCBhLnJhbmtWYWx1ZShhY2VIaWdoKSAtIGIucmFua1ZhbHVlKGFjZUhpZ2gpXG59XG5cbmZ1bmN0aW9uIG9yZGVyQ29sb3JBbHRlcm5hdGVSYW5rVyhhY2VIaWdoOiBib29sZWFuLCBhOiBXb3JsZENhcmQsIGI6IFdvcmxkQ2FyZCk6IG51bWJlciB7XG4gIHJldHVybiBvcmRlckNvbG9yQWx0ZXJuYXRlUmFuayhhY2VIaWdoLCBhLmNhcmQsIGIuY2FyZClcbn1cblxuZXhwb3J0IGNsYXNzIEV2ZW50TW92ZSBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgbW92ZTogTW92ZUl0ZW1zQW55LCByZWFkb25seSBsb2NhbEFjdGlvbjogYm9vbGVhbikge1xuICAgIHN1cGVyKCdnYW1lbW92ZScpXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV2ZW50Q29udGFpbmVyQ2hhbmdlIGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSBwbGF5ZmllbGQ6IFBsYXlmaWVsZCwgcmVhZG9ubHkgcGxheWZpZWxkXzogUGxheWZpZWxkLCByZWFkb25seSBpZENudDogc3RyaW5nKSB7XG4gICAgc3VwZXIoJ2NvbnRhaW5lcmNoYW5nZScpXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV2ZW50U2xvdENoYW5nZSBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgcGxheWZpZWxkOiBQbGF5ZmllbGQsIHJlYWRvbmx5IHBsYXlmaWVsZF86IFBsYXlmaWVsZCwgcmVhZG9ubHkgaWRDbnQ6IHN0cmluZyxcbiAgICAgICAgICAgICAgcmVhZG9ubHkgaWRTbG90OiBudW1iZXIpIHtcbiAgICBzdXBlcignc2xvdGNoYW5nZScpXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV2ZW50UGluZ0JhY2sgZXh0ZW5kcyBFdmVudCB7XG4gIHJlYWRvbmx5IHNlY3M6IG51bWJlclxuICBcbiAgY29uc3RydWN0b3Ioc2VjczogbnVtYmVyKSB7XG4gICAgc3VwZXIoJ3BpbmdiYWNrJylcbiAgICB0aGlzLnNlY3MgPSBzZWNzXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEV2ZW50UGVlclVwZGF0ZSBleHRlbmRzIEV2ZW50IHtcbiAgcmVhZG9ubHkgcGVlcnM6IFBlZXJQbGF5ZXJbXVxuICBcbiAgY29uc3RydWN0b3IocGVlcnM6IFBlZXJQbGF5ZXJbXSkge1xuICAgIHN1cGVyKCdwZWVydXBkYXRlJylcbiAgICB0aGlzLnBlZXJzID0gcGVlcnNcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXZlbnRQbGF5ZmllbGRDaGFuZ2UgZXh0ZW5kcyBFdmVudCB7XG4gIHJlYWRvbmx5IHBsYXlmaWVsZDogUGxheWZpZWxkXG4gIHJlYWRvbmx5IHBsYXlmaWVsZF86IFBsYXlmaWVsZFxuXG4gIGNvbnN0cnVjdG9yKHBsYXlmaWVsZDogUGxheWZpZWxkLCBwbGF5ZmllbGRfOiBQbGF5ZmllbGQpIHtcbiAgICBzdXBlcigncGxheWZpZWxkY2hhbmdlJylcbiAgICB0aGlzLnBsYXlmaWVsZCA9IHBsYXlmaWVsZFxuICAgIHRoaXMucGxheWZpZWxkXyA9IHBsYXlmaWVsZF9cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV2ZW50TWFwTm90aWZpZXJTbG90IHtcbiAgXCJnYW1lbW92ZVwiOiBFdmVudE1vdmUsXG4gIFwic2xvdGNoYW5nZVwiOiBFdmVudFNsb3RDaGFuZ2UsXG4gIFwiY29udGFpbmVyY2hhbmdlXCI6IEV2ZW50Q29udGFpbmVyQ2hhbmdlLFxuICBcInBsYXlmaWVsZGNoYW5nZVwiOiBFdmVudFBsYXlmaWVsZENoYW5nZVxufVxuXG5pbnRlcmZhY2UgRXZlbnRUYXJnZXROb3RpZmllclNsb3Qge1xuICBhZGRFdmVudExpc3RlbmVyPEsgZXh0ZW5kcyBrZXlvZiBFdmVudE1hcE5vdGlmaWVyU2xvdD4odHlwZTogSywgbGlzdGVuZXI6IChldjogRXZlbnRNYXBOb3RpZmllclNsb3RbS10pID0+IGFueSk6IHZvaWRcbiAgZGlzcGF0Y2hFdmVudChldmVudDogRXZlbnQpOiBib29sZWFuXG59XG5cbmZ1bmN0aW9uIG5ld0V2ZW50VGFyZ2V0KCkge1xuICAvLyBTaG91bGQgYmUgJ25ldyBFdmVudFRhcmdldCgpJywgYnV0IGlPUyBkb2Vzbid0IHN1cHBvcnQgdGhhdC5cbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpIGFzIEV2ZW50VGFyZ2V0Tm90aWZpZXJTbG90XG59XG5cbnR5cGUgRnVuY1Nsb3RVcGRhdGVQcmUgPSAoc2xvdHNPbGQ6IFNsb3RbXSwgbG9jYWxBY3Rpb246IGJvb2xlYW4pID0+IGFueVxudHlwZSBGdW5jU2xvdFVwZGF0ZVBvc3QgPSAoc2xvdHM6IFNsb3RbXSwgcmVzdWx0OiBhbnksIGxvY2FsQWN0aW9uOiBib29sZWFuKSA9PiB2b2lkXG5cbmV4cG9ydCBjbGFzcyBOb3RpZmllclNsb3Qge1xuICByZWFkb25seSBldmVudFRhcmdldDogRXZlbnRUYXJnZXROb3RpZmllclNsb3QgPSBuZXdFdmVudFRhcmdldCgpXG4gIHByaXZhdGUgcmVhZG9ubHkgZXZlbnRzOiBNYXA8c3RyaW5nLCBFdmVudFRhcmdldE5vdGlmaWVyU2xvdD4gPSBuZXcgTWFwKClcbiAgcHJpdmF0ZSByZWFkb25seSBwcmVTbG90VXBkYXRlczogRnVuY1Nsb3RVcGRhdGVQcmVbXSA9IFtdXG4gIHByaXZhdGUgcmVhZG9ubHkgcG9zdFNsb3RVcGRhdGVzOiBGdW5jU2xvdFVwZGF0ZVBvc3RbXSA9IFtdXG5cbiAgY29udGFpbmVyKGlkQ250OiBzdHJpbmcpIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5ldmVudHMuZ2V0KGlkQ250KVxuICAgIGlmICghcmVzdWx0KSB7XG4gICAgICByZXN1bHQgPSBuZXdFdmVudFRhcmdldCgpXG4gICAgICB0aGlzLmV2ZW50cy5zZXQoaWRDbnQsIHJlc3VsdClcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgc2xvdChpZENudDogc3RyaW5nLCBpZFNsb3Q6IG51bWJlcikge1xuICAgIGNvbnN0IGtleSA9IGlkQ250ICsgXCItXCIgKyBpZFNsb3RcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5ldmVudHMuZ2V0KGtleSlcbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgcmVzdWx0ID0gbmV3RXZlbnRUYXJnZXQoKVxuICAgICAgdGhpcy5ldmVudHMuc2V0KGtleSwgcmVzdWx0KVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICByZWdpc3RlclByZVNsb3RVcGRhdGUoZnVuYzogRnVuY1Nsb3RVcGRhdGVQcmUpIHtcbiAgICB0aGlzLnByZVNsb3RVcGRhdGVzLnB1c2goZnVuYylcbiAgfVxuICBcbiAgcmVnaXN0ZXJQb3N0U2xvdFVwZGF0ZShmdW5jOiBGdW5jU2xvdFVwZGF0ZVBvc3QpIHtcbiAgICB0aGlzLnBvc3RTbG90VXBkYXRlcy5wdXNoKGZ1bmMpXG4gIH1cblxuICBtb3ZlKG1vdmU6IE1vdmVJdGVtc0FueSwgbG9jYWxBY3Rpb249dHJ1ZSkge1xuICAgIHRoaXMuZXZlbnRUYXJnZXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnRNb3ZlKG1vdmUsIGxvY2FsQWN0aW9uKSlcbiAgfVxuICBcbiAgc2xvdHNVcGRhdGUocGxheWZpZWxkOiBQbGF5ZmllbGQsIHBsYXlmaWVsZF86IFBsYXlmaWVsZCwgc2xvdHNDaGFuZ2VkOiBTZXQ8W3N0cmluZywgbnVtYmVyXT4sIGxvY2FsQWN0aW9uOiBib29sZWFuKSB7XG4gICAgLy8gTm90ZTogc2xvdHNDaGFuZ2VkIG1heSBpbmNsdWRlIG5ldyBzbG90cyBub3QgaW4gdGhlIG9sZCBwbGF5ZmllbGRcbiAgICBjb25zdCBvbGRTbG90cyA9IGl0LmZsYXRNYXAoXG4gICAgICBzbG90c0NoYW5nZWQsXG4gICAgICAoW2lkQ250LCBpZF0pID0+IHBsYXlmaWVsZC5jb250YWluZXIoaWRDbnQpLmhhc1Nsb3QoaWRDbnQsIGlkKSA/IFtwbGF5ZmllbGQuY29udGFpbmVyKGlkQ250KS5zbG90KGlkKV0gOiBbXVxuICAgIClcbiAgICBjb25zdCBwcmVTbG90Q2hhbmdlSW5mbyA9IHRoaXMucHJlU2xvdFVwZGF0ZXMubWFwKGYgPT4gZihBcnJheS5mcm9tKG9sZFNsb3RzKSwgbG9jYWxBY3Rpb24pKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgZm9yIChjb25zdCBbaWRDbnQsIGlkXSBvZiBzbG90c0NoYW5nZWQpIHtcbiAgICAgIHRoaXMuc2xvdChpZENudCwgaWQpLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIG5ldyBFdmVudFNsb3RDaGFuZ2UocGxheWZpZWxkLCBwbGF5ZmllbGRfLCBpZENudCwgaWQpXG4gICAgICApXG4gICAgfVxuICAgICAgXG4gICAgY29uc3QgbmV3U2xvdHMgPSBpdC5tYXAoc2xvdHNDaGFuZ2VkLCAoW2lkQ250LCBpZF0pID0+IHBsYXlmaWVsZF8uY29udGFpbmVyKGlkQ250KS5zbG90KGlkKSlcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBwcmVTbG90Q2hhbmdlSW5mbylcbiAgICAgIGZvciAoY29uc3QgZiBvZiB0aGlzLnBvc3RTbG90VXBkYXRlcylcbiAgICAgICAgZihBcnJheS5mcm9tKG5ld1Nsb3RzKSwgcmVzdWx0LCBsb2NhbEFjdGlvbilcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQ2hpcCBleHRlbmRzIElkZW50aWZpZWRWYXI8bnVtYmVyPiB7XG4gIHJlYWRvbmx5IHZhbHVlOiBudW1iZXJcbiAgXG4gIGNvbnN0cnVjdG9yKGlkOiBudW1iZXIsIHZhbHVlOiBudW1iZXIpIHtcbiAgICBzdXBlcihpZClcbiAgICB0aGlzLnZhbHVlID0gdmFsdWVcbiAgfVxuXG4gIHNlcmlhbGl6ZSgpOiBhbnkge1xuICAgIHJldHVybiB7Li4uc3VwZXIuc2VyaWFsaXplKCksIHZhbHVlOiB0aGlzLnZhbHVlIH1cbiAgfVxuICBcbiAgc3RhdGljIGZyb21TZXJpYWxpemVkKHM6IGFueSkge1xuICAgIHJldHVybiBuZXcgQ2hpcChzLmlkLCBzLnZhbHVlKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTbG90Q2hpcCBleHRlbmRzIFNsb3RJdGVtPENoaXA+IHtcbiAgY29uc3RydWN0b3IoaWRDbnQ6IHN0cmluZywgaWQ6IG51bWJlciwgY2hpcHM6IHJlYWRvbmx5IENoaXBbXSA9IFtdKSB7XG4gICAgc3VwZXIoaWQsIChpZENudDogc3RyaW5nLCBpZDogbnVtYmVyLCBjaGlwczogcmVhZG9ubHkgQ2hpcFtdKSA9PiBuZXcgU2xvdENoaXAoaWRDbnQsIGlkLCBjaGlwcyksIGlkQ250LCBjaGlwcylcbiAgfVxuXG4gIHN0YXRpYyBmcm9tU2VyaWFsaXplZChzZXJpYWxpemVkOiBhbnkpOiBTbG90Q2hpcCB7XG4gICAgcmV0dXJuIG5ldyBTbG90Q2hpcChzZXJpYWxpemVkLmlkQ250LCBzZXJpYWxpemVkLmlkU2xvdCwgc2VyaWFsaXplZC5pdGVtcy5tYXAoKGM6IGFueSkgPT4gQ2hpcC5mcm9tU2VyaWFsaXplZChjKSkpXG4gIH1cblxuICBjb250YWluZXIocGxheWZpZWxkOiBQbGF5ZmllbGQpOiBDb250YWluZXJTbG90Q2hpcCB7XG4gICAgcmV0dXJuIHBsYXlmaWVsZC5jb250YWluZXJDaGlwKHRoaXMuaWRDbnQpXG4gIH1cbn1cblxuY2xhc3MgQ29udGFpbmVyU2xvdENoaXAgZXh0ZW5kcyBDb250YWluZXJTbG90PFNsb3RDaGlwLCBDaGlwPiB7XG4gIGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIHNsb3RzOiByZWFkb25seSBTbG90Q2hpcFtdPVtdLCBzZWNyZXQ9ZmFsc2UpIHtcbiAgICBzdXBlcihpZCxcbiAgICAgICAgICAoaWQ6IHN0cmluZyxzbG90czogcmVhZG9ubHkgU2xvdENoaXBbXSxzZWNyZXQ9ZmFsc2UpID0+IG5ldyBDb250YWluZXJTbG90Q2hpcChpZCxzbG90cyxzZWNyZXQpLFxuICAgICAgICAgIHNsb3RzLFxuICAgICAgICAgIHNlY3JldClcbiAgfVxuICBcbiAgc3RhdGljIGZyb21TZXJpYWxpemVkKHM6IGFueSkge1xuICAgIHJldHVybiBuZXcgQ29udGFpbmVyU2xvdENoaXAocy5pZCwgcy5zbG90cy5tYXAoKGM6IGFueSkgPT4gU2xvdENoaXAuZnJvbVNlcmlhbGl6ZWQoYykpLCBzLnNlY3JldClcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGxheWZpZWxkIHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgc2VxdWVuY2U6IG51bWJlcixcbiAgICAgICAgICAgICAgcmVhZG9ubHkgY29udGFpbmVyczogcmVhZG9ubHkgQ29udGFpbmVyU2xvdENhcmRbXSxcbiAgICAgICAgICAgICAgcmVhZG9ubHkgY29udGFpbmVyc0NoaXA6IHJlYWRvbmx5IENvbnRhaW5lclNsb3RDaGlwW10pIHtcbiAgICBhc3NlcnQoc2VxdWVuY2UgIT0gTmFOKVxuICB9XG5cbiAgc3RhdGljIGZyb21TZXJpYWxpemVkKHNlcmlhbGl6ZWQ6IGFueSk6IFBsYXlmaWVsZCB7XG4gICAgcmV0dXJuIG5ldyBQbGF5ZmllbGQoXG4gICAgICBzZXJpYWxpemVkLnNlcXVlbmNlLFxuICAgICAgc2VyaWFsaXplZC5jb250YWluZXJzLm1hcCgoczogYW55KSA9PiBDb250YWluZXJTbG90Q2FyZC5mcm9tU2VyaWFsaXplZChzKSksXG4gICAgICBzZXJpYWxpemVkLmNvbnRhaW5lcnNDaGlwLm1hcCgoczogYW55KSA9PiBDb250YWluZXJTbG90Q2hpcC5mcm9tU2VyaWFsaXplZChzKSlcbiAgICApXG4gIH1cbiAgXG4gIHNlcmlhbGl6ZSgpOiBhbnkge1xuICAgIHJldHVybiB7IHNlcXVlbmNlOiB0aGlzLnNlcXVlbmNlLCBjb250YWluZXJzOiB0aGlzLmNvbnRhaW5lcnMubWFwKHMgPT4gcy5zZXJpYWxpemUoKSksXG4gICAgICAgICAgICAgY29udGFpbmVyc0NoaXA6IHRoaXMuY29udGFpbmVyc0NoaXAubWFwKHMgPT4gcy5zZXJpYWxpemUoKSkgfVxuICB9XG5cbiAgd2l0aFR1cm5TZXF1ZW5jZSh0dXJuU2VxdWVuY2U6IG51bWJlcikge1xuICAgIHJldHVybiBuZXcgUGxheWZpZWxkKHR1cm5TZXF1ZW5jZSwgdGhpcy5jb250YWluZXJzLCB0aGlzLmNvbnRhaW5lcnNDaGlwKVxuICB9XG4gIFxuICB3aXRoTW92ZUNhcmRzKG1vdmU6IE1vdmVDYXJkcyk6IFBsYXlmaWVsZCB7XG4gICAgcmV0dXJuIG5ldyBQbGF5ZmllbGQobW92ZS50dXJuU2VxdWVuY2UsIHRoaXMuY29udGFpbmVycy5tYXAoY250ID0+IGNudC53aXRoTW92ZShtb3ZlKSksIHRoaXMuY29udGFpbmVyc0NoaXApXG4gIH1cbiAgXG4gIHdpdGhNb3ZlQ2hpcHMobW92ZTogTW92ZUNoaXBzKTogUGxheWZpZWxkIHtcbiAgICByZXR1cm4gbmV3IFBsYXlmaWVsZChtb3ZlLnR1cm5TZXF1ZW5jZSwgdGhpcy5jb250YWluZXJzLCB0aGlzLmNvbnRhaW5lcnNDaGlwLm1hcChjbnQgPT4gY250LndpdGhNb3ZlKG1vdmUpKSlcbiAgfVxuICAgIFxuICBjb250YWluZXJDYXJkKGlkOiBzdHJpbmcpOiBDb250YWluZXJTbG90Q2FyZCB7XG4gICAgY29uc3QgY250ID0gdGhpcy5jb250YWluZXJzLmZpbmQoYyA9PiBjLmlzSWQoaWQpKVxuICAgIGFzc2VydGYoKCkgPT4gY250KVxuICAgIHJldHVybiBjbnQhXG4gIH1cblxuICBjb250YWluZXJDaGlwKGlkOiBzdHJpbmcpOiBDb250YWluZXJTbG90Q2hpcCB7XG4gICAgY29uc3QgY250ID0gdGhpcy5jb250YWluZXJzQ2hpcC5maW5kKGMgPT4gYy5pc0lkKGlkKSlcbiAgICBhc3NlcnRmKCgpID0+IGNudClcbiAgICByZXR1cm4gY250IVxuICB9XG5cbiAgY29udGFpbmVyKGlkOiBzdHJpbmcpOiBDb250YWluZXJTbG90QW55IHtcbiAgICBsZXQgY250OiBDb250YWluZXJTbG90QW55fHVuZGVmaW5lZCA9IHRoaXMuY29udGFpbmVycy5maW5kKGMgPT4gYy5pc0lkKGlkKSlcbiAgICBpZiAoIWNudClcbiAgICAgICBjbnQgPSB0aGlzLmNvbnRhaW5lcnNDaGlwLmZpbmQoYyA9PiBjLmlzSWQoaWQpKVxuICAgIGFzc2VydGYoKCkgPT4gY250KVxuICAgIHJldHVybiBjbnQhXG4gIH1cbn1cblxuZGVjbGFyZSB2YXIgUGVlcjogYW55XG5cbmV4cG9ydCBjbGFzcyBQZWVyUGxheWVyIGV4dGVuZHMgSWRlbnRpZmllZFZhciB7XG4gIHByaXZhdGUgY29ubj86IGFueVxuICBwcml2YXRlIGVycj86IGFueVxuICBwcml2YXRlIHBsYXllcjogUGxheWVyXG4gIHByaXZhdGUgY29ubmVjdGluZyA9IHRydWVcbiAgY29uc2lzdGVuY3kgPSAwXG4gIGNvbnNpc3RlbmN5UmVwb3J0ZWQgPSAwXG5cbiAgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgcHJpdmF0ZSByZWFkb25seSBjb25uczogQ29ubmVjdGlvbnMsIHBsYXllcjogUGxheWVyLFxuICAgICAgICAgICAgICByZWFkb25seSBvblJlY29ubmVjdDoocDogUGVlclBsYXllcikgPT4gdm9pZCkge1xuICAgIHN1cGVyKGlkKVxuICAgIHRoaXMuY29ubnMgPSBjb25uc1xuICAgIHRoaXMucGxheWVyID0gcGxheWVyXG4gIH1cblxuICBnZXQgY29uc2lzdGVudCgpIHsgcmV0dXJuIHRoaXMuY29uc2lzdGVuY3kgPT0gdGhpcy5jb25zaXN0ZW5jeVJlcG9ydGVkIH1cbiAgXG4gIGtlZXBDb25uZWN0ZWQodGltZW91dD0xMDAwMCwgZmFpbFRpbWVvdXQ9MjAwMCwgcmVjb25uZWN0cz0wKSB7XG4gICAgaWYgKHRoaXMub3BlbigpKSB7XG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0aGlzLmtlZXBDb25uZWN0ZWQodGltZW91dCwgMjAwMCwgMCksIHRpbWVvdXQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChyZWNvbm5lY3RzIDwgMzApIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJMb3N0IHBlZXIgY29ubmVjdGlvbiwgdHJ5aW5nIHRvIHJlY29ubmVjdFwiLCB0aGlzLmlkLCByZWNvbm5lY3RzLCBmYWlsVGltZW91dClcblxuICAgICAgICB0aGlzLmVyciA9IHVuZGVmaW5lZFxuICAgICAgICB0aGlzLmNvbm5zLmNvbm5lY3QoXG4gICAgICAgICAgdGhpcy5pZCxcbiAgICAgICAgICB0aGlzLnBsYXllcixcbiAgICAgICAgICAocGVlclBsYXllciwgY29ubikgPT4geyB0aGlzLm9uT3BlbmVkKGNvbm4pOyB0aGlzLm9uUmVjb25uZWN0KHBlZXJQbGF5ZXIpIH0sXG4gICAgICAgICAge31cbiAgICAgICAgKVxuICAgICAgICBcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGhpcy5rZWVwQ29ubmVjdGVkKHRpbWVvdXQsIGZhaWxUaW1lb3V0LCArK3JlY29ubmVjdHMpLCBmYWlsVGltZW91dClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQ2FuJ3QgcmVjb25uZWN0IHRvIHBlZXIgJHt0aGlzLmlkfSBhZnRlciAke3JlY29ubmVjdHN9IHRyaWVzYClcbiAgICAgICAgdGhpcy5jb25ucy5vblBlZXJMb3N0KHRoaXMpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29ubmVjdGluZ0dldCgpIHsgcmV0dXJuIHRoaXMuY29ubmVjdGluZyB9XG4gIFxuICBvbk9wZW5lZChjb25uOiBhbnkpIHtcbiAgICBjb25zdCBmaXJzdENvbm5lY3Rpb24gPSB0aGlzLmNvbm4gPT09IHVuZGVmaW5lZFxuICAgIHRoaXMuY29ubiA9IGNvbm5cbiAgICB0aGlzLmNvbm5lY3RpbmcgPSBmYWxzZVxuICAgIHRoaXMuZXJyID0gdW5kZWZpbmVkXG5cbiAgICBpZiAoZmlyc3RDb25uZWN0aW9uKVxuICAgICAgdGhpcy5rZWVwQ29ubmVjdGVkKClcbiAgfVxuXG4gIG9uT3BlbkZhaWxlZChlcnI6IGFueSkge1xuICAgIHRoaXMuY29ubmVjdGluZyA9IGZhbHNlXG4gICAgdGhpcy5lcnIgPSBlcnJcbiAgfVxuICBcbiAgb3BlbigpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5jb25uPy5vcGVuXG4gIH1cblxuICBzdGF0dXMoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lcnIgPyAnRXJyb3InIDpcbiAgICAgIHRoaXMuY29ubmVjdGluZ0dldCgpID8gJ0Nvbm5lY3RpbmcuLi4nIDpcbiAgICAgIHRoaXMub3BlbigpID8gJ0Nvbm5lY3RlZCcgOlxuICAgICAgJ0Rpc2Nvbm5lY3RlZCdcbiAgfVxuXG4gIHBsYXllckdldCgpOiBQbGF5ZXIgeyByZXR1cm4gdGhpcy5wbGF5ZXIgfVxuICBwbGF5ZXJDaGFuZ2UocGxheWVyOiBQbGF5ZXIpOiB2b2lkIHsgdGhpcy5wbGF5ZXIgPSBwbGF5ZXIgfVxuICBcbiAgc2VuZChkYXRhOiBhbnkpIHtcbiAgICBhc3NlcnQodGhpcy5vcGVuKCkpXG4gICAgY29uc29sZS5kZWJ1ZygnU2VuZCB0byAnICsgdGhpcy5pZCwgZGF0YSlcbiAgICB0aGlzLmNvbm4uc2VuZChkYXRhKVxuICB9XG5cbiAgc2VyaWFsaXplKCk6IGFueSB7XG4gICAgcmV0dXJuIHsgLi4uc3VwZXIuc2VyaWFsaXplKCksIHBsYXllcjogdGhpcy5wbGF5ZXIuaWQgfVxuICB9XG59XG5cbmludGVyZmFjZSBFdmVudE1hcENvbm5lY3Rpb25zIHtcbiAgXCJwZWVydXBkYXRlXCI6IEV2ZW50UGVlclVwZGF0ZVxufVxuXG5pbnRlcmZhY2UgRXZlbnRUYXJnZXRDb25uZWN0aW9ucyB7XG4gIGFkZEV2ZW50TGlzdGVuZXI8SyBleHRlbmRzIGtleW9mIEV2ZW50TWFwQ29ubmVjdGlvbnM+KHR5cGU6IEssIGxpc3RlbmVyOiAoZXY6IEV2ZW50TWFwQ29ubmVjdGlvbnNbS10pID0+IGFueSk6IHZvaWRcbiAgZGlzcGF0Y2hFdmVudChldmVudDogRXZlbnRQZWVyVXBkYXRlKTogdm9pZFxufVxuXG5leHBvcnQgY2xhc3MgQ29ubmVjdGlvbnMge1xuICByZWFkb25seSBldmVudHM6IEV2ZW50VGFyZ2V0Q29ubmVjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpIGFzIEV2ZW50VGFyZ2V0Q29ubmVjdGlvbnNcbiAgcHJpdmF0ZSByZWdpc3RyYW50OiBhbnlcbiAgcHJpdmF0ZSByZWdpc3RlcmluZzogYm9vbGVhbiA9IGZhbHNlXG4gIHByaXZhdGUgcGVlcnM6IE1hcDxzdHJpbmcsIFBlZXJQbGF5ZXI+ID0gbmV3IE1hcCgpXG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBvblJlY29ubmVjdDoocGVlcjogUGVlclBsYXllcikgPT4gdm9pZCkge1xuICB9XG4gIFxuICByZWdpc3RyYW50SWQoKTogc3RyaW5nfHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMucmVnaXN0cmFudD8uaWRcbiAgfVxuICBcbiAgcmVnaXN0ZXIoaWQ6IHN0cmluZyxcbiAgICAgICAgICAgb25QZWVyQ29ubmVjdDoobWV0YWRhdGE6IGFueSwgcGVlcjogUGVlclBsYXllcikgPT4gdm9pZCxcbiAgICAgICAgICAgb25SZWNlaXZlOihkYXRhOiBhbnksIHBlZXI6IFBlZXJQbGF5ZXIpID0+IHZvaWQsXG4gICAgICAgICAgIHBsYXllckRlZmF1bHQ6IFBsYXllcixcbiAgICAgICAgICAgcmVnaXN0cmFudFBsYXllckdldDooKSA9PiBQbGF5ZXIsXG4gICAgICAgICAgIG1heFBsYXllcnNHZXQ6KCkgPT4gbnVtYmVyXG4gICAgICAgICAgKSB7XG4gICAgXG4gICAgYXNzZXJ0ZigoKSA9PiBpZClcbiAgICBhc3NlcnRmKCgpID0+ICF0aGlzLnJlZ2lzdGVyaW5nKVxuICAgIFxuICAgIGlmICh0aGlzLnJlZ2lzdHJhbnQpIHtcbiAgICAgIGlmIChpZCA9PSB0aGlzLnJlZ2lzdHJhbnQuaWQpIHtcbiAgICAgICAgaWYgKHRoaXMucmVnaXN0cmFudC5kaXNjb25uZWN0ZWQpIHtcbiAgICAgICAgICBkb20uZGVtYW5kQnlJZChcInBlZXJqcy1zdGF0dXNcIikuaW5uZXJIVE1MID0gXCJSZS1yZWdpc3RlcmluZ1wiIC8vIG1vdmUgdGhpc1xuICAgICAgICAgIHRoaXMucmVnaXN0cmFudC5yZWNvbm5lY3QoKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb20uZGVtYW5kQnlJZChcInBlZXJqcy1zdGF0dXNcIikuaW5uZXJIVE1MID0gXCJSZS1yZWdpc3RlcmluZ1wiXG4gICAgICAgIHRoaXMucmVnaXN0cmFudC5kaXNjb25uZWN0KClcbiAgICAgICAgdGhpcy5yZWdpc3RyYW50ID0gbnVsbFxuICAgICAgICB0aGlzLnJlZ2lzdGVyKGlkLCBvblBlZXJDb25uZWN0LCBvblJlY2VpdmUsIHBsYXllckRlZmF1bHQsIHJlZ2lzdHJhbnRQbGF5ZXJHZXQsIG1heFBsYXllcnNHZXQpXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB0aGlzLnJlZ2lzdGVyaW5nID0gdHJ1ZVxuXG4gICAgY29uc3QgaG9zdCA9IGRvbS5kZW1hbmRCeUlkKFwicGVlcmpzLWhvc3RcIiwgSFRNTElucHV0RWxlbWVudCkudmFsdWUuc3BsaXQoJy8nKVswXVxuICAgIGNvbnN0IHBhdGggPSBkb20uZGVtYW5kQnlJZChcInBlZXJqcy1ob3N0XCIsIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlLnNwbGl0KCcvJylbMV1cbiAgICBjb25zdCBjb25uZWN0aW9uID1cbiAgICAgIGhvc3QgPyB7aG9zdDogaG9zdC5zcGxpdCgnOicpWzBdLCBwb3J0OiBob3N0LnNwbGl0KCc6JylbMV0gPz8gOTAwMCwgcGF0aDogcGF0aCA/PyAnLyd9IDogdW5kZWZpbmVkXG4gICAgY29uc3QgcmVnaXN0cmFudCA9IG5ldyBQZWVyKGlkLCBjb25uZWN0aW9uKVxuXG4gICAgcmVnaXN0cmFudC5vbignZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgIHRoaXMucmVnaXN0ZXJpbmcgPSBmYWxzZVxuICAgICAgaWYgKGVyci50eXBlICE9ICdwZWVyLXVuYXZhaWxhYmxlJykge1xuICAgICAgICB0aGlzLnJlZ2lzdHJhbnQgPSBudWxsXG4gICAgICAgIGRvbS5kZW1hbmRCeUlkKFwicGVlcmpzLXN0YXR1c1wiKS5pbm5lckhUTUwgPSBcIlVucmVnaXN0ZXJlZFwiXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtlcnIudHlwZX0gJHtlcnJ9YClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vID9cbiAgICAgICAgY29uc3QgaWRQZWVyID0gZXJyLnRvU3RyaW5nKCkuc2xpY2UoXCJFcnJvcjogQ291bGQgbm90IGNvbm5lY3QgdG8gcGVlciBcIi5sZW5ndGgpXG4gICAgICAgIHRoaXMucGVlckJ5SWQoaWRQZWVyKT8ub25PcGVuRmFpbGVkKGVyci50b1N0cmluZygpKVxuICAgICAgICB0aGlzLmV2ZW50cy5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudFBlZXJVcGRhdGUoQXJyYXkuZnJvbSh0aGlzLnBlZXJzLnZhbHVlcygpKSkpXG4gICAgICAgIGNvbnNvbGUubG9nKFwiUmVnaXN0cmFudCBlcnJvclwiLCBlcnIudHlwZSwgZXJyKVxuICAgICAgfVxuICAgIH0pXG4gICAgXG4gICAgY29uc29sZS5sb2coXCJSZWdpc3RlcmluZyBhcyBcIiArIGlkKVxuXG4gICAgcmVnaXN0cmFudC5vbignY2xvc2UnLCAoaWQ6IGFueSkgPT4ge1xuICAgICAgZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtc3RhdHVzXCIpLmlubmVySFRNTCA9IFwiVW5yZWdpc3RlcmVkXCJcbiAgICAgIHRoaXMucmVnaXN0cmFudCA9IG51bGxcbiAgICB9KVxuICAgIFxuICAgIHJlZ2lzdHJhbnQub24oJ29wZW4nLCAoaWQ6IGFueSkgPT4ge1xuICAgICAgdGhpcy5yZWdpc3RlcmluZyA9IGZhbHNlXG4gICAgICB0aGlzLnJlZ2lzdHJhbnQgPSByZWdpc3RyYW50XG4gICAgICBcbiAgICAgIGRvbS5kZW1hbmRCeUlkKFwicGVlcmpzLXN0YXR1c1wiKS5pbm5lckhUTUwgPSBcIlJlZ2lzdGVyZWRcIlxuICAgIH0pXG5cbiAgICByZWdpc3RyYW50Lm9uKCdjb25uZWN0aW9uJywgKGNvbm46IGFueSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coXCJQZWVyIGNvbm5lY3RlZCB0byB1c1wiLCBjb25uKVxuXG4gICAgICB7XG4gICAgICAgIGNvbnN0IHBlZXJQbGF5ZXIgPSB0aGlzLnBlZXJCeUlkKGNvbm4ucGVlcilcbiAgICAgICAgXG4gICAgICAgIGlmICghcGVlclBsYXllciB8fCAhcGVlclBsYXllci5vcGVuKCkpIHtcbiAgICAgICAgICB0aGlzLmNvbm5lY3QoXG4gICAgICAgICAgICBjb25uLnBlZXIsXG4gICAgICAgICAgICBwbGF5ZXJEZWZhdWx0LFxuICAgICAgICAgICAgKHBlZXI6IFBlZXJQbGF5ZXIsIF86IGFueSkgPT4gb25QZWVyQ29ubmVjdChjb25uLm1ldGFkYXRhLCBwZWVyKSxcbiAgICAgICAgICAgIHt9XG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbm4ub24oJ2RhdGEnLCAoZGF0YTogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IHBlZXIgPSB0aGlzLnBlZXJCeUlkKGNvbm4ucGVlcilcblxuICAgICAgICBjb25zb2xlLmRlYnVnKCdSZWNlaXZlZCBmcm9tICcgKyBjb25uLnBlZXIgKyAnIGluIHN0YXRlIG9wZW49JyArIHBlZXI/Lm9wZW4oKSwgZGF0YSlcblxuICAgICAgICBwZWVyICYmIHBlZXIub3BlbigpICYmIG9uUmVjZWl2ZShkYXRhLCBwZWVyKVxuICAgICAgfSlcbiAgICAgIFxuICAgICAgY29ubi5vbignZXJyb3InLCAoZTogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IHBlZXIgPSB0aGlzLnBlZXJCeUlkKGNvbm4ucGVlcilcbiAgICAgICAgcGVlciAmJiB0aGlzLm9uUGVlckVycm9yKHBlZXIsIGUpXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBwZWVyQnlJZChpZDogc3RyaW5nKTogUGVlclBsYXllcnx1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnBlZXJzLmdldChpZClcbiAgfVxuXG4gIHBlZXJCeVBsYXllcihwbGF5ZXI6IFBsYXllcik6IFBlZXJQbGF5ZXJ8dW5kZWZpbmVkIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLnBlZXJzLnZhbHVlcygpKS5maW5kKChwKSA9PiBwLnBsYXllckdldCgpID09PSBwbGF5ZXIpXG4gIH1cbiAgXG4gIGNvbm5lY3RZb20oaWRQZWVyOiBzdHJpbmcsIHBsYXllckZvclBlZXI6IFBsYXllcikge1xuICAgIHRoaXMuY29ubmVjdChpZFBlZXIsIHBsYXllckZvclBlZXIsICgpID0+IHt9LCAneW9tJylcbiAgfVxuXG4gIGNvbm5lY3QoaWRQZWVyOiBzdHJpbmcsIHBsYXllckRlZmF1bHQ6IFBsYXllciwgb25Db25uZWN0OihwZWVyOiBQZWVyUGxheWVyLCBjb25uOiBhbnkpID0+IHZvaWQsIG1ldGFkYXRhOiBhbnkpIHtcbiAgICBcbiAgICBhc3NlcnRmKCgpID0+IGlkUGVlcilcbiAgICBcbiAgICBpZiAodGhpcy5yZWdpc3RyYW50KSB7XG4gICAgICBpZiAodGhpcy5yZWdpc3RyYW50LmlkID09IGlkUGVlcilcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY29ubmVjdCB0byB5b3VyIG93biBpZFwiKVxuICAgICAgXG4gICAgICBjb25zdCBwZWVyUGxheWVyID0gdGhpcy5wZWVycy5nZXQoaWRQZWVyKVxuICAgICAgaWYgKHBlZXJQbGF5ZXI/Lm9wZW4oKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlBlZXIgY29ubmVjdGlvbiBhbHJlYWR5IG9wZW5cIiwgaWRQZWVyKVxuICAgICAgfSBlbHNlIGlmIChwZWVyUGxheWVyPy5jb25uZWN0aW5nR2V0KCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJQZWVyIGFscmVhZHkgY29ubmVjdGluZ1wiLCBpZFBlZXIpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcGVlclBsYXllciA9IHRoaXMucGVlcnMuZ2V0KGlkUGVlcilcbiAgICAgICAgaWYgKCFwZWVyUGxheWVyKSB7XG4gICAgICAgICAgcGVlclBsYXllciA9IG5ldyBQZWVyUGxheWVyKGlkUGVlciwgdGhpcywgcGxheWVyRGVmYXVsdCwgdGhpcy5vblJlY29ubmVjdClcbiAgICAgICAgICB0aGlzLnBlZXJzLnNldChpZFBlZXIsIHBlZXJQbGF5ZXIpXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKFwiQXR0ZW1wdGluZyBcIiArIChwZWVyUGxheWVyLmNvbm5lY3RpbmdHZXQoKSA/ICcnIDogXCJyZS1cIikgKyBcImNvbm5lY3Rpb24gdG8gcGVlclwiLCBpZFBlZXIpXG4gICAgICAgIGNvbnN0IGNvbm4gPSB0aGlzLnJlZ2lzdHJhbnQuY29ubmVjdChcbiAgICAgICAgICBpZFBlZXIsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcmVsaWFibGU6IHRydWUsXG4gICAgICAgICAgICBtZXRhZGF0YTogbWV0YWRhdGFcbiAgICAgICAgICB9XG4gICAgICAgIClcbiAgICAgICAgXG4gICAgICAgIGNvbm4ub24oJ29wZW4nLCAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJQZWVyIG9wZW5lZFwiLCBjb25uKVxuXG4gICAgICAgICAgYXNzZXJ0KHBlZXJQbGF5ZXIpXG4gICAgICAgICAgcGVlclBsYXllci5vbk9wZW5lZChjb25uKVxuXG4gICAgICAgICAgb25Db25uZWN0ICYmIG9uQ29ubmVjdChwZWVyUGxheWVyLCBjb25uKVxuICAgICAgICAgIFxuICAgICAgICAgIHRoaXMuZXZlbnRzLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50UGVlclVwZGF0ZShBcnJheS5mcm9tKHRoaXMucGVlcnMudmFsdWVzKCkpKSlcbiAgICAgICAgICBcbiAgICAgICAgICBmdW5jdGlvbiBwaW5nKHNlY3M6IGFueSkge1xuICAgICAgICAgICAgYXNzZXJ0KHBlZXJQbGF5ZXIpXG4gICAgICAgICAgICBpZiAocGVlclBsYXllci5vcGVuKCkpIHtcbiAgICAgICAgICAgICAgcGVlclBsYXllci5zZW5kKHtwaW5nOiB7c2Vjczogc2Vjc319KVxuICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBwaW5nKHNlY3MrMzApLCAzMDAwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcGluZygwKVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbm4ub24oJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICBhc3NlcnQocGVlclBsYXllcilcbiAgICAgICAgICAgIHBlZXJQbGF5ZXIub25PcGVuRmFpbGVkKGVycilcbiAgICAgICAgICAgIHRoaXMub25QZWVyRXJyb3IocGVlclBsYXllciwgZXJyKVxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCByZWdpc3RlcmVkXCIpXG4gICAgfVxuICB9XG5cbiAgYnJvYWRjYXN0KGRhdGE6IGFueSwgZXhjbHVzaW9uczogUGVlclBsYXllcltdID0gW10pIHtcbiAgICBmb3IgKGNvbnN0IFtpZCxwZWVyXSBvZiB0aGlzLnBlZXJzKSB7XG4gICAgICBpZiAocGVlci5vcGVuKCkgJiYgIWV4Y2x1c2lvbnMuc29tZShwID0+IHAuaXMocGVlcikpKVxuICAgICAgICBwZWVyLnNlbmQoZGF0YSlcbiAgICB9XG4gIH1cblxuICBvblBlZXJFcnJvcihwZWVyOiBQZWVyUGxheWVyLCBlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS5sb2coJ1BlZXIgY29ubmVjdGlvbiBlcnJvcicsIHBlZXIuaWQsIGVycm9yKVxuICAgIHRoaXMuZXZlbnRzLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50UGVlclVwZGF0ZShBcnJheS5mcm9tKHRoaXMucGVlcnMudmFsdWVzKCkpKSlcbiAgfVxuXG4gIG9uUGVlckxvc3QocGVlcjogUGVlclBsYXllcikge1xuICAgIHRoaXMucGVlcnMuZGVsZXRlKHBlZXIuaWQpXG4gICAgdGhpcy5ldmVudHMuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnRQZWVyVXBkYXRlKEFycmF5LmZyb20odGhpcy5wZWVycy52YWx1ZXMoKSkpKVxuICB9XG5cbiAgb25QZWVyVXBkYXRlKHJlZ2lzdHJhbnRQbGF5ZXI6IFBsYXllcikge1xuICAgIGNvbnN0IHBlZXJzID0gdGhpcy5wZWVyc0dldCgpLm1hcCgocCkgPT4gcC5zZXJpYWxpemUoKSlcbiAgICB0aGlzLmJyb2FkY2FzdCh7XG4gICAgICBwZWVyVXBkYXRlOiB7XG4gICAgICAgIHBlZXJQbGF5ZXJzOiBwZWVycy5jb25jYXQoW3tpZDogdGhpcy5yZWdpc3RyYW50SWQoKSwgcGxheWVyOiByZWdpc3RyYW50UGxheWVyLmlkfV0pXG4gICAgICB9XG4gICAgfSlcbiAgICB0aGlzLmV2ZW50cy5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudFBlZXJVcGRhdGUoQXJyYXkuZnJvbSh0aGlzLnBlZXJzLnZhbHVlcygpKSkpXG4gIH1cblxuICBwZWVyc0dldCgpIHsgcmV0dXJuIEFycmF5LmZyb20odGhpcy5wZWVycy52YWx1ZXMoKSkgfVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgR2FtZSBleHRlbmRzIElkZW50aWZpZWRWYXIge1xuICByZWFkb25seSBwbGF5ZXJzOiBQbGF5ZXJbXVxuXG4gIGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIHJlYWRvbmx5IGRlc2NyaXB0aW9uOiBzdHJpbmcsIHJlYWRvbmx5IG1ha2VVaTooLi4uYXJnczogYW55KSA9PiB2b2lkLCBwbGF5ZXJzOiBQbGF5ZXJbXSkge1xuICAgIHN1cGVyKGlkKVxuICAgIHRoaXMuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvblxuICAgIHRoaXMubWFrZVVpID0gbWFrZVVpXG4gICAgdGhpcy5wbGF5ZXJzID0gcGxheWVycy5jb25jYXQoW25ldyBQbGF5ZXJTcGVjdGF0b3IoKV0pXG4gIH1cbiAgXG4gIGFic3RyYWN0IHBsYXlmaWVsZChwbGF5ZXJzOiBudW1iZXIpOiBQbGF5ZmllbGRcblxuICBkZWNrcygpOiBbc3RyaW5nLCBDYXJkW11dW10ge1xuICAgIHJldHVybiBbXG4gICAgICBbXCJTdGFuZGFyZCA1MlwiLCBkZWNrNTIoKV0sXG4gICAgICBbXCJObyBkZXVjZSA1MVwiLCBkZWNrNTFOb0RldWNlKCldXG4gICAgXVxuICB9XG4gIFxuICAqZGVhbChwbGF5ZXJzOiBudW1iZXIsIHBsYXlmaWVsZDogUGxheWZpZWxkKTogR2VuZXJhdG9yPE1vdmVDYXJkcywgdm9pZD4ge1xuICB9XG4gIFxuICBwbGF5ZmllbGROZXdIYW5kKHBsYXllcnM6IG51bWJlciwgcGxheWZpZWxkT2xkOiBQbGF5ZmllbGQpOiBQbGF5ZmllbGQge1xuICAgIGNvbnN0IHBmID0gdGhpcy5wbGF5ZmllbGQocGxheWVycylcbiAgICByZXR1cm4gbmV3IFBsYXlmaWVsZCgwLCBwZi5jb250YWluZXJzLCBwbGF5ZmllbGRPbGQuY29udGFpbmVyc0NoaXApXG4gIH1cblxuICBwbGF5ZXJzQWN0aXZlKCk6IFBsYXllcltdIHtcbiAgICByZXR1cm4gdGhpcy5wbGF5ZXJzLmZpbHRlcihwID0+IHAuaWRDbnRzLmxlbmd0aCAhPSAwKVxuICB9XG5cbiAgc3BlY3RhdG9yKCk6IFBsYXllciB7XG4gICAgcmV0dXJuIHRoaXMucGxheWVyc1t0aGlzLnBsYXllcnMubGVuZ3RoLTFdXG4gIH1cbiAgXG4gIHByb3RlY3RlZCAqZGVhbEVhY2gocGxheWVyczogbnVtYmVyLCBwbGF5ZmllbGRJbjogUGxheWZpZWxkLCBjbnQ6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICBvcmRlcmluZzogKGE6IFdvcmxkQ2FyZCwgYjogV29ybGRDYXJkKSA9PiBudW1iZXIpIHtcblxuICAgIGxldCBwZiA9IHBsYXlmaWVsZEluXG4gICAgXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbnQ7ICsraSlcbiAgICAgIGZvciAoY29uc3QgcCBvZiB0aGlzLnBsYXllcnNBY3RpdmUoKS5zbGljZSgwLCBwbGF5ZXJzKSkge1xuICAgICAgICBjb25zdCBzbG90U3JjID0gcGYuY29udGFpbmVyQ2FyZCgnc3RvY2snKS5zbG90KDApXG4gICAgICAgIGNvbnN0IHNsb3REc3QgPSBwZi5jb250YWluZXJDYXJkKHAuaWRDbnRzWzBdKS5zbG90KDApXG4gICAgICAgIFxuICAgICAgICBjb25zdCBtb3ZlID0gbmV3IE1vdmVDYXJkcyhcbiAgICAgICAgICBwZi5zZXF1ZW5jZSwgW3Nsb3RTcmMudG9wKCkud2l0aEZhY2VVcCh0cnVlKV0sIHNsb3RTcmMuaWQsIHNsb3REc3QuaWQsXG4gICAgICAgICAgc2xvdERzdC5pdGVtQWZ0ZXIoc2xvdFNyYy50b3AoKSwgb3JkZXJpbmcpXG4gICAgICAgIClcblxuICAgICAgICBwZiA9IHBmLndpdGhNb3ZlQ2FyZHMobW92ZSlcbiAgICAgICAgeWllbGQgbW92ZVxuICAgICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBHYW1lR2luUnVtbXkgZXh0ZW5kcyBHYW1lIHtcbiAgY29uc3RydWN0b3IobWFrZVVpOiguLi5hcmdzOiBhbnkpID0+IGFueSkge1xuICAgIHN1cGVyKFwiZ2luLXJ1bW15XCIsIFwiR2luIFJ1bW15XCIsIG1ha2VVaSxcbiAgICAgICAgICBbbmV3IFBsYXllcignUGxheWVyIDEnLCBbJ3AwJ10pLCBuZXcgUGxheWVyKCdQbGF5ZXIgMicsIFsncDEnXSldKVxuICB9XG5cbiAgZGVhbChwbGF5ZXJzOiBudW1iZXIsIHBsYXlmaWVsZDogUGxheWZpZWxkKSB7XG4gICAgcmV0dXJuIHRoaXMuZGVhbEVhY2gocGxheWVycywgcGxheWZpZWxkLCAxMCwgb3JkZXJDb2xvckFsdGVybmF0ZVJhbmtXLmJpbmQobnVsbCwgZmFsc2UpKVxuICB9XG4gIFxuICBwbGF5ZmllbGQocGxheWVyczogbnVtYmVyKTogUGxheWZpZWxkIHtcbiAgICByZXR1cm4gbmV3IFBsYXlmaWVsZChcbiAgICAgIDAsXG4gICAgICBbbmV3IENvbnRhaW5lclNsb3RDYXJkKFwicDBcIiwgW25ldyBTbG90Q2FyZChcInAwXCIsIDApXSksXG4gICAgICAgbmV3IENvbnRhaW5lclNsb3RDYXJkKFwicDFcIiwgW25ldyBTbG90Q2FyZChcInAxXCIsIDApXSksXG4gICAgICAgbmV3IENvbnRhaW5lclNsb3RDYXJkKFwid2FzdGVcIiwgW25ldyBTbG90Q2FyZChcIndhc3RlXCIsIDApXSksXG4gICAgICAgbmV3IENvbnRhaW5lclNsb3RDYXJkKFwic3RvY2tcIiwgW25ldyBTbG90Q2FyZChcInN0b2NrXCIsIDAsIHNodWZmbGVkKGRlY2s1MigpKS5tYXAoYyA9PiBuZXcgV29ybGRDYXJkKGMsIGZhbHNlKSkpXSlcbiAgICAgIF0sXG4gICAgICBbXVxuICAgIClcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgR2FtZUR1bW15IGV4dGVuZHMgR2FtZSB7XG4gIGNvbnN0cnVjdG9yKG1ha2VVaTooLi4uYXJnczogYW55KSA9PiBhbnkpIHtcbiAgICBzdXBlcihcImR1bW15XCIsIFwiRHVtbXkgLyA1MDAgUnVtXCIsIG1ha2VVaSxcbiAgICAgICAgICBbbmV3IFBsYXllcignUGxheWVyIDEnLCBbJ3AwJ10pLCBuZXcgUGxheWVyKCdQbGF5ZXIgMicsIFsncDEnXSldKVxuICB9XG4gIFxuICBkZWFsKHBsYXllcnM6IG51bWJlciwgcGxheWZpZWxkOiBQbGF5ZmllbGQpIHtcbiAgICByZXR1cm4gdGhpcy5kZWFsRWFjaChwbGF5ZXJzLCBwbGF5ZmllbGQsIDEzLCBvcmRlckNvbG9yQWx0ZXJuYXRlUmFua1cuYmluZChudWxsLCBmYWxzZSkpXG4gIH1cbiAgXG4gIHBsYXlmaWVsZChwbGF5ZXJzOiBudW1iZXIpOiBQbGF5ZmllbGQge1xuICAgIHJldHVybiBuZXcgUGxheWZpZWxkKFxuICAgICAgMCxcbiAgICAgIFtuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJwMFwiLCBbbmV3IFNsb3RDYXJkKFwicDBcIiwgMCldKSxcbiAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJwMVwiLCBbbmV3IFNsb3RDYXJkKFwicDFcIiwgMCldKSxcbiAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJwMC1tZWxkXCIsIFtdKSxcbiAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJ3YXN0ZVwiLCBbbmV3IFNsb3RDYXJkKFwid2FzdGVcIiwgMCldKSxcbiAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJwMS1tZWxkXCIsIFtdKSxcbiAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJzdG9ja1wiLCBbbmV3IFNsb3RDYXJkKFwic3RvY2tcIiwgMCwgc2h1ZmZsZWQoZGVjazUyKCkpLm1hcChjID0+IG5ldyBXb3JsZENhcmQoYywgZmFsc2UpKSldKVxuICAgICAgXSxcbiAgICAgIFtdXG4gICAgKVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBHYW1lUG9rZXIgZXh0ZW5kcyBHYW1lIHtcbiAgY29uc3RydWN0b3IobWFrZVVpOiguLi5hcmdzOiBhbnkpID0+IGFueSkge1xuICAgIHN1cGVyKFwicG9rZXJcIiwgXCJQb2tlclwiLCBtYWtlVWksXG4gICAgICAgICAgYXJyYXkucmFuZ2UoOCkubWFwKChfLGkpID0+IG5ldyBQbGF5ZXIoJ1BsYXllciAnKyhpKzEpLCBbJ3AnK2ksIGBwJHtpfS1jaGlwYF0pKSlcbiAgfVxuICBcbiAgcGxheWZpZWxkKHBsYXllcnM6IG51bWJlcik6IFBsYXlmaWVsZCB7XG4gICAgY29uc3QgZGVjayA9IHNodWZmbGVkKGRlY2s1MigpKVxuXG4gICAgY29uc3QgY2hpcHMgPSAoaWQ6IHN0cmluZywgYmFzZTogbnVtYmVyKSA9PiBcbiAgICAgIFtuZXcgU2xvdENoaXAoaWQsIDAsIGFycmF5LnJhbmdlKDMpLm1hcCgoXyxpKSA9PiBuZXcgQ2hpcChpKzgwKzEwMCpiYXNlLCAxMDApKSksXG4gICAgICAgbmV3IFNsb3RDaGlwKGlkLCAxLCBhcnJheS5yYW5nZSg2KS5tYXAoKF8saSkgPT4gbmV3IENoaXAoaSs2MCsxMDAqYmFzZSwgNTApKSksXG4gICAgICAgbmV3IFNsb3RDaGlwKGlkLCAyLCBhcnJheS5yYW5nZSgxMCkubWFwKChfLGkpID0+IG5ldyBDaGlwKGkrNDArMTAwKmJhc2UsMjApKSksXG4gICAgICAgbmV3IFNsb3RDaGlwKGlkLCAzLCBhcnJheS5yYW5nZSgyMCkubWFwKChfLGkpID0+IG5ldyBDaGlwKGkrMjArMTAwKmJhc2UsIDEwKSkpXG4gICAgICAgXVxuICAgIFxuICAgIHJldHVybiBuZXcgUGxheWZpZWxkKFxuICAgICAgMCxcbiAgICAgIHRoaXMucGxheWVycy5tYXAocCA9PiBuZXcgQ29udGFpbmVyU2xvdENhcmQocC5pZENudHNbMF0sIFtuZXcgU2xvdENhcmQocC5pZENudHNbMF0sIDApXSkpLmNvbmNhdChcbiAgICAgICAgW25ldyBDb250YWluZXJTbG90Q2FyZChcIndhc3RlXCIsIFtuZXcgU2xvdENhcmQoXCJ3YXN0ZVwiLCAwKV0sIHRydWUpLFxuICAgICAgICAgbmV3IENvbnRhaW5lclNsb3RDYXJkKFwiY29tbXVuaXR5XCIsIFtuZXcgU2xvdENhcmQoXCJjb21tdW5pdHlcIiwgMCldKSxcbiAgICAgICAgIG5ldyBDb250YWluZXJTbG90Q2FyZChcInN0b2NrXCIsIFtuZXcgU2xvdENhcmQoXCJzdG9ja1wiLCAwLCBkZWNrLm1hcChjID0+IG5ldyBXb3JsZENhcmQoYywgZmFsc2UpKSldKV1cbiAgICAgICksXG4gICAgICB0aGlzLnBsYXllcnMubWFwKChwLGlkeCkgPT4gbmV3IENvbnRhaW5lclNsb3RDaGlwKHAuaWRDbnRzWzFdLCBjaGlwcyhwLmlkQ250c1sxXSwgaWR4KSkpLmNvbmNhdChcbiAgICAgICAgW25ldyBDb250YWluZXJTbG90Q2hpcChcImFudGVcIiwgYXJyYXkucmFuZ2UoNCkubWFwKChfLGkpID0+IG5ldyBTbG90Q2hpcChcImFudGVcIiwgaSkpKV1cbiAgICAgIClcbiAgICApXG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEdhbWVQb2tlckNoaW5lc2UgZXh0ZW5kcyBHYW1lIHtcbiAgY29uc3RydWN0b3IobWFrZVVpOiguLi5hcmdzOiBhbnkpID0+IGFueSkge1xuICAgIHN1cGVyKFwicG9rZXItY2hpbmVzZVwiLCBcIkNoaW5lc2UgUG9rZXJcIiwgbWFrZVVpLFxuICAgICAgICAgIGFycmF5LnJhbmdlKDQpLm1hcCgoXyxpKSA9PiBuZXcgUGxheWVyKCdQbGF5ZXIgJysoaSsxKSwgWydwJytpLCBgcCR7aX0tY2hpcGBdKSkpXG4gIH1cbiAgXG4gIGRlYWwocGxheWVyczogbnVtYmVyLCBwbGF5ZmllbGQ6IFBsYXlmaWVsZCkge1xuICAgIHJldHVybiB0aGlzLmRlYWxFYWNoKHBsYXllcnMsIHBsYXlmaWVsZCwgMTMsIG9yZGVyQ29sb3JBbHRlcm5hdGVSYW5rVy5iaW5kKG51bGwsIHRydWUpKVxuICB9XG4gIFxuICBwbGF5ZmllbGQocGxheWVyczogbnVtYmVyKTogUGxheWZpZWxkIHtcbiAgICBjb25zdCBjaGlwcyA9IChpZDogc3RyaW5nLCBiYXNlOiBudW1iZXIpID0+IFxuICAgICAgW25ldyBTbG90Q2hpcChpZCwgMCwgYXJyYXkucmFuZ2UoMykubWFwKChfLGkpID0+IG5ldyBDaGlwKGkrODArMTAwKmJhc2UsIDEwMCkpKSxcbiAgICAgICBuZXcgU2xvdENoaXAoaWQsIDEsIGFycmF5LnJhbmdlKDYpLm1hcCgoXyxpKSA9PiBuZXcgQ2hpcChpKzYwKzEwMCpiYXNlLCA1MCkpKSxcbiAgICAgICBuZXcgU2xvdENoaXAoaWQsIDIsIGFycmF5LnJhbmdlKDEwKS5tYXAoKF8saSkgPT4gbmV3IENoaXAoaSs0MCsxMDAqYmFzZSwyMCkpKSxcbiAgICAgICBuZXcgU2xvdENoaXAoaWQsIDMsIGFycmF5LnJhbmdlKDIwKS5tYXAoKF8saSkgPT4gbmV3IENoaXAoaSsyMCsxMDAqYmFzZSwgMTApKSlcbiAgICAgICBdXG4gICAgXG4gICAgcmV0dXJuIG5ldyBQbGF5ZmllbGQoXG4gICAgICAwLFxuICAgICAgdGhpcy5wbGF5ZXJzLmZsYXRNYXAocCA9PiBbXG4gICAgICAgIG5ldyBDb250YWluZXJTbG90Q2FyZChwLmlkQ250c1swXSwgW25ldyBTbG90Q2FyZChwLmlkQ250c1swXSwgMCldKSxcbiAgICAgICAgbmV3IENvbnRhaW5lclNsb3RDYXJkKHAuaWRDbnRzWzBdICsgXCItc2hvd1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXkucmFuZ2UoMykubWFwKChfLGkpID0+IG5ldyBTbG90Q2FyZChwLmlkQ250c1swXSArIFwiLXNob3dcIiwgaSkpKSxcbiAgICAgIF0pLmNvbmNhdChcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBDb250YWluZXJTbG90Q2FyZChcInN0b2NrXCIsIFtuZXcgU2xvdENhcmQoXCJzdG9ja1wiLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNodWZmbGVkKGRlY2s1MigpKS5tYXAoYyA9PiBuZXcgV29ybGRDYXJkKGMsIGZhbHNlKSkpXSlcbiAgICAgICAgXVxuICAgICAgKSxcbiAgICAgIHRoaXMucGxheWVycy5tYXAoKHAsaWR4KSA9PiBuZXcgQ29udGFpbmVyU2xvdENoaXAocC5pZENudHNbMV0sIGNoaXBzKHAuaWRDbnRzWzFdLCBpZHgpKSkuY29uY2F0KFxuICAgICAgICBbbmV3IENvbnRhaW5lclNsb3RDaGlwKFwiYW50ZVwiLCBhcnJheS5yYW5nZSg0KS5tYXAoKF8saSkgPT4gbmV3IFNsb3RDaGlwKFwiYW50ZVwiLCBpKSkpXVxuICAgICAgKVxuICAgIClcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgR2FtZUhlYXJ0cyBleHRlbmRzIEdhbWUge1xuICBjb25zdHJ1Y3RvcihtYWtlVWk6KC4uLmFyZ3M6IGFueSkgPT4gYW55KSB7XG4gICAgc3VwZXIoXCJoZWFydHNcIiwgXCJIZWFydHNcIiwgbWFrZVVpLFxuICAgICAgICAgIGFycmF5LnJhbmdlKDQpLm1hcCgoXyxpKSA9PiBuZXcgUGxheWVyKCdQbGF5ZXIgJysoaSsxKSwgWydwJytpLCBgcCR7aX0tdHJpY2tgXSkpKVxuICB9XG4gIFxuICBkZWFsKHBsYXllcnM6IG51bWJlciwgcGxheWZpZWxkOiBQbGF5ZmllbGQpIHtcbiAgICBjb25zdCBudW1DYXJkcyA9IHBsYXlmaWVsZC5jb250YWluZXJDYXJkKFwic3RvY2tcIikubGVuZ3RoKClcbiAgICByZXR1cm4gdGhpcy5kZWFsRWFjaChwbGF5ZXJzLCBwbGF5ZmllbGQsIG51bUNhcmRzL3BsYXllcnMsIG9yZGVyQ29sb3JBbHRlcm5hdGVSYW5rVy5iaW5kKG51bGwsIGZhbHNlKSlcbiAgfVxuICBcbiAgcGxheWZpZWxkKHBsYXllcnM6IG51bWJlcik6IFBsYXlmaWVsZCB7XG4gICAgY29uc3QgZGVjayA9IHNodWZmbGVkKHBsYXllcnMgPT0gMyA/IGRlY2s1MU5vRGV1Y2UoKSA6IGRlY2s1MigpKVxuXG4gICAgcmV0dXJuIG5ldyBQbGF5ZmllbGQoXG4gICAgICAwLFxuICAgICAgdGhpcy5cbiAgICAgICAgcGxheWVycy5cbiAgICAgICAgZmxhdE1hcChwID0+IFtcbiAgICAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQocC5pZENudHNbMF0sIFtuZXcgU2xvdENhcmQocC5pZENudHNbMF0sIDApXSksXG4gICAgICAgICAgbmV3IENvbnRhaW5lclNsb3RDYXJkKHAuaWRDbnRzWzFdLCBbbmV3IFNsb3RDYXJkKHAuaWRDbnRzWzFdLCAwKV0pLFxuICAgICAgICBdKS5cbiAgICAgICAgY29uY2F0KFtcbiAgICAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJ0cmlja1wiLCBbbmV3IFNsb3RDYXJkKFwidHJpY2tcIiwgMCldKSxcbiAgICAgICAgICBuZXcgQ29udGFpbmVyU2xvdENhcmQoXCJzdG9ja1wiLCBbbmV3IFNsb3RDYXJkKFwic3RvY2tcIiwgMCwgZGVjay5tYXAoYyA9PiBuZXcgV29ybGRDYXJkKGMsIGZhbHNlKSkpXSlcbiAgICAgICAgXSksXG4gICAgICBbXVxuICAgIClcbiAgfVxufVxuIl19