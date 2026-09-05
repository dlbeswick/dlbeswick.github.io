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
function load(url) {
    const img = document.createElement("div");
    img.style.content = "url(" + url + ")";
    return img;
}
export class Images {
    constructor(urlCards, urlCardBack) {
        this.cards = [];
        for (let s = 0; s < 4; ++s) {
            for (let r = 0; r < 13; ++r) {
                this.cards.push(load(urlCards + '#c' + s + '_' + r));
            }
        }
        this.cardBack = load(urlCardBack);
    }
    card(suit, rank) {
        return this.cards[suit * 13 + rank].cloneNode(true);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdHMvaW1hZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxTQUFTLElBQUksQ0FBQyxHQUFXO0lBQ3ZCLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDekMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUE7SUFDdEMsT0FBTyxHQUFHLENBQUE7QUFDWixDQUFDO0FBRUQsTUFBTSxPQUFPLE1BQU07SUFJakIsWUFBWSxRQUFnQixFQUFFLFdBQW1CO1FBSHhDLFVBQUssR0FBcUIsRUFBRSxDQUFBO1FBSW5DLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUU7WUFDMUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRTtnQkFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO2FBQ3JEO1NBQ0Y7UUFFRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQTtJQUNuQyxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVksRUFBRSxJQUFZO1FBQzdCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUMsRUFBRSxHQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQW1CLENBQUE7SUFDbkUsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAoYykgMjAyMSBEYXZpZCBCZXN3aWNrLlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIGNhcmRzLW1wIFxuICogKHNlZSBodHRwczovL2dpdGh1Yi5jb20vZGxiZXN3aWNrL2NhcmRzLW1wKS5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuICogaXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXNcbiAqIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZVxuICogTGljZW5zZSwgb3IgKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG4gKiBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2VcbiAqIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cbmZ1bmN0aW9uIGxvYWQodXJsOiBzdHJpbmcpIHtcbiAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICBpbWcuc3R5bGUuY29udGVudCA9IFwidXJsKFwiICsgdXJsICsgXCIpXCJcbiAgcmV0dXJuIGltZ1xufVxuXG5leHBvcnQgY2xhc3MgSW1hZ2VzIHtcbiAgcmVhZG9ubHkgY2FyZHM6IEhUTUxEaXZFbGVtZW50W10gPSBbXVxuICByZWFkb25seSBjYXJkQmFjazogSFRNTERpdkVsZW1lbnRcbiAgXG4gIGNvbnN0cnVjdG9yKHVybENhcmRzOiBzdHJpbmcsIHVybENhcmRCYWNrOiBzdHJpbmcpIHtcbiAgICBmb3IgKGxldCBzID0gMDsgcyA8IDQ7ICsrcykge1xuICAgICAgZm9yIChsZXQgciA9IDA7IHIgPCAxMzsgKytyKSB7XG4gICAgICAgIHRoaXMuY2FyZHMucHVzaChsb2FkKHVybENhcmRzICsgJyNjJyArIHMgKyAnXycgKyByKSlcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgdGhpcy5jYXJkQmFjayA9IGxvYWQodXJsQ2FyZEJhY2spXG4gIH1cblxuICBjYXJkKHN1aXQ6IG51bWJlciwgcmFuazogbnVtYmVyKTogSFRNTERpdkVsZW1lbnQge1xuICAgIHJldHVybiB0aGlzLmNhcmRzW3N1aXQqMTMrcmFua10uY2xvbmVOb2RlKHRydWUpIGFzIEhUTUxEaXZFbGVtZW50XG4gIH1cbn1cbiJdfQ==