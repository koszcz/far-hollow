# 33: Build the furniture build menu and the structure build menu from one function

**What to build:** `FURNITURE_BUILD_MENU` in `src/sim/api-build-menu.ts` builds the same entry shape as `buildMenuOf` in `src/sim/build-menu.ts`. Build both from one function, so a new field on a build menu entry is added in one place.

**Blocked by:** None

**Status:** idea

**Assets:** None. This ticket changes code layout only.

Questions for grilling:

- Which module owns the shared function, given the UI may import only `api-*` modules from `src/sim`?
- Do the two menus differ on purpose, such as `placement` being always "anywhere" for furniture?
