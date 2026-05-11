import { BashToolDisplay } from "./BashToolDisplay";
import { DefaultToolDisplay } from "./DefaultToolDisplay";
import { GlobToolDisplay } from "./GlobToolDisplay";
import { GrepToolDisplay } from "./GrepToolDisplay";
import { IOToolDisplay } from "./IOToolDisplay";
import { WebSearchToolDisplay } from "./WebSearchToolDisplay";
import type { ToolVariantComponent } from "./types";

/** Default mapping of tool names → variants. ConversationView (later) will let
 *  consumers pass their own registry that's merged with these defaults. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultToolVariants: Record<string, ToolVariantComponent<any, any>> = {
  read_file: IOToolDisplay,
  write_file: IOToolDisplay,
  str_replace: IOToolDisplay,
  show_image: IOToolDisplay,
  grep: GrepToolDisplay,
  search: GrepToolDisplay,
  glob: GlobToolDisplay,
  find: GlobToolDisplay,
  bash: BashToolDisplay,
  shell: BashToolDisplay,
  exec: BashToolDisplay,
  web_search: WebSearchToolDisplay,
};

export { DefaultToolDisplay };
