import { flag } from "flags/next";

export const upNext = flag<boolean>({
  key: "up-next",
  defaultValue: false,
  decide() {
    return false;
  },
});
