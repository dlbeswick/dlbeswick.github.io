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
export function some(it, func) {
    for (const i of it) {
        if (func(i))
            return true;
    }
    return false;
}
export function* filter(it, func) {
    for (const i of it) {
        if (func(i))
            yield i;
    }
}
export function* map(it, func) {
    for (const i of it) {
        yield func(i);
    }
}
export function* flatMap(it, func) {
    for (const i of it) {
        for (const j of func(i))
            yield j;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXRlcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi90cy9pdGVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBa0JHO0FBQ0gsTUFBTSxVQUFVLElBQUksQ0FBSSxFQUFlLEVBQUUsSUFBdUI7SUFDOUQsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDbEIsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ1QsT0FBTyxJQUFJLENBQUE7S0FDZDtJQUVELE9BQU8sS0FBSyxDQUFBO0FBQ2QsQ0FBQztBQUVELE1BQU0sU0FBVSxDQUFDLENBQUEsTUFBTSxDQUFPLEVBQWUsRUFBRSxJQUFpQjtJQUM5RCxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNsQixJQUFJLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDVCxNQUFNLENBQUMsQ0FBQTtLQUNWO0FBQ0gsQ0FBQztBQUVELE1BQU0sU0FBVSxDQUFDLENBQUEsR0FBRyxDQUFPLEVBQWUsRUFBRSxJQUFpQjtJQUMzRCxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNsQixNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNkO0FBQ0gsQ0FBQztBQUVELE1BQU0sU0FBVSxDQUFDLENBQUEsT0FBTyxDQUFPLEVBQWUsRUFBRSxJQUF3QjtJQUN0RSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRTtRQUNsQixLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckIsTUFBTSxDQUFDLENBQUE7S0FDVjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQ29weXJpZ2h0IChjKSAyMDIxIERhdmlkIEJlc3dpY2suXG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgY2FyZHMtbXAgXG4gKiAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kbGJlc3dpY2svY2FyZHMtbXApLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG4gKiBpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhc1xuICogcHVibGlzaGVkIGJ5IHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlXG4gKiBMaWNlbnNlLCBvciAoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuICpcbiAqIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuICogYnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2ZcbiAqIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcbiAqIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuICogYWxvbmcgd2l0aCB0aGlzIHByb2dyYW0uIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNvbWU8VD4oaXQ6IEl0ZXJhYmxlPFQ+LCBmdW5jOiAoYTogVCkgPT4gYm9vbGVhbikge1xuICBmb3IgKGNvbnN0IGkgb2YgaXQpIHtcbiAgICBpZiAoZnVuYyhpKSlcbiAgICAgIHJldHVybiB0cnVlXG4gIH1cblxuICByZXR1cm4gZmFsc2Vcbn1cblxuZXhwb3J0IGZ1bmN0aW9uICpmaWx0ZXI8VCwgVT4oaXQ6IEl0ZXJhYmxlPFQ+LCBmdW5jOiAoYTogVCkgPT4gVSkge1xuICBmb3IgKGNvbnN0IGkgb2YgaXQpIHtcbiAgICBpZiAoZnVuYyhpKSlcbiAgICAgIHlpZWxkIGlcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gKm1hcDxULCBVPihpdDogSXRlcmFibGU8VD4sIGZ1bmM6IChhOiBUKSA9PiBVKSB7XG4gIGZvciAoY29uc3QgaSBvZiBpdCkge1xuICAgIHlpZWxkIGZ1bmMoaSlcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gKmZsYXRNYXA8VCwgVT4oaXQ6IEl0ZXJhYmxlPFQ+LCBmdW5jOiAoYTogVCkgPT4gQXJyYXk8VT4pIHtcbiAgZm9yIChjb25zdCBpIG9mIGl0KSB7XG4gICAgZm9yIChjb25zdCBqIG9mIGZ1bmMoaSkpXG4gICAgICB5aWVsZCBqXG4gIH1cbn1cbiJdfQ==