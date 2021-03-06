export class Pic {
    constructor(img) {
        this.img = img;
    }
    static load(url) {
        return fetch(url)
            .then(response => {
            if (response.ok)
                return response.blob();
            else
                throw (`Could not load image '${url}': ${response.statusText}`);
        })
            .then(blob => createImageBitmap(blob))
            .then(img => new Pic(img));
    }
    get width() { return this.img.width; }
    get height() { return this.img.height; }
}
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGljLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdHMvcGljLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sT0FBTyxHQUFHO0lBQ2YsWUFBcUIsR0FBZ0I7UUFBaEIsUUFBRyxHQUFILEdBQUcsQ0FBYTtJQUNyQyxDQUFDO0lBRUEsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFXO1FBQ3JCLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQzthQUNkLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNmLElBQUksUUFBUSxDQUFDLEVBQUU7Z0JBQ2IsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUE7O2dCQUV0QixNQUFLLENBQUMseUJBQXlCLEdBQUcsTUFBTSxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQTtRQUNsRSxDQUFDLENBQUM7YUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNyQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBQzlCLENBQUM7SUFFRixJQUFJLEtBQUssS0FBSyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFBLENBQUMsQ0FBQztJQUNyQyxJQUFJLE1BQU0sS0FBSyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFBLENBQUMsQ0FBQztDQUN2QztBQUFBLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY2xhc3MgUGljIHtcblx0Y29uc3RydWN0b3IocmVhZG9ubHkgaW1nOiBJbWFnZUJpdG1hcCkge1xuXHR9XG5cbiAgc3RhdGljIGxvYWQodXJsOiBzdHJpbmcpOiBQcm9taXNlPFBpYz4ge1xuICAgIHJldHVybiBmZXRjaCh1cmwpXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgIGlmIChyZXNwb25zZS5vaylcbiAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuYmxvYigpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyhgQ291bGQgbm90IGxvYWQgaW1hZ2UgJyR7dXJsfSc6ICR7cmVzcG9uc2Uuc3RhdHVzVGV4dH1gKVxuICAgICAgfSlcbiAgICAgIC50aGVuKGJsb2IgPT4gY3JlYXRlSW1hZ2VCaXRtYXAoYmxvYikpXG4gICAgICAudGhlbihpbWcgPT4gbmV3IFBpYyhpbWcpKVxuICB9XG4gIFxuXHRnZXQgd2lkdGgoKSB7IHJldHVybiB0aGlzLmltZy53aWR0aCB9XG5cdGdldCBoZWlnaHQoKSB7IHJldHVybiB0aGlzLmltZy5oZWlnaHQgfVxufTtcbiJdfQ==