import { Player } from "./player.js";
import { Car } from "./car.js";
import { g_App } from "../app.js";
export function addObjectType(type, x, y, layer) {
    switch (type) {
        case 0:
            {
                // Add a new player (computer or human)
                g_App.add(new Player(x, y));
                g_App.m_map.m_x = x;
                g_App.m_map.m_y = y;
            }
            break;
        case 1:
        case 2:
        case 3:
        case 4:
            {
                // Add a new car
                g_App.add(new Car(x, y, type - 1));
            }
            break;
    }
    ;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vdHMvb2JqZWN0cy9zZXJpYWxpemUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGFBQWEsQ0FBQTtBQUNwQyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sVUFBVSxDQUFBO0FBQzlCLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxXQUFXLENBQUE7QUFFakMsTUFBTSxVQUFVLGFBQWEsQ0FBQyxJQUFZLEVBQUUsQ0FBUyxFQUFFLENBQVMsRUFBRSxLQUFhO0lBQzlFLFFBQVEsSUFBSSxFQUNaO1FBQ0UsS0FBSyxDQUFDO1lBQ0o7Z0JBQ0UsdUNBQXVDO2dCQUN2QyxLQUFNLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixLQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7Z0JBQ3JCLEtBQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQzthQUN0QjtZQUNELE1BQU07UUFDUixLQUFLLENBQUMsQ0FBQztRQUNQLEtBQUssQ0FBQyxDQUFDO1FBQ1AsS0FBSyxDQUFDLENBQUM7UUFDUCxLQUFLLENBQUM7WUFDSjtnQkFDRSxnQkFBZ0I7Z0JBQ2hCLEtBQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNyQztZQUNELE1BQU07S0FDVDtJQUFBLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vcGxheWVyLmpzXCJcbmltcG9ydCB7IENhciB9IGZyb20gXCIuL2Nhci5qc1wiXG5pbXBvcnQgeyBnX0FwcCB9IGZyb20gXCIuLi9hcHAuanNcIlxuXG5leHBvcnQgZnVuY3Rpb24gYWRkT2JqZWN0VHlwZSh0eXBlOiBudW1iZXIsIHg6IG51bWJlciwgeTogbnVtYmVyLCBsYXllcjogbnVtYmVyKSB7XG5cdHN3aXRjaCAodHlwZSlcblx0e1xuXHQgIGNhc2UgMDpcblx0ICAgIHtcblx0ICAgICAgLy8gQWRkIGEgbmV3IHBsYXllciAoY29tcHV0ZXIgb3IgaHVtYW4pXG5cdCAgICAgIGdfQXBwIS5hZGQobmV3IFBsYXllcih4LCB5KSk7XG5cdCAgICAgIGdfQXBwIS5tX21hcC5tX3ggPSB4O1xuXHQgICAgICBnX0FwcCEubV9tYXAubV95ID0geTtcblx0ICAgIH1cblx0ICAgIGJyZWFrO1xuXHQgIGNhc2UgMTpcblx0ICBjYXNlIDI6XG5cdCAgY2FzZSAzOlxuXHQgIGNhc2UgNDpcblx0ICAgIHtcblx0ICAgICAgLy8gQWRkIGEgbmV3IGNhclxuXHQgICAgICBnX0FwcCEuYWRkKG5ldyBDYXIoeCwgeSwgdHlwZSAtIDEpKTtcblx0ICAgIH1cblx0ICAgIGJyZWFrO1xuXHR9O1xufVxuXG4iXX0=