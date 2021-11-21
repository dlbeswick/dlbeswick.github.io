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
import { assert } from './assert.js';
export function withElement(id, klass, func) {
    func(demandById(id, klass));
}
export function demandById(id, klass) {
    const klass_ = klass !== null && klass !== void 0 ? klass : HTMLElement;
    const result = document.getElementById(id);
    if (result == undefined) {
        throw new Error(`DOM element '${id}' not found`);
    }
    else if (!(result instanceof klass_)) {
        throw new Error(`DOM element '${id}' is not '${klass}', but is '${result.constructor.name}'`);
    }
    else {
        return result;
    }
}
export class EventListeners {
    constructor(e) {
        this.refs = [];
        this.target = e;
    }
    add(typeEvent, handler, options = {}) {
        const ref = [typeEvent,
            EventListeners.preventDefaultWrapper.bind(undefined, handler)];
        this.refs.push(ref);
        this.target.addEventListener(typeEvent, ref[1], options);
        return ref;
    }
    removeAll() {
        for (const ref of this.refs)
            this.target.removeEventListener(...ref);
        this.refs = [];
    }
    remove(ref) {
        const idx = this.refs.indexOf(ref);
        assert(idx != -1);
        this.target.removeEventListener(...ref);
        this.refs = this.refs.splice(0, idx).concat(this.refs.splice(idx + 1));
    }
    static preventDefaultWrapper(func, e) {
        const result = func(e);
        if (result === false) {
            e.preventDefault();
            e.stopPropagation();
        }
        return result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdHMvZG9tLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxPQUFPLEVBQUUsTUFBTSxFQUFXLE1BQU0sYUFBYSxDQUFBO0FBRTdDLE1BQU0sVUFBVSxXQUFXLENBQXdCLEVBQVMsRUFBRSxLQUFnQixFQUFFLElBQWtCO0lBQ2hHLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDN0IsQ0FBQztBQUVELE1BQU0sVUFBVSxVQUFVLENBQW9DLEVBQVMsRUFBRSxLQUFpQjtJQUN4RixNQUFNLE1BQU0sR0FBTyxLQUFLLGFBQUwsS0FBSyxjQUFMLEtBQUssR0FBSSxXQUFXLENBQUE7SUFFdkMsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQTtJQUMxQyxJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUU7UUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsQ0FBQTtLQUNqRDtTQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sWUFBWSxNQUFNLENBQUMsRUFBRTtRQUN0QyxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixFQUFFLGFBQWEsS0FBSyxjQUFjLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQTtLQUM5RjtTQUFNO1FBQ0wsT0FBTyxNQUFXLENBQUE7S0FDbkI7QUFDSCxDQUFDO0FBSUQsTUFBTSxPQUFPLGNBQWM7SUFJekIsWUFBWSxDQUFjO1FBSGxCLFNBQUksR0FBdUIsRUFBRSxDQUFBO1FBSW5DLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQ2pCLENBQUM7SUFFRCxHQUFHLENBQWtCLFNBQWdCLEVBQUUsT0FBNkIsRUFDL0MsVUFBZ0MsRUFBRTtRQUVyRCxNQUFNLEdBQUcsR0FBb0IsQ0FBQyxTQUFTO1lBQ1QsY0FBYyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQTtRQUM1RixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUE7UUFDeEQsT0FBTyxHQUFHLENBQUE7SUFDWixDQUFDO0lBRUQsU0FBUztRQUNQLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUk7WUFDekIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFBO1FBQ3pDLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFBO0lBQ2hCLENBQUM7SUFFRCxNQUFNLENBQUMsR0FBb0I7UUFDekIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDbEMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQTtRQUN2QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDdEUsQ0FBQztJQUVPLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxJQUE2QixFQUFFLENBQU07UUFDeEUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ3RCLElBQUksTUFBTSxLQUFLLEtBQUssRUFBRTtZQUNwQixDQUFDLENBQUMsY0FBYyxFQUFFLENBQUE7WUFDbEIsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFBO1NBQ3BCO1FBQ0QsT0FBTyxNQUFNLENBQUE7SUFDZixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQ29weXJpZ2h0IChjKSAyMDIxIERhdmlkIEJlc3dpY2suXG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgY2FyZHMtbXAgXG4gKiAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kbGJlc3dpY2svY2FyZHMtbXApLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG4gKiBpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhc1xuICogcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlXG4gKiBMaWNlbnNlLCBvciAoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuICogYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2ZcbiAqIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcbiAqIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuICogYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiAqL1xuaW1wb3J0IHsgYXNzZXJ0LCBhc3NlcnRmIH0gZnJvbSAnLi9hc3NlcnQuanMnXG5cbmV4cG9ydCBmdW5jdGlvbiB3aXRoRWxlbWVudDxUIGV4dGVuZHMgSFRNTEVsZW1lbnQ+KGlkOnN0cmluZywga2xhc3M6bmV3KCkgPT4gVCwgZnVuYzoodDpUKSA9PiB2b2lkKSB7XG4gIGZ1bmMoZGVtYW5kQnlJZChpZCwga2xhc3MpKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVtYW5kQnlJZDxUIGV4dGVuZHMgSFRNTEVsZW1lbnQ9SFRNTEVsZW1lbnQ+KGlkOnN0cmluZywga2xhc3M/Om5ldygpID0+IFQpOlQge1xuICBjb25zdCBrbGFzc186YW55ID0ga2xhc3MgPz8gSFRNTEVsZW1lbnRcbiAgXG4gIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKVxuICBpZiAocmVzdWx0ID09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRE9NIGVsZW1lbnQgJyR7aWR9JyBub3QgZm91bmRgKVxuICB9IGVsc2UgaWYgKCEocmVzdWx0IGluc3RhbmNlb2Yga2xhc3NfKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRE9NIGVsZW1lbnQgJyR7aWR9JyBpcyBub3QgJyR7a2xhc3N9JywgYnV0IGlzICcke3Jlc3VsdC5jb25zdHJ1Y3Rvci5uYW1lfSdgKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiByZXN1bHQgYXMgVFxuICB9XG59XG5cbnR5cGUgUmVmRXZlbnRMaXN0ZW5lciA9IFtzdHJpbmcsIChlOkV2ZW50KSA9PiB2b2lkXVxuXG5leHBvcnQgY2xhc3MgRXZlbnRMaXN0ZW5lcnMge1xuICBwcml2YXRlIHJlZnM6IFJlZkV2ZW50TGlzdGVuZXJbXSA9IFtdXG4gIHByaXZhdGUgdGFyZ2V0OiBFdmVudFRhcmdldFxuXG4gIGNvbnN0cnVjdG9yKGU6IEV2ZW50VGFyZ2V0KSB7XG4gICAgdGhpcy50YXJnZXQgPSBlXG4gIH1cbiAgXG4gIGFkZDxUIGV4dGVuZHMgRXZlbnQ+KHR5cGVFdmVudDpzdHJpbmcsIGhhbmRsZXI6KGU6VCkgPT4gYm9vbGVhbnx2b2lkLFxuICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zOkFkZEV2ZW50TGlzdGVuZXJPcHRpb25zPXt9KTpSZWZFdmVudExpc3RlbmVyIHtcblxuICAgIGNvbnN0IHJlZjpSZWZFdmVudExpc3RlbmVyID0gW3R5cGVFdmVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBFdmVudExpc3RlbmVycy5wcmV2ZW50RGVmYXVsdFdyYXBwZXIuYmluZCh1bmRlZmluZWQsIGhhbmRsZXIpXVxuICAgIHRoaXMucmVmcy5wdXNoKHJlZilcbiAgICB0aGlzLnRhcmdldC5hZGRFdmVudExpc3RlbmVyKHR5cGVFdmVudCwgcmVmWzFdLCBvcHRpb25zKVxuICAgIHJldHVybiByZWZcbiAgfVxuXG4gIHJlbW92ZUFsbCgpIHtcbiAgICBmb3IgKGNvbnN0IHJlZiBvZiB0aGlzLnJlZnMpXG4gICAgICB0aGlzLnRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKC4uLnJlZilcbiAgICB0aGlzLnJlZnMgPSBbXVxuICB9XG5cbiAgcmVtb3ZlKHJlZjpSZWZFdmVudExpc3RlbmVyKSB7XG4gICAgY29uc3QgaWR4ID0gdGhpcy5yZWZzLmluZGV4T2YocmVmKVxuICAgIGFzc2VydChpZHggIT0gLTEpXG4gICAgdGhpcy50YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lciguLi5yZWYpXG4gICAgdGhpcy5yZWZzID0gdGhpcy5yZWZzLnNwbGljZSgwLCBpZHgpLmNvbmNhdCh0aGlzLnJlZnMuc3BsaWNlKGlkeCsxKSlcbiAgfVxuICBcbiAgcHJpdmF0ZSBzdGF0aWMgcHJldmVudERlZmF1bHRXcmFwcGVyKGZ1bmM6IChlOmFueSkgPT4gYm9vbGVhbnx2b2lkLCBlOiBhbnkpOiBib29sZWFufHZvaWQge1xuICAgIGNvbnN0IHJlc3VsdCA9IGZ1bmMoZSlcbiAgICBpZiAocmVzdWx0ID09PSBmYWxzZSkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgfVxuICAgIHJldHVybiByZXN1bHRcbiAgfVxufVxuXG4iXX0=