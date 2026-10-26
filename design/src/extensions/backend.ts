import {makeShape} from "../lib/primitives";
import type {GeometryBackend} from "./contracts";
/** Scene construction adapter only. Existing CSG/STL/STEP paths remain authoritative.
 * A replacement backend must produce compatible editable nodes and pass export tests.
 */
export const currentGeometryBackend:GeometryBackend={
 id:"ad5x-existing-scene-v1",
 primitiveKinds:["box","sketch"],
 createShape:makeShape,
};
