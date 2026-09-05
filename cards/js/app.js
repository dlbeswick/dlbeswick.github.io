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
import * as dom from "./dom.js";
import { Connections, EventContainerChange, EventPlayfieldChange, EventSlotChange, GameGinRummy, GameDummy, GameHearts, GamePoker, GamePokerChinese, MoveCards, NotifierSlot, deserializeMove } from "./game.js";
import errorHandler from "./error_handler.js";
import { Images } from "./images.js";
import * as test from "./test.js";
import { Gameplay, Turn } from "./turn.js";
import { Selection, UIContainerDiv, UIContainerFlex, UIContainerSlotsMulti, UISlotChip, UISlotSingle, UISlotRoot, UISlotSpread } from "./ui.js";
window.onerror = errorHandler;
document.addEventListener("deviceready", () => {
    assert(test.test());
    run("img/cards.svg", "img/back.svg");
});
class App {
    constructor(games, notifierSlot, root, images, onNewGame = () => { }, onMaxPlayers = () => { }, onPeerChanged = () => { }) {
        this.images = images;
        this.onNewGame = onNewGame;
        this.onMaxPlayers = onMaxPlayers;
        this.onPeerChanged = onPeerChanged;
        this.selection = new Selection();
        this.connections = new Connections(this.onPeerReconnect.bind(this));
        this.maxPlayers = 2;
        this.cardWidth = 74;
        this.cardHeight = 112;
        this.gameplay = new Gameplay();
        this.debugMessages = [];
        assertf(() => games);
        this.games = games;
        this.game = games[0];
        this.notifierSlot = notifierSlot;
        this.viewer = this.game.players[0];
        this.root = root;
    }
    onMove(move, localAction) {
        if (localAction) {
            this.connections.broadcast({ move: move.serialize() });
        }
        const playfieldOld = this.gameplay.playfield;
        const slotsChanged = this.gameplay.integrateMove(move);
        for (const idCnt of move.slotsNew.map(([idCnt, id]) => idCnt)) {
            this.notifierSlot.container(idCnt).dispatchEvent(new EventContainerChange(playfieldOld, this.gameplay.playfield, idCnt));
        }
        this.notifierSlot.slotsUpdate(playfieldOld, this.gameplay.playfield, slotsChanged, localAction);
        this.notifierSlot.eventTarget.dispatchEvent(new EventPlayfieldChange(playfieldOld, this.gameplay.playfield));
    }
    audioCtxGet() {
        const ctx = window.AudioContext || window.webkitAudioContext;
        if (ctx)
            this.audioCtx = this.audioCtx || new ctx();
        return this.audioCtx;
    }
    init() {
        this.notifierSlot.registerPreSlotUpdate(this.preSlotUpdate.bind(this));
        this.notifierSlot.registerPostSlotUpdate(this.postSlotUpdate.bind(this));
        this.notifierSlot.eventTarget.addEventListener("gamemove", (e) => this.onMove(e.move, e.localAction));
    }
    rootGet() {
        return this.root;
    }
    newGame(idGame, turns, viewerId) {
        var _a, _b;
        const game = this.games.find(g => g.id == idGame);
        if (!game) {
            throw new Error("No such game " + idGame);
        }
        this.game = game;
        this.maxPlayers = Math.min(this.maxPlayers, this.game.playersActive().length);
        this.gameplay.newGame(turns !== null && turns !== void 0 ? turns : [new Turn(this.game.playfield(this.maxPlayers), 0, [])]);
        this.viewerSet((_b = (_a = this.game.players.find(p => p.id == viewerId)) !== null && _a !== void 0 ? _a : this.game.players.find(p => { var _a; return p.id == ((_a = this.viewer) === null || _a === void 0 ? void 0 : _a.id); })) !== null && _b !== void 0 ? _b : this.game.players[0]) || this.uiCreate();
        this.onNewGame(this.game);
    }
    newHand() {
        this.gameplay.newGame([new Turn(this.game.playfieldNewHand(this.maxPlayers, this.gameplay.playfield), 0, [])]);
        this.uiCreate();
    }
    cardSizeSet(width, height) {
        this.cardWidth = width;
        this.cardHeight = height;
        this.uiCreate();
    }
    cardWidthGet() { return this.cardWidth; }
    cardHeightGet() { return this.cardHeight; }
    viewerSet(viewer) {
        assertf(() => this.game);
        if (this.viewer == viewer)
            return false;
        this.viewer = viewer;
        this.uiCreate();
        return true;
    }
    uiCreate() {
        assert(this.game);
        this.root.destroy();
        this.root = new UISlotRoot();
        this.game.makeUi(this.gameplay.playfield, this);
        dom.demandById("player").innerText = this.viewer.id;
        for (const cnt of this.gameplay.playfield.containers) {
            for (const slot of cnt) {
                this.notifierSlot.slot(cnt.id, slot.idSlot).dispatchEvent(new EventSlotChange(this.gameplay.playfield, this.gameplay.playfield, cnt.id, slot.idSlot));
            }
            this.notifierSlot.container(cnt.id).dispatchEvent(new EventContainerChange(this.gameplay.playfield, this.gameplay.playfield, cnt.id));
        }
        for (const cnt of this.gameplay.playfield.containersChip) {
            for (const slot of cnt) {
                this.notifierSlot.slot(cnt.id, slot.idSlot).dispatchEvent(new EventSlotChange(this.gameplay.playfield, this.gameplay.playfield, cnt.id, slot.idSlot));
            }
            this.notifierSlot.container(cnt.id).dispatchEvent(new EventContainerChange(this.gameplay.playfield, this.gameplay.playfield, cnt.id));
        }
    }
    viewerGet() {
        return this.viewer;
    }
    gameGet() {
        return this.game;
    }
    preSlotUpdate(slotsOld, localAction) {
        return this.root.uiMovablesForSlots(slotsOld).map(uim => [uim, uim.coordsAbsolute()]);
    }
    postSlotUpdate(slots, uimovs, localAction) {
        const uimovs_ = this.root.uiMovablesForSlots(slots);
        let maxImportance = 0;
        for (const [uimov, start] of uimovs) {
            const uimov_ = uimovs_.find(u_ => u_.is(uimov));
            if (uimov_) {
                const importance = localAction ? 0 : uimov.locationImportance;
                maxImportance = Math.max(maxImportance, importance);
                const msDuration = 250 + importance * 750;
                // UIMoveable has a presence in the new playfield.
                if (uimov_ != uimov) {
                    // The UIMoveable has changed visually in the new playfield.
                    uimov.removeFromPlay();
                    const end = uimov_.coordsAbsolute();
                    if (end[0] == start[0] && end[1] == start[1]) {
                        uimov_.fadeTo('0%', '100%', 250, uimov.destroy.bind(uimov));
                    }
                    else {
                        uimov_.element.style.visibility = 'hidden';
                        uimov.animateTo(start, end, Number(uimov_.element.style.zIndex), msDuration, () => {
                            uimov_.element.style.visibility = 'visible';
                            if (uimov.equalsVisually(uimov_)) {
                                uimov.destroy();
                            }
                            else {
                                uimov.fadeTo('100%', '0%', 250, uimov.destroy.bind(uimov));
                            }
                        });
                    }
                }
            }
            else {
                // UIMoveable has no presence in the new playfield.
                uimov.removeFromPlay();
                uimov.animateTo(start, [start[0], start[1]], Number(uimov.element.style.zIndex), 0);
                uimov.fadeTo('100%', '0%', 250, uimov.destroy.bind(uimov));
            }
        }
        const ctx = this.audioCtxGet();
        if (ctx) {
            const duration = 0.25 + maxImportance * 0.75;
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = 100 + (100 * maxImportance * (1.0 + 0.1 * Math.random()));
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            const mod = ctx.createOscillator();
            mod.frequency.value = 5 + Math.random() * (2.5 + maxImportance * 2);
            const gmod = ctx.createGain();
            gmod.gain.value = 10;
            mod.connect(gmod);
            gmod.connect(osc.frequency);
            mod.start(0);
            osc.onended = () => { gain.disconnect(); gmod.disconnect(); mod.stop(0); };
            const time = ctx.currentTime + 0.1;
            osc.frequency.exponentialRampToValueAtTime(osc.frequency.value * (0.9 + (-0.5 * maxImportance)), time + duration);
            gain.gain.setValueAtTime(0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            gmod.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            mod.frequency.exponentialRampToValueAtTime(1, time + duration);
            osc.start(time);
            osc.stop(time + duration);
        }
    }
    sync(newGame, peerTarget) {
        const data = {
            newGame: newGame,
            game: this.game.id,
            turn: this.gameplay.turnCurrent.serialize(),
            maxPlayers: this.maxPlayers
        };
        for (const peer of this.connections.peersGet()) {
            if (!peerTarget || peerTarget == peer) {
                if (peer.open())
                    peer.send({ sync: { ...data } });
                else
                    console.error("sync: Peer not open", peer);
            }
        }
    }
    revealAll() {
        const moves = this.gameplay.playfield.containers.flatMap(cnt => Array.from(cnt).map(slot => new MoveCards(this.gameplay.turnCurrent.sequence, Array.from(slot).map(wc => wc.withFaceStateConscious(true, true)), slot.id, slot.id)));
        for (const move of moves)
            this.notifierSlot.move(move);
    }
    onReceiveData(data, peer) {
        if (window.mptest_latency) {
            this.debugMessages.push(data);
            window.setTimeout(() => {
                const d = this.debugMessages[0];
                this.debugMessages = this.debugMessages.slice(1);
                this._onReceiveData(d, peer);
            }, Math.floor(Math.random() * 1000));
        }
        else {
            this._onReceiveData(data, peer);
        }
    }
    _onReceiveData(data, peer) {
        var _a;
        if (data.chern) {
            this.maxPlayersSet(Math.max(data.chern.maxPlayers, this.maxPlayers));
            // Synchronise the incoming (peer, player) pairs (including local player).
            // Connect to any peers that this node didn't know about before.
            for (const peer of data.chern.peers) {
                const player = this.game.players.find(p => p.isId(peer.player));
                assert(player, "Unknown player", peer);
                if (peer.id == this.connections.registrantId()) {
                    this.viewerSet(player);
                }
                else if (!this.connections.peerById(peer.id)) {
                    this.connections.connect(peer.id, player, () => { }, {});
                }
                else {
                    const peerPlayer = this.connections.peerById(peer.id);
                    assert(peerPlayer);
                    peerPlayer.playerChange(player);
                }
            }
            this.onPeerChanged(this.connections.peersGet());
            this.onMaxPlayers(this.maxPlayers);
        }
        else if (data.ping) {
            //demandElementById("connect-status").dispatchEvent(new EventPingBack(data.ping.secs))
            peer.send({ ping_back: { secs: data.ping.secs } });
        }
        else if (data.ping_back) {
            //demandElementById("connect-status").dispatchEvent(new EventPingBack(data.ping_back.secs))
        }
        else if (data.sync) {
            this.maxPlayers = data.sync.maxPlayers;
            this.onMaxPlayers(this.maxPlayers);
            const turnIncoming = Turn.fromSerialized(data.sync.turn);
            if (data.sync.newGame || !this.gameplay.hasSequence(turnIncoming.sequence)) {
                this.newGame(data.sync.game, [turnIncoming]);
            }
            else {
                this.gameplay.restateTurn(turnIncoming);
                this.newGame(data.sync.game, this.gameplay.turns);
            }
            peer.send({ gotSync: { sequence: turnIncoming.sequence } });
        }
        else if (data.askSync) {
            this.sync(false, peer);
        }
        else if (data.gotSync) {
            console.debug("Peer got sync for sequence " + data.gotSync.sequence);
        }
        else if (data.peerUpdate) {
            for (const peerPlayer of data.peerUpdate.peerPlayers) {
                const peerPlayerId = peerPlayer.id;
                const player = this.game.players.find((p) => p.id == peerPlayer.player);
                assert(player);
                if (peerPlayerId == this.connections.registrantId()) {
                    this.viewerSet(player);
                }
                else {
                    (_a = this.connections.peerById(peerPlayerId)) === null || _a === void 0 ? void 0 : _a.playerChange(player);
                }
            }
            this.onPeerChanged(this.connections.peersGet());
        }
        else if (data.move) {
            if (this.gameplay.hasSequence(data.move.turnSequence)) {
                this.notifierSlot.move(deserializeMove(data.move), false);
            }
            else {
                console.error("Move ignored, sequence not found in turn history", data.move, this.gameplay.turns);
                peer.send({ askSync: true });
            }
        }
        else if (data.deny) {
            errorHandler("Connection denied: " + data.deny.message);
        }
        else {
            console.error("Unknown message", data);
        }
    }
    onPlayfieldInconsistent(peer, errors) {
        const registrantId = this.connections.registrantId();
        assert(registrantId);
        if (peer.id < registrantId) {
            console.debug("Inconsistent playfield with authoritive id, syncing", errors);
            this.sync(false, peer);
        }
        else {
            peer.send({ askSync: true });
            console.debug("Inconsistent playfield with non-authoritive id, surrendering", errors);
        }
    }
    onPeerConnect(metadata, peer) {
        if (metadata == 'yom') {
            // tbd: check playfield sequence # and sync if necessary?
            const [playerForPeer, _] = this.playerGetForPeer(peer);
            assert(playerForPeer);
            peer.playerChange(playerForPeer);
            this.onPeerReconnect(peer);
        }
    }
    onPeerReconnect(peer) {
        this.sync(true, peer);
        this.connections.broadcast({
            chern: {
                connecting: peer.id,
                peers: Array.from(this.connections.peersGet().values()).
                    map(p => p.serialize()).
                    concat({ id: this.connections.registrantId(), player: this.viewer.id }),
                maxPlayers: this.maxPlayers
            }
        });
    }
    playerGetForPeer(peer) {
        // If the incoming peer already has a player assigned to them, then use that.
        // Otherwise find the first free one, or use the spectator as a last resort.
        if (peer.playerGet() == this.game.spectator()) {
            for (const player of this.game.players.slice(0, this.maxPlayers)) {
                const peerForPlayer = this.connections.peerByPlayer(player);
                if (this.viewer != player && (!peerForPlayer || peerForPlayer.is(peer)))
                    return [player, ""];
            }
            return [this.game.spectator(), ""];
        }
        else {
            return [peer.playerGet(), ""];
        }
    }
    serialize() {
        return {
            game: this.game.id,
            viewer: this.viewer.id,
            turn: this.gameplay.turnCurrent.serialize(),
            maxPlayers: this.maxPlayers
        };
    }
    restore(serialized) {
        this.maxPlayers = serialized.maxPlayers;
        this.newGame(serialized.game, [Turn.fromSerialized(serialized.turn)], serialized.viewer);
        this.sync(true);
    }
    dealInteractive() {
        const gen = this.game.deal(this.maxPlayers, this.gameplay.playfield);
        const step = () => {
            const it = gen.next();
            if (!it.done) {
                this.notifierSlot.move(it.value);
                window.setTimeout(step, 250);
            }
        };
        window.setTimeout(step, 250);
        return false;
    }
    maxPlayersSet(max) {
        if (max != this.maxPlayers) {
            this.maxPlayers = max;
            this.uiCreate();
        }
    }
    maxPlayersGet() { return this.maxPlayers; }
}
let appGlobal;
function makeUiGinRummy(playfield, app) {
    const root = app.rootGet();
    const viewer = app.viewerGet();
    const player = viewer.idCnts[0] ? viewer : app.gameGet().players[0];
    assertf(() => player);
    const opponent = app.gameGet().players.find(p => p.idCnts[0] && p != player);
    assertf(() => opponent);
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UISlotSpread(opponent.idCnts[0], app.selection, opponent, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%').init());
    }));
    root.add(new UIContainerFlex().with(cnt => {
        const uislotWaste = new UISlotSpread('waste', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%');
        uislotWaste.init();
        uislotWaste.element.style.flexGrow = "1";
        cnt.add(uislotWaste);
        const uislotStock = new UISlotSingle('stock', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), 'flip', ['Deal', () => app.dealInteractive()]);
        uislotStock.init();
        cnt.add(uislotStock);
    }));
    const uislotBottom = new UISlotSpread(player.idCnts[0], app.selection, player, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%');
    uislotBottom.init();
    root.add(uislotBottom);
}
function makeUiDummy(playfield, app) {
    const root = app.rootGet();
    const viewer = app.viewerGet();
    const player = viewer.idCnts[0] ? viewer : app.gameGet().players[0];
    assertf(() => player);
    const opponent = app.gameGet().players.find(p => p.idCnts[0] && p != player);
    assertf(() => opponent);
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UISlotSpread(opponent.idCnts[0], app.selection, opponent, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%').init());
    }));
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UIContainerSlotsMulti(opponent.idCnts[0] + '-meld', app.selection, null, viewer, playfield, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '', 'turn').init());
    }));
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UISlotSpread('waste', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%', undefined, undefined, 'flip', 'all-proceeding').init());
    }));
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UIContainerSlotsMulti(player.idCnts[0] + '-meld', app.selection, null, viewer, playfield, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '', 'turn').init());
    }));
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UISlotSpread(player.idCnts[0], app.selection, player, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%').init());
    }));
    root.add(new UIContainerFlex().with(cnt => {
        cnt.add(new UISlotSingle('stock', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), 'flip', ['Deal', () => app.dealInteractive()]).init());
    }));
}
function makeUiPlayerChips(app, owner, viewer, playfield) {
    return new UIContainerFlex('row', false, 'container-tight').with(cnt => {
        for (let idx = 0; idx < 4; ++idx) {
            cnt.add(new UISlotChip(owner.idCnts[1], app.selection, owner, viewer, playfield, app.notifierSlot, idx, app.cardWidthGet()).init());
        }
    });
}
function makeUiPlayerCards(app, cntId, owner, viewer, playfield, idSlot = 0, classes = []) {
    return new UISlotSpread(cntId, app.selection, owner, viewer, playfield, idSlot, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%', ['slot', 'slot-overlap'].concat(classes)).init();
}
function makeUiPoker(playfield, app) {
    const root = app.rootGet();
    const viewer = app.viewerGet();
    const player = viewer.idCnts[0] ? viewer : app.gameGet().playersActive()[0];
    assert(player);
    const opponents = app.gameGet().playersActive().filter(p => p != player).slice(0, app.maxPlayersGet() - 1);
    for (const opponent of opponents) {
        root.add(new UIContainerFlex('aware').with(cnt => {
            cnt.add(makeUiPlayerChips(app, opponent, viewer, playfield));
        }));
    }
    for (const opponent of opponents) {
        root.add(new UIContainerFlex('aware').with(cnt => {
            cnt.add(makeUiPlayerCards(app, opponent.idCnts[0], opponent, viewer, playfield));
        }));
    }
    root.add(new UIContainerDiv().with(cnt => {
        cnt.add(new UIContainerFlex().with(cnt => {
            let uislotWaste = new UISlotSpread('waste', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%', ['slot', 'slot-overlap', 'narrow']);
            uislotWaste.init();
            uislotWaste.element.style.flexGrow = "1";
            cnt.add(uislotWaste);
            uislotWaste = new UISlotSpread('community', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%', ['slot', 'slot-overlap', 'aware']);
            uislotWaste.init();
            uislotWaste.element.style.flexGrow = "1";
            cnt.add(uislotWaste);
            const uislotStock = new UISlotSingle('stock', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet());
            uislotStock.init();
            cnt.add(uislotStock);
        }));
    }));
    root.add(new UIContainerFlex('aware-reverse').with(cnt => {
        cnt.add(makeUiPlayerCards(app, player.idCnts[0], player, viewer, playfield));
        cnt.add(new UIContainerFlex('row', false, 'container-tight').with(cnt => {
            for (let i = 0; i < 4; ++i)
                cnt.add(new UISlotChip('ante', app.selection, null, viewer, playfield, app.notifierSlot, i, app.cardWidthGet()).init());
        }));
        cnt.add(makeUiPlayerChips(app, player, viewer, playfield));
    }));
}
function makeUiPokerChinese(playfield, app) {
    const root = app.rootGet();
    const viewer = app.viewerGet();
    const player = viewer.idCnts[0] ? viewer : app.gameGet().players[0];
    assert(player);
    const opponents = app.gameGet().playersActive().filter(p => p != player).slice(0, app.maxPlayersGet() - 1);
    root.add(new UISlotSingle('stock', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), 'flip', ['Deal', () => app.dealInteractive()]).init());
    for (const opponent of opponents) {
        root.add(new UIContainerFlex('aware').with(cnt => {
            cnt.add(makeUiPlayerChips(app, opponent, viewer, playfield));
            cnt.add(makeUiPlayerCards(app, opponent.idCnts[0], opponent, viewer, playfield));
        }));
    }
    for (const opponent of opponents) {
        root.add(new UIContainerFlex().with(cnt => {
            for (let i = 0; i < 3; ++i)
                cnt.add(makeUiPlayerCards(app, opponent.idCnts[0] + "-show", opponent, viewer, playfield, i, ['aware', 'card5']));
        }));
    }
    root.add(new UIContainerFlex().with(cnt => {
        for (let i = 0; i < 3; ++i)
            cnt.add(makeUiPlayerCards(app, player.idCnts[0] + "-show", player, viewer, playfield, i, ['aware', 'card5']));
    }));
    root.add(new UIContainerFlex('aware').with(cnt => {
        cnt.add(makeUiPlayerCards(app, player.idCnts[0], player, viewer, playfield));
    }));
    root.add(new UIContainerFlex('aware').with(cnt => {
        cnt.add(new UIContainerFlex('row', false, 'container-tight').with(cnt => {
            for (let i = 0; i < 4; ++i)
                cnt.add(new UISlotChip('ante', app.selection, null, viewer, playfield, app.notifierSlot, i, app.cardWidthGet()).init());
        }));
        cnt.add(makeUiPlayerChips(app, player, viewer, playfield));
    }));
}
function makeUiHearts(playfield, app) {
    const root = app.rootGet();
    const viewer = app.viewerGet();
    const player = viewer.idCnts[0] ? viewer : app.gameGet().players[0];
    assertf(() => player);
    const players = app.gameGet().playersActive();
    root.add(new UISlotSingle('stock', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), 'flip', ['Deal', () => app.dealInteractive()]).init());
    function slotTrickPlayer(player, cnt, slotClass) {
        cnt.add(new UISlotSpread(player.idCnts[1], app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%', ['slot', slotClass]).init());
    }
    function slotOpponent(opponent, cnt, slotClass) {
        cnt.add(new UISlotSpread(opponent.idCnts[0], app.selection, opponent, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%', ['slot', slotClass]).init());
        slotTrickPlayer(opponent, cnt, slotClass);
    }
    if (false /*players.length <= 4*/) {
        const opponents = app.gameGet().playersActive().filter(p => p != player).slice(0, 3);
        root.add(new UIContainerFlex('row', false, 'container-flex-centered').with(cnt => {
            for (const opponent of opponents) {
                cnt.add(new UIContainerFlex('column').with(cnt => {
                    slotOpponent(opponent, cnt, 'slot-overlap-vert');
                }));
            }
        }));
        root.add(new UIContainerFlex('row', false, 'container-flex-centered').with(cnt => {
            cnt.add(new UISlotSpread('trick', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%').init());
        }));
        root.add(new UISlotSpread(player.idCnts[0], app.selection, player, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%').init());
        slotTrickPlayer(player, root, 'slot-overlap');
    }
    else {
        for (const p of players) {
            if (p == player) {
                root.add(new UIContainerDiv().with(cnt => {
                    cnt.element.style.padding = '7px 5px 7px 5px';
                    cnt.add(new UIContainerFlex('row', false, 'container-flex-centered').with(cnt => {
                        cnt.add(new UISlotSpread('trick', app.selection, null, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '50%', undefined, undefined, undefined, 'all-on-space').init());
                    }));
                    cnt.add(new UISlotSpread(player.idCnts[0], app.selection, p, viewer, playfield, 0, app.notifierSlot, app.images, app.cardWidthGet(), app.cardHeightGet(), '100%').init());
                    slotTrickPlayer(p, cnt, 'slot-overlap');
                }));
            }
            else {
                slotOpponent(p, root, 'slot-overlap');
            }
        }
    }
}
function run(urlCards, urlCardBack) {
    const elPeerJsHost = dom.demandById("peerjs-host", HTMLInputElement);
    const elMaxPlayers = dom.demandById("max-players", HTMLInputElement);
    const tblPlayers = dom.demandById("players", HTMLTableElement);
    function tblPlayersUpdate(peers) {
        tblPlayers.innerHTML = '';
        for (const peer of peers) {
            const row = tblPlayers.insertRow();
            row.insertCell().innerText = peer.id.slice(7);
            row.insertCell().innerText = peer.playerGet().id;
            row.insertCell().innerText = peer.status();
        }
    }
    const app = new App([
        new GameGinRummy(makeUiGinRummy),
        new GameDummy(makeUiDummy),
        new GameHearts(makeUiHearts),
        new GamePoker(makeUiPoker),
        new GamePokerChinese(makeUiPokerChinese),
    ], new NotifierSlot(), new UISlotRoot(), new Images(urlCards, urlCardBack), (game) => {
        elMaxPlayers.max = game.playersActive().length.toString();
    }, (maxPlayers) => {
        elMaxPlayers.value = maxPlayers.toString();
    }, tblPlayersUpdate);
    app.init();
    appGlobal = app;
    window.mpcardAppGlobal = app;
    dom.demandById("error").addEventListener("click", () => dom.demandById("error").style.display = 'none');
    app.connections.events.addEventListener("peerupdate", (e) => tblPlayersUpdate(e.peers));
    dom.demandById("id-get").addEventListener("click", () => {
        const id = (dom.demandById("peerjs-id", HTMLInputElement)).value.toLowerCase();
        if (!id) {
            throw new Error("Id not given");
        }
        app.connections.register("mpcard-" + id, app.onPeerConnect.bind(app), app.onReceiveData.bind(app), app.gameGet().spectator(), app.viewerGet.bind(app), app.maxPlayersGet.bind(app));
    });
    dom.demandById("connect").addEventListener("click", () => {
        const id = dom.demandById("peerjs-target", HTMLInputElement).value.toLowerCase();
        app.connections.connectYom("mpcard-" + id, app.gameGet().spectator());
    });
    dom.demandById("sync").addEventListener("click", () => app.sync(true));
    dom.demandById("player-next").addEventListener("click", () => {
        const playersAvailable = app.gameGet().players.slice(0, app.maxPlayersGet()).concat([app.gameGet().spectator()]);
        const startIdx = playersAvailable.indexOf(app.viewerGet());
        assert(startIdx != -1);
        for (let i = startIdx + 1; i < startIdx + playersAvailable.length; ++i) {
            const player = playersAvailable[i % playersAvailable.length];
            assert(player);
            if (player == app.gameGet().spectator() || !app.connections.peerByPlayer(player)) {
                app.viewerSet(player);
                app.connections.onPeerUpdate(player);
                return;
            }
        }
    });
    /*  demandElementById("connect-status").addEventListener(
        "pingback",
        function (e: EventPingBack) { this.innerHTML = `Connected for ${e.secs}s` }
      )*/
    dom.demandById("game-new").addEventListener("click", () => {
        app.newGame(dom.demandById("game-type", HTMLSelectElement).value);
        app.sync(true);
    });
    dom.demandById("hand-new").addEventListener("click", () => {
        app.newHand();
        app.sync(true);
    });
    elMaxPlayers.addEventListener("change", () => { app.maxPlayersSet(Number(elMaxPlayers.value)); app.sync(true); });
    dom.withElement("game-type", HTMLSelectElement, (elGames) => {
        for (const game of app.games) {
            const opt = document.createElement("option");
            opt.text = game.description;
            opt.value = game.id;
            elGames.add(opt);
        }
        elGames.addEventListener("change", () => {
            app.newGame(elGames.value);
            app.sync(true);
        });
    });
    dom.demandById("reveal-all").addEventListener("click", () => app.revealAll());
    function cardSizeSet() {
        const [width, height] = JSON.parse(dom.demandById("card-size", HTMLSelectElement).value);
        app.cardSizeSet(width, height);
    }
    dom.demandById("card-size").addEventListener("change", (e) => {
        cardSizeSet();
        app.viewerSet(app.viewerGet());
    });
    cardSizeSet();
    dom.demandById("save").addEventListener("click", () => {
        const state = {
            id: dom.demandById("peerjs-id", HTMLInputElement).value,
            target: dom.demandById("peerjs-target", HTMLInputElement).value,
            host: elPeerJsHost.value,
            app: app.serialize()
        };
        window.localStorage.setItem("state", JSON.stringify(state));
    });
    function restore() {
        var _a, _b, _c;
        const state = window.localStorage.getItem("state");
        if (state) {
            const serialized = JSON.parse(state);
            dom.demandById("peerjs-id", HTMLInputElement).value = (_a = serialized.id) !== null && _a !== void 0 ? _a : '';
            dom.demandById("peerjs-target", HTMLInputElement).value = (_b = serialized.target) !== null && _b !== void 0 ? _b : '';
            dom.demandById("peerjs-host", HTMLInputElement).value = (_c = serialized.host) !== null && _c !== void 0 ? _c : '';
            app.restore(serialized.app);
            dom.demandById("game-type", HTMLSelectElement).value = app.gameGet().id;
        }
        return state != undefined;
    }
    dom.demandById("load").addEventListener("click", restore);
    try {
        restore() || app.newGame(app.gameGet().id);
    }
    catch (e) {
        errorHandler("Problem restoring game state: " + e);
        app.newGame(app.gameGet().id);
    }
    if (!elPeerJsHost.value)
        getDefaultPeerJsHost().then(url => { if (url)
            elPeerJsHost.value = url; });
}
async function getDefaultPeerJsHost() {
    const url = "http://" + window.location.hostname + ": 9000";
    try {
        const response = await window.fetch(url);
        const json = await response.json();
        if ((json === null || json === void 0 ? void 0 : json.name) == 'PeerJS Server')
            return window.location.hostname;
    }
    catch (e) {
        console.debug("Default PeerJS host test", e);
        return undefined;
    }
}
window.mptest = () => {
    function moveStock() {
        const app = appGlobal;
        const playfield = app.playfield;
        const cntStock = playfield.container("stock");
        const stock = playfield.container("stock").first();
        const cntOthers = playfield.containers.filter((c) => c != cntStock);
        const waste = cntOthers[Math.floor(Math.random() * cntOthers.length)].first();
        const move = new MoveCards(app.turnCurrent.sequence, [stock.top().withFaceUp(true)], stock, waste);
        app.notifierSlot.move(move);
        if (app.playfield.container("stock").isEmpty()) {
            appGlobal.newGame(appGlobal.gameGet().id);
            appGlobal.sync(true);
        }
        window.setTimeout(moveStock, 100);
    }
    moveStock();
};
window.mptest_sync = () => {
    const app = appGlobal;
    const playfield = app.playfield;
    const cntStock = playfield.container("stock");
    const stock = playfield.container("stock").first();
    const cntOthers = playfield.containers.filter((c) => c != cntStock);
    const cntOther = cntOthers[Math.floor(Math.random() * cntOthers.length)];
    const other = cntOther.first();
    const otherAlt = cntOthers[(cntOthers.indexOf(cntOther) + 1) % cntOthers.length].first();
    const move = new MoveCards(app.turnCurrent.sequence, [stock.top().withFaceUp(true)], stock.id, other.id);
    const moveAlt = new MoveCards(app.turnCurrent.sequence, [stock.top().withFaceUp(true)], stock.id, otherAlt.id);
    app.notifierSlot.move(move);
    const peer = {
        id: 'test',
        send: (data) => app.onReceiveData(data, peer),
        consistent: true
    };
    window.setTimeout(() => app.onReceiveData({ move: moveAlt.serialize() }, peer), 1000);
};
window.mptest_rnd = () => {
    window.mptest_latency = true;
    function work() {
        const app = appGlobal;
        const gameplay = app.gameplay;
        const playfield = gameplay.playfield;
        const cnts = playfield.containers.filter((c) => !c.isEmpty() && !c.first().isEmpty());
        const cnt = cnts[Math.floor(Math.random() * cnts.length)];
        const cntOthers = playfield.containers.filter((c) => c != cnt);
        const other = cntOthers[Math.floor(Math.random() * cntOthers.length)];
        const move = new MoveCards(gameplay.turnCurrent.sequence, [cnt.first().top().withFaceUp(true)], cnt.first().id, other.first().id);
        const playfield_ = playfield.withMoveCards(move);
        assert(playfield.containers.reduce((agg, i) => agg + i.allItems().length, 0) == 52);
        assert(playfield_.containers.reduce((agg, i) => agg + i.allItems().length, 0) == 52);
        app.notifierSlot.move(move);
        window.setTimeout(work, Math.floor(Math.random() * 2000));
    }
    work();
};
window.mptest_latency = false;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdHMvYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLGFBQWEsQ0FBQTtBQUM3QyxPQUFPLEtBQUssR0FBRyxNQUFNLFVBQVUsQ0FBQTtBQUMvQixPQUFPLEVBQ0wsV0FBVyxFQUFxQixvQkFBb0IsRUFBOEIsb0JBQW9CLEVBQ3RHLGVBQWUsRUFBUSxZQUFZLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsU0FBUyxFQUNwRixZQUFZLEVBQzFCLGVBQWUsRUFDaEIsTUFBTSxXQUFXLENBQUE7QUFDbEIsT0FBTyxZQUFZLE1BQU0sb0JBQW9CLENBQUE7QUFDN0MsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGFBQWEsQ0FBQTtBQUVwQyxPQUFPLEtBQUssSUFBSSxNQUFNLFdBQVcsQ0FBQTtBQUNqQyxPQUFPLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQTtBQUMxQyxPQUFPLEVBQUUsU0FBUyxFQUFlLGNBQWMsRUFBRSxlQUFlLEVBQUUscUJBQXFCLEVBQWEsVUFBVSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBRXZLLE1BQU0sQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFBO0FBRTdCLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO0lBQzVDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQTtJQUNuQixHQUFHLENBQUMsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUFBO0FBQ3RDLENBQUMsQ0FBQyxDQUFBO0FBRUYsTUFBTSxHQUFHO0lBZVAsWUFBWSxLQUFhLEVBQ2IsWUFBMEIsRUFDMUIsSUFBZ0IsRUFDUCxN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QUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFBO0lBQzNELENBQUM7SUFFRCxJQUFJLEVBQUUsQ0FBQTtBQUNSLENBQUMsQ0FBQTtBQUVBLE1BQWMsQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAoYykgMjAyMSBEYXZpZCBCZXN3aWNrLlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIGNhcmRzLW1wIFxuICogKHNlZSBodHRwczovL2dpdGh1Yi5jb20vZGxiZXN3aWNrL2NhcmRzLW1wKS5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuICogaXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXNcbiAqIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZVxuICogTGljZW5zZSwgb3IgKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG4gKiBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2VcbiAqIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cbmltcG9ydCB7IGFzc2VydCwgYXNzZXJ0ZiB9IGZyb20gJy4vYXNzZXJ0LmpzJ1xuaW1wb3J0ICogYXMgZG9tIGZyb20gXCIuL2RvbS5qc1wiXG5pbXBvcnQge1xuICBDb25uZWN0aW9ucywgQ29udGFpbmVyU2xvdENhcmQsIEV2ZW50Q29udGFpbmVyQ2hhbmdlLCBFdmVudE1vdmUsIEV2ZW50UGVlclVwZGF0ZSwgRXZlbnRQbGF5ZmllbGRDaGFuZ2UsXG4gIEV2ZW50U2xvdENoYW5nZSwgR2FtZSwgR2FtZUdpblJ1bW15LCBHYW1lRHVtbXksIEdhbWVIZWFydHMsIEdhbWVQb2tlciwgR2FtZVBva2VyQ2hpbmVzZSwgTW92ZUNhcmRzLCBcbiAgTW92ZUl0ZW1zQW55LCBOb3RpZmllclNsb3QsIFBlZXJQbGF5ZXIsIFBsYXllciwgUGxheWZpZWxkLCBTbG90LFxuICBkZXNlcmlhbGl6ZU1vdmVcbn0gZnJvbSBcIi4vZ2FtZS5qc1wiXG5pbXBvcnQgZXJyb3JIYW5kbGVyIGZyb20gXCIuL2Vycm9yX2hhbmRsZXIuanNcIlxuaW1wb3J0IHsgSW1hZ2VzIH0gZnJvbSBcIi4vaW1hZ2VzLmpzXCJcbmltcG9ydCB7IFZlY3RvciB9IGZyb20gXCIuL21hdGguanNcIlxuaW1wb3J0ICogYXMgdGVzdCBmcm9tIFwiLi90ZXN0LmpzXCJcbmltcG9ydCB7IEdhbWVwbGF5LCBUdXJuIH0gZnJvbSBcIi4vdHVybi5qc1wiXG5pbXBvcnQgeyBTZWxlY3Rpb24sIFVJQ29udGFpbmVyLCBVSUNvbnRhaW5lckRpdiwgVUlDb250YWluZXJGbGV4LCBVSUNvbnRhaW5lclNsb3RzTXVsdGksIFVJTW92YWJsZSwgVUlTbG90Q2hpcCwgVUlTbG90U2luZ2xlLCBVSVNsb3RSb290LCBVSVNsb3RTcHJlYWQgfSBmcm9tIFwiLi91aS5qc1wiXG5cbndpbmRvdy5vbmVycm9yID0gZXJyb3JIYW5kbGVyXG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJkZXZpY2VyZWFkeVwiLCAoKSA9PiB7XG4gIGFzc2VydCh0ZXN0LnRlc3QoKSlcbiAgcnVuKFwiaW1nL2NhcmRzLnN2Z1wiLCBcImltZy9iYWNrLnN2Z1wiKVxufSlcblxuY2xhc3MgQXBwIHtcbiAgcmVhZG9ubHkgc2VsZWN0aW9uOiBTZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKClcbiAgcmVhZG9ubHkgbm90aWZpZXJTbG90OiBOb3RpZmllclNsb3RcbiAgcmVhZG9ubHkgY29ubmVjdGlvbnM6IENvbm5lY3Rpb25zID0gbmV3IENvbm5lY3Rpb25zKHRoaXMub25QZWVyUmVjb25uZWN0LmJpbmQodGhpcykpXG4gIHJlYWRvbmx5IGdhbWVzOiBHYW1lW11cbiAgcHJpdmF0ZSBtYXhQbGF5ZXJzOiBudW1iZXIgPSAyXG4gIHByaXZhdGUgcm9vdDogVUlTbG90Um9vdFxuICBwcml2YXRlIGNhcmRXaWR0aCA9IDc0XG4gIHByaXZhdGUgY2FyZEhlaWdodCA9IDExMlxuICBwcml2YXRlIHZpZXdlcjogUGxheWVyXG4gIHByaXZhdGUgZ2FtZTogR2FtZVxuICBwcml2YXRlIGF1ZGlvQ3R4PzogQXVkaW9Db250ZXh0XG4gIHByaXZhdGUgZ2FtZXBsYXk6IEdhbWVwbGF5ID0gbmV3IEdhbWVwbGF5KClcbiAgcHJpdmF0ZSBkZWJ1Z01lc3NhZ2VzOiBhbnlbXSA9IFtdXG4gIFxuICBjb25zdHJ1Y3RvcihnYW1lczogR2FtZVtdLFxuICAgICAgICAgICAgICBub3RpZmllclNsb3Q6IE5vdGlmaWVyU2xvdCxcbiAgICAgICAgICAgICAgcm9vdDogVUlTbG90Um9vdCxcbiAgICAgICAgICAgICAgcmVhZG9ubHkgaW1hZ2VzOiBJbWFnZXMsXG4gICAgICAgICAgICAgIHJlYWRvbmx5IG9uTmV3R2FtZTooZ2FtZTogR2FtZSkgPT4gdm9pZCA9ICgpID0+IHt9LFxuICAgICAgICAgICAgICByZWFkb25seSBvbk1heFBsYXllcnM6KG1heFBsYXllcnM6IG51bWJlcikgPT4gdm9pZCA9ICgpID0+IHt9LFxuICAgICAgICAgICAgICByZWFkb25seSBvblBlZXJDaGFuZ2VkOihwZWVyczogUGVlclBsYXllcltdKSA9PiB2b2lkID0gKCkgPT4ge31cbiAgICAgICAgICAgICApIHtcbiAgICBcbiAgICBhc3NlcnRmKCgpID0+IGdhbWVzKVxuICAgIHRoaXMuZ2FtZXMgPSBnYW1lc1xuICAgIHRoaXMuZ2FtZSA9IGdhbWVzWzBdXG4gICAgdGhpcy5ub3RpZmllclNsb3QgPSBub3RpZmllclNsb3RcbiAgICB0aGlzLnZpZXdlciA9IHRoaXMuZ2FtZS5wbGF5ZXJzWzBdXG4gICAgdGhpcy5yb290ID0gcm9vdFxuICB9XG5cbiAgcHJpdmF0ZSBvbk1vdmUobW92ZTogTW92ZUl0ZW1zQW55LCBsb2NhbEFjdGlvbjogYm9vbGVhbikge1xuICAgIGlmIChsb2NhbEFjdGlvbikge1xuICAgICAgdGhpcy5jb25uZWN0aW9ucy5icm9hZGNhc3Qoe21vdmU6IG1vdmUuc2VyaWFsaXplKCl9KVxuICAgIH1cbiAgICBcbiAgICBjb25zdCBwbGF5ZmllbGRPbGQgPSB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZFxuICAgIGNvbnN0IHNsb3RzQ2hhbmdlZCA9IHRoaXMuZ2FtZXBsYXkuaW50ZWdyYXRlTW92ZShtb3ZlKVxuXG4gICAgZm9yIChjb25zdCBpZENudCBvZiBtb3ZlLnNsb3RzTmV3Lm1hcCgoW2lkQ250LCBpZF0pID0+IGlkQ250KSkge1xuICAgICAgdGhpcy5ub3RpZmllclNsb3QuY29udGFpbmVyKGlkQ250KS5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBuZXcgRXZlbnRDb250YWluZXJDaGFuZ2UocGxheWZpZWxkT2xkLCB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZCwgaWRDbnQpXG4gICAgICApXG4gICAgfVxuICAgIFxuICAgIHRoaXMubm90aWZpZXJTbG90LnNsb3RzVXBkYXRlKHBsYXlmaWVsZE9sZCwgdGhpcy5nYW1lcGxheS5wbGF5ZmllbGQsIHNsb3RzQ2hhbmdlZCwgbG9jYWxBY3Rpb24pXG4gICAgdGhpcy5ub3RpZmllclNsb3QuZXZlbnRUYXJnZXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnRQbGF5ZmllbGRDaGFuZ2UocGxheWZpZWxkT2xkLCB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZCkpXG4gIH1cblxuICBhdWRpb0N0eEdldCgpOiBBdWRpb0NvbnRleHR8dW5kZWZpbmVkIHtcbiAgICBjb25zdCBjdHggPSAoPGFueT53aW5kb3cpLkF1ZGlvQ29udGV4dCB8fCAoPGFueT53aW5kb3cpLndlYmtpdEF1ZGlvQ29udGV4dFxuICAgIGlmIChjdHgpXG4gICAgICB0aGlzLmF1ZGlvQ3R4ID0gdGhpcy5hdWRpb0N0eCB8fCBuZXcgY3R4KClcbiAgICByZXR1cm4gdGhpcy5hdWRpb0N0eFxuICB9XG5cbiAgaW5pdCgpIHtcbiAgICB0aGlzLm5vdGlmaWVyU2xvdC5yZWdpc3RlclByZVNsb3RVcGRhdGUodGhpcy5wcmVTbG90VXBkYXRlLmJpbmQodGhpcykpXG4gICAgdGhpcy5ub3RpZmllclNsb3QucmVnaXN0ZXJQb3N0U2xvdFVwZGF0ZSh0aGlzLnBvc3RTbG90VXBkYXRlLmJpbmQodGhpcykpXG4gICAgXG4gICAgdGhpcy5ub3RpZmllclNsb3QuZXZlbnRUYXJnZXQuYWRkRXZlbnRMaXN0ZW5lcihcImdhbWVtb3ZlXCIsIChlOiBFdmVudE1vdmUpID0+IHRoaXMub25Nb3ZlKGUubW92ZSwgZS5sb2NhbEFjdGlvbikpXG4gIH1cblxuICByb290R2V0KCk6IFVJU2xvdFJvb3Qge1xuICAgIHJldHVybiB0aGlzLnJvb3RcbiAgfVxuICBcbiAgbmV3R2FtZShpZEdhbWU6IHN0cmluZywgdHVybnM/OiByZWFkb25seSBUdXJuW10sIHZpZXdlcklkPzogc3RyaW5nKSB7XG4gICAgY29uc3QgZ2FtZSA9IHRoaXMuZ2FtZXMuZmluZChnID0+IGcuaWQgPT0gaWRHYW1lKVxuICAgIGlmICghZ2FtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gc3VjaCBnYW1lIFwiICsgaWRHYW1lKVxuICAgIH1cblxuICAgIHRoaXMuZ2FtZSA9IGdhbWVcbiAgICB0aGlzLm1heFBsYXllcnMgPSBNYXRoLm1pbih0aGlzLm1heFBsYXllcnMsIHRoaXMuZ2FtZS5wbGF5ZXJzQWN0aXZlKCkubGVuZ3RoKVxuICAgIHRoaXMuZ2FtZXBsYXkubmV3R2FtZSh0dXJucyA/PyBbbmV3IFR1cm4odGhpcy5nYW1lLnBsYXlmaWVsZCh0aGlzLm1heFBsYXllcnMpLCAwLCBbXSldKVxuICAgIHRoaXMudmlld2VyU2V0KFxuICAgICAgdGhpcy5nYW1lLnBsYXllcnMuZmluZChwID0+IHAuaWQgPT0gdmlld2VySWQpID8/XG4gICAgICAgIHRoaXMuZ2FtZS5wbGF5ZXJzLmZpbmQocCA9PiBwLmlkID09IHRoaXMudmlld2VyPy5pZCkgPz9cbiAgICAgICAgdGhpcy5nYW1lLnBsYXllcnNbMF1cbiAgICApIHx8IHRoaXMudWlDcmVhdGUoKVxuXG4gICAgdGhpcy5vbk5ld0dhbWUodGhpcy5nYW1lKVxuICB9XG5cbiAgbmV3SGFuZCgpIHtcbiAgICB0aGlzLmdhbWVwbGF5Lm5ld0dhbWUoW25ldyBUdXJuKHRoaXMuZ2FtZS5wbGF5ZmllbGROZXdIYW5kKHRoaXMubWF4UGxheWVycywgdGhpcy5nYW1lcGxheS5wbGF5ZmllbGQpLCAwLCBbXSldKVxuICAgIHRoaXMudWlDcmVhdGUoKVxuICB9XG4gIFxuICBjYXJkU2l6ZVNldCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xuICAgIHRoaXMuY2FyZFdpZHRoID0gd2lkdGhcbiAgICB0aGlzLmNhcmRIZWlnaHQgPSBoZWlnaHRcbiAgICB0aGlzLnVpQ3JlYXRlKClcbiAgfVxuXG4gIGNhcmRXaWR0aEdldCgpIHsgcmV0dXJuIHRoaXMuY2FyZFdpZHRoIH1cbiAgY2FyZEhlaWdodEdldCgpIHsgcmV0dXJuIHRoaXMuY2FyZEhlaWdodCB9XG4gIFxuICB2aWV3ZXJTZXQodmlld2VyOiBQbGF5ZXIpOiBib29sZWFuIHtcbiAgICBhc3NlcnRmKCgpID0+IHRoaXMuZ2FtZSlcbiAgICBpZiAodGhpcy52aWV3ZXIgPT0gdmlld2VyKVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgXG4gICAgdGhpcy52aWV3ZXIgPSB2aWV3ZXJcbiAgICB0aGlzLnVpQ3JlYXRlKClcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgcHJvdGVjdGVkIHVpQ3JlYXRlKCkge1xuICAgIGFzc2VydCh0aGlzLmdhbWUpXG4gICAgdGhpcy5yb290LmRlc3Ryb3koKVxuICAgIHRoaXMucm9vdCA9IG5ldyBVSVNsb3RSb290KClcbiAgICB0aGlzLmdhbWUubWFrZVVpKHRoaXMuZ2FtZXBsYXkucGxheWZpZWxkLCB0aGlzKVxuICAgIGRvbS5kZW1hbmRCeUlkKFwicGxheWVyXCIpLmlubmVyVGV4dCA9IHRoaXMudmlld2VyLmlkXG5cbiAgICBmb3IgKGNvbnN0IGNudCBvZiB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZC5jb250YWluZXJzKSB7XG4gICAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgY250KSB7XG4gICAgICAgIHRoaXMubm90aWZpZXJTbG90LnNsb3QoY250LmlkLCBzbG90LmlkU2xvdCkuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBuZXcgRXZlbnRTbG90Q2hhbmdlKHRoaXMuZ2FtZXBsYXkucGxheWZpZWxkLCB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZCwgY250LmlkLCBzbG90LmlkU2xvdClcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgdGhpcy5ub3RpZmllclNsb3QuY29udGFpbmVyKGNudC5pZCkuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgbmV3IEV2ZW50Q29udGFpbmVyQ2hhbmdlKHRoaXMuZ2FtZXBsYXkucGxheWZpZWxkLCB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZCwgY250LmlkKVxuICAgICAgKVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgY250IG9mIHRoaXMuZ2FtZXBsYXkucGxheWZpZWxkLmNvbnRhaW5lcnNDaGlwKSB7XG4gICAgICBmb3IgKGNvbnN0IHNsb3Qgb2YgY250KSB7XG4gICAgICAgIHRoaXMubm90aWZpZXJTbG90LnNsb3QoY250LmlkLCBzbG90LmlkU2xvdCkuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBuZXcgRXZlbnRTbG90Q2hhbmdlKHRoaXMuZ2FtZXBsYXkucGxheWZpZWxkLCB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZCwgY250LmlkLCBzbG90LmlkU2xvdClcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgdGhpcy5ub3RpZmllclNsb3QuY29udGFpbmVyKGNudC5pZCkuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgbmV3IEV2ZW50Q29udGFpbmVyQ2hhbmdlKHRoaXMuZ2FtZXBsYXkucGxheWZpZWxkLCB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZCwgY250LmlkKVxuICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIHZpZXdlckdldCgpIHtcbiAgICByZXR1cm4gdGhpcy52aWV3ZXJcbiAgfVxuXG4gIGdhbWVHZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2FtZVxuICB9XG5cbiAgcHJpdmF0ZSBwcmVTbG90VXBkYXRlKHNsb3RzT2xkOiBTbG90W10sIGxvY2FsQWN0aW9uOiBib29sZWFuKTogW1VJTW92YWJsZSwgVmVjdG9yXVtdIHtcbiAgICByZXR1cm4gdGhpcy5yb290LnVpTW92YWJsZXNGb3JTbG90cyhzbG90c09sZCkubWFwKHVpbSA9PiBbdWltLCB1aW0uY29vcmRzQWJzb2x1dGUoKV0pXG4gIH1cblxuICBwb3N0U2xvdFVwZGF0ZShzbG90czogU2xvdFtdLCB1aW1vdnM6IFtVSU1vdmFibGUsIFZlY3Rvcl1bXSwgbG9jYWxBY3Rpb246IGJvb2xlYW4pIHtcbiAgICBjb25zdCB1aW1vdnNfID0gdGhpcy5yb290LnVpTW92YWJsZXNGb3JTbG90cyhzbG90cylcblxuICAgIGxldCBtYXhJbXBvcnRhbmNlID0gMFxuICAgIFxuICAgIGZvciAoY29uc3QgW3VpbW92LCBzdGFydF0gb2YgdWltb3ZzKSB7XG4gICAgICBjb25zdCB1aW1vdl8gPSB1aW1vdnNfLmZpbmQodV8gPT4gdV8uaXModWltb3YpKVxuICAgICAgXG4gICAgICBpZiAodWltb3ZfKSB7XG4gICAgICAgIGNvbnN0IGltcG9ydGFuY2UgPSBsb2NhbEFjdGlvbiA/IDAgOiB1aW1vdi5sb2NhdGlvbkltcG9ydGFuY2VcbiAgICAgICAgbWF4SW1wb3J0YW5jZSA9IE1hdGgubWF4KG1heEltcG9ydGFuY2UsIGltcG9ydGFuY2UpXG4gICAgICAgIGNvbnN0IG1zRHVyYXRpb24gPSAyNTAgKyBpbXBvcnRhbmNlICogNzUwXG4gICAgICAgIFxuICAgICAgICAvLyBVSU1vdmVhYmxlIGhhcyBhIHByZXNlbmNlIGluIHRoZSBuZXcgcGxheWZpZWxkLlxuICAgICAgICBcbiAgICAgICAgaWYgKHVpbW92XyAhPSB1aW1vdikge1xuICAgICAgICAgIC8vIFRoZSBVSU1vdmVhYmxlIGhhcyBjaGFuZ2VkIHZpc3VhbGx5IGluIHRoZSBuZXcgcGxheWZpZWxkLlxuICAgICAgICAgIHVpbW92LnJlbW92ZUZyb21QbGF5KClcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBlbmQgPSB1aW1vdl8uY29vcmRzQWJzb2x1dGUoKVxuICAgICAgICAgIGlmIChlbmRbMF0gPT0gc3RhcnRbMF0gJiYgZW5kWzFdID09IHN0YXJ0WzFdKSB7XG4gICAgICAgICAgICB1aW1vdl8uZmFkZVRvKCcwJScsICcxMDAlJywgMjUwLCB1aW1vdi5kZXN0cm95LmJpbmQodWltb3YpKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1aW1vdl8uZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbidcbiAgICAgICAgICAgIHVpbW92LmFuaW1hdGVUbyhcbiAgICAgICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgICAgIGVuZCxcbiAgICAgICAgICAgICAgTnVtYmVyKHVpbW92Xy5lbGVtZW50LnN0eWxlLnpJbmRleCksXG4gICAgICAgICAgICAgIG1zRHVyYXRpb24sXG4gICAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgICB1aW1vdl8uZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnXG4gICAgICAgICAgICAgICAgaWYgKHVpbW92LmVxdWFsc1Zpc3VhbGx5KHVpbW92XykpIHtcbiAgICAgICAgICAgICAgICAgIHVpbW92LmRlc3Ryb3koKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICB1aW1vdi5mYWRlVG8oJzEwMCUnLCAnMCUnLCAyNTAsIHVpbW92LmRlc3Ryb3kuYmluZCh1aW1vdikpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVUlNb3ZlYWJsZSBoYXMgbm8gcHJlc2VuY2UgaW4gdGhlIG5ldyBwbGF5ZmllbGQuXG4gICAgICAgIHVpbW92LnJlbW92ZUZyb21QbGF5KClcbiAgICAgICAgdWltb3YuYW5pbWF0ZVRvKHN0YXJ0LCBbc3RhcnRbMF0sIHN0YXJ0WzFdXSwgTnVtYmVyKHVpbW92LmVsZW1lbnQuc3R5bGUuekluZGV4KSwgMClcbiAgICAgICAgdWltb3YuZmFkZVRvKCcxMDAlJywgJzAlJywgMjUwLCB1aW1vdi5kZXN0cm95LmJpbmQodWltb3YpKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGN0eCA9IHRoaXMuYXVkaW9DdHhHZXQoKVxuICAgIGlmIChjdHgpIHtcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gMC4yNSArIG1heEltcG9ydGFuY2UgKiAwLjc1XG5cbiAgICAgIGNvbnN0IG9zYyA9IGN0eC5jcmVhdGVPc2NpbGxhdG9yKClcbiAgICAgIG9zYy50eXBlID0gJ3RyaWFuZ2xlJ1xuICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IDEwMCArICgxMDAgKiBtYXhJbXBvcnRhbmNlICogKDEuMCArIDAuMSAqIE1hdGgucmFuZG9tKCkpKVxuICAgICAgY29uc3QgZ2FpbiA9IGN0eC5jcmVhdGVHYWluKClcbiAgICAgIG9zYy5jb25uZWN0KGdhaW4pXG4gICAgICBnYWluLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKVxuXG4gICAgICBjb25zdCBtb2QgPSBjdHguY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgICBtb2QuZnJlcXVlbmN5LnZhbHVlID0gNSArIE1hdGgucmFuZG9tKCkgKiAoMi41ICsgbWF4SW1wb3J0YW5jZSAqIDIpXG4gICAgICBjb25zdCBnbW9kID0gY3R4LmNyZWF0ZUdhaW4oKVxuICAgICAgZ21vZC5nYWluLnZhbHVlID0gMTBcbiAgICAgIG1vZC5jb25uZWN0KGdtb2QpXG4gICAgICBnbW9kLmNvbm5lY3Qob3NjLmZyZXF1ZW5jeSlcbiAgICAgIG1vZC5zdGFydCgwKVxuXG4gICAgICBvc2Mub25lbmRlZCA9ICgpID0+IHsgZ2Fpbi5kaXNjb25uZWN0KCk7IGdtb2QuZGlzY29ubmVjdCgpOyBtb2Quc3RvcCgwKSB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRpbWUgPSBjdHguY3VycmVudFRpbWUrMC4xXG4gICAgICBvc2MuZnJlcXVlbmN5LmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUob3NjLmZyZXF1ZW5jeS52YWx1ZSAqICgwLjkgKyAoLTAuNSAqIG1heEltcG9ydGFuY2UpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lICsgZHVyYXRpb24pXG4gICAgICBnYWluLmdhaW4uc2V0VmFsdWVBdFRpbWUoMC4yNSwgdGltZSlcbiAgICAgIGdhaW4uZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKDAuMDAwMSwgdGltZSArIGR1cmF0aW9uKVxuICAgICAgZ21vZC5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC4wMDAxLCB0aW1lICsgZHVyYXRpb24pXG4gICAgICBtb2QuZnJlcXVlbmN5LmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMSwgdGltZSArIGR1cmF0aW9uKVxuICAgICAgb3NjLnN0YXJ0KHRpbWUpXG4gICAgICBvc2Muc3RvcCh0aW1lICsgZHVyYXRpb24pXG4gICAgfVxuICB9XG5cbiAgc3luYyhuZXdHYW1lOiBib29sZWFuLCBwZWVyVGFyZ2V0PzogUGVlclBsYXllcikge1xuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICBuZXdHYW1lOiBuZXdHYW1lLFxuICAgICAgZ2FtZTogdGhpcy5nYW1lLmlkLFxuICAgICAgdHVybjogdGhpcy5nYW1lcGxheS50dXJuQ3VycmVudC5zZXJpYWxpemUoKSxcbiAgICAgIG1heFBsYXllcnM6IHRoaXMubWF4UGxheWVyc1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBlZXIgb2YgdGhpcy5jb25uZWN0aW9ucy5wZWVyc0dldCgpKSB7XG4gICAgICBpZiAoIXBlZXJUYXJnZXQgfHwgcGVlclRhcmdldCA9PSBwZWVyKSB7XG4gICAgICAgIGlmIChwZWVyLm9wZW4oKSlcbiAgICAgICAgICBwZWVyLnNlbmQoe3N5bmM6IHsuLi5kYXRhfX0pXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwic3luYzogUGVlciBub3Qgb3BlblwiLCBwZWVyKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldmVhbEFsbCgpIHtcbiAgICBjb25zdCBtb3ZlczogTW92ZUNhcmRzW10gPSB0aGlzLmdhbWVwbGF5LnBsYXlmaWVsZC5jb250YWluZXJzLmZsYXRNYXAoIGNudCA9PlxuICAgICAgQXJyYXkuZnJvbShjbnQpLm1hcCggc2xvdCA9PlxuICAgICAgICBuZXcgTW92ZUNhcmRzKFxuICAgICAgICAgIHRoaXMuZ2FtZXBsYXkudHVybkN1cnJlbnQuc2VxdWVuY2UsXG4gICAgICAgICAgQXJyYXkuZnJvbShzbG90KS5tYXAod2MgPT4gd2Mud2l0aEZhY2VTdGF0ZUNvbnNjaW91cyh0cnVlLCB0cnVlKSksXG4gICAgICAgICAgc2xvdC5pZCxcbiAgICAgICAgICBzbG90LmlkXG4gICAgICAgIClcbiAgICAgIClcbiAgICApXG5cbiAgICBmb3IgKGNvbnN0IG1vdmUgb2YgbW92ZXMpXG4gICAgICB0aGlzLm5vdGlmaWVyU2xvdC5tb3ZlKG1vdmUpXG4gIH1cblxuICBvblJlY2VpdmVEYXRhKGRhdGE6IGFueSwgcGVlcjogUGVlclBsYXllcikge1xuICAgIGlmICgod2luZG93IGFzIGFueSkubXB0ZXN0X2xhdGVuY3kpIHtcbiAgICAgIHRoaXMuZGVidWdNZXNzYWdlcy5wdXNoKGRhdGEpXG4gICAgICB3aW5kb3cuc2V0VGltZW91dChcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGQgPSB0aGlzLmRlYnVnTWVzc2FnZXNbMF1cbiAgICAgICAgICB0aGlzLmRlYnVnTWVzc2FnZXMgPSB0aGlzLmRlYnVnTWVzc2FnZXMuc2xpY2UoMSlcbiAgICAgICAgICB0aGlzLl9vblJlY2VpdmVEYXRhKGQsIHBlZXIpXG4gICAgICAgIH0sXG4gICAgICAgIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDApXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX29uUmVjZWl2ZURhdGEoZGF0YSwgcGVlcilcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgX29uUmVjZWl2ZURhdGEoZGF0YTogYW55LCBwZWVyOiBQZWVyUGxheWVyKSB7XG4gICAgaWYgKGRhdGEuY2hlcm4pIHtcbiAgICAgIHRoaXMubWF4UGxheWVyc1NldChNYXRoLm1heChkYXRhLmNoZXJuLm1heFBsYXllcnMsIHRoaXMubWF4UGxheWVycykpXG5cbiAgICAgIC8vIFN5bmNocm9uaXNlIHRoZSBpbmNvbWluZyAocGVlciwgcGxheWVyKSBwYWlycyAoaW5jbHVkaW5nIGxvY2FsIHBsYXllcikuXG4gICAgICAvLyBDb25uZWN0IHRvIGFueSBwZWVycyB0aGF0IHRoaXMgbm9kZSBkaWRuJ3Qga25vdyBhYm91dCBiZWZvcmUuXG4gICAgICBmb3IgKGNvbnN0IHBlZXIgb2YgZGF0YS5jaGVybi5wZWVycykge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSB0aGlzLmdhbWUucGxheWVycy5maW5kKHAgPT4gcC5pc0lkKHBlZXIucGxheWVyKSlcbiAgICAgICAgYXNzZXJ0KHBsYXllciwgXCJVbmtub3duIHBsYXllclwiLCBwZWVyKVxuICAgICAgICBpZiAocGVlci5pZCA9PSB0aGlzLmNvbm5lY3Rpb25zLnJlZ2lzdHJhbnRJZCgpKSB7XG4gICAgICAgICAgdGhpcy52aWV3ZXJTZXQocGxheWVyKVxuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmNvbm5lY3Rpb25zLnBlZXJCeUlkKHBlZXIuaWQpKSB7XG4gICAgICAgICAgdGhpcy5jb25uZWN0aW9ucy5jb25uZWN0KHBlZXIuaWQsIHBsYXllciwgKCkgPT4ge30sIHt9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHBlZXJQbGF5ZXIgPSB0aGlzLmNvbm5lY3Rpb25zLnBlZXJCeUlkKHBlZXIuaWQpXG4gICAgICAgICAgYXNzZXJ0KHBlZXJQbGF5ZXIpXG4gICAgICAgICAgcGVlclBsYXllci5wbGF5ZXJDaGFuZ2UocGxheWVyKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLm9uUGVlckNoYW5nZWQodGhpcy5jb25uZWN0aW9ucy5wZWVyc0dldCgpKVxuICAgICAgdGhpcy5vbk1heFBsYXllcnModGhpcy5tYXhQbGF5ZXJzKVxuICAgIH0gZWxzZSBpZiAoZGF0YS5waW5nKSB7XG4gICAgICAvL2RlbWFuZEVsZW1lbnRCeUlkKFwiY29ubmVjdC1zdGF0dXNcIikuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnRQaW5nQmFjayhkYXRhLnBpbmcuc2VjcykpXG4gICAgICBwZWVyLnNlbmQoe3BpbmdfYmFjazoge3NlY3M6IGRhdGEucGluZy5zZWNzfX0pXG4gICAgfSBlbHNlIGlmIChkYXRhLnBpbmdfYmFjaykge1xuICAgICAgLy9kZW1hbmRFbGVtZW50QnlJZChcImNvbm5lY3Qtc3RhdHVzXCIpLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50UGluZ0JhY2soZGF0YS5waW5nX2JhY2suc2VjcykpXG4gICAgfSBlbHNlIGlmIChkYXRhLnN5bmMpIHtcbiAgICAgIHRoaXMubWF4UGxheWVycyA9IGRhdGEuc3luYy5tYXhQbGF5ZXJzXG4gICAgICB0aGlzLm9uTWF4UGxheWVycyh0aGlzLm1heFBsYXllcnMpXG5cbiAgICAgIGNvbnN0IHR1cm5JbmNvbWluZyA9IFR1cm4uZnJvbVNlcmlhbGl6ZWQoZGF0YS5zeW5jLnR1cm4pXG4gICAgICBpZiAoZGF0YS5zeW5jLm5ld0dhbWUgfHwgIXRoaXMuZ2FtZXBsYXkuaGFzU2VxdWVuY2UodHVybkluY29taW5nLnNlcXVlbmNlKSkge1xuICAgICAgICB0aGlzLm5ld0dhbWUoZGF0YS5zeW5jLmdhbWUsIFt0dXJuSW5jb21pbmddKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nYW1lcGxheS5yZXN0YXRlVHVybih0dXJuSW5jb21pbmcpXG4gICAgICAgIHRoaXMubmV3R2FtZShkYXRhLnN5bmMuZ2FtZSwgdGhpcy5nYW1lcGxheS50dXJucylcbiAgICAgIH1cblxuICAgICAgcGVlci5zZW5kKHtnb3RTeW5jOiB7IHNlcXVlbmNlOiB0dXJuSW5jb21pbmcuc2VxdWVuY2UgfX0pXG4gICAgfSBlbHNlIGlmIChkYXRhLmFza1N5bmMpIHtcbiAgICAgIHRoaXMuc3luYyhmYWxzZSwgcGVlcilcbiAgICB9IGVsc2UgaWYgKGRhdGEuZ290U3luYykge1xuICAgICAgY29uc29sZS5kZWJ1ZyhcIlBlZXIgZ290IHN5bmMgZm9yIHNlcXVlbmNlIFwiICsgZGF0YS5nb3RTeW5jLnNlcXVlbmNlKVxuICAgIH0gZWxzZSBpZiAoZGF0YS5wZWVyVXBkYXRlKSB7XG4gICAgICBmb3IgKGNvbnN0IHBlZXJQbGF5ZXIgb2YgZGF0YS5wZWVyVXBkYXRlLnBlZXJQbGF5ZXJzKSB7XG4gICAgICAgIGNvbnN0IHBlZXJQbGF5ZXJJZCA9IHBlZXJQbGF5ZXIuaWRcbiAgICAgICAgY29uc3QgcGxheWVyID0gdGhpcy5nYW1lLnBsYXllcnMuZmluZCgocCkgPT4gcC5pZCA9PSBwZWVyUGxheWVyLnBsYXllcilcbiAgICAgICAgYXNzZXJ0KHBsYXllcilcbiAgICAgICAgXG4gICAgICAgIGlmIChwZWVyUGxheWVySWQgPT0gdGhpcy5jb25uZWN0aW9ucy5yZWdpc3RyYW50SWQoKSkge1xuICAgICAgICAgIHRoaXMudmlld2VyU2V0KHBsYXllcilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25zLnBlZXJCeUlkKHBlZXJQbGF5ZXJJZCk/LnBsYXllckNoYW5nZShwbGF5ZXIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMub25QZWVyQ2hhbmdlZCh0aGlzLmNvbm5lY3Rpb25zLnBlZXJzR2V0KCkpXG4gICAgfSBlbHNlIGlmIChkYXRhLm1vdmUpIHtcbiAgICAgIGlmICh0aGlzLmdhbWVwbGF5Lmhhc1NlcXVlbmNlKGRhdGEubW92ZS50dXJuU2VxdWVuY2UpKSB7XG4gICAgICAgIHRoaXMubm90aWZpZXJTbG90Lm1vdmUoZGVzZXJpYWxpemVNb3ZlKGRhdGEubW92ZSksIGZhbHNlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk1vdmUgaWdub3JlZCwgc2VxdWVuY2Ugbm90IGZvdW5kIGluIHR1cm4gaGlzdG9yeVwiLCBkYXRhLm1vdmUsIHRoaXMuZ2FtZXBsYXkudHVybnMpXG4gICAgICAgIHBlZXIuc2VuZCh7YXNrU3luYzogdHJ1ZX0pXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChkYXRhLmRlbnkpIHtcbiAgICAgIGVycm9ySGFuZGxlcihcIkNvbm5lY3Rpb24gZGVuaWVkOiBcIiArIGRhdGEuZGVueS5tZXNzYWdlKVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiVW5rbm93biBtZXNzYWdlXCIsIGRhdGEpXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBvblBsYXlmaWVsZEluY29uc2lzdGVudChwZWVyOiBQZWVyUGxheWVyLCBlcnJvcnM6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgcmVnaXN0cmFudElkID0gdGhpcy5jb25uZWN0aW9ucy5yZWdpc3RyYW50SWQoKVxuICAgIGFzc2VydChyZWdpc3RyYW50SWQpXG4gICAgaWYgKHBlZXIuaWQgPCByZWdpc3RyYW50SWQpIHtcbiAgICAgIGNvbnNvbGUuZGVidWcoXCJJbmNvbnNpc3RlbnQgcGxheWZpZWxkIHdpdGggYXV0aG9yaXRpdmUgaWQsIHN5bmNpbmdcIiwgZXJyb3JzKVxuICAgICAgdGhpcy5zeW5jKGZhbHNlLCBwZWVyKVxuICAgIH0gZWxzZSB7XG4gICAgICBwZWVyLnNlbmQoe2Fza1N5bmM6IHRydWV9KVxuICAgICAgY29uc29sZS5kZWJ1ZyhcIkluY29uc2lzdGVudCBwbGF5ZmllbGQgd2l0aCBub24tYXV0aG9yaXRpdmUgaWQsIHN1cnJlbmRlcmluZ1wiLCBlcnJvcnMpXG4gICAgfVxuICB9XG4gIFxuICBvblBlZXJDb25uZWN0KG1ldGFkYXRhOiBhbnksIHBlZXI6IFBlZXJQbGF5ZXIpOiB2b2lkIHtcbiAgICBpZiAobWV0YWRhdGEgPT0gJ3lvbScpIHtcbiAgICAgIC8vIHRiZDogY2hlY2sgcGxheWZpZWxkIHNlcXVlbmNlICMgYW5kIHN5bmMgaWYgbmVjZXNzYXJ5P1xuICAgICAgY29uc3QgW3BsYXllckZvclBlZXIsIF9dID0gdGhpcy5wbGF5ZXJHZXRGb3JQZWVyKHBlZXIpXG4gICAgICBhc3NlcnQocGxheWVyRm9yUGVlcilcbiAgICAgIHBlZXIucGxheWVyQ2hhbmdlKHBsYXllckZvclBlZXIpXG4gICAgICB0aGlzLm9uUGVlclJlY29ubmVjdChwZWVyKVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgb25QZWVyUmVjb25uZWN0KHBlZXI6IFBlZXJQbGF5ZXIpIHtcbiAgICB0aGlzLnN5bmModHJ1ZSxwZWVyKVxuICAgIHRoaXMuY29ubmVjdGlvbnMuYnJvYWRjYXN0KHtcbiAgICAgIGNoZXJuOiB7XG4gICAgICAgIGNvbm5lY3Rpbmc6IHBlZXIuaWQsXG4gICAgICAgIHBlZXJzOiBBcnJheS5mcm9tKHRoaXMuY29ubmVjdGlvbnMucGVlcnNHZXQoKS52YWx1ZXMoKSkuXG4gICAgICAgICAgbWFwKHAgPT4gcC5zZXJpYWxpemUoKSkuXG4gICAgICAgICAgY29uY2F0KHtpZDogdGhpcy5jb25uZWN0aW9ucy5yZWdpc3RyYW50SWQoKSwgcGxheWVyOiB0aGlzLnZpZXdlci5pZH0pLFxuICAgICAgICBtYXhQbGF5ZXJzOiB0aGlzLm1heFBsYXllcnNcbiAgICAgIH1cbiAgICB9KVxuICB9XG4gIFxuICBwbGF5ZXJHZXRGb3JQZWVyKHBlZXI6IFBlZXJQbGF5ZXIpOiBbUGxheWVyfHVuZGVmaW5lZCwgc3RyaW5nXSB7XG4gICAgLy8gSWYgdGhlIGluY29taW5nIHBlZXIgYWxyZWFkeSBoYXMgYSBwbGF5ZXIgYXNzaWduZWQgdG8gdGhlbSwgdGhlbiB1c2UgdGhhdC5cbiAgICAvLyBPdGhlcndpc2UgZmluZCB0aGUgZmlyc3QgZnJlZSBvbmUsIG9yIHVzZSB0aGUgc3BlY3RhdG9yIGFzIGEgbGFzdCByZXNvcnQuXG4gICAgaWYgKHBlZXIucGxheWVyR2V0KCkgPT0gdGhpcy5nYW1lLnNwZWN0YXRvcigpKSB7XG4gICAgICBmb3IgKGNvbnN0IHBsYXllciBvZiB0aGlzLmdhbWUucGxheWVycy5zbGljZSgwLCB0aGlzLm1heFBsYXllcnMpKSB7XG4gICAgICAgIGNvbnN0IHBlZXJGb3JQbGF5ZXIgPSB0aGlzLmNvbm5lY3Rpb25zLnBlZXJCeVBsYXllcihwbGF5ZXIpXG4gICAgICAgIGlmICh0aGlzLnZpZXdlciAhPSBwbGF5ZXIgJiYgKCFwZWVyRm9yUGxheWVyIHx8IHBlZXJGb3JQbGF5ZXIuaXMocGVlcikpKVxuICAgICAgICAgIHJldHVybiBbcGxheWVyLCBcIlwiXVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gW3RoaXMuZ2FtZS5zcGVjdGF0b3IoKSwgXCJcIl1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFtwZWVyLnBsYXllckdldCgpLCBcIlwiXVxuICAgIH1cbiAgfVxuICBcbiAgc2VyaWFsaXplKCkge1xuICAgIHJldHVybiB7XG4gICAgICBnYW1lOiB0aGlzLmdhbWUuaWQsXG4gICAgICB2aWV3ZXI6IHRoaXMudmlld2VyLmlkLFxuICAgICAgdHVybjogdGhpcy5nYW1lcGxheS50dXJuQ3VycmVudC5zZXJpYWxpemUoKSxcbiAgICAgIG1heFBsYXllcnM6IHRoaXMubWF4UGxheWVyc1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmUoc2VyaWFsaXplZDogYW55KSB7XG4gICAgdGhpcy5tYXhQbGF5ZXJzID0gc2VyaWFsaXplZC5tYXhQbGF5ZXJzXG4gICAgdGhpcy5uZXdHYW1lKHNlcmlhbGl6ZWQuZ2FtZSwgW1R1cm4uZnJvbVNlcmlhbGl6ZWQoc2VyaWFsaXplZC50dXJuKV0sIHNlcmlhbGl6ZWQudmlld2VyKVxuICAgIHRoaXMuc3luYyh0cnVlKVxuICB9XG5cbiAgZGVhbEludGVyYWN0aXZlKCkge1xuICAgIGNvbnN0IGdlbiA9IHRoaXMuZ2FtZS5kZWFsKHRoaXMubWF4UGxheWVycywgdGhpcy5nYW1lcGxheS5wbGF5ZmllbGQpXG4gICAgY29uc3Qgc3RlcCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGl0ID0gZ2VuLm5leHQoKVxuICAgICAgaWYgKCFpdC5kb25lKSB7XG4gICAgICAgIHRoaXMubm90aWZpZXJTbG90Lm1vdmUoaXQudmFsdWUpXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHN0ZXAsIDI1MClcbiAgICAgIH1cbiAgICB9XG4gICAgd2luZG93LnNldFRpbWVvdXQoc3RlcCwgMjUwKVxuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgbWF4UGxheWVyc1NldChtYXg6IG51bWJlcikge1xuICAgIGlmIChtYXggIT0gdGhpcy5tYXhQbGF5ZXJzKSB7XG4gICAgICB0aGlzLm1heFBsYXllcnMgPSBtYXhcbiAgICAgIHRoaXMudWlDcmVhdGUoKVxuICAgIH1cbiAgfVxuICBcbiAgbWF4UGxheWVyc0dldCgpIHsgcmV0dXJuIHRoaXMubWF4UGxheWVycyB9XG59XG5cbmxldCBhcHBHbG9iYWw6IEFwcFxuXG5mdW5jdGlvbiBtYWtlVWlHaW5SdW1teShwbGF5ZmllbGQ6IFBsYXlmaWVsZCwgYXBwOiBBcHApIHtcbiAgY29uc3Qgcm9vdCA9IGFwcC5yb290R2V0KClcbiAgY29uc3Qgdmlld2VyID0gYXBwLnZpZXdlckdldCgpXG4gIGNvbnN0IHBsYXllciA9IHZpZXdlci5pZENudHNbMF0gPyB2aWV3ZXIgOiBhcHAuZ2FtZUdldCgpLnBsYXllcnNbMF0hXG4gIGFzc2VydGYoKCkgPT4gcGxheWVyKVxuICBjb25zdCBvcHBvbmVudDogUGxheWVyID0gYXBwLmdhbWVHZXQoKS5wbGF5ZXJzLmZpbmQocCA9PiBwLmlkQ250c1swXSAmJiBwICE9IHBsYXllcikhXG4gIGFzc2VydGYoKCkgPT4gb3Bwb25lbnQpXG4gIFxuICByb290LmFkZChcbiAgICBuZXcgVUlDb250YWluZXJGbGV4KCkud2l0aChjbnQgPT4ge1xuICAgICAgY250LmFkZChcbiAgICAgICAgbmV3IFVJU2xvdFNwcmVhZChvcHBvbmVudC5pZENudHNbMF0sIGFwcC5zZWxlY3Rpb24sIG9wcG9uZW50LCB2aWV3ZXIsIHBsYXlmaWVsZCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLCBhcHAuY2FyZFdpZHRoR2V0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnKS5pbml0KClcbiAgICAgIClcbiAgICB9KVxuICApXG4gIFxuICByb290LmFkZChcbiAgICBuZXcgVUlDb250YWluZXJGbGV4KCkud2l0aChjbnQgPT4ge1xuICAgICAgXG4gICAgICBjb25zdCB1aXNsb3RXYXN0ZSA9IG5ldyBVSVNsb3RTcHJlYWQoJ3dhc3RlJywgYXBwLnNlbGVjdGlvbiwgbnVsbCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsIGFwcC5ub3RpZmllclNsb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcxMDAlJylcbiAgICAgIHVpc2xvdFdhc3RlLmluaXQoKVxuICAgICAgdWlzbG90V2FzdGUuZWxlbWVudC5zdHlsZS5mbGV4R3JvdyA9IFwiMVwiXG4gICAgICBjbnQuYWRkKHVpc2xvdFdhc3RlKVxuICAgICAgXG4gICAgICBjb25zdCB1aXNsb3RTdG9jayA9IG5ldyBVSVNsb3RTaW5nbGUoJ3N0b2NrJywgYXBwLnNlbGVjdGlvbiwgbnVsbCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsIGFwcC5ub3RpZmllclNsb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdmbGlwJywgWydEZWFsJywgKCkgPT4gYXBwLmRlYWxJbnRlcmFjdGl2ZSgpXSlcbiAgICAgIHVpc2xvdFN0b2NrLmluaXQoKVxuICAgICAgY250LmFkZCh1aXNsb3RTdG9jaylcbiAgICB9KVxuICApXG4gIFxuICBjb25zdCB1aXNsb3RCb3R0b20gPSBuZXcgVUlTbG90U3ByZWFkKHBsYXllci5pZENudHNbMF0sIGFwcC5zZWxlY3Rpb24sIHBsYXllciwgdmlld2VyLCBwbGF5ZmllbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgYXBwLm5vdGlmaWVyU2xvdCwgYXBwLmltYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAuY2FyZFdpZHRoR2V0KCksIGFwcC5jYXJkSGVpZ2h0R2V0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJzEwMCUnKVxuICB1aXNsb3RCb3R0b20uaW5pdCgpXG4gIHJvb3QuYWRkKHVpc2xvdEJvdHRvbSlcbn1cblxuZnVuY3Rpb24gbWFrZVVpRHVtbXkocGxheWZpZWxkOiBQbGF5ZmllbGQsIGFwcDogQXBwKSB7XG4gIGNvbnN0IHJvb3QgPSBhcHAucm9vdEdldCgpXG4gIGNvbnN0IHZpZXdlciA9IGFwcC52aWV3ZXJHZXQoKVxuICBjb25zdCBwbGF5ZXIgPSB2aWV3ZXIuaWRDbnRzWzBdID8gdmlld2VyIDogYXBwLmdhbWVHZXQoKS5wbGF5ZXJzWzBdIVxuICBhc3NlcnRmKCgpID0+IHBsYXllcilcbiAgY29uc3Qgb3Bwb25lbnQ6IFBsYXllciA9IGFwcC5nYW1lR2V0KCkucGxheWVycy5maW5kKHAgPT4gcC5pZENudHNbMF0gJiYgcCAhPSBwbGF5ZXIpIVxuICBhc3NlcnRmKCgpID0+IG9wcG9uZW50KVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgpLndpdGgoY250ID0+IHtcbiAgICAgIGNudC5hZGQoXG4gICAgICAgIG5ldyBVSVNsb3RTcHJlYWQob3Bwb25lbnQuaWRDbnRzWzBdLCBhcHAuc2VsZWN0aW9uLCBvcHBvbmVudCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgYXBwLm5vdGlmaWVyU2xvdCwgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5jYXJkSGVpZ2h0R2V0KCksICcxMDAlJykuaW5pdCgpXG4gICAgICApXG4gICAgfSlcbiAgKVxuXG4gIHJvb3QuYWRkKFxuICAgIG5ldyBVSUNvbnRhaW5lckZsZXgoKS53aXRoKGNudCA9PiB7XG4gICAgICBjbnQuYWRkKFxuICAgICAgICBuZXcgVUlDb250YWluZXJTbG90c011bHRpKG9wcG9uZW50LmlkQ250c1swXSsnLW1lbGQnLCBhcHAuc2VsZWN0aW9uLCBudWxsLCB2aWV3ZXIsIHBsYXlmaWVsZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5jYXJkV2lkdGhHZXQoKSwgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJycsICd0dXJuJykuaW5pdCgpXG4gICAgICApXG4gICAgfSlcbiAgKVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgpLndpdGgoY250ID0+IHtcbiAgICAgIGNudC5hZGQoXG4gICAgICAgIG5ldyBVSVNsb3RTcHJlYWQoJ3dhc3RlJywgYXBwLnNlbGVjdGlvbiwgbnVsbCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsIGFwcC5ub3RpZmllclNsb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICcxMDAlJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsICdmbGlwJywgJ2FsbC1wcm9jZWVkaW5nJykuaW5pdCgpXG4gICAgICApXG4gICAgfSlcbiAgKVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgpLndpdGgoY250ID0+IHtcbiAgICAgIGNudC5hZGQoXG4gICAgICAgIG5ldyBVSUNvbnRhaW5lclNsb3RzTXVsdGkocGxheWVyLmlkQ250c1swXSsnLW1lbGQnLCBhcHAuc2VsZWN0aW9uLCBudWxsLCB2aWV3ZXIsIHBsYXlmaWVsZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5jYXJkV2lkdGhHZXQoKSwgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJycsICd0dXJuJykuaW5pdCgpXG4gICAgICApXG4gICAgfSlcbiAgKVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgpLndpdGgoY250ID0+IHtcbiAgICAgIGNudC5hZGQoXG4gICAgICAgIG5ldyBVSVNsb3RTcHJlYWQocGxheWVyLmlkQ250c1swXSwgYXBwLnNlbGVjdGlvbiwgcGxheWVyLCB2aWV3ZXIsIHBsYXlmaWVsZCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLCBhcHAuY2FyZFdpZHRoR2V0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnKS5pbml0KClcbiAgICAgIClcbiAgICB9KVxuICApXG5cbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgpLndpdGgoY250ID0+IHtcbiAgICAgIGNudC5hZGQoXG4gICAgICAgIG5ldyBVSVNsb3RTaW5nbGUoJ3N0b2NrJywgYXBwLnNlbGVjdGlvbiwgbnVsbCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsIGFwcC5ub3RpZmllclNsb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICdmbGlwJywgWydEZWFsJywgKCkgPT4gYXBwLmRlYWxJbnRlcmFjdGl2ZSgpXSkuaW5pdCgpXG4gICAgICApXG4gICAgfSlcbiAgKVxufVxuXG5mdW5jdGlvbiBtYWtlVWlQbGF5ZXJDaGlwcyhhcHA6IEFwcCwgb3duZXI6IFBsYXllciwgdmlld2VyOiBQbGF5ZXIsIHBsYXlmaWVsZDogUGxheWZpZWxkKSB7XG4gIHJldHVybiBuZXcgVUlDb250YWluZXJGbGV4KCdyb3cnLCBmYWxzZSwgJ2NvbnRhaW5lci10aWdodCcpLndpdGgoY250ID0+IHtcbiAgICBmb3IgKGxldCBpZHg9MDsgaWR4IDwgNDsgKytpZHgpIHtcbiAgICAgIGNudC5hZGQoXG4gICAgICAgIG5ldyBVSVNsb3RDaGlwKG93bmVyLmlkQ250c1sxXSwgYXBwLnNlbGVjdGlvbiwgb3duZXIsIHZpZXdlciwgcGxheWZpZWxkLCBhcHAubm90aWZpZXJTbG90LCBpZHgsXG4gICAgICAgICAgICAgICAgICAgICAgIGFwcC5jYXJkV2lkdGhHZXQoKSkuaW5pdCgpXG4gICAgICApXG4gICAgfVxuICB9KVxufVxuXG5mdW5jdGlvbiBtYWtlVWlQbGF5ZXJDYXJkcyhhcHA6IEFwcCwgY250SWQ6IHN0cmluZywgb3duZXI6IFBsYXllciwgdmlld2VyOiBQbGF5ZXIsIHBsYXlmaWVsZDogUGxheWZpZWxkLCBpZFNsb3Q9MCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzZXM6IHN0cmluZ1tdPVtdKSB7XG4gIFxuICByZXR1cm4gbmV3IFVJU2xvdFNwcmVhZChjbnRJZCwgYXBwLnNlbGVjdGlvbiwgb3duZXIsIHZpZXdlciwgcGxheWZpZWxkLCBpZFNsb3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5ub3RpZmllclNsb3QsIGFwcC5pbWFnZXMsIGFwcC5jYXJkV2lkdGhHZXQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnLCBbJ3Nsb3QnLCAnc2xvdC1vdmVybGFwJ10uY29uY2F0KGNsYXNzZXMpKS5pbml0KClcbn1cblxuZnVuY3Rpb24gbWFrZVVpUG9rZXIocGxheWZpZWxkOiBQbGF5ZmllbGQsIGFwcDogQXBwKSB7XG4gIGNvbnN0IHJvb3QgPSBhcHAucm9vdEdldCgpXG4gIGNvbnN0IHZpZXdlciA9IGFwcC52aWV3ZXJHZXQoKVxuICBjb25zdCBwbGF5ZXIgPSB2aWV3ZXIuaWRDbnRzWzBdID8gdmlld2VyIDogYXBwLmdhbWVHZXQoKS5wbGF5ZXJzQWN0aXZlKClbMF1cbiAgYXNzZXJ0KHBsYXllcilcbiAgXG4gIGNvbnN0IG9wcG9uZW50cyA9IGFwcC5nYW1lR2V0KCkucGxheWVyc0FjdGl2ZSgpLmZpbHRlcihwID0+IHAgIT0gcGxheWVyKS5zbGljZSgwLCBhcHAubWF4UGxheWVyc0dldCgpLTEpXG5cbiAgZm9yIChjb25zdCBvcHBvbmVudCBvZiBvcHBvbmVudHMpIHtcbiAgICByb290LmFkZChcbiAgICAgIG5ldyBVSUNvbnRhaW5lckZsZXgoJ2F3YXJlJykud2l0aChjbnQgPT4ge1xuICAgICAgICBjbnQuYWRkKG1ha2VVaVBsYXllckNoaXBzKGFwcCwgb3Bwb25lbnQsIHZpZXdlciwgcGxheWZpZWxkKSlcbiAgICAgIH0pXG4gICAgKVxuICB9XG4gIFxuICBmb3IgKGNvbnN0IG9wcG9uZW50IG9mIG9wcG9uZW50cykge1xuICAgIHJvb3QuYWRkKFxuICAgICAgbmV3IFVJQ29udGFpbmVyRmxleCgnYXdhcmUnKS53aXRoKGNudCA9PiB7XG4gICAgICAgIGNudC5hZGQobWFrZVVpUGxheWVyQ2FyZHMoYXBwLCBvcHBvbmVudC5pZENudHNbMF0sIG9wcG9uZW50LCB2aWV3ZXIsIHBsYXlmaWVsZCkpXG4gICAgICB9KVxuICAgIClcbiAgfVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRGl2KCkud2l0aChjbnQgPT4ge1xuXG4gICAgICBjbnQuYWRkKFxuICAgICAgICBuZXcgVUlDb250YWluZXJGbGV4KCkud2l0aChjbnQgPT4ge1xuICAgICAgICAgIGxldCB1aXNsb3RXYXN0ZSA9IG5ldyBVSVNsb3RTcHJlYWQoJ3dhc3RlJywgYXBwLnNlbGVjdGlvbiwgbnVsbCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLCBhcHAuY2FyZFdpZHRoR2V0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAuY2FyZEhlaWdodEdldCgpLCAnMTAwJScsIFsnc2xvdCcsICdzbG90LW92ZXJsYXAnLCAnbmFycm93J10pXG4gICAgICAgICAgdWlzbG90V2FzdGUuaW5pdCgpXG4gICAgICAgICAgdWlzbG90V2FzdGUuZWxlbWVudC5zdHlsZS5mbGV4R3JvdyA9IFwiMVwiXG4gICAgICAgICAgY250LmFkZCh1aXNsb3RXYXN0ZSlcbiAgICAgICAgICBcbiAgICAgICAgICB1aXNsb3RXYXN0ZSA9IG5ldyBVSVNsb3RTcHJlYWQoJ2NvbW11bml0eScsIGFwcC5zZWxlY3Rpb24sIG51bGwsIHZpZXdlciwgcGxheWZpZWxkLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLCBhcHAuY2FyZFdpZHRoR2V0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5jYXJkSGVpZ2h0R2V0KCksICcxMDAlJywgWydzbG90JywgJ3Nsb3Qtb3ZlcmxhcCcsICdhd2FyZSddKVxuICAgICAgICAgIHVpc2xvdFdhc3RlLmluaXQoKVxuICAgICAgICAgIHVpc2xvdFdhc3RlLmVsZW1lbnQuc3R5bGUuZmxleEdyb3cgPSBcIjFcIlxuICAgICAgICAgIGNudC5hZGQodWlzbG90V2FzdGUpXG4gICAgICAgIFxuICAgICAgICAgIGNvbnN0IHVpc2xvdFN0b2NrID0gbmV3IFVJU2xvdFNpbmdsZSgnc3RvY2snLCBhcHAuc2VsZWN0aW9uLCBudWxsLCB2aWV3ZXIsIHBsYXlmaWVsZCwgMCwgYXBwLm5vdGlmaWVyU2xvdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpKVxuICAgICAgICAgIHVpc2xvdFN0b2NrLmluaXQoKVxuICAgICAgICAgIGNudC5hZGQodWlzbG90U3RvY2spXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgfSlcbiAgKVxuXG4gIHJvb3QuYWRkKFxuICAgIG5ldyBVSUNvbnRhaW5lckZsZXgoJ2F3YXJlLXJldmVyc2UnKS53aXRoKGNudCA9PiB7XG4gICAgICBjbnQuYWRkKG1ha2VVaVBsYXllckNhcmRzKGFwcCwgcGxheWVyLmlkQ250c1swXSwgcGxheWVyLCB2aWV3ZXIsIHBsYXlmaWVsZCkpXG4gICAgICBjbnQuYWRkKFxuICAgICAgICBuZXcgVUlDb250YWluZXJGbGV4KCdyb3cnLCBmYWxzZSwgJ2NvbnRhaW5lci10aWdodCcpLndpdGgoY250ID0+IHtcbiAgICAgICAgICBmb3IgKGxldCBpPTA7IGk8NDsgKytpKVxuICAgICAgICAgICAgY250LmFkZChcbiAgICAgICAgICAgICAgbmV3IFVJU2xvdENoaXAoJ2FudGUnLCBhcHAuc2VsZWN0aW9uLCBudWxsLCB2aWV3ZXIsIHBsYXlmaWVsZCwgYXBwLm5vdGlmaWVyU2xvdCwgaSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRXaWR0aEdldCgpKS5pbml0KClcbiAgICAgICAgICAgIClcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIGNudC5hZGQobWFrZVVpUGxheWVyQ2hpcHMoYXBwLCBwbGF5ZXIsIHZpZXdlciwgcGxheWZpZWxkKSlcbiAgICB9KVxuICApXG59XG5cbmZ1bmN0aW9uIG1ha2VVaVBva2VyQ2hpbmVzZShwbGF5ZmllbGQ6IFBsYXlmaWVsZCwgYXBwOiBBcHApIHtcbiAgY29uc3Qgcm9vdCA9IGFwcC5yb290R2V0KClcbiAgY29uc3Qgdmlld2VyID0gYXBwLnZpZXdlckdldCgpXG4gIGNvbnN0IHBsYXllciA9IHZpZXdlci5pZENudHNbMF0gPyB2aWV3ZXIgOiBhcHAuZ2FtZUdldCgpLnBsYXllcnNbMF1cbiAgYXNzZXJ0KHBsYXllcilcbiAgY29uc3Qgb3Bwb25lbnRzID0gYXBwLmdhbWVHZXQoKS5wbGF5ZXJzQWN0aXZlKCkuZmlsdGVyKHAgPT4gcCAhPSBwbGF5ZXIpLnNsaWNlKDAsIGFwcC5tYXhQbGF5ZXJzR2V0KCktMSlcblxuICByb290LmFkZChcbiAgICBuZXcgVUlTbG90U2luZ2xlKCdzdG9jaycsIGFwcC5zZWxlY3Rpb24sIG51bGwsIHZpZXdlciwgcGxheWZpZWxkLCAwLCBhcHAubm90aWZpZXJTbG90LFxuICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2ZsaXAnLCBbJ0RlYWwnLCAoKSA9PiBhcHAuZGVhbEludGVyYWN0aXZlKCldKS5pbml0KClcbiAgKVxuICBcbiAgZm9yIChjb25zdCBvcHBvbmVudCBvZiBvcHBvbmVudHMpIHtcbiAgICByb290LmFkZChcbiAgICAgIG5ldyBVSUNvbnRhaW5lckZsZXgoJ2F3YXJlJykud2l0aChjbnQgPT4ge1xuICAgICAgICBjbnQuYWRkKG1ha2VVaVBsYXllckNoaXBzKGFwcCwgb3Bwb25lbnQsIHZpZXdlciwgcGxheWZpZWxkKSlcbiAgICAgICAgY250LmFkZChtYWtlVWlQbGF5ZXJDYXJkcyhhcHAsIG9wcG9uZW50LmlkQ250c1swXSwgb3Bwb25lbnQsIHZpZXdlciwgcGxheWZpZWxkKSlcbiAgICAgIH0pXG4gICAgKVxuICB9XG5cbiAgZm9yIChjb25zdCBvcHBvbmVudCBvZiBvcHBvbmVudHMpIHtcbiAgICByb290LmFkZChcbiAgICAgIG5ldyBVSUNvbnRhaW5lckZsZXgoKS53aXRoKGNudCA9PiB7XG4gICAgICAgIGZvciAobGV0IGk9MDsgaTwzOyArK2kpXG4gICAgICAgICAgY250LmFkZChtYWtlVWlQbGF5ZXJDYXJkcyhhcHAsIG9wcG9uZW50LmlkQ250c1swXSArIFwiLXNob3dcIiwgb3Bwb25lbnQsIHZpZXdlciwgcGxheWZpZWxkLCBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydhd2FyZScsICdjYXJkNSddKSlcbiAgICAgIH0pXG4gICAgKVxuICB9XG4gIFxuICByb290LmFkZChcbiAgICBuZXcgVUlDb250YWluZXJGbGV4KCkud2l0aChjbnQgPT4ge1xuICAgICAgZm9yIChsZXQgaT0wOyBpPDM7ICsraSlcbiAgICAgICAgY250LmFkZChtYWtlVWlQbGF5ZXJDYXJkcyhhcHAsIHBsYXllci5pZENudHNbMF0gKyBcIi1zaG93XCIsIHBsYXllciwgdmlld2VyLCBwbGF5ZmllbGQsIGksIFsnYXdhcmUnLCAnY2FyZDUnXSkpXG4gICAgfSlcbiAgKVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgnYXdhcmUnKS53aXRoKGNudCA9PiB7XG4gICAgICBjbnQuYWRkKG1ha2VVaVBsYXllckNhcmRzKGFwcCwgcGxheWVyLmlkQ250c1swXSwgcGxheWVyLCB2aWV3ZXIsIHBsYXlmaWVsZCkpXG4gICAgfSlcbiAgKVxuICBcbiAgcm9vdC5hZGQoXG4gICAgbmV3IFVJQ29udGFpbmVyRmxleCgnYXdhcmUnKS53aXRoKGNudCA9PiB7XG4gICAgICBjbnQuYWRkKFxuICAgICAgICBuZXcgVUlDb250YWluZXJGbGV4KCdyb3cnLGZhbHNlLCdjb250YWluZXItdGlnaHQnKS53aXRoKGNudCA9PiB7XG4gICAgICAgICAgZm9yIChsZXQgaT0wOyBpPDQ7ICsraSlcbiAgICAgICAgICAgIGNudC5hZGQoXG4gICAgICAgICAgICAgIG5ldyBVSVNsb3RDaGlwKCdhbnRlJywgYXBwLnNlbGVjdGlvbiwgbnVsbCwgdmlld2VyLCBwbGF5ZmllbGQsIGFwcC5ub3RpZmllclNsb3QsIGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5jYXJkV2lkdGhHZXQoKSkuaW5pdCgpXG4gICAgICAgICAgICApXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICBjbnQuYWRkKG1ha2VVaVBsYXllckNoaXBzKGFwcCwgcGxheWVyLCB2aWV3ZXIsIHBsYXlmaWVsZCkpXG4gICAgfSlcbiAgKVxufVxuXG5mdW5jdGlvbiBtYWtlVWlIZWFydHMocGxheWZpZWxkOiBQbGF5ZmllbGQsIGFwcDogQXBwKSB7XG4gIGNvbnN0IHJvb3QgPSBhcHAucm9vdEdldCgpXG4gIGNvbnN0IHZpZXdlciA9IGFwcC52aWV3ZXJHZXQoKVxuICBjb25zdCBwbGF5ZXIgPSB2aWV3ZXIuaWRDbnRzWzBdID8gdmlld2VyIDogYXBwLmdhbWVHZXQoKS5wbGF5ZXJzWzBdIVxuICBhc3NlcnRmKCgpID0+IHBsYXllcilcbiAgY29uc3QgcGxheWVycyA9IGFwcC5nYW1lR2V0KCkucGxheWVyc0FjdGl2ZSgpXG4gIFxuICByb290LmFkZChcbiAgICBuZXcgVUlTbG90U2luZ2xlKCdzdG9jaycsIGFwcC5zZWxlY3Rpb24sIG51bGwsIHZpZXdlciwgcGxheWZpZWxkLCAwLCBhcHAubm90aWZpZXJTbG90LFxuICAgICAgICAgICAgICAgICAgICAgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLCBhcHAuY2FyZEhlaWdodEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgJ2ZsaXAnLCBbJ0RlYWwnLCAoKSA9PiBhcHAuZGVhbEludGVyYWN0aXZlKCldKS5pbml0KClcbiAgKVxuXG4gIGZ1bmN0aW9uIHNsb3RUcmlja1BsYXllcihwbGF5ZXI6IFBsYXllciwgY250OiBVSUNvbnRhaW5lciwgc2xvdENsYXNzOiBzdHJpbmcpIHtcbiAgICBjbnQuYWRkKFxuICAgICAgbmV3IFVJU2xvdFNwcmVhZChwbGF5ZXIuaWRDbnRzWzFdLCBhcHAuc2VsZWN0aW9uLCBudWxsLCB2aWV3ZXIsIHBsYXlmaWVsZCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgYXBwLm5vdGlmaWVyU2xvdCwgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICBhcHAuY2FyZEhlaWdodEdldCgpLCAnMTAwJScsIFsnc2xvdCcsIHNsb3RDbGFzc10pLmluaXQoKVxuICAgIClcbiAgfVxuICBcbiAgZnVuY3Rpb24gc2xvdE9wcG9uZW50KG9wcG9uZW50OiBQbGF5ZXIsIGNudDogVUlDb250YWluZXIsIHNsb3RDbGFzczogc3RyaW5nKSB7XG4gICAgY250LmFkZChcbiAgICAgIG5ldyBVSVNsb3RTcHJlYWQob3Bwb25lbnQuaWRDbnRzWzBdLCBhcHAuc2VsZWN0aW9uLCBvcHBvbmVudCwgdmlld2VyLCBwbGF5ZmllbGQsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgIGFwcC5ub3RpZmllclNsb3QsIGFwcC5pbWFnZXMsIGFwcC5jYXJkV2lkdGhHZXQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnLCBbJ3Nsb3QnLCBzbG90Q2xhc3NdKS5pbml0KClcbiAgICApXG4gICAgc2xvdFRyaWNrUGxheWVyKG9wcG9uZW50LCBjbnQsIHNsb3RDbGFzcylcbiAgfVxuXG4gIGlmIChmYWxzZS8qcGxheWVycy5sZW5ndGggPD0gNCovKSB7XG4gICAgY29uc3Qgb3Bwb25lbnRzID0gYXBwLmdhbWVHZXQoKS5wbGF5ZXJzQWN0aXZlKCkuZmlsdGVyKHAgPT4gcCAhPSBwbGF5ZXIpLnNsaWNlKDAsIDMpXG4gICAgXG4gICAgcm9vdC5hZGQoXG4gICAgICBuZXcgVUlDb250YWluZXJGbGV4KCdyb3cnLCBmYWxzZSwgJ2NvbnRhaW5lci1mbGV4LWNlbnRlcmVkJykud2l0aChjbnQgPT4ge1xuICAgICAgICBmb3IgKGNvbnN0IG9wcG9uZW50IG9mIG9wcG9uZW50cykge1xuICAgICAgICAgIGNudC5hZGQoXG4gICAgICAgICAgICBuZXcgVUlDb250YWluZXJGbGV4KCdjb2x1bW4nKS53aXRoKGNudCA9PiB7XG4gICAgICAgICAgICAgIHNsb3RPcHBvbmVudChvcHBvbmVudCwgY250LCAnc2xvdC1vdmVybGFwLXZlcnQnKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICB9KVxuICAgIClcblxuICAgIHJvb3QuYWRkKFxuICAgICAgbmV3IFVJQ29udGFpbmVyRmxleCgncm93JywgZmFsc2UsICdjb250YWluZXItZmxleC1jZW50ZXJlZCcpLndpdGgoY250ID0+IHtcbiAgICAgICAgY250LmFkZChcbiAgICAgICAgICBuZXcgVUlTbG90U3ByZWFkKCd0cmljaycsIGFwcC5zZWxlY3Rpb24sIG51bGwsIHZpZXdlciwgcGxheWZpZWxkLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLm5vdGlmaWVyU2xvdCwgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnKS5pbml0KClcbiAgICAgICAgKVxuICAgICAgfSlcbiAgICApXG4gICAgXG4gICAgcm9vdC5hZGQoXG4gICAgICBuZXcgVUlTbG90U3ByZWFkKHBsYXllci5pZENudHNbMF0sIGFwcC5zZWxlY3Rpb24sIHBsYXllciwgdmlld2VyLCBwbGF5ZmllbGQsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgIGFwcC5ub3RpZmllclNsb3QsIGFwcC5pbWFnZXMsIGFwcC5jYXJkV2lkdGhHZXQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnKS5pbml0KClcbiAgICApXG4gICAgc2xvdFRyaWNrUGxheWVyKHBsYXllciwgcm9vdCwgJ3Nsb3Qtb3ZlcmxhcCcpXG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBwIG9mIHBsYXllcnMpIHtcbiAgICAgIGlmIChwID09IHBsYXllcikge1xuICAgICAgICByb290LmFkZChcbiAgICAgICAgICBuZXcgVUlDb250YWluZXJEaXYoKS53aXRoKGNudCA9PiB7XG4gICAgICAgICAgICBjbnQuZWxlbWVudC5zdHlsZS5wYWRkaW5nID0gJzdweCA1cHggN3B4IDVweCdcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY250LmFkZChcbiAgICAgICAgICAgICAgbmV3IFVJQ29udGFpbmVyRmxleCgncm93JywgZmFsc2UsICdjb250YWluZXItZmxleC1jZW50ZXJlZCcpLndpdGgoY250ID0+IHtcbiAgICAgICAgICAgICAgICBjbnQuYWRkKFxuICAgICAgICAgICAgICAgICAgbmV3IFVJU2xvdFNwcmVhZCgndHJpY2snLCBhcHAuc2VsZWN0aW9uLCBudWxsLCB2aWV3ZXIsIHBsYXlmaWVsZCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLm5vdGlmaWVyU2xvdCwgYXBwLmltYWdlcywgYXBwLmNhcmRXaWR0aEdldCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAuY2FyZEhlaWdodEdldCgpLCAnNTAlJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FsbC1vbi1zcGFjZScpLmluaXQoKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgY250LmFkZChcbiAgICAgICAgICAgICAgbmV3IFVJU2xvdFNwcmVhZChwbGF5ZXIuaWRDbnRzWzBdLCBhcHAuc2VsZWN0aW9uLCBwLCB2aWV3ZXIsIHBsYXlmaWVsZCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubm90aWZpZXJTbG90LCBhcHAuaW1hZ2VzLCBhcHAuY2FyZFdpZHRoR2V0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLmNhcmRIZWlnaHRHZXQoKSwgJzEwMCUnKS5pbml0KClcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHNsb3RUcmlja1BsYXllcihwLCBjbnQsICdzbG90LW92ZXJsYXAnKVxuICAgICAgICAgIH0pXG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNsb3RPcHBvbmVudChwLCByb290LCAnc2xvdC1vdmVybGFwJylcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcnVuKHVybENhcmRzOiBzdHJpbmcsIHVybENhcmRCYWNrOiBzdHJpbmcpIHtcbiAgY29uc3QgZWxQZWVySnNIb3N0ID0gZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtaG9zdFwiLCBIVE1MSW5wdXRFbGVtZW50KVxuICBjb25zdCBlbE1heFBsYXllcnMgPSBkb20uZGVtYW5kQnlJZChcIm1heC1wbGF5ZXJzXCIsIEhUTUxJbnB1dEVsZW1lbnQpXG4gIGNvbnN0IHRibFBsYXllcnMgPSBkb20uZGVtYW5kQnlJZChcInBsYXllcnNcIiwgSFRNTFRhYmxlRWxlbWVudClcblxuICBmdW5jdGlvbiB0YmxQbGF5ZXJzVXBkYXRlKHBlZXJzOiBQZWVyUGxheWVyW10pIHtcbiAgICB0YmxQbGF5ZXJzLmlubmVySFRNTCA9ICcnXG4gICAgZm9yIChjb25zdCBwZWVyIG9mIHBlZXJzKSB7XG4gICAgICBjb25zdCByb3cgPSB0YmxQbGF5ZXJzLmluc2VydFJvdygpXG4gICAgICByb3cuaW5zZXJ0Q2VsbCgpLmlubmVyVGV4dCA9IHBlZXIuaWQuc2xpY2UoNylcbiAgICAgIHJvdy5pbnNlcnRDZWxsKCkuaW5uZXJUZXh0ID0gcGVlci5wbGF5ZXJHZXQoKS5pZFxuICAgICAgcm93Lmluc2VydENlbGwoKS5pbm5lclRleHQgPSBwZWVyLnN0YXR1cygpXG4gICAgfVxuICB9XG4gIFxuICBjb25zdCBhcHAgPSBuZXcgQXBwKFxuICAgIFtcbiAgICAgIG5ldyBHYW1lR2luUnVtbXkobWFrZVVpR2luUnVtbXkpLFxuICAgICAgbmV3IEdhbWVEdW1teShtYWtlVWlEdW1teSksXG4gICAgICBuZXcgR2FtZUhlYXJ0cyhtYWtlVWlIZWFydHMpLFxuICAgICAgbmV3IEdhbWVQb2tlcihtYWtlVWlQb2tlciksXG4gICAgICBuZXcgR2FtZVBva2VyQ2hpbmVzZShtYWtlVWlQb2tlckNoaW5lc2UpLFxuICAgIF0sXG4gICAgbmV3IE5vdGlmaWVyU2xvdCgpLFxuICAgIG5ldyBVSVNsb3RSb290KCksXG4gICAgbmV3IEltYWdlcyh1cmxDYXJkcywgdXJsQ2FyZEJhY2spLFxuICAgIChnYW1lOiBHYW1lKSA9PiB7XG4gICAgICBlbE1heFBsYXllcnMubWF4ID0gZ2FtZS5wbGF5ZXJzQWN0aXZlKCkubGVuZ3RoLnRvU3RyaW5nKClcbiAgICB9LFxuICAgIChtYXhQbGF5ZXJzOiBudW1iZXIpID0+IHtcbiAgICAgIGVsTWF4UGxheWVycy52YWx1ZSA9IG1heFBsYXllcnMudG9TdHJpbmcoKVxuICAgIH0sXG4gICAgdGJsUGxheWVyc1VwZGF0ZVxuICApXG5cbiAgYXBwLmluaXQoKVxuICBcbiAgYXBwR2xvYmFsID0gYXBwO1xuICBcbiAgKHdpbmRvdyBhcyBhbnkpLm1wY2FyZEFwcEdsb2JhbCA9IGFwcFxuXG4gIGRvbS5kZW1hbmRCeUlkKFwiZXJyb3JcIikuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICBcImNsaWNrXCIsXG4gICAgKCkgPT4gZG9tLmRlbWFuZEJ5SWQoXCJlcnJvclwiKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnXG4gIClcblxuICBhcHAuY29ubmVjdGlvbnMuZXZlbnRzLmFkZEV2ZW50TGlzdGVuZXIoXCJwZWVydXBkYXRlXCIsIChlOiBFdmVudFBlZXJVcGRhdGUpID0+IHRibFBsYXllcnNVcGRhdGUoZS5wZWVycykpXG5cbiAgZG9tLmRlbWFuZEJ5SWQoXCJpZC1nZXRcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICBjb25zdCBpZCA9IChkb20uZGVtYW5kQnlJZChcInBlZXJqcy1pZFwiLCBIVE1MSW5wdXRFbGVtZW50KSkudmFsdWUudG9Mb3dlckNhc2UoKVxuICAgIGlmICghaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIklkIG5vdCBnaXZlblwiKVxuICAgIH1cbiAgICBcbiAgICBhcHAuY29ubmVjdGlvbnMucmVnaXN0ZXIoXCJtcGNhcmQtXCIgKyBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwLm9uUGVlckNvbm5lY3QuYmluZChhcHApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAub25SZWNlaXZlRGF0YS5iaW5kKGFwcCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5nYW1lR2V0KCkuc3BlY3RhdG9yKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC52aWV3ZXJHZXQuYmluZChhcHApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHAubWF4UGxheWVyc0dldC5iaW5kKGFwcCkpXG4gIH0pXG4gIGRvbS5kZW1hbmRCeUlkKFwiY29ubmVjdFwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgIGNvbnN0IGlkID0gZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtdGFyZ2V0XCIsIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlLnRvTG93ZXJDYXNlKClcbiAgICBhcHAuY29ubmVjdGlvbnMuY29ubmVjdFlvbShcIm1wY2FyZC1cIiArIGlkLCBhcHAuZ2FtZUdldCgpLnNwZWN0YXRvcigpKVxuICB9KVxuICBkb20uZGVtYW5kQnlJZChcInN5bmNcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IGFwcC5zeW5jKHRydWUpKVxuICBkb20uZGVtYW5kQnlJZChcInBsYXllci1uZXh0XCIpLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgY29uc3QgcGxheWVyc0F2YWlsYWJsZSA9IGFwcC5nYW1lR2V0KCkucGxheWVycy5zbGljZSgwLCBhcHAubWF4UGxheWVyc0dldCgpKS5jb25jYXQoW2FwcC5nYW1lR2V0KCkuc3BlY3RhdG9yKCldKVxuICAgIGNvbnN0IHN0YXJ0SWR4ID0gcGxheWVyc0F2YWlsYWJsZS5pbmRleE9mKGFwcC52aWV3ZXJHZXQoKSlcbiAgICBhc3NlcnQoc3RhcnRJZHggIT0gLTEpXG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SWR4KzE7IGkgPCBzdGFydElkeCtwbGF5ZXJzQXZhaWxhYmxlLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBwbGF5ZXIgPSBwbGF5ZXJzQXZhaWxhYmxlW2kgJSBwbGF5ZXJzQXZhaWxhYmxlLmxlbmd0aF1cbiAgICAgIGFzc2VydChwbGF5ZXIpXG4gICAgICBpZiAocGxheWVyID09IGFwcC5nYW1lR2V0KCkuc3BlY3RhdG9yKCkgfHwgIWFwcC5jb25uZWN0aW9ucy5wZWVyQnlQbGF5ZXIocGxheWVyKSkge1xuICAgICAgICBhcHAudmlld2VyU2V0KHBsYXllcilcbiAgICAgICAgYXBwLmNvbm5lY3Rpb25zLm9uUGVlclVwZGF0ZShwbGF5ZXIpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgIH1cbiAgfSlcbi8qICBkZW1hbmRFbGVtZW50QnlJZChcImNvbm5lY3Qtc3RhdHVzXCIpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgXCJwaW5nYmFja1wiLFxuICAgIGZ1bmN0aW9uIChlOiBFdmVudFBpbmdCYWNrKSB7IHRoaXMuaW5uZXJIVE1MID0gYENvbm5lY3RlZCBmb3IgJHtlLnNlY3N9c2AgfVxuICApKi9cbiAgXG4gIGRvbS5kZW1hbmRCeUlkKFwiZ2FtZS1uZXdcIikuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICBcImNsaWNrXCIsXG4gICAgKCkgPT4ge1xuICAgICAgYXBwLm5ld0dhbWUoZG9tLmRlbWFuZEJ5SWQoXCJnYW1lLXR5cGVcIiwgSFRNTFNlbGVjdEVsZW1lbnQpLnZhbHVlKVxuICAgICAgYXBwLnN5bmModHJ1ZSlcbiAgICB9XG4gIClcblxuICBkb20uZGVtYW5kQnlJZChcImhhbmQtbmV3XCIpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgXCJjbGlja1wiLFxuICAgICgpID0+IHtcbiAgICAgIGFwcC5uZXdIYW5kKClcbiAgICAgIGFwcC5zeW5jKHRydWUpXG4gICAgfVxuICApXG4gIFxuICBlbE1heFBsYXllcnMuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICBcImNoYW5nZVwiLFxuICAgICgpID0+IHsgYXBwLm1heFBsYXllcnNTZXQoTnVtYmVyKGVsTWF4UGxheWVycy52YWx1ZSkpOyBhcHAuc3luYyh0cnVlKSB9XG4gIClcbiAgXG4gIGRvbS53aXRoRWxlbWVudChcImdhbWUtdHlwZVwiLCBIVE1MU2VsZWN0RWxlbWVudCwgKGVsR2FtZXMpID0+IHtcbiAgICBmb3IgKGNvbnN0IGdhbWUgb2YgYXBwLmdhbWVzKSB7XG4gICAgICBjb25zdCBvcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwib3B0aW9uXCIpXG4gICAgICBvcHQudGV4dCA9IGdhbWUuZGVzY3JpcHRpb25cbiAgICAgIG9wdC52YWx1ZSA9IGdhbWUuaWRcbiAgICAgIGVsR2FtZXMuYWRkKG9wdClcbiAgICB9XG4gICAgZWxHYW1lcy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgXCJjaGFuZ2VcIixcbiAgICAgICgpID0+IHtcbiAgICAgICAgYXBwLm5ld0dhbWUoZWxHYW1lcy52YWx1ZSlcbiAgICAgICAgYXBwLnN5bmModHJ1ZSlcbiAgICAgIH1cbiAgICApXG4gIH0pXG4gIFxuICBkb20uZGVtYW5kQnlJZChcInJldmVhbC1hbGxcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IGFwcC5yZXZlYWxBbGwoKSlcblxuICBmdW5jdGlvbiBjYXJkU2l6ZVNldCgpIHtcbiAgICBjb25zdCBbd2lkdGgsIGhlaWdodF0gPSBKU09OLnBhcnNlKGRvbS5kZW1hbmRCeUlkKFwiY2FyZC1zaXplXCIsIEhUTUxTZWxlY3RFbGVtZW50KS52YWx1ZSlcbiAgICBhcHAuY2FyZFNpemVTZXQod2lkdGgsIGhlaWdodClcbiAgfVxuICBkb20uZGVtYW5kQnlJZChcImNhcmQtc2l6ZVwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIChlKSA9PiB7XG4gICAgY2FyZFNpemVTZXQoKVxuICAgIGFwcC52aWV3ZXJTZXQoYXBwLnZpZXdlckdldCgpKVxuICB9KVxuICBjYXJkU2l6ZVNldCgpXG5cbiAgZG9tLmRlbWFuZEJ5SWQoXCJzYXZlXCIpLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgXCJjbGlja1wiLFxuICAgICgpID0+IHtcbiAgICAgIGNvbnN0IHN0YXRlID0ge1xuICAgICAgICBpZDogZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtaWRcIiwgSFRNTElucHV0RWxlbWVudCkudmFsdWUsXG4gICAgICAgIHRhcmdldDogZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtdGFyZ2V0XCIsIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlLFxuICAgICAgICBob3N0OiBlbFBlZXJKc0hvc3QudmFsdWUsXG4gICAgICAgIGFwcDogYXBwLnNlcmlhbGl6ZSgpXG4gICAgICB9XG4gICAgICBcbiAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInN0YXRlXCIsIEpTT04uc3RyaW5naWZ5KHN0YXRlKSlcbiAgICB9XG4gIClcblxuICBmdW5jdGlvbiByZXN0b3JlKCkge1xuICAgIGNvbnN0IHN0YXRlID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic3RhdGVcIilcbiAgICBpZiAoc3RhdGUpIHtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZWQgPSBKU09OLnBhcnNlKHN0YXRlKVxuICAgICAgZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtaWRcIiwgSFRNTElucHV0RWxlbWVudCkudmFsdWUgPSBzZXJpYWxpemVkLmlkID8/ICcnXG4gICAgICBkb20uZGVtYW5kQnlJZChcInBlZXJqcy10YXJnZXRcIiwgSFRNTElucHV0RWxlbWVudCkudmFsdWUgPSBzZXJpYWxpemVkLnRhcmdldCA/PyAnJ1xuICAgICAgZG9tLmRlbWFuZEJ5SWQoXCJwZWVyanMtaG9zdFwiLCBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSA9IHNlcmlhbGl6ZWQuaG9zdCA/PyAnJ1xuICAgICAgYXBwLnJlc3RvcmUoc2VyaWFsaXplZC5hcHApXG4gICAgICBkb20uZGVtYW5kQnlJZChcImdhbWUtdHlwZVwiLCBIVE1MU2VsZWN0RWxlbWVudCkudmFsdWUgPSBhcHAuZ2FtZUdldCgpLmlkXG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRlICE9IHVuZGVmaW5lZFxuICB9XG4gIFxuICBkb20uZGVtYW5kQnlJZChcImxvYWRcIikuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIHJlc3RvcmUpXG5cbiAgdHJ5IHtcbiAgICByZXN0b3JlKCkgfHwgYXBwLm5ld0dhbWUoYXBwLmdhbWVHZXQoKS5pZClcbiAgfSBjYXRjaChlKSB7XG4gICAgZXJyb3JIYW5kbGVyKFwiUHJvYmxlbSByZXN0b3JpbmcgZ2FtZSBzdGF0ZTogXCIgKyBlKVxuICAgIGFwcC5uZXdHYW1lKGFwcC5nYW1lR2V0KCkuaWQpXG4gIH1cblxuICBpZiAoIWVsUGVlckpzSG9zdC52YWx1ZSlcbiAgICBnZXREZWZhdWx0UGVlckpzSG9zdCgpLnRoZW4odXJsID0+IHsgaWYgKHVybCkgZWxQZWVySnNIb3N0LnZhbHVlID0gdXJsIH0pXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldERlZmF1bHRQZWVySnNIb3N0KCkge1xuICBjb25zdCB1cmwgPSBcImh0dHA6Ly9cIit3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUrXCI6IDkwMDBcIlxuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgd2luZG93LmZldGNoKHVybClcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXG4gICAgaWYgKGpzb24/Lm5hbWUgPT0gJ1BlZXJKUyBTZXJ2ZXInKVxuICAgICAgcmV0dXJuIHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5kZWJ1ZyhcIkRlZmF1bHQgUGVlckpTIGhvc3QgdGVzdFwiLCBlKVxuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxufVxuICBcbih3aW5kb3cgYXMgYW55KS5tcHRlc3QgPSAoKSA9PiB7XG4gIGZ1bmN0aW9uIG1vdmVTdG9jaygpIHtcbiAgICBjb25zdCBhcHAgPSBhcHBHbG9iYWwgYXMgYW55XG4gICAgY29uc3QgcGxheWZpZWxkID0gYXBwLnBsYXlmaWVsZFxuICAgIGNvbnN0IGNudFN0b2NrID0gcGxheWZpZWxkLmNvbnRhaW5lcihcInN0b2NrXCIpXG4gICAgY29uc3Qgc3RvY2sgPSBwbGF5ZmllbGQuY29udGFpbmVyKFwic3RvY2tcIikuZmlyc3QoKVxuICAgIGNvbnN0IGNudE90aGVycyA9IHBsYXlmaWVsZC5jb250YWluZXJzLmZpbHRlcigoYzogQ29udGFpbmVyU2xvdENhcmQpID0+IGMgIT0gY250U3RvY2spXG4gICAgY29uc3Qgd2FzdGUgPSBjbnRPdGhlcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY250T3RoZXJzLmxlbmd0aCldLmZpcnN0KClcbiAgICBjb25zdCBtb3ZlID0gbmV3IE1vdmVDYXJkcyhhcHAudHVybkN1cnJlbnQuc2VxdWVuY2UsIFtzdG9jay50b3AoKS53aXRoRmFjZVVwKHRydWUpXSwgc3RvY2ssIHdhc3RlKVxuICAgIFxuICAgIGFwcC5ub3RpZmllclNsb3QubW92ZShtb3ZlKVxuXG4gICAgaWYgKGFwcC5wbGF5ZmllbGQuY29udGFpbmVyKFwic3RvY2tcIikuaXNFbXB0eSgpKSB7XG4gICAgICBhcHBHbG9iYWwubmV3R2FtZShhcHBHbG9iYWwuZ2FtZUdldCgpLmlkKVxuICAgICAgYXBwR2xvYmFsLnN5bmModHJ1ZSlcbiAgICB9XG4gICAgXG4gICAgd2luZG93LnNldFRpbWVvdXQoXG4gICAgICBtb3ZlU3RvY2ssXG4gICAgICAxMDBcbiAgICApXG4gIH1cblxuICBtb3ZlU3RvY2soKVxufVxuXG4od2luZG93IGFzIGFueSkubXB0ZXN0X3N5bmMgPSAoKSA9PiB7XG4gIGNvbnN0IGFwcCA9IGFwcEdsb2JhbCBhcyBhbnlcbiAgY29uc3QgcGxheWZpZWxkID0gYXBwLnBsYXlmaWVsZFxuICBjb25zdCBjbnRTdG9jayA9IHBsYXlmaWVsZC5jb250YWluZXIoXCJzdG9ja1wiKVxuICBjb25zdCBzdG9jayA9IHBsYXlmaWVsZC5jb250YWluZXIoXCJzdG9ja1wiKS5maXJzdCgpXG4gIGNvbnN0IGNudE90aGVycyA9IHBsYXlmaWVsZC5jb250YWluZXJzLmZpbHRlcigoYzogQ29udGFpbmVyU2xvdENhcmQpID0+IGMgIT0gY250U3RvY2spXG4gIGNvbnN0IGNudE90aGVyID0gY250T3RoZXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNudE90aGVycy5sZW5ndGgpXVxuICBjb25zdCBvdGhlciA9IGNudE90aGVyLmZpcnN0KClcbiAgY29uc3Qgb3RoZXJBbHQgPSBjbnRPdGhlcnNbKGNudE90aGVycy5pbmRleE9mKGNudE90aGVyKSsxKSAlIGNudE90aGVycy5sZW5ndGhdLmZpcnN0KClcbiAgY29uc3QgbW92ZSA9IG5ldyBNb3ZlQ2FyZHMoYXBwLnR1cm5DdXJyZW50LnNlcXVlbmNlLCBbc3RvY2sudG9wKCkud2l0aEZhY2VVcCh0cnVlKV0sIHN0b2NrLmlkLCBvdGhlci5pZClcbiAgXG4gIGNvbnN0IG1vdmVBbHQgPSBuZXcgTW92ZUNhcmRzKGFwcC50dXJuQ3VycmVudC5zZXF1ZW5jZSwgW3N0b2NrLnRvcCgpLndpdGhGYWNlVXAodHJ1ZSldLCBzdG9jay5pZCwgb3RoZXJBbHQuaWQpXG5cbiAgYXBwLm5vdGlmaWVyU2xvdC5tb3ZlKG1vdmUpXG5cbiAgY29uc3QgcGVlciA9IHtcbiAgICBpZDogJ3Rlc3QnLFxuICAgIHNlbmQ6IChkYXRhOiBhbnkpID0+IChhcHAgYXMgYW55KS5vblJlY2VpdmVEYXRhKGRhdGEsIHBlZXIpLFxuICAgIGNvbnNpc3RlbnQ6IHRydWVcbiAgfSBhcyBQZWVyUGxheWVyXG4gIFxuICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PlxuICAgIGFwcC5vblJlY2VpdmVEYXRhKHsgbW92ZTogbW92ZUFsdC5zZXJpYWxpemUoKSB9LCBwZWVyKSxcbiAgICAxMDAwXG4gIClcbn1cblxuKHdpbmRvdyBhcyBhbnkpLm1wdGVzdF9ybmQgPSAoKSA9PiB7XG4gICh3aW5kb3cgYXMgYW55KS5tcHRlc3RfbGF0ZW5jeSA9IHRydWVcbiAgXG4gIGZ1bmN0aW9uIHdvcmsoKSB7XG4gICAgY29uc3QgYXBwID0gYXBwR2xvYmFsXG4gICAgY29uc3QgZ2FtZXBsYXkgPSAoYXBwIGFzIGFueSkuZ2FtZXBsYXkgYXMgR2FtZXBsYXlcbiAgICBjb25zdCBwbGF5ZmllbGQgPSBnYW1lcGxheS5wbGF5ZmllbGQgYXMgUGxheWZpZWxkXG4gICAgY29uc3QgY250cyA9IHBsYXlmaWVsZC5jb250YWluZXJzLmZpbHRlcigoYzogQ29udGFpbmVyU2xvdENhcmQpID0+ICFjLmlzRW1wdHkoKSAmJiAhYy5maXJzdCgpLmlzRW1wdHkoKSlcbiAgICBjb25zdCBjbnQgPSBjbnRzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNudHMubGVuZ3RoKV1cbiAgICBjb25zdCBjbnRPdGhlcnMgPSBwbGF5ZmllbGQuY29udGFpbmVycy5maWx0ZXIoKGM6IENvbnRhaW5lclNsb3RDYXJkKSA9PiBjICE9IGNudClcbiAgICBjb25zdCBvdGhlciA9IGNudE90aGVyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjbnRPdGhlcnMubGVuZ3RoKV1cbiAgICBjb25zdCBtb3ZlID0gbmV3IE1vdmVDYXJkcyhnYW1lcGxheS50dXJuQ3VycmVudC5zZXF1ZW5jZSwgW2NudC5maXJzdCgpLnRvcCgpLndpdGhGYWNlVXAodHJ1ZSldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNudC5maXJzdCgpLmlkLCBvdGhlci5maXJzdCgpLmlkKVxuICBcbiAgICBjb25zdCBwbGF5ZmllbGRfID0gcGxheWZpZWxkLndpdGhNb3ZlQ2FyZHMobW92ZSlcbiAgICBhc3NlcnQocGxheWZpZWxkLmNvbnRhaW5lcnMucmVkdWNlKChhZ2csIGkpID0+IGFnZyArIGkuYWxsSXRlbXMoKS5sZW5ndGgsIDApID09IDUyKVxuICAgIGFzc2VydChwbGF5ZmllbGRfLmNvbnRhaW5lcnMucmVkdWNlKChhZ2csIGkpID0+IGFnZyArIGkuYWxsSXRlbXMoKS5sZW5ndGgsIDApID09IDUyKVxuICAgIGFwcC5ub3RpZmllclNsb3QubW92ZShtb3ZlKVxuICAgIHdpbmRvdy5zZXRUaW1lb3V0KHdvcmssIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDIwMDApKVxuICB9XG5cbiAgd29yaygpXG59XG5cbih3aW5kb3cgYXMgYW55KS5tcHRlc3RfbGF0ZW5jeSA9IGZhbHNlXG4iXX0=