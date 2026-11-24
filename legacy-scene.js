import { legacySceneUrl } from "./scene-routes.js?v=20261124-pages";

location.replace(legacySceneUrl(new URL("./", import.meta.url), new URL(location.href)));
