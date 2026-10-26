/** LOCKED — AD5X Design Connector thumbnails: Dark industrial visual family.
 * Every connector ID must have a UNIQUE, dedicated picture. No generic icons,
 * duplicated filenames, or placeholder images. Adding a connector to
 * CONNECTOR_PRESETS requires adding an asset & entry here at compile time.
 *
 * Assets: /public/connector-thumbnails/<connector-id>.svg
 * The pictures identify physical connectors, while the placement tools
 * continue to create editable CUTOUTS, not solid connector bodies.
 */
import type {OriginalConnectorId} from "./connectorPrefabs";

export const CONNECTOR_THUMBNAILS = {
  "banana-mini2":"/connector-thumbnails/banana-mini2.svg",
  "banana-mini3":"/connector-thumbnails/banana-mini3.svg",
  "banana-standard4":"/connector-thumbnails/banana-standard4.svg",
  "banana-type-b-socket":"/connector-thumbnails/banana-type-b-socket.svg",
  "db9-male":"/connector-thumbnails/db9-male.svg",
  "db9-female":"/connector-thumbnails/db9-female.svg",
  "xt60-panel-03":"/connector-thumbnails/xt60-panel-03.svg",
} as const satisfies Record<OriginalConnectorId,string>;

export const connectorThumbnail = (id:OriginalConnectorId):string=>CONNECTOR_THUMBNAILS[id];