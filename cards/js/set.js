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
export function isSuperset(set, subset) {
    for (const elem of subset) {
        if (!set.has(elem)) {
            return false;
        }
    }
    return true;
}
export function union(setA, setB) {
    let _union = new Set(setA);
    for (let elem of setB) {
        _union.add(elem);
    }
    return _union;
}
export function intersection(setA, setB) {
    let _intersection = new Set();
    for (let elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem);
        }
    }
    return _intersection;
}
export function symmetricDifference(setA, setB) {
    let _difference = new Set(setA);
    for (let elem of setB) {
        if (_difference.has(elem)) {
            _difference.delete(elem);
        }
        else {
            _difference.add(elem);
        }
    }
    return _difference;
}
export function difference(setA, setB) {
    let _difference = new Set(setA);
    for (let elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdHMvc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxNQUFNLFVBQVUsVUFBVSxDQUFJLEdBQVcsRUFBRSxNQUFjO0lBQ3JELEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxFQUFFO1FBQ3ZCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2hCLE9BQU8sS0FBSyxDQUFBO1NBQ2Y7S0FDSjtJQUNELE9BQU8sSUFBSSxDQUFBO0FBQ2YsQ0FBQztBQUVELE1BQU0sVUFBVSxLQUFLLENBQUksSUFBWSxFQUFFLElBQVk7SUFDL0MsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDMUIsS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7UUFDbkIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQTtLQUNuQjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2pCLENBQUM7QUFFRCxNQUFNLFVBQVUsWUFBWSxDQUFJLElBQVksRUFBRSxJQUFZO0lBQ3RELElBQUksYUFBYSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUE7SUFDN0IsS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7UUFDbkIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2hCLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7U0FDMUI7S0FDSjtJQUNELE9BQU8sYUFBYSxDQUFBO0FBQ3hCLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUksSUFBWSxFQUFFLElBQVk7SUFDN0QsSUFBSSxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDL0IsS0FBSyxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7UUFDbkIsSUFBSSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7U0FDM0I7YUFBTTtZQUNILFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUE7U0FDeEI7S0FDSjtJQUNELE9BQU8sV0FBVyxDQUFBO0FBQ3RCLENBQUM7QUFFRCxNQUFNLFVBQVUsVUFBVSxDQUFJLElBQVksRUFBRSxJQUFZO0lBQ3BELElBQUksV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQy9CLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1FBQ25CLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUE7S0FDM0I7SUFDRCxPQUFPLFdBQVcsQ0FBQTtBQUN0QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAoYykgMjAyMSBEYXZpZCBCZXN3aWNrLlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIGNhcmRzLW1wIFxuICogKHNlZSBodHRwczovL2dpdGh1Yi5jb20vZGxiZXN3aWNrL2NhcmRzLW1wKS5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuICogaXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXNcbiAqIHB1Ymxpc2hlZCBieSB0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZVxuICogTGljZW5zZSwgb3IgKGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cbiAqXG4gKiBUaGlzIHByb2dyYW0gaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcbiAqIGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG4gKiBNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG4gKiBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2VcbiAqIGFsb25nIHdpdGggdGhpcyBwcm9ncmFtLiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N1cGVyc2V0PFQ+KHNldDogU2V0PFQ+LCBzdWJzZXQ6IFNldDxUPikge1xuICAgIGZvciAoY29uc3QgZWxlbSBvZiBzdWJzZXQpIHtcbiAgICAgICAgaWYgKCFzZXQuaGFzKGVsZW0pKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5pb248VD4oc2V0QTogU2V0PFQ+LCBzZXRCOiBTZXQ8VD4pIHtcbiAgICBsZXQgX3VuaW9uID0gbmV3IFNldChzZXRBKVxuICAgIGZvciAobGV0IGVsZW0gb2Ygc2V0Qikge1xuICAgICAgICBfdW5pb24uYWRkKGVsZW0pXG4gICAgfVxuICAgIHJldHVybiBfdW5pb25cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVyc2VjdGlvbjxUPihzZXRBOiBTZXQ8VD4sIHNldEI6IFNldDxUPikge1xuICAgIGxldCBfaW50ZXJzZWN0aW9uID0gbmV3IFNldCgpXG4gICAgZm9yIChsZXQgZWxlbSBvZiBzZXRCKSB7XG4gICAgICAgIGlmIChzZXRBLmhhcyhlbGVtKSkge1xuICAgICAgICAgICAgX2ludGVyc2VjdGlvbi5hZGQoZWxlbSlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gX2ludGVyc2VjdGlvblxufVxuXG5leHBvcnQgZnVuY3Rpb24gc3ltbWV0cmljRGlmZmVyZW5jZTxUPihzZXRBOiBTZXQ8VD4sIHNldEI6IFNldDxUPikge1xuICAgIGxldCBfZGlmZmVyZW5jZSA9IG5ldyBTZXQoc2V0QSlcbiAgICBmb3IgKGxldCBlbGVtIG9mIHNldEIpIHtcbiAgICAgICAgaWYgKF9kaWZmZXJlbmNlLmhhcyhlbGVtKSkge1xuICAgICAgICAgICAgX2RpZmZlcmVuY2UuZGVsZXRlKGVsZW0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfZGlmZmVyZW5jZS5hZGQoZWxlbSlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gX2RpZmZlcmVuY2Vcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpZmZlcmVuY2U8VD4oc2V0QTogU2V0PFQ+LCBzZXRCOiBTZXQ8VD4pIHtcbiAgICBsZXQgX2RpZmZlcmVuY2UgPSBuZXcgU2V0KHNldEEpXG4gICAgZm9yIChsZXQgZWxlbSBvZiBzZXRCKSB7XG4gICAgICAgIF9kaWZmZXJlbmNlLmRlbGV0ZShlbGVtKVxuICAgIH1cbiAgICByZXR1cm4gX2RpZmZlcmVuY2Vcbn1cbiJdfQ==